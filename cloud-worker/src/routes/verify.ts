/**
 * GET /:machineId/v1/verify — Health check endpoint.
 *
 * Called by the local RouteChi instance after enabling cloud sync to
 * verify the worker has received the bundle and is ready to serve
 * requests. Requires a valid Bearer token (API key from the bundle).
 */

import type { Env } from "../types.ts";
import { getBundle } from "../lib/storage.ts";
import { verifyApiKey, signResponse } from "../lib/hmac.ts";

export async function handleVerify(
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

  const responseData = {
    success: true,
    machineId,
    version: bundle.version,
    providerCount: bundle.providers.length,
    apiKeyCount: bundle.apiKeys.length,
    syncedAt: bundle.syncedAt,
  };

  const responseJson = JSON.stringify(responseData);
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
