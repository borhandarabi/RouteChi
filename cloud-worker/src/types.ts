/**
 * Type definitions for the RouteChi Cloud Worker.
 */

/** A provider connection from the sync bundle. */
export interface BundleProvider {
  id: string;
  provider: string;
  authType?: string;
  name?: string;
  apiKey?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  defaultModel?: string | null;
  isActive?: boolean;
  testStatus?: string;
  providerSpecificData?: Record<string, unknown>;
  priority?: number;
  globalPriority?: number | null;
}

/** An API key from the sync bundle. */
export interface BundleApiKey {
  id: string;
  name?: string;
  key: string;
  machineId?: string;
  isActive?: boolean;
  allowedModels?: string[];
  allowedCombos?: string[];
  allowedConnections?: string[];
}

/** A combo from the sync bundle. */
export interface BundleCombo {
  id: string;
  name?: string;
  strategy?: string;
  models?: unknown[];
  sortOrder?: number;
}

/** The full sync bundle stored in KV. */
export interface SyncBundle {
  version: string;
  providers: BundleProvider[];
  providerNodes?: unknown[];
  modelAliases?: Record<string, unknown>;
  combos: BundleCombo[];
  apiKeys: BundleApiKey[];
  settings: Record<string, unknown>;
  /** Timestamp of last sync (ISO string). */
  syncedAt?: string;
}

/** The response to a sync POST. */
export interface SyncResponse {
  success: boolean;
  message: string;
  version?: string;
  changes?: Record<string, unknown>;
  data?: {
    providers?: BundleProvider[];
  };
  createdKey?: string;
}

/** Environment bindings for the worker. */
export interface Env {
  BUNDLES: KVNamespace;
  CLOUD_SYNC_SECRET: string;
  ALLOWED_UPSTREAM_HOSTS?: string;
}
