import type { RegistryEntry } from "../../shared.ts";

/**
 * Z.AI Token Web ?�� chat.z.ai consumer web chat with user-supplied JWT.
 *
 * This is a sibling of `zai-web-free` that uses a user-supplied Z.AI JWT
 * instead of a guest session. The JWT unlocks all models (GLM-5.2, GLM-5.1,
 * GLM-5-Turbo, GLM-5v-Turbo, glm-4.7) instead of just glm-4.7.
 *
 * The user obtains the JWT from chat.z.ai ?�� DevTools ?�� Application ?�� Local
 * Storage ?�� key "token". It's pasted into the credential field and stored
 * in `providerSpecificData.token`.
 *
 * Same executor (`zai-web-free`) ?�� the executor checks for
 * `providerSpecificData.token` and, if present, skips guest init and uses
 * the supplied JWT directly. The captcha + signature flow is identical.
 *
 * Auth: `kind: "token"` (JWT, not cookie) ?�� displayed in the Web Cookie
 * Providers section of the dashboard because it's a web-session credential
 * (not an API key for the official api.z.ai endpoint).
 */
export const zai_web_tokenProvider: RegistryEntry = {
  id: "zai-web-token",
  alias: "zaitoken",
  format: "openai",
  executor: "zai-web-free", // Reuses the same executor ?�� it checks for hardcodedToken
  baseUrl: "https://chat.z.ai",
  chatPath: "/api/v2/chat/completions",
  authType: "token", // User-supplied JWT
  authHeader: "bearer",
  forceStream: true, // Z.AI always streams; non-stream clients get a buffered JSON
  models: [
    {
      id: "glm-5.2",
      name: "GLM 5.2",
      contextLength: 131072,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
    {
      id: "GLM-5.1",
      name: "GLM 5.1",
      contextLength: 131072,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
    {
      id: "GLM-5-Turbo",
      name: "GLM 5 Turbo",
      contextLength: 131072,
      maxOutputTokens: 8192,
    },
    {
      id: "GLM-5v-Turbo",
      name: "GLM 5V Turbo (Vision)",
      contextLength: 131072,
      maxOutputTokens: 8192,
      supportsVision: true,
    },
    {
      id: "glm-4.7",
      name: "GLM 4.7",
      contextLength: 131072,
      maxOutputTokens: 8192,
      supportsReasoning: true,
    },
  ],
};
