/**
 * Z.AI Free Web settings store — persists AccessKey, SecretKey, and
 * auto-refresh configuration in the OmniRoute SQLite database.
 *
 * Settings are stored in the `key_value` table (namespace='zai_web_free')
 * so they survive server restarts. The captcha module reads these at
 * runtime; if not set, it falls back to the hardcoded Go defaults.
 *
 * @module zai-web-free/settings-store
 */

import { logger } from "../../utils/logger.ts";

const log = logger("ZAI-WEB-FREE-SETTINGS");

// Defaults (real Aliyun keys from the GLM-Free-API Go binary).
// The public Go source has a `[REDACTED:aliyun_access_key]` placeholder,
// but the compiled binary uses the real key below. Using the placeholder
// as a literal causes Aliyun to reject every InitCaptchaV3 request with
// `AccessKey is inValid!`, which is the root cause of the persistent
// 405 from Z.AI.
export const DEFAULT_ACCESS_KEY = "LTAI5tSEBwYMwVKAQGpxmvTd";
export const DEFAULT_SECRET_KEY = "YSKfst7GaVkXwZYvVihJsKF9r89koz";
export const DEFAULT_MIN_POOL_SIZE = 10;
export const DEFAULT_AUTO_REFRESH_ENABLED = true;
export const DEFAULT_AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Types
export interface ZaiWebFreeSettings {
  accessKey: string;
  secretKey: string;
  minPoolSize: number;
  autoRefreshEnabled: boolean;
  autoRefreshIntervalMs: number;
}

// In-memory cache
let _settings: ZaiWebFreeSettings | null = null;
let _db: any = null;
let _dbPath: string | null = null;

/**
 * Initialize the settings store with a database path.
 * Called once at server startup.
 */
export function initSettingsStore(dbPath: string): void {
  _dbPath = dbPath;
}

/**
 * Get a database handle (better-sqlite3 via createRequire, matching
 * the device-token-pool pattern).
 */
function getDb(): any | null {
  if (_db) return _db;
  if (!_dbPath) return null;
  try {
    const { createRequire } = require("node:module");
    const _require = createRequire(import.meta.url);
    const Database = _require("better-sqlite3");
    _db = new Database(_dbPath);
    _db.pragma("journal_mode = WAL");
    return _db;
  } catch {
    return null;
  }
}

/**
 * Read a setting value from the `key_value` table.
 */
function readSetting(key: string): string | null {
  const db = getDb();
  if (!db) return null;
  try {
    const row = db
      .prepare("SELECT value FROM key_value WHERE namespace = 'zai_web_free' AND key = ?")
      .get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Write a setting value to the `key_value` table.
 */
function writeSetting(key: string, value: string): void {
  const db = getDb();
  if (!db) return;
  try {
    db.prepare(
      `INSERT INTO key_value (namespace, key, value) VALUES ('zai_web_free', ?, ?)
       ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value`
    ).run(key, value);
  } catch (err) {
    log.error?.("settings.write_failed", { key, error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Get the current Z.AI Free Web settings.
 * Falls back to defaults if not configured.
 */
export function getSettings(): ZaiWebFreeSettings {
  if (_settings) return _settings;

  _settings = {
    accessKey: readSetting("accessKey") || DEFAULT_ACCESS_KEY,
    secretKey: readSetting("secretKey") || DEFAULT_SECRET_KEY,
    minPoolSize: parseInt(readSetting("minPoolSize") || "", 10) || DEFAULT_MIN_POOL_SIZE,
    autoRefreshEnabled: readSetting("autoRefreshEnabled") !== "false",
    autoRefreshIntervalMs:
      parseInt(readSetting("autoRefreshIntervalMs") || "", 10) || DEFAULT_AUTO_REFRESH_INTERVAL_MS,
  };

  log.info?.("settings.loaded", {
    accessKey: _settings.accessKey.slice(0, 8) + "...",
    minPoolSize: _settings.minPoolSize,
    autoRefresh: _settings.autoRefreshEnabled,
  });

  return _settings;
}

/**
 * Update Z.AI Free Web settings.
 * Only provided fields are updated; others keep their current value.
 */
export function updateSettings(updates: Partial<ZaiWebFreeSettings>): ZaiWebFreeSettings {
  const current = getSettings();

  if (updates.accessKey !== undefined) {
    writeSetting("accessKey", updates.accessKey);
    current.accessKey = updates.accessKey;
  }
  if (updates.secretKey !== undefined) {
    writeSetting("secretKey", updates.secretKey);
    current.secretKey = updates.secretKey;
  }
  if (updates.minPoolSize !== undefined) {
    writeSetting("minPoolSize", String(updates.minPoolSize));
    current.minPoolSize = updates.minPoolSize;
  }
  if (updates.autoRefreshEnabled !== undefined) {
    writeSetting("autoRefreshEnabled", String(updates.autoRefreshEnabled));
    current.autoRefreshEnabled = updates.autoRefreshEnabled;
  }
  if (updates.autoRefreshIntervalMs !== undefined) {
    writeSetting("autoRefreshIntervalMs", String(updates.autoRefreshIntervalMs));
    current.autoRefreshIntervalMs = updates.autoRefreshIntervalMs;
  }

  // Invalidate cache so next getSettings() re-reads from DB
  _settings = current;

  log.info?.("settings.updated", {
    accessKey: current.accessKey.slice(0, 8) + "...",
    minPoolSize: current.minPoolSize,
    autoRefresh: current.autoRefreshEnabled,
  });

  return current;
}

/**
 * Get the current AccessKey (used by captcha.ts at runtime).
 */
export function getAccessKey(): string {
  return getSettings().accessKey;
}

/**
 * Get the current SecretKey (used by captcha.ts at runtime).
 */
export function getSecretKey(): string {
  return getSettings().secretKey;
}
