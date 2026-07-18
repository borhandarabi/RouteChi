import type { RegistryEntry } from "../../shared.ts";

/**
 * Kilo Free — no-auth provider backed by Kilo's public OpenRouter endpoint.
 *
 * Endpoint: https://api.kilo.ai/api/openrouter
 *   - GET  /models            → { data: [{ id: "model:free", ... }] }
 *   - POST /chat/completions  → OpenAI-compatible (stream + non-stream)
 *
 * No API key, no signup, no captcha. Free models have a `:free` suffix.
 * The upstream is stateless — multi-turn works via the standard OpenAI
 * `messages` array (no server-side chat_id).
 *
 * Default model is `kilo-auto/free` (Kilo's auto-routing model that picks
 * the best available free backend per request). Users can override the
 * default per-connection via the dashboard "Default Model" picker.
 *
 * Tested 2026-07-18: 346 models total, 10 free, no rate limiting observed
 * on 10 rapid sequential requests.
 */
export const kilo_freeProvider: RegistryEntry = {
  id: "kilo-free",
  alias: "kilofree",
  format: "openai",
  executor: "default", // Uses DefaultExecutor — standard OpenAI-compatible
  baseUrl: "https://api.kilo.ai/api/openrouter",
  chatPath: "/chat/completions",
  modelsPath: "/models",
  authType: "none",
  authHeader: "none",
  passthroughModels: true, // Live /models discovery is authoritative
  defaultModel: "kilo-auto/free",
  models: [
    // ── Auto-routing ──
    { id: "kilo-auto/free", name: "Kilo Auto (Free, Auto-Routing)", contextLength: 131072 },
    // ── Free models (curated display set; live /models is authoritative) ──
    { id: "tencent/hy3:free", name: "Tencent HY3 (Free)", contextLength: 131072 },
    { id: "stepfun/step-3.7-flash:free", name: "StepFun Step 3.7 Flash (Free)", contextLength: 131072 },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "NVIDIA Nemotron 3 Nano Omni 30B (Free, Reasoning)", contextLength: 131072, supportsReasoning: true },
    { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free, Reasoning)", contextLength: 131072, supportsReasoning: true },
    { id: "deepseek/deepseek-chat:free", name: "DeepSeek Chat (Free)", contextLength: 131072 },
    { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B A22B (Free)", contextLength: 131072 },
    { id: "llama/maverick-3:free", name: "Llama Maverick 3 (Free)", contextLength: 131072 },
    { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Exp (Free)", contextLength: 1000000 },
    { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2 24B (Free)", contextLength: 131072 },
  ],
};
