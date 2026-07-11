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
import { makeExecutorErrorResult as makeErrorResult, sanitizeErrorMessage } from "../utils/error.ts";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.ts";

import { getSession, resetSession, setHardcodedToken, type ZaiSession } from "./zai-web-free/session.ts";
import { generateZaSignature } from "./zai-web-free/signature.ts";
import { getCaptchaVerifyParam } from "./zai-web-free/captcha.ts";
import {
  getNextToken,
  consumeToken,
  getPoolSize,
  initDeviceTokenPool,
  addDeviceTokens,
} from "./zai-web-free/device-token-pool.ts";
import { getFreshDeviceTokenViaBrowser, getCaptchaParamViaBrowser } from "./zai-web-free/browser-captcha.ts";

const log = logger("ZAI-WEB-FREE");

const CHAT_COMPLETIONS_URL = "https://chat.z.ai/api/v2/chat/completions";

// Fallback model list (used when Z.AI's /api/models is unreachable)
const FALLBACK_MODELS = [
  "glm-5.2",
  "GLM-5.1",
  "GLM-5-Turbo",
  "GLM-5v-Turbo",
  "glm-4.7",
];

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
    delta_content?: string;
    content?: string;
    error?: { detail?: string; message?: string; code?: unknown };
  };
  choices?: Array<{
    delta?: { content?: string };
  }>;
  error?: { detail?: string; message?: string; code?: unknown };
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
    const role =
      m.role === "system" ? "System" : m.role === "assistant" ? "Assistant" : "User";
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
 */
function extractZaiError(j: ZaiSSEChunk): string {
  // data.error
  if (j.data?.error) {
    const err = j.data.error;
    const detail = err.detail || err.message || "";
    if (detail) {
      return err.code !== undefined ? `${detail} (code: ${err.code})` : detail;
    }
  }
  // Top-level error
  if (j.error) {
    const err = j.error;
    return err.detail || err.message || "";
  }
  return "";
}

/**
 * Resolve the feature map for a model. Z.AI's web endpoint accepts a
 * `features` object that toggles web_search, thinking, etc.
 *
 * Per-request overrides (from the OpenAI body's `web_search` /
 * `reasoning_effort` fields) take precedence over the model's defaults.
 */
function resolveFeatures(
  bodyObj: Record<string, unknown>
): Record<string, unknown> {
  const features: Record<string, unknown> = {
    image_generation: false,
    web_search: false,
    auto_web_search: false,
    preview_mode: true,
    flags: [],
    vlm_tools_enable: false,
    vlm_web_search_enable: false,
    vlm_website_mode: false,
    enable_thinking: false,
    reasoning_effort: "default",
  };

  // Per-request overrides
  if (bodyObj.web_search === true || bodyObj.webSearch === true) {
    features.web_search = true;
    features.auto_web_search = true;
  }
  if (bodyObj.reasoning_effort && bodyObj.reasoning_effort !== "none") {
    features.enable_thinking = true;
    const effort = bodyObj.reasoning_effort as string;
    if (effort === "max" || effort === "high") features.reasoning_effort = "max";
    else if (effort === "medium") features.reasoning_effort = "medium";
    else features.reasoning_effort = "low";
  }
  if (bodyObj.deepThink === true) {
    features.enable_thinking = true;
    features.reasoning_effort = "max";
  }

  return features;
}

// ?��?�� Executor ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��

export class ZaiWebFreeExecutor extends BaseExecutor {
  private static initialized = false;

  constructor() {
    super("zai-web-free", { id: "zai-web-free", baseUrl: "https://chat.z.ai" });
    // Lazy-init the device-token pool from the OmniRoute data directory.
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

    // 1. Resolve the Z.AI session (guest JWT or user-supplied token)
    // The token can come from:
    //   - providerSpecificData.token (structured form), OR
    //   - credentials.apiKey (the standard web-session token field ?��
    //     `resolveWebSessionImportApiKey` stores token-kind credentials there)
    const psd = credentials?.providerSpecificData as { token?: string } | undefined;
    const hardcodedToken = psd?.token || (credentials?.apiKey ? String(credentials.apiKey).trim() : "");
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
      return makeErrorResult(400, "messages is required and must be a non-empty array", body, CHAT_COMPLETIONS_URL);
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
    const poolSize = getPoolSize();
    let captchaParam: string;

    // ?��?�� Method A: Fast server-side captcha (device token from pool) ?��?��
    if (poolSize > 0) {
      try {
        const captchaPromise = getCaptchaVerifyParam(getNextToken, consumeToken);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Captcha generation timeout after 90s")), 90_000)
        );
        captchaParam = await Promise.race([captchaPromise, timeoutPromise]);
        log?.debug?.("ZAI-WEB-FREE", `captcha via fast path A (pool: ${poolSize} ?�� ${getPoolSize()})`);
      } catch (fastErr) {
        log?.warn?.("ZAI-WEB-FREE", `Fast path A failed: ${fastErr instanceof Error ? fastErr.message : String(fastErr)}`);
        captchaParam = "";
      }
    } else {
      captchaParam = "";
    }

    // ?��?�� Method B: Get a fresh device token via Playwright, then retry fast path ?��?��
    if (!captchaParam) {
      log?.info?.("ZAI-WEB-FREE", "Getting fresh device token via Playwright (fast path B)...");
      try {
        const freshToken = await getFreshDeviceTokenViaBrowser();
        // Add the fresh token to the pool so it can be consumed
        addDeviceTokens([freshToken]);
        log?.debug?.("ZAI-WEB-FREE", "Fresh token obtained, retrying server-side captcha...");

        const captchaPromise = getCaptchaVerifyParam(getNextToken, consumeToken);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Captcha generation timeout after 90s")), 90_000)
        );
        captchaParam = await Promise.race([captchaPromise, timeoutPromise]);
        log?.debug?.("ZAI-WEB-FREE", "captcha via fast path B (fresh token)");
      } catch (freshErr) {
        log?.warn?.("ZAI-WEB-FREE", `Fast path B failed: ${freshErr instanceof Error ? freshErr.message : String(freshErr)}`);
      }
    }

    // ?��?�� Method C: Browser fallback (full Playwright captcha) ?��?��
    if (!captchaParam) {
      log?.info?.("ZAI-WEB-FREE", "Using browser captcha fallback (Playwright full flow)...");
      try {
        captchaParam = await getCaptchaParamViaBrowser();
        log?.debug?.("ZAI-WEB-FREE", "captcha via browser fallback C");
      } catch (browserErr) {
        return makeErrorResult(
          502,
          `Captcha verification failed (all paths A/B/C exhausted): ${browserErr instanceof Error ? browserErr.message : String(browserErr)}`,
          body,
          CHAT_COMPLETIONS_URL
        );
      }
    }

    // 4. Compute the X-Signature header
    const sig = generateZaSignature(prompt, session.token, session.userId);

    // 5. Build the request body
    //    Confirmed from browser capture: Z.AI requires chat_id (UUID),
    //    and accepts optional fields like id, variables, background_tasks.
    //    The signature_prompt must match the prompt used for x-signature.
    const chatId = randomUUID();
    const msgId = randomUUID();
    const now = new Date();
    const dateTimeStr = now.toISOString().replace("T", " ").slice(0, 19);
    const dateStr = dateTimeStr.slice(0, 10);
    const timeStr = dateTimeStr.slice(11);
    const weekday = now.toLocaleDateString("en-US", { weekday: "long" });

    const requestBody: Record<string, unknown> = {
      stream: true,
      model: requestedModel,
      messages,
      signature_prompt: prompt,
      params: {},
      extra: {},
      features,
      variables: {
        "{{USER_NAME}}": session.userName || "User",
        "{{USER_LOCATION}}": "Unknown",
        "{{CURRENT_DATETIME}}": dateTimeStr,
        "{{CURRENT_DATE}}": dateStr,
        "{{CURRENT_TIME}}": timeStr,
        "{{CURRENT_WEEKDAY}}": weekday,
        "{{CURRENT_TIMEZONE}}": "Asia/Tehran",
        "{{USER_LANGUAGE}}": "en-US",
      },
      chat_id: chatId,
      id: msgId,
      current_user_message_id: msgId,
      current_user_message_parent_id: null,
      background_tasks: { title_generation: true, tags_generation: true },
      captcha_verify_param: captchaParam,
    };

    // URL params — Z.AI requires extensive browser fingerprint params
    const urlParams = new URLSearchParams({
      timestamp: sig.timestamp,
      requestId: sig.requestId,
      user_id: session.userId,
      version: "0.0.1",
      platform: "web",
      token: session.token,
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      language: "en-US",
      languages: "en-US,en",
      timezone: "Asia/Tehran",
      cookie_enabled: "true",
      screen_width: "1536",
      screen_height: "864",
      screen_resolution: "1536x864",
      viewport_height: "695",
      viewport_width: "934",
      viewport_size: "934x695",
      color_depth: "24",
      pixel_ratio: "1.25",
      current_url: `https://chat.z.ai/c/${chatId}`,
      pathname: `/c/${chatId}`,
      search: "",
      hash: "",
      host: "chat.z.ai",
      hostname: "chat.z.ai",
      protocol: "https:",
      referrer: "",
      title: "Z.ai - Advanced AI Chatbot & Agent powered by GLM-5.2",
      timezone_offset: "-210",
      local_time: now.toISOString(),
      utc_time: now.toUTCString(),
      is_mobile: "false",
      is_touch: "false",
      max_touch_points: "0",
      browser_name: "Chrome",
      os_name: "Windows",
      signature_timestamp: sig.timestamp,
    }).toString();

    const requestUrl = `${CHAT_COMPLETIONS_URL}?${urlParams}`;
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
      "x-fe-Version": session.feVersion,
      "x-region": "overseas",
      "x-signature": sig.signature,
      Origin: "https://chat.z.ai",
      Referer: `https://chat.z.ai/c/${chatId}`,
    };

    // 6. Send the request (with one 401 retry that re-inits the session)
    let upstream: Response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        upstream = await fetch(requestUrl, {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify(requestBody),
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
        // Session expired ?�� re-init and retry once
        log?.info?.("ZAI-WEB-FREE", "401 from Z.AI, re-initializing guest session");
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
                  emit({ content: `\n\n[error: ${errDetail}]` }, "stop");
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }

                // Detect phase "done"
                if (j.data?.phase === "done") {
                  emit({}, "stop");
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }

                // Extract content delta — phase "thinking" is reasoning content
                let chunk = "";
                const phase = j.data?.phase;
                if (j.data?.edit_content) chunk = j.data.edit_content;
                else if (j.data?.delta_content) chunk = j.data.delta_content;
                else if (j.data?.content) chunk = j.data.content;
                else if (j.choices?.[0]?.delta?.content) chunk = j.choices[0].delta.content;

                if (chunk) {
                  if (phase === "thinking") {
                    // Reasoning content — emit as reasoning_content
                    emit({ reasoning_content: chunk });
                  } else {
                    // Normal content
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
            return makeErrorResult(502, `Z.AI inline error: ${errDetail}`, body, requestUrl);
          }

          if (j.data?.phase === "done") {
            buffer = "";
            break;
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

    const message: Record<string, unknown> = { role: "assistant", content: fullContent };
    if (reasoningContent) message.reasoning_content = reasoningContent;
    const completion = {
      id,
      object: "chat.completion",
      created,
      model: requestedModel,
      choices: [{ index: 0, message, finish_reason: "stop" }],
    };

    log?.debug?.("ZAI-WEB-FREE", `completed model=${requestedModel} contentLen=${fullContent.length}`);

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
