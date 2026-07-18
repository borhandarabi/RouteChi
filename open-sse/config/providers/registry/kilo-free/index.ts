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
  baseUrl: "https://api.kilo.ai/api/openrouter/chat/completions",
  modelsPath: "/models",
  authType: "none",
  authHeader: "none",
  passthroughModels: true, // Live /models discovery is authoritative
  defaultModel: "kilo-auto/free",
  models: [
    // ── Auto-routing (virtual model, not in /models but works on /chat/completions) ──
    { id: "kilo-auto/free", name: "Kilo Auto (Free, Auto-Routing)", contextLength: 131072 },
    // ── Free models (curated display set; live /models is authoritative) ──
    // Updated 2026-07-18 to match live /models endpoint (10 free models)
    { id: "tencent/hy3:free", name: "Tencent HY3 (Free)", contextLength: 131072 },
    { id: "stepfun/step-3.7-flash:free", name: "StepFun Step 3.7 Flash (Free)", contextLength: 131072 },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "NVIDIA Nemotron 3 Nano Omni 30B (Free, Reasoning)", contextLength: 131072, supportsReasoning: true },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "NVIDIA Nemotron 3 Super 120B (Free)", contextLength: 131072 },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA Nemotron 3 Ultra 550B (Free)", contextLength: 131072 },
    { id: "nvidia/nemotron-3.5-content-safety:free", name: "NVIDIA Nemotron 3.5 Content Safety (Free)", contextLength: 131072 },
    { id: "cohere/north-mini-code:free", name: "Cohere North Mini Code (Free)", contextLength: 131072 },
    { id: "kwaipilot/kat-coder-pro-v2.5:free", name: "Kwai Pilot Kat Coder Pro v2.5 (Free)", contextLength: 131072 },
    { id: "poolside/laguna-m.1:free", name: "Poolside Laguna M.1 (Free)", contextLength: 131072 },
    { id: "poolside/laguna-xs-2.1:free", name: "Poolside Laguna XS 2.1 (Free)", contextLength: 131072 },
  ],
};
