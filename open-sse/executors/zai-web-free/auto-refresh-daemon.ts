/**
 * Auto-refresh daemon for Z.AI Free Web device tokens.
 *
 * Periodically checks the device-token pool size. When it drops below
 * the configured minimum (default 10), automatically triggers a
 * Playwright token collection run to replenish the pool.
 *
 * The daemon also proactively refreshes tokens before they expire
 * (device tokens have a short TTL — typically 10-30 minutes).
 *
 * **Idle-suspend**: when no requests have arrived in the last
 * `IDLE_SUSPEND_MS` (default 60 minutes), the daemon suspends itself
 * to avoid wasting Playwright launches on an unused system. The first
 * incoming request wakes the daemon (via `notifyRequest()`).
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

// ── Idle-suspend tracking ──────────────────────────────────────────────────
// Timestamp of the last request that consumed a token. When the daemon
// tick fires and (now - lastRequestAt) > IDLE_SUSPEND_MS, the daemon
// suspends (stops the interval). The next call to notifyRequest() restarts it.
let _lastRequestAt = Date.now();
const IDLE_SUSPEND_MS = 60 * 60 * 1000; // 60 minutes
let _suspended = false;

/**
 * Notify the daemon that a request was just served.
 * Called by the executor after consuming a token. If the daemon was
 * suspended (idle), this restarts it.
 */
export function notifyRequest(): void {
  _lastRequestAt = Date.now();
  if (_suspended) {
    _suspended = false;
    log.info?.("daemon.resumed_after_idle");
    // Restart the interval — it was cleared when the daemon suspended.
    const settings = getSettings();
    if (settings.autoRefreshEnabled) {
      _interval = setInterval(() => {
        void checkAndRefresh();
      }, settings.autoRefreshIntervalMs);
    }
    // Run an immediate check — the pool may be stale/empty after idle.
    void checkAndRefresh();
  }
}

/**
 * Check if the pool needs refreshing and trigger a refresh if so.
 *
 * Conditions for refresh:
 *   1. Pool size < minPoolSize (proactive replenishment)
 *   2. Pool size < minPoolSize * 2 AND last refresh was > 10 minutes ago
 *      (pre-expiry refresh — tokens have a short TTL)
 *
 * Also checks idle-suspend: if no requests in the last IDLE_SUSPEND_MS,
 * the daemon suspends itself.
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

  // ── Idle-suspend check ──
  const idleMs = Date.now() - _lastRequestAt;
  if (idleMs > IDLE_SUSPEND_MS && !_suspended) {
    _suspended = true;
    log.info?.("daemon.suspended_idle", {
      idleMinutes: Math.floor(idleMs / 60000),
      idleThresholdMinutes: Math.floor(IDLE_SUSPEND_MS / 60000),
    });
    // Stop the interval — notifyRequest() will restart it.
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    return;
  }

  if (_suspended) {
    // Still suspended (shouldn't reach here because interval is cleared,
    // but guard against race conditions).
    return;
  }

  const poolSize = getPoolSize();
  const minSize = settings.minPoolSize;

  log.debug?.("daemon.check", { poolSize, minSize, idleMinutes: Math.floor(idleMs / 60000) });

  if (poolSize >= minSize) {
    // Pool is healthy — no action needed
    return;
  }

  // Pool is low — trigger a refresh
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
 * @param dbPath  Path to the RouteChi SQLite database.
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

  // Reset idle tracker on startup
  _lastRequestAt = Date.now();
  _suspended = false;

  log.info?.("daemon.start", {
    intervalMs,
    minPoolSize: settings.minPoolSize,
    idleSuspendMinutes: Math.floor(IDLE_SUSPEND_MS / 60000),
  });

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
  suspended: boolean;
  idleMinutes: number;
} {
  const settings = getSettings();
  return {
    running: _interval !== null,
    isRefreshing: _isRefreshing,
    poolSize: getPoolSize(),
    minPoolSize: settings.minPoolSize,
    intervalMs: settings.autoRefreshIntervalMs,
    autoRefreshEnabled: settings.autoRefreshEnabled,
    suspended: _suspended,
    idleMinutes: Math.floor((Date.now() - _lastRequestAt) / 60000),
  };
}
