"use client";

import { useCallback, useEffect, useState } from "react";
import { NoAuthAccountCard, NoAuthProviderCard } from "@/shared/components";
import { getProviderAlias } from "@/shared/constants/providers";
import { useNotificationStore } from "@/store/notificationStore";
import dynamic from "next/dynamic";

// Lazy-load ZaiDeviceTokenPanel only on the zai-web-free provider page.
// The panel pulls in the dashboard's notification store and fetches
// pool-status/keys endpoints on mount — we don't want that overhead for
// other no-auth providers (mimocode, opencode, auggie, etc).
const ZaiDeviceTokenPanel = dynamic(() => import("./ZaiDeviceTokenPanel"), { ssr: false });

const ACCOUNT_PROVIDER_NAMES: Record<string, string> = {
  mimocode: "MiMoCode",
  opencode: "OpenCode",
};

interface NoAuthProviderControlsProps {
  providerId: string;
  providerName: string;
}

export default function NoAuthProviderControls({
  providerId,
  providerName,
}: NoAuthProviderControlsProps) {
  const notify = useNotificationStore();
  const [blockedProviders, setBlockedProviders] = useState<string[]>([]);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const providerAlias = getProviderAlias(providerId);
  const enabled =
    !blockedProviders.includes(providerId) &&
    !(typeof providerAlias === "string" && blockedProviders.includes(providerAlias));

  useEffect(() => {
    let cancelled = false;

    async function fetchBlockedProviders() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data.blockedProviders)) {
          setBlockedProviders(data.blockedProviders);
        }
      } catch (error) {
        console.error("Failed to fetch provider settings:", error);
      }
    }

    void fetchBlockedProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnabledChange = useCallback(
    async (nextEnabled: boolean) => {
      const previous = blockedProviders;
      const keysToRemove = new Set([providerId, providerAlias].filter(Boolean));
      const next = nextEnabled
        ? previous.filter((item) => !keysToRemove.has(item))
        : Array.from(new Set([...previous.filter((item) => !keysToRemove.has(item)), providerId]));

      setBlockedProviders(next);
      setSavingEnabled(true);
      try {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedProviders: next }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error?.message || data?.error || "Failed to update provider");
        }
        setBlockedProviders(Array.isArray(data.blockedProviders) ? data.blockedProviders : next);
        notify.success(`${providerName} ${nextEnabled ? "enabled" : "disabled"}`);
      } catch (error) {
        setBlockedProviders(previous);
        notify.error(error instanceof Error ? error.message : "Failed to update provider");
      } finally {
        setSavingEnabled(false);
      }
    },
    [blockedProviders, notify, providerAlias, providerId, providerName]
  );

  const accountProviderName = ACCOUNT_PROVIDER_NAMES[providerId];
  if (accountProviderName) {
    return (
      <NoAuthAccountCard
        providerId={providerId}
        providerName={accountProviderName}
        generateAccountId={() => crypto.randomUUID().replace(/-/g, "")}
        enabled={enabled}
        savingEnabled={savingEnabled}
        onEnabledChange={handleEnabledChange}
      />
    );
  }

  return (
    <>
      <NoAuthProviderCard
        enabled={enabled}
        saving={savingEnabled}
        onEnabledChange={handleEnabledChange}
      />
      {/* zai-web-free gets an additional Device Token Pool + Aliyun Captcha Keys
          panel below the standard enable/disable card. */}
      {providerId === "zai-web-free" && <ZaiDeviceTokenPanel />}
    </>
  );
}
