import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("kilo-free provider", () => {
  it("registry entry is registered", async () => {
    const { REGISTRY } = await import(
      "../../open-sse/config/providers/index.ts"
    );
    const entry = REGISTRY["kilo-free"];
    assert.ok(entry, "kilo-free should be in REGISTRY");
    assert.equal(entry.id, "kilo-free");
    assert.equal(entry.authType, "none");
    assert.equal(entry.authHeader, "none");
    assert.equal(entry.baseUrl, "https://api.kilo.ai/api/openrouter/chat/completions");
    assert.equal(entry.defaultModel, "kilo-auto/free");
    assert.equal(entry.passthroughModels, true);
    assert.ok(entry.models.length >= 10, "should have at least 10 curated models");
  });

  it("noauth catalog includes kilo-free", async () => {
    const { NOAUTH_PROVIDERS } = await import(
      "../../src/shared/constants/providers/noauth.ts"
    );
    const entry = NOAUTH_PROVIDERS["kilo-free"];
    assert.ok(entry, "kilo-free should be in NOAUTH_PROVIDERS");
    assert.equal(entry.noAuth, true);
    assert.equal(entry.hasFree, true);
    assert.equal(entry.supportsDefaultModel, true);
    assert.equal(entry.website, "https://kilo.ai");
  });

  it("registry entry has correct chat path", async () => {
    const { REGISTRY } = await import(
      "../../open-sse/config/providers/index.ts"
    );
    const entry = REGISTRY["kilo-free"];
    assert.ok(entry.baseUrl.endsWith("/chat/completions"), "baseUrl should end with /chat/completions");
    assert.equal(entry.modelsPath, "/models");
  });

  it("default model is kilo-auto/free", async () => {
    const { REGISTRY } = await import(
      "../../open-sse/config/providers/index.ts"
    );
    const entry = REGISTRY["kilo-free"];
    assert.equal(entry.defaultModel, "kilo-auto/free");
    const autoModel = entry.models.find((m) => m.id === "kilo-auto/free");
    assert.ok(autoModel, "kilo-auto/free should be in the models list");
  });
});
