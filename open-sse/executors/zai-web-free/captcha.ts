/**
 * Aliyun CaptchaV3 in-memory verifier ?�� ported from GLM-Free-API (Go).
 *
 * This module produces a `captcha_verify_param` value that Z.AI requires on
 * every chat request. The flow is:
 *
 *   1. `initCaptcha()` ?�� POST to Aliyun's InitCaptchaV3 endpoint with an
 *      HMAC-SHA1-signed request body to obtain a `certifyId`.
 *   2. `generateArg(certifyId)` ?�� RC4-like stream cipher (KSA + PRGA over a
 *      64-byte permutation table) that scrambles the certifyId.
 *   3. `aliHash(jsonBytes, "0000")` ?�� custom 16-byte-state hash (NOT SHA).
 *   4. `zlibCompress(aliHash + jsonBytes)` + base64 ?�� `dataValue`.
 *   5. `encrypt(dataValue)` ?�� second RC4-like pass with a different key.
 *   6. `verifyCaptcha(certifyId, encryptedData, deviceToken)` ?�� POST to
 *      Aliyun's VerifyCaptchaV3 endpoint ?�� returns `securityToken`.
 *   7. Final `captcha_verify_param` = base64(JSON{certifyId, isSign, sceneId, securityToken}).
 *
 * The `deviceToken` consumed in step 6 comes from the device-token pool
 * (collected separately via Playwright ?�� see
 * `scripts/dev/zai-web-free/refresh-device-tokens.mjs`).
 *
 * All crypto primitives are pure-JS implementations matching the Go reference
 * byte-for-byte. The Go original uses signed-int arithmetic with wrap-around;
 * we mirror that with `>>> 0` and `& 0xFF` to keep results identical.
 *
 * @module zai-web-free/captcha
 */

import { createHmac } from "node:crypto";
import { deflateSync } from "node:zlib";
import { Buffer } from "node:buffer";

// ?��?�� Aliyun captcha credentials ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��
// The AccessKey and SecretKey are read from the settings store at runtime
// (stored in the OmniRoute DB, editable via the dashboard). If not configured,
// they default to the values from the GLM-Free-API Go source.
//
// Per .assets/reports/aliyun-captcha-report.md ?�B, these keys are embedded
// in AliyunCaptcha.js as AES-128-CBC-encrypted ciphertexts. The decryption
// process uses:
//   AES key = "FqJB6iRNVYdEGpwb" (16-byte ASCII, the ACCESS_SEC constant)
//   AES IV  = WordArray [808530483, 875902519, 943276354, 1128547654]
//           = bytes "0123456789ABCDEF" (16 bytes)
//   ciphertext_ID     = base64("7JLsB18MnA7GX3d6LxErT1sGT68xcVuOAoxz0b7vVzY=")
//   ciphertext_SECRET = base64("n9jH0yACW8YrgOBcM0v7u45+/bfozcSz8ZpvzGBXg3E=")
//
// If Aliyun rotates the keys:
//   1. Click "Extract AccessKey" in the dashboard (runs browser interception)
//   2. Or update the keys manually in the dashboard settings
//   3. Or update the defaults in settings-store.ts
import { getAccessKey, getSecretKey } from "./settings-store.ts";

const SCENE_ID = "didk33e0";

const INIT_CAPTCHA_URL = "https://no8xfe.captcha-open-southeast.aliyuncs.com/";
const VERIFY_CAPTCHA_URL = "https://no8xfe-verify.captcha-open-southeast.aliyuncs.com/";

// ?��?�� RC4-like permutation table (64-byte state) ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��
// From GLM-Free-API main.go argPermTable. This is a fixed 64-element
// permutation that both `generateArg` and `encrypt` use as their initial
// state. The KSA pass mixes in a key-dependent value, then the PRGA pass
// scrambles the input bytes.
const ARG_PERM_TABLE = [
  32, 50, 10, 51, 6, 44, 37, 16, 46, 11, 62, 19, 43, 25, 23, 30,
  60, 33, 53, 34, 7, 26, 12, 48, 5, 2, 20, 4, 61, 13, 47, 49,
  18, 29, 27, 22, 1, 17, 39, 56, 41, 38, 55, 31, 15, 58, 52, 40,
  8, 57, 45, 35, 59, 36, 42, 54, 63, 3, 24, 28, 14, 9, 0, 21,
];

const ARG_CONSTANT = "4xrihv8zb8tf1mfj";
const ENCRYPT_KEY = "3e627e1b4c63f913";

const HEX_LOWER = "0123456789abcdef";

const MAX_TOKEN_RETRIES = 2;

// ?��?�� UUID + timestamp helpers ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��

function randomUUID(): string {
  // crypto.randomUUID is available in Node 19+; fall back to manual construction.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getTimestampUTC(): string {
  // Aliyun expects seconds-since-epoch in UTC, ISO 8601 format (YYYY-MM-DDThh:mm:ssZ).
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ?��?�� URL encoding (matching Go's urlEncode with empty safe set) ?��?��?��?��?��?��?��?��?��?��?��?��
// The Go reference uses a custom urlEncode that percent-encodes everything
// except unreserved chars (A-Z a-z 0-9 - _ . ~). This matches RFC 3986.
function urlEncode(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (
      (code >= 48 && code <= 57) || // 0-9
      (code >= 65 && code <= 90) || // A-Z
      (code >= 97 && code <= 122) || // a-z
      code === 45 || // -
      code === 95 || // _
      code === 46 || // .
      code === 126 // ~
    ) {
      out += ch;
    } else {
      // UTF-8 encode then percent-encode each byte
      const bytes = Buffer.from(ch, "utf-8");
      for (const b of bytes) {
        out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
      }
    }
  }
  return out;
}

function fromHex(c: string): number {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 102) return code - 87;
  if (code >= 65 && code <= 70) return code - 55;
  return 0;
}

function base64Encode(data: Buffer | Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function base64Decode(s: string): Buffer {
  return Buffer.from(s, "base64");
}

function hmacSHA1(key: Buffer, msg: Buffer): Buffer {
  return createHmac("sha1", key).update(msg).digest();
}

// ?��?�� Aliyun request signature (HMAC-SHA1 over canonical query string) ?��?��?��?��?��?��
// Aliyun's signature v1.0 algorithm: sort params alphabetically, build
// "k1=v1&k2=v2&..." (URL-encoded), prepend "POST&%2F&" + URL-encoded canonical,
// HMAC-SHA1 with key = secretKey + "&", base64 the result.
function generateAliyunSignature(params: Record<string, string>, secKey: string): string {
  const keys = Object.keys(params).sort();
  const canonical = keys.map((k) => `${urlEncode(k)}=${urlEncode(params[k])}`).join("&");
  const stringToSign = `POST&${urlEncode("/")}&${urlEncode(canonical)}`;
  const signingKey = Buffer.from(secKey + "&", "utf-8");
  return base64Encode(hmacSHA1(signingKey, Buffer.from(stringToSign, "utf-8")));
}

function buildQueryString(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${urlEncode(k)}=${urlEncode(params[k])}`).join("&");
}

// ?��?�� RC4-like stream cipher (KSA + PRGA over 64-byte state) ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��
// This is NOT standard RC4 ?�� the state is 64 bytes (not 256), and the KSA/PRGA
// formulas use a different mixing function. Ported byte-for-byte from Go's
// `generateArg` and `encrypt` functions.

function rc4LikeCipher(input: Buffer, key: string): Buffer {
  // Work on a copy of the perm table (mutable)
  const r = ARG_PERM_TABLE.slice();
  const n = Buffer.from(key, "utf-8");
  const rlen = 64;

  // KSA ?�� mix the table using the key
  let i = 0;
  let j = 0;
  while (i < rlen) {
    // Go: j = (((i + j + r[i] + r[j]) >> 1) + int(n[i%len(n)])) & (rlen - 1)
    // Use signed 32-bit arithmetic to match Go's int overflow behavior
    j = (((i + j + r[i] + r[j]) >> 1) + n[i % n.length]) & (rlen - 1);
    if (i !== j) {
      const tmp = r[i];
      r[i] = r[j];
      r[j] = tmp;
    }
    i++;
  }

  // PRGA ?�� scramble the input bytes
  const out = Buffer.alloc(input.length);
  let e = 0;
  let a = 0;
  for (let idx = 0; idx < input.length; idx++) {
    a = ((e ^ a) + (r[e] ^ r[a])) & (rlen - 1);
    if (e !== a) {
      const tmp = r[e];
      r[e] = r[a];
      r[a] = tmp;
    }
    // Go uses int (signed) arithmetic ?�� mirror with | 0 to keep it signed,
    // then mask to 0xFF for the final byte value.
    let m = (input[idx] | 0) + e + r[e] - a - r[a];
    m = m ^ (r[e] + r[a]);
    m = m ^ r[(r[e] + r[a]) & (rlen - 1)];
    m = m & 255;
    out[idx] = m;
    e = (e + 1) & (rlen - 1);
  }
  return out;
}

// ?��?�� generateArg (RC4-like cipher applied to certifyId) ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��
function generateArg(certifyId: string): string {
  // Match Go: urlEncode then url-decode (effectively a no-op for safe chars,
  // but kept for byte-for-byte faithfulness with the Go implementation).
  const encoded = urlEncode(certifyId);
  const input = Buffer.from(encoded, "utf-8");
  // URL-decode: convert %XX back to raw bytes
  const decoded: number[] = [];
  for (let i = 0; i < input.length; ) {
    if (input[i] === 0x25 && i + 2 < input.length) { // '%'
      decoded.push((fromHex(String.fromCharCode(input[i + 1])) << 4) | fromHex(String.fromCharCode(input[i + 2])));
      i += 3;
    } else {
      decoded.push(input[i]);
      i++;
    }
  }
  const ciphered = rc4LikeCipher(Buffer.from(decoded), ARG_CONSTANT);
  return base64Encode(ciphered);
}

// ?��?�� aliHash (custom 16-byte-state hash) ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��
// This is a custom hash function used by Aliyun's captcha verification. It
// uses a 16-element state array (not 64 like the RC4-like cipher) and a
// similar KSA+PRGA structure, but with different formulas.
function aliHash(inputStr: string, saltStr: string): string {
  const o = Buffer.from(inputStr, "utf-8");
  const r = Buffer.from(saltStr, "utf-8");
  const aLen = o.length;
  const m = r.length;

  // 16-element signed-int state (use Int16Array to preserve signed semantics)
  const e = new Int16Array(16);
  for (let i = 0; i < 16; i++) {
    e[i] = (i << 4) + (i % 16);
  }
  const f = 16;

  // KSA ?�� mix the state using the salt
  let i = 0;
  let j = 0;
  while (i < f) {
    j = (((i + j + e[i] + e[j]) >> 1) + r[i % m]) & (f - 1);
    const tmp = e[i];
    e[i] = e[j];
    e[j] = tmp;
    i++;
  }

  // PRGA ?�� absorb each input byte into the state
  let idx = 0;
  let p = 0;
  let q = 0;
  while (idx < aLen) {
    q = ((p ^ q) + (e[p] ^ e[q])) & (f - 1);
    const tmp = e[p];
    e[p] = e[q];
    e[q] = tmp;
    let C = (o[idx] | 0) + p + q;
    C = C ^ e[p] ^ e[q];
    C = C & 255;
    e[p] = C;
    p = (p + 1) & (f - 1);
    idx++;
  }

  // Final mixing pass ?�� 2*f XOR rounds
  for (let step = 0; step < 2 * f; step++) {
    const pos = step % f;
    if (pos !== 0) {
      e[pos] = e[pos] ^ e[pos - 1];
    } else {
      e[0] = e[0] ^ e[f - 1];
    }
  }

  // Output as 32-char lowercase hex string
  let result = "";
  for (let k = 0; k < 16; k++) {
    const b = e[k] & 0xff;
    result += HEX_LOWER[(b >> 4) & 0xf];
    result += HEX_LOWER[b & 0xf];
  }
  return result;
}

// ?��?�� zlib compress (Node's zlib.deflateSync matches Go's zlib) ?��?��?��?��?��?��?��?��?��?��?��?��?��
function zlibCompress(data: Buffer): Buffer {
  // Go's zlib.NewWriter uses default compression level. Node's deflateSync
  // also defaults to Z_DEFAULT_COMPRESSION (-1 ?�� level 6). The output bytes
  // may differ slightly between implementations due to header/flush
  // differences, but Aliyun's verify endpoint accepts any valid zlib stream.
  return deflateSync(data, { level: 6 });
}

// ?��?�� encrypt (RC4-like cipher applied to the compressed+base64'd data) ?��?��?��?��?��
function encrypt(plaintext: Buffer): string {
  const ciphered = rc4LikeCipher(plaintext, ENCRYPT_KEY);
  return base64Encode(ciphered);
}

// ?��?�� Track JSON structure (matches Go's Track / TrackList types) ?��?��?��?��?��?��?��?��?��?��?��
interface TrackList {
  fi: string;
  ks: string;
  mc: string;
  mp: string;
  mu: string;
  startTime: number;
  tc: string;
  te: string;
  tmv: string;
}

interface Track {
  TrackList: TrackList;
  TrackStartTime: number;
  VerifyTime: number;
  arg: string;
}

// ?��?�� HTTP POST helper for Aliyun endpoints ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��
async function httpPost(targetUrl: string, body: string, extraHeaders: Record<string, string> = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...extraHeaders,
      },
      body,
      signal: controller.signal,
    });
    const text = await resp.text();
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ?��?�� Step 1: initCaptcha ?�� obtain certifyId ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��

async function initCaptcha(): Promise<string> {
  const params: Record<string, string> = {
    AccessKeyId: getAccessKey(),
    Action: "InitCaptchaV3",
    Format: "JSON",
    Language: "en",
    Mode: "popup",
    SceneId: SCENE_ID,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: getTimestampUTC(),
    UpLang: "true",
    Version: "2023-03-05",
  };
  params.Signature = generateAliyunSignature(params, getSecretKey());

  const body = buildQueryString(params);
  const resp = await httpPost(INIT_CAPTCHA_URL, body);

  const result = JSON.parse(resp) as { CertifyId?: string };
  if (!result.CertifyId) {
    throw new Error(`initCaptcha: no CertifyId in response: ${resp}`);
  }
  return result.CertifyId;
}

// ?��?�� Step 6: verifyCaptcha ?�� obtain securityToken ?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��
async function verifyCaptcha(
  certifyId: string,
  dataValue: string,
  deviceToken: string
): Promise<string> {
  const cvpJson = JSON.stringify({
    certifyId,
    data: dataValue,
    deviceToken,
    sceneId: SCENE_ID,
  });

  const params: Record<string, string> = {
    AccessKeyId: getAccessKey(),
    Action: "VerifyCaptchaV3",
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    Timestamp: getTimestampUTC(),
    Version: "2023-03-05",
    SceneId: SCENE_ID,
    CertifyId: certifyId,
    CaptchaVerifyParam: cvpJson,
    SignatureNonce: randomUUID(),
  };
  params.Signature = generateAliyunSignature(params, getSecretKey());

  const body = buildQueryString(params);
  const resp = await httpPost(VERIFY_CAPTCHA_URL, body, { Referer: "" });

  const respJson = JSON.parse(resp) as {
    Success?: boolean;
    Result?: {
      VerifyResult?: boolean;
      securityToken?: string;
      certifyId?: string;
    };
  };

  if (respJson.Success && respJson.Result?.VerifyResult) {
    const st = respJson.Result.securityToken;
    const ci = respJson.Result.certifyId;
    if (st && ci) {
      const payload = JSON.stringify({
        certifyId: ci,
        isSign: true,
        sceneId: SCENE_ID,
        securityToken: st,
      });
      return base64Encode(Buffer.from(payload, "utf-8"));
    }
    console.error(`[Captcha] verifyCaptcha: Success=true but securityToken/certifyId empty. Response: ${resp}`);
  } else if (respJson.Success) {
    console.error(`[Captcha] verifyCaptcha: VerifyResult=false for deviceToken=${deviceToken.slice(0, 20)}...`);
  } else {
    console.error(`[Captcha] verifyCaptcha: request unsuccessful. Response: ${resp}`);
  }
  return "";
}

// ?��?�� tryCompute ?�� run one full captcha round with a single device token ?��?��?��?��
async function tryCompute(
  deviceToken: string,
  consumeToken: (token: string) => void
): Promise<string> {
  const certifyId = await initCaptcha();
  const argValue = generateArg(certifyId);
  const ct = Date.now();

  const track: Track = {
    TrackList: {
      fi: "",
      ks: "",
      mc: "",
      mp: "",
      mu: "",
      startTime: ct,
      tc: "",
      te: "",
      tmv: "",
    },
    TrackStartTime: ct,
    VerifyTime: ct + 300,
    arg: argValue,
  };
  const jsonBytes = Buffer.from(JSON.stringify(track), "utf-8");

  const h = aliHash(jsonBytes.toString("utf-8"), "0000");
  const combined = Buffer.from(h + jsonBytes.toString("utf-8"), "utf-8");
  const compressed = zlibCompress(combined);
  const fb64 = base64Encode(compressed);
  const finalVal = encrypt(Buffer.from(fb64, "utf-8"));

  // Always consume the token after use (whether verify succeeds or fails).
  consumeToken(deviceToken);

  const payload = await verifyCaptcha(certifyId, finalVal, deviceToken);
  return payload;
}

/**
 * Compute the final `captcha_verify_param` value by trying up to
 * `MAX_TOKEN_RETRIES` device tokens from the pool. Returns the base64-encoded
 * payload string, or throws if all retries are exhausted.
 *
 * @param getNextToken  Pool accessor that returns the next device token (FIFO).
 * @param consumeToken  Pool mutator that removes a token after use.
 */
export async function getCaptchaVerifyParam(
  getNextToken: () => string | null,
  consumeToken: (token: string) => void
): Promise<string> {
  for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
    const deviceToken = getNextToken();
    if (!deviceToken) {
      throw new Error(`No device tokens remaining (attempt ${attempt + 1}/${MAX_TOKEN_RETRIES})`);
    }
    try {
      const payload = await tryCompute(deviceToken, consumeToken);
      if (payload) return payload;
      console.error(`[Captcha] tryCompute returned empty payload for token ${deviceToken.slice(0, 20)}...`);
    } catch (err) {
      // Token failed ?�� log the error and try the next one
      console.error(`[Captcha] tryCompute failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All ${MAX_TOKEN_RETRIES} token retries exhausted`);
}

// Re-export internal helpers for unit testing
export const __test__ = {
  generateArg,
  aliHash,
  encrypt,
  zlibCompress,
  rc4LikeCipher,
  generateAliyunSignature,
  urlEncode,
  base64Encode,
  base64Decode,
};
