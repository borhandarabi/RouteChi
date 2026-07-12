#!/usr/bin/env node
/**
 * CLI wrapper for the Z.AI device-token collector.
 *
 * Usage:
 *   node scripts/dev/zai-web-free/refresh-device-tokens.mjs [--tokens 750] [--batch 3] [--headed] [--unsafe]
 *
 * This script is a thin CLI wrapper around the `refreshDeviceTokens` function
 * in `open-sse/executors/zai-web-free/token-collector.ts`. The actual logic
 * lives there so the dashboard API route and the CLI share the same code.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const ROOT = resolve(__dirname, "..", "..", "..");

// Parse CLI args
const args = process.argv.slice(2);
const tokensFlag = args.findIndex((a) => a === "--tokens");
const batchFlag = args.findIndex((a) => a === "--batch");
const parallelFlag = args.findIndex((a) => a === "--parallel");
const proxyFlag = args.findIndex((a) => a === "--proxy");
const headedFlag = args.includes("--headed");
const unsafeFlag = args.includes("--unsafe");
const helpFlag = args.includes("--help") || args.includes("-h");

if (helpFlag) {
  console.log(`Z.AI device-token collector

Usage:
  node scripts/dev/zai-web-free/refresh-device-tokens.mjs [options]

Options:
  --tokens <n>     Tokens per batch (default 750, max 1250 or 1500 with --unsafe)
  --batch <n>      Number of batches (default 3, max 9 or 25 with --unsafe)
  --parallel <n>   Parallel workers (default 1, max 3 or 5 with --unsafe)
  --proxy <url>    Proxy URL for Playwright browser (http://host:port or socks5://host:port)
  --headed         Show browser window for debugging
  --unsafe         Raise limits to 1500 tokens / 25 batches / 5 parallel
                   WARNING: increases risk of Z.AI flagging the browser and
                   temporarily banning your IP. Use with caution.
  --help, -h       Show this help message

Environment:
  OMNIROUTE_DATA_DIR  Data directory (default ~/.omniroute)
`);
  process.exit(0);
}

const tokens = tokensFlag !== -1 ? Number(args[tokensFlag + 1]) : undefined;
const batches = batchFlag !== -1 ? Number(args[batchFlag + 1]) : undefined;
const parallel = parallelFlag !== -1 ? Number(args[parallelFlag + 1]) : undefined;
const proxyUrl = proxyFlag !== -1 ? args[proxyFlag + 1] : undefined;

// Import the shared logic + pool from the open-sse package.
// We use a dynamic import with the absolute path since this script runs
// outside the Next.js/Turbopack module resolution boundary.
const { refreshDeviceTokens } = await import(
  resolve(ROOT, "open-sse/executors/zai-web-free/token-collector.ts")
);
const { addDeviceTokens, getPoolSize, initDeviceTokenPool } = await import(
  resolve(ROOT, "open-sse/executors/zai-web-free/device-token-pool.ts")
);

const dataDir =
  process.env.OMNIROUTE_DATA_DIR ||
  (process.env.HOME ? `${process.env.HOME}/.omniroute` : ".");
initDeviceTokenPool(`${dataDir}/omniroute.db`);

const maxTokens = unsafeFlag ? 1500 : 1250;
const maxBatch = unsafeFlag ? 25 : 9;
const maxParallel = unsafeFlag ? 5 : 3;

console.log(`?�Ļ Plan: ${tokens ?? 750} tokens ?� ${batches ?? 3} batches${parallel ? ` (parallel ?�${parallel})` : ""}`);
console.log(`?��� Database: ${dataDir}/omniroute.db`);
if (unsafeFlag) {
  console.log(`?��??�  UNSAFE mode: max ${maxTokens} tokens/batch, ${maxBatch} batches, ${maxParallel} parallel`);
}
if (proxyUrl) {
  console.log(`?��� Proxy: ${proxyUrl}`);
}
console.log("");

try {
  const result = await refreshDeviceTokens({
    tokens,
    batches,
    parallel,
    headed: headedFlag,
    unsafe: unsafeFlag,
    proxyUrl,
    addTokens: addDeviceTokens,
    getPoolSize,
  });
  console.log(`\n?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��`);
  console.log(`  ?�� ALL BATCHES COMPLETE`);
  console.log(`  ?��� Collected: ${result.collected} tokens`);
  console.log(`  ?��? Pool size: ${result.poolSize} tokens`);
  if (unsafeFlag) {
    console.log(`  ?��??�  Limits applied: ${result.limits.maxTokens}/${result.limits.maxBatch}/${result.limits.maxParallel}`);
  }
  console.log(`?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��`);
  process.exit(0);
} catch (err) {
  console.error(`\n?�ܽ Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
