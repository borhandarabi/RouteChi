/**
 * Z.AI guest session initialization ?�� ported from GLM-Free-API (Go).
 *
 * On startup (or when no `ZAI_TOKEN` is configured), the executor calls
 * Z.AI's `/api/v1/auths/guest` endpoint to obtain a guest JWT. The JWT
 * contains a user id that the signature module needs, and is sent as the
 * `Authorization: Bearer <jwt>` header on every subsequent chat request.
 *
 * When a `ZAI_TOKEN` is provided (either via env var or
 * `providerSpecificData.token`), guest init is skipped and the provided JWT
 * is used directly. This unlocks all models (guest sessions typically only
 * permit `glm-4.7`).
 *
 * The `feVersion` (`prod-fe-x.y.z`) is scraped from the Z.AI homepage HTML
 * and sent as the `x-fe-Version` header ?�� without it, Z.AI rejects requests
 * with a 400.
 *
 * @module zai-web-free/session
 */

import { Buffer } from "node:buffer";

export const BASE_URL = "https://chat.z.ai";
export const DEFAULT_FE_VERSION = "prod-fe-1.1.75";
const FE_VERSION_REGEX = /prod-fe-\d+\.\d+\.\d+/;

export interface ZaiSession {
  token: string;
  userId: string;
  userName: string;
  feVersion: string;
  initialized: boolean;
  /** Optional user-supplied JWT (skips guest init when set). */
  hardcodedToken?: string;
}

/**
 * Decode a Z.AI JWT to extract the user id and a display name.
 * Returns `["", "Guest"]` if the token is malformed.
 */
export function decodeJwt(token: string): { id: string; name: string } {
  const parts = token.split(".");
  if (parts.length < 2) return { id: "", name: "Guest" };
  let decoded: Buffer;
  try {
    // JWT uses base64url (no padding)
    decoded = Buffer.from(parts[1], "base64url");
  } catch {
    return { id: "", name: "Guest" };
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(decoded.toString("utf-8"));
  } catch {
    return { id: "", name: "Guest" };
  }
  const id = typeof data.id === "string" ? data.id : "";
  const email = typeof data.email === "string" ? data.email : "";
  let name = "Guest";
  if (email) {
    name = email.split("@")[0];
  }
  return { id, name };
}

/**
 * Scrape the `prod-fe-x.y.z` version string from the Z.AI homepage.
 * Falls back to `DEFAULT_FE_VERSION` if the scrape fails.
 */
export async function scrapeFeVersion(): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const resp = await fetch(BASE_URL, { signal: controller.signal });
      const html = await resp.text();
      const match = FE_VERSION_REGEX.exec(html);
      if (match) return match[0];
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_FE_VERSION;
}

/**
 * Initialize a guest session by calling Z.AI's auth endpoints.
 *
 * Flow (matches Go reference):
 *   1. Fire-and-forget `POST /api/v1/auths/guest` (initializes the guest row).
 *   2. `GET /api/v1/auths/` ?�� returns `{ token: "<jwt>" }`.
 *   3. If step 2 returns no token, retry step 1 synchronously and parse the
 *      response body for `token`.
 *
 * The session JWT is decoded to extract `userId` (needed for the signature)
 * and `userName` (display only).
 *
 * @param hardcodedToken  If set, skip guest init and use this JWT directly.
 */
export async function initializeSession(hardcodedToken?: string): Promise<ZaiSession> {
  if (hardcodedToken) {
    const { id, name } = decodeJwt(hardcodedToken);
    // Always scrape the latest fe-version — Z.AI rejects stale versions with 405
    let feVersion = DEFAULT_FE_VERSION;
    try {
      feVersion = await scrapeFeVersion();
    } catch {
      // fall back to default if scrape fails
    }
    return {
      token: hardcodedToken,
      userId: id,
      userName: name || "User",
      feVersion,
      initialized: true,
      hardcodedToken,
    };
  }

  const feVersion = await scrapeFeVersion();
  const headers: Record<string, string> = {
    Origin: BASE_URL,
    Referer: `${BASE_URL}/`,
    "Content-Type": "application/json",
  };

  // Step 1: fire-and-forget guest POST
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      await fetch(`${BASE_URL}/api/v1/auths/guest`, {
        method: "POST",
        headers,
        body: "{}",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // ignore ?�� step 2 will retry
  }

  // Step 2: GET /api/v1/auths/ ?�� this is where the token comes from
  let token = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const resp = await fetch(`${BASE_URL}/api/v1/auths/`, {
        headers,
        signal: controller.signal,
      });
      if (resp.ok) {
        const body = (await resp.json()) as { token?: string };
        token = body.token || "";
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // fall through to retry
  }

  // Step 3: if still no token, retry the guest POST synchronously
  if (!token) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const resp = await fetch(`${BASE_URL}/api/v1/auths/guest`, {
          method: "POST",
          headers,
          body: "{}",
          signal: controller.signal,
        });
        const body = (await resp.json()) as { token?: string };
        token = body.token || "";
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // give up
    }
  }

  if (!token) {
    throw new Error("Z.AI guest init failed: no token received");
  }

  const { id, name } = decodeJwt(token);
  return {
    token,
    userId: id,
    userName: name,
    feVersion,
    initialized: true,
  };
}

/**
 * Lazy-initialized session singleton. The executor calls `getSession()` on
 * every request; the first call triggers `initializeSession()`. Subsequent
 * calls return the cached session until `resetSession()` is called (e.g.
 * on a 401 from Z.AI).
 */
let _session: ZaiSession | null = null;
let _initPromise: Promise<ZaiSession> | null = null;
let _hardcodedToken: string | undefined;

export function setHardcodedToken(token: string | undefined): void {
  _hardcodedToken = token;
  // Reset the cached session so the next getSession() re-initializes
  _session = null;
  _initPromise = null;
}

export async function getSession(): Promise<ZaiSession> {
  if (_session?.initialized) return _session;
  if (_initPromise) return _initPromise;
  _initPromise = initializeSession(_hardcodedToken).then((s) => {
    _session = s;
    _initPromise = null;
    return s;
  });
  return _initPromise;
}

export function resetSession(): void {
  _session = null;
  _initPromise = null;
}
