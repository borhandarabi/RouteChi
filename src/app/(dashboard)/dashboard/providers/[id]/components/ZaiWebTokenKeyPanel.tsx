"use client";

/**
 * Z.AI Web (JWT Token) - Shared Aliyun Key Panel.
 *
 * Shown on the zai-web-token provider page. Provides read/write access to
 * the same Aliyun AccessKey, SecretKey, and captcha strategy settings that
 * zai-web-free uses (stored in the same DB settings). This way, users who
 * only use zai-web-token (without enabling zai-web-free) can still manage
 * the captcha keys and strategy.
 *
 * NOTE: This panel does NOT render ZaiPrerequisiteBanner. The prerequisite
 * check endpoint launches a headless Chromium browser (~3-5s per call) and
 * would cause the page to feel sluggish on every render. If the user wants
 * to see prerequisite warnings, they should visit the zai-web-free provider
 * page which has the full ZaiDeviceTokenPanel with the banner.
 */

import { useCallback, useEffect, useState } from "react";
import { useNotificationStore } from "@/store/notificationStore";

export default function ZaiWebTokenKeyPanel() {
  const notify = useNotificationStore();
  const [savingKeys, setSavingKeys] = useState(false);
  const [extractingKey, setExtractingKey] = useState(false);
  const [keySettings, setKeySettings] = useState({
    accessKey: "",
    secretKey: "",
    captchaStrategy: "auto" as string,
    captchaRetries: 2,
    captchaTimeoutMs: 90000,
  });
  const [accessKeySource, setAccessKeySource] = useState<string>("");

  const fetchKeySettings = useCallback(async () => {
    try {
      const resp = await fetch("/api/providers/zai-web-free/keys", { cache: "no-store" });
      if (!resp.ok) return;
      const data = await resp.json();
      setKeySettings({
        accessKey: data.accessKey || "",
        secretKey: data.secretKey || "",
        captchaStrategy: data.captchaStrategy || "auto",
        captchaRetries: data.captchaRetries ?? 2,
        captchaTimeoutMs: data.captchaTimeoutMs ?? 90000,
      });
      setAccessKeySource(data.accessKeySource || "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchKeySettings();
  }, [fetchKeySettings]);

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
      notify.success("Aliyun captcha keys + strategy saved");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSavingKeys(false);
    }
  }, [notify, keySettings]);

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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple-500/25 bg-purple-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[20px] text-purple-500">key</span>
          <h3 className="text-sm font-medium text-text-main">Aliyun Captcha Keys (Shared)</h3>
          {accessKeySource === "env" && (
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              title="Key is overridden by OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY env var"
            >
              env override
            </span>
          )}
          <span className="ml-auto text-xs text-text-subtle">
            Shared with Z.AI Free Web (Guest)
          </span>
        </div>

        <p className="text-xs text-text-muted mb-4">
          Z.AI&apos;s captcha verification requires Aliyun AccessKey and SecretKey. These keys are
          shared between <strong>Z.AI Free Web (Guest)</strong> and{" "}
          <strong>Z.AI Web (JWT Token)</strong>. If Aliyun rotates the keys, update them here or
          click &quot;Extract via Browser&quot;.
        </p>

        {accessKeySource === "env" && (
          <p className="mb-3 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-semibold">Note:</span> An env var (
            <code className="font-mono">OMNIROUTE_ZAI_ALIYUN_ACCESS_KEY</code>) is overriding the DB
            value. Edits below still write to the DB (so they take effect when the env var is
            unset), but the captcha module will use the env value until then.
          </p>
        )}

        {/* AccessKey / SecretKey */}
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs font-medium text-text-muted">AccessKey</span>
            <input
              type="text"
              value={keySettings.accessKey}
              onChange={(e) => setKeySettings((prev) => ({ ...prev, accessKey: e.target.value }))}
              placeholder="LTAI..."
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-text-muted">SecretKey</span>
            <input
              type="text"
              value={keySettings.secretKey}
              onChange={(e) => setKeySettings((prev) => ({ ...prev, secretKey: e.target.value }))}
              placeholder="YSKfst7..."
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-mono"
            />
          </label>
        </div>

        {/* Captcha Strategy */}
        <div className="mt-4 space-y-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-500">shield</span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Captcha Strategy
            </span>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-text-muted">Strategy</span>
            <select
              value={keySettings.captchaStrategy}
              onChange={(e) =>
                setKeySettings((prev) => ({ ...prev, captchaStrategy: e.target.value }))
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="auto">Auto (A → B → C) — default, best reliability</option>
              <option value="a_only">A only — server-side crypto, fastest</option>
              <option value="b_only">B only — fresh token via Playwright + A</option>
              <option value="c_only">C only — full browser captcha, slowest</option>
              <option value="a_then_c">A → C — skip Playwright token fetch</option>
              <option value="a_then_b">A → B — no browser fallback</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-text-muted">Retries per method</span>
              <input
                type="number"
                min={1}
                max={10}
                value={keySettings.captchaRetries}
                onChange={(e) =>
                  setKeySettings((prev) => ({
                    ...prev,
                    captchaRetries: Math.max(1, Math.min(10, Number(e.target.value) || 2)),
                  }))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted">Timeout (seconds, 0 = no timeout)</span>
              <input
                type="number"
                min={0}
                max={300}
                value={Math.round(keySettings.captchaTimeoutMs / 1000)}
                onChange={(e) =>
                  setKeySettings((prev) => ({
                    ...prev,
                    captchaTimeoutMs: Math.max(0, Math.min(300, Number(e.target.value) || 90)) * 1000,
                  }))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
          </div>
          <p className="text-xs text-text-subtle">
            <strong>A:</strong> Server-side crypto with pool tokens (~2s).{" "}
            <strong>B:</strong> Fresh token via Playwright + A (~5s).{" "}
            <strong>C:</strong> Full browser captcha (~10s, most reliable).
          </p>
        </div>

        {/* Save + Extract buttons */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSaveKeys}
            disabled={savingKeys}
            className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {savingKeys ? "Saving..." : "Save Settings"}
          </button>
          <button
            type="button"
            onClick={handleExtractKey}
            disabled={extractingKey}
            className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-500/10 disabled:opacity-50"
          >
            {extractingKey ? "Extracting..." : "Extract via Browser"}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-subtle">
          &quot;Save Settings&quot; saves keys + strategy. &quot;Extract via Browser&quot; only
          extracts the AccessKey/SecretKey (save afterwards to persist).
        </p>
      </div>
    </div>
  );
}
