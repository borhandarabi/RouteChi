---
title: "ارزیابی‌ها (Evals)"
version: 3.8.40
lastUpdated: 2026-06-28
---

# ارزیابی‌ها (Evals)

> **منبع حقیقت:** `src/lib/evals/`، `src/lib/db/evals.ts`، `src/app/api/evals/`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40

OmniRoute یک چارچوب ارزیابی عمومی به همراه دارد که می‌توانید از آن برای بنچمارک کردن
پیکربندی‌های مسیریابی، پروایدرها/مدل‌های منفرد یا مجموعه‌های «golden set» همراه
سیستم استفاده کنید. از آن برای راستی‌آزمایی تغییرات مسیریابی، اعتبارسنجی
پروایدرهای جدید و مسدود کردن انتشار پیش از ارتقا به ترافیک پروداکشن استفاده کنید.

این چارچوب به این شکل پیاده‌سازی شده است:

- یک اجراکننده‌ی خالص (`src/lib/evals/evalRunner.ts`) که مجموعه‌های (suites) داخلی را
  درون‌حافظه‌ای ثبت می‌کند، خروجی‌ها را در برابر معیارهای مورد انتظار ارزیابی می‌کند
  و کارت‌های امتیاز را تجمیع می‌کند.
- یک لایه‌ی ماندگاری (`src/lib/db/evals.ts`) برای مجموعه‌های سفارشی (تعریف‌شده‌ی کاربر)
  و اجراهای تاریخی در SQLite.
- یک لایه‌ی هماهنگ‌سازی (`src/lib/evals/runtime.ts`) که هر مورد را با ارسال فراخوانی‌های
  واقعی به `POST /v1/chat/completions` اجرا می‌کند، تأخیر و خروجی‌ها را ضبط می‌کند
  و اجرا را در DB ذخیره می‌کند.
- نقاط پایانی REST تحت `/api/evals/*` (فقط احراز هویت مدیریتی).
- یک سطح داشبورد در `Dashboard → Usage → Evals` (`EvalsTab.tsx`).

## مفاهیم

### Suite

یک suite مجموعه‌ای نام‌گذاری‌شده از موارد آزمون با یک `description` و یک یا چند
مورد است. Suiteها از دو منبع می‌آیند:

| Source     | Where defined                                 | Mutable at runtime? |
| ---------- | --------------------------------------------- | ------------------- |
| `built-in` | Registered via `registerSuite()` at boot      | No (code-defined)   |
| `custom`   | Stored in SQLite `eval_suites` + `eval_cases` | Yes (via API/UI)    |

Suiteهای داخلی فعلی (به `src/lib/evals/evalRunner.ts` مراجعه کنید):

- `golden-set` — ۱۰ مورد پایه در حوزه‌های سلام‌کردن/ریاضی/ترجمه/ایمنی
- `coding-proficiency` — Python/JS/SQL/TS/تشخیص باگ
- `reasoning-logic` — قیاس منطقی، مسائل کلامی، تشخیص الگو
- `multilingual` — ترجمه و تشخیص زبان
- `safety-guardrails` — PII، jailbreak، امتناع، آگاهی از سوگیری
- `instruction-following` — فقط JSON، فهرست‌های شماره‌دار، محدودیت‌های زبانی
- `codex-comparison` — وظایف کدنویسی رو‌در‌روی برای حالت مقایسه

### Case

هر مورد شامل موارد زیر است:

| Field      | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| `id`       | Stable identifier (used to key outputs and metrics)          |
| `name`     | Human-readable label                                         |
| `model`    | Default model when the run uses `suite-default` targeting    |
| `input`    | `{ messages, max_tokens? }` — sent to `/v1/chat/completions` |
| `expected` | `{ strategy, value }` — scoring rubric (see below)           |
| `tags`     | Optional labels (e.g. `safety`, `pii`, `jailbreak`)          |

### Target

یک suite یکسان می‌تواند در برابر targetهای مختلف اجرا شود. شمای target
`evalTargetSchema` در `src/shared/validation/schemas.ts` است:

| Target type     | `id`       | Behavior                                                        |
| --------------- | ---------- | --------------------------------------------------------------- |
| `suite-default` | `null`     | Each case uses its built-in `model` field                       |
| `model`         | model name | Force every case through one direct model (e.g. `gpt-4o`)       |
| `combo`         | combo name | Run every case through one combo (exercises the routing engine) |

برای `model` و `combo`، فیلد `id` الزامی است (توسط Zod
`superRefine` اعمال می‌شود). هنگام ارائه‌ی `compareTarget`، هر دو target باید متفاوت
باشند — اجراکننده هر دو اجرا را تحت یک `runGroupId` مشترک برای مقایسه‌ی A/B ذخیره
می‌کند.

## روبیک‌های امتیازدهی

پیاده‌سازی‌شده در `evaluateCase()` (evalRunner.ts):

| Strategy   | Pass when…                                                           |
| ---------- | -------------------------------------------------------------------- |
| `exact`    | `actualOutput === expected.value`                                    |
| `contains` | `actualOutput.toLowerCase().includes(expected.value.toLowerCase())`  |
| `regex`    | `new RegExp(expected.value).test(actualOutput)` is truthy            |
| `custom`   | `expected.fn(actualOutput, evalCase)` returns truthy (built-in only) |

**نکته:** امتیازدهی تابع سفارشی مختص suiteهای تعریف‌شده‌درکد (داخلی) است زیرا توابع
نمی‌توانند از طریق API سریالایز شوند. `evalCaseBuilderSchema` برای suiteهای
ساخته‌شده‌توسط‌کاربر فقط `contains | exact | regex` را می‌پذیرد.

امروزه هیچ قاضی‌ی LLM-as-judge یا امتیازدهنده‌ی شباهت مبتنی بر embedding وجود ندارد —
این یک نقطه‌ی توسعه‌ی تمیز در `evaluateCase()` خواهد بود.

## شمای پایگاه داده

سه جدول (مهاجرت‌های `030_create_eval_runs.sql` و
`031_create_eval_suites.sql`):

| Table         | Purpose                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `eval_suites` | Custom suite metadata (`id`, `name`, `description`)                                                                          |
| `eval_cases`  | Cases per suite — `input_json`, `expected_*`, `tags_json`                                                                    |
| `eval_runs`   | Historical runs — `pass_rate`, `total`, `passed`, `failed`, `avg_latency_ms`, `summary_json`, `results_json`, `outputs_json` |

Suiteهای داخلی در DB ذخیره **نمی‌شوند**. آن‌ها در حافظه قرار دارند و هر بار که
`evalRunner.ts` وارد می‌شود مجدداً ثبت می‌شوند.

## REST API

همه‌ی نقاط پایانی نیازمند احراز هویت مدیریتی (`requireManagementAuth`) هستند — آن‌ها
بخشی از سطح پراکسی عمومی نیستند.

| Endpoint                      | Method   | Description                                                   |
| ----------------------------- | -------- | ------------------------------------------------------------- |
| `/api/evals`                  | `GET`    | List suites + recent runs + scorecard + targets + keys        |
| `/api/evals`                  | `POST`   | Run a suite (single or compare) — schema `evalRunSuiteSchema` |
| `/api/evals/{suiteId}`        | `GET`    | Fetch one suite (built-in or custom)                          |
| `/api/evals/suites`           | `POST`   | Create a custom suite — schema `evalSuiteSaveSchema`          |
| `/api/evals/suites/{suiteId}` | `GET`    | Fetch a custom suite                                          |
| `/api/evals/suites/{suiteId}` | `PUT`    | Replace a custom suite (cases get re-inserted)                |
| `/api/evals/suites/{suiteId}` | `DELETE` | Delete a custom suite and its cases                           |

### اجرای یک suite

```bash
curl -X POST http://localhost:20128/api/evals \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "suiteId": "golden-set",
    "target": { "type": "combo", "id": "my-combo" },
    "apiKeyId": "optional-api-key-uuid"
  }'
```

فیلدهای اختیاری:

- `outputs` — `Record<caseId, string>` از خروجی‌های ازپیش‌محاسبه‌شده. هنگام ارائه،
  اجراکننده **ارسال را نادیده می‌گیرد** و فقط خروجی‌های کش‌شده را امتیازدهی می‌کند
  (برای ارزیابی آفلاین مفید است).
- `compareTarget` — target دوم برای اجرای موازی؛ هر دو اجرا یک
  `runGroupId` تولیدشده را برای نمایش رو‌در‌رو به اشتراک می‌گذارند.
- `apiKeyId` — کلید API داخلی برای احراز هویت فراخوانی‌های ارسالی
  `/v1/chat/completions`. هنگام فعال بودن `REQUIRE_API_KEY` الزامی است.

### ایجاد یک suite سفارشی

```bash
curl -X POST http://localhost:20128/api/evals/suites \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production smoke",
    "description": "Quick sanity check before deploy",
    "cases": [
      {
        "name": "JSON shape",
        "model": "gpt-4o",
        "input": { "messages": [{ "role": "user", "content": "Reply with {\"ok\": true}" }] },
        "expected": { "strategy": "regex", "value": "\"ok\"\\s*:\\s*true" }
      }
    ]
  }'
```

## لوله‌ی ارسال

`runEvalSuiteAgainstTarget()` (`src/lib/evals/runtime.ts`):

1. suite (داخلی یا سفارشی) را تفکیک می‌کند.
2. برای هر مورد، یک `Request` به `/v1/chat/completions` با `messages` مورد،
   `model` تفکیک‌شده، `stream: false` و `max_tokens: 512`
   (یا مقدار بازنویسی‌ی مورد) می‌سازد.
3. هندلر چت را مستقیم فراخوانی می‌کند (درون‌پروسه — بدون هاپ اضافی HTTP).
4. تأخیر را ضبط و متن را از `choices[0].message.content` یا بار Responses-API ی
   `output[]` استخراج می‌کند.
5. همه‌ی خروجی‌ها را از طریق `runSuite()` امتیازدهی می‌کند، سپس از طریق `saveEvalRun()` ذخیره می‌کند.

موارد به‌صورت **متوالی** اجرا می‌شوند. امروزه هیچ پرچم همزمانی وجود ندارد.

## داشبورد

رابط کاربری در `Dashboard → Usage → Evals`
(`src/app/(dashboard)/dashboard/usage/components/EvalsTab.tsx`) قرار دارد. از آنجا می‌توانید:

- suiteهای داخلی و سفارشی را با پیش‌نمایش موردبه‌مورد مرور کنید.
- suiteهای سفارشی را با سازنده‌ی مورد ایجاد/ویرایش/حذف کنید.
- یک target (پیش‌فرض‌های suite / مدل / combo)، به‌صورت اختیاری یک
  `compareTarget` دوم، به‌صورت اختیاری یک کلید API انتخاب کنید و سپس به‌صورت درخواستی اجرا کنید.
- تاریخچه‌ی اجرا، موفقیت/شکست به‌ازای‌هرمورد، تأخیر و خروجی‌های ضبط‌شده را بررسی کنید.
- کارت امتیاز چرخشی تجمیع‌شده در دامنه‌ی آخرین اجرا به‌ازای هر
  `(suite, target)` را ببینید.

## رابطه با RFC ی ارزیابی خودکار

یک زیرسیستم ارزیابی مجزا و محدودتر در `src/domain/assessment/` قرار دارد
(همچنین به [AUTO-COMBO.md](../routing/AUTO-COMBO.md) برای موتور امتیازدهی زنده مراجعه کنید).
این زیرسیستم موتور Auto Combo را هدف می‌گیرد — به‌صورت خودکار پروایدرها و
مدل‌ها را امتیازدهی می‌کند تا وقتی upstreamها شکست می‌خورند comboها بتوانند خودترمیم شوند.
این زیرسیستم از اجراکننده، دسته‌بند و منطق امتیازدهی خود استفاده می‌کند.

چارچوب Evals مستندشده‌ی اینجا **سطح آزمون عمومی‌تر و همه‌منظوره** است. از آن برای
suiteهای رگرسیون دل‌خواه، مقایسه‌های A/B و آزمون‌های دود به‌ازای‌هر‌انتشار استفاده کنید.
هنگامی که به سلامت زنده‌ی پروایدر برای تأثیرگذاری بر تصمیمات مسیریابی نیاز دارید،
از زیرسیستم ارزیابی خودکار استفاده کنید.

## یکپارچه‌سازی CI

امروزه هیچ اسکریپت npm ی `eval:ci` اختصاصی وجود ندارد. دو مسیر اگر می‌خواهید
انتشارها را بر اساس نتایج eval مسدود کنید:

- **مسیر HTTP:** سرور را راه‌اندازی کنید، `POST /api/evals` را با یک
  `suiteId` + `target` شناخته‌شده فراخوانی کنید و `runs[].summary.passRate >= N` را در
  پاسخ بررسی کنید.
- **مسیر درون‌پروسه:** `runEvalSuiteAgainstTarget()` را از
  `@/lib/evals/runtime` از یک اسکریپت وارد کنید، در برابر یک DB آزمون اجرا کنید و
  `PersistedEvalRun.summary` برگشتی را بررسی کنید.

تست‌های پوشش‌دهنده‌ی مسیر و تاریخچه در
`tests/unit/evals-route.test.ts` و `tests/unit/evals-history.test.ts` قرار دارند.

## نقاط توسعه

تغییرات رایج و محل انجام آن‌ها:

- **استراتژی امتیازدهی جدید** — بلوک `switch (evalCase.expected.strategy)`
  را در `evaluateCase()` (`evalRunner.ts`) گسترش دهید و `EvalCaseStrategy` در
  `src/lib/db/evals.ts` به‌علاوه‌ی `evalCaseBuilderSchema` در `schemas.ts` را باز کنید.
- **suite داخلی جدید** — یک شیء suite تعریف کنید و `registerSuite()` را در
  پایین `evalRunner.ts` فراخوانی کنید. این به‌صورت خودکار توسط `listSuites()` کشف خواهد شد.
- **اجرا با همزمانی** — حلقه‌ی `for` متوالی در
  `runEvalSuiteAgainstTarget()` را به یک `Promise.all` محدودشده تغییر دهید (امروزه هیچ کنترل
  همزمانی وجود ندارد).
- **موارد stream/tool-call** — در حال حاضر اجراکننده `stream: false` را تحمیل می‌کند.
  ارزیابی استریمی یا آگاه‌از‌ابزار نیازمند تغییراتی در `runtime.ts` است
  (ضبط و تجمیع قطعات SSE پیش از امتیازدهی).

## مطالعه‌ی بیشتر

- [USER_GUIDE.md](../guides/USER_GUIDE.md) — مرور کلی محصول
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — مرجع لوله‌ی درخواست
- [AUTO-COMBO.md](../routing/AUTO-COMBO.md) — موتور امتیازدهی Auto Combo (زمان اجرای زنده)
- منبع: `src/lib/evals/`، `src/lib/db/evals.ts`، `src/app/api/evals/`
- رابط کاربری: `src/app/(dashboard)/dashboard/usage/components/EvalsTab.tsx`
