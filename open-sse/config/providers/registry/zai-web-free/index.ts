import type { RegistryEntry } from "../../shared.ts";

/**
 * Z.AI Free Web ?�� chat.z.ai consumer web chat (free, captcha-based).
 *
 * This is NOT the official Z.AI API (`api.z.ai/api/anthropic/v1/messages` ?��
 * that's exposed separately as the `zai` provider with `authType: "apikey"`).
 * The free web bridge targets `chat.z.ai/api/v2/chat/completions` and uses:
 *
 *   - Guest JWT auth (free, no API key) ?�� obtained via `/api/v1/auths/guest`
 *   - Aliyun CaptchaV3 verification on every request (in-memory, no browser)
 *   - HMAC-SHA256 request signature (`X-Signature` header)
 *   - Device-token pool (collected via Playwright, consumed FIFO)
 *
 * The user can optionally supply their own Z.AI JWT (`providerSpecificData.token`)
 * to skip guest init and unlock all models (guest sessions only allow glm-4.7).
 *
 * Ported from GLM-Free-API (Go) by izaart95-jpg.
 *
 * Device tokens must be refreshed periodically via the dashboard
 * "Refresh device tokens" button (POST `/api/providers/zai-web-free/refresh-tokens`).
 */
export const zai_web_freeProvider: RegistryEntry = {
  id: "zai-web-free",
  alias: "zaifree",
  format: "openai",
  executor: "zai-web-free",
  baseUrl: "https://chat.z.ai",
  chatPath: "/api/v2/chat/completions",
  authType: "none", // Auth handled inside the executor (guest JWT + captcha)
  authHeader: "none",
  forceStream: true, // Z.AI always streams; non-stream clients get a buffered JSON
  models: [
    {
      id: "glm-4.7",
      name: "GLM 4.7 (Free, Guest)",
      contextLength: 131072,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
  ],
};
