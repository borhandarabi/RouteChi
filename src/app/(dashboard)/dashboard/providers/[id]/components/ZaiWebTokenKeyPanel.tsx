"use client";

/**
 * Z.AI Web (JWT Token) - Shared Aliyun Key Panel.
 *
 * Shown on the zai-web-token provider page. Provides read/write access to
 * the same Aliyun AccessKey and SecretKey that zai-web-free uses (stored in
 * the same DB settings). This way, users who only use zai-web-token (without
 * enabling zai-web-free) can still manage the captcha keys.
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
  });

  const fetchKeySettings = useCallback(async () => {
    try {
      const resp = await fetch("/api/providers/zai-web-free/keys", { cache: "no-store" });
      if (!resp.ok) return;
      const data = await resp.json();
      setKeySettings({
        accessKey: data.accessKey || "",
        secretKey: data.secretKey || "",
      });
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
      notify.success("Aliyun captcha keys saved");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save keys");
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
        <span className="ml-auto text-xs text-text-subtle">
          Shared with Z.AI Free Web (Guest)
        </span>
      </div>

      <p className="text-xs text-text-muted mb-4">
        Z.AI&apos;s captcha verification requires Aliyun AccessKey and SecretKey. These keys
        are shared between <strong>Z.AI Free Web (Guest)</strong> and{" "}
        <strong>Z.AI Web (JWT Token)</strong>. If Aliyun rotates the keys, update them here
        or click &quot;Extract via Browser&quot;.
      </p>

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
            className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {savingKeys ? "Saving..." : "Save Keys"}
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
        <p className="text-xs text-text-subtle">
          If Aliyun rotates the keys, click &quot;Extract via Browser&quot; to automatically
          extract the new keys from chat.z.ai, or paste them manually from the
          GLM-Free-API Go source.
        </p>
      </div>
    </div>
    </div>
  );
}
