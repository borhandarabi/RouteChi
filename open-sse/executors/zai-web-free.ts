/**
 * ZaiWebFreeExecutor ?�� Z.AI (chat.z.ai) free-tier web bridge.
 *
 * Ported from GLM-Free-API (Go) by izaart95-jpg. This executor targets the
 * chat.z.ai **consumer web chat** endpoint (`/api/v2/chat/completions`), NOT
 * the official Z.AI API (`api.z.ai/api/anthropic/v1/messages`). The web
 * endpoint is free (guest session, no API key required) but requires an
 * Aliyun CaptchaV3 verification on every request ?�� which this executor
 * generates in-memory.
 *
 * Differences from the existing `zai` provider (which uses the official API):
 *   - `zai`       ?�� `api.z.ai/api/anthropic/v1/messages`, requires API key (paid)
 *   - `zai-web-free` (this) ?�� `chat.z.ai/api/v2/chat/completions`, free, requires captcha
 *
 * Auth flow:
 *   1. On first request, call Z.AI's `/api/v1/auths/guest` to obtain a guest
 *      JWT (or use `providerSpecificData.token` if the user supplied one).
 *   2. Decode the JWT to extract `userId` (needed for the request signature).
 *   3. Generate an Aliyun `captcha_verify_param` using the device-token pool.
 *   4. Compute an HMAC-SHA256 `X-Signature` header over the prompt.
 *   5. POST to `/api/v2/chat/completions?...` with the captcha param, signature,
 *      and OpenAI-format messages.
 *
 * The captcha step consumes one device token per attempt (up to 2 retries).
 * Device tokens are collected via a separate Playwright script ?�� see
 * `scripts/dev/zai-web-free/refresh-device-tokens.mjs` and the dashboard
 * "Refresh device tokens" button (POST `/api/providers/zai-web-free/refresh-tokens`).
 *
 * Streaming: Z.AI's web endpoint always returns SSE. The SSE format is
 * non-standard ?�� events carry `data.edit_content`, `data.delta_content`, or
 * `data.content` fields (not OpenAI's `choices[0].delta.content`). This
 * executor normalizes them to OpenAI-format chunks.
 *
 * @module zai-web-free
 */

import { BaseExecutor, type ExecuteInput } from "./base.ts";
import {
  makeExecutorErrorResult as makeErrorResult,
  sanitizeErrorMessage,
} from "../utils/error.ts";
import { Buffer } from "node:buffer";
import { logger } from "../utils/logger.ts";

import {
  getSession,
  resetSession,
  setHardcodedToken,
  type ZaiSession,
} from "./zai-web-free/session.ts";
import { generateZaSignature } from "./zai-web-free/signature.ts";
import { getCaptchaVerifyParam } from "./zai-web-free/captcha.ts";
import {
  getNextToken,
  consumeToken,
  getPoolSize,
  initDeviceTokenPool,
  addDeviceTokens,
} from "./zai-web-free/device-token-pool.ts";
import { getSettings, type CaptchaStrategy } from "./zai-web-free/settings-store.ts";
import {
  getFreshDeviceTokenViaBrowser,
  getCaptchaParamViaBrowser,
} from "./zai-web-free/browser-captcha.ts";
import { applyThinkMode } from "../utils/thinkModeProcessor.ts";
import { resolveThinkMode } from "../services/thinkOutputMode.ts";
import { isZaiWebFreeDisabled } from "./zai-web-free/feature-flag.ts";
import { notifyRequest as notifyDaemonRequest } from "./zai-web-free/auto-refresh-daemon.ts";
import { getAgentChatId } from "../utils/agentChatIdExtractor.ts";
import { getMapping, saveMapping } from "../services/providerSessionRegistry.ts";
import { randomUUID } from "node:crypto";

const log = logger("ZAI-WEB-FREE");

const CHAT_COMPLETIONS_URL = "https://chat.z.ai/api/v2/chat/completions";

// Fallback model list (used when Z.AI's /api/models is unreachable)
const FALLBACK_MODELS = ["glm-5.2", "GLM-5.1", "GLM-5-Turbo", "GLM-5v-Turbo", "glm-4.7"];

const DEFAULT_MODEL = "glm-4.7"; // Guest sessions only allow glm-4.7

// ?��?�� Types ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��

interface ZaiMessage {
  role: string;
  content: string | Array<{ type: string; text?: string }> | null;
}

interface ZaiSSEChunk {
  data?: {
    phase?: string;
    edit_content?: string;
    edit_index?: number;
    delta_content?: string;
    content?: string;
    error?: { detail?: string; message?: string; code?: unknown };
    // Nested variant: Z.AI sometimes wraps errors in data.data.error
    data?: {
      error?: { detail?: string; message?: string; code?: unknown };
      done?: boolean;
    };
  };
  choices?: Array<{
    delta?: { content?: string; tool_calls?: unknown };
  }>;
  error?: { detail?: string; message?: string; code?: unknown };
}

// ? ?? OpenAI tool-call types (inline — no tool-bridge.ts dependency) ? ?

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ZaiToolRegistry {
  enabled: boolean;
  toolsByName: Map<string, { name: string; description?: string; parameters: unknown }>;
}

/**
 * Build a tool registry from the OpenAI request body's `tools` field.
 * Returns a disabled registry if no tools are present.
 */
function buildZaiToolRegistry(body: Record<string, unknown>): ZaiToolRegistry {
  const tools = body.tools as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(tools) || tools.length === 0) {
    return { enabled: false, toolsByName: new Map() };
  }

  const toolsByName = new Map<
    string,
    { name: string; description?: string; parameters: unknown }
  >();
  for (const tool of tools) {
    const fn = tool.function as Record<string, unknown> | undefined;
    if (!fn || typeof fn.name !== "string") continue;
    toolsByName.set(fn.name, {
      name: fn.name,
      description: typeof fn.description === "string" ? fn.description : undefined,
      parameters: fn.parameters ?? {},
    });
  }

  return { enabled: toolsByName.size > 0, toolsByName };
}

/**
 * Parse a tool_calls delta from a Z.AI SSE chunk.
 * Returns null if the chunk doesn't contain tool call data.
 */
function parseZaiToolCallDelta(
  chunk: Record<string, unknown>
): Array<{
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}> | null {
  const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const delta = choices[0]?.delta as Record<string, unknown> | undefined;
  if (!delta) return null;

  const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  return toolCalls.map((tc) => ({
    index: typeof tc.index === "number" ? tc.index : 0,
    id: typeof tc.id === "string" ? tc.id : undefined,
    type: typeof tc.type === "string" ? tc.type : "function",
    function: tc.function as { name?: string; arguments?: string } | undefined,
  }));
}

/**
 * Enqueue OpenAI-shaped tool call SSE chunks into the streaming controller.
 *
 * Emits one chunk per tool call, followed by a finish chunk with
 * `finish_reason: "tool_calls"`, then `[DONE]`.
 */
function enqueueStreamingToolCalls(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  params: {
    id: string;
    created: number;
    model: string;
    fingerprint: string;
    toolCalls: OpenAIToolCall[];
  }
): void {
  for (let i = 0; i < params.toolCalls.length; i++) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          id: params.id,
          object: "chat.completion.chunk",
          created: params.created,
          model: params.model,
          system_fingerprint: params.fingerprint || null,
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: i, ...params.toolCalls[i] }] },
              finish_reason: null,
              logprobs: null,
            },
          ],
        })}\n\n`
      )
    );
  }
  controller.enqueue(
    encoder.encode(
      `data: ${JSON.stringify({
        id: params.id,
        object: "chat.completion.chunk",
        created: params.created,
        model: params.model,
        system_fingerprint: params.fingerprint || null,
        choices: [{ index: 0, delta: {}, finish_reason: "tool_calls", logprobs: null }],
      })}\n\n`
    )
  );
  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
}

/**
 * Accumulate tool call deltas across multiple SSE chunks.
 * Returns the completed tool calls when all arguments are received.
 */
class ToolCallAccumulator {
  private calls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  feed(
    deltas: Array<{
      index: number;
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }>
  ): void {
    for (const d of deltas) {
      const existing = this.calls.get(d.index) ?? { id: "", name: "", arguments: "" };
      if (d.id) existing.id = d.id;
      if (d.function?.name) existing.name = d.function.name;
      if (d.function?.arguments) existing.arguments += d.function.arguments;
      this.calls.set(d.index, existing);
    }
  }

  getCompleted(): OpenAIToolCall[] {
    const result: OpenAIToolCall[] = [];
    const sorted = [...this.calls.entries()].sort((a, b) => a[0] - b[0]);
    for (const [, tc] of sorted) {
      if (tc.name) {
        result.push({
          id: tc.id || `call_${Date.now().toString(36)}`,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments || "{}" },
        });
      }
    }
    return result;
  }

  hasPending(): boolean {
    return this.calls.size > 0;
  }
}

// ?��?�� Helpers ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��

function extractTextContent(content: ZaiMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p) => p && p.type === "text" && p.text)
      .map((p) => p.text as string)
      .join("\n");
  }
  return "";
}

/**
 * Fold an OpenAI messages array into a single prompt string. Z.AI's web
 * endpoint accepts a `messages` array, but the signature is computed over
 * a single `prompt` string ?�� so we collapse the conversation.
 *
 * Tool messages are folded as plain text (Z.AI's web chat has no concept
 * of tool results). Multi-turn conversations collapse to "Role: content"
 * blocks joined by newlines.
 */
function messagesToPrompt(messages: ZaiMessage[]): string {
  const entries: Array<{ role: string; text: string }> = [];
  for (const m of messages) {
    const text = extractTextContent(m.content).trim();
    if (!text) continue;
    const role = m.role === "system" ? "System" : m.role === "assistant" ? "Assistant" : "User";
    entries.push({ role, text });
  }
  if (entries.length === 1 && entries[0].role === "User") {
    return entries[0].text;
  }
  return entries.map((e) => `${e.role}: ${e.text}`).join("\n\n");
}

/**
 * Inspect a Z.AI SSE chunk for an inline error (Z.AI sometimes returns HTTP
 * 200 with the error inside the JSON body).
 *
 * Checks (ported from GLM-Free-API Go extractZAIError):
 *   1. data.error — explicit error object
 *   2. data.data.error — nested variant observed in production (Go has this,
 *      our TS port was missing it — this is where "Currently in peak hours"
 *      and FRONTEND_CAPTCHA_REQUIRED errors live)
 *   3. j.error — top-level error object
 *   4. data.content / data.delta_content — peak-hour / capacity messages that
 *      Z.AI sends as regular content (not in an error field). We pattern-match
 *      known error phrases so we can return 503 (retryable) instead of showing
 *      the message as normal content.
 */
function extractZaiError(j: ZaiSSEChunk): string {
  if (j.data) {
    // data.error
    if (j.data.error) {
      const err = j.data.error;
      const detail = err.detail || err.message || "";
      if (detail) {
        return err.code !== undefined ? `${detail} (code: ${err.code})` : detail;
      }
    }
    // data.data.error (nested variant — this is where peak-hours and captcha
    // errors live in production, matching the Go reference)
    if (j.data.data?.error) {
      const err = j.data.data.error;
      const detail = err.detail || err.message || "";
      if (detail) {
        return err.code !== undefined ? `${detail} (code: ${err.code})` : detail;
      }
    }
  }
  // Top-level error
  if (j.error) {
    const err = j.error;
    return err.detail || err.message || "";
  }
  // Z.AI sometimes sends peak-hour / capacity messages as regular content
  // (not in an error field). Pattern-match known phrases.
  const contentStr = j.data?.content || j.data?.delta_content || "";
  if (contentStr && isZaiCapacityMessage(contentStr)) {
    return contentStr;
  }
  return "";
}

/**
 * Detect Z.AI capacity/peak-hour messages that are sent as regular content
 * rather than as error objects. These should trigger a 503 (retryable) so
 * RouteChi's retry/fallback logic can kick in.
 */
function isZaiCapacityMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("peak hours") ||
    lower.includes("intensifying the coordination") ||
    (lower.includes("switch to") && lower.includes("for experience")) ||
    lower.includes("try again later") ||
    lower.includes("currently in peak") ||
    (lower.includes("resource") && lower.includes("busy")) ||
    lower.includes("server is busy") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("please try again") ||
    lower.includes("model is busy") ||
    lower.includes("high traffic") ||
    lower.includes("overloaded")
  );
}

/**
 * Map a Z.AI inline error string to an appropriate HTTP status code.
 * Capacity/concurrency/peak-hour errors → 503 (retry-able), others → 502.
 */
function zaiErrorToStatus(errDetail: string): number {
  const lower = errDetail.toLowerCase();
  // Capacity / concurrency / peak-hour errors → 503 (retryable)
  if (
    lower.includes("capacity") ||
    lower.includes("concurrency") ||
    lower.includes("rate limit") ||
    lower.includes("peak hours") ||
    lower.includes("intensifying") ||
    lower.includes("try again later") ||
    lower.includes("switch to") ||
    lower.includes("server is busy") ||
    lower.includes("overloaded") ||
    lower.includes("high traffic") ||
    lower.includes("model is busy") ||
    lower.includes("temporarily unavailable")
  ) {
    return 503;
  }
  if (lower.includes("auth") || lower.includes("unauthorized") || lower.includes("token")) {
    return 401;
  }
  if (lower.includes("paywall") || lower.includes("subscription") || lower.includes("plan")) {
    return 402;
  }
  return 502;
}

/**
 * Resolve the feature map for a model. Z.AI's web endpoint accepts a
 * `features` object that toggles web_search, thinking, etc.
 *
 * Per-request overrides (from the OpenAI body's `web_search` /
 * `reasoning_effort` fields) take precedence over the model's defaults.
 */
function resolveFeatures(bodyObj: Record<string, unknown>): Record<string, unknown> {
  const features: Record<string, unknown> = {
    web_search: false,
    auto_web_search: false,
    think: false,
    enable_thinking: false,
    preview_mode: false,
    image_generation: false, // ALWAYS false ?�� Z.AI rejects image gen on web
    flags: [],
  };

  // Per-request overrides
  if (bodyObj.web_search === true || bodyObj.webSearch === true) {
    features.web_search = true;
    features.auto_web_search = true;
  }
  if (bodyObj.reasoning_effort && bodyObj.reasoning_effort !== "none") {
    features.think = true;
    features.enable_thinking = true;
  }
  if (bodyObj.deepThink === true) {
    features.think = true;
    features.enable_thinking = true;
  }

  return features;
}

// ?��?�� Executor ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��

export class ZaiWebFreeExecutor extends BaseExecutor {
  private static initialized = false;

  constructor() {
    super("zai-web-free", { id: "zai-web-free", baseUrl: "https://chat.z.ai" });
    // Lazy-init the device-token pool from the RouteChi data directory.
    // The pool path is read from the OMNIROUTE_DATA_DIR env var (set by the
    // server bootstrap) ?�� falls back to ~/.omniroute/omniroute.db.
    if (!ZaiWebFreeExecutor.initialized) {
      const dataDir =
        process.env.OMNIROUTE_DATA_DIR ||
        (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
      const dbPath = `${dataDir}/omniroute.db`;
      try {
        initDeviceTokenPool(dbPath);
      } catch (err) {
        log.warn?.("pool.init_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      ZaiWebFreeExecutor.initialized = true;
    }
  }

  override async execute(input: ExecuteInput): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }> {
    const { body, credentials, signal, stream: wantStream, log: inputLog } = input;
    const bodyObj = (body || {}) as Record<string, unknown>;

    // Dynamic logger: use "ZAI-WEB-TOKEN" when a user-supplied JWT is present
    // (zai-web-token provider), otherwise "ZAI-WEB-FREE" (zai-web-free guest).
    // This makes log output distinguishable between the two providers even
    // though they share the same executor.
    const psd0 = credentials?.providerSpecificData as { token?: string } | undefined;
    const hasUserToken = !!(psd0?.token || (credentials?.apiKey ? String(credentials.apiKey).trim() : ""));
    const dynLog = logger(hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE");

    // Feature flag — default ENABLED. Operator can disable via
    // OMNIROUTE_ZAI_WEB_FREE_DISABLED=1 or OMNIROUTE_ZAI_WEB_FREE_ENABLED=0.
    // When disabled, fail fast with 503 so the upstream retry/fallback
    // logic can route to another provider instead of burning a captcha
    // attempt + device token on a doomed request.
    if (isZaiWebFreeDisabled()) {
      return makeErrorResult(
        503,
        "zai-web-free is disabled via OMNIROUTE_ZAI_WEB_FREE_DISABLED env var",
        body,
        CHAT_COMPLETIONS_URL
      );
    }

    // 1. Resolve the Z.AI session (guest JWT or user-supplied token)
    // The token can come from:
    //   - providerSpecificData.token (structured form), OR
    //   - credentials.apiKey (the standard web-session token field ?��
    //     `resolveWebSessionImportApiKey` stores token-kind credentials there)
    const psd = credentials?.providerSpecificData as { token?: string } | undefined;
    const hardcodedToken =
      psd?.token || (credentials?.apiKey ? String(credentials.apiKey).trim() : "");
    if (hardcodedToken) {
      setHardcodedToken(hardcodedToken);
    }
    let session: ZaiSession;
    try {
      session = await getSession();
    } catch (err) {
      return makeErrorResult(
        502,
        `Z.AI session init failed: ${err instanceof Error ? err.message : String(err)}`,
        body,
        "https://chat.z.ai"
      );
    }

    // 2. Build the request
    const messages = (bodyObj.messages as ZaiMessage[]) || [];
    if (messages.length === 0) {
      return makeErrorResult(
        400,
        "messages is required and must be a non-empty array",
        body,
        CHAT_COMPLETIONS_URL
      );
    }

    const requestedModel = (bodyObj.model as string) || DEFAULT_MODEL;
    const prompt = messagesToPrompt(messages);
    const features = resolveFeatures(bodyObj);

    // 3. Compute the captcha_verify_param
    // Three strategies, tried in order:
    //   a) Fast path: server-side crypto with device tokens from the pool.
    //   b) Fast path with fresh token: if pool is empty/stale, get a single
    //      fresh device token via Playwright (quick ?�� just getToken()),
    //      then retry the server-side crypto path. Much faster than full
    //      browser captcha (~2s vs ~10s).
    //   c) Browser fallback: full Playwright captcha (intercept the browser's
    //      chat request to extract captcha_verify_param). Slowest (~5-10s)
    //      but always works.
    //
    // Note: captcha is ALWAYS required, even with a user-supplied JWT.
    //
    // Strategy is configurable from the dashboard (Settings → Aliyun Captcha
    // Keys → Captcha Strategy). See settings-store.ts for the full list.
    const settings = getSettings();
    const strategy: CaptchaStrategy = settings.captchaStrategy;
    const retries = settings.captchaRetries;
    const timeoutMs = settings.captchaTimeoutMs;
    const poolSize = getPoolSize();
    let captchaParam = "";

    // Notify the daemon that a request is active — wakes it from idle-suspend
    // BEFORE we try to consume tokens (not after). This ensures the pool is
    // replenished if it was stale after a long idle period.
    notifyDaemonRequest();

    // Helper: run Method A (server-side crypto with device tokens from pool)
    const runMethodA = async (label: string): Promise<string> => {
      if (getPoolSize() === 0) {
        dynLog?.warn?.(hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE", `${label}: pool empty, skipping`);
        return "";
      }
      try {
        const captchaPromise = getCaptchaVerifyParam(getNextToken, consumeToken, retries);
        // timeout=0 means no timeout (wait indefinitely, matches Go reference).
        let result: string;
        if (timeoutMs > 0) {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Captcha generation timeout after ${timeoutMs / 1000}s`)), timeoutMs)
          );
          result = await Promise.race([captchaPromise, timeoutPromise]);
        } else {
          result = await captchaPromise;
        }
        dynLog?.debug?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), `captcha via ${label} (pool: ${poolSize} → ${getPoolSize()})`);
        return result;
      } catch (err) {
        dynLog?.warn?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), `${label} failed: ${err instanceof Error ? err.message : String(err)}`);
        return "";
      }
    };

    // Helper: run Method B (get fresh device token via Playwright, then Method A)
    const runMethodB = async (): Promise<string> => {
      dynLog?.info?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), "Getting fresh device token via Playwright (Method B)...");
      try {
        const freshToken = await getFreshDeviceTokenViaBrowser();
        addDeviceTokens([freshToken]);
        dynLog?.debug?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), "Fresh token obtained, retrying server-side captcha...");
        return await runMethodA("Method B (fresh token)");
      } catch (freshErr) {
        dynLog?.warn?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), `Method B failed: ${freshErr instanceof Error ? freshErr.message : String(freshErr)}`);
        return "";
      }
    };

    // Helper: run Method C (full Playwright browser captcha)
    const runMethodC = async (): Promise<string> => {
      dynLog?.info?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), "Using browser captcha fallback (Method C)...");
      try {
        const result = await getCaptchaParamViaBrowser();
        dynLog?.debug?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), "captcha via Method C (browser)");
        return result;
      } catch (browserErr) {
        dynLog?.warn?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), `Method C failed: ${browserErr instanceof Error ? browserErr.message : String(browserErr)}`);
        return "";
      }
    };

    // Execute strategy
    dynLog?.info?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), `captcha strategy=${strategy} retries=${retries} timeout=${timeoutMs}ms pool=${poolSize}`);

    switch (strategy) {
      case "a_only":
        captchaParam = await runMethodA("Method A");
        break;
      case "b_only":
        captchaParam = await runMethodB();
        break;
      case "c_only":
        captchaParam = await runMethodC();
        break;
      case "a_then_c":
        captchaParam = await runMethodA("Method A");
        if (!captchaParam) captchaParam = await runMethodC();
        break;
      case "a_then_b":
        captchaParam = await runMethodA("Method A");
        if (!captchaParam) captchaParam = await runMethodB();
        break;
      case "auto":
      default:
        // A → B → C (original behavior)
        captchaParam = await runMethodA("Method A");
        if (!captchaParam) captchaParam = await runMethodB();
        if (!captchaParam) captchaParam = await runMethodC();
        break;
    }

    if (!captchaParam) {
      return makeErrorResult(
        502,
        `Captcha verification failed (strategy=${strategy}, all configured paths exhausted)`,
        body,
        CHAT_COMPLETIONS_URL
      );
    }

    // 4. Compute the X-Signature header
    const sig = generateZaSignature(prompt, session.token, session.userId);

    // 4b. Build tool registry (if tools are present in the request)
    const toolRegistry = buildZaiToolRegistry(bodyObj);

    // 4c. Resolve think mode (passthrough / strip / separate)
    const thinkMode = resolveThinkMode({
      headers: input.clientHeaders as Record<string, unknown> | undefined,
      body: bodyObj,
      providerSpecificData: credentials?.providerSpecificData as Record<string, unknown> | null,
    });

    // 4d. Multi-turn registry (qwen-web pattern): agentChatId → chatId.
    // Z.AI's web API accepts a client-generated UUID as chat_id. When the same
    // chat_id is reused across turns, Z.AI groups the messages and maintains
    // server-side conversation context.
    //
    // When agentChatId is present (agentic clients like Claude Code):
    //   - First turn: generate a new UUID, save to registry, send only the
    //     last user message (server-side context via chat_id).
    //   - Subsequent turns: reuse the UUID from registry, send only the last
    //     user message.
    // When agentChatId is absent (standard OpenAI client):
    //   - Generate a new UUID per request (no registry), send the FULL
    //     messages array (zai-web pattern — client-side context).
    const connectionId = (credentials as { connectionId?: string })?.connectionId || "default";
    const agentChatId = getAgentChatId(bodyObj, input.clientHeaders as Record<string, unknown> | undefined);

    // Registry provider key: use "zai-web-token" or "zai-web-free" (NOT "zai")
    // to avoid collision with the `zai` apikey provider which may add registry
    // support in the future.
    const registryProvider = hasUserToken ? "zai-web-token" : "zai-web-free";

    let chatId: string;
    if (agentChatId) {
      const existing = getMapping({ connectionId, agentChatId, provider: registryProvider });
      if (existing?.providerConversationId) {
        chatId = existing.providerConversationId;
        dynLog?.debug?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), `registry: agentChatId=${agentChatId.slice(0, 16)} -> chatId=${chatId.slice(0, 16)} (reused)`);
      } else {
        chatId = randomUUID();
        saveMapping({
          connectionId, agentChatId, provider: registryProvider,
          providerConversationId: chatId,
        });
        dynLog?.debug?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), `registry: agentChatId=${agentChatId.slice(0, 16)} -> chatId=${chatId.slice(0, 16)} (new)`);
      }
    } else {
      // No agentChatId — generate a fresh UUID per request (stateless).
      chatId = randomUUID();
    }

    // 5. Build the request body
    // When agentChatId is present, send only the last user message (server-side
    // context via chat_id). When absent, send the full messages array
    // (client-side context — zai-web pattern).
    const messagesToSend = agentChatId ? messages.slice(-1) : messages;
    const requestBody: Record<string, unknown> = {
      model: requestedModel,
      chat_id: chatId,
      messages: messagesToSend,
      signature_prompt: prompt,
      stream: true, // Z.AI always streams
      captcha_verify_param: captchaParam,
      features,
    };

    // Add tools if present in the request
    if (toolRegistry.enabled && Array.isArray((bodyObj as Record<string, unknown>).tools)) {
      requestBody.tools = (bodyObj as Record<string, unknown>).tools;
    }
    if (bodyObj.tool_choice) {
      requestBody.tool_choice = bodyObj.tool_choice;
    }

    const requestUrl = `${CHAT_COMPLETIONS_URL}?${sig.urlParams}`;
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "x-fe-Version": session.feVersion,
      "x-region": "overseas",
      "x-signature": sig.signature,
    };

    // 6. Send the request (with one 401 retry that re-inits the session)
    let upstream: Response;
    const bodyStr = JSON.stringify(requestBody);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        upstream = await fetch(requestUrl, {
          method: "POST",
          headers: reqHeaders,
          body: bodyStr,
          signal,
        });
      } catch (err) {
        return makeErrorResult(
          502,
          `Z.AI fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          body,
          requestUrl
        );
      }

      if (upstream.status === 401 && attempt === 0) {
        // Session expired — re-init and retry once
        dynLog?.info?.((hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"), "401 from Z.AI, re-initializing session");
        resetSession();
        try {
          const newSession = await getSession();
          reqHeaders.Authorization = `Bearer ${newSession.token}`;
          reqHeaders["x-fe-Version"] = newSession.feVersion;
        } catch (err) {
          return makeErrorResult(
            502,
            `Z.AI session re-init failed: ${err instanceof Error ? err.message : String(err)}`,
            body,
            requestUrl
          );
        }
        continue;
      }
      break;
    }

    if (!upstream!.ok) {
      const errText = await upstream!.text().catch(() => "");
      return makeErrorResult(
        upstream!.status,
        `Z.AI error: ${sanitizeErrorMessage(errText)}`,
        body,
        requestUrl
      );
    }

    // 7. Stream or collect the response
    const id = `chatcmpl-zaifree-${Date.now().toString(36)}`;
    const created = Math.floor(Date.now() / 1000);
    const fingerprint = `zai-${requestedModel}`;
    const sourceStream = upstream!.body ?? new ReadableStream({ start: (c) => c.close() });

    if (wantStream) {
      const outStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const emit = (delta: Record<string, unknown>, finish: string | null = null) => {
            const chunk = {
              id,
              object: "chat.completion.chunk",
              created,
              model: requestedModel,
              system_fingerprint: fingerprint,
              choices: [{ index: 0, delta, finish_reason: finish }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          };

          // Initial role chunk
          emit({ role: "assistant", content: "" });

          let fullContent = "";
          let sentContent = "";
          let buffer = "";
          const reader = sourceStream.getReader();
          const decoder = new TextDecoder();
          const toolAccumulator = new ToolCallAccumulator();

          // Keep-alive ticker ?�� Z.AI streams can have long pauses; send a
          // heartbeat every 5s so the client doesn't time out.
          let lastKeepAlive = Date.now();
          const KEEPALIVE_INTERVAL_MS = 5000;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!value) continue;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data: ")) continue;
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") {
                  emit({}, "stop");
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }
                let j: ZaiSSEChunk;
                try {
                  j = JSON.parse(dataStr);
                } catch {
                  continue;
                }

                // Detect inline errors
                const errDetail = extractZaiError(j);
                if (errDetail) {
                  const status = zaiErrorToStatus(errDetail);
                  // For retryable errors (503), emit an OpenAI-shaped error
                  // event so chatCore's stream-error detection can trigger
                  // retry/fallback. For non-retryable errors, emit as content
                  // so the user sees the message.
                  if (status === 503) {
                    // Emit error as a proper SSE error chunk — chatCore detects
                    // this and triggers retry with the mapped status code.
                    const errorChunk = {
                      id,
                      object: "chat.completion.chunk",
                      created,
                      model: requestedModel,
                      system_fingerprint: fingerprint,
                      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                      error: {
                        message: `Z.AI inline error: ${errDetail}`,
                        type: "api_error",
                        code: status,
                      },
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                    return;
                  }
                  // Non-retryable: show the error as content to the user
                  emit({ content: `\n\n[error: ${errDetail}]` }, "stop");
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }

                // Detect phase "done"
                if (j.data?.phase === "done") {
                  // Check for completed tool calls before finishing
                  if (toolAccumulator.hasPending()) {
                    const completedCalls = toolAccumulator.getCompleted();
                    if (completedCalls.length > 0) {
                      enqueueStreamingToolCalls(controller, encoder, {
                        id,
                        created,
                        model: requestedModel,
                        fingerprint,
                        toolCalls: completedCalls,
                      });
                      controller.close();
                      return;
                    }
                  }
                  emit({}, "stop");
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }

                // Check for tool_calls in the SSE chunk (OpenAI format)
                const toolCallDeltas = parseZaiToolCallDelta(j as Record<string, unknown>);
                if (toolCallDeltas) {
                  toolAccumulator.feed(toolCallDeltas);
                  // Emit tool call deltas directly
                  for (const d of toolCallDeltas) {
                    const toolChunk = {
                      id,
                      object: "chat.completion.chunk",
                      created,
                      model: requestedModel,
                      system_fingerprint: fingerprint,
                      choices: [
                        {
                          index: 0,
                          delta: { tool_calls: [d] },
                          finish_reason: null,
                        },
                      ],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
                  }
                  continue;
                }

                // Extract content delta
                let chunk = "";
                if (j.data?.edit_content) chunk = j.data.edit_content;
                else if (j.data?.delta_content) chunk = j.data.delta_content;
                else if (j.data?.content) chunk = j.data.content;
                else if (j.choices?.[0]?.delta?.content) chunk = j.choices[0].delta.content;

                if (chunk) {
                  if (j.data?.phase === "thinking") {
                    // Reasoning content — apply thinkMode (strip = skip, separate = reasoning_content, passthrough = content)
                    if (thinkMode !== "strip") {
                      emit({ reasoning_content: chunk });
                    }
                  } else {
                    fullContent += chunk;
                    if (fullContent.length > sentContent.length) {
                      const delta = fullContent.slice(sentContent.length);
                      sentContent = fullContent;
                      emit({ content: delta });
                    }
                  }
                }
              }

              // Keep-alive: emit an empty delta if no content for 5s
              if (Date.now() - lastKeepAlive > KEEPALIVE_INTERVAL_MS) {
                emit({ content: "" });
                lastKeepAlive = Date.now();
              }
            }

            // Stream ended without [DONE] or phase "done" ?�� flush a stop
            emit({}, "stop");
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            if (!signal?.aborted) {
              try {
                controller.error(err);
              } catch {
                /* controller already closed */
              }
            }
          }
        },
      });

      return {
        response: new Response(outStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
        url: requestUrl,
        headers: reqHeaders,
        transformedBody: requestBody,
      };
    }

    // Non-streaming: collect all deltas into a single chat.completion JSON
    let fullContent = "";
    let reasoningContent = "";
    let buffer = "";
    const reader = sourceStream.getReader();
    const decoder = new TextDecoder();
    const nonStreamToolAccumulator = new ToolCallAccumulator();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") {
            buffer = "";
            break;
          }
          let j: ZaiSSEChunk;
          try {
            j = JSON.parse(dataStr);
          } catch {
            continue;
          }

          const errDetail = extractZaiError(j);
          if (errDetail) {
            return makeErrorResult(
              zaiErrorToStatus(errDetail),
              `Z.AI inline error: ${errDetail}`,
              body,
              requestUrl
            );
          }

          if (j.data?.phase === "done") {
            buffer = "";
            break;
          }

          // Check for tool calls
          const toolCallDeltas = parseZaiToolCallDelta(j as Record<string, unknown>);
          if (toolCallDeltas) {
            nonStreamToolAccumulator.feed(toolCallDeltas);
            continue;
          }

          let chunk = "";
          if (j.data?.edit_content) chunk = j.data.edit_content;
          else if (j.data?.delta_content) chunk = j.data.delta_content;
          else if (j.data?.content) chunk = j.data.content;
          else if (j.choices?.[0]?.delta?.content) chunk = j.choices[0].delta.content;

          if (chunk) {
            if (j.data?.phase === "thinking") {
              reasoningContent += chunk;
            } else {
              fullContent += chunk;
            }
          }
        }
        if (buffer === "") break;
      }
    } catch {
      /* best-effort ?�� return what we have */
    }

    // Check for completed tool calls
    const completedToolCalls = nonStreamToolAccumulator.getCompleted();
    if (completedToolCalls.length > 0) {
      const toolCompletion = {
        id,
        object: "chat.completion",
        created,
        model: requestedModel,
        system_fingerprint: fingerprint,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: null, tool_calls: completedToolCalls },
            finish_reason: "tool_calls",
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
      return {
        response: new Response(JSON.stringify(toolCompletion), {
          headers: { "Content-Type": "application/json" },
        }),
        url: requestUrl,
        headers: reqHeaders,
        transformedBody: requestBody,
      };
    }

    // Apply think mode to non-streaming response
    const { content: contentAfterThink, reasoning: reasoningAfterThink } = applyThinkMode(
      fullContent + (reasoningContent ? `<think>${reasoningContent}</think>` : ""),
      thinkMode
    );

    const message: Record<string, unknown> = { role: "assistant", content: contentAfterThink };
    if (reasoningAfterThink) message.reasoning_content = reasoningAfterThink;
    const completion = {
      id,
      object: "chat.completion",
      created,
      model: requestedModel,
      system_fingerprint: fingerprint,
      choices: [{ index: 0, message, finish_reason: "stop" }],
    };

    dynLog?.debug?.(
      (hasUserToken ? "ZAI-WEB-TOKEN" : "ZAI-WEB-FREE"),
      `completed model=${requestedModel} contentLen=${fullContent.length}`
    );

    return {
      response: new Response(JSON.stringify(completion), {
        headers: { "Content-Type": "application/json" },
      }),
      url: requestUrl,
      headers: reqHeaders,
      transformedBody: requestBody,
    };
  }
}

export default ZaiWebFreeExecutor;
