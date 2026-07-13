/**
 * XiaomimimoWebExecutor - Xiaomi MiMo AI Studio web chat (cookie-based)
 *
 * Targets the production web chat at https://aistudio.xiaomimimo.com.
 *
 * Auth model (cookie-based):
 *   - serviceToken  - from cookie `serviceToken`
 *   - userId        - from cookie `userId`
 *   - xiaomichatbot_ph (aka phToken) - from cookie `xiaomichatbot_ph`
 *
 * The ph_token is sent both as a cookie AND as a query param on every endpoint.
 *
 * Flow:
 *   1. Resolve conversationId via providerSessionRegistry (maps agent chat_id
 *      to MiMo conversationId for multi-turn continuity).
 *   2. Save conversation: POST /open-apis/chat/conversation/save
 *   3. Prepare messages with tool support (OmniRoute native webTools.ts).
 *   4. POST /open-apis/bot/chat - SSE response.
 *   5. Think mode processing via shared thinkModeProcessor.ts
 *      (passthrough / strip / separate modes).
 *   6. Tool call parsing via shared webTools.ts (<tool>{json}</tool> protocol).
 *   7. Best-effort genTitle (for new conversations) + optional delete.
 *
 * Session persistence (aligned with deepseek-web #2942):
 *   - persistSession=false (default): delete chat after response — fresh session
 *     per request (legacy behavior, avoids chat accumulation on platform).
 *   - persistSession=true: keep chat on platform for reuse (rolling-window
 *     memory across requests with same agentChatId).
 *
 * Tool calling: OmniRoute native <tool>{json}</tool> protocol
 * (via webTools.ts + chatgptWebTools.ts).
 *
 * Headers: default headers are used as-is. Users can override via
 * providerSpecificData.customHeaders from the dashboard.
 */
import { BaseExecutor, type ExecuteInput, type ProviderCredentials } from "./base.ts";
import {
  makeExecutorErrorResult as makeErrorResult,
  sanitizeErrorMessage,
} from "../utils/error.ts";
import { randomUUID } from "node:crypto";
import { prepareToolMessages, buildToolAwareResult } from "../translator/webTools.ts";
import { buildToolModeResponse } from "./chatgptWebTools.ts";
import { getAgentChatId } from "../utils/agentChatIdExtractor.ts";
import { getMapping, saveMapping } from "../services/providerSessionRegistry.ts";
import {
  applyThinkMode,
  createThinkStreamContext,
  processThinkStreamDelta,
  flushThinkStream,
} from "../utils/thinkModeProcessor.ts";
import { resolveThinkMode } from "../services/thinkOutputMode.ts";
import { createHash } from "node:crypto";

// -- Constants --

const MIMO_API_BASE = "https://aistudio.xiaomimimo.com";
const CHAT_PATH = "/open-apis/bot/chat";
const SAVE_CONVERSATION_PATH = "/open-apis/chat/conversation/save";
const GEN_TITLE_PATH = "/open-apis/chat/conversation/genTitle";
const DELETE_PATH = "/open-apis/chat/conversation/delete";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36";

// -- Types --

interface MimoCredentials {
  serviceToken: string;
  userId: string;
  phToken: string;
}

interface MimoUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  nativeUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string }> | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

// -- Credential Extraction --

function extractMimoCredentials(credentials: ProviderCredentials): MimoCredentials | null {
  const psd = (credentials?.providerSpecificData ?? {}) as Record<string, unknown>;
  const serviceToken = str(psd.serviceToken) || str(psd.service_token);
  const userId = str(psd.userId) || str(psd.user_id);
  const phToken = str(psd.phToken) || str(psd.ph_token) || str(psd.xiaomichatbot_ph);
  if (serviceToken && userId && phToken) return { serviceToken, userId, phToken };

  const cookieHeader = str(psd.cookie) || str(credentials?.apiKey);
  if (!cookieHeader) return null;
  const parsed = parseCookieHeader(cookieHeader);
  const st = parsed.serviceToken || "";
  const uid = parsed.userId || "";
  const ph = parsed.xiaomichatbot_ph || "";
  if (!st || !uid || !ph) return null;
  return { serviceToken: st, userId: uid, phToken: ph };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    let val = part.slice(eq + 1).trim();
    // Strip surrounding quotes (some cookie exporters quote values that
    // contain special characters like + or =).
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // URL-decode (browsers may encode + as %2B and = as %3D in cookie values).
    try {
      val = decodeURIComponent(val);
    } catch {
      // keep raw if decoding fails
    }
    if (key) out[key] = val;
  }
  return out;
}

// -- URL & Headers --

function buildUrl(path: string, phToken: string): string {
  return `${MIMO_API_BASE}${path}?xiaomichatbot_ph=${encodeURIComponent(phToken)}`;
}

function buildHeaders(
  creds: MimoCredentials,
  customHeaders?: Record<string, string>
): Record<string, string> {
  const defaults: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Cookie: `serviceToken=${creds.serviceToken}; userId=${creds.userId}; xiaomichatbot_ph=${creds.phToken}`,
    Origin: MIMO_API_BASE,
    Referer: `${MIMO_API_BASE}/`,
    "User-Agent": USER_AGENT,
    "X-Timezone": "Asia/Shanghai",
    "Sec-Ch-Ua": '"Chromium";v="144", "Not(A:Brand";v="8", "Google Chrome";v="144"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
  // User can override any header from the dashboard via providerSpecificData.customHeaders
  return { ...defaults, ...(customHeaders || {}) };
}

// -- Message Flattening --

function extractTextContent(content: OpenAIMessage["content"]): string {
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
 * Flatten the OpenAI messages array into a single query string.
 * Tool calls and tool results are formatted as readable text blocks.
 */
function buildMimoQuery(messages: OpenAIMessage[]): string {
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const truncated = rest.slice(-20);
  const msgs = [...system, ...truncated];

  const parts: string[] = [];
  const sysContent = system
    .map((m) => extractTextContent(m.content))
    .filter(Boolean)
    .join("\n");
  if (sysContent) parts.push(`[System Instruction]\n${sysContent}`);

  const nonSystem = msgs.filter((m) => m.role !== "system");
  const dialogHistory = nonSystem.slice(0, -1);
  const lastMsg = nonSystem[nonSystem.length - 1];

  if (dialogHistory.length > 0) {
    parts.push(`[Conversation History]\n${dialogHistory.map(formatMessageForHistory).join("\n")}`);
  }
  if (lastMsg) parts.push(`[Current Query]\n${formatMessageForHistory(lastMsg)}`);

  if (parts.length === 1 && nonSystem.length === 1 && nonSystem[0].role === "user") {
    return extractTextContent(nonSystem[0].content);
  }
  return parts.join("\n\n");
}

function formatMessageForHistory(m: OpenAIMessage): string {
  if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
    const callsStr = m.tool_calls
      .map((tc) => `${tc.function.name}(${tc.function.arguments})`)
      .join("\n");
    const contentPart = m.content ? `\n${extractTextContent(m.content)}` : "";
    return `assistant: [Tool Calls]\n${callsStr}${contentPart}`;
  }
  if (m.role === "tool" && m.tool_call_id) {
    const content = extractTextContent(m.content);
    return `[Tool Result] (${m.tool_call_id}):\n${content}`;
  }
  return `${m.role}: ${extractTextContent(m.content)}`;
}

// -- Citation Stripping (MiMo-specific) --

function stripCitationsWithBuffer(text: string, buffer: { value: string }): string {
  buffer.value += text;
  let cleaned = buffer.value
    .replace(/[\u3010\u3011\[\(]?\(citation:\d+\)[\u3010\u3011\[\])]?/g, "")
    .replace(/citation:\d+/g, "");
  cleaned = cleaned.replace(/\[(\d{1,3})\](?!\s*[a-zA-Z0-9_])/g, (m, n: string) =>
    n === "0" ? m : ""
  );
  const partialIdx = cleaned.lastIndexOf("(citation");
  if (partialIdx !== -1 && !cleaned.slice(partialIdx).includes(")")) {
    buffer.value = cleaned.slice(partialIdx);
    cleaned = cleaned.slice(0, partialIdx);
  } else {
    buffer.value = "";
  }
  return cleaned;
}

function stripCitations(text: string): string {
  return stripCitationsWithBuffer(text, { value: "" });
}

// -- Best-effort post-chat helpers --

async function saveConversation(
  creds: MimoCredentials,
  conversationId: string,
  customHeaders?: Record<string, string>
): Promise<boolean> {
  if (!conversationId) return false;
  try {
    const resp = await fetch(buildUrl(SAVE_CONVERSATION_PATH, creds.phToken), {
      method: "POST",
      headers: buildHeaders(creds, customHeaders),
      body: JSON.stringify({ conversationId, title: "New conversation", type: "chat" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return false;
    const data = (await resp.json().catch(() => null)) as { code?: number } | null;
    return data?.code === 0;
  } catch {
    return false;
  }
}

async function generateConversationTitle(
  creds: MimoCredentials,
  conversationId: string,
  query: string,
  answer: string,
  customHeaders?: Record<string, string>
): Promise<boolean> {
  const content = `${query} ${answer}`.trim();
  if (!conversationId || !content) return false;
  try {
    const resp = await fetch(buildUrl(GEN_TITLE_PATH, creds.phToken), {
      method: "POST",
      headers: buildHeaders(creds, customHeaders),
      body: JSON.stringify({ conversationId, content }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return false;
    const data = (await resp.json().catch(() => null)) as { code?: number } | null;
    return data?.code === 0;
  } catch {
    return false;
  }
}

async function deleteConversation(
  creds: MimoCredentials,
  conversationId: string
): Promise<boolean> {
  if (!conversationId) return false;
  try {
    const resp = await fetch(buildUrl(DELETE_PATH, creds.phToken), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `serviceToken=${creds.serviceToken}; userId=${creds.userId}; xiaomichatbot_ph=${creds.phToken}`,
        Origin: MIMO_API_BASE,
        Referer: `${MIMO_API_BASE}/`,
      },
      body: JSON.stringify([conversationId]),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) return false;
    const data = (await resp.json().catch(() => null)) as { code?: number } | null;
    return data?.code === 0;
  } catch {
    return false;
  }
}

// -- Image Upload (multiMedias) --

interface MimoMedia {
  mediaType: string;
  fileUrl: string;
  compressedVideoUrl: string;
  audioTrackUrl: string;
  name: string;
  size: number;
  status: string;
  objectName: string;
  tokenUsage: number;
  url: string;
}

/**
 * Extract image URLs from OpenAI messages content array.
 * Supports both { type: "image_url", image_url: { url: "..." } } and
 * { type: "image", image: "..." } formats.
 */
function extractImageUrlsFromMessages(
  messages: OpenAIMessage[]
): Array<{ url: string; name: string }> {
  const images: Array<{ url: string; name: string }> = [];
  for (const msg of messages) {
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "image_url" && part.image_url) {
        const url =
          typeof part.image_url === "string"
            ? part.image_url
            : (part.image_url as { url?: string }).url;
        if (url) images.push({ url, name: `image-${images.length}.png` });
      } else if (part.type === "image" && part.text) {
        // Some formats use { type: "image", text: "data:..." }
        if (part.text.startsWith("data:") || part.text.startsWith("http")) {
          images.push({ url: part.text, name: `image-${images.length}.png` });
        }
      }
    }
  }
  return images;
}

/**
 * Upload an image to MiMo's CDN (3-step process):
 *   1. POST /open-apis/resource/genUploadInfo → get uploadUrl + resourceUrl + objectName
 *   2. PUT <uploadUrl> with binary data
 *   3. POST /open-apis/resource/parse → get collection ID
 *
 * Returns a MimoMedia object ready for the multiMedias array.
 */
async function uploadImageToMimo(
  creds: MimoCredentials,
  imageUrl: string,
  fileName: string,
  customHeaders?: Record<string, string>
): Promise<MimoMedia | null> {
  try {
    // Fetch the image bytes
    let imageBytes: Uint8Array;
    let contentType = "image/png";

    if (imageUrl.startsWith("data:")) {
      // data:image/png;base64,...
      const match = imageUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!match) return null;
      contentType = match[1];
      imageBytes = new Uint8Array(Buffer.from(match[2], "base64"));
    } else {
      const resp = await fetch(imageUrl);
      if (!resp.ok) return null;
      contentType = resp.headers.get("content-type") || "image/png";
      const buf = await resp.arrayBuffer();
      imageBytes = new Uint8Array(buf);
    }

    const fileSize = imageBytes.length;
    const md5 = createHash("md5").update(imageBytes).digest("hex");
    const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? ".jpg" : ".png";

    // Step 1: genUploadInfo
    const uploadInfoResp = await fetch(
      `${MIMO_API_BASE}/open-apis/resource/genUploadInfo?xiaomichatbot_ph=${encodeURIComponent(creds.phToken)}`,
      {
        method: "POST",
        headers: buildHeaders(creds, customHeaders),
        body: JSON.stringify({ fileName: fileName + ext, fileContentMd5: md5 }),
      }
    );
    if (!uploadInfoResp.ok) return null;
    const uploadInfo = (await uploadInfoResp.json()) as {
      code?: number;
      data?: {
        resourceId?: string;
        resourceUrl?: string;
        uploadUrl?: string;
        objectName?: string;
      };
    };
    if (uploadInfo.code !== 0 || !uploadInfo.data?.uploadUrl) return null;

    const { resourceUrl, uploadUrl, objectName } = uploadInfo.data;

    // Step 2: PUT binary to uploadUrl
    const putResp = await fetch(uploadUrl!, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "content-md5": md5,
        Origin: MIMO_API_BASE,
        Referer: `${MIMO_API_BASE}/`,
      },
      body: imageBytes,
    });
    if (!putResp.ok) return null;

    // Step 3: parse to get collection ID
    const parseUrl = `${MIMO_API_BASE}/open-apis/resource/parse?fileUrl=${encodeURIComponent(resourceUrl!)}&objectName=${encodeURIComponent(objectName!)}&model=mimo-v2.5&xiaomichatbot_ph=${encodeURIComponent(creds.phToken)}`;
    const parseResp = await fetch(parseUrl, {
      method: "POST",
      headers: buildHeaders(creds, customHeaders),
      body: "{}",
    });
    if (!parseResp.ok) return null;
    const parseData = (await parseResp.json()) as {
      code?: number;
      data?: { id?: string; collectionName?: string; filename?: string };
    };
    if (parseData.code !== 0 || !parseData.data?.id) return null;

    return {
      mediaType: "image",
      fileUrl: resourceUrl!,
      compressedVideoUrl: "",
      audioTrackUrl: "",
      name: fileName + ext,
      size: fileSize,
      status: "completed",
      objectName: objectName!,
      tokenUsage: 1024,
      url: parseData.data.id,
    };
  } catch {
    return null;
  }
}

// -- Executor --

/**
 * Convert MiMo usage to OpenAI usage format.
 * MiMo sends: { promptTokens, completionTokens, totalTokens, nativeUsage: { ... } }
 * OmniRoute expects: { prompt_tokens, completion_tokens, total_tokens,
 *   prompt_tokens_details: { cached_tokens }, completion_tokens_details: { reasoning_tokens } }
 *
 * The nativeUsage object already has the right field names (prompt_tokens,
 * completion_tokens, etc.) — we just need to extract it.
 */
function mimoUsageToOpenAI(usage: MimoUsage | null): Record<string, unknown> | undefined {
  if (!usage) return undefined;
  const nu = usage.nativeUsage;
  if (nu) {
    // Use nativeUsage directly — it has the complete OpenAI-compatible shape
    return {
      prompt_tokens: nu.prompt_tokens ?? usage.promptTokens ?? 0,
      completion_tokens: nu.completion_tokens ?? usage.completionTokens ?? 0,
      total_tokens: nu.total_tokens ?? usage.totalTokens ?? 0,
      ...(nu.prompt_tokens_details ? { prompt_tokens_details: nu.prompt_tokens_details } : {}),
      ...(nu.completion_tokens_details
        ? { completion_tokens_details: nu.completion_tokens_details }
        : {}),
    };
  }
  // Fallback: use flat fields without details
  return {
    prompt_tokens: usage.promptTokens || 0,
    completion_tokens: usage.completionTokens || 0,
    total_tokens: usage.totalTokens || 0,
  };
}

export class XiaomimimoWebExecutor extends BaseExecutor {
  constructor() {
    super("xiaomimimo-web", { id: "xiaomimimo-web", baseUrl: MIMO_API_BASE });
  }

  override async execute(input: ExecuteInput): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }> {
    const { body, credentials, signal, stream: wantStream, log } = input;
    const bodyObj = (body || {}) as Record<string, unknown>;

    // 1. Extract credentials
    const creds = extractMimoCredentials(credentials);
    if (!creds) {
      return makeErrorResult(
        401,
        "Missing Xiaomi MiMo cookies - paste the full Cookie header from aistudio.xiaomimimo.com (must contain serviceToken, userId, xiaomichatbot_ph) into the session cookie field.",
        body,
        MIMO_API_BASE
      );
    }

    // Custom headers from providerSpecificData (user can override defaults)
    const customHeaders = (
      credentials?.providerSpecificData as { customHeaders?: Record<string, string> } | undefined
    )?.customHeaders;

    // 2. Resolve conversationId via providerSessionRegistry
    //    - If agentChatId is present and mapping exists → REUSE conversationId
    //    - If agentChatId is present but no mapping → CREATE new mapping + new conversationId
    //    - If agentChatId is absent → one-shot: generate fresh conversationId
    //
    //    Only NEW conversations get saveConversation() + genTitle() so they
    //    appear in the MiMo chat list with a proper auto-generated title.
    //    REUSED conversations already exist on the platform with a title.
    const connectionId = (credentials as { connectionId?: string })?.connectionId || "default";
    const agentChatId = getAgentChatId(bodyObj, input.clientHeaders as Record<string, unknown>);

    let conversationId: string;
    let isNewConversation = false;

    if (agentChatId) {
      const existing = getMapping({
        connectionId,
        agentChatId,
        provider: "mimo",
      });
      if (existing) {
        // Reuse — conversation already saved on platform with a title
        conversationId = existing.providerConversationId;
        isNewConversation = false;
        log?.debug?.(
          "MIMOWEB",
          `registry: agentChatId=${agentChatId.slice(0, 16)} -> conversationId=${conversationId.slice(0, 16)} (reused)`
        );
      } else {
        // New mapping — first time seeing this agentChatId
        conversationId = randomUUID().replace(/-/g, "");
        saveMapping({
          connectionId,
          agentChatId,
          provider: "mimo",
          providerConversationId: conversationId,
        });
        isNewConversation = true;
        log?.debug?.(
          "MIMOWEB",
          `registry: agentChatId=${agentChatId.slice(0, 16)} -> conversationId=${conversationId.slice(0, 16)} (new)`
        );
      }
    } else {
      // One-shot (no agentChatId) — always new
      conversationId = randomUUID().replace(/-/g, "");
      isNewConversation = true;
    }

    const msgId = randomUUID().replace(/-/g, "").slice(0, 32);

    // 3. Save conversation (only for NEW conversations — this adds it to the MiMo chat list)
    if (isNewConversation) {
      try {
        await saveConversation(creds, conversationId, customHeaders);
      } catch (err) {
        log?.warn?.(
          "MIMOWEB",
          `saveConversation failed (best-effort): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 4. Prepare messages with tool support (OmniRoute native webTools.ts)
    const messages = (bodyObj.messages as OpenAIMessage[]) || [];
    const { hasTools, requestedTools, effectiveMessages } = prepareToolMessages(bodyObj, messages);
    const query = buildMimoQuery(effectiveMessages as OpenAIMessage[]);

    // 5. Resolve think mode
    const thinkMode = resolveThinkMode({
      headers: input.clientHeaders as Record<string, unknown>,
      body: bodyObj,
      providerSpecificData: credentials?.providerSpecificData as Record<string, unknown> | null,
    });

    // 6. Thinking mode
    // Follows the reference implementation: enableThinking is controlled by
    // the client via reasoning_effort. If the client sends reasoning_effort
    // (and it's not "none"), thinking is enabled. Otherwise disabled.
    // Note: even with enableThinking=false, MiMo may still produce <think> tags.
    // The thinkModeProcessor (separate/strip/passthrough) controls the
    // response-side handling, independent of this request-side flag.
    const model = (bodyObj.model as string) || "mimo-v2.5";
    const reasoningEffort = bodyObj.reasoning_effort;
    const enableThinking = !!reasoningEffort && reasoningEffort !== "none";
    const temperature = typeof bodyObj.temperature === "number" ? bodyObj.temperature : 0.8;

    // 6b. Upload images (multiMedias) if present
    // Only for vision-capable models (mimo-v2.5, mimo-v2-omni; mimo-v2.5-pro does NOT support vision)
    const visionCapableModels = [
      "mimo-v2.5",
      "mimo-v2-omni",
      "mimo-v2.1-omni",
      "mimo-v2.1-omni-preview",
      "clawm-alpha",
    ];
    const isVisionModel = visionCapableModels.includes(model);
    let multiMedias: MimoMedia[] = [];
    if (isVisionModel) {
      const imageUrls = extractImageUrlsFromMessages(messages);
      if (imageUrls.length > 0) {
        log?.debug?.("MIMOWEB", `Uploading ${imageUrls.length} images to MiMo CDN`);
        const uploadResults = await Promise.all(
          imageUrls.map((img) => uploadImageToMimo(creds, img.url, img.name, customHeaders))
        );
        multiMedias = uploadResults.filter((m): m is MimoMedia => m !== null);
        if (multiMedias.length > 0) {
          log?.debug?.(
            "MIMOWEB",
            `Uploaded ${multiMedias.length}/${imageUrls.length} images successfully`
          );
        }
      }
    }

    const requestBody = {
      msgId,
      conversationId,
      query,
      isEditedQuery: false,
      modelConfig: { enableThinking, webSearchStatus: "disabled", model, temperature, topP: 0.95 },
      multiMedias,
    };

    const url = buildUrl(CHAT_PATH, creds.phToken);
    const headers = buildHeaders(creds, customHeaders);

    // 7. Send chat request
    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (err) {
      return makeErrorResult(
        502,
        `MiMo fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
        body,
        url
      );
    }

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      const hint =
        upstream.status === 401
          ? " (cookies may have expired - re-extract from aistudio.xiaomimimo.com)"
          : "";
      return makeErrorResult(
        upstream.status,
        `MiMo upstream error: ${sanitizeErrorMessage(errText)}${hint}`,
        body,
        url
      );
    }

    // 8. Process response
    const id = `chatcmpl-mimo-${Date.now().toString(36)}`;
    const created = Math.floor(Date.now() / 1000);
    const sourceStream = upstream.body ?? new ReadableStream({ start: (c) => c.close() });

    const persistSession =
      (credentials?.providerSpecificData as { persistSession?: boolean } | undefined)
        ?.persistSession === true;
    // Aligned with DeepSeek-web standard (#2942):
    //   - persistSession=false (default): delete chat after response (legacy fresh-session behavior)
    //   - persistSession=true: keep chat on platform for reuse (rolling-window memory)
    // This applies regardless of agentChatId presence — agent chats are also deleted
    // unless persistSession is explicitly set. The registry still maps agentChatId →
    // conversationId so that if persistSession=true is set later, multi-turn reuse works.
    const shouldDeleteAfter = !persistSession;
    const shouldGenTitle = isNewConversation;

    const doCleanup = async (assistantContent: string) => {
      try {
        // Generate a proper title for new conversations (best-effort, non-blocking)
        if (shouldGenTitle && assistantContent) {
          await generateConversationTitle(
            creds,
            conversationId,
            query.slice(0, 500),
            assistantContent.slice(0, 500),
            customHeaders
          );
        }
        if (shouldDeleteAfter) await deleteConversation(creds, conversationId);
      } catch {
        /* best-effort */
      }
    };

    if (wantStream) {
      // Tool mode: buffer full response, then emit as synthetic SSE
      if (hasTools) {
        let totalContent = "";
        let totalReasoning = "";
        let buffer = "";
        let currentEvent = "";
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
              if (trimmed.startsWith("event:")) {
                currentEvent = trimmed.slice(6).trim();
              } else if (trimmed.startsWith("data:")) {
                const dataStr = trimmed.slice(5).trim();
                if (!dataStr || dataStr === "[DONE]") continue;
                try {
                  const data = JSON.parse(dataStr) as Record<string, unknown>;
                  if (
                    (currentEvent === "message" || currentEvent === "text") &&
                    typeof data.content === "string"
                  ) {
                    totalContent += (data.content as string).replace(/\u0000/g, "");
                  }
                } catch {
                  continue;
                }
              }
            }
          }
        } catch {
          /* best-effort */
        }

        const { content: cleanedContent, reasoning } = applyThinkMode(totalContent, thinkMode);
        const finalContent = stripCitations(cleanedContent);

        const message: Record<string, unknown> = { role: "assistant", content: finalContent };
        if (reasoning) message.reasoning_content = reasoning;

        const completion = {
          id,
          object: "chat.completion",
          created,
          model,
          choices: [{ index: 0, message, finish_reason: "stop" }],
        };
        const bufferedResponse = new Response(JSON.stringify(completion), {
          headers: { "Content-Type": "application/json" },
        });
        const toolResponse = await buildToolModeResponse(bufferedResponse, requestedTools, true, {
          cid: id,
          created,
          model,
          idSeed: "mimo",
        });

        // Await genTitle for new conversations so the title is set before returning
        await doCleanup(finalContent.slice(0, 500)).catch(() => {});
        return { response: toolResponse, url, headers, transformedBody: requestBody };
      }

      // Normal streaming (no tools): live stream with thinkModeProcessor
      const outStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const emit = (
            delta: Record<string, unknown>,
            finish: string | null = null,
            usage?: Record<string, number>
          ) => {
            const chunk: Record<string, unknown> = {
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta, finish_reason: finish }],
            };
            if (usage) chunk.usage = usage;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          };
          // Terminal usage chunk (OmniRoute standard: empty choices array + usage before [DONE])
          const emitUsage = (usage: Record<string, unknown>) => {
            const chunk = {
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [] as unknown[],
              usage,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          };

          emit({ role: "assistant", content: "" });

          let totalContent = "";
          let usage: MimoUsage | null = null;
          const thinkCtx = createThinkStreamContext(thinkMode);
          const citationBuf = { value: "" };
          let buffer = "";
          let currentEvent = "";
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
                if (trimmed.startsWith("event:")) {
                  currentEvent = trimmed.slice(6).trim();
                } else if (trimmed.startsWith("data:")) {
                  const dataStr = trimmed.slice(5).trim();
                  if (!dataStr || dataStr === "[DONE]") continue;
                  let data: Record<string, unknown>;
                  try {
                    data = JSON.parse(dataStr);
                  } catch {
                    continue;
                  }

                  if (
                    (currentEvent === "message" || currentEvent === "text") &&
                    typeof data.content === "string"
                  ) {
                    const newText = (data.content as string).replace(/\u0000/g, "");
                    totalContent += newText;
                    const { contentDelta, reasoningDelta } = processThinkStreamDelta(
                      newText,
                      thinkCtx
                    );
                    if (reasoningDelta) {
                      const cleaned = stripCitationsWithBuffer(reasoningDelta, citationBuf);
                      if (cleaned) emit({ reasoning_content: cleaned });
                    }
                    if (contentDelta) {
                      const cleaned = stripCitationsWithBuffer(contentDelta, citationBuf);
                      if (cleaned) emit({ content: cleaned });
                    }
                  } else if (currentEvent === "usage") {
                    // MiMo sends usage fields directly on the data object, not nested under data.usage
                    usage = data as unknown as MimoUsage;
                  }
                }
              }
            }

            // Flush remaining think content
            const flushed = flushThinkStream(thinkCtx);
            if (flushed.reasoningDelta) {
              const cleaned = stripCitationsWithBuffer(flushed.reasoningDelta, citationBuf);
              if (cleaned) emit({ reasoning_content: cleaned });
            }
            if (flushed.contentDelta) {
              const cleaned = stripCitationsWithBuffer(flushed.contentDelta, citationBuf);
              if (cleaned) emit({ content: cleaned });
            }

            emit({}, "stop");
            if (usage) {
              const openaiUsage = mimoUsageToOpenAI(usage);
              if (openaiUsage) emitUsage(openaiUsage);
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));

            // Run genTitle (best-effort) BEFORE closing the stream so the title
            // is set even in short-lived test processes. The [DONE] marker is
            // already sent above, so SSE clients know the content is complete;
            // controller.close() just releases the stream resources.
            const { content: cleanContent } = applyThinkMode(totalContent, thinkMode);
            try {
              await doCleanup(stripCitations(cleanContent).slice(0, 500));
            } catch {
              /* best-effort */
            }

            controller.close();
          } catch (err) {
            if (!signal?.aborted) {
              try {
                controller.error(err);
              } catch {
                /* closed */
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
        url,
        headers,
        transformedBody: requestBody,
      };
    }

    // Non-streaming: collect full response
    let totalContent = "";
    let usage: MimoUsage | null = null;
    let currentEvent = "";
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
          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }
            if (
              (currentEvent === "message" || currentEvent === "text") &&
              typeof data.content === "string"
            ) {
              totalContent += (data.content as string).replace(/\u0000/g, "");
            } else if (currentEvent === "usage") {
              usage = data as unknown as MimoUsage;
            }
          }
        }
      }
    } catch {
      /* best-effort */
    }

    // Apply think mode
    const { content: contentAfterThink, reasoning } = applyThinkMode(totalContent, thinkMode);
    const finalContent = stripCitations(contentAfterThink);
    const finalThinking = reasoning ? stripCitations(reasoning) : null;

    // Parse tool calls using OmniRoute native webTools.ts
    let toolCalls: ReturnType<typeof buildToolAwareResult>["toolCalls"] = null;
    let finishReason = "stop";
    if (hasTools) {
      const result = buildToolAwareResult(finalContent, requestedTools, "mimo");
      toolCalls = result.toolCalls;
      finishReason = result.finishReason;
    }

    const message: Record<string, unknown> = {
      role: "assistant",
      content: toolCalls ? null : finalContent,
    };
    if (finalThinking) message.reasoning_content = finalThinking;
    if (toolCalls) message.tool_calls = toolCalls;

    const completion = {
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message, finish_reason: finishReason }],
      ...(usage ? { usage: mimoUsageToOpenAI(usage) } : {}),
    };

    // For non-streaming: await genTitle so the conversation gets a proper title
    // before we return (matches reference impl). Best-effort — errors are caught.
    await doCleanup(finalContent.slice(0, 500)).catch(() => {});
    log?.debug?.(
      "MIMOWEB",
      `completed conversationId=${conversationId} contentLen=${finalContent.length}`
    );

    return {
      response: new Response(JSON.stringify(completion), {
        headers: { "Content-Type": "application/json" },
      }),
      url,
      headers,
      transformedBody: requestBody,
    };
  }
}

export default XiaomimimoWebExecutor;
