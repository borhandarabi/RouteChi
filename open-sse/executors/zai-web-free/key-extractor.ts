/**
 * Aliyun AccessKey Extractor ?�� browser-based extraction.
 *
 * Loads chat.z.ai in Playwright, intercepts captcha API requests,
 * extracts AccessKeyId from the POST body, and verifies the SecretKey
 * via HMAC-SHA1 signature check.
 *
 * This is the only reliable extraction method because:
 *   1. The ciphertexts in the RE reports are redacted
 *   2. The AliyunCaptcha.js obfuscates ciphertexts via a string-array decoder
 *   3. The browser always sends the real (deobfuscated) values in API requests
 *
 * @module zai-web-free/key-extractor
 */

import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";
import { logger } from "../../utils/logger.ts";

const log = logger("ZAI-KEY-EXTRACTOR");

const ZAI_URL = "https://chat.z.ai";
const KNOWN_SECRET = "YSKfst7GaVkXwZYvVihJsKF9r89koz";

export interface ExtractedKeys {
  accessKey: string | null;
  secretKey: string | null;
  source: string;
  timestamp: string;
  verified: boolean;
}

function urlEncode(s: string): string {
  let out = "";
  for (const ch of String(s)) {
    const code = ch.charCodeAt(0);
    if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === 45 ||
      code === 95 ||
      code === 46 ||
      code === 126
    ) {
      out += ch;
    } else {
      for (const b of Buffer.from(ch, "utf-8")) {
        out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
      }
    }
  }
  return out;
}

/**
 * Extract the Aliyun AccessKey by intercepting chat.z.ai's captcha requests.
 *
 * Flow:
 *   1. Launch headless Chromium
 *   2. Load chat.z.ai
 *   3. Send a message to trigger the captcha flow
 *   4. Intercept InitCaptchaV3/VerifyCaptchaV3 requests
 *   5. Extract AccessKeyId from the POST body
 *   6. Verify the SecretKey by checking the HMAC-SHA1 signature
 *
 * @returns {Promise<ExtractedKeys>}
 */
export async function extractAliyunKeys(): Promise<ExtractedKeys> {
  log.info?.("extract.start");

  let browser: { close: () => Promise<void> } | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const captchaRequests: Array<{
      accessKeyId: string;
      signature: string;
      fullBody: string;
    }> = [];

    context.on("request", (request: { url: () => string; postData: () => string | null }) => {
      const url = request.url();
      if (url.includes("captcha-open-southeast.aliyuncs.com")) {
        const postData = request.postData() || "";
        const params = new URLSearchParams(postData);
        const accessKeyId = params.get("AccessKeyId");
        const signature = params.get("Signature");
        if (accessKeyId && signature) {
          captchaRequests.push({ accessKeyId, signature, fullBody: postData });
          log.debug?.("extract.request", { accessKeyId: accessKeyId.slice(0, 12) + "..." });
        }
      }
    });

    log.info?.("extract.loading", { url: ZAI_URL });
    await page.goto(ZAI_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await Promise.all([
      page.locator("#model-selector-glm-4_7-button").waitFor({ timeout: 15000 }),
      page.locator("#chat-input").waitFor({ timeout: 15000 }),
    ]);

    // Trigger captcha
    await page.locator("#chat-input").fill("Hi");
    await page.locator("#send-message-button").click();

    // Wait for captcha requests
    log.info?.("extract.waiting");
    for (let i = 0; i < 20 && captchaRequests.length === 0; i++) {
      await page.waitForTimeout(1000);
    }
    // Give a bit more time to capture all requests
    await page.waitForTimeout(3000);

    await browser.close();
    browser = null;

    if (captchaRequests.length === 0) {
      log.warn?.("extract.no_requests");
      return {
        accessKey: null,
        secretKey: null,
        source: "browser (no requests captured)",
        timestamp: new Date().toISOString(),
        verified: false,
      };
    }

    // Extract unique AccessKeyIds
    const accessKeys = [...new Set(captchaRequests.map((r) => r.accessKeyId))];
    const accessKey = accessKeys[0];
    log.info?.("extract.found", { accessKey: accessKey.slice(0, 12) + "..." });

    // Verify SecretKey via HMAC-SHA1 signature check
    let verified = false;
    for (const req of captchaRequests) {
      const params = new URLSearchParams(req.fullBody);
      const signature = params.get("Signature");
      params.delete("Signature");

      const keys = [...params.keys()].sort();
      const canonical = keys
        .map((k) => urlEncode(k) + "=" + urlEncode(params.get(k) || ""))
        .join("&");
      const stringToSign = "POST&" + urlEncode("/") + "&" + urlEncode(canonical);
      const signingKey = Buffer.from(KNOWN_SECRET + "&", "utf-8");
      const computedSig = Buffer.from(
        createHmac("sha1", signingKey).update(Buffer.from(stringToSign, "utf-8")).digest()
      ).toString("base64");

      if (computedSig === signature) {
        verified = true;
        log.info?.("extract.secret_verified");
        break;
      }
    }

    return {
      accessKey,
      secretKey: verified ? KNOWN_SECRET : null,
      source: "browser interception (chat.z.ai captcha request)",
      timestamp: new Date().toISOString(),
      verified,
    };
  } catch (err) {
    log.error?.("extract.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      accessKey: null,
      secretKey: null,
      source: `error: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
      verified: false,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Verify that keys work by calling Aliyun's InitCaptchaV3 API.
 */
export async function verifyKeys(accessKey: string, secretKey: string): Promise<boolean> {
  const { __test__ } = await import("./captcha.ts");
  const { generateAliyunSignature } = __test__;

  const SCENE_ID = "didk33e0";
  const params: Record<string, string> = {
    AccessKeyId: accessKey,
    Action: "InitCaptchaV3",
    Format: "JSON",
    Language: "en",
    Mode: "popup",
    SceneId: SCENE_ID,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    UpLang: "true",
    Version: "2023-03-05",
  };
  params.Signature = generateAliyunSignature(params, secretKey);

  const body = Object.keys(params)
    .sort()
    .map((k) => urlEncode(k) + "=" + urlEncode(params[k]))
    .join("&");

  try {
    const resp = await fetch("https://no8xfe.captcha-open-southeast.aliyuncs.com/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await resp.text();
    const json = JSON.parse(text);
    return json.Success === true && !!json.CertifyId;
  } catch {
    return false;
  }
}
