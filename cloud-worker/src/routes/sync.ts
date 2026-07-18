/**
 * POST /sync/:machineId — Store a sync bundle from a local RouteChi instance.
 * DELETE /sync/:machineId — Delete a sync bundle.
 *
 * Security: the first sync for a machineId is allowed without auth
 * (bootstrap). Subsequent syncs must include a Bearer token that
 * matches one of the API keys in the stored bundle. This prevents
 * unauthorized overwrites.
 *
 * If the bundle has no apiKeys yet (first enable), the request is
 * accepted and the apiKeys from the new bundle become the valid tokens
 * for future requests.
 */

import type { Env, SyncBundle, SyncResponse } from "../types.ts";
import { storeBundle, getBundle, deleteBundle } from "../lib/storage.ts";
import { signResponse } from "../lib/hmac.ts";

export async function handleSync(
  request: Request,
  env: Env,
  machineId: string
): Promise<Response> {
  if (request.method === "POST") {
    return handleSyncPost(request, env, machineId);
  } else if (request.method === "DELETE") {
    return handleSyncDelete(request, env, machineId);
  }
  return jsonError(405, "Method not allowed");
}

async function handleSyncPost(
  request: Request,
  env: Env,
  machineId: string
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  // Extract bundle fields from the legacy payload format
  const version = typeof body.version === "string" ? body.version : "";
  const providers = Array.isArray(body.providers) ? body.providers : [];
  const apiKeys = Array.isArray(body.apiKeys) ? body.apiKeys : [];
  const combos = Array.isArray(body.combos) ? body.combos : [];
  const settings = (body.settings && typeof body.settings === "object")
    ? body.settings as Record<string, unknown>
    : {};
  const modelAliases = (body.modelAliases && typeof body.modelAliases === "object")
    ? body.modelAliases as Record<string, unknown>
    : {};
  const providerNodes = Array.isArray(body.providerNodes) ? body.providerNodes : [];

  // ── Security: verify Bearer token ──
  // On first sync (no stored bundle), accept without auth (bootstrap).
  // On subsequent syncs, verify the Bearer token against stored apiKeys.
  const existingBundle = await getBundle(env, machineId);
  if (existingBundle && existingBundle.apiKeys && existingBundle.apiKeys.length > 0) {
    const authHeader = request.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    if (!bearerToken) {
      return jsonError(401, "Authorization required: Bearer token missing");
    }
    const valid = existingBundle.apiKeys.some(
      (k) => k.key === bearerToken && k.isActive !== false
    );
    if (!valid) {
      return jsonError(401, "Authorization failed: invalid API key");
    }
  }

  // Build and store the bundle
  const bundle: SyncBundle = {
    version,
    providers,
    apiKeys,
    combos,
    settings,
    modelAliases,
    providerNodes,
  };

  await storeBundle(env, machineId, bundle);

  // Build response — matches the format expected by cloudSync.ts
  const responseData: SyncResponse = {
    success: true,
    message: "Synced successfully",
    version,
    changes: {
      providers: providers.length,
      apiKeys: apiKeys.length,
      combos: combos.length,
    },
    data: {
      providers,
    },
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

async function handleSyncDelete(
  request: Request,
  env: Env,
  machineId: string
): Promise<Response> {
  // Verify Bearer token before allowing deletion
  const existingBundle = await getBundle(env, machineId);
  if (existingBundle && existingBundle.apiKeys && existingBundle.apiKeys.length > 0) {
    const authHeader = request.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    if (!bearerToken) {
      return jsonError(401, "Authorization required");
    }
    const valid = existingBundle.apiKeys.some(
      (k) => k.key === bearerToken && k.isActive !== false
    );
    if (!valid) {
      return jsonError(401, "Authorization failed");
    }
  }

  await deleteBundle(env, machineId);

  const responseData = { success: true, message: "Deleted successfully" };
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
