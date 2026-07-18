/**
 * HMAC-SHA256 signing for Cloud Sync responses.
 *
 * The local RouteChi instance verifies `X-Cloud-Sig` on every response
 * using `crypto.timingSafeEqual`. If the secret is not set on either side,
 * signing is skipped (backward-compat until v3.9 enforcement).
 */

import type { Env } from "../types.ts";

/**
 * Sign a response body with HMAC-SHA256.
 * Returns the hex digest, or null if no secret is configured.
 */
export function signResponse(env: Env, body: string): string | null {
  if (!env.CLOUD_SYNC_SECRET) return null;
  return hmacSha256(env.CLOUD_SYNC_SECRET, body);
}

/**
 * Verify a Bearer token against the sync bundle's API keys.
 * Returns the matching API key record, or null if no match.
 */
export function verifyApiKey(
  bearerToken: string | null,
  bundle: { apiKeys?: Array<{ key: string; isActive?: boolean }> } | null
): boolean {
  if (!bearerToken || !bundle?.apiKeys) return false;
  // Extract token from "Bearer xxx" header
  const token = bearerToken.startsWith("Bearer ")
    ? bearerToken.slice(7).trim()
    : bearerToken.trim();
  if (!token) return false;
  return bundle.apiKeys.some(
    (k) => k.key === token && k.isActive !== false
  );
}

/**
 * Compute HMAC-SHA256 using Web Crypto API (available in Cloudflare Workers).
 */
async function hmacSha256(secret: string, message: string): Promise<string> {
  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bufferToHex(signature);
}

/**
 * Convert ArrayBuffer to hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
