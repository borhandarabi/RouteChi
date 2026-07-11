/**
 * QwenWebExecutor — Alibaba Tongyi Qwen Chat via chat.qwen.ai (v2 API)
 *
 * Routes requests through Qwen's consumer chat API. The legacy v1 endpoint
 * (`/api/chat/completions`) was retired upstream in 2026 and now answers 504
 * HTML from Alibaba's gateway for every request, regardless of credentials
 * (#3288 / discussion #2768). The current contract is a two-step v2 flow:
 *
 *   1. POST /api/v2/chats/new                  → create a chat, returns chat_id
 *   2. POST /api/v2/chat/completions?chat_id=  → phase-based SSE stream
 *   3. DELETE /api/v2/chats/{chat_id}          → cleanup (unless persistSession)
 *
 * Multi-turn: chat_id is server-generated. We capture it from the /chats/new
 * response and save to providerSessionRegistry keyed by agentChatId. Subsequent
 * turns reuse the same chat_id (skip /chats/new) to continue the conversation.
 *
 * The v2 endpoints sit behind Alibaba's "baxia" WAF, which requires the full
 * browser cookie jar from a real logged-in session (cna, ssxmod_itna,
 * ssxmod_itna2, token, ...). We therefore replay the captured/pasted Cookie
 * header verbatim plus the bearer token.
 *
 * SSE chunks carry `choices[0].delta` with a `phase` field: `think` /
 * `thinking_summary` map to reasoning, `answer` (or a null phase) carries the
 * assistant content. Think mode processing via thinkModeProcessor supports
 * passthrough/strip/separate modes.
 *
 * Session persistence (aligned with deepseek-web #2942):
 *   - persistSession=false (default): delete chat after response
 *   - persistSession=true: keep chat on platform for reuse
 *
 * Error handling: Qwen returns errors as HTTP status codes (not in-stream
 * like Kimi), so BaseExecutor's 429 retry handles most cases. We also detect
 * WAF responses (HTML/504) and surface a clear re-login message.
 *
 * Reference implementations: gpt4free `g4f/Provider/Qwen.py`,
 * Chat2API `proxy/adapters/qwen-ai.ts`.
 *
 * Auth: full Cookie header from chat.qwen.ai + bearer token (localStorage
 *       `token`, also mirrored to a `token` cookie).
 * Format: OpenAI-compatible (translated from Qwen's phase protocol).
 */
import { BaseExecutor, type ExecuteInput, type ProviderCredentials } from "./base.ts";
import {
  makeExecutorErrorResult as makeErrorResult,
  sanitizeErrorMessage,
} from "../utils/error.ts";
import { prepareToolMessages, buildToolAwareResult } from "../translator/webTools.ts";
import { buildQwenCookieHeader, extractQwenToken } from "@/lib/providers/webCookieAuth";
import { getAgentChatId } from "../utils/agentChatIdExtractor.ts";
import { getMapping, saveMapping } from "../services/providerSessionRegistry.ts";
import {
  applyThinkMode,
  createThinkStreamContext,
  processThinkStreamDelta,
  flushThinkStream,
} from "../utils/thinkModeProcessor.ts";
import { resolveThinkMode } from "../services/thinkOutputMode.ts";

const BASE_URL = "https://chat.qwen.ai";
const CHATS_NEW_URL = `${BASE_URL}/api/v2/chats/new`;
const CHAT_COMPLETIONS_URL = `${BASE_URL}/api/v2/chat/completions`;
const DELETE_CHAT_URL = (chatId: string) => `${BASE_URL}/api/v2/chats/${chatId}`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

// Anti-bot headers the v2 endpoint expects. `bx-umidtoken` is normally minted
// per-session from sg-wum.alibaba.com; a captured value travels with the cookie
// jar, but we also send a static fallback so the header is always present.
//
// The `bx-ua` header is a long signed anti-bot blob that Alibaba's baxia WAF
// validates. Without it, requests from datacenter IPs get HTML challenge pages
// instead of JSON responses. The value below is captured from a live browser
// session (same approach as Chat2API-web's qwen-ai adapter) — when baxia
// tightens, this may need to be re-captured, but it has been stable for months.
const BX_VERSION = "2.5.36";
const BX_UMIDTOKEN_FALLBACK =
  "T2gAr9z8byN8sNOmfQ3X9j61MNTNmSqDO5L1rs2jMcQCVhOKgZICcBN-UdTuJGig-NM=";
// Long-form signed bx-ua blob captured from a live chat.qwen.ai session.
// Source: Chat2API-web reference implementation (zhaiiker/Chat2API-web).
// This is a static capture, not a per-session signature — when baxia rotates
// its signing key, this will need to be re-captured from a fresh browser session.
const BX_UA_BLOB =
  "231!lWD36kmUe5E+joKDK5gBZ48FEl2ZWfPwIPF92lBLek2KxVW/XJ2EwruCiDOX5Px4EXNhmh6EfS9eDwQGRwijIK64A4nPqeLysJcDjUACje/H3J4ZgGZpicG6K8AkiGGaEKC830+QSiSUsLRlL/EyhXTmLcJc/5iDkMuOpUhNz0e0Q/nTqjVJ3ko00Q/oyE+jauHhUHfb1GxGHkE+++3+qCS4+ItkaA6tiItCo+romzElfLFD6RIj7oHt9vffs98nLwpHnaqKjufnLFMejSlAUGiQvTofIiGhIvftAMcoFV4mrUHsqyQ/ncQihmJHkbxXjvM57FCb6b9dEIRZl7jgj0+QLNLRs0NZ4azdZ6rzbGTSO8KA5I3Aq/3gBr87X16Mj0oJtaPKmFGaP2zghfOVhxQht8YjRd50lJa+Ue4PAuPSdu2O69DKLH8VOhrsB+psaBIRxnRi5POUQ6w8s8qlb9vxvExjHNOAKWXV1by1Nz+6FPWdyTeAgcmonjCcV0dCtPj/KyeVDkeSrDkKZjnDzHEqeCdfmJ65kve+Vy3YS0vagzyHfVEnzN0ULUZtkGfJXFNm6+bIa55wmGBhUeXbHL0EdlQXMu1YXxmcwBgTaq7tlQcfv7AefanbfjGE8R1IFnNyg2/jXLbnLg5Z6l1oKqgnxZQg0DE9BJuw6s0XjGwTdSxybWxp+WFD/RsXt76uwvCBk7z+YmSFLtFj2UlTsoq+vl0DTmsVItDKf9SZ94NcuJ7mxJYI02S/2kQBfbbHG0d4hXevDrEC0cb86EvzN2ud+v6bAunNRGNFz/RH0KLusoBVeo+puCFKeeIJWEo0t1UicX5YxJwMAoV7+g0gK93y4W9sMQtso8/wY5wsBzis9dwfLvIwXpaAM1g0MZp/YIRq8T/Qc+U/8x99tam4er0IWizvrkjqhIzCWBKpJ4Y4gj3bOmiS3VCMEaoVfKCwUWENwYKuP3H5VI0n+O2vVVRrekUrwvkm6URRhVhN4eEFTCjB9nSQu++qKyDH8HPpkS3YfwF8/OQtrZo7hQXxvNmP2HcH/K7zcweD00BaoOLiYUtXRItGYbl06sVSbm04soRf1Jqpyo3XiRqBWD9rmJfr4w8NOEGVGUCKXLDLsXy+8JC4Iqf0FsIjWxjMVdraTUtCbwXRbYUownQVm6bt7LYD1SNPoWNPqUJgsLMwP33ugrb1UbHCs24roOch6Go5QHIPA8E15SZE9pkr1SkmqrNs/+KRomFJ9HyFnWUYhZIV9MRLqlOAt6XBBTash3WJnCjhx/PZGhXVvdn2jX4+0Pm55LsiNugA8vaAUJQBxD/8a1u/RvTgbj35+b7I7m8tG0hMhClNZF+tpsOmZZhUGuXH9uVbkJMlMuAmMVCHwn3O31GlLeXXzzep2WS3xN2U+p5J0I7GySnuZUkuGs1ZTVqGUvR2g4q+7ljU55Ak78yPZiQXeUeqS74azszvZvCqWxXn2eePj+gcpliOjrYKpglUP19rQrMt8PqLt8L0ghIqVCmMwl3gr/VUcqDpXdpPTR=";

// Qwen SPA version — required by the v2 chat completion endpoint. Without this
// header the upstream returns HTTP 200 with `{"success":false,"data":{"code":"Bad_Request"}}`
// for every completion request, even with a valid session. The version string is
// the SPA build identifier shipped in the React client's `version` request header.
// Pinned from a live capture (2026-07); bump if Qwen ships a breaking change.
const QWEN_SPA_VERSION = "0.2.66";

const MODEL_ALIASES: Record<string, string> = {
  // Legacy OmniRoute ids → current upstream catalog (GET /api/models).
  "qwen-plus": "qwen3.7-plus",
  "qwen-max": "qwen3.7-max",
  "qwen-turbo": "qwen3.6-plus",
  "qwen3-plus": "qwen3.7-plus",
  "qwen3-max": "qwen3.7-max",
  "qwen3-flash": "qwen3.6-plus",
  // Note: `qwen3-coder-plus` is a real upstream model id (Qwen3-Coder) and
  // must NOT be aliased — the previous `"qwen3-coder-plus": "qwen3.7-max"`
  // entry silently rewrote valid coder requests to the wrong model.
  "qwen3-coder-flash": "qwen3.6-plus",
  qwen: "qwen3.7-max",
  qwen3: "qwen3.7-max",
};

const DEFAULT_MODEL = "qwen3.7-max";

function mapModel(modelId: string): string {
  return MODEL_ALIASES[modelId] || modelId;
}

function uuid(): string {
  return crypto.randomUUID();
}

/** Detect Alibaba's WAF / retired-v1 gateway page so we never surface raw HTML. */
function isWafResponse(status: number, contentType: string, bodyText: string): boolean {
  if (contentType.includes("text/html")) return true;
  if (status === 504) return true;
  return /aliyun_waf|baxia|<html/i.test(bodyText);
}

const WAF_ERROR_MESSAGE =
  "Qwen session expired or blocked by Alibaba's WAF. Re-login at https://chat.qwen.ai and " +
  "paste a fresh full Cookie header (must include cna, ssxmod_itna and token) — a bearer token " +
  "alone is no longer accepted by the v2 endpoint.";

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string }> | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
}

// ── Chat deletion ──────────────────────────────────────────────────────────

async function deleteQwenChat(
  token: string,
  cookieHeader: string,
  chatId: string,
  customHeaders?: Record<string, string>
): Promise<boolean> {
  if (!chatId) return false;
  try {
    const headers: Record<string, string> = {
      Accept: "*/*",
      "User-Agent": USER_AGENT,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      source: "web",
      version: QWEN_SPA_VERSION,
      "bx-v": BX_VERSION,
      "bx-umidtoken": BX_UMIDTOKEN_FALLBACK,
      "bx-ua": BX_UA_BLOB,
      ...(customHeaders || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const resp = await fetch(DELETE_CHAT_URL(chatId), {
      method: "DELETE",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── Executor ───────────────────────────────────────────────────────────────

export class QwenWebExecutor extends BaseExecutor {
  constructor() {
    super("qwen-web", { id: "qwen-web", baseUrl: BASE_URL });
  }

  private buildHeaders(
    token: string,
    cookieHeader: string,
    chatId?: string,
    customHeaders?: Record<string, string>
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "*/*",
      "User-Agent": USER_AGENT,
      Origin: BASE_URL,
      Referer: chatId ? `${BASE_URL}/c/${chatId}` : `${BASE_URL}/`,
      source: "web",
      version: QWEN_SPA_VERSION,
      "x-request-id": uuid(),
      "bx-v": BX_VERSION,
      "bx-umidtoken": BX_UMIDTOKEN_FALLBACK,
      // Long-form signed bx-ua blob — required by Alibaba's baxia WAF to avoid
      // HTML challenge pages on datacenter IPs. Captured from a live browser
      // session; see comment near BX_UA_BLOB definition for refresh notes.
      "bx-ua": BX_UA_BLOB,
      ...(customHeaders || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    return headers;
  }

  /**
   * Create a new chat via /api/v2/chats/new. Returns the chat_id.
   * Returns null on failure (WAF, auth, network).
   */
  private async createChat(
    token: string,
    cookieHeader: string,
    modelId: string,
    signal: AbortSignal,
    customHeaders?: Record<string, string>
  ): Promise<{ chatId: string; error?: { status: number; message: string } }> {
    try {
      const newChatRes = await fetch(CHATS_NEW_URL, {
        method: "POST",
        headers: this.buildHeaders(token, cookieHeader, undefined, customHeaders),
        body: JSON.stringify({
          title: "New Chat",
          models: [modelId],
          chat_mode: "normal",
          chat_type: "t2t",
          timestamp: Date.now(),
        }),
        signal,
      });

      const ct = newChatRes.headers.get("content-type") || "";
      if (!newChatRes.ok || ct.includes("text/html")) {
        const text = await newChatRes.text().catch(() => "");
        if (isWafResponse(newChatRes.status, ct, text)) {
          return { chatId: "", error: { status: 401, message: WAF_ERROR_MESSAGE } };
        }
        return {
          chatId: "",
          error: {
            status: newChatRes.status || 502,
            message: `Qwen create-chat failed: ${sanitizeErrorMessage(text).slice(0, 300)}`,
          },
        };
      }

      const data = (await newChatRes.json()) as { data?: { id?: string } };
      const chatId = data?.data?.id ?? "";
      if (!chatId) {
        return {
          chatId: "",
          error: { status: 502, message: "Qwen create-chat returned no chat id" },
        };
      }
      return { chatId };
    } catch (err) {
      return {
        chatId: "",
        error: {
          status: 502,
          message: `Qwen create-chat error: ${err instanceof Error ? err.message : "unknown"}`,
        },
      };
    }
  }

  override async execute(input: ExecuteInput): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }> {
    const { body, credentials, signal, stream: wantStream, log } = input;
    const bodyObj = (body || {}) as Record<string, unknown>;

    const rawCred = String(credentials?.apiKey ?? "").trim();
    const cookieHeader = buildQwenCookieHeader(rawCred);
    let token = extractQwenToken(rawCred);
    if (!token && credentials?.accessToken) token = String(credentials.accessToken).trim();

    const customHeaders = (
      credentials?.providerSpecificData as { customHeaders?: Record<string, string> } | undefined
    )?.customHeaders;

    // 1. Resolve chat_id via providerSessionRegistry
    //    Qwen's chat_id is server-generated via /api/v2/chats/new. First turn
    //    creates a new chat, captures the id, saves to registry. Subsequent
    //    turns reuse the same chat_id (skip /chats/new).
    const connectionId = (credentials as { connectionId?: string })?.connectionId || "default";
    const agentChatId = getAgentChatId(bodyObj, input.clientHeaders as Record<string, unknown>);

    let existingChatId: string | null = null;
    if (agentChatId) {
      const existing = getMapping({ connectionId, agentChatId, provider: "qwen" });
      if (existing) {
        existingChatId = existing.providerConversationId;
        log?.debug?.(
          "QWEN-WEB",
          `registry: agentChatId=${agentChatId.slice(0, 16)} -> chatId=${existingChatId.slice(0, 16)} (reused)`
        );
      }
    }

    const messages = (bodyObj.messages as OpenAIMessage[]) || [];
    const requestedModel = (bodyObj.model as string) || DEFAULT_MODEL;
    const modelId = mapModel(requestedModel);

    const { hasTools, requestedTools, effectiveMessages } = prepareToolMessages(bodyObj, messages);

    // Qwen Web is single-turn: fold the conversation into one user prompt.
    const prompt = this.foldMessages(effectiveMessages as OpenAIMessage[]);

    // 2. Resolve think mode
    const thinkMode = resolveThinkMode({
      headers: input.clientHeaders as Record<string, unknown>,
      body: bodyObj,
      providerSpecificData: credentials?.providerSpecificData as Record<string, unknown> | null,
    });

    // 3. Create chat (only if no existing chat_id from registry)
    let chatId: string;
    if (existingChatId) {
      chatId = existingChatId;
    } else {
      const chatResult = await this.createChat(
        token,
        cookieHeader,
        modelId,
        signal!,
        customHeaders
      );
      if (chatResult.error) {
        return makeErrorResult(
          chatResult.error.status,
          chatResult.error.message,
          body,
          CHATS_NEW_URL
        );
      }
      chatId = chatResult.chatId;
      // Save to registry for multi-turn reuse
      if (agentChatId) {
        saveMapping({
          connectionId,
          agentChatId,
          provider: "qwen",
          providerConversationId: chatId,
        });
        log?.debug?.(
          "QWEN-WEB",
          `registry: saved agentChatId=${agentChatId.slice(0, 16)} -> chatId=${chatId.slice(0, 16)}`
        );
      }
    }

    // 4. Send the message
    const completionUrl = `${CHAT_COMPLETIONS_URL}?chat_id=${chatId}`;
    const msgPayload = this.buildMessagePayload(chatId, modelId, prompt, requestedModel, bodyObj);

    let upstream: Response;
    try {
      upstream = await fetch(completionUrl, {
        method: "POST",
        headers: this.buildHeaders(token, cookieHeader, chatId, customHeaders),
        body: JSON.stringify(msgPayload),
        signal,
      });
    } catch (err) {
      return makeErrorResult(
        502,
        `Qwen completion fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
        body,
        completionUrl
      );
    }

    const ct = upstream.headers.get("content-type") || "";
    if (!upstream.ok || ct.includes("text/html")) {
      const errText = await upstream.text().catch(() => "");
      if (isWafResponse(upstream.status, ct, errText)) {
        return makeErrorResult(401, WAF_ERROR_MESSAGE, body, completionUrl);
      }
      return makeErrorResult(
        upstream.status || 502,
        `Qwen error: ${sanitizeErrorMessage(errText).slice(0, 300)}`,
        body,
        completionUrl
      );
    }

    // 5. Session persistence (aligned with deepseek-web #2942)
    const persistSession =
      (credentials?.providerSpecificData as { persistSession?: boolean } | undefined)
        ?.persistSession === true;
    const shouldDeleteAfter = !persistSession;

    const doCleanup = async () => {
      try {
        if (shouldDeleteAfter && chatId) {
          await deleteQwenChat(token, cookieHeader, chatId, customHeaders);
        }
      } catch {
        /* best-effort */
      }
    };

    if (!wantStream) {
      // Non-streaming: collect full response, then apply think mode
      const { content, reasoning } = await this.collectStream(upstream);
      const { content: contentAfterThink, reasoning: reasoningAfterThink } = applyThinkMode(
        content + (reasoning ? `<think>${reasoning}</think>` : ""),
        thinkMode
      );

      // Parse tool calls
      let toolCalls: ReturnType<typeof buildToolAwareResult>["toolCalls"] = null;
      let finishReason = "stop";
      if (hasTools) {
        const result = buildToolAwareResult(contentAfterThink, requestedTools, "qwen");
        toolCalls = result.toolCalls;
        finishReason = result.finishReason;
      }

      const message: Record<string, unknown> = {
        role: "assistant",
        content: toolCalls ? null : contentAfterThink,
      };
      if (reasoningAfterThink) message.reasoning_content = reasoningAfterThink;
      if (toolCalls) message.tool_calls = toolCalls;

      const completion = {
        id: `chatcmpl-qwen-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{ index: 0, message, finish_reason: finishReason }],
      };

      await doCleanup().catch(() => {});
      log?.debug?.(
        "QWEN-WEB",
        `completed chatId=${chatId.slice(0, 16)} contentLen=${contentAfterThink.length}`
      );

      return {
        response: new Response(JSON.stringify(completion), {
          headers: { "Content-Type": "application/json" },
        }),
        url: completionUrl,
        headers: this.buildHeaders(token, cookieHeader, chatId, customHeaders),
        transformedBody: msgPayload,
      };
    }

    // Streaming: transform Qwen phase SSE → OpenAI chat.completion.chunk SSE
    // with think mode processing
    const stream = this.buildClientStream(
      upstream,
      modelId,
      hasTools,
      requestedTools,
      thinkMode,
      signal
    );
    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    // Schedule cleanup after stream ends (best-effort)
    stream.cancel = async () => {
      await doCleanup().catch(() => {});
    };

    return {
      response,
      url: completionUrl,
      headers: this.buildHeaders(token, cookieHeader, chatId, customHeaders),
      transformedBody: msgPayload,
    };
  }

  private foldMessages(messages: OpenAIMessage[]): string {
    let systemContent = "";
    let userContent = "";
    for (const m of messages) {
      const text =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((p) => p.text || "").join("\n")
            : String(m.content ?? "");
      if (m.role === "system") {
        systemContent += (systemContent ? "\n\n" : "") + text;
      } else if (m.role === "user") {
        userContent = text;
      } else if (m.role === "assistant") {
        if (m.tool_calls && m.tool_calls.length > 0) {
          const callsStr = m.tool_calls
            .map((tc) => `${tc.function.name}(${tc.function.arguments})`)
            .join("\n");
          userContent = userContent
            ? `${userContent}\n\nAssistant: [Tool Calls]\n${callsStr}`
            : `Assistant: [Tool Calls]\n${callsStr}`;
        } else {
          userContent = userContent ? `${userContent}\n\nAssistant: ${text}` : `Assistant: ${text}`;
        }
      } else if (m.role === "tool") {
        userContent = userContent
          ? `${userContent}\n\n[Tool Result] (${m.tool_call_id}):\n${text}`
          : `[Tool Result] (${m.tool_call_id}):\n${text}`;
      }
    }
    return systemContent ? `${systemContent}\n\nUser: ${userContent}` : userContent;
  }

  private buildMessagePayload(
    chatId: string,
    modelId: string,
    prompt: string,
    requestedModel: string,
    bodyObj: Record<string, unknown>
  ): Record<string, unknown> {
    const fid = uuid();
    // Thinking is controlled by:
    // 1. reasoning_effort field (from client) — if set and not "none", enable thinking
    // 2. enable_thinking field (from client) — explicit boolean
    // 3. Model name suffix -thinking (legacy convention)
    // 4. Default: disabled (Qwen's "fast mode")
    const reasoningEffort = bodyObj.reasoning_effort;
    const enableThinkingExplicit = bodyObj.enable_thinking;
    const enableThinking =
      enableThinkingExplicit === true ||
      (typeof reasoningEffort === "string" &&
        reasoningEffort !== "none" &&
        reasoningEffort !== "") ||
      /think|reason|r1/i.test(requestedModel);
    const featureConfig: Record<string, unknown> = {
      thinking_enabled: enableThinking,
      output_schema: "phase",
      auto_thinking: enableThinking,
      research_mode: "normal",
      auto_search: false,
    };
    // thinking_budget controls reasoning depth (Qwen supports 0-38 for qwen3 series)
    if (typeof bodyObj.thinking_budget === "number") {
      featureConfig.thinking_budget = bodyObj.thinking_budget;
    }
    return {
      stream: true,
      incremental_output: true,
      chat_id: chatId,
      chat_mode: "normal",
      model: modelId,
      messages: [
        {
          fid,
          parentId: null,
          childrenIds: [],
          role: "user",
          content: prompt,
          user_action: "chat",
          files: [],
          timestamp: Math.floor(Date.now() / 1000),
          models: [modelId],
          chat_type: "t2t",
          feature_config: featureConfig,
          sub_chat_type: "t2t",
        },
      ],
    };
  }

  /** Read the whole upstream SSE stream, returning the joined answer + reasoning. */
  private async collectStream(upstream: Response): Promise<{ content: string; reasoning: string }> {
    const reader = upstream.body?.getReader();
    const decoder = new TextDecoder();
    let content = "";
    let reasoning = "";
    if (!reader) return { content, reasoning };

    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const delta = parseSseDelta(line);
          if (!delta) continue;
          if (delta.kind === "answer") content += delta.text;
          else if (delta.kind === "think") reasoning += delta.text;
        }
      }
    } catch {
      /* upstream closed mid-stream — return what we have */
    }
    return { content, reasoning };
  }

  /** Transform the Qwen phase SSE into OpenAI chat.completion.chunk SSE
   *  with think mode processing (passthrough/strip/separate). */
  private buildClientStream(
    upstream: Response,
    modelId: string,
    hasTools: boolean,
    requestedTools: unknown,
    thinkMode: ReturnType<typeof resolveThinkMode>,
    signal: AbortSignal | null | undefined
  ): ReadableStream {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const id = `chatcmpl-qwen-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const emitChunk = (delta: Record<string, unknown>, finishReason: string | null) =>
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model: modelId,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })}\n\n`;

    return new ReadableStream({
      async start(controller) {
        const reader = upstream.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        let buffer = "";
        let fullContent = "";
        const thinkCtx = createThinkStreamContext(thinkMode);

        controller.enqueue(encoder.encode(emitChunk({ role: "assistant", content: "" }, null)));
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const delta = parseSseDelta(line);
              if (!delta || !delta.text) continue;
              if (delta.kind === "answer") {
                fullContent += delta.text;
                if (!hasTools) {
                  // Process through think mode (in case content has <think> tags)
                  const { contentDelta } = processThinkStreamDelta(delta.text, thinkCtx);
                  if (contentDelta) {
                    controller.enqueue(encoder.encode(emitChunk({ content: contentDelta }, null)));
                  }
                }
              } else if (delta.kind === "think" && !hasTools) {
                // Think phase — route through think mode processor
                // Wrap as <think> tag for the processor to detect
                const wrapped = `<think>${delta.text}</think>`;
                const { reasoningDelta, contentDelta } = processThinkStreamDelta(wrapped, thinkCtx);
                if (reasoningDelta) {
                  controller.enqueue(
                    encoder.encode(emitChunk({ reasoning_content: reasoningDelta }, null))
                  );
                }
                if (contentDelta) {
                  controller.enqueue(encoder.encode(emitChunk({ content: contentDelta }, null)));
                }
              }
            }
          }
        } catch (err) {
          if (!signal?.aborted) {
            controller.error(err);
            return;
          }
        }

        // Flush remaining think content
        const flushed = flushThinkStream(thinkCtx);
        if (flushed.reasoningDelta && !hasTools) {
          controller.enqueue(
            encoder.encode(emitChunk({ reasoning_content: flushed.reasoningDelta }, null))
          );
        }
        if (flushed.contentDelta && !hasTools) {
          controller.enqueue(encoder.encode(emitChunk({ content: flushed.contentDelta }, null)));
        }

        if (hasTools) {
          // Apply think mode to full content before tool parsing
          const { content: toolContent } = applyThinkMode(fullContent, thinkMode);
          const { content, toolCalls, finishReason } = buildToolAwareResult(
            toolContent,
            requestedTools,
            "qwen"
          );
          const delta = toolCalls
            ? { role: "assistant", content: null, tool_calls: toolCalls }
            : { role: "assistant", content };
          controller.enqueue(encoder.encode(emitChunk(delta, null)));
          controller.enqueue(encoder.encode(emitChunk({}, finishReason)));
        } else {
          controller.enqueue(encoder.encode(emitChunk({}, "stop")));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }
}

/** Parse one SSE line into a typed delta, or null if it carries no content. */
function parseSseDelta(line: string): { kind: "answer" | "think"; text: string } | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  let parsed: {
    choices?: Array<{ delta?: { phase?: string | null; content?: unknown } }>;
  };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  const delta = parsed?.choices?.[0]?.delta;
  if (!delta) return null;
  const phase = delta.phase;
  const content = typeof delta.content === "string" ? delta.content : "";
  if (phase === "think" || phase === "thinking_summary") {
    return { kind: "think", text: content };
  }
  // `answer` phase or a null/absent phase both carry assistant content.
  if (phase === "answer" || phase === null || phase === undefined) {
    return { kind: "answer", text: content };
  }
  return null;
}

export default QwenWebExecutor;
