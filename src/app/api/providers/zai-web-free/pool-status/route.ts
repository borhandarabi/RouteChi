import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getPoolSize, initDeviceTokenPool } from "@omniroute/open-sse/executors/zai-web-free/device-token-pool.ts";

/**
 * GET /api/providers/zai-web-free/pool-status
 *
 * Returns the current size of the Z.AI free web bridge device-token pool.
 * Used by the dashboard to show whether the pool needs a refresh (e.g.
 * "0 tokens remaining" ?�� user should click "Refresh device tokens").
 *
 * Returns:
 *   200: { poolSize: <n>, needsRefresh: <boolean> }
 *
 * `needsRefresh` is `true` when the pool has fewer than 10 tokens ?�� the
 * executor consumes up to 2 tokens per chat request, so 10 tokens is the
 * threshold below which the user should refresh to avoid running out
 * mid-conversation.
 */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const dataDir =
    process.env.OMNIROUTE_DATA_DIR ||
    (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
  initDeviceTokenPool(`${dataDir}/omniroute.db`);

  const poolSize = getPoolSize();
  return NextResponse.json({
    poolSize,
    needsRefresh: poolSize < 10,
  });
}
