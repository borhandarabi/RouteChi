---
title: "ویرایش بافتار واگذارشده (Anthropic)"
version: 3.8.40
lastUpdated: 2026-06-28
---

# ویرایش بافتار واگذارشده (Anthropic)

ویرایش بافتار (Context Editing) واگذارشده یک قابلیت اختصاصی Claude برای مدیریت بافتار است. برخلاف
موتورهای فشرده‌سازی محلی RouteChi (Caveman، RTK، LLMLingua، خطوط لوله ترکیبی) — که بدنه درخواست را
_قبل_ از خروج از پروکسی بازنویسی می‌کنند — Context Editing از **provider** می‌خواهد بلوک‌های قدیمی
tool-use / tool-result را از پنجره بافتار در حال اجرای خود پاک کند. RouteChi فقط یک پارامتر بدنه
(`context_management.edits[]`) اضافه می‌کند؛ Claude پاک‌سازی واقعی را در برابر توکنایزر خودش انجام می‌دهد.

این قابلیت بر اساس ماهیت واگذارشده است: providerهای دیگر این پارامتر را رد می‌کنند، بنابراین RouteChi
آن را صرفاً به Claude و رله‌های سازگار با Claude-Code محدود می‌کند.

منبع حقیقت: `open-sse/config/contextEditing.ts` (شناسه‌های استراتژی، تزریق بدنه، استخراج تله‌متری)،
`open-sse/executors/base.ts` (گیت تزریق + بازگشت 400)، و `open-sse/services/compression/types.ts`
(شکل پیکربندی + پیش‌فرض).

## کارکرد `clear_tool_uses`

RouteChi یک ویرایش واحد در بدنه خروجی Anthropic Messages تزریق می‌کند:

```json
{
  "context_management": {
    "edits": [
      {
        "type": "clear_tool_uses_20250919",
        "trigger": { "type": "input_tokens", "value": 100000 },
        "keep": { "type": "tool_uses", "value": 3 }
      }
    ]
  }
}
```

- `type: "clear_tool_uses_20250919"` — شناسه استراتژی تاریخ‌دار Anthropic (`CLEAR_TOOL_USES_STRATEGY`).
- `trigger.value: 100000` — هنگامی که توکن‌های ورودی درخواست از این آستانه فراتر رود، Claude شروع به
  پاک‌سازی جفت‌های قدیمی tool-use/result می‌کند (`CONTEXT_EDITING_DEFAULT_TRIGGER_TOKENS`، پیش‌فرض Anthropic).
- `keep.value: 3` — N جفت اخیر tool-use/result دست‌نخورده نگه داشته می‌شوند
  (`CONTEXT_EDITING_DEFAULT_KEEP_TOOL_USES`).

این قابلیت بتا از طریق هدر `anthropic-beta: context-management-2025-06-27` اعلام می‌شود که RouteChi
قبلاً در درخواست‌های Claude ارسال می‌کند.

تزریق توسط `applyContextEditingToBody()` انجام می‌شود و **idempotent** است: اگر یک ویرایش `clear_tool_uses`
از قبل روی بدنه وجود داشته باشد (توسط فراخوانی قبلی اضافه شده یا توسط کلاینت ارسال شده باشد)، بدنه
دست‌نخورده باقی می‌ماند. اگر یک ویرایش `clear_thinking_20251015` نیز وجود داشته باشد، RouteChi
ویرایش `clear_thinking` را به‌صورت پایدار به ابتدا مرتب می‌کند، زیرا Anthropic نیازمند است که `clear_thinking`
در آرایه `edits[]` قبل از `clear_tool_uses` قرار گیرد.

## کلید فعال‌سازی هر ترکیب

Context Editing به‌صورت پیش‌فرض **خاموش** و opt-in است. کلید toggler یک boolean واحد است که در
پیکربندی فشرده‌سازی منتقل می‌شود:

- کلید تنظیمات: `contextEditing.enabled` (camelCase — **نه** `context_editing` / `context-editing`).
- نوع: `ContextEditingConfig { enabled: boolean }` در
  `open-sse/services/compression/types.ts`.
- پیش‌فرض: `DEFAULT_CONTEXT_EDITING_CONFIG = { enabled: false }`.
- طرح‌واره Zod: `contextEditingConfigSchema` در `src/shared/validation/compressionConfigSchemas.ts`.
- ذخیره‌سازی: همراه سایر تنظیمات فشرده‌سازی ذخیره می‌شود (نرمالایز شده در
  `src/lib/db/compression.ts`).

در داشبورد، toggler در hub فشرده‌سازی قرار دارد
(`src/app/(dashboard)/dashboard/context/combos/CompressionHub.tsx`) و از طریق `saveSettings()`
مقدار `{ contextEditing: { enabled: … } }` را برمی‌گرداند. از آنجا که روی شیء تنظیمات فشرده‌سازی
سوار می‌شود، با پروفایل فشرده‌سازی هر ترکیب ترکیب می‌شود به جای اینکه یک سطح کاملاً مستقل باشد —
پیکربندی فقط پرچم روشن/خاموش را نگه می‌دارد؛ همه آستانه‌ها (`trigger`، `keep`) همان ثابت‌های مستند شده
بالا هستند.

## گیت‌گذاری اختصاصی Claude

تزریق فقط برای Claude واقعی یا رله‌های سازگار با Claude-Code انجام می‌شود. گیت در
`open-sse/executors/base.ts` به این شکل است:

```ts
if (
  (this.provider === "claude" || isClaudeCodeCompatible(this.provider)) &&
  contextEditing?.enabled &&
  !contextEditingDisabled
) {
  applyContextEditingToBody(transformedBody, { enabled: true });
}
```

- `this.provider === "claude"` — کلید/OAuth واقعی Anthropic.
- `isClaudeCodeCompatible(this.provider)` — رله‌هایی که شناسه provider آن‌ها با پیشوند
  `anthropic-compatible-cc-` شروع می‌شود (آن‌ها سازگاری Claude Code را اعلام می‌کنند، بنابراین رله‌هایی
  هستند که به احتمال زیاد بتا را می‌پذیرند). به `open-sse/services/provider.ts` مراجعه کنید.

عمداً **مستثنی شده‌اند**:

- `claude-web` — یک رله مرورگر با شکل درخواست `create_conversation_params` که هرگز
  `context_management` را نمی‌بیند.
- رله‌های عمومی `anthropic-compatible-*` (بدون پیشوند `-cc-`) — اندپوینت‌های شخص ثالث با
  پشتیبانی بتای نامطمئن.

Providerهای غیر Claude هرگز حتی زمانی که toggler روشن است، پارامتر `context_management` را دریافت نمی‌کنند.

## بازگشت 400 / پوشش رله

یک رله سازگار با Claude ممکن است بتا را اعلام کند اما همچنان پارامتر `context_management` را با
HTTP 400 رد کند. برای تخریب بی‌غرشی به جای شکست درخواست، executor پارامتر را حذف کرده و
**یک‌بار** همان URL را دوباره امتحان می‌کند:

```ts
if (
  response.status === HTTP_STATUS.BAD_REQUEST &&
  contextEditing?.enabled &&
  !contextEditingDisabled &&
  transformedBody?.context_management !== undefined
) {
  const errText = await response
    .clone()
    .text()
    .catch(() => "");
  if (/context[_-]management|context editing/i.test(errText)) {
    contextEditingDisabled = true;
    delete transformedBody.context_management;
    let retryBody = JSON.stringify(transformedBody);
    if (isClaudeCodeCompatible(this.provider) || this.provider === "claude") {
      retryBody = await signRequestBody(retryBody);
    }
    response = await fetch(url, { ...fetchOptions, body: retryBody });
  }
}
```

رفتار:

1. فقط هنگام `400` با فعال بودن context editing و وجود واقعی `context_management` در بدنه اجرا می‌شود.
2. بدنه خطای 400 از طریق `clone()` خوانده می‌شود تا پاسخ اصلی برای مسیر غیرتطبیق دست‌نخورده باقی بماند.
3. متن خطا باید با `/context[_-]management|context editing/i` تطابق داشته باشد — یک خطای 400 نامرتبط
   (مثلاً `max_tokens must be >= 1`) بازگشت را **راه‌اندازی نمی‌کند**؛ خطای اصلی انتشار می‌یابد.
4. در صورت تطابق، `contextEditingDisabled = true` تنظیم می‌شود (که تزریق مجدد را در صورت ساخت
   یک `transformedBody` تازه برای URL retry/fallback سرکوب می‌کند)، `context_management` را حذف می‌کند،
   بدنه را برای رله‌های Claude / سازگار با Claude-Code دوباره امضا می‌کند (`signRequestBody`)، و
   همان URL را یک‌بار امتحان می‌کند.

Claude واقعی بتا را در `ANTHROPIC_BETA_BASE` حمل می‌کند و وارد این مسیر بازگشتی نمی‌شود.

## تله‌متری `applied_edits`

پس از یک پاسخ Claude، RouteChi ثبت می‌کند که provider چقدر بافتار را واقعاً پاک کرده است. این کار
**استریم نمی‌شود** — از بدنه پاسخ غیر استریمی، به‌صورت best-effort استخراج می‌شود و هرگز روی پاسخ
تأثیر نمی‌گذارد (شکست‌های تله‌متری بلعیده می‌شوند).

- استخراج: `extractContextEditingTelemetry(responseBody)` در `open-sse/config/contextEditing.ts`.
  این تابع `applied_edits` را در سه مکان (دفاعی بر اساس شکل پاسخ) بررسی می‌کند:
  - `context_management.applied_edits`
  - `usage.context_management.applied_edits`
  - `usage.applied_edits`
- فیلدهای هر ویرایش که از هر مدخل خوانده می‌شوند: `cleared_input_tokens` و `cleared_tool_uses`
  (snake_case، بومی Anthropic)، با جایگزینی camelCase `clearedInputTokens` / `clearedToolUses`.
- هنگامی که آرایه `applied_edits` یافت نشود یا چیزی واقعاً پاک نشده باشد، `null` برمی‌گرداند.

شکل رسید `ContextEditingTelemetry { editCount, clearedInputTokens, clearedToolUses }` است.
ثبت در `open-sse/handlers/chatCore.ts` (محدود به `provider === "claude"`) از طریق
`recordContextEditingTelemetry()` (`src/lib/db/compressionAnalytics.ts`) انجام می‌شود که یک ردیف
تحلیل فشرده‌سازی با این برچسب‌ها می‌نویسد:

- `mode: "context-editing"`
- `engine: "context-editing"`
- `tokens_saved` / `original_tokens` = تعداد توکن‌های ورودی پاک‌شده
- `request_id` با پسوند `::context-editing`

بنابراین پاک‌سازی واگذارشده در تحلیل فشرده‌سازی در کنار موتورهای محلی، تحت برچسب موتور
`context-editing` ظاهر می‌شود و از صرفه‌جویی‌های RTK/Caveman/LLMLingua متمایز است.

## رابطه با موتورهای فشرده‌سازی محلی

| جنبه             | موتورهای محلی (Caveman / RTK / LLMLingua / ترکیبی) | ویرایش بافتار واگذارشده                     |
| ----------------- | --------------------------------------------------- | ------------------------------------------- |
| محل اجرا          | در RouteChi، قبل از خروج درخواست از پروکسی          | در provider (Claude)، سمت سرور              |
| آنچه ویرایش می‌کند | متن پرامپت / بافتار / tool-result                   | بلوک‌های قدیمی tool-use / tool-result       |
| محدوده provider   | همه providerها                                      | فقط `claude` + `anthropic-compatible-cc-*`  |
| کلید toggler      | تنظیمات حالت فشرده‌سازی                            | `contextEditing.enabled`                    |
| حالت شکست         | Fail-open (متن اصلی)                                | بازگشت 400: حذف پارامتر، امتحان مجدد یک‌بار |
| تله‌متری صرفه‌جویی | `engine: <engine id>`                               | `engine: "context-editing"`                 |

این دو مکمل یکدیگرند: موتورهای محلی بایت‌هایی که RouteChi ارسال می‌کند را فشرده می‌کنند؛ Context Editing
به Claude اجازه می‌دهد بافتار در حال اجرا را در طول نوبت‌ها هرس کند. می‌توان آن‌ها را با هم فعال کرد.

## مراجعه کنید به

- [COMPRESSION_ENGINES.md](./COMPRESSION_ENGINES.md) — رجیستری موتور و موتورهای فشرده‌سازی محلی
- [RTK_COMPRESSION.md](./RTK_COMPRESSION.md) — فشرده‌سازی خروجی فرمان/ابزار
- [../frameworks/MCP-SERVER.md](../frameworks/MCP-SERVER.md) — فشرده‌سازی توضیحات MCP و
  کاهش تعدادی ابزار
- منبع: `open-sse/config/contextEditing.ts`، `open-sse/executors/base.ts`،
  `open-sse/services/compression/types.ts`، `src/lib/db/compressionAnalytics.ts`
