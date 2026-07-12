"use client";

/**
 * Prerequisite check for Z.AI providers.
 *
 * Before a user enables zai-web-free or adds a zai-web-token connection,
 * this component checks that:
 *   1. Playwright + Chromium are installed
 *   2. The OmniRoute database is accessible
 *   3. (zai-web-free only) Device token pool is not empty
 *
 * Shows a warning banner with install instructions if any check fails.
 *
 * IMPORTANT: The /prerequisites endpoint launches a headless Chromium browser
 * (~3-5s per call). To avoid hammering it on every React re-render, we:
 *   1. Use a module-level cache so multiple instances share the same result
 *   2. Only fetch once per mount (useEffect with empty deps + ref guard)
 *   3. The endpoint itself also caches for 60s server-side
 */

import { useEffect, useRef, useState } from "react";

interface PrerequisiteResult {
  playwrightInstalled: boolean;
  chromiumInstalled: boolean;
  poolSize: number | null;
  loading: boolean;
}

// Module-level cache: shared across all instances of this hook on the page.
// Refreshed every 60s to avoid stale data, but prevents multiple concurrent
// fetches when the component re-mounts due to parent re-renders.
const PREREQ_CACHE_TTL_MS = 60_000;
let _sharedPrereqCache: {
  result: PrerequisiteResult;
  fetchedAt: number;
} | null = null;
let _inflightPrereqFetch: Promise<PrerequisiteResult> | null = null;

async function fetchPrerequisites(): Promise<PrerequisiteResult> {
  // Return cached result if fresh
  if (_sharedPrereqCache) {
    const age = Date.now() - _sharedPrereqCache.fetchedAt;
    if (age < PREREQ_CACHE_TTL_MS) {
      return _sharedPrereqCache.result;
    }
  }

  // Dedupe concurrent fetches
  if (_inflightPrereqFetch) {
    return _inflightPrereqFetch;
  }

  _inflightPrereqFetch = (async () => {
    try {
      const resp = await fetch("/api/providers/zai-web-free/prerequisites", {
        cache: "no-store",
      });
      if (!resp.ok) {
        const result: PrerequisiteResult = {
          playwrightInstalled: false,
          chromiumInstalled: false,
          poolSize: null,
          loading: false,
        };
        _sharedPrereqCache = { result, fetchedAt: Date.now() };
        return result;
      }
      const data = await resp.json();
      const result: PrerequisiteResult = {
        playwrightInstalled: data.playwrightInstalled ?? false,
        chromiumInstalled: data.chromiumInstalled ?? false,
        poolSize: data.poolSize ?? null,
        loading: false,
      };
      _sharedPrereqCache = { result, fetchedAt: Date.now() };
      return result;
    } catch {
      const result: PrerequisiteResult = {
        playwrightInstalled: false,
        chromiumInstalled: false,
        poolSize: null,
        loading: false,
      };
      // Don't cache errors - allow retry on next mount
      return result;
    } finally {
      _inflightPrereqFetch = null;
    }
  })();

  return _inflightPrereqFetch;
}

export function useZaiPrerequisites(
  _providerId: string
): PrerequisiteResult & { checked: boolean } {
  const [result, setResult] = useState<PrerequisiteResult>(() => {
    // Initialize from cache if available (instant render, no loading flash)
    if (_sharedPrereqCache) {
      const age = Date.now() - _sharedPrereqCache.fetchedAt;
      if (age < PREREQ_CACHE_TTL_MS) {
        return _sharedPrereqCache.result;
      }
    }
    return {
      playwrightInstalled: false,
      chromiumInstalled: false,
      poolSize: null,
      loading: true,
    };
  });

  const hasFetched = useRef(false);

  useEffect(() => {
    // Only fetch once per mount, and only if cache is stale
    if (hasFetched.current) return;
    hasFetched.current = true;

    // If cache is fresh, use it without a separate render cycle
    if (_sharedPrereqCache) {
      const age = Date.now() - _sharedPrereqCache.fetchedAt;
      if (age < PREREQ_CACHE_TTL_MS) {
        // Defer the state update to avoid synchronous setState in effect
        Promise.resolve().then(() => setResult(_sharedPrereqCache!.result));
        return;
      }
    }

    let cancelled = false;
    void fetchPrerequisites().then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...result, checked: !result.loading };
}

interface ZaiPrerequisiteBannerProps {
  providerId: string;
  /** Whether to show the device token pool warning (only for zai-web-free) */
  showPoolWarning?: boolean;
}

/**
 * Banner that shows prerequisite warnings for Z.AI providers.
 * Returns null if all prerequisites are met.
 */
export function ZaiPrerequisiteBanner({
  providerId,
  showPoolWarning = false,
}: ZaiPrerequisiteBannerProps) {
  const { playwrightInstalled, chromiumInstalled, poolSize, loading, checked } =
    useZaiPrerequisites(providerId);

  if (loading || !checked) return null;

  const warnings: Array<{ icon: string; message: string; detail?: string }> = [];

  if (!playwrightInstalled) {
    warnings.push({
      icon: "download",
      message: "Playwright is not installed",
      detail: "Run: npm install playwright && npx playwright install chromium",
    });
  } else if (!chromiumInstalled) {
    warnings.push({
      icon: "download",
      message: "Chromium browser is not installed",
      detail: "Run: npx playwright install chromium",
    });
  }

  if (showPoolWarning && poolSize === 0 && playwrightInstalled && chromiumInstalled) {
    warnings.push({
      icon: "token",
      message: "Device token pool is empty",
      detail:
        "Click 'Refresh Device Tokens' to collect tokens via Playwright. Without tokens, the captcha fallback (browser method) will be used for every request (~10s per request).",
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="material-symbols-outlined mt-0.5 text-[18px] text-amber-600">
            {w.icon}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{w.message}</p>
            {w.detail && <p className="mt-0.5 text-xs text-text-muted">{w.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
