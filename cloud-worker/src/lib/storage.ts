/**
 * KV storage abstraction for sync bundles.
 *
 * Stores the full bundle under `bundle:<machineId>` and maintains a
 * lightweight index under `index:<machineId>` for quick lookups.
 */

import type { SyncBundle, Env } from "../types.ts";

const KEY_PREFIX = "bundle:";
const INDEX_PREFIX = "index:";
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Store a sync bundle in KV.
 */
export async function storeBundle(
  env: Env,
  machineId: string,
  bundle: SyncBundle
): Promise<void> {
  const key = `${KEY_PREFIX}${machineId}`;
  bundle.syncedAt = new Date().toISOString();
  await env.BUNDLES.put(key, JSON.stringify(bundle), {
    expirationTtl: TTL_SECONDS,
  });
}

/**
 * Retrieve a sync bundle from KV.
 * Returns null if not found or expired.
 */
export async function getBundle(
  env: Env,
  machineId: string
): Promise<SyncBundle | null> {
  const key = `${KEY_PREFIX}${machineId}`;
  const raw = await env.BUNDLES.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncBundle;
  } catch {
    return null;
  }
}

/**
 * Delete a sync bundle from KV.
 */
export async function deleteBundle(
  env: Env,
  machineId: string
): Promise<void> {
  const key = `${KEY_PREFIX}${machineId}`;
  await env.BUNDLES.delete(key);
}
