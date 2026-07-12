/**
 * Z.AI request signature ?�� ported from GLM-Free-API (Go) `generateZaSignature`.
 *
 * Also matches the signature logic in
 * Chat2API-web/backend/proxy/adapters/zai.ts ?�� the algorithm is the same.
 *
 * The signature is an HMAC-SHA256 over a canonical string built from the
 * request id, timestamp, user id, and base64-encoded prompt. The signing key
 * is derived from `SALT_KEY` and a 5-minute time bucket (`timestamp / 300000`),
 * so signatures from the same bucket share the same key.
 *
 * @module zai-web-free/signature
 */

import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

export const SALT_KEY = "key-@@@@)))()((9))-xxxx&&&%%%%%";

export interface ZaSignatureResult {
  signature: string;
  timestamp: string;
  requestId: string;
  urlParams: string;
}

/**
 * Generate the X-Signature header value + URL query params for a Z.AI chat
 * request.
 *
 * @param prompt  The user's prompt text (will be base64-encoded into the
 *                signed payload).
 * @param token   The Z.AI session JWT (used in URL params, NOT in the signed
 *                payload itself).
 * @param userId  The user id decoded from the JWT.
 */
export function generateZaSignature(prompt: string, token: string, userId: string): ZaSignatureResult {
  const tsMs = Date.now();
  const timestamp = String(tsMs);
  const requestId = randomUUID();
  const bucket = Math.floor(tsMs / 300000); // 5-minute window

  // Layer 1: derive a per-bucket signing key from SALT_KEY
  const wKey = createHmac("sha256", Buffer.from(SALT_KEY, "utf-8"))
    .update(Buffer.from(String(bucket), "utf-8"))
    .digest("hex");

  // Layer 2: build the canonical payload (sorted by key, "k,v" joined with ",")
  // Go sorts by key name; the keys are requestId, timestamp, user_id.
  const payloadDict: Array<{ k: string; v: string }> = [
    { k: "requestId", v: requestId },
    { k: "timestamp", v: timestamp },
    { k: "user_id", v: userId },
  ].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));

  const sortedPayload = payloadDict.map((p) => `${p.k},${p.v}`).join(",");

  const promptB64 = Buffer.from(prompt.trim(), "utf-8").toString("base64");
  const dataToSign = `${sortedPayload}|${promptB64}|${timestamp}`;

  const signature = createHmac("sha256", Buffer.from(wKey, "utf-8"))
    .update(Buffer.from(dataToSign, "utf-8"))
    .digest("hex");

  // URL params (sent as query string on the /api/v2/chat/completions request)
  const urlParams = new URLSearchParams({
    timestamp,
    requestId,
    user_id: userId,
    version: "0.0.1",
    platform: "web",
    token,
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    language: "en-US",
    screen_resolution: "1920x1080",
    viewport_size: "1920x1080",
    timezone: "Europe/Paris",
    timezone_offset: "-60",
    signature_timestamp: timestamp,
  }).toString();

  return { signature, timestamp, requestId, urlParams };
}
