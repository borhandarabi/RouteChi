---
title: "Guardrails"
version: 3.8.40
lastUpdated: 2026-06-28
---

# گاردریل‌ها

> **منبع حقیقت:** `src/lib/guardrails/`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40 (پوشش injection-guard + سقف اسکن ۱۶ KB + red-team)

گاردریل‌ها ایمنی، سیاست و تبدیل‌های محتوا را در مرز بین
RouteChi و ارائه‌دهندگان آپ‌استریم اعمال می‌کنند. هر گاردریل می‌تواند payloadهای درخواست
(`preCall`) و پاسخ‌های آپ‌استریم (`postCall`) را بازرسی (و به‌صورت اختیاری رد، تبدیل یا
حاشیه‌نویسی) کند.

این سیستم **fail-open** است: اگر یک گاردریل هنگام اجرا استثنا پرتاب کند، رجیستر
خطا را ثبت می‌کند و با گاردریل بعدی ادامه می‌دهد به جای اینکه درخواست را شکست دهد. مسدودسازی
یک تصمیم صریح (`block: true`) است، هرگز یک تصادف نیست.

## گاردریل‌های داخلی

رجیستر سه گاردریل را هنگام import به ترتیب اولویت به‌طور خودکار بارگذاری می‌کند
(به `registry.ts` → `registerDefaultGuardrails()` مراجعه کنید):

| اولویت | نام                | مرحله(ها)      | فایل                 |
| ------ | ------------------ | -------------- | -------------------- |
| `5`    | `vision-bridge`    | `preCall`      | `visionBridge.ts`    |
| `10`   | `pii-masker`       | `pre` + `post` | `piiMasker.ts`       |
| `20`   | `prompt-injection` | `preCall`      | `promptInjection.ts` |

شماره‌های اولویت کم‌تر **اول** اجرا می‌شوند.

### Vision Bridge (`visionBridge.ts`)

درخواست‌های حاوی تصویر که به **مدل‌های غیر بینایی** هدف گرفته‌اند را رهگیری می‌کند و
بخش‌های تصویر را با توصیف متنی تولیدشده توسط یک مدل بینایی قابل پیکربندی پیش از
فراخوانی آپ‌استریم جایگزین می‌کند. این به ارائه‌دهندگان فقط‌متنی اجازه می‌دهد به‌طور شفاف
payloadهای چندوجهی را مدیریت کنند.

جریان:

1. اگر مدل هدف از پیش از vision پشتیبانی می‌کند رد شوید (مگر اینکه در
   فهرست bridge اجباری `isVisionBridgeForcedModel` ظاهر شود).
2. بخش‌های تصویر را از طریق `extractImageParts(messages)` استخراج کنید. اگر هیچ کدام نبود رد شوید.
3. پیکربندی زمان اجرا را از `getSettings()` بارگذاری کنید (`visionBridgeEnabled`,
   `visionBridgeModel`, `visionBridgePrompt`, `visionBridgeTimeout`,
   `visionBridgeMaxImages`).
4. تصاویر را در `maxImages` سقف کنید، مدل بینایی را **به‌صورت موازی**
   (`Promise.allSettled`) فراخوانی کنید و بخش‌های متنی `[Image N]: <description>` را
   به‌جای آن‌ها تزریق کنید — تصاویر ناموفق به `[Image N]: (unavailable)` تبدیل می‌شوند.
5. `modifiedPayload` + متا (`imagesProcessed`, `processingTimeMs`,
   `visionModel`) را برگردانید.

پیش‌فرض‌ها در `src/shared/constants/visionBridgeDefaults.ts` قرار دارند. گاردریل
یک گزینه سازنده `deps` را افشا می‌کند تا آزمون‌ها بتوانند پیاده‌سازی‌های جعلی `getSettings` و
`callVisionModel` را تزریق کنند.

### ماسک‌کننده PII (`piiMasker.ts`)

روی **هر دو** مرحله اجرا می‌شود.

- **`preCall`** payload را کلون می‌کند، `system`, `messages` و آرایه‌های `input`
  را پیمایش می‌کند و `processPII()` (از `@/shared/utils/inputSanitizer`) را روی
  فیلدهای رشته‌ای `content`/`text` اعمال می‌کند. وقتی `PII_REDACTION_ENABLED=true` **و**
  `INPUT_SANITIZER_MODE=redact` باشد، PII شناسایی‌شده در payload خروجی حذف/سانسور می‌شود.
  در غیر این صورت فراخوانی شمارش‌های شناسایی را بدون بازنویسی محتوا ثبت می‌کند.
- **`postCall`** پاسخ را deep-clone می‌کند، `sanitizePIIResponse()` به‌علاوه
  ماسک‌کننده شکل Responses-API (`maskResponsesOutput` —
  `output_text` و `output[].content[].text` را پوشش می‌دهد) را اجرا می‌کند. اگر هر سانسوری رخ دهد،
  پاسخ تغییریافته جایگزین اصلی می‌شود.

گاردریل هرگز مسدود نمی‌کند؛ فقط حاشیه‌نویسی می‌کند (`meta.detections`,
`meta.redacted`) یا بازنویسی می‌کند.

### تزریق پرامپت (`promptInjection.ts`)

ساختارهای مخرب در محتوای تأمین‌شده توسط کاربر را شناسایی می‌کند و سیاست
پیکربندی‌شده را اعمال می‌کند. رفتار توسط متغیرهای محیطی و گزینه‌های سازنده هدایت می‌شود:

| تنظیم            | متغیر محیطی                                     | پیش‌فرض | اثر                                     |
| ---------------- | ----------------------------------------------- | ------- | --------------------------------------- |
| فعال             | `INPUT_SANITIZER_ENABLED`                       | `true`  | وقتی `false` است، گاردریل short-circuit می‌شود. |
| حالت             | `INJECTION_GUARD_MODE` / `INPUT_SANITIZER_MODE` | `warn`  | `block`, `warn` یا `log`.               |
| آستانه مسدودسازی | گزینه `blockThreshold`                          | `high`  | حداقل شدت لازم برای مسدودسازی.          |

**تقدم حالت** (`getMode`): `options.mode` فراخواننده →
**لغو feature-flag DB** `INJECTION_GUARD_MODE` (Dashboard → Settings →
Feature Flags) → متغیر محیطی `INJECTION_GUARD_MODE` → متغیر محیطی `INPUT_SANITIZER_MODE` →
`warn`. بنابراین یک لغوی داشبورد بر متغیرهای محیطی پیروز می‌شود، پس رابط
Feature Flags گارد در حال اجرا را زنده کنترل می‌کند (بدون راه‌اندازی مجدد). خواندن DB fail-safe است:
اگر خطا دهد، گارد به رفتار مبتنی بر env برمی‌گردد، و وقتی هیچ لغویی تنظیم نشده رفتار با رزولوشن فقط‌env یکسان است.

منابع شناسایی:

1. `sanitizeRequest()` از `@/shared/utils/inputSanitizer` (مجموعه تشخیص‌گر
   مشترک که در جای دیگری خط لوله استفاده می‌شود).
2. `DEFAULT_GUARD_PATTERNS` داخلی (در حال حاضر `system_override_inline` و
   `markdown_system_block`، هر دو با شدت `high`).
3. `customPatterns` اختیاری که از طریق گزینه‌های سازنده ارسال می‌شوند (رشته‌ها، regex،
   یا رکوردهای `{ name, pattern, severity }`).

وقتی `mode === "block"` **و** حداقل یک شناسایی به آستانه شدت برسد،
`preCall` `{ block: true, message: "Request rejected:
suspicious content detected" }` را برمی‌گرداند. در حالت‌های `warn`/`log` گاردریل لاگ می‌کند اما
اجازه فراخوانی می‌دهد. کمک‌کننده مشترک `evaluatePromptInjection()` نیز برای فراخواننده‌هایی که
نیاز به ارزیابی پرامپت بدون عبور از رجیستر دارند، صادر شده است.

**سقف اسکن (v3.8.20):** تشخیص‌گر تنها **اولین ۱۶ KB** متن پرامپت
پیوسته را بازرسی می‌کند — `MAX_INJECTION_SCAN_BYTES = 16 * 1024` (16 384 بایت) در
`src/shared/utils/inputSanitizer.ts`. هم `detectInjection()` و هم
`evaluatePromptInjection()` پیش از اجرای حلقه الگو `slice(0, MAX_INJECTION_SCAN_BYTES)` را انجام می‌دهند. دستورالعمل‌های تزریق نزدیک بالای یک ورودی قرار دارند، بنابراین این
CPU/GC regex را روی payloadهای چندصد کیلوبایتی بدون تضعیف شناسایی محدود می‌کند (رجوع به
#3932, #4041).

## قرارداد پایه (`base.ts`)

```typescript
class BaseGuardrail {
  enabled: boolean;
  name: string;
  priority: number;

  constructor(name: string, options?: { enabled?: boolean; priority?: number });

  async preCall(payload: unknown, context: GuardrailContext): Promise<GuardrailResult | void>;

  async postCall(response: unknown, context: GuardrailContext): Promise<GuardrailResult | void>;
}

interface GuardrailResult<TValue = unknown> {
  block?: boolean; // true short-circuits the chain
  message?: string; // surfaced when blocking
  meta?: Record<string, unknown> | null;
  modifiedPayload?: TValue; // returned by preCall to rewrite the request
  modifiedResponse?: TValue; // returned by postCall to rewrite the response
}

interface GuardrailContext {
  apiKeyInfo?: Record<string, unknown> | null;
  disabledGuardrails?: string[] | null;
  endpoint?: string | null;
  headers?: Headers | Record<string, unknown> | null;
  log?: GuardrailLog | Console | null;
  method?: string | null;
  model?: string | null;
  provider?: string | null;
  sourceFormat?: string | null;
  stream?: boolean;
  targetFormat?: string | null;
}
```

یک گاردریل با برگرداندن `void`, `{}` یا
`{ block: false }` سیگنال «بدون تغییر» می‌دهد. برگرداندن یک `modifiedPayload`/`modifiedResponse`
مقدار عبوری از زنجیره را برای گاردریل‌های پایین‌دست جایگزین می‌کند.

## رجیستر (`registry.ts`)

تک‌نمونه `guardrailRegistry` موارد زیر را افشا می‌کند:

- `register(guardrail)` — یک گاردریل را اضافه (یا با نام نرمالایز شده جایگزین) می‌کند و
  بر اساس `priority` صعودی دوباره مرتب می‌کند.
- `clear()` / `list()` — کمک‌کننده‌های مدیریتی.
- `runPreCallHooks(payload, context)` — روی گاردریل‌های فعال پیمایش می‌کند، payload را از طریق
  `modifiedPayload` می‌راند و روی اولین `block: true` متوقف می‌شود.
- `runPostCallHooks(response, context)` — همان جریان روی سمت پاسخ.
- `resetGuardrailsForTests({ registerDefaults })` — وضعیت را پاک می‌کند و به‌صورت اختیاری
  پیش‌فرض‌ها را برای ایزوله‌سازی تمیز آزمون دوباره ثبت می‌کند.

هر دو runner `{ blocked, payload|response, results, guardrail?, message? }` را برمی‌گردانند
که در آن `results` یک آرایه از رکوردهای `GuardrailExecutionResult` است که شامل
فیلدهای به‌ازای هر گاردریل `blocked`, `skipped`, `modified`, `error` و `meta` است،
که برای ردیابی مفید است.

### غیرفعال‌کردن گاردریل‌ها به‌ازای هر درخواست

`resolveDisabledGuardrails({ apiKeyInfo, body, headers })` یک فهرست
بدون تکرار از نام‌های گاردریل که باید برای درخواست کنونی رد شوند، تجمیع می‌کند. منابع (همه اختیاری، همه ادغام می‌شوند):

- `apiKeyInfo.disabledGuardrails`
- بدنه درخواست `disabledGuardrails` (سطح بالا)
- بدنه درخواست `metadata.disabledGuardrails`
- هدر `x-omniroute-disabled-guardrails` (یا قدیمی
  `x-disabled-guardrails`)

مقادیر می‌توانند آرایه‌ای از رشته‌ها یا یک رشته با کاما جدا شده باشند؛ نام‌ها به
kebab-case با حروف کوچک نرمالایز می‌شوند (`pii_masker` → `pii-masker`). نتیجه
از طریق `context.disabledGuardrails` به رجیستر ارسال می‌شود، که گاردریل‌های
تطابق‌یافته را رد می‌کند (`skipped: true` در `results`).

## ترتیب اجرا

برای هر درخواستی که از `src/sse/handlers/chat.ts` و
`open-sse/handlers/chatCore.ts` عبور می‌کند:

1. `resolveDisabledGuardrails(...)` فهرست رد را از کلید API، بدنه،
   و هدرها می‌سازد.
2. `guardrailRegistry.runPreCallHooks(body, ctx)` گاردریل‌ها را به ترتیب
   اولویت صعودی اجرا می‌کند:
   - گاردریل‌های غیرفعال به‌عنوان `skipped` ثبت می‌شوند.
   - `preCall` هر گاردریل ممکن است payload را از طریق `modifiedPayload` بازنویسی کند.
   - اولین `block: true` زنجیره را short-circuit می‌کند و هندلر یک
     پاسخ رد گاردریل برمی‌گرداند.
3. payload (به‌طور بالقوه بازنویسی‌شده) به مسیریابی combo و دیسپچ
   آپ‌استریم جریان می‌یابد.
4. پس از مونتاژ پاسخ، `guardrailRegistry.runPostCallHooks(...)`
   همان زنجیره را روی پاسخ اجرا می‌کند. `block: true` در اینجا پاسخ آپ‌استریم را رها می‌کند.

گاردریل‌هایی که استثنا پرتاب می‌کنند با `error: <message>` ثبت می‌شوند و از طریق
`logger.warn` لاگ می‌شوند، اما زنجیره ادامه می‌یابد — fail-open بر اساس طراحی.

## پیکربندی

متغیرهای محیطی که توسط گاردریل‌های داخلی خوانده می‌شوند:

| متغیر                                | استفاده‌شده توسط                  | اثر                                                                                              |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `INPUT_SANITIZER_ENABLED`            | `prompt-injection`                | `false` برای غیرفعال‌کردن کامل شناسایی.                                                          |
| `INPUT_SANITIZER_MODE`               | `prompt-injection`, `pii-masker`  | حالت مشترک: `warn`, `block`, `log` یا `redact`.                                                  |
| `INJECTION_GUARD_MODE`               | `prompt-injection`                | حالت گارد تزریق؛ همچنین یک feature flag DB که متغیرهای env را **لغو** می‌کند (DB > ENV).          |
| `PII_REDACTION_ENABLED`              | `pii-masker`                      | وقتی `true` + حالت `redact`، PII درخواست حذف می‌شود.                                              |
| `PII_RESPONSE_SANITIZATION` / `_MODE`| `pii-masker` (پایین‌دست)          | رفتار ماسک‌کننده سمت پاسخ را کنترل می‌کند.                                                         |

Vision Bridge پیکربندی زمان اجرا را از فروشگاه تنظیمات مبتنی بر DB
(`getSettings()`) می‌خواند، نه متغیرهای env: `visionBridgeEnabled`, `visionBridgeModel`,
`visionBridgePrompt`, `visionBridgeTimeout`, `visionBridgeMaxImages`. پیش‌فرض‌ها
در `src/shared/constants/visionBridgeDefaults.ts` قرار دارند.

## گاردریل‌های سفارشی

```typescript
import { BaseGuardrail, guardrailRegistry } from "@/lib/guardrails";

class BudgetGuardrail extends BaseGuardrail {
  constructor() {
    super("budget", { priority: 50 });
  }

  async preCall(payload, ctx) {
    if (ctx.apiKeyInfo?.budgetExceeded) {
      return { block: true, message: "Daily budget exceeded" };
    }
    return { block: false };
  }
}

guardrailRegistry.register(new BudgetGuardrail());
```

مراحل:

1. `src/lib/guardrails/myGuardrail.ts` را با extend از `BaseGuardrail` بسازید.
2. `preCall` و/یا `postCall` را پیاده‌سازی کنید.
3. یا هنگام import ثبت کنید (push از `registerDefaultGuardrails`) یا
   در زمان اجرا `guardrailRegistry.register(...)` را فراخوانی کنید — رجیستر هر
   گاردریل قبلی با همان نام نرمالایز را جایگزین می‌کند.
4. آزمون‌ها را تحت `tests/unit/` بیفزایید (مثال‌های موجود:
   `tests/unit/guardrails-registry.test.ts`,
   `tests/unit/prompt-injection-guard.test.ts`,
   `tests/unit/guardrails/visionBridge.test.ts`).

## آزمون

از `resetGuardrailsForTests()` بین آزمون‌ها برای شروع از یک وضعیت شناخته‌شده استفاده کنید.
`{ registerDefaults: false }` را ارسال کنید تا با یک رجیستر خالی شروع کنید و
فقط گاردریل‌های تحت آزمون را ثبت کنید. گاردریل Vision Bridge تزریق
وابستگی (`deps.getSettings`, `deps.callVisionModel`) را می‌پذیرد تا آزمون‌ها بتوانند
کل جریان را بدون دسترسی DB یا شبکه اجرا کنند.

## همچنین ببینید

- `src/lib/guardrails/` — پیاده‌سازی
- `src/shared/utils/inputSanitizer.ts` — تشخیص‌گر مشترک که
  prompt-injection و ماسک‌کردن PII را قدرت می‌بخشد
- `src/shared/constants/visionBridgeDefaults.ts` — پیش‌فرض‌های Vision Bridge و
  فهرست مدل‌های bridge اجباری
- `docs/architecture/RESILIENCE_GUIDE.md` — لایه متعامد (circuit breaker, cooldowns)
- `docs/reference/ENVIRONMENT.md` — مرجع کامل متغیرهای محیطی

## پوشش مسیر و red-team گارد تزریق (Phase 8 · Block D)

گارد تزریق (`createInjectionGuard` / `withInjectionGuard`) همه مسیرهایی را که
پرامپت کاربر می‌پذیرند پوشش می‌دهد. این به `INJECTION_GUARD_MODE` احترام می‌گذارد (پیش‌فرض `warn` = فقط لاگ؛
`block` = HTTP 400 `SECURITY_001` برمی‌گرداند).

| نوع             | مسیرها                                                                                                                                               | حالت پیش‌فرض |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| متن (موجود)     | `/v1/chat/completions`, `/v1/completions`, `/v1/relay/chat/completions`                                                                              | warn         |
| زایشی           | `/v1/messages`, `/v1/responses`, `/v1/images/generations`, `/v1/images/edits`, `/v1/videos/generations`, `/v1/music/generations`, `/v1/audio/speech` | warn         |
| داده            | `/v1/embeddings`, `/v1/rerank`, `/v1/search`, `/v1/moderations`                                                                                      | warn         |

استخراج متن (`extractMessageContents`) `messages`/`input`/`prompt`/`query`+`documents`/`instructions`/`system` را پوشش می‌دهد.

**Red-team (شبانه، `nightly-llm-security.yml`):** promptfoo تأیید می‌کند که هر مسیر
مجموعه OWASP-LLM را در `INJECTION_GUARD_MODE=block` مسدود می‌کند؛ garak پروب‌ها را اجرا می‌کند (بدون secret رد می‌شود).
`moderations` برای یکنواختی گنجانده شده است — اپراتورها در حالت block می‌توانند از طریق
`resolveDisabledGuardrails` آن را معاف کنند.

گردش‌کار شبانه (`.github/workflows/nightly-llm-security.yml`، cron + dispatch دستی)
دو کار دارد:

- **`promptfoo-guard` (مسدودکننده)** — `promptfoo eval -c promptfooconfig.yaml`
  را با `INJECTION_GUARD_MODE=block` اجرا می‌کند. هر مورد adversarial (مثلاً «ignore all
  previous instructions…»، jailbreak‌های سبک DAN) ادعا می‌کند پاسخ حامل
  `error.code === "SECURITY_001"` است، یعنی گارد واقعاً درخواست را رد کرده است.
- **`garak` (مشورتی)** — garak `--probes promptinject,dan,leakreplay`
  را بر علیه یک نمونه محلی RouteChi (`http://localhost:20128/v1`) اجرا می‌کند. گیت‌شده بر یک
  secret ارائه‌دهنده (`PROMPTFOO_PROVIDER_KEY`)؛ به‌طور ظریف رد می‌شود و پسوند
  `|| true` دارد، پس گزارش می‌دهد بدون اینکه CI را شکست دهد.

پوشش کمک‌کننده گارد (`createInjectionGuard` / `withInjectionGuard`)
تمام مسیرهای `/v1` حامل پرامپت را در بر می‌گیرد؛ متن پرامپت از
`messages`/`input`/`prompt`/`query`+`documents`/`instructions`/`system` توسط
`extractMessageContents()` در `src/shared/utils/inputSanitizer.ts` استخراج می‌شود.
