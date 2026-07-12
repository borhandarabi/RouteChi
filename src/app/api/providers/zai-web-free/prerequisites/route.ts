import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@omniroute/open-sse/utils/logger.ts";
import {
  initDeviceTokenPool,
  getPoolSize,
} from "@omniroute/open-sse/executors/zai-web-free/device-token-pool.ts";

const log = logger("ZAI-WEB-FREE-ADMIN");

/**
 * GET /api/providers/zai-web-free/prerequisites
 *
 * Checks whether Playwright + Chromium are installed and whether the device
 * token pool has tokens. Used by the ZaiPrerequisiteBanner component to
 * show warnings before the user enables zai-web-free or adds a zai-web-token
 * connection.
 *
 * The Playwright/Chromium check is EXPENSIVE (it launches a headless browser,
 * ~3-5s). We cache the result for 60s to avoid re-launching on every page load
 * or React re-render. The pool size is always read fresh (cheap SQLite query).
 *
 * Returns:
 *   200: {
 *     playwrightInstalled: boolean,
 *     chromiumInstalled: boolean,
 *     poolSize: number,
 *     cached: boolean,           // true if Playwright result came from cache
 *     cacheAge: number,          // age of cache in ms (0 if fresh)
 *   }
 */
const PLAYWRIGHT_CHECK_TTL_MS = 60_000; // 60 seconds
let _cachedPlaywrightCheck: {
  playwrightInstalled: boolean;
  chromiumInstalled: boolean;
  checkedAt: number;
} | null = null;

async function checkPlaywrightInstalled(): Promise<{
  playwrightInstalled: boolean;
  chromiumInstalled: boolean;
}> {
  // Return cached result if fresh
  if (_cachedPlaywrightCheck) {
    const age = Date.now() - _cachedPlaywrightCheck.checkedAt;
    if (age < PLAYWRIGHT_CHECK_TTL_MS) {
      return {
        playwrightInstalled: _cachedPlaywrightCheck.playwrightInstalled,
        chromiumInstalled: _cachedPlaywrightCheck.chromiumInstalled,
      };
    }
  }

  let playwrightInstalled = false;
  let chromiumInstalled = false;

  try {
    // Try to import playwright - if it fails, it's not installed
    const pw = await import("playwright");
    playwrightInstalled = true;

    // Check if Chromium is installed by trying to launch headless.
    // This is the slow part (~3-5s), so we cache it.
    try {
      const browser = await pw.chromium.launch({ headless: true });
      await browser.close();
      chromiumInstalled = true;
    } catch {
      chromiumInstalled = false;
    }
  } catch {
    playwrightInstalled = false;
    chromiumInstalled = false;
  }

  // Update cache
  _cachedPlaywrightCheck = {
    playwrightInstalled,
    chromiumInstalled,
    checkedAt: Date.now(),
  };

  return { playwrightInstalled, chromiumInstalled };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const dataDir =
    process.env.OMNIROUTE_DATA_DIR ||
    (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
  initDeviceTokenPool(`${dataDir}/omniroute.db`);

  // Check Playwright (cached)
  const { playwrightInstalled, chromiumInstalled } = await checkPlaywrightInstalled();
  const cached = _cachedPlaywrightCheck
    ? Date.now() - _cachedPlaywrightCheck.checkedAt < PLAYWRIGHT_CHECK_TTL_MS
    : false;
  const cacheAge = _cachedPlaywrightCheck
    ? Date.now() - _cachedPlaywrightCheck.checkedAt
    : 0;

  // Pool size is always fresh (cheap SQLite query)
  const poolSize = getPoolSize();

  log.info?.("prerequisites.check", {
    playwrightInstalled,
    chromiumInstalled,
    poolSize,
    cached,
    cacheAge,
  });

  return NextResponse.json({
    playwrightInstalled,
    chromiumInstalled,
    poolSize,
    cached,
    cacheAge,
  });
}
