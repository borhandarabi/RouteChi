/**
 * RouteChi Cloud Worker — main entry point.
 *
 * Routes:
 *   POST   /sync/:machineId                    → store sync bundle
 *   DELETE /sync/:machineId                    → delete sync bundle
 *   GET    /:machineId/v1/verify               → health check
 *   GET    /:machineId/v1/models               → list models
 *   POST   /:machineId/v1/chat/completions     → OpenAI-compatible proxy
 *   OPTIONS *                                  → CORS preflight
 */

import type { Env } from "./types.ts";
import { handleSync } from "./routes/sync.ts";
import { handleVerify } from "./routes/verify.ts";
import { handleModels } from "./routes/models.ts";
import { handleChat } from "./routes/chat.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── CORS preflight ──
    if (request.method === "OPTIONS") {
      return corsResponse();
    }

    // ── Route: /sync/:machineId ──
    const syncMatch = path.match(/^\/sync\/([a-f0-9]+)$/);
    if (syncMatch) {
      const machineId = syncMatch[1];
      return handleSync(request, env, machineId);
    }

    // ── Route: /:machineId/v1/verify ──
    const verifyMatch = path.match(/^\/([a-f0-9]+)\/v1\/verify$/);
    if (verifyMatch && request.method === "GET") {
      const machineId = verifyMatch[1];
      return handleVerify(request, env, machineId);
    }

    // ── Route: /:machineId/v1/models ──
    const modelsMatch = path.match(/^\/([a-f0-9]+)\/v1\/models$/);
    if (modelsMatch && request.method === "GET") {
      const machineId = modelsMatch[1];
      return handleModels(request, env, machineId);
    }

    // ── Route: /:machineId/v1/chat/completions ──
    const chatMatch = path.match(/^\/([a-f0-9]+)\/v1\/chat\/completions$/);
    if (chatMatch && request.method === "POST") {
      const machineId = chatMatch[1];
      return handleChat(request, env, machineId);
    }

    // ── Root health check ──
    if (path === "/" || path === "") {
      return new Response(
        JSON.stringify({
          service: "routechi-cloud",
          status: "ok",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 404 ──
    return new Response(
      JSON.stringify({ error: "Not found", path }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  },
};

/**
 * CORS response for preflight requests.
 */
function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Cloud-Sig",
      "Access-Control-Max-Age": "86400",
    },
  });
}
