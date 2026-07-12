import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@omniroute/open-sse/utils/logger.ts";
import {
  getSettings,
  updateSettings,
  initSettingsStore,
} from "@omniroute/open-sse/executors/zai-web-free/settings-store.ts";
import { getDaemonStatus } from "@omniroute/open-sse/executors/zai-web-free/auto-refresh-daemon.ts";

const log = logger("ZAI-WEB-FREE-ADMIN");

/**
 * GET /api/providers/zai-web-free/keys
 *
 * Returns the current Z.AI Free Web settings (AccessKey, SecretKey,
 * auto-refresh configuration, pool status).
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const dataDir =
    process.env.OMNIROUTE_DATA_DIR ||
    (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
  initSettingsStore(`${dataDir}/omniroute.db`);

  const settings = getSettings();
  const daemonStatus = getDaemonStatus();

  return NextResponse.json({
    accessKey: settings.accessKey,
    secretKey: settings.secretKey,
    minPoolSize: settings.minPoolSize,
    autoRefreshEnabled: settings.autoRefreshEnabled,
    autoRefreshIntervalMs: settings.autoRefreshIntervalMs,
    daemon: daemonStatus,
  });
}

/**
 * PATCH /api/providers/zai-web-free/keys
 *
 * Update Z.AI Free Web settings. Only provided fields are updated.
 *
 * Body (all optional):
 *   {
 *     "accessKey": "LTAI...",
 *     "secretKey": "YSKfst7...",
 *     "minPoolSize": 10,
 *     "autoRefreshEnabled": true,
 *     "autoRefreshIntervalMs": 300000
 *   }
 */
export async function PATCH(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const dataDir =
    process.env.OMNIROUTE_DATA_DIR ||
    (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
  initSettingsStore(`${dataDir}/omniroute.db`);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.accessKey === "string" && body.accessKey.trim()) {
    updates.accessKey = body.accessKey.trim();
  }
  if (typeof body.secretKey === "string" && body.secretKey.trim()) {
    updates.secretKey = body.secretKey.trim();
  }
  if (typeof body.minPoolSize === "number" && body.minPoolSize >= 0 && body.minPoolSize <= 1000) {
    updates.minPoolSize = body.minPoolSize;
  }
  if (typeof body.autoRefreshEnabled === "boolean") {
    updates.autoRefreshEnabled = body.autoRefreshEnabled;
  }
  if (typeof body.autoRefreshIntervalMs === "number" && body.autoRefreshIntervalMs >= 60000) {
    updates.autoRefreshIntervalMs = body.autoRefreshIntervalMs;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  log.info?.("keys.update", {
    fields: Object.keys(updates),
    accessKey: updates.accessKey ? String(updates.accessKey).slice(0, 8) + "..." : undefined,
  });

  const updated = updateSettings(updates);

  return NextResponse.json({
    success: true,
    accessKey: updated.accessKey,
    secretKey: updated.secretKey,
    minPoolSize: updated.minPoolSize,
    autoRefreshEnabled: updated.autoRefreshEnabled,
    autoRefreshIntervalMs: updated.autoRefreshIntervalMs,
  });
}
