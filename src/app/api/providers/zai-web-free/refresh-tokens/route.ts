import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@omniroute/open-sse/utils/logger.ts";
import { refreshDeviceTokens } from "@omniroute/open-sse/executors/zai-web-free/token-collector.ts";
import {
  addDeviceTokens,
  getPoolSize,
  initDeviceTokenPool,
} from "@omniroute/open-sse/executors/zai-web-free/device-token-pool.ts";
import { resolveProxyForScopeFromRegistry } from "@/lib/localDb";

const log = logger("ZAI-WEB-FREE-ADMIN");

/**
 * Convert an OmniRoute proxy config object to a URL string that Playwright
 * can consume. Supports HTTP, HTTPS, and SOCKS5 proxies with optional auth.
 *
 * The proxy config shape (from `resolveProxyForScopeFromRegistry`):
 *   { type: "socks5"|"http"|"https", host, port, username?, password?, family? }
 *
 * Returns a URL like:
 *   - `socks5://user:pass@host:port`
 *   - `http://host:port`
 *   - `https://user:pass@host:port`
 */
function proxyConfigToUrl(proxy: {
  type?: string;
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
} | null | undefined): string | undefined {
  if (!proxy || !proxy.host || !proxy.port) return undefined;

  const type = (proxy.type || "http").toLowerCase();
  // Playwright/Chromium accepts: http, https, socks5, socks4
  let protocol = type;
  if (type === "socks5" || type === "socks5h") protocol = "socks5";
  else if (type === "socks4" || type === "socks4a") protocol = "socks4";
  else if (type === "http" || type === "https") protocol = type;
  else protocol = "http"; // fallback

  let url = `${protocol}://`;
  if (proxy.username) {
    const user = encodeURIComponent(proxy.username);
    if (proxy.password) {
      url += `${user}:${encodeURIComponent(proxy.password)}@`;
    } else {
      url += `${user}@`;
    }
  }
  url += `${proxy.host}:${proxy.port}`;
  return url;
}

/**
 * POST /api/providers/zai-web-free/refresh-tokens
 *
 * Triggers a Playwright-based device-token collection run for the Z.AI free
 * web bridge. Visits chat.z.ai in a headless Chromium browser, extracts
 * `window.z_um.getToken()` values, and inserts them into the device-token
 * pool (SQLite table `zai_web_free_device_tokens`).
 *
 * The Playwright browser automatically uses OmniRoute's configured proxy:
 *   1. First tries the global proxy (from Proxies ?�� Global in the dashboard)
 *   2. If no global proxy is configured, uses a direct connection
 *
 * This matches the proxy behavior of the executor's fetch calls (which use
 * OmniRoute's patched globalThis.fetch). The same proxy that handles Z.AI
 * chat requests also handles the Playwright token collection.
 *
 * Body (all optional):
 *   {
 *     "tokens": 750,     // tokens per batch (default 750, max 1250 or 1500 if unsafe)
 *     "batches": 3,      // number of batches (default 3, max 9 or 25 if unsafe)
 *     "parallel": 1,     // parallel browser pages (default 1, max 3 or 5 if unsafe)
 *     "headed": false,   // show browser window (default false)
 *     "unsafe": false    // raise limits to 1500/25/5 (default false, use with caution)
 *   }
 *
 * Returns:
 *   200: { success: true, collected: <n>, poolSize: <n>, limits: {...}, proxyUsed: <url|null> }
 *   500: { error: "Playwright collection failed: <message>" }
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: {
    tokens?: number;
    batches?: number;
    parallel?: number;
    headed?: boolean;
    unsafe?: boolean;
  } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // empty body is fine ?�� use defaults
  }

  // Initialize the pool with the OmniRoute database path
  const dataDir =
    process.env.OMNIROUTE_DATA_DIR ||
    (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
  initDeviceTokenPool(`${dataDir}/omniroute.db`);

  // Resolve the global proxy from OmniRoute's proxy registry.
  // zai-web-free is a noauth provider (no connection DB row), so we use
  // the global scope. The same proxy that handles the executor's fetch
  // calls (via OmniRoute's patched globalThis.fetch) is passed to
  // Playwright so the browser also routes through it.
  let proxyUrl: string | undefined;
  try {
    const globalProxy = await resolveProxyForScopeFromRegistry("global");
    proxyUrl = proxyConfigToUrl(
      (globalProxy as { proxy?: unknown } | null)?.proxy as {
        type?: string;
        host?: string;
        port?: number | string;
        username?: string;
        password?: string;
      } | null
    );
    if (proxyUrl) {
      log.info?.("proxy.resolved", { proxyUrl: proxyUrl.replace(/\/\/[^@]+@/, "//***:***@") });
    }
  } catch (err) {
    log.warn?.("proxy.resolve_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info?.("refresh.start", {
    tokens: body.tokens,
    batches: body.batches,
    parallel: body.parallel,
    headed: body.headed,
    unsafe: body.unsafe,
    proxy: proxyUrl ? "configured" : "direct",
  });

  try {
    const result = await refreshDeviceTokens({
      tokens: body.tokens,
      batches: body.batches,
      parallel: body.parallel,
      headed: body.headed,
      unsafe: body.unsafe,
      proxyUrl,
      addTokens: addDeviceTokens,
      getPoolSize,
    });

    log.info?.("refresh.complete", {
      collected: result.collected,
      poolSize: result.poolSize,
      unsafe: body.unsafe,
      limits: result.limits,
      proxy: proxyUrl ? "configured" : "direct",
    });

    return NextResponse.json({
      success: true,
      collected: result.collected,
      poolSize: result.poolSize,
      limits: result.limits,
      proxyUsed: proxyUrl ? "global" : "direct",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error?.("refresh.failed", { error: message });
    return NextResponse.json(
      { error: `Playwright collection failed: ${message}` },
      { status: 500 }
    );
  }
}
