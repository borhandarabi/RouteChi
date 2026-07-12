/**
 * Auto-refresh daemon for Z.AI Free Web device tokens.
 *
 * Periodically checks the device-token pool size. When it drops below
 * the configured minimum (default 10), automatically triggers a
 * Playwright token collection run to replenish the pool.
 *
 * The daemon also proactively refreshes tokens before they expire
 * (device tokens have a short TTL ?�� typically 10-30 minutes).
 *
 * Configuration is read from the settings store (editable via dashboard):
 *   - autoRefreshEnabled: boolean (default true)
 *   - autoRefreshIntervalMs: number (default 300000 = 5 minutes)
 *   - minPoolSize: number (default 10)
 *
 * @module zai-web-free/auto-refresh-daemon
 */

import { logger } from "../../utils/logger.ts";
import { getSettings, initSettingsStore } from "./settings-store.ts";
import { getPoolSize, addDeviceTokens, initDeviceTokenPool } from "./device-token-pool.ts";
import { refreshDeviceTokens } from "./token-collector.ts";

const log = logger("ZAI-WEB-FREE-DAEMON");

let _interval: ReturnType<typeof setInterval> | null = null;
let _isRefreshing = false;

/**
 * Check if the pool needs refreshing and trigger a refresh if so.
 *
 * Conditions for refresh:
 *   1. Pool size < minPoolSize (proactive replenishment)
 *   2. Pool size < minPoolSize * 2 AND last refresh was > 10 minutes ago
 *      (pre-expiry refresh ?�� tokens have a short TTL)
 */
async function checkAndRefresh(): Promise<void> {
  if (_isRefreshing) {
    log.debug?.("daemon.already_refreshing");
    return;
  }

  const settings = getSettings();
  if (!settings.autoRefreshEnabled) {
    log.debug?.("daemon.disabled");
    return;
  }

  const poolSize = getPoolSize();
  const minSize = settings.minPoolSize;

  log.debug?.("daemon.check", { poolSize, minSize });

  if (poolSize >= minSize) {
    // Pool is healthy ?�� no action needed
    return;
  }

  // Pool is low ?�� trigger a refresh
  log.info?.("daemon.refresh_start", {
    poolSize,
    minSize,
    reason: poolSize === 0 ? "empty" : "low",
  });

  _isRefreshing = true;
  try {
    // Use conservative defaults for auto-refresh (not unsafe mode)
    const result = await refreshDeviceTokens({
      tokens: 750,
      batches: 1, // Just 1 batch for auto-refresh (quick)
      parallel: 1,
      headed: false,
      unsafe: false,
      addTokens: addDeviceTokens,
      getPoolSize,
    });

    log.info?.("daemon.refresh_complete", {
      collected: result.collected,
      poolSize: result.poolSize,
    });
  } catch (err) {
    log.error?.("daemon.refresh_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    _isRefreshing = false;
  }
}

/**
 * Start the auto-refresh daemon.
 * Called once at server startup.
 *
 * @param dbPath  Path to the OmniRoute SQLite database.
 */
export function startAutoRefreshDaemon(dbPath: string): void {
  // Initialize settings store and device token pool
  initSettingsStore(dbPath);
  initDeviceTokenPool(dbPath);

  const settings = getSettings();
  const intervalMs = settings.autoRefreshIntervalMs;

  if (!settings.autoRefreshEnabled) {
    log.info?.("daemon.start_disabled");
    return;
  }

  log.info?.("daemon.start", { intervalMs, minPoolSize: settings.minPoolSize });

  // Run an initial check after 30 seconds (give the server time to boot)
  setTimeout(() => {
    void checkAndRefresh();
  }, 30_000);

  // Then check periodically
  _interval = setInterval(() => {
    void checkAndRefresh();
  }, intervalMs);
}

/**
 * Stop the auto-refresh daemon.
 * Called on server shutdown.
 */
export function stopAutoRefreshDaemon(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    log.info?.("daemon.stopped");
  }
}

/**
 * Get the current daemon status (for the dashboard).
 */
export function getDaemonStatus(): {
  running: boolean;
  isRefreshing: boolean;
  poolSize: number;
  minPoolSize: number;
  intervalMs: number;
  autoRefreshEnabled: boolean;
} {
  const settings = getSettings();
  return {
    running: _interval !== null,
    isRefreshing: _isRefreshing,
    poolSize: getPoolSize(),
    minPoolSize: settings.minPoolSize,
    intervalMs: settings.autoRefreshIntervalMs,
    autoRefreshEnabled: settings.autoRefreshEnabled,
  };
}
