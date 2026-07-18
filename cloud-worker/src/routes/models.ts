/**
 * GET /:machineId/v1/models — List available models from the synced bundle.
 *
 * Returns an OpenAI-compatible /v1/models response derived from the
 * bundle's provider defaultModels, model aliases, and combo names.
 */

import type { Env } from "../types.ts";
import { getBundle } from "../lib/storage.ts";
import { verifyApiKey, signResponse } from "../lib/hmac.ts";
import { buildModelsResponse } from "../lib/models.ts";

export async function handleModels(
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

  const modelsResponse = buildModelsResponse(bundle);
  const responseJson = JSON.stringify(modelsResponse);
  const sig = signResponse(env, responseJson);

  return new Response(responseJson, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...(sig ? { "X-Cloud-Sig": sig } : {}),
    },
  });
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
