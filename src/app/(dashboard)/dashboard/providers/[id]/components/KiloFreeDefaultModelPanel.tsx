"use client";

import { useCallback, useEffect, useState } from "react";
import { useNotificationStore } from "@/store/notificationStore";

const KILO_FREE_MODELS = [
  { id: "kilo-auto/free", name: "Kilo Auto (Free, Auto-Routing)" },
  { id: "tencent/hy3:free", name: "Tencent HY3 (Free)" },
  { id: "stepfun/step-3.7-flash:free", name: "StepFun Step 3.7 Flash (Free)" },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "NVIDIA Nemotron 3 Nano Omni 30B (Free, Reasoning)" },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free, Reasoning)" },
  { id: "deepseek/deepseek-chat:free", name: "DeepSeek Chat (Free)" },
  { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B A22B (Free)" },
  { id: "llama/maverick-3:free", name: "Llama Maverick 3 (Free)" },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Exp (Free)" },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2 24B (Free)" },
] as const;

const DEFAULT_DEFAULT_MODEL = "kilo-auto/free";
const PROVIDER_ID = "kilo-free";

/**
 * Dashboard panel for kilo-free's Default Model picker.
 *
 * Kilo Free is a no-auth provider — there is no DB connection row. The user's
 * chosen default model is persisted in the key_value table (namespace
 * "kilo_free") and loaded by `loadNoAuthProviderSpecificData` on every request.
 *
 * When the user doesn't set one, the registry entry's `defaultModel`
 * (`kilo-auto/free`) is used as the fallback.
 */
export default function KiloFreeDefaultModelPanel() {
  const notify = useNotificationStore();
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const stored = data?.kiloFreeDefaultModel;
        if (typeof stored === "string" && stored.trim()) {
          setCurrentModel(stored);
        }
      } catch {
        // best-effort — fall back to registry default
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadModel();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(
    async (model: string) => {
      setSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kiloFreeDefaultModel: model }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message || "Failed to save default model");
        }
        setCurrentModel(model);
        notify.success(`Default model set to ${model}`);
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [notify]
  );

  return (
    <div className="mt-6 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-text-main">Default Model</h3>
      <p className="mt-1 text-xs text-text-muted">
        Choose the model used when a request omits <code className="rounded bg-surface px-1 py-0.5 text-[11px]">model</code>.
        Default is <code className="rounded bg-surface px-1 py-0.5 text-[11px]">{DEFAULT_DEFAULT_MODEL}</code> (auto-routing).
      </p>

      <div className="mt-3 flex items-center gap-3">
        <select
          value={currentModel}
          onChange={(e) => handleSave(e.target.value)}
          disabled={loading || saving}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none disabled:opacity-50"
        >
          {KILO_FREE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {saving && (
          <span className="text-xs text-text-muted animate-pulse">Saving…</span>
        )}
      </div>

      <p className="mt-3 text-[11px] text-text-muted">
        Tip: <code className="rounded bg-surface px-1 py-0.5">{DEFAULT_DEFAULT_MODEL}</code> auto-routes to the best available free backend.
        Reasoning models (<code className="rounded bg-surface px-1 py-0.5">nemotron</code>, <code className="rounded bg-surface px-1 py-0.5">deepseek-r1</code>) emit <code className="rounded bg-surface px-1 py-0.5">reasoning_content</code>.
      </p>
    </div>
  );
}
