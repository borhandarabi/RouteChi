---
title: "Playground Studio"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Playground Studio

> **قابلیت:** Playground Studio — فضای کاری یکپارچه‌ی آزمون هوش مصنوعی برای `/dashboard/playground`.
> **پلان‌ها:** `17-playground-studio-redesign.plan.md` + `_orchestration/master-plan-group-C.md`
> **وضعیت:** در نسخه‌ی v3.8.6 منتشر شد

---

## مرور کلی

Playground Studio مسیر `/dashboard/playground` را از یک ویرایشگر ساده‌ی مبتنی بر Monaco به
یک فضای کاری آزمون تمام‌عیار تبدیل می‌کند. این قابلیت `page.tsx` قدیمی را با یک پوسته‌ی
`PlaygroundStudio` جایگزین می‌کند که چهار تب و یک پنل پیکربندی مشترک را رندر می‌کند.

```
┌ Playground ──────────────────────────────────────────────────────────┐
│ [💬 Chat] [⚖ Compare] [{} API] [🔧 Build]     142↑ 38↓ · $0.002 </>│
├──────────────────────────────────────────┬───────────────────────────┤
│  {active tab content}                    │ ─ Config                  │
│                                          │ Endpoint  [chat ∨]        │
│                                          │ Model     [gpt-5.4 ∨]     │
│                                          │ System    [textarea]      │
│                                          │ Temp      ▕▕▔▔ 0.7        │
│                                          │ Presets [▾ load][save]    │
│                                          │ [✨ Improve prompt]        │
└──────────────────────────────────────────┴───────────────────────────┘
```

---

## تب‌ها

### تب Chat

`ChatPlayground.tsx` را به یک میز کار چندنوبته‌ی استریمی ارتقا می‌دهد:

- رندر کامل markdown از طریق `MarkdownMessage.tsx` (بلوک‌های کد، جدول‌ها، فهرست‌ها، پیوندها).
- prompt سیستمی از پنل Config مشترک تامین می‌شود.
- توکن/هزینه به ازای هر پیام (توکن‌های prompt + completion).
- بازتولید آخرین پاسخ.
- ارسال به `POST /v1/chat/completions` با استریم SSE.

### تب Compare

تمایز کلیدی برای یک پراکسی: اجرای ۱ prompt روی حداکثر **۴ مدل به‌صورت موازی**.

- تا ۴ ستون، هر کدام مستقلاً از `/v1/chat/completions` استریم می‌گیرند.
- دکمه‌ی `+ Add model` (میان‌بر Cmd+K) برای افزودن ستون‌ها.
- `Run all ▶` تمام استریم‌ها را هم‌زمان از طریق `Promise.all` + `AbortController` به‌ازای‌هرستون راه‌اندازی می‌کند.
- **Cancel all** سراسری هر استریم در حال اجرا را لغو می‌کند.
- `ProviderMetrics` به‌ازای‌هرستون TTFT، TPS، توکن‌ها و هزینه‌ی تخمینی را در زمان واقعی نشان می‌دهد.
- معیارها با برچسب **"client-side estimate"** (D12) — اندازه‌گیری از اولین قطعه‌ی SSE.

### تب API

۱۰۰٪ از ویرایشگر اصلی Monaco را برای کاربران پیشرفته نگه می‌دارد (D14):

- ۱۰ نقطه‌ی پایانی: chat completions، completions، embeddings، images، audio، speech، transcriptions، moderations، rerank، search.
- بارگذاری فایل چندوجهی.
- استریم SSE با خروجی در زمان واقعی.
- به‌صورت `ApiTab.tsx` بسته‌بندی شده (بارگذاری تنبل، `ssr: false`).

### تب Build

رابط ابزارها/فراخوانی تابع و خروجی ساختاریافته:

- `ToolsBuilder.tsx` — افزودن/ویرایش/حذف `tools[]` با ویرایشگر طرح‌واره‌ی JSON به ازای هر ابزار.
  پارامترها را از طریق `ToolDefinitionSchema` (Zod) اعتبارسنجی می‌کند.
- `StructuredOutputEditor.tsx` — تغییر حالت JSON mode + ویرایشگر طرح‌واره‌ی JSON.
  پاسخ را در برابر طرح‌واره از طریق `StructuredOutputSchema` (Zod) اعتبارسنجی می‌کند.
- درخواست را با `tools[]` و/یا `response_format` به `/v1/chat/completions` ارسال می‌کند.

---

## پنل Config (مشترک)

`StudioConfigPane.tsx` — همیشه قابل‌مشاهده، قابل جمع‌شدن.

| Field          | Component             | Notes                                                                  |
| -------------- | --------------------- | ---------------------------------------------------------------------- |
| Endpoint       | `<select>`            | 10 options matching `PlaygroundEndpoint`                               |
| Model          | `<input>`             | free text, e.g. `openai/gpt-4o`                                        |
| System prompt  | `<textarea>`          | fed into all tabs                                                      |
| Parameters     | `ParamSliders`        | temperature, max_tokens, top_p, presence/frequency penalty, seed, stop |
| Presets        | `PresetPicker`        | load/save named config snapshots (persisted in DB)                     |
| Improve prompt | `ImprovePromptButton` | opens quota-warning modal, calls `/api/playground/improve-prompt`      |

وضعیت به `PlaygroundStudio.tsx` منتقل می‌شود و به همه‌ی تب‌ها پاس داده می‌شود. جابه‌جایی تب‌ها
وضعیت پیکربندی را حفظ می‌کند.

---

## نوار بالایی

`StudioTopBar.tsx`:

- تعویض تب (role="tablist").
- `TokenCostCounter` — نمایش زنده‌ی توکن (↑/↓) و هزینه‌ی تخمینی.
- دکمه‌ی Export code (`</>`) — `ExportCodeModal` را باز می‌کند.

---

## مودال Export Code

`ExportCodeModal.tsx` از `codeExport.ts` برای تولید قطعه‌های کد curl / Python / TypeScript
از `PlaygroundState` فعلی استفاده می‌کند. جای‌گاه کلید API همواره `$OMNIROUTE_API_KEY` است (D11).

---

## بهبود‌دهنده‌ی Prompt

`ImprovePromptButton.tsx` → `useImprovePrompt.ts` → `POST /api/playground/improve-prompt`:

1. مودال هشدار می‌دهد «سهمیه مصرف خواهد شد».
2. هنگام تأیید، `{ system, prompt, model, tone }` را به مسیر ارسال می‌کند.
3. مسیر به‌صورت داخلی `/v1/chat/completions` را با `promptImprover.META_SYSTEM_PROMPT` فراخوانی می‌کند.
4. `{ improvedSystem?, improvedPrompt?, tokensIn, tokensOut }` را برمی‌گرداند.
5. رابط کاربری prompt سیستمی پنل Config و prompt کاربر تب Chat را به‌روزرسانی می‌کند.

---

## Presetها

`PresetPicker.tsx` → `usePresets.ts` → `/api/playground/presets/*`:

- در جدول SQLite ی `playground_presets` ذخیره می‌شوند (مهاجرت `084_playground_presets.sql`).
- هر preset ذخیره می‌کند: `name`، `endpoint`، `model`، `system`، `params_json`، `created_at`.
- CRUD: فهرست `GET`، `POST` ایجاد، `GET /:id`، `PUT /:id`، `DELETE /:id`.

---

## معیارهای استریم

`useStreamMetrics.ts` + `streamMetrics.ts` (تابع خالص):

- `start()` — زمان شروع درخواست را ثبت می‌کند.
- `onFirstChunk()` — TTFT را ثبت می‌کند.
- `onChunk(n)` — شمارش توکن‌های completion را انباشته می‌کند.
- `finish(usage?)` — معیارهای نهایی را محاسبه می‌کند: `ttftMs`، `totalMs`، `tps`، `tokensIn`، `tokensOut`، `costUsd`.
- قیمت‌گذاری از جدول ایستا در `src/lib/playground/types.ts` (با برچسب «estimated» — D13).

---

## مسیرهای Backend

| Method   | Path                             | Handler                                                                                   |
| -------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST`   | `/api/playground/improve-prompt` | Zod-validates `ImprovePromptRequestSchema`; calls `/v1/chat/completions` with meta-prompt |
| `GET`    | `/api/playground/presets`        | Returns `{ presets: PlaygroundPresetListItem[] }`                                         |
| `POST`   | `/api/playground/presets`        | Creates preset; validates `PlaygroundPresetCreateSchema`                                  |
| `GET`    | `/api/playground/presets/:id`    | Returns one preset or 404                                                                 |
| `PUT`    | `/api/playground/presets/:id`    | Partial update                                                                            |
| `DELETE` | `/api/playground/presets/:id`    | 204                                                                                       |

احراز هویت: اختیاری (`REQUIRE_API_KEY`). خطاها از طریق `buildErrorBody()` (Hard Rule #12).

---

## فایل‌های کلیدی

| Path                                                                       | Purpose                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/app/(dashboard)/dashboard/playground/PlaygroundStudio.tsx`            | Shell component, tab orchestrator                   |
| `src/app/(dashboard)/dashboard/playground/components/StudioTopBar.tsx`     | Tabs + counter + export button                      |
| `src/app/(dashboard)/dashboard/playground/components/StudioConfigPane.tsx` | Shared config panel                                 |
| `src/app/(dashboard)/dashboard/playground/components/tabs/ChatTab.tsx`     | Chat workbench                                      |
| `src/app/(dashboard)/dashboard/playground/components/tabs/CompareTab.tsx`  | Multi-model compare                                 |
| `src/app/(dashboard)/dashboard/playground/components/tabs/ApiTab.tsx`      | Monaco editor (preserved)                           |
| `src/app/(dashboard)/dashboard/playground/components/tabs/BuildTab.tsx`    | Tools + structured output                           |
| `src/app/(dashboard)/dashboard/playground/components/ExportCodeModal.tsx`  | Code export modal                                   |
| `src/app/(dashboard)/dashboard/playground/components/CompareColumn.tsx`    | Single compare column                               |
| `src/app/(dashboard)/dashboard/playground/components/ProviderMetrics.tsx`  | TTFT/TPS display                                    |
| `src/app/(dashboard)/dashboard/playground/hooks/useStreamMetrics.ts`       | Client-side metric hook                             |
| `src/app/(dashboard)/dashboard/playground/hooks/usePresets.ts`             | Presets CRUD hook                                   |
| `src/app/(dashboard)/dashboard/playground/hooks/useImprovePrompt.ts`       | Improve-prompt hook                                 |
| `src/lib/playground/codeExport.ts`                                         | curl/Python/TS generator (shared with Search Tools) |
| `src/lib/playground/promptImprover.ts`                                     | Meta-prompt builder                                 |
| `src/lib/playground/streamMetrics.ts`                                      | Pure metrics computation                            |
| `src/lib/db/playgroundPresets.ts`                                          | DB module (CRUD)                                    |
| `src/app/api/playground/improve-prompt/route.ts`                           | Improve-prompt REST route                           |
| `src/app/api/playground/presets/route.ts`                                  | Presets list + create                               |
| `src/app/api/playground/presets/[id]/route.ts`                             | Presets get/update/delete                           |
| `src/lib/db/migrations/084_playground_presets.sql`                         | DB migration                                        |

---

## رفع اشکال

| Symptom                                | Cause                         | Fix                                                                             |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Monaco editor not rendering in API tab | SSR loaded Monaco             | Verify `ApiTab` uses `dynamic(..., { ssr: false })`                             |
| Compare streams fire sequentially      | Wrong `Promise.all` usage     | All stream starts must be dispatched in one `Promise.all` call                  |
| Metrics show `null` TTFT               | First chunk handler not wired | Check `useStreamMetrics.onFirstChunk()` is called in the SSE reader loop        |
| Preset not persisting                  | DB migration not run          | Run `npm run db:migrate` or restart the server (migration auto-runs on startup) |
| Improve prompt returns 502             | Model not set in Config       | User must enter a model name in the Config pane before improving                |
| Export code shows `MISSING_API_KEY`    | Placeholder not inserted      | `codeExport.ts` always uses `API_KEY_PLACEHOLDER = "$OMNIROUTE_API_KEY"`        |

---

## ارجاعات

- طرح جامع: `_tasks/features-v3.8.6/refactorpages/_orchestration/master-plan-group-C.md`
- طرح قابلیت: `_tasks/features-v3.8.6/refactorpages/17-playground-studio-redesign.plan.md`
- خروجی کد: `src/lib/playground/codeExport.ts`
- بهبود‌دهنده‌ی prompt: `src/lib/playground/promptImprover.ts`
- Search Tools Studio: `docs/frameworks/SEARCH_TOOLS_STUDIO.md`
