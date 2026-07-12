"use client";

/**
 * Z.AI Device Token Pool Panel ?�� shown on the zai-web-free provider page.
 *
 * Contains:
 *   - Device token pool status badge
 *   - "Refresh Device Tokens" button (Playwright collector)
 *   - "Clear Pool" button
 *   - "Extract AccessKey" button (browser-based key extraction)
 *   - Advanced options (unsafe mode, batch settings, proxy info)
 *   - Aliyun Captcha Keys editor (AccessKey + SecretKey)
 *   - Auto-Refresh settings (minPoolSize, interval, enable/disable)
 *
 * Extracted from NoAuthProviderControls.tsx to minimize diff with upstream.
 */

import { useCallback, useEffect, useState } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { ZaiPrerequisiteBanner } from "./ZaiPrerequisiteBanner";

export default function ZaiDeviceTokenPanel() {
  const notify = useNotificationStore();
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [extractingKey, setExtractingKey] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showKeySettings, setShowKeySettings] = useState(false);
  const [refreshOptions, setRefreshOptions] = useState({
    tokens: 750,
    batches: 3,
    parallel: 1,
    headed: false,
    unsafe: false,
  });
  const [keySettings, setKeySettings] = useState({
    accessKey: "",
    secretKey: "",
    minPoolSize: 10,
    autoRefreshEnabled: true,
    autoRefreshIntervalMs: 300000,
  });

  const fetchPoolSize = useCallback(async () => {
    try {
      const resp = await fetch("/api/providers/zai-web-free/pool-status", { cache: "no-store" });
      if (!resp.ok) return;
      const data = await resp.json();
      setPoolSize(typeof data.poolSize === "number" ? data.poolSize : 0);
    } catch {
      // ignore
    }
  }, []);

  const fetchKeySettings = useCallback(async () => {
    try {
      const resp = await fetch("/api/providers/zai-web-free/keys", { cache: "no-store" });
      if (!resp.ok) return;
      const data = await resp.json();
      setKeySettings({
        accessKey: data.accessKey || "",
        secretKey: data.secretKey || "",
        minPoolSize: data.minPoolSize ?? 10,
        autoRefreshEnabled: data.autoRefreshEnabled ?? true,
        autoRefreshIntervalMs: data.autoRefreshIntervalMs ?? 300000,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchPoolSize();
    void fetchKeySettings();
  }, [fetchPoolSize, fetchKeySettings]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await fetch("/api/providers/zai-web-free/refresh-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: refreshOptions.tokens,
          batches: refreshOptions.batches,
          parallel: refreshOptions.parallel,
          headed: refreshOptions.headed,
          unsafe: refreshOptions.unsafe,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      notify.success(
        `Device tokens refreshed: ${data.collected} collected, ${data.poolSize} in pool`
      );
      setPoolSize(data.poolSize);
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "Failed to refresh device tokens"
      );
    } finally {
      setRefreshing(false);
    }
  }, [notify, refreshOptions]);

  const handleClear = useCallback(async () => {
    if (!confirm("Clear all device tokens from the pool?")) return;
    setClearing(true);
    try {
      const resp = await fetch("/api/providers/zai-web-free/clear-tokens", {
        method: "POST",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      notify.success("Device token pool cleared");
      setPoolSize(0);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to clear tokens");
    } finally {
      setClearing(false);
    }
  }, [notify]);

  const handleExtractKey = useCallback(async () => {
    setExtractingKey(true);
    try {
      const resp = await fetch("/api/providers/zai-web-free/extract-key", {
        method: "POST",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      if (data.accessKey) {
        setKeySettings((prev) => ({
          ...prev,
          accessKey: data.accessKey,
          secretKey: data.secretKey || prev.secretKey,
        }));
        notify.success(
          `AccessKey extracted${data.verified ? " and verified" : ""}: ${data.accessKey.slice(0, 12)}...`
        );
      } else {
        notify.error("Could not extract AccessKey");
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to extract key");
    } finally {
      setExtractingKey(false);
    }
  }, [notify]);

  const handleSaveKeys = useCallback(async () => {
    setSavingKeys(true);
    try {
      const resp = await fetch("/api/providers/zai-web-free/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keySettings),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      notify.success("Z.AI Free Web settings saved");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSavingKeys(false);
    }
  }, [notify, keySettings]);

  const needsRefresh = poolSize !== null && poolSize < keySettings.minPoolSize;

  return (
    <div className="space-y-4">
      <ZaiPrerequisiteBanner providerId="zai-web-free" showPoolWarning />
      <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[20px] text-blue-500">key</span>
        <h3 className="text-sm font-medium text-text-main">Z.AI Device Token Pool</h3>
        {poolSize !== null && (
          <span
            className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
              needsRefresh
                ? "bg-amber-500/20 text-amber-600"
                : "bg-emerald-500/20 text-emerald-600"
            }`}
          >
            {poolSize} tokens{needsRefresh ? " (low)" : ""}
          </span>
        )}
      </div>

      <p className="text-xs text-text-muted mb-4">
        Z.AI&apos;s captcha verification requires device tokens collected from a real browser
        session. Click &quot;Refresh Device Tokens&quot; to launch a headless Chromium browser
        that visits chat.z.ai and extracts fresh tokens. Each chat request consumes 1?��2 tokens.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">
            {refreshing ? "progress_activity" : "refresh"}
          </span>
          {refreshing ? "Collecting..." : "Refresh Device Tokens"}
        </button>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-main transition hover:bg-surface-hover"
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          Options
        </button>

        {poolSize !== null && poolSize > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {clearing ? "progress_activity" : "delete"}
            </span>
            {clearing ? "Clearing..." : "Clear Pool"}
          </button>
        )}

        <button
          type="button"
          onClick={handleExtractKey}
          disabled={extractingKey}
          className="inline-flex items-center gap-1.5 rounded-md border border-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-600 transition hover:bg-purple-500/10 disabled:opacity-50"
          title="Extract Aliyun AccessKey from AliyunCaptcha.js (maintenance tool for when keys rotate)"
        >
          <span className="material-symbols-outlined text-[16px]">
            {extractingKey ? "progress_activity" : "key"}
          </span>
          {extractingKey ? "Extracting..." : "Extract AccessKey"}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-4 space-y-3 rounded-md border border-border bg-surface p-3">
          {/* AccessKey / SecretKey settings */}
          <div className="space-y-2 rounded-md border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-purple-500">key</span>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                Aliyun Captcha Keys
              </span>
              <button
                type="button"
                onClick={() => setShowKeySettings((v) => !v)}
                className="ml-auto text-xs text-purple-600 hover:underline"
              >
                {showKeySettings ? "Hide" : "Edit"}
              </button>
            </div>

            {showKeySettings ? (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-xs font-medium text-text-muted">AccessKey</span>
                  <input
                    type="text"
                    value={keySettings.accessKey}
                    onChange={(e) =>
                      setKeySettings((prev) => ({ ...prev, accessKey: e.target.value }))
                    }
                    placeholder="LTAI..."
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-text-muted">SecretKey</span>
                  <input
                    type="text"
                    value={keySettings.secretKey}
                    onChange={(e) =>
                      setKeySettings((prev) => ({ ...prev, secretKey: e.target.value }))
                    }
                    placeholder="YSKfst7..."
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-mono"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveKeys}
                    disabled={savingKeys}
                    className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {savingKeys ? "Saving..." : "Save Keys"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExtractKey}
                    disabled={extractingKey}
                    className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 px-3 py-1 text-xs font-medium text-purple-600 hover:bg-purple-500/10 disabled:opacity-50"
                  >
                    {extractingKey ? "Extracting..." : "Extract via Browser"}
                  </button>
                </div>
                <p className="text-xs text-text-subtle">
                  If Aliyun rotates the keys, click &quot;Extract via Browser&quot; to automatically
                  extract the new keys from chat.z.ai, or paste them manually from the
                  GLM-Free-API Go source.
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                AccessKey:{" "}
                <code className="font-mono">
                  {keySettings.accessKey ? keySettings.accessKey.slice(0, 12) + "..." : "not set"}
                </code>
                {" | "}
                SecretKey:{" "}
                <code className="font-mono">
                  {keySettings.secretKey ? keySettings.secretKey.slice(0, 8) + "..." : "not set"}
                </code>
              </p>
            )}
          </div>

          {/* Auto-refresh settings */}
          <div className="space-y-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-500">autorenew</span>
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                Auto-Refresh Settings
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-text-muted">Min Pool Size</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={keySettings.minPoolSize}
                  onChange={(e) =>
                    setKeySettings((prev) => ({
                      ...prev,
                      minPoolSize: Math.max(1, Math.min(1000, Number(e.target.value) || 10)),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-text-muted">
                  Check Interval (minutes)
                </span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={Math.round(keySettings.autoRefreshIntervalMs / 60000)}
                  onChange={(e) =>
                    setKeySettings((prev) => ({
                      ...prev,
                      autoRefreshIntervalMs: Math.max(1, Math.min(60, Number(e.target.value) || 5)) * 60000,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={keySettings.autoRefreshEnabled}
                onChange={(e) =>
                  setKeySettings((prev) => ({ ...prev, autoRefreshEnabled: e.target.checked }))
                }
                className="rounded"
              />
              Auto-refresh device tokens when pool is low
            </label>
            <p className="text-xs text-text-subtle">
              The daemon checks every {Math.round(keySettings.autoRefreshIntervalMs / 60000)} min.
              If pool &lt; {keySettings.minPoolSize}, it automatically collects fresh tokens
              via Playwright.
            </p>
          </div>

          {/* Unsafe mode toggle */}
          <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
            <input
              type="checkbox"
              checked={refreshOptions.unsafe}
              onChange={(e) =>
                setRefreshOptions((prev) => ({ ...prev, unsafe: e.target.checked }))
              }
              className="mt-0.5 rounded"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Unsafe Mode
                </span>
                <span className="material-symbols-outlined text-[14px] text-amber-600">warning</span>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                Raises limits to <strong>1500 tokens/batch</strong>,{" "}
                <strong>25 batches</strong>, <strong>5 parallel workers</strong> (max 37,500
                tokens per run). <strong>WARNING:</strong> increases risk of Z.AI flagging the
                browser fingerprint and temporarily banning your IP. Only use when the pool is
                critically low and you need a large replenishment in one shot.
              </p>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-text-muted">
                Tokens per batch{" "}
                <span className="text-text-subtle">
                  (max {refreshOptions.unsafe ? 1500 : 1250})
                </span>
              </span>
              <input
                type="number"
                min={50}
                max={refreshOptions.unsafe ? 1500 : 1250}
                value={refreshOptions.tokens}
                onChange={(e) =>
                  setRefreshOptions((prev) => ({
                    ...prev,
                    tokens: Math.min(
                      refreshOptions.unsafe ? 1500 : 1250,
                      Math.max(50, Number(e.target.value) || 750)
                    ),
                  }))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted">
                Batches{" "}
                <span className="text-text-subtle">
                  (max {refreshOptions.unsafe ? 25 : 9})
                </span>
              </span>
              <input
                type="number"
                min={1}
                max={refreshOptions.unsafe ? 25 : 9}
                value={refreshOptions.batches}
                onChange={(e) =>
                  setRefreshOptions((prev) => ({
                    ...prev,
                    batches: Math.min(
                      refreshOptions.unsafe ? 25 : 9,
                      Math.max(1, Number(e.target.value) || 3)
                    ),
                  }))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted">
                Parallel workers{" "}
                <span className="text-text-subtle">
                  (max {refreshOptions.unsafe ? 5 : 3})
                </span>
              </span>
              <input
                type="number"
                min={1}
                max={refreshOptions.unsafe ? 5 : 3}
                value={refreshOptions.parallel}
                onChange={(e) =>
                  setRefreshOptions((prev) => ({
                    ...prev,
                    parallel: Math.min(
                      refreshOptions.unsafe ? 5 : 3,
                      Math.max(1, Number(e.target.value) || 1)
                    ),
                  }))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={refreshOptions.headed}
              onChange={(e) =>
                setRefreshOptions((prev) => ({ ...prev, headed: e.target.checked }))
              }
              className="rounded"
            />
            Show browser window (debug mode)
          </label>

          {/* Proxy info */}
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-blue-500">shield</span>
              <span className="font-medium text-text-main">Proxy</span>
              <span className="ml-auto text-text-subtle">
                Uses OmniRoute&apos;s Global Proxy automatically
              </span>
            </div>
            <p className="mt-1">
              The Playwright browser routes through the same global proxy configured in
              OmniRoute&apos;s Proxies ?�� Global settings. No separate proxy configuration
              needed ?�� if a global proxy is set, it&apos;s used; otherwise the browser
              connects directly.
            </p>
          </div>

          <p className="text-xs text-text-muted">
            <strong>Note:</strong> Playwright Chromium must be installed
            (<code className="rounded bg-surface px-1">npx playwright install chromium</code>).
            Each batch takes ~30s. Total: ~{refreshOptions.batches * 30}s
            {refreshOptions.parallel > 1
              ? ` (parallel ?�${Math.min(refreshOptions.parallel, refreshOptions.batches)})`
              : ""}
            .{" "}
            {refreshOptions.unsafe && (
              <span className="font-semibold text-amber-600">
                Max tokens this run:{" "}
                {refreshOptions.tokens * refreshOptions.batches}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
    </div>
  );
}
