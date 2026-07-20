"use client";

import { useCallback, useEffect, useState } from "react";
import { NoAuthAccountCard, NoAuthProviderCard } from "@/shared/components";
import { getProviderAlias, supportsNoAuthProviderProxy } from "@/shared/constants/providers";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

// Lazy-load ZaiDeviceTokenPanel only on the zai-web-free provider page.
// The panel pulls in the dashboard's notification store and fetches
// pool-status/keys endpoints on mount — we don't want that overhead for
// other no-auth providers (mimocode, opencode, auggie, etc).
const ZaiDeviceTokenPanel = dynamic(() => import("./ZaiDeviceTokenPanel"), { ssr: false });

// Lazy-load KiloFreeDefaultModelPanel only on the kilo-free provider page.
const KiloFreeDefaultModelPanel = dynamic(() => import("./KiloFreeDefaultModelPanel"), { ssr: false });

const ACCOUNT_PROVIDER_NAMES: Record<string, string> = {
  mimocode: "MiMoCode",
  opencode: "OpenCode",
  dahl: "Dahl",
  // RouteChi additions — these no-auth providers ship their own account cards.
  "kilo-free": "Kilo Free",
  "zai-web-free": "Z.AI Free Web",
  "duckduckgo-web": "DuckDuckGo AI Chat",
  theoldllm: "The Old LLM",
};

interface NoAuthProviderControlsProps {
  providerId: string;
  providerName: string;
  providerProxy?: { host?: string | null } | null;
  onConfigureProviderProxy: () => void;
}

export default function NoAuthProviderControls({
  providerId,
  providerName,
  providerProxy,
  onConfigureProviderProxy,
}: NoAuthProviderControlsProps) {
  const notify = useNotificationStore();
  const t = useTranslations("providers");
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
  const host = providerProxy?.host;
  const providerProxyControl = supportsNoAuthProviderProxy(providerId) ? (
    <button
      type="button"
      onClick={onConfigureProviderProxy}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-all ${
        host
          ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
          : "bg-black/3 text-text-muted/50 hover:bg-black/6 hover:text-text-muted dark:bg-white/3 dark:hover:bg-white/6"
      }`}
      title={host ? t("providerProxyTitleConfigured", { host }) : t("providerProxyConfigureHint")}
    >
      <span className="material-symbols-outlined text-[14px]">vpn_lock</span>
      <span className="max-w-30 truncate">{host || t("providerProxy")}</span>
    </button>
  ) : null;

  // Build the availableModels list for providers that have multiple models.
  // This enables the per-account modelFilter dropdown in NoAuthAccountCard
  // so users can restrict an account to a specific model (e.g. for kilo-free
  // and zai-web-free where different models have different quotas).
  const availableModels =
    providerId === "kilo-free"
      ? [
          "kilo-auto/free",
          "tencent/hy3:free",
          "stepfun/step-3.7-flash:free",
          "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
          "nvidia/nemotron-3-super-120b-a12b:free",
          "nvidia/nemotron-3-ultra-550b-a55b:free",
          "nvidia/nemotron-3.5-content-safety:free",
          "cohere/north-mini-code:free",
          "kwaipilot/kat-coder-pro-v2.5:free",
          "poolside/laguna-m.1:free",
          "poolside/laguna-xs-2.1:free",
        ]
      : providerId === "zai-web-free"
        ? ["glm-4.7"]
        : undefined;

  if (accountProviderName) {
    return (
      <>
        <NoAuthAccountCard
          providerId={providerId}
          providerName={accountProviderName}
          generateAccountId={() => crypto.randomUUID().replace(/-/g, "")}
          generateApiKey={
            providerId === "dahl"
              ? async () => {
                  const res = await fetch("/api/dahl/tokens", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok || !data.token) {
                    throw new Error(data?.error || "Failed to create Dahl token");
                  }
                  return data.token as string;
                }
              : undefined
          }
          enabled={enabled}
          savingEnabled={savingEnabled}
          onEnabledChange={handleEnabledChange}
          providerProxyControl={providerProxyControl}
          availableModels={availableModels}
        />
        {/* zai-web-free gets an additional Device Token Pool + Aliyun Captcha Keys
            panel below the account card. Both panels are shown. */}
        {providerId === "zai-web-free" && <ZaiDeviceTokenPanel />}
        {/* kilo-free gets a Default Model picker panel so users can override
            the curated default (kilo-auto/free) with any free model. */}
        {providerId === "kilo-free" && <KiloFreeDefaultModelPanel />}
      </>
    );
  }

  return (
    <>
      <NoAuthProviderCard
        enabled={enabled}
        saving={savingEnabled}
        onEnabledChange={handleEnabledChange}
        providerProxyControl={providerProxyControl}
      />
      {/* zai-web-free gets an additional Device Token Pool + Aliyun Captcha Keys
          panel below the standard enable/disable card. */}
      {providerId === "zai-web-free" && <ZaiDeviceTokenPanel />}
      {/* kilo-free gets a Default Model picker panel so users can override
          the curated default (kilo-auto/free) with any free model. */}
      {providerId === "kilo-free" && <KiloFreeDefaultModelPanel />}
    </>
  );
}
