/**
 * POST /:machineId/v1/chat/completions — OpenAI-compatible chat proxy.
 *
 * Reads the synced bundle from KV, resolves which provider to use based
 * on the requested model, forwards the request to the upstream provider
 * with the stored credentials, and streams the response back.
 *
 * Supports both streaming (SSE) and non-streaming responses.
 * Signs every response with X-Cloud-Sig (HMAC-SHA256).
 */

import type { Env, SyncBundle } from "../types.ts";
import { getBundle } from "../lib/storage.ts";
import { verifyApiKey, signResponse } from "../lib/hmac.ts";
import { resolveProviderForModel } from "../lib/models.ts";

export async function handleChat(
  request: Request,
  env: Env,
  machineId: string
): Promise<Response> {
  const bundle = await getBundle(env, machineId);
  if (!bundle) {
    return jsonError(404, "Bundle not found — sync first");
  }

  // Verify Bearer token
  const authHeader = request.headers.get("Authorization");
  if (!verifyApiKey(authHeader, bundle)) {
    return jsonError(401, "Invalid API key");
  }

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const model = typeof body.model === "string" ? body.model : "";
  if (!model) {
    return jsonError(400, "Missing 'model' field");
  }

  const stream = body.stream === true;

  // Resolve which provider to use
  const provider = resolveProviderForModel(bundle, model);
  if (!provider) {
    return jsonError(503, "No active provider available");
  }

  // Build upstream URL and headers
  const upstream = buildUpstreamRequest(provider, body, stream);
  if (!upstream) {
    return jsonError(502, `Cannot build upstream request for provider: ${provider.provider}`);
  }

  // Forward to upstream
  try {
    const upstreamResponse = await fetch(upstream.url, {
      method: "POST",
      headers: upstream.headers,
      body: JSON.stringify(upstream.body),
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return jsonError(
        upstreamResponse.status,
        `Upstream error: ${errorText.slice(0, 500)}`
      );
    }

    // If streaming, pass through the SSE stream directly
    if (stream && upstreamResponse.body) {
      // For streaming responses, we can't sign the body (it's a stream).
      // The client verifies the connection is alive via SSE keep-alive.
      // Non-streaming responses are signed below.
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: read, sign, and return
    const responseText = await upstreamResponse.text();
    const sig = signResponse(env, responseText);

    return new Response(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...(sig ? { "X-Cloud-Sig": sig } : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(502, `Upstream fetch failed: ${message}`);
  }
}

/**
 * Build the upstream request URL, headers, and body for a given provider.
 */
function buildUpstreamRequest(
  provider: SyncBundle["providers"][0],
  body: Record<string, unknown>,
  stream: boolean
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null {
  const psd = provider.providerSpecificData || {};
  const baseUrl =
    (typeof psd.baseUrl === "string" && psd.baseUrl) ||
    (typeof psd.chatPath === "string" && psd.chatPath) ||
    getDefaultBaseUrl(provider.provider);
  if (!baseUrl) return null;

  // Normalize URL
  let url = baseUrl.replace(/\/+$/, "");
  const chatPath = typeof psd.chatPath === "string" && psd.chatPath
    ? psd.chatPath
    : "/v1/chat/completions";
  if (!url.endsWith(chatPath)) {
    url += chatPath.startsWith("/") ? chatPath : `/${chatPath}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Auth
  const apiKey = provider.apiKey;
  const accessToken = provider.accessToken;
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Provider-specific headers
  if (typeof psd.customHeaders === "object" && psd.customHeaders) {
    for (const [k, v] of Object.entries(psd.customHeaders)) {
      if (typeof v === "string") headers[k] = v;
    }
  }

  // Build body — ensure stream matches what the client requested
  const upstreamBody = { ...body, stream };

  return { url, headers, body: upstreamBody };
}

/**
 * Get default base URL for well-known providers.
 */
function getDefaultBaseUrl(provider: string): string | null {
  const defaults: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    groq: "https://api.groq.com/openai/v1",
    mistral: "https://api.mistral.ai/v1",
    together: "https://api.together.xyz/v1",
    deepseek: "https://api.deepseek.com/v1",
    "zai": "https://api.z.ai/api/v1",
    "kilo-free": "https://api.kilo.ai/api/openrouter",
  };
  return defaults[provider] || null;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
