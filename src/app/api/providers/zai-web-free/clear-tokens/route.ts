import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { clearPool, initDeviceTokenPool } from "@omniroute/open-sse/executors/zai-web-free/device-token-pool.ts";

/**
 * POST /api/providers/zai-web-free/clear-tokens
 *
 * Clears all device tokens from the Z.AI free web bridge pool. Useful when
 * the existing tokens have expired (Aliyun periodically invalidates old
 * device tokens) and the user wants to start fresh before running a
 * refresh.
 *
 * Returns:
 *   200: { success: true, cleared: true }
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const dataDir =
    process.env.OMNIROUTE_DATA_DIR ||
    (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
  initDeviceTokenPool(`${dataDir}/omniroute.db`);

  clearPool();
  return NextResponse.json({ success: true, cleared: true });
}
