/**
 * Model resolver — derives the model list from the sync bundle.
 *
 * Models come from two sources:
 * 1. Provider `defaultModel` fields (explicitly set by the user)
 * 2. Model aliases (named model groupings)
 *
 * The worker doesn't implement full combo routing — it just lists
 * available models so clients can discover them via GET /v1/models.
 */

import type { SyncBundle } from "../types.ts";

interface ModelEntry {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

/**
 * Build an OpenAI-compatible /v1/models response from the bundle.
 */
export function buildModelsResponse(bundle: SyncBundle): {
  object: string;
  data: ModelEntry[];
} {
  const models = new Map<string, ModelEntry>();
  const now = Math.floor(Date.now() / 1000);

  // 1. Add provider default models
  for (const provider of bundle.providers) {
    if (provider.isActive === false) continue;
    const dm = provider.defaultModel;
    if (typeof dm === "string" && dm.trim() && !models.has(dm)) {
      models.set(dm, {
        id: dm,
        object: "model",
        created: now,
        owned_by: provider.provider || "routechi",
      });
    }
  }

  // 2. Add model aliases
  if (bundle.modelAliases && typeof bundle.modelAliases === "object") {
    for (const alias of Object.keys(bundle.modelAliases)) {
      if (!models.has(alias)) {
        models.set(alias, {
          id: alias,
          object: "model",
          created: now,
          owned_by: "routechi",
        });
      }
    }
  }

  // 3. Add combo names as "models" (so clients can route to them)
  for (const combo of bundle.combos) {
    if (combo.name && !models.has(combo.name)) {
      models.set(combo.name, {
        id: combo.name,
        object: "model",
        created: now,
        owned_by: "routechi-combo",
      });
    }
  }

  return {
    object: "list",
    data: [...models.values()],
  };
}

/**
 * Resolve which provider to use for a given model.
 * Strategy: find the first active provider whose defaultModel matches,
 * or whose providerSpecificData indicates support for that model.
 *
 * This is a simplified resolver — the local RouteChi instance handles
 * full combo routing. The worker just needs to find a provider that
 * can serve the request.
 */
export function resolveProviderForModel(
  bundle: SyncBundle,
  model: string
): SyncBundle["providers"][0] | null {
  const activeProviders = bundle.providers.filter((p) => p.isActive !== false);
  if (activeProviders.length === 0) return null;

  // 1. Exact match on defaultModel
  const exactMatch = activeProviders.find((p) => p.defaultModel === model);
  if (exactMatch) return exactMatch;

  // 2. Provider prefix match (e.g. model "openai/gpt-4" → provider "openai")
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) {
    const prefix = model.slice(0, slashIdx);
    const prefixMatch = activeProviders.find((p) => p.provider === prefix);
    if (prefixMatch) return prefixMatch;
  }

  // 3. First active provider (fallback — let the upstream decide)
  return activeProviders[0];
}
