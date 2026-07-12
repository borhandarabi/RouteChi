/**
 * Z.AI device-token collector ?�� Playwright-based token farm.
 *
 * Ported from GLM-Free-API's init.go. Visits https://chat.z.ai in a headless
 * Chromium browser, fills the chat input with a placeholder, waits for the
 * token endpoint to initialize, then extracts `window.z_um.getToken()` values.
 *
 * `playwright` is imported dynamically so it doesn't add to server startup
 * time ?�� only loaded when the refresh endpoint is actually called.
 *
 * @module zai-web-free/token-collector
 */

const ZAI_URL = "https://chat.z.ai";

// Normal mode limits (matching GLM-Free-API init.go)
const MAX_TOKENS = 1250;
const UNSAFE_MAX_TOKENS = 1500;
const DEFAULT_TOKENS = 750;
const DEFAULT_BATCH = 3;
const MAX_BATCH = 9;
const UNSAFE_MAX_BATCH = 25;
const SEND_WAIT_MS = 7000;
const MAX_RETRIES = 3;
const TOKEN_COLLECTION_TIMEOUT_MS = 90_000;
const MAX_PARALLEL = 3;
const UNSAFE_MAX_PARALLEL = 5;

/** Resolved limits based on the `unsafe` flag. */
interface CollectionLimits {
  maxTokens: number;
  maxBatch: number;
  maxParallel: number;
}

function resolveLimits(unsafe: boolean): CollectionLimits {
  return unsafe
    ? { maxTokens: UNSAFE_MAX_TOKENS, maxBatch: UNSAFE_MAX_BATCH, maxParallel: UNSAFE_MAX_PARALLEL }
    : { maxTokens: MAX_TOKENS, maxBatch: MAX_BATCH, maxParallel: MAX_PARALLEL };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PlaywrightPage = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  locator(selector: string): {
    waitFor(options?: Record<string, unknown>): Promise<void>;
    fill(value: string): Promise<void>;
    click(options?: Record<string, unknown>): Promise<void>;
  };
  evaluate<T>(fn: (args: unknown) => T | Promise<T>, arg?: unknown): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
};
type PlaywrightBrowser = {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
};

/**
 * Collect `total` device tokens from a single browser page.
 */
async function collectTokensOnPage(page: PlaywrightPage, total: number): Promise<string[]> {
  await page.goto(ZAI_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for both UI elements in parallel
  const results = await Promise.allSettled([
    page.locator("#model-selector-glm-4_7-button").waitFor({ timeout: 15000 }),
    page.locator("#chat-input").waitFor({ timeout: 15000 }),
  ]);
  if (results[0].status === "rejected") {
    throw new Error(`model button not found: ${results[0].reason?.message || results[0].reason}`);
  }
  if (results[1].status === "rejected") {
    throw new Error(`textarea not found: ${results[1].reason?.message || results[1].reason}`);
  }

  const textarea = page.locator("#chat-input");
  await textarea.fill("__");

  const sendBtn = page.locator("#send-message-button");
  await sendBtn.waitFor({ timeout: 5000 });
  await sendBtn.click();

  await sleep(SEND_WAIT_MS);

  const collectPromise = page.evaluate(
    async (args: { total: number }) => {
      const total = args.total;
      const out = new Array(total);
      for (let i = 0; i < total; i++) {
        const tok = (window as unknown as { z_um: { getToken: () => unknown } }).z_um.getToken();
        out[i] = tok && typeof tok.then === "function" ? await tok : tok;
        if (i % 50 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      return out;
    },
    { total }
  );

  const tokens = await Promise.race([
    collectPromise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`token collection timed out after ${TOKEN_COLLECTION_TIMEOUT_MS / 1000}s`)
          ),
        TOKEN_COLLECTION_TIMEOUT_MS
      )
    ),
  ]);

  return (tokens || []).filter((t: unknown) => typeof t === "string" && (t as string).length > 0);
}

async function runBatch(
  browser: PlaywrightBrowser,
  total: number,
  batchNum: number
): Promise<string[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const page = await browser.newPage();
    try {
      const tokens = await collectTokensOnPage(page, total);
      await page.close();
      return tokens;
    } catch (err) {
      lastErr = err;
      await page.close().catch(() => {});
    }
  }
  throw new Error(
    `batch ${batchNum} failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
  );
}

export interface RefreshOptions {
  tokens?: number;
  batches?: number;
  parallel?: number;
  headed?: boolean;
  /**
   * When true, raises limits to match GLM-Free-API's `--unsafe` flag:
   *   - Max tokens per batch: 1250 ?�� 1500
   *   - Max batches: 9 ?�� 25
   *   - Max parallel workers: 3 ?�� 5
   *
   * WARNING: unsafe mode collects up to 37,500 tokens in a single run (1500 ?� 25).
   * This increases the risk of Z.AI flagging the browser fingerprint as suspicious
   * and temporarily banning the IP. Only use when the pool is critically low and
   * you need a large replenishment in one shot.
   */
  unsafe?: boolean;
  /**
   * Optional proxy URL for the Playwright browser. Supports HTTP, HTTPS, and
   * SOCKS5 proxies. Format: `http://user:pass@host:port` or `socks5://host:port`.
   * When set, the browser routes all traffic (chat.z.ai page load + token
   * extraction) through this proxy. This is separate from OmniRoute's
   * per-connection proxy (which covers the executor's fetch calls) ?�� Playwright
   * has its own network stack and needs an explicit `--proxy-server` flag.
   */
  proxyUrl?: string;
  addTokens: (tokens: string[]) => void;
  getPoolSize: () => number;
}

export interface RefreshResult {
  collected: number;
  poolSize: number;
  /** The limits that were actually applied (reflects the `unsafe` flag). */
  limits: CollectionLimits;
}

/**
 * Run a full device-token collection session.
 *
 * Dynamically imports `playwright` (so it's only loaded when needed), launches
 * Chromium, and collects tokens across N batches. Each batch opens a fresh
 * page, fills the chat input, waits for the token endpoint, and extracts
 * `window.z_um.getToken()` values.
 *
 * When `unsafe` is true, the per-batch/batch-count/parallel limits are raised
 * to match GLM-Free-API's `--unsafe` flag (1500 tokens, 25 batches, 5 parallel).
 *
 * @returns {Promise<RefreshResult>} The number of tokens collected, the
 *   resulting pool size, and the limits that were applied.
 */
export async function refreshDeviceTokens(options: RefreshOptions): Promise<RefreshResult> {
  const limits = resolveLimits(options.unsafe ?? false);
  const tokenCount = Math.min(options.tokens ?? DEFAULT_TOKENS, limits.maxTokens);
  const batchCount = Math.min(options.batches ?? DEFAULT_BATCH, limits.maxBatch);
  const parallel = Math.min(options.parallel ?? 1, limits.maxParallel);
  const headed = options.headed ?? false;
  const proxyUrl = options.proxyUrl;
  const addTokens = options.addTokens;
  const getPoolSize = options.getPoolSize;

  // Dynamic import ?�� playwright is a heavy dependency, only load when refreshing
  const { chromium } = await import("playwright");

  // Playwright has its own network stack (separate from Node's fetch), so the
  // patched globalThis.fetch proxy doesn't apply. Pass the proxy explicitly
  // to chromium.launch() when a proxyUrl is configured.
  const launchOptions: Record<string, unknown> = { headless: !headed };
  if (proxyUrl) {
    // Playwright accepts proxy config as { server, username?, password? }
    // Parse the URL to extract auth components if present.
    try {
      const parsed = new URL(proxyUrl);
      const proxyConfig: Record<string, string> = {
        server: `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "1080")}`,
      };
      if (parsed.username) proxyConfig.username = decodeURIComponent(parsed.username);
      if (parsed.password) proxyConfig.password = decodeURIComponent(parsed.password);
      launchOptions.proxy = proxyConfig;
    } catch {
      // If the URL is malformed, pass it as-is to Playwright's server field
      launchOptions.proxy = { server: proxyUrl };
    }
  }

  const browser = await chromium.launch(launchOptions as Parameters<typeof chromium.launch>[0]);
  try {
    const allTokens: string[] = [];

    if (parallel > 1 && batchCount > 1) {
      const batchQueue: number[] = [];
      for (let b = 1; b <= batchCount; b++) batchQueue.push(b);
      const workers: Promise<void>[] = [];
      for (let w = 0; w < parallel; w++) {
        workers.push(
          (async () => {
            while (batchQueue.length > 0) {
              const batchNum = batchQueue.shift();
              if (batchNum === undefined) break;
              const tokens = await runBatch(browser, tokenCount, batchNum);
              addTokens(tokens);
              allTokens.push(...tokens);
            }
          })()
        );
      }
      await Promise.all(workers);
    } else {
      for (let b = 1; b <= batchCount; b++) {
        const tokens = await runBatch(browser, tokenCount, b);
        addTokens(tokens);
        allTokens.push(...tokens);
      }
    }

    return { collected: allTokens.length, poolSize: getPoolSize(), limits };
  } finally {
    await browser.close();
  }
}
