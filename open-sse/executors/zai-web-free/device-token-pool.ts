/**
 * Device-token pool ?�� backed by a SQLite table in the OmniRoute database.
 *
 * Device tokens are required by the Aliyun captcha verification step. They
 * are obtained by running a Playwright script that visits chat.z.ai and
 * extracts `window.z_um.getToken()` values from the browser context. The
 * tokens are consumed FIFO and deleted after use (one token per captcha
 * verification attempt, up to 2 attempts per chat request).
 *
 * The pool is stored in the OmniRoute SQLite database (table `zai_web_free_device_tokens`)
 * so it persists across server restarts. The Playwright collector script
 * (see `scripts/dev/zai-web-free/refresh-device-tokens.mjs`) inserts tokens
 * via the `addDeviceTokens()` function; the executor consumes them via
 * `getNextToken()` and `consumeToken()`.
 *
 * @module zai-web-free/device-token-pool
 */

import { logger } from "../../utils/logger.ts";

// Use createRequire for better-sqlite3 (CommonJS module) ?�� matches OmniRoute's
// pattern in driverFactory.ts. Bun's ESM import doesn't resolve the default
// export of CommonJS modules correctly, so we use require instead.
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
type SqliteDatabase = {
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  exec(sql: string): void;
  pragma(str: string): void;
  close(): void;
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
};
let _Database: { new (path: string, options?: object): SqliteDatabase } | null = null;
try {
  _Database = _require("better-sqlite3");
} catch {
  // better-sqlite3 may not be installed in some environments (e.g. Bun)
}

const log = logger("ZAI-WEB-FREE");

let _db: SqliteDatabase | null = null;
let _dbPath: string | null = null;
const _pendingAdds: string[] = [];
const _lock = { locked: false };

/**
 * Initialize the device-token pool with a database handle. Called once at
 * server startup with the OmniRoute SQLite database path. If never called,
 * the pool falls back to an in-memory array (useful for tests).
 */
export function initDeviceTokenPool(dbPath: string): void {
  _dbPath = dbPath;
  // Lazy-open on first use ?�� avoids holding a connection if the executor
  // is never instantiated.
}

function getDb(): SqliteDatabase | null {
  if (_db) return _db;
  if (!_dbPath) return null;
  if (!_Database) {
    log.warn?.("pool.no_driver", { error: "better-sqlite3 not available" });
    return null;
  }
  try {
    _db = new _Database(_dbPath);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS zai_web_free_device_tokens (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        added_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_zai_tokens_id ON zai_web_free_device_tokens(id);
    `);
    return _db;
  } catch (err) {
    log.error?.("pool.open_failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Get the next device token from the pool (FIFO order). Returns `null` if
 * the pool is empty.
 *
 * The token is NOT consumed by this call ?�� the caller must call
 * `consumeToken(token)` after attempting verification, regardless of success
 * or failure. This matches the Go reference's behavior of always deleting
 * a token after use (one token per attempt).
 */
export function getNextToken(): string | null {
  // In-memory fallback when no DB is configured
  if (!_dbPath) {
    return _pendingAdds.shift() ?? null;
  }
  const db = getDb();
  if (!db) return null;
  try {
    const row = db.prepare("SELECT token FROM zai_web_free_device_tokens ORDER BY id LIMIT 1").get() as
      | { token: string }
      | undefined;
    return row?.token ?? null;
  } catch (err) {
    log.error?.("pool.next_failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Remove a token from the pool after it has been used (success or failure).
 */
export function consumeToken(token: string): void {
  if (!_dbPath) {
    // In-memory fallback: no-op (already shifted in getNextToken)
    return;
  }
  const db = getDb();
  if (!db) return;
  try {
    db.prepare("DELETE FROM zai_web_free_device_tokens WHERE token = ?").run(token);
  } catch (err) {
    log.error?.("pool.consume_failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Add new device tokens to the pool. Called by the Playwright collector
 * script after a refresh run. Tokens are inserted in a single transaction
 * for efficiency. Duplicate tokens (already in the pool) are silently
 * skipped via `INSERT OR IGNORE`.
 *
 * @returns The number of tokens actually added (duplicates excluded).
 */
export function addDeviceTokens(tokens: string[]): number {
  if (tokens.length === 0) return 0;

  // In-memory fallback
  if (!_dbPath) {
    let added = 0;
    for (const t of tokens) {
      if (!_pendingAdds.includes(t)) {
        _pendingAdds.push(t);
        added++;
      }
    }
    return added;
  }

  const db = getDb();
  if (!db) return 0;
  try {
    const stmt = db.prepare("INSERT OR IGNORE INTO zai_web_free_device_tokens (token) VALUES (?)");
    let added = 0;
    const tx = db.transaction((toks: string[]) => {
      for (const t of toks) {
        const result = stmt.run(t);
        if (result.changes > 0) added++;
      }
    });
    tx(tokens);
    log.info?.("pool.tokens_added", { count: added, totalRequested: tokens.length });
    return added;
  } catch (err) {
    log.error?.("pool.add_failed", { error: err instanceof Error ? err.message : String(err) });
    return 0;
  }
}

/**
 * Get the current pool size (number of tokens available).
 */
export function getPoolSize(): number {
  if (!_dbPath) return _pendingAdds.length;
  const db = getDb();
  if (!db) return 0;
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM zai_web_free_device_tokens").get() as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Clear all tokens from the pool. Used by the dashboard "Clear tokens"
 * maintenance action.
 */
export function clearPool(): void {
  if (!_dbPath) {
    _pendingAdds.length = 0;
    return;
  }
  const db = getDb();
  if (!db) return;
  try {
    db.prepare("DELETE FROM zai_web_free_device_tokens").run();
    log.info?.("pool.cleared");
  } catch (err) {
    log.error?.("pool.clear_failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Close the database handle. Called on server shutdown.
 */
export function closeDeviceTokenPool(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      // ignore
    }
    _db = null;
  }
}
