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

// Default Aliyun CaptchaV3 credentials. These match the values embedded in
// the GLM-Free-API Go binary (chat.z.ai's free-tier captcha verification).
// They are PUBLIC in the sense that they ship in the AliyunCaptcha.js bundle
// served by alicdn to every browser that loads chat.z.ai — they are NOT user
// secrets. They are scoped to the `didk33e0` SceneId and only authorize
// InitCaptchaV3/VerifyCaptchaV3 calls.
//
// Operators can override them at three levels (highest priority first):
//   1. env vars: OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY / OMNIROUTE_ZAI_ALIYUN_SECRET_KEY
//   2. dashboard-stored values (key_value table, namespace='zai_web_free')
//   3. the DEFAULT_* constants below
//
// If Aliyun rotates the keys, run `POST /api/providers/zai-web-free/extract-key`
// (intercepts AliyunCaptcha.js and AES-decrypts the new keys), or set the
// new values via env vars.
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
type SqliteDb = {
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  exec(sql: string): void;
  pragma(str: string, options?: { simple?: boolean }): unknown;
  close(): void;
};
let _settings: ZaiWebFreeSettings | null = null;

/**
 * Initialize the settings store. Kept for backward compatibility —
 * settings now use globalThis.__omnirouteDb, so no path is needed.
 */
export function initSettingsStore(_dbPath?: string): void {
  // No-op — DB is accessed via globalThis.__omnirouteDb
}

/**
 * Get a database handle via globalThis.__omnirouteDb (same pattern as
 * providerSessionRegistry.ts — uses the OmniRoute main DB).
 */
function getDb(): SqliteDb | null {
  try {
    const db = (globalThis as unknown as { __omnirouteDb?: SqliteDb }).__omnirouteDb;
    return db ?? null;
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
    log.error?.("settings.write_failed", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Resolve the Aliyun AccessKey at runtime. Priority (highest wins):
 *   1. `OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY` env var — set by operators who want
 *      to rotate keys without touching the dashboard, or who deploy via
 *      Docker/K8s secrets.
 *   2. `key_value` table row (set by the dashboard's "Extract AccessKey"
 *      button or manual entry).
 *   3. `DEFAULT_ACCESS_KEY` constant (matches the GLM-Free-API Go binary).
 */
function resolveAccessKey(): string {
  const env = process.env.OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY;
  if (env && env.trim()) return env.trim();
  const stored = readSetting("accessKey");
  if (stored && stored.trim()) return stored.trim();
  return DEFAULT_ACCESS_KEY;
}

/**
 * Resolve the Aliyun SecretKey at runtime. Same priority order as
 * `resolveAccessKey()` but reads `OMNIROUTE_ZAI_ALIYUN_SECRET_KEY`.
 */
function resolveSecretKey(): string {
  const env = process.env.OMNIROUTE_ZAI_ALIYUN_SECRET_KEY;
  if (env && env.trim()) return env.trim();
  const stored = readSetting("secretKey");
  if (stored && stored.trim()) return stored.trim();
  return DEFAULT_SECRET_KEY;
}

/**
 * Get the current Z.AI Free Web settings.
 * Falls back to defaults if not configured.
 */
export function getSettings(): ZaiWebFreeSettings {
  if (_settings) return _settings;

  _settings = {
    accessKey: resolveAccessKey(),
    secretKey: resolveSecretKey(),
    minPoolSize: parseInt(readSetting("minPoolSize") || "", 10) || DEFAULT_MIN_POOL_SIZE,
    autoRefreshEnabled: readSetting("autoRefreshEnabled") !== "false",
    autoRefreshIntervalMs:
      parseInt(readSetting("autoRefreshIntervalMs") || "", 10) || DEFAULT_AUTO_REFRESH_INTERVAL_MS,
  };

  log.info?.("settings.loaded", {
    accessKey: _settings.accessKey.slice(0, 8) + "...",
    accessKeySource: process.env.OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY
      ? "env"
      : readSetting("accessKey")
        ? "db"
        : "default",
    minPoolSize: _settings.minPoolSize,
    autoRefresh: _settings.autoRefreshEnabled,
  });

  return _settings;
}

/**
 * Update Z.AI Free Web settings.
 * Only provided fields are updated; others keep their current value.
 *
 * Note on env-var precedence: when `OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY` or
 * `OMNIROUTE_ZAI_ALIYUN_SECRET_KEY` are set, they override the DB-stored
 * values. Updates to `accessKey`/`secretKey` via this function still
 * write to the DB (so they take effect when env vars are later removed),
 * but the cached `current.accessKey` is set to the env value if present
 * so the caller sees what the captcha module will actually use.
 */
export function updateSettings(updates: Partial<ZaiWebFreeSettings>): ZaiWebFreeSettings {
  const current = getSettings();

  if (updates.accessKey !== undefined) {
    writeSetting("accessKey", updates.accessKey);
    // If env var is set, it wins — reflect that in the returned settings.
    current.accessKey = process.env.OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY?.trim() || updates.accessKey;
  }
  if (updates.secretKey !== undefined) {
    writeSetting("secretKey", updates.secretKey);
    current.secretKey = process.env.OMNIROUTE_ZAI_ALIYUN_SECRET_KEY?.trim() || updates.secretKey;
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

  // Invalidate cache so next getSettings() re-reads from DB / env
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
