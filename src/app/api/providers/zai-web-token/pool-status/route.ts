import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getPoolSize, initDeviceTokenPool } from "@omniroute/open-sse/executors/zai-web-free/device-token-pool.ts";

/**
 * GET /api/providers/zai-web-token/pool-status
 *
 * Returns the current size of the shared Z.AI device-token pool.
 * Both `zai-web-free` (guest) and `zai-web-token` (JWT) providers share
 * the same pool ?�� captcha verification is required for both.
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
