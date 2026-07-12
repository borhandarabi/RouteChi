import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from "@omniroute/open-sse/utils/logger.ts";
import { extractAliyunKeys, verifyKeys } from "@omniroute/open-sse/executors/zai-web-free/key-extractor.ts";

const log = logger("ZAI-WEB-FREE-ADMIN");

/**
 * POST /api/providers/zai-web-free/extract-key
 *
 * Automatically extracts the Aliyun AccessKey and SecretKey from the
 * AliyunCaptcha.js bundle served by alicdn. This is a maintenance tool
 * for when Aliyun rotates the keys and the hardcoded values stop working.
 *
 * Flow:
 *   1. Downloads AliyunCaptcha.js from o.alicdn.com
 *   2. Finds all base64-encoded ciphertexts
 *   3. Tries AES-128-CBC decryption (key="FqJB6iRNVYdEGpwb", IV=WordArray)
 *   4. Identifies AccessKey (starts with "LTAI") and SecretKey (30 chars)
 *   5. Verifies the keys by calling Aliyun's InitCaptchaV3 API
 *
 * Returns:
 *   200: { success: true, accessKey, secretKey, verified, source, candidates, timestamp }
 *   500: { error: "Extraction failed: <message>" }
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  log.info?.("extract_key.start");

  try {
    // Step 1: Extract keys from AliyunCaptcha.js
    const result = await extractAliyunKeys();

    if (!result.accessKey) {
      log.warn?.("extract_key.not_found", { candidates: result.candidates });
      return NextResponse.json(
        {
          success: false,
          error: `Could not extract AccessKey from AliyunCaptcha.js (${result.candidates} candidates tried). The AES obfuscation constants may have changed.`,
          candidates: result.candidates,
        },
        { status: 500 }
      );
    }

    // Step 2: Verify the keys work
    let verified = false;
    if (result.secretKey) {
      log.info?.("extract_key.verifying", {
        accessKey: result.accessKey.slice(0, 8) + "...",
      });
      verified = await verifyKeys(result.accessKey, result.secretKey);
      log.info?.("extract_key.verified", { verified });
    }

    log.info?.("extract_key.complete", {
      accessKey: result.accessKey.slice(0, 8) + "...",
      secretKey: result.secretKey ? result.secretKey.slice(0, 8) + "..." : "not found",
      verified,
    });

    return NextResponse.json({
      success: true,
      accessKey: result.accessKey,
      secretKey: result.secretKey,
      verified,
      source: result.source,
      candidates: result.candidates,
      timestamp: result.timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error?.("extract_key.failed", { error: message });
    return NextResponse.json(
      { error: `Extraction failed: ${message}` },
      { status: 500 }
    );
  }
}
