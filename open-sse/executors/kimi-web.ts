/**
 * KimiWebExecutor — Moonshot AI Chat via www.kimi.com (international)
 *
 * Routes requests through Kimi's consumer chat API on the international domain.
 * Originally this executor targeted `kimi.moonshot.cn` (mainland-CN consumer
 * chat). That domain now redirects every visitor outside CN to
 * `https://www.kimi.com/`, which speaks a completely different API surface:
 *
 *   - Endpoint:  POST /apiv2/kimi.gateway.chat.v1.ChatService/Chat
 *   - Protocol:  Connect-RPC (unary envelope framing — 5-byte header + JSON)
 *   - Auth:      `Authorization: Bearer <JWT>` + `Cookie: kimi-auth=<JWT>`
 *   - Body:      Connect-framed `{scenario, message:{role,blocks:[{text:{content}}]},
 *                options:{thinking,enable_plugin}}`
 *   - Response:  Connect-framed stream of events carrying deltas with one of
 *                `mask: "block.text.content"` (answer) or
 *                `mask: "block.think.content"` (reasoning), emitted via
 *                `op: "set"` (initial) and `op: "append"` (incremental).
 *
 * Cookie handling: the user pastes their full Cookie header from www.kimi.com.
 * We extract the `kimi-auth` JWT from it (it is the only cookie the upstream
 * actually consults) and use it both as the Bearer token and as the Cookie we
 * send back, so we don't leak the user's analytics cookies (Ga, CF, HM, ...).
 *
 * The `x-msh-*` / `x-traffic-id` / `x-msh-shield-data` headers the SPA sends
 * are NOT required — verified by stripping them one at a time against a live
 * session; the upstream returns the same response either way.
 */
import { BaseExecutor, type ExecuteInput } from "./base.ts";
import { makeExecutorErrorResult as makeErrorResult, sanitizeErrorMessage } from "../utils/error.ts";
import { extractKimiJwt, buildKimiCookieHeader } from "@/lib/providers/webCookieAuth";

export { extractKimiJwt, buildKimiCookieHeader };

const BASE_URL = "https://www.kimi.com";
const CHAT_URL = `${BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

/**
 * Map a Kimi model id (the `key` field from `GetAvailableModels`) to the
 * request shape the upstream expects. Today only the chat-tier `k2d6` family
 * is supported — the agent variants (`k2d6-agent`, `k2d6-agent-ultra`) need
 * a different scenario (`SCENARIO_OK_COMPUTER`) plus `kimiPlusId` /
 * `agentMode` fields that this executor does not shape; users who need
 * agentic Kimi should use the `kimi-coding` (api.kimi.com) provider.
 */
export interface KimiModelConfig {
  scenario: string;
  thinking: boolean;
}

export function resolveModelConfig(modelId: string): KimiModelConfig {
  if (modelId === "k2d6-thinking") return { scenario: "SCENARIO_K2D5", thinking: true };
  // `k2d6` (Instant) and any unknown id fall back to the default chat scenario.
  return { scenario: "SCENARIO_K2D5", thinking: false };
}

/** Wrap a JSON message in the 5-byte Connect streaming envelope (flags + length). */
export function frameConnectMessage(json: string): Uint8Array {
  const payload = new TextEncoder().encode(json);
  const framed = new Uint8Array(5 + payload.length);
  framed[0] = 0; // flags: 0 = uncompressed
  const len = payload.length;
  framed[1] = (len >>> 24) & 0xff;
  framed[2] = (len >>> 16) & 0xff;
  framed[3] = (len >>> 8) & 0xff;
  framed[4] = len & 0xff;
  framed.set(payload, 5);
  return framed;
}

interface ConnectFrame {
  flags: number;
  message: Record<string, unknown> | null;
}

/**
 * ponytail: cap a single Connect frame at 8 MiB. Kimi's largest legitimate
 * event is well under 1 KiB (a delta or stage transition); anything bigger
 * means the upstream is misbehaving or an attacker controls the response and
 * is trying to OOM the proxy by sending a header claiming a huge length.
 * The non-streaming accumulator would otherwise grow unbounded. If you ever
 * see this tripping in production, raise the ceiling and add a regression
 * test — but never remove it.
 */
const MAX_FRAME_LEN = 8 * 1024 * 1024;

/**
 * Decode one Connect frame from a stream buffer.
 * Returns:
 *   - `consumed: 0` if there isn't enough data yet (need more bytes)
 *   - `consumed: -1` if the frame header claims a length above MAX_FRAME_LEN
 *     (caller must treat this as a stream-fatal protocol error)
 *   - `consumed: N` + the parsed frame otherwise
 */
export function decodeConnectFrame(buf: Uint8Array, byteOffset: number): { consumed: number; frame: ConnectFrame | null } {
  if (byteOffset + 5 > buf.length) return { consumed: 0, frame: null };
  const flags = buf[byteOffset];
  const len =
    (buf[byteOffset + 1] << 24) |
    (buf[byteOffset + 2] << 16) |
    (buf[byteOffset + 3] << 8) |
    buf[byteOffset + 4];
  // Sign-extend the high bit back to negative when len was read as signed.
  const msgLen = len < 0 ? len + 0x100000000 : len;
  if (msgLen > MAX_FRAME_LEN) return { consumed: -1, frame: null };
  if (byteOffset + 5 + msgLen > buf.length) return { consumed: 0, frame: null };

  const payload = buf.subarray(byteOffset + 5, byteOffset + 5 + msgLen);
  let message: Record<string, unknown> | null = null;
  if (msgLen > 0) {
    try {
      message = JSON.parse(new TextDecoder().decode(payload));
    } catch {
      message = null;
    }
  }
  return { consumed: 5 + msgLen, frame: { flags, message } };
}

type DeltaKind = "text" | "think" | null;

/**
 * Extract a content delta + kind from a Connect frame message.
 *
 * The chat stream uses two ops against two masks:
 *   - `op: "set"`     on `block.text`     / `block.think`     → first chunk
 *   - `op: "append"`  on `block.text.content` / `block.think.content` → subsequent chunks
 *
 * Anything else (heartbeats, chat/message metadata, stage transitions) is
 * suppressed; we only surface text to the client.
 */
export function extractDelta(msg: Record<string, unknown> | null): { kind: DeltaKind; text: string } | null {
  if (!msg) return null;
  const op = String(msg.op ?? "");
  const mask = String(msg.mask ?? "");
  const block = (msg.block ?? {}) as Record<string, unknown>;

  // `op: append` carries a delta string under `block.<text|think>.content`.
  if (op === "append") {
    if (mask === "block.text.content") {
      const text = String(((block.text ?? {}) as Record<string, unknown>).content ?? "");
      return text ? { kind: "text", text } : null;
    }
    if (mask === "block.think.content") {
      const text = String(((block.think ?? {}) as Record<string, unknown>).content ?? "");
      return text ? { kind: "think", text } : null;
    }
    return null;
  }

  // `op: set` on `block.text` / `block.think` carries the initial content.
  if (op === "set") {
    if (mask === "block.text") {
      const text = String(((block.text ?? {}) as Record<string, unknown>).content ?? "");
      return text ? { kind: "text", text } : null;
    }
    if (mask === "block.think") {
      const text = String(((block.think ?? {}) as Record<string, unknown>).content ?? "");
      return text ? { kind: "think", text } : null;
    }
  }
  return null;
}

export function isEndOfStream(msg: Record<string, unknown> | null): boolean {
  if (!msg) return false;
  // Assistant message flipped to COMPLETED.
  const message = (msg.message ?? null) as Record<string, unknown> | null;
  if (message && String(message.status ?? "") === "MESSAGE_STATUS_COMPLETED" && String(message.role ?? "") === "assistant") {
    return true;
  }
  return false;
}

/**
 * Fold a multi-turn OpenAI `messages` array into a single Kimi user turn.
 *
 * Tool-calling support (managed XML protocol, ported from Chat2API-web):
 *   - Assistant `tool_calls` are formatted as `<|CHAT2API|tool_calls>` XML
 *     blocks so the model can pick up its prior tool invocations.
 *   - `tool` role messages are formatted as `<|CHAT2API|tool_result>` blocks.
 *   - When `tools` are present in the request, the caller injects a managed-XML
 *     system prompt teaching the model the protocol; this function only handles
 *     the history-replay side.
 *
 * Limitations:
 *   - Image content parts are stringified into text, which loses structure.
 *   - Kimi's web chat is single-turn; we collapse to one user message.
 */
export function foldMessages(messages: Array<{ role: string; content: unknown; tool_call_id?: string; tool_calls?: unknown }>): string {
  let system = "";
  let user = "";
  for (const m of messages) {
    // Tool-call history replay: assistant tool_calls ?�� managed-XML block
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const block = formatAssistantToolCallsHistory(m.tool_calls as Array<{
        id: string;
        function: { name: string; arguments: string };
      }>);
      user = user ? `${user}\n\nAssistant: ${block}` : `Assistant: ${block}`;
      continue;
    }
    // Tool-call history replay: tool result ?�� managed-XML tool_result block
    if (m.role === "tool" && m.tool_call_id) {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      const block = `<|CHAT2API|tool_result tool_call_id="${m.tool_call_id}"><![CDATA[${text}]]></|CHAT2API|tool_result>`;
      user = user ? `${user}\n\nUser: ${block}` : `User: ${block}`;
      continue;
    }

    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
    if (m.role === "system") {
      system += (system ? "\n\n" : "") + text;
    } else if (m.role === "user") {
      // Kimi's web chat is single-turn; keep only the latest user content but
      // preserve prior assistant text for continuity when present.
      user = user ? `${user}\n\n${text}` : text;
    } else if (m.role === "assistant") {
      user = user ? `${user}\n\nAssistant: ${text}` : `Assistant: ${text}`;
    }
  }
  return system ? `${system}\n\n${user}` : user;
}

/**
 * Format an assistant tool_calls array as the Chat2API managed-XML history
 * block, for multi-turn agentic flow replay.
 */
function formatAssistantToolCallsHistory(
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>
): string {
  const invokes = toolCalls
    .map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = { _raw: tc.function.arguments };
      }
      const params = Object.entries(args)
        .map(
          ([k, v]) =>
            `<|CHAT2API|parameter name="${escapeXmlAttr(k)}"><![CDATA[${
              typeof v === "string" ? v : JSON.stringify(v)
            }]]></|CHAT2API|parameter>`
        )
        .join("");
      return `<|CHAT2API|invoke name="${escapeXmlAttr(tc.function.name)}">${params}</|CHAT2API|invoke>`;
    })
    .join("");
  return `<|CHAT2API|tool_calls>${invokes}</|CHAT2API|tool_calls>`;
}

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Render the managed-XML tool-calling system prompt. The model is taught to
 * emit `<|CHAT2API|tool_calls>` blocks when it wants to call a tool, and to
 * expect `<|CHAT2API|tool_result>` blocks back from us.
 *
 * Ported from Chat2API-web's `toolsToSystemPrompt` for the kimi provider.
 */
function renderKimiToolPrompt(
  tools: Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>
): string {
  if (!tools || tools.length === 0) return "";

  const toolList = tools
    .map((tool) => {
      const fn = tool.function || {};
      const schema = fn.parameters ? JSON.stringify(fn.parameters, null, 2) : "{}";
      return `### ${fn.name}\n${fn.description || ""}\n\nParameters schema:\n\`\`\`json\n${schema}\n\`\`\``;
    })
    .join("\n\n");

  return `## Available Tools

You can invoke the following developer tools. Tool names are case-sensitive.
Use only the exact tool names listed below. Do not rename, camelCase, translate, shorten, or invent tool names.

${toolList}

## Tool Call Format

When you need to call a tool, respond with ONLY the following Chat2API XML block (no prose before or after):

<|CHAT2API|tool_calls><|CHAT2API|invoke name="exact_tool_name"><|CHAT2API|parameter name="argument"><![CDATA[value]]></|CHAT2API|parameter></|CHAT2API|invoke></|CHAT2API|tool_calls>

You can include multiple <|CHAT2API|invoke> blocks inside a single <|CHAT2API|tool_calls> block when you need to call several tools in parallel.

Tool results will be provided back to you as Chat2API XML result blocks:

<|CHAT2API|tool_result tool_call_id="call_id"><![CDATA[result text]]></|CHAT2API|tool_result>

After receiving tool results, continue the conversation by either calling more tools or producing a final answer.`;
}

// ?��?�� Tool call stream parser (managed XML) ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��

const KIMI_TOOL_MARKER_OPEN = "<|CHAT2API|tool_calls>";
const KIMI_TOOL_MARKER_CLOSE = "</|CHAT2API|tool_calls>";
const KIMI_TOOL_INVOKE_OPEN = '<|CHAT2API|invoke name="';

/**
 * Streaming tool-call parser ?�� detects `<|CHAT2API|tool_calls>` markers in
 * a stream of text chunks, buffers until the closing tag arrives, then emits
 * the parsed tool calls as OpenAI `tool_calls` deltas.
 *
 * Use one instance per stream. Call `push(text)` for each text chunk and
 * `flush()` at the end.
 */
class KimiToolStreamParser {
  state: "idle" | "buffering" = "idle";
  buffer = "";
  emittedToolCalls = false;
  nextIndex = 0;

  push(text: string): Array<{ content?: string } | { tool_calls: Array<Record<string, unknown>> }> {
    if (this.state === "idle") {
      const idx = text.indexOf(KIMI_TOOL_MARKER_OPEN);
      if (idx === -1) {
        if (!text) return [];
        return [{ content: text }];
      }
      const before = text.slice(0, idx);
      this.state = "buffering";
      this.buffer = text.slice(idx);
      const out: Array<{ content?: string } | { tool_calls: Array<Record<string, unknown>> }> = [];
      if (before) out.push({ content: before });
      const parsed = this.tryParse();
      if (parsed) {
        if (parsed.toolCalls.length > 0) {
          out.push({ tool_calls: this.formatDeltas(parsed.toolCalls) });
        }
        this.emittedToolCalls = true;
        this.state = "idle";
        this.buffer = "";
        if (parsed.remaining) out.push(...this.push(parsed.remaining));
      }
      return out;
    }
    this.buffer += text;
    const parsed = this.tryParse();
    if (!parsed) return [];
    const out: Array<{ tool_calls: Array<Record<string, unknown>> }> = [];
    if (parsed.toolCalls.length > 0) {
      out.push({ tool_calls: this.formatDeltas(parsed.toolCalls) });
    }
    this.emittedToolCalls = true;
    this.state = "idle";
    this.buffer = "";
    if (parsed.remaining) {
      out.push(...(this.push(parsed.remaining) as Array<{ tool_calls: Array<Record<string, unknown>> }>));
    }
    return out;
  }

  flush(): Array<{ content?: string }> {
    if (this.state === "buffering" && this.buffer) {
      const text = this.buffer;
      this.buffer = "";
      this.state = "idle";
      return [{ content: text }];
    }
    return [];
  }

  hasEmittedToolCall(): boolean {
    return this.emittedToolCalls;
  }

  isBuffering(): boolean {
    return this.state === "buffering";
  }

  private tryParse(): { toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>; remaining: string } | null {
    const closeIdx = this.buffer.indexOf(KIMI_TOOL_MARKER_CLOSE);
    if (closeIdx === -1) return null;
    const block = this.buffer.slice(KIMI_TOOL_MARKER_OPEN.length, closeIdx);
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
    let cursor = 0;
    while (cursor < block.length) {
      const invokeStart = block.indexOf(KIMI_TOOL_INVOKE_OPEN, cursor);
      if (invokeStart === -1) break;
      const nameStart = invokeStart + KIMI_TOOL_INVOKE_OPEN.length;
      const nameEnd = block.indexOf('">', nameStart);
      if (nameEnd === -1) break;
      const name = block.slice(nameStart, nameEnd);
      const bodyStart = nameEnd + 2;
      const bodyEnd = block.indexOf("</|CHAT2API|invoke>", bodyStart);
      if (bodyEnd === -1) break;
      const invokeBody = block.slice(bodyStart, bodyEnd);
      const args = parseInvokeParameters(invokeBody);
      toolCalls.push({
        id: `call_${Math.random().toString(36).slice(2, 14)}`,
        name,
        arguments: args,
      });
      cursor = bodyEnd + "</|CHAT2API|invoke>".length;
    }
    return { toolCalls, remaining: this.buffer.slice(closeIdx + KIMI_TOOL_MARKER_CLOSE.length) };
  }

  private formatDeltas(
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  ): Array<Record<string, unknown>> {
    return toolCalls.map((tc) => ({
      index: this.nextIndex++,
      id: tc.id,
      type: "function",
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    }));
  }
}

function parseInvokeParameters(invokeBody: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const paramRegex = /<\|CHAT2API\|parameter name="([^"]+)">([\s\S]*?)<\/\|CHAT2API\|parameter>/g;
  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(invokeBody)) !== null) {
    const name = match[1];
    let value: unknown = match[2];
    const cdata = (value as string).match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
    if (cdata) {
      value = cdata[1];
    } else {
      const trimmed = (value as string).trim();
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          value = JSON.parse(trimmed);
        } catch {
          value = trimmed;
        }
      } else if (trimmed === "true") value = true;
      else if (trimmed === "false") value = false;
      else if (/^-?\d+(\.\d+)?$/.test(trimmed)) value = Number(trimmed);
      else value = trimmed;
    }
    args[name] = value;
  }
  return args;
}

export class KimiWebExecutor extends BaseExecutor {
  constructor() {
    super("kimi-web", { id: "kimi-web", baseUrl: BASE_URL });
  }

  /**
   * Build request headers for Kimi's Connect-RPC API.
   *
   * @param jwt — the extracted kimi-auth JWT (used for `Authorization: Bearer`)
   * @param cookieHeader — the full Cookie header value (may include anti-bot
   *   cookies like cf_clearance alongside kimi-auth). When non-empty, this
   *   replaces the default `kimi-auth=<jwt>` so auxiliary cookies survive.
   */
  private buildKimiHeaders(jwt: string, cookieHeader?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/connect+json",
      Accept: "*/*",
      "User-Agent": USER_AGENT,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      "connect-protocol-version": "1",
    };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
      // Forward the full cookie blob when available (may carry anti-bot
      // cookies); otherwise emit the canonical single-cookie form.
      headers["Cookie"] = cookieHeader || `kimi-auth=${jwt}`;
    }
    return headers;
  }

  private buildRequestBody(prompt: string, wantThinking: boolean, scenario: string): string {
    return JSON.stringify({
      scenario,
      tools: [{ type: "TOOL_TYPE_SEARCH", search: {} }, { type: "TOOL_TYPE_CRON_JOB" }],
      message: {
        role: "user",
        blocks: [{ message_id: "", text: { content: prompt } }],
        scenario,
      },
      options: { thinking: wantThinking, enable_plugin: true },
    });
  }

  async execute(input: ExecuteInput) {
    const { body, credentials, signal, stream: wantStream } = input;
    const bodyObj = (body || {}) as Record<string, unknown>;

    // Resolve the raw credential with COOKIE-FIRST priority:
    //   1. providerSpecificData.cookie — set by the bulk web-session import
    //      (cookie-kind providers store the full cookie blob here, apiKey
    //      stays null). Without this fallback, bulk-imported kimi-web
    //      connections always fail with "Missing Kimi session".
    //   2. credentials.apiKey — set by the Add API Key modal (bare JWT or
    //      full cookie pasted directly).
    //
    // Cookie-first ensures that when both paths are populated (unlikely but
    // possible), the more complete cookie blob wins — it may carry anti-bot
    // cookies (cf_clearance, etc.) that a bare JWT in apiKey lacks.
    const psd = credentials?.providerSpecificData as { cookie?: string; customHeaders?: Record<string, string> } | undefined;
    const rawCredential = String(psd?.cookie ?? credentials?.apiKey ?? "").trim();
    const jwt = extractKimiJwt(rawCredential);
    if (!jwt) {
      return makeErrorResult(
        400,
        "Missing Kimi session — paste the full Cookie header from www.kimi.com (must contain kimi-auth=<JWT>) or just the JWT itself.",
        body,
        CHAT_URL
      );
    }

    // Build the Cookie header value: forward the full blob when available
    // (preserves auxiliary anti-bot cookies), otherwise emit `kimi-auth=<jwt>`.
    const cookieHeader = buildKimiCookieHeader(rawCredential);

    const messages = (bodyObj.messages as Array<{ role: string; content: unknown; tool_call_id?: string; tool_calls?: unknown }>) || [];
    const modelId = (bodyObj.model as string) || "kimi-default";
    // Resolve scenario + default thinking flag from the model id (catalog truth),
    // then honour an explicit `reasoning_effort: "none"` override from the caller.
    const modelConfig = resolveModelConfig(modelId);
    const wantThinking = bodyObj.reasoning_effort === "none" ? false : modelConfig.thinking;

    // ?��?�� Tool-calling injection (managed XML protocol) ?��?��
    // When the client sends `tools`, prepend a system message teaching the
    // model the <|CHAT2API|tool_calls> protocol. The stream/non-stream paths
    // below parse the model's response for matching blocks and emit OpenAI
    // `tool_calls` deltas.
    const clientTools = Array.isArray(bodyObj.tools) ? bodyObj.tools : null;
    let messagesForFold = messages;
    if (clientTools && clientTools.length > 0) {
      const toolPrompt = renderKimiToolPrompt(
        clientTools as Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>
      );
      if (toolPrompt) {
        messagesForFold = [{ role: "system", content: toolPrompt }, ...messages];
      }
    }

    const prompt = foldMessages(messagesForFold);
    const reqBody = this.buildRequestBody(prompt, wantThinking, modelConfig.scenario);
    const reqHeaders = this.buildKimiHeaders(jwt, cookieHeader);

    // Connect framing wraps the JSON body in a 5-byte envelope. Without it the
    // upstream returns `invalid_argument` for every request.
    const framedBody = frameConnectMessage(reqBody);

    let upstream: Response;
    try {
      upstream = await fetch(CHAT_URL, {
        method: "POST",
        headers: reqHeaders,
        body: new Uint8Array(framedBody),
        signal,
      });
    } catch (err) {
      return makeErrorResult(
        502,
        `Kimi fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
        body,
        CHAT_URL
      );
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return makeErrorResult(upstream.status, `Kimi error: ${sanitizeErrorMessage(errText)}`, body, CHAT_URL);
    }

    const encoder = new TextEncoder();
    const id = `chatcmpl-kimi-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    const emitChunk = (
      controller: ReadableStreamDefaultController,
      delta: Record<string, unknown>,
      finish: string | null = null
    ) => {
      const chunk = {
        id,
        object: "chat.completion.chunk",
        created,
        model: modelId,
        choices: [{ index: 0, delta, finish_reason: finish }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    };

    // The upstream is a Connect-framed stream regardless of whether the
    // client asked for SSE — Kimi always streams. For non-streaming clients
    // we buffer the full response below.
    const sourceStream = upstream.body ?? new ReadableStream({ start: (c) => c.close() });

    if (wantStream) {
      // One tool-stream parser per request (instantiated only when tools are present).
      const toolParser = clientTools && clientTools.length > 0 ? new KimiToolStreamParser() : null;
      const outStream = new ReadableStream({
        async start(controller) {
          const reader = sourceStream.getReader();
          let buffer = new Uint8Array(0);
          let emittedRole = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                const merged = new Uint8Array(buffer.length + value.length);
                merged.set(buffer, 0);
                merged.set(value, buffer.length);
                buffer = merged;

                let offset = 0;
                while (offset < buffer.length) {
                  const { consumed, frame } = decodeConnectFrame(buffer, offset);
                  if (consumed === -1) {
                    // Frame header claims a length above MAX_FRAME_LEN — stream-fatal.
                    controller.error(new Error("Kimi Connect frame exceeded MAX_FRAME_LEN"));
                    return;
                  }
                  if (consumed === 0) break; // need more bytes
                  offset += consumed;
                  if (!frame?.message) continue;

                  // Multi-stage thinking detection: some Kimi frames carry a
                  // `multiStage.stages[0].name === "STAGE_NAME_THINKING"` marker
                  // that signals the model is in the reasoning phase. We don't
                  // need to emit anything for it ?�� the `extractDelta` function
                  // already routes think content to `reasoning_content` deltas ?��
                  // but we use it to suppress spurious content emissions during
                  // the thinking phase. Ported from Chat2API-web's KimiStreamHandler.
                  const multiStage = (frame.message.multiStage ?? null) as
                    | { stages?: Array<{ name?: string; status?: string }> }
                    | null;
                  const inThinkingStage = !!(
                    multiStage?.stages?.[0]?.name === "STAGE_NAME_THINKING" &&
                    multiStage.stages[0].status !== "completed"
                  );

                  const delta = extractDelta(frame.message);
                  if (delta) {
                    if (!emittedRole) {
                      emittedRole = true;
                      emitChunk(controller, { role: "assistant", content: "" });
                    }
                    if (delta.kind === "think") {
                      emitChunk(controller, { reasoning_content: delta.text });
                    } else {
                      // Content delta ?�� route through tool parser when tools are present
                      if (toolParser) {
                        const toolDeltas = toolParser.push(delta.text);
                        for (const d of toolDeltas) {
                          emitChunk(controller, d);
                        }
                      } else if (!inThinkingStage) {
                        emitChunk(controller, { content: delta.text });
                      }
                    }
                  }
                  if (isEndOfStream(frame.message)) {
                    // Flush any buffered tool-call content
                    if (toolParser) {
                      const flushDeltas = toolParser.flush();
                      for (const d of flushDeltas) {
                        emitChunk(controller, d);
                      }
                    }
                    const finishReason = toolParser?.hasEmittedToolCall() ? "tool_calls" : "stop";
                    emitChunk(controller, {}, finishReason);
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                    return;
                  }
                }
                // Compact the buffer.
                buffer = buffer.subarray(offset);
              }
            }
            // Stream ended without an explicit COMPLETED marker — flush a stop.
            if (!emittedRole) {
              emitChunk(controller, { role: "assistant", content: "" });
            }
            if (toolParser) {
              const flushDeltas = toolParser.flush();
              for (const d of flushDeltas) {
                emitChunk(controller, d);
              }
            }
            const finishReason = toolParser?.hasEmittedToolCall() ? "tool_calls" : "stop";
            emitChunk(controller, {}, finishReason);
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
        url: CHAT_URL,
        headers: reqHeaders,
        transformedBody: JSON.parse(reqBody),
      };
    }

    // Non-streaming: collect all deltas into a single chat.completion JSON.
    let answer = "";
    let reasoning = "";
    const reader = sourceStream.getReader();
    let buffer = new Uint8Array(0);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const merged = new Uint8Array(buffer.length + value.length);
        merged.set(buffer, 0);
        merged.set(value, buffer.length);
        buffer = merged;

        let offset = 0;
        while (offset < buffer.length) {
          const { consumed, frame } = decodeConnectFrame(buffer, offset);
          if (consumed === -1) break; // oversized frame — abort, return what we have
          if (consumed === 0) break;
          offset += consumed;
          if (!frame?.message) continue;
          const delta = extractDelta(frame.message);
          if (delta) {
            if (delta.kind === "think") reasoning += delta.text;
            else answer += delta.text;
          }
          if (isEndOfStream(frame.message)) {
            offset = buffer.length; // drain
            break;
          }
        }
        buffer = buffer.subarray(offset);
      }
    } catch {
      /* best-effort ?�� return what we have */
    }

    // Parse managed-XML tool calls from the assembled answer (non-stream path).
    let parsedToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
    let finalAnswer = answer;
    if (answer.includes(KIMI_TOOL_MARKER_OPEN)) {
      // Use a one-shot parser to extract tool calls + cleaned content.
      const oneShot = new KimiToolStreamParser();
      const deltas = oneShot.push(answer);
      const flushDeltas = oneShot.flush();
      // Reconstruct content (non-tool portion) and tool_calls from the deltas.
      let contentRestored = "";
      const toolCallDeltas: Array<Record<string, unknown>> = [];
      for (const d of [...deltas, ...flushDeltas]) {
        if ("content" in d && typeof d.content === "string") {
          contentRestored += d.content;
        } else if ("tool_calls" in d && Array.isArray(d.tool_calls)) {
          toolCallDeltas.push(...d.tool_calls);
        }
      }
      finalAnswer = contentRestored;
      parsedToolCalls = toolCallDeltas.map((d) => ({
        id: String(d.id),
        name: String((d.function as { name: string }).name),
        arguments: JSON.parse((d.function as { arguments: string }).arguments || "{}"),
      }));
    }

    const message: Record<string, unknown> = { role: "assistant", content: finalAnswer };
    if (reasoning) message.reasoning_content = reasoning;
    if (parsedToolCalls.length > 0) {
      message.tool_calls = parsedToolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }
    const finishReason = parsedToolCalls.length > 0 ? "tool_calls" : "stop";
    const completion = {
      id,
      object: "chat.completion",
      created,
      model: modelId,
      choices: [{ index: 0, message, finish_reason: finishReason }],
    };
    return {
      response: new Response(JSON.stringify(completion), {
        headers: { "Content-Type": "application/json" },
      }),
      url: CHAT_URL,
      headers: reqHeaders,
      transformedBody: JSON.parse(reqBody),
    };
  }
}
