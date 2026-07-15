---
title: "یکپارچه‌سازی OpenCode"
version: 3.8.40
lastUpdated: 2026-06-28
---

# یکپارچه‌سازی OpenCode

> **وضعیت:** به‌صورت عمومی در دسترس.
> **مخاطب:** اپراتورهایی که OpenCode را به یک استقرار OmniRoute متصل می‌کنند.
> **منبع حقیقت (schema پیکربندی):** `src/shared/services/opencodeConfig.ts`
> **منبع حقیقت (پکیج npm):** `@omniroute/opencode-provider/` (workspace قابل انتشار)

[OpenCode](https://opencode.ai) یک کلاینت هوش مصنوعی CLI/دسکتاپ agentمحور است. فهرست ارائه‌دهندگان خود را از `~/.config/opencode/opencode.json` (یا `opencode.jsonc`) می‌خواند و از schema موجود در `https://opencode.ai/config.json` پیروی می‌کند. OmniRoute خود را به‌عنوان یکی از آن ارائه‌دهندگان به OpenCode معرفی می‌کند — هر درخواست از سطح `/v1` سازگار با OpenAI استاندارد OmniRoute عبور می‌کند، بنابراین OpenCode به‌طور خودکار از مسیریابی Auto-Combo، شکننده‌های مدار (circuit breakers)، سیاست‌های کلید، قابلیت مشاهده و غیره بهره‌مند می‌شود.

**دو مسیر یکپارچه‌سازی پشتیبانی‌شده** وجود دارد. یکی را انتخاب کنید — هر دو همان پیکربندی را تولید می‌کنند.

---

## مسیر ۱ — تولیدکننده CLI (بدون npm install)

برای کاربران نهایی توصیه می‌شود. همراه OmniRoute عرضه می‌شود. `opencode.json` را در محل خود می‌نویسد.

```bash
# پس از نصب OmniRoute (npm i -g @omniroute/cli یا clone محلی)
omniroute config opencode \
  --baseUrl http://localhost:20128 \
  --apiKey "$OMNIROUTE_API_KEY"
```

در پس‌زمینه CLI تابع `mergeOpenCodeConfigText()` (`src/shared/services/opencodeConfig.ts:104`) را فراخوانی می‌کند، تا یک `opencode.json` موجود سایر ارائه‌دهندگان و کامنت‌های خود را حفظ کند. ورودی OmniRoute به‌صورت اتمیک اضافه/جایگزین می‌شود.

فایل نتیجه‌شده (فهرست مدل پیش‌فرض):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "omniroute": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OmniRoute",
      "options": {
        "baseURL": "http://localhost:20128/v1",
        "apiKey": "<your-key>",
      },
      "models": {
        "claude-opus-4-5-thinking": { "name": "claude-opus-4-5-thinking" },
        "claude-sonnet-4-5-thinking": { "name": "claude-sonnet-4-5-thinking" },
        "gemini-3.1-pro-high": { "name": "gemini-3.1-pro-high" },
        "gemini-3-flash": { "name": "gemini-3-flash" },
      },
    },
  },
}
```

---

## مسیر ۲ — پکیج npm `@omniroute/opencode-provider`

زمانی توصیه می‌شود که پیکربندی را از Node/TS اسکریپت‌نویسی می‌کنید (CI pipelines، monorepoها، گردش‌کارهای نصب‌کننده سفارشی).

```bash
npm install --save-dev @omniroute/opencode-provider
```

```ts
import { writeFileSync } from "node:fs";
import { buildOmniRouteOpenCodeConfig } from "@omniroute/opencode-provider";

const config = buildOmniRouteOpenCodeConfig({
  baseURL: "http://localhost:20128",
  apiKey: process.env.OMNIROUTE_API_KEY ?? "sk_omniroute",
  // اختیاری: فهرست مدل exposed به OpenCode را بازنویسی کنید
  models: ["auto", "claude-opus-4-7", "gpt-5.5"],
  modelLabels: { auto: "Auto-Combo" },
});

writeFileSync("opencode.json", JSON.stringify(config, null, 2));
```

برای یک merge غیرمخرب در برابر یک فایل موجود، `mergeOpenCodeConfigText()` از `opencodeConfig.ts` را بازتولید کنید یا تولیدکننده CLI را فراخوانی کنید.

برای API کامل به [README پکیج](../../@omniroute/opencode-provider/README.md) مراجعه کنید.

---

## runtime در واقع چه کاری انجام می‌دهد

هر دو مسیر همان `provider.omniroute.npm: "@ai-sdk/openai-compatible"` را تولید می‌کنند. در زمان اجرا، OpenCode پکیج `@ai-sdk/openai-compatible` (که از پیش یک وابستگی انتقالی OpenCode است) را بارگذاری کرده و با `baseURL` + `apiKey` پیکربندی می‌کند. از اینجا به بعد:

```
OpenCode UI/agent
   → @ai-sdk/openai-compatible
      → HTTP POST {baseURL}/chat/completions          (سطح OpenAI مربوط به OmniRoute)
         → handler مربوط به OmniRoute /v1/chat/completions     (open-sse/handlers/chatCore.ts)
            → مسیریابی combo / Auto-Combo / executor
               → ارائه‌دهنده upstream
```

پلاگین هرگز به HTTP دست نمی‌زند. فقط پیکربندی emit می‌کند.

---

## پیش‌فرض‌های فهرست مدل

```ts
export const OMNIROUTE_DEFAULT_OPENCODE_MODELS = [
  "claude-opus-4-5-thinking",
  "claude-sonnet-4-5-thinking",
  "gemini-3.1-pro-high",
  "gemini-3-flash",
] as const;
```

می‌توانید از طریق `models: [...]` بازنویسی کنید. موارد افزودنی توصیه‌شده:

- `"auto"` — مسیریاب [Auto-Combo](../routing/AUTO-COMBO.md) با پیکربندی صفر OmniRoute را نمایان می‌کند. به OpenCode اجازه می‌دهد «بهترین مدل در دسترس» را بدون hard-code کردن فهرست انتخاب کند.
- `"<combo-name>"` — هر combo که در داشبورد تعریف کرده‌اید؛ OmniRoute آن را به‌صورت شفاف حل می‌کند.

---

## نرمال‌سازی URL

این helper هر دو فرم را می‌پذیرد و دقیقاً یک `/v1` تولید می‌کند:

| ورودی                          | خروجی (`options.baseURL`)  |
| ------------------------------ | --------------------------- |
| `http://localhost:20128`       | `http://localhost:20128/v1` |
| `http://localhost:20128/`      | `http://localhost:20128/v1` |
| `http://localhost:20128/v1`    | `http://localhost:20128/v1` |
| `http://localhost:20128/v1///` | `http://localhost:20128/v1` |

این deduplication **شایع‌ترین خرابی** در پیکربندی‌های قدیمی است. اگر یک `opencode.json` از قبل از v3.8.0 دارید که به `/v1/v1/...` اشاره می‌کند، تولیدکننده را دوباره اجرا کنید یا `createOmniRouteProvider` را دوباره فراخوانی کنید.

---

## حالت‌های احراز هویت

| تنظیم OmniRoute                                 | مقدار `apiKey` توصیه‌شده                         |
| ------------------------------------------- | -------------------------------------------------- |
| `REQUIRE_API_KEY=false` (پیش‌فرض برای حالت محلی) | `sk_omniroute` (placeholder تحت‌اللفظی)               |
| `REQUIRE_API_KEY=true`                      | یک کلید API واقعی به ازای کاربر از Dashboard → API Keys. |

برای کلاینت‌های با سبک Anthropic که `x-api-key` + `anthropic-version` ارسال می‌کنند، `extractApiKey` مربوط به OmniRoute نیز از کلید در `x-api-key` استفاده می‌کند. OpenCode از سطح OpenAI استفاده می‌کند، بنابراین همیشه `Authorization: Bearer ${apiKey}` ارسال می‌کند — هیچ case خاصی برای Anthropic در اینجا اعمال نمی‌شود.

---

## عیب‌یابی

| نشانه                                              | علت                                                               | راه‌حل                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `404` روی هر درخواست با URL حاوی `/v1/v1/` | پیکربندی قدیمی از پلاگین pre-v3.8 که `/v1` را دو بار suffix می‌کرده.       | از طریق مسیر ۱ یا ۲ دوباره تولید کنید.                                                                          |
| `401 Invalid API key`                                | OmniRoute دارای `REQUIRE_API_KEY=true` است و کلید ناشناخته است.        | کلید را در داشبورد بسازید، یا `REQUIRE_API_KEY=false` (فقط محلی) تنظیم کنید و از `sk_omniroute` استفاده کنید. |
| فهرست مدل در رابط کاربری OpenCode خالی است                     | هر ۴ مدل پیش‌فرض در visibility ارائه‌دهنده OmniRoute مخفی هستند. | `models: ["auto", ...]` را عبور دهید تا موارد فعال‌شده را نمایان کنید.                                         |
| خطای 500 در OpenCode با `cannot read property 'models'`    | نسخه قدیمی OpenCode (< 0.1.x) `models` inline را نمی‌پذیرفت.             | OpenCode را به نسخه‌ای ارتقا دهید که از schema v1 پیروی می‌کند (`opencode.ai/config.json`).                |

---

## همچنین ببینید

- [مرجع API](../reference/API_REFERENCE.md) — سطح کامل REST مربوط به OmniRoute
- [Auto-Combo](../routing/AUTO-COMBO.md) — منظور از `model: "auto"` چیست
- [README پکیج `@omniroute/opencode-provider`](../../@omniroute/opencode-provider/README.md)
- منبع: `src/shared/services/opencodeConfig.ts`, `src/lib/cli-helper/config-generator/opencode.ts`, `@omniroute/opencode-provider/src/index.ts`
