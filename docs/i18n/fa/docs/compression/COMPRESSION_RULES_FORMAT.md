---
title: "قالب قواعد فشرده‌سازی"
version: 3.8.40
lastUpdated: 2026-06-28
---

# قالب قواعد فشرده‌سازی

قواعد فشرده‌سازی فایل‌های JSON هستند که در زمان اجرا بارگذاری می‌شوند. این قواعد عمداً فقط شامل داده هستند
تا بسته‌های زبانی جدید و فیلترهای فرمان RTK بتوانند بدون تغییر کد موتور بررسی شوند.

> **طرح‌وارهٔ مرجع (منبع حقیقت):** [`open-sse/services/compression/rules/_schema.json`](../../open-sse/services/compression/rules/_schema.json) (JSON Schema نسخه draft 2020-12).
> مثال‌های زیر صرفاً برای روشن‌سازی هستند — در صورت شک، بسته خود را در برابر `_schema.json` اعتبارسنجی کنید.

## بسته‌های قواعد Caveman

بسته‌های قواعد Caveman در مسیر زیر قرار دارند:

```txt
open-sse/services/compression/rules/<language>/<pack>.json
```

هر بسته شامل جایگزینی‌هایی است که پس از جداسازی مناطق حفاظت‌شده، بر روی متن معمولی اعمال می‌شوند.

```json
{
  "language": "en",
  "category": "filler",
  "rules": [
    {
      "name": "question_to_directive",
      "pattern": "\\b(?:Can you explain why|Could you show me how)\\b\\s*",
      "replacement": "Explain why ",
      "replacementMap": {
        "can you explain why": "Explain why ",
        "could you show me how": "Show how "
      },
      "flags": "gi",
      "context": "all",
      "category": "context",
      "minIntensity": "lite",
      "description": "Convert verbose questions into direct requests."
    }
  ]
}
```

### فیلدهای Caveman

| فیلد                     | ضروری   | توضیحات                                                        |
| ------------------------ | ------- | -------------------------------------------------------------- |
| `language`               | بله     | کلید زبان شبیه BCP-47 مانند `en`، `pt-BR`، `es`                |
| `category`               | بله     | دسته/نام فایل بسته، برای مثال `filler` یا `dedup`             |
| `rules`                  | بله     | آرایه‌ای از قواعد جایگزینی regex                                |
| `rules[].name`           | بله     | نام پایدار قاعده                                              |
| `rules[].pattern`        | بله     | منبع regex جاوا‌اسکریپت                                        |
| `rules[].flags`          | خیر     | پرچم‌های regex جاوا‌اسکریپت؛ پیش‌فرض `gi`                       |
| `rules[].replacement`    | خیر     | رشته جایگزین یا مقدار بازگشتی هنگام از دست دادن `replacementMap` |
| `rules[].replacementMap` | خیر     | جایگزینی‌های خاص هر تطبیق، کلید شده بر اساس متن تطبیق‌شده نرمالایز شده |
| `rules[].context`        | خیر     | `all`، `user`، `assistant` یا `system`؛ پیش‌فرض `all`          |
| `rules[].category`       | خیر     | `filler`، `context`، `structural`، `dedup`، `terse` یا `ultra` |
| `rules[].minIntensity`   | خیر     | `lite`، `full` یا `ultra`؛ پیش‌فرض `lite`                      |
| `rules[].description`    | خیر     | خلاصهٔ قاعده به زبان انسانی                                    |

زمانی که تطبیق حساس به حروف کوچک/بزرگ اهمیت دارد از `flags` استفاده کنید، برای مثال حذف حرف تعریف
قبل از متن با حروف کوچک بدون حذف `the OpenAI API`. زمانی که یک regex چندین جایگزین متفاوت دارد، از
`replacementMap` استفاده کنید؛ این کار بسته‌های قواعد JSON را فقط-داده نگه می‌دارد و در عین حال رفتار
توابع جایگزینی غنی‌تر TypeScript داخلی را حفظ می‌کند.

## بسته‌های فیلتر RTK

فیلترهای RTK در مسیر زیر قرار دارند:

```txt
open-sse/services/compression/engines/rtk/filters/<filter>.json
```

هر فیلتر توضیح می‌دهد که چگونه یک خانواده خروجی فرمان را تشخیص داده و فشرده کنیم.

```json
{
  "id": "test-vitest",
  "label": "Vitest output",
  "category": "test",
  "priority": 92,
  "match": {
    "outputTypes": ["test-vitest"],
    "commands": ["vitest", "npm test", "npm run test"],
    "patterns": ["\\bFAIL\\b", "\\bPASS\\b", "\\bTest Files\\b"]
  },
  "rules": {
    "stripAnsi": true,
    "replace": [{ "pattern": "\\s+\\[[0-9]+ms\\]", "replacement": "" }],
    "matchOutput": [
      { "pattern": "All tests passed", "message": "vitest: ok", "unless": "FAIL|Error:" }
    ],
    "includePatterns": ["FAIL", "Error:", "Test Files", "Tests"],
    "dropPatterns": ["^\\s*$", "Duration\\s+\\d+"],
    "collapsePatterns": ["^\\s+at "],
    "deduplicate": true,
    "truncateLineAt": 240,
    "maxLines": 160,
    "headLines": 24,
    "tailLines": 40,
    "onEmpty": "vitest: ok",
    "filterStderr": false
  },
  "preserve": {
    "errorPatterns": ["FAIL", "Error:", "AssertionError"],
    "summaryPatterns": ["Test Files", "Tests", "Snapshots"]
  },
  "tests": [
    {
      "name": "keeps failing tests",
      "command": "vitest",
      "input": "FAIL test/a.test.ts\\nError: boom\\nTest Files 1 failed",
      "expected": "FAIL test/a.test.ts\\nError: boom\\nTest Files 1 failed"
    }
  ]
}
```

### فیلدهای RTK

| فیلد                        | ضروری   | توضیحات                                                                       |
| --------------------------- | ------- | ----------------------------------------------------------------------------- |
| `id`                        | بله     | شناسه پایدار فیلتر                                                           |
| `label`                     | بله     | نام قابل نمایش در داشبورد                                                    |
| `category`                  | بله     | خانواده فیلتر: git, test, build, shell, docker, package, infra, cloud, generic |
| `priority`                  | خیر     | اولویت بالاتر برنده می‌شود هنگام تطبیق چند فیلتر                              |
| `match.outputTypes`         | خیر     | شناسه‌های خروجی آشکارساز که این فیلتر را انتخاب می‌کنند                       |
| `match.commands`            | خیر     | توکن‌های فرمان که این فیلتر را انتخاب می‌کنند                                |
| `match.patterns`            | خیر     | الگوهای regex که این فیلتر را از متن خروجی انتخاب می‌کنند                     |
| `rules.stripAnsi`           | خیر     | حذف توالی‌های فرار ANSI قبل از مراحل regex                                   |
| `rules.replace`             | خیر     | جایگزینی‌های regex مرتب که خط‌به‌خط اعمال می‌شوند                            |
| `rules.matchOutput`         | خیر     | قواعد خروجی میان‌بر با محافظ `unless` اختیاری                                |
| `rules.includePatterns`     | خیر     | خطوطی که ترجیحاً باید حفظ شوند                                               |
| `rules.dropPatterns`        | خیر     | خطوطی که به عنوان نویز حذف می‌شوند                                           |
| `rules.collapsePatterns`    | خیر     | خطوط تکراری تطبیق‌شده که می‌توانند فشرده شوند                                |
| `rules.deduplicate`         | خیر     | فروپاشی خطوط نرمالایز شده تکراری                                             |
| `rules.truncateLineAt`      | خیر     | محدودیت کاراکتر هر خط با پشتیبانی Unicode                                    |
| `rules.maxLines`            | خیر     | حداکثر خطوط نگهداری‌شده قبل از حفظ انتهای خروجی                              |
| `rules.headLines`           | خیر     | خطوط ابتدایی حفظ‌شده هنگام برش                                              |
| `rules.tailLines`           | خیر     | خطوط انتهایی حفظ‌شده برای بافتار اخیر                                        |
| `rules.onEmpty`             | خیر     | پیام بازگشتی هنگامی که فیلتر کردن همه محتوا را حذف می‌کند                    |
| `rules.filterStderr`        | خیر     | نرمالایز پیشوندهای رایج stderr قبل از مراحل فیلتر بعدی                       |
| `preserve.errorPatterns`    | خیر     | خطوط خطا که باید برش را تحمل کنند                                            |
| `preserve.summaryPatterns`  | خیر     | خطوط خلاصه که باید برش را تحمل کنند                                          |
| `tests[]`                   | خیر     | نمونه‌های تأیید درون‌خطی که توسط گیت verify RTK استفاده می‌شوند             |

RTK مراحل اعلانی را به این ترتیب اعمال می‌کند: `stripAnsi`، `filterStderr`، `replace`،
`matchOutput`، `dropPatterns`/`includePatterns`، `truncateLineAt`، `headLines`/`tailLines`،
`maxLines` و `onEmpty`.

فیلترهای سفارشی را می‌توان از مسیرهای زیر بارگذاری کرد:

1. فایل‌های `.rtk/filters.json` پروژه فقط پس از وجود هش `.rtk/trust.json` مطابق یا
   فعال بودن `trustProjectFilters`.
2. مسیر سراسری `DATA_DIR/rtk/filters.json`.
3. فیلترهای داخلی.

فایل‌های سفارشی پروژه/سراسری ممکن است شامل یک شیء فیلتر یا آرایه‌ای از اشیاء فیلتر باشند. فیلترهای
سفارشی نامعتبر با اخطار تشخیصی رد می‌شوند؛ فیلترهای داخلی نامعتبر در اعتبارسنجی شکست می‌خورند.

فایل اعتماد پروژه:

```json
{
  "filtersSha256": "0123456789abcdef..."
}
```

بازنویسی محیطی `OMNIROUTE_RTK_TRUST_PROJECT_FILTERS=1` به فیلترهای پروژه بدون هش اعتماد می‌کند و
باید محدود به توسعه محلی کنترل‌شده باشد.

## قواعد ایمنی

- قواعد را idempotent نگه دارید: اجرای دو بار یک فیلتر نباید خروجی را خراب کند.
- متن دقیق خطا، مسیرهای فایل، شماره خطوط و خلاصه‌های فرمان را در صورت امکان حفظ کنید.
- از قواعدی که بلوک‌های کد، payloadهای JSON، URLها یا اسرار را تغییر می‌دهند پرهیز کنید.
- پوشش واحد برای خانواده‌های فرمان جدید در آزمون‌های آشکارساز/فیلتر اضافه کنید.
- نمونه‌های `tests[]` را به هر فیلتر داخلی و فیلترهای سفارشی مشترک اضافه کنید.

## اعتبارسنجی

بسته‌های قواعد قبل از استفاده اعتبارسنجی می‌شوند. بسته‌های داخلی Caveman و فیلترهای داخلی RTK در طول
اعتبارسنجی سریع شکست می‌خورند تا دارایی‌های معیوب پیش از ارسال شناسایی شوند. فیلترهای سفارشی RTK
هنگام شکست parsing یا اعتبارسنجی اعتماد، با اخطار تشخیصی رد می‌شوند.

اعتبارسنجی متمرکز:

```bash
node --import tsx/esm --test tests/unit/compression/rule-loader.test.ts tests/unit/compression/language-packs.test.ts
node --import tsx/esm --test tests/unit/compression/rtk-verify.test.ts tests/unit/compression/rtk-dsl-pipeline.test.ts
```
