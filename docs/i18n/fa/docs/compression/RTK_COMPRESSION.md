---
title: "فشرده‌سازی RTK"
version: 3.8.40
lastUpdated: 2026-06-28
---

# فشرده‌سازی RTK

فشرده‌سازی RTK موتور فشرده‌سازی آگاه از فرمان RouteChi برای خروجی ترمینال و ابزار است. این موتور
برای نشست‌های coding-agent طراحی شده که در آن‌ها بیشتر رشد بافتار ناشی از لاگ‌های آزمون، خروجی build،
نویز package manager، transcriptهای shell، خروجی Docker، خروجی git و ردپای پشته است.

RTK می‌تواند مستقیماً با `defaultMode: "rtk"` یا به‌عنوان اولین مرحله در یک خط لوله ترکیبی اجرا شود، معمولاً:

```txt
rtk -> caveman
```

این ترتیب ابتدا خروجی پرنویز ماشین را فشرده می‌کند، سپس به Caveman اجازه می‌دهد متن باقی‌مانده را متراکم کند.

RTK بالادست `60-90%` صرفه‌جویی خروجی فرمان را گزارش می‌دهد. نشست نمونه README آن از
`~118,000` توکن استاندارد به `~23,900` توکن RTK می‌رسد، که `79.7%` صرفه‌جویی است (`~80%`). RouteChi از
این میانگین بالادست برای محاسبه صرفه‌جویی ترکیبی با فشرده‌سازی ورودی Caveman استفاده می‌کند:

```txt
RTK average:    80% saved
Caveman input: 46% saved
Stacked:       1 - (1 - 0.80) * (1 - 0.46) = 89.2% saved
Range:         1 - (1 - 0.60..0.90) * (1 - 0.46) = 78.4-94.6%
```

## آنچه فشرده می‌کند

کاتالوگ داخلی در حال حاضر ۴۹ فیلتر در این دسته‌بندی‌ها ارسال می‌کند:

| دسته     | مثال‌ها                                                       |
| -------- | ------------------------------------------------------------- |
| `git`    | `git status`, `git branch`, `git diff`, `git log`             |
| `test`   | Vitest, Jest, Pytest, Playwright, Go tests, Cargo tests       |
| `build`  | TypeScript, ESLint, Biome, Prettier, Vite, Webpack, Turbo, Nx |
| `package`| `npm install`, `npm audit`, `pip`, `uv sync`, Poetry, Bundler |
| `shell`  | `ls`, `find`, `grep`, لاگ‌های عمومی shell                      |
| `docker` | `docker ps`, لاگ‌های Docker                                   |
| `infra`  | Terraform, OpenTofu, `systemctl status`                       |
| `generic`| خروجی JSON، ردپای پشته، بازگشت خروجی عمومی                    |

آشکارساز در `open-sse/services/compression/engines/rtk/commandDetector.ts` خروجی را قبل از انتخاب فیلتر
طبقه‌بندی می‌کند. فیلترها همچنین می‌توانند با الگوی فرمان یا regex خروجی تطبیق پیدا کنند، زمانی که کلاس
فرمان کافی نباشد.

## حل فیلتر

RTK فیلترها را به این ترتیب بارگذاری می‌کند:

1. فیلترهای پروژه از `.rtk/filters.json`، فقط هنگامی که مورد اعتماد باشند.
2. فیلترهای سراسری از `DATA_DIR/rtk/filters.json`.
3. فیلترهای داخلی از `open-sse/services/compression/engines/rtk/filters/`.

فیلترهای پروژه عمداً با گیت اعتماد محدود شده‌اند زیرا فیلترهای regex می‌توانند نحوه نمایش خروجی ابزار به
عامل‌ها را تغییر دهند. یک فایل فیلتر پروژه در صورتی پذیرفته می‌شود که یکی از این شرایط برقرار باشد:

- `rtkConfig.trustProjectFilters` برابر `true` باشد.
- `OMNIROUTE_RTK_TRUST_PROJECT_FILTERS=1` تنظیم شده باشد.
- `.rtk/trust.json` حاوی هش SHA-256 از `.rtk/filters.json` باشد.

مثال فایل اعتماد:

```json
{
  "filtersSha256": "0123456789abcdef..."
}
```

فیلترهای سفارشی می‌توانند یک شیء فیلتر یا آرایه‌ای از اشیاء فیلتر باشند. فیلترهای سفارشی نامعتبر
رد شده و توسط تشخیصی `/api/context/rtk/filters` گزارش می‌شوند. فیلترهای داخلی نامعتبر سریع شکست می‌خورند.

## DSL فیلتر

فیلترها از طرح‌واره JSON که در [قالب قواعد فشرده‌سازی](./COMPRESSION_RULES_FORMAT.md) توضیح داده شده، استفاده می‌کنند.
زمان اجرا این مراحل را به ترتیب اعمال می‌کند:

```txt
stripAnsi -> filterStderr -> replace -> matchOutput -> drop/include lines
  -> truncateLineAt -> head/tail/maxLines -> onEmpty
```

فیلدهای مهم:

| فیلد                          | هدف                                                            |
| ----------------------------- | -------------------------------------------------------------- |
| `rules.stripAnsi`             | حذف توالی‌های رنگ/کنترل ترمینال قبل از تطبیق                   |
| `rules.filterStderr`          | نرمالایز پیشوندهای رایج stderr قبل از تطبیق/فیلتر              |
| `rules.replace`               | اعمال جایگزینی‌های regex مرتب                                  |
| `rules.matchOutput`           | بازگرداندن یک خلاصه فشرده هنگام تطبیق خروجی با یک شرط شناخته‌شده |
| `rules.matchOutput[].unless`  | رد کردن میان‌بر هنگام وجود الگوی خطا/شکست                      |
| `rules.dropPatterns`          | حذف خطوط پرنویز                                                |
| `rules.includePatterns`       | ترجیح خطوط قابل اقدام                                          |
| `rules.collapsePatterns`      | فروپاشی خطوط تکراری تطبیق‌شده                                  |
| `rules.deduplicate`           | opt-in برای هر فیلتر: فروپاشی خطوط تکراری متوالی               |
| `rules.truncateLineAt`        | برش هر خط با پشتیبانی Unicode                                  |
| `rules.onEmpty`               | پیام بازگشتی اگر همه خطوط فیلتر شوند                           |
| `tests[]`                     | نمونه‌های درون‌خطی که توسط گیت verify استفاده می‌شوند          |

از فیلترهای داخلی انتظار می‌رود نمونه‌های `tests[]` درون‌خطی را شامل شوند. فیلترهای سفارشی نیز باید
آن‌ها را شامل شوند، به‌ویژه زمانی که در میان پروژه‌ها به اشتراک گذاشته می‌شوند.

## حذف تکراری خط (دو لایه)

RTK خطوط تکراری را در دو لایه مستقل فروپاشی می‌کند:

1. **`deduplicate` برای هر فیلتر (opt-in، پیش‌فرض `false`).** یک فیلتر می‌تواند `rules.deduplicate: true` را
   تنظیم کند تا خطوط تکراری متوالی را _داخل خروجی تطبیق‌شده آن فیلتر_، قبل از برش فروپاشی کند.
   این کار داخل `lineFilter.ts` اجرا می‌شود. برای فیلترهای قدیمی، هنگامی که فیلتر
   `collapsePatterns` را تعریف می‌کند، به‌صورت خودکار فعال می‌شود. طرح‌واره: `deduplicate: z.boolean().default(false)` در
   `open-sse/services/compression/engines/rtk/filterSchema.ts`.
2. **`deduplicateThreshold` در سطح موتور (پیش‌فرض `3`).** پس از اجرای همه فیلترها، موتور
   هر اجرای `>= deduplicateThreshold` خط متوالی یکسان در کل نتیجه را فروپاشی می‌کند
   (`deduplicateRepeatedLines`، اعمال شده در `engines/rtk/index.ts`). این مقدار در هنگام
   نرمالایز به ۲–۱۰۰ محدود می‌شود.

پاس برای هر فیلتر اول اجرا می‌شود (داخل فیلتر)، پاس سراسری موتور آخر اجرا می‌شود (بر روی خروجی
پیوسته)، بنابراین این دو بدون شمارش مضاعف با هم ترکیب می‌شوند.

## گروه‌بندی خط (`enableGrouping`)

هنگامی که `rtkConfig.enableGrouping` برابر `true` (پیش‌فرض `false`) باشد، RTK یک پاس اضافی `groupSimilarLines`
را بر روی نتیجه پس از حذف تکراری اجرا می‌کند که اجرا‌های خطوط متوالی _نزدیک به معادل_ (نه byte-identical)
را فروپاشی می‌کند. `rtkConfig.groupingThreshold` (پیش‌فرض `3`) حداقل طول اجرا است که گروه‌بندی را
راه‌اندازی می‌کند. این هم‌نوع ساختاری `deduplicateThreshold` است: حذف تکراری تکرارهای دقیق را مدیریت می‌کند،
گروه‌بندی "همان شکل با تفاوت‌های کوچک" را مدیریت می‌کند. هر دو پرچم بخشی از JSON `rtkConfig`
هستند که در جدول `key_value` ذخیره می‌شود (به پیکربندی بالا مراجعه کنید)، بنابراین تنظیم از ری‌استارت جان سالم به در می‌برد.

## حذف توضیحات کد (`stripCodeComments` / `preserveDocstrings`)

هنگامی که `rtkConfig.applyToCodeBlocks` فعال باشد، RTK می‌تواند توضیحات را از بلوک‌های کد محصور شده نیز حذف کند:

- `stripCodeComments` (پیش‌فرض `false`) — opt-in. هنگامی که `true` باشد، RTK توضیحات را از بلوک‌های محصور شده
  JavaScript و TypeScript حذف می‌کند. این پرچم از نظر تاریخی خوانده می‌شد اما هرگز اعمال نمی‌شد، بنابراین پیش‌فرض
  در "حفظ" باقی می‌ماند تا از یک تغییر بی‌صدا در تولید جلوگیری شود.
- `preserveDocstrings` (پیش‌فرض `true`) — هنگام حذف توضیحات، توضیحات بلوکی JSDoc/`/** … */` نگه داشته
  می‌شوند (آن‌ها مستندات API را حمل می‌کنند که بیشتر از بایت‌هایی که هزینه می‌کنند ارزش دارد). برای حذف
  آن‌ها نیز `false` تنظیم کنید.

حذف توضیحات در `open-sse/services/compression/engines/rtk/codeStripper.ts` پیاده‌سازی شده است. این ماژول از
**پارسر TypeScript** (نه regex) استفاده می‌کند تا literalهای رشته، template و regex هرگز با
توضیحات اشتباه گرفته نشوند، و هنگامی که JSX تشخیص داده می‌شود کاملاً خارج می‌شود (تا توضیحات expression-container مربوط به JSX
هرگز خراب نشوند). حذف توضیحات در حال حاضر فقط بر **JavaScript و TypeScript** اعمال می‌شود — سایر
زبان‌ها در مجموعه `CodeLanguage` stripper (Python، Rust، Go، Ruby، Java) فروپاشی خط خالی و
فاصله دارند اما حذف توضیحات ندارند. اجرای بلوک حذف‌شده با `rtk:code-strip` در
`rulesApplied` برچسب‌گذاری می‌شود.

> **یادداشت — کدگذاری GCF / جدولی یک موتور جداگانه است.** RTK شامل انکودر جدولی/ستونی JSON به نام "GCF"
> (Graph Compact Format) **نیست**. آن انکودر — که جایگزین یک انکودر قدیمی‌تر
> `omni-tabular` شد — در موتور **headroom** قرار دارد
> (`open-sse/services/compression/engines/headroom/`، با کدک vendored شده تحت
> `headroom/gcf/`). این انکودر به خط لوله فیلتر RTK که در اینجا مستند شده ربطی ندارد.

## پیکربندی

تنظیمات سراسری از طریق `/api/settings/compression` در دسترس هستند. تنظیمات خاص RTK نیز
از طریق `/api/context/rtk/config` در دسترس هستند.

```json
{
  "defaultMode": "stacked",
  "autoTriggerMode": "stacked",
  "autoTriggerTokens": 32000,
  "stackedPipeline": [
    { "engine": "rtk", "intensity": "standard" },
    { "engine": "caveman", "intensity": "full" }
  ],
  "rtkConfig": {
    "enabled": true,
    "intensity": "standard",
    "applyToToolResults": true,
    "applyToCodeBlocks": false,
    "applyToAssistantMessages": false,
    "enabledFilters": [],
    "disabledFilters": [],
    "maxLinesPerResult": 120,
    "maxCharsPerResult": 12000,
    "deduplicateThreshold": 3,
    "customFiltersEnabled": true,
    "trustProjectFilters": false,
    "rawOutputRetention": "never",
    "rawOutputMaxBytes": 1048576,
    "enableGrouping": false,
    "groupingThreshold": 3,
    "stripCodeComments": false,
    "preserveDocstrings": true
  }
}
```

`enabledFilters` و `disabledFilters` از شناسه فیلترها استفاده می‌کنند، برای مثال `test-vitest` یا `git-diff`.

شکل کامل `rtkConfig` توسط `RtkConfig` / `DEFAULT_RTK_CONFIG` در
`open-sse/services/compression/types.ts` تعریف شده است. کل شیء به‌عنوان یک مقدار JSON واحد در
جدول SQLite `key_value` تحت `namespace = "compression"`، `key = "rtkConfig"`
(`src/lib/db/compression.ts`) ذخیره می‌شود، و هنگام خواندن توسط `normalizeRtkConfig` نرمالایز می‌شود. بنابراین هر فیلد زیر
— شامل `enableGrouping`، `groupingThreshold`، `stripCodeComments` و `preserveDocstrings` —
از طریق همان ذخیره‌گاه رفت‌وبرگشت می‌کند و از ری‌استارت جان سالم به در می‌برد.

| کلید                   | پیش‌فرض | هدف                                                                          |
| ---------------------- | ------- | ---------------------------------------------------------------------------- |
| `deduplicateThreshold` | `3`     | سراسری موتور: حداقل خطوط متوالی یکسان برای فروپاشی (محدود به ۲–۱۰۰)          |
| `enableGrouping`       | `false` | opt-in: فروپاشی اجرا‌های خطوط متوالی نزدیک به معادل                          |
| `groupingThreshold`    | `3`     | حداقل اجرای خطوط مشابه که گروه‌بندی را راه‌اندازی می‌کند                      |
| `stripCodeComments`    | `false` | opt-in: حذف توضیحات از بلوک‌های کد محصور شده (نیازمند `applyToCodeBlocks`)     |
| `preserveDocstrings`   | `true`  | هنگام حذف توضیحات، نگه داشتن بلوک‌های JSDoc/`/** … */`                        |

## API

| مسیر                              | متد    | هدف                                          |
| --------------------------------- | ------ | -------------------------------------------- |
| `/api/context/rtk/config`         | GET    | خواندن پیکربندی RTK                          |
| `/api/context/rtk/config`         | PUT    | به‌روزرسانی پیکربندی RTK                     |
| `/api/context/rtk/filters`        | GET    | فهرست کاتالوگ فیلتر و بارگذاری تشخیصی        |
| `/api/context/rtk/test`           | POST   | پیش‌نمایش فشرده‌سازی RTK برای یک payload متنی |
| `/api/context/rtk/raw-output/[id]`| GET    | خواندن خروجی خام redact‌شده نگهداری‌شده       |
| `/api/compression/preview`        | POST   | پیش‌نمایش هر حالت فشرده‌سازی                 |

payload آزمون RTK:

```json
{
  "command": "npm test",
  "text": "FAIL tests/example.test.ts\nAssertionError: expected true\nTest Files 1 failed",
  "config": {
    "intensity": "standard"
  }
}
```

payload پیش‌نمایش فشرده‌سازی:

```json
{
  "mode": "stacked",
  "messages": [
    {
      "role": "tool",
      "content": "FAIL tests/example.test.ts\nAssertionError: expected true\nTest Files 1 failed"
    }
  ],
  "config": {
    "rtkConfig": {
      "rawOutputRetention": "failures"
    }
  }
}
```

مسیرهای مدیریت نیازمند احراز هویت مدیریت داشبورد یا سیاست API-key مطابق هستند.

## بازیابی خروجی خام

RTK به‌طور پیش‌فرض فقط متن فشرده‌شده را برمی‌گرداند. برای اشکال‌زدایی، `rawOutputRetention` می‌تواند خروجی خام
redact‌شده را نگه دارد:

| مقدار      | رفتار                                                       |
| ---------- | ----------------------------------------------------------- |
| `never`    | خروجی خام نگه داشته نشود                                     |
| `failures` | فقط خروجی احتمالاً ناموفق را نگه دارد                       |
| `always`   | هر خروجی خام RTK فشرده‌شده را پس از redact نگه دارد         |

فایل‌های نگهداری‌شده در مسیر زیر نوشته می‌شوند:

```txt
DATA_DIR/rtk/raw-output/
```

اسرار قبل از ذخیره‌سازی redact می‌شوند، شامل bearer tokenهای رایج، کلیدهای API، توکن‌های Slack،
کلیدهای دسترسی AWS و مقادیر `token=...`، `secret=...`، `password=...` به سبک انتساب. تحلیل
فقط شناسه pointer، اندازه و متادیتای هش را ذخیره می‌کند.

## گیت verify

گیت verify متمرکز آزمون‌های فیلتر درون‌خطی داخلی را بدون اجرای فرامین خارجی اجرا می‌کند:

```bash
node --import tsx/esm --test tests/unit/compression/rtk-verify.test.ts
```

گیت گسترده‌تر RTK این است:

```bash
node --import tsx/esm --test \
  tests/unit/compression/rtk-*.test.ts \
  tests/unit/compression/pipeline-integration.test.ts \
  tests/unit/compression/context-compression-api.test.ts
```

گیت گسترده فشرده‌سازی را قبل از انتشار اجرا کنید:

```bash
node --import tsx/esm --test \
  tests/unit/compression/*.test.ts \
  tests/golden-set/*.test.ts \
  tests/integration/compression-pipeline.test.ts \
  tests/unit/api/compression/compression-api.test.ts
```

## گسترش RTK

1. یک فایل JSON فیلتر اضافه یا به‌روز کنید.
2. حداقل یک نمونه `tests[]` که رفتار مهم را ثابت می‌کند اضافه کنید.
3. یک fixture تحت `tests/unit/compression/fixtures/rtk/` برای خانواده‌های فرمان جدید اضافه کنید.
4. هنگام معرفی یک کلاس خروجی جدید، پوشش تشخیص فرمان اضافه کنید.
5. گیت‌های verify و گسترده RTK را اجرا کنید.
6. اگر فیلتر خاص پروژه است، `.rtk/filters.json` را کامیت کنید و `.rtk/trust.json` را فقط پس از بررسی تازه‌سازی کنید.

---

## سطوح شدت (نسخه v3.8.16+)

RTK از **۳ سطح شدت** پشتیبانی می‌کند که بین **تهاجم فشرده‌سازی** و **ایمنی** تعادل ایجاد می‌کنند. سطح از طریق `config.intensity` در پیکربندی موتور تنظیم می‌شود.

### ۳ سطح

| سطح                 | آستانه برش          | صرفه‌جویی توکن | ریسک     | بهترین برای                       |
| ------------------- | ------------------- | -------------- | -------- | --------------------------------- |
| `minimal`           | ۲۴ خط در هر بخش     | ~20-40%        | بسیار کم | تولید با بافتار حیاتی             |
| `standard` (پیش‌فرض)| ۲۴ خط در هر بخش     | ~50-70%        | کم       | نشست‌های روزانه کدنویسی           |
| `aggressive`        | ۱۶ خط در هر بخش     | ~70-90%        | متوسط    | نشست‌های طولانی، حداکثر صرفه‌جویی  |

### محل وقوع برش

آستانه برش بر `lineFilter.ts` تأثیر می‌گذارد:

```ts
// From open-sse/services/compression/engines/rtk/index.ts:329-330
config.intensity === "aggressive" ? 16 : 24,
config.intensity === "aggressive" ? 16 : 24,
```

هم **head** و هم **tail** هر بخش حفظ می‌شوند؛ محتوای میانی هنگام فعال شدن برش حذف می‌شود.

### آنچه باقی می‌ماند در مقابل آنچه حذف می‌شود

| محتوا                       | minimal      | standard     | aggressive   |
| --------------------------- | ------------ | ------------ | ------------ |
| خطاها / ردپای پشته          | ✅ حفظ شده   | ✅ حفظ شده   | ✅ حفظ شده   |
| شکست‌های آزمون              | ✅ حفظ شده   | ✅ حفظ شده   | ✅ حفظ شده   |
| خطاهای build                | ✅ حفظ شده   | ✅ حفظ شده   | ✅ حفظ شده   |
| پاس‌های آزمون (پرحرف)       | ✅ حفظ شده   | 🟡 فروپاشی   | 🟡 فروپاشی   |
| خروجی روتین (لاگ‌های info)  | 🟡 فروپاشی   | 🟡 فروپاشی   | ❌ حذف شده   |
| نوارهای پیشرفت              | 🟡 فروپاشی   | ❌ حذف شده   | ❌ حذف شده   |
| Banner / ASCII art          | 🟡 فروپاشی   | ❌ حذف شده   | ❌ حذف شده   |

### انتخاب شدت درست

```
                  آیا از دست رفتن بافتار فاجعه‌بار است؟
                  │
      ┌───────────┼───────────┐
      │           │           │
    بله          خیر        مطمئن نیستم
      │           │           │
      ▼           │           │
   minimal       │           │
      │           │           │
      │           ▼           ▼
      │      توان عملیاتی   ابتدا `standard` را امتحان کنید
      │      چقدر حیاتی است؟ (برای ۸۰٪ موارد کار می‌کند)
      │           │
      │      ┌────┴────┐
      │      │         │
      │     کم        زیاد
      │      │         │
      │      ▼         ▼
      │   standard   aggressive
      │      │         │
      └──────┴─────────┘
```

### پیکربندی شدت

**برای هر combo** (در پیکربندی combo):

```json
{
  "combo": "my-coding-combo",
  "routing": {
    /* ... */
  },
  "compression": {
    "engine": "rtk",
    "intensity": "aggressive"
  }
}
```

**به‌صورت برنامه‌نویسی**:

`rtkEngine` (`@omniroute/open-sse/services/compression/engines/rtk`) یک
`CompressionEngine` است و متد `updateConfig` ندارد. به‌جای آن پیکربندی یک موتور را
از طریق راهبر رجیستری به‌روز کنید:

```ts
import { updateEngineConfig } from "@omniroute/open-sse/services/compression/engines/registry";

updateEngineConfig("rtk", { intensity: "aggressive" });
```

### تأیید اثر

از **گیت Verify** (به زیر مراجعه کنید) برای تأیید اینکه فیلتر شما در شدت انتخابی امن است استفاده کنید:

```ts
import { runRtkFilterTests } from "omniroute/compression/engines/rtk/verify";

const result = runRtkFilterTests({ intensity: "aggressive" });
if (!result.passed) {
  console.error("Filters failed at aggressive intensity");
}
```

---

## توسعه فیلتر سفارشی (نسخه v3.8.16+)

پوشه `engines/rtk/filters/` شامل **۴۹+ فایل JSON فیلتر داخلی** است. می‌توانید فایل‌های خود را برای فشرده‌سازی خروجی از ابزارهای سفارشی که توسط پیش‌فرض‌ها پوشش داده نشده‌اند، اضافه کنید.

### طرح‌واره فیلتر (Zod)

```ts
{
  "id": "string",                      // ضروری. شناسه فیلتر (kebab-case، برای مثال، "python-traceback")
  "label": "string",                   // ضروری. نام فیلتر قابل خواندن توسط انسان
  "description": "string",             // اختیاری (پیش‌فرض: ""). توضیح کوتاه کارکرد فیلتر
  "category": "git|test|build|shell|docker|package|infra|cloud|generic",
  "priority": number,                  // اختیاری (0-100، پیش‌فرض: 50). ترتیب اجرا (بالاتر = اول)
  "match": {
    "commands": ["string"],            // نام فرمان‌ها برای تطبیق (برای مثال، "python"، "pytest")
    "patterns": ["string"],            // الگوهای regex برای تطبیق خروجی
    "outputTypes": ["string"]          // کلاس‌های خروجی تشخیص داده شده (برای مثال، "test-failure")
  },
  "rules": {
    "stripAnsi": boolean,              // اختیاری (پیش‌فرض: false). حذف کدهای رنگ ANSI
    "replace": [                       // قواعد find-and-replace (پیش‌فرض: [])
      { "pattern": "regex", "replacement": "..." }
    ],
    "matchOutput": [                   // میان‌بر بر تطبیق الگو (پیش‌فرض: [])
      {
        "pattern": "regex",
        "message": "short summary",
        "unless": "regex"              // رد کنید اگر این الگو تطبیق کند
      }
    ],
    "includePatterns": ["string"],     // خطوط برای نگه داشتن (الگوهای regex، پیش‌فرض: [])
    "dropPatterns": ["string"],        // خطوط برای حذف (الگوهای regex، پیش‌فرض: [])
    "collapsePatterns": ["string"],    // خطوط برای فروپاشی به یک رخداد منفرد (پیش‌فرض: [])
    "deduplicate": boolean,            // اختیاری (پیش‌فرض: false). حذف خطوط تکراری
    "truncateLineAt": number,          // اختیاری (پیش‌فرض: 0). برش خطوط به حداکثر کاراکتر
    "maxLines": number,                // اختیاری (پیش‌فرض: 0). سقف سخت بر کل خطوط
    "headLines": number,               // اختیاری (پیش‌فرض: 20). نگه داشتن اولین N خط خروجی تطبیق‌شده
    "tailLines": number,               // اختیاری (پیش‌فرض: 20). نگه داشتن آخرین N خط خروجی تطبیق‌شده
    "onEmpty": "string",               // اختیاری (پیش‌فرض: ""). پیام بازگشتی اگر همه خطوط فیلتر شوند
    "filterStderr": boolean            // اختیاری (پیش‌فرض: false). همچنین فیلتر کردن خروجی stderr
  },
  "preserve": {
    "errorPatterns": ["string"],       // الگوهایی که همیشه باید حفظ شوند (پیش‌فرض: [])
    "summaryPatterns": ["string"]      // الگوها برای خط خلاصه نهایی (پیش‌فرض: [])
  },
  "tests": [                           // آزمون‌های درون‌خطی برای تأیید (پیش‌فرض: [])
    {
      "name": "string",               // ضروری. نام آزمون
      "input": "sample output",        // ضروری. متن ورودی نمونه
      "expected": "expected output",   // ضروری. خروجی فشرده‌شده مورد انتظار
      "command": "optional command"    // اختیاری. بافتار فرمان
    }
  ]
}
```

### مثال: فیلتر Python Traceback

```json
{
  "id": "python-traceback",
  "label": "Python Traceback Filter",
  "description": "Compresses Python tracebacks to essential file/line locations and error type",
  "category": "test",
  "priority": 60,
  "match": {
    "commands": ["python", "python3", "pytest", "uv", "poetry"],
    "patterns": ["Traceback \\(most recent call last\\)", "Error", "Exception"],
    "outputTypes": ["error-traceback"]
  },
  "rules": {
    "stripAnsi": true,
    "includePatterns": [
      "Traceback \\(most recent call last\\)",
      "^\\s*File \".+\", line \\d+",
      "^\\s*[A-Z][a-zA-Z]+Error:",
      "^\\s*[A-Z][a-zA-Z]+Exception"
    ],
    "dropPatterns": ["site-packages/", "^\\s+[a-z_]+\\([^)]*\\)$"],
    "headLines": 5,
    "tailLines": 3,
    "maxLines": 25,
    "filterStderr": true
  },
  "preserve": {
    "errorPatterns": ["Error:", "Exception:", "Traceback"],
    "summaryPatterns": ["^[A-Z][a-zA-Z]+(?:Error|Exception):"]
  },
  "tests": [
    {
      "name": "preserves-error-type-and-location",
      "input": "Traceback (most recent call last):\n  File \"app.py\", line 42, in main\n    do_thing()\n  File \"lib/utils.py\", line 17, in helper\n    return 1 / 0\nZeroDivisionError: division by zero",
      "expected": "Traceback (most recent call last):\n  File \"app.py\", line 42, in main\n  File \"lib/utils.py\", line 17, in helper\nZeroDivisionError: division by zero",
      "command": "python app.py"
    }
  ]
}
```

### بارگذاری فیلترهای سفارشی

فایل را در یک مکان شناسایی‌شده قرار دهید:

```
~/.omniroute/rtk/filters/my-filter.json     # سطح کاربر
<project>/.rtk/filters/my-filter.json      # سطح پروژه
```

فیلترها به‌صورت خودکار در هنگام راه‌اندازی از طریق `loadRtkFilters()` در `open-sse/services/compression/engines/rtk/filterLoader.ts` بارگذاری می‌شوند. loader فیلترها را از این مسیرها کشف می‌کند:

- کاتالوگ داخلی: `open-sse/services/compression/engines/rtk/filters/`
- پوشه کاربر: `~/.omniroute/rtk/filters/`
- پوشه پروژه: `<project>/.rtk/filters/`

برای بارگذاری فیلترها به‌صورت برنامه‌نویسی:

```ts
import { loadRtkFilters } from "@omniroute/open-sse/services/compression/engines/rtk/filterLoader";

// گزینه‌ها: customFiltersEnabled (بارگذاری فیلترهای کاربر/پروژه، پیش‌فرض روشن)،
// trustProjectFilters، refresh.
const filters = loadRtkFilters({ customFiltersEnabled: true });
```

### اعتبارسنجی

فیلترها در هنگام بارگذاری در برابر طرح‌واره Zod اعتبارسنجی می‌شوند. یک فیلتر با ساختار نامعتبر بارگذاری نمی‌شود و یک خطا ثبت می‌کند:

```
RTK_FILTER_LOADER: filter "my-filter" failed validation:
  - rules.replace.0.pattern: Invalid regex
  - match.commands: must not be empty
```

برای اعتبارسنجی همه فیلترهای نصب‌شده، `runRtkFilterTests()` را که از `open-sse/services/compression/engines/rtk/verify.ts` صادر شده است فراخوانی کنید.

### بهترین روش‌ها

1. **همیشه `tests[]` را شامل کنید** — آن‌ها کار می‌کردن فیلتر شما را ثابت کرده و از regression جلوگیری می‌کنند
2. **از `matchOutput` برای میان‌برها استفاده کنید** — اگر یک خط یک داستان را روایت می‌کند، کل بلوک را جایگزین کنید
3. **`keep` را به `strip` ترجیح دهید** — قواعد صریح "همیشه حفظ" از "همیشه حذف" ایمن‌تر هستند
4. **در هر ۳ سطح شدت آزمایش کنید** — `minimal` باید یک no-op باشد، `aggressive` باید همچنان خطاها را حفظ کند
5. **از فیلد `unless` استفاده کنید** — میان‌برها را با "اگر X وجود دارد، راه‌اندازی نکن" محافظت کنید

---

## بازیابی خروجی خام و گیت verify

هنگامی که RTK خروجی را به‌صورت تهاجمی فشرده می‌کند، می‌توانید **متن اصلی را بازیابی کنید** برای اشکال‌زدایی، ممیزی یا بازپخش.

### نحوه کار بازیابی خروجی خام

```
خروجی اصلی (10K توکن)
        │
        ▼
فشرده‌سازی RTK (با rawOutput.enabled=true)
        │
        ├─▶ خروجی فشرده‌شده (2K توکن)  ──▶ به LLM
        │
        └─▶ خروجی اصلی (10K توکن)   ──▶ در DB ذخیره شد
                                                  (با request_id پیوند داده شده)
```

### فعال‌سازی ذخیره‌سازی خروجی خام

**برای هر درخواست** (در پیکربندی combo):

```json
{
  "compression": {
    "engine": "rtk",
    "intensity": "aggressive",
    "rawOutput": {
      "enabled": true,
      "maxBytes": 1048576
    }
  }
}
```

**پیش‌فرض**: `rawOutput.enabled: false` (صرفه‌جویی در ذخیره‌سازی).

> **یادداشت:** در JSON بالا، فیلد `maxBytes` مقدار ۱۰۴۸۵۷۶ را دارد که نشان‌دهنده یک سقف ۱ مگابایتی است.

### هزینه ذخیره‌سازی

| برای هر درخواست              | سقف 1MB      | سقف 10MB      |
| ---------------------------- | ------------ | ------------- |
| میانگین خروجی فشرده‌شده     | ~5KB         | ~5KB          |
| خروجی خام ذخیره‌شده          | ~50-500KB    | ~500KB-5MB    |
| با ۱۰۰۰ درخواست در روز       | 50-500MB/روز | 500MB-5GB/روز |

> **توصیه:** فقط خروجی خام را برای **نشست‌های اشکال‌زدایی** یا **ممیزی نمونه‌ای** فعال کنید، نه همیشه‌روشن.

### بازیابی خروجی اصلی

```ts
import { readRtkRawOutput } from "omniroute/compression/engines/rtk/rawOutput";

const raw = readRtkRawOutput(pointerId); // pointerId از آمار فشرده‌سازی
if (raw) {
  console.log("Original output:", raw);
}
```

`pointerId` در `CompressionStats.rtkRawOutputPointers[]` پس از فشرده‌سازی برگردانده می‌شود.
برای امضای تابع به `open-sse/services/compression/engines/rtk/rawOutput.ts:102` مراجعه کنید.

### گیت verify

**تأیید فیلتر RTK** (`open-sse/services/compression/engines/rtk/verify.ts`) همه فیلترها را در برابر `tests[]` آنها اعتبارسنجی می‌کند و رفتار صحیح را در هر ۳ سطح شدت تضمین می‌کند.

**برای اجرای تأیید، `runRtkFilterTests()` را فراخوانی کنید**:

```ts
import { runRtkFilterTests } from "open-sse/services/compression/engines/rtk/verify";

const result = runRtkFilterTests();
console.log(`Passed: ${result.outcomes.filter((o) => o.passed).length}`);
console.log(`Failed: ${result.outcomes.filter((o) => !o.passed).length}`);
if (!result.passed) {
  console.error("Filters failed verification");
  result.outcomes
    .filter((o) => !o.passed)
    .forEach((o) => {
      console.error(
        `  - ${o.filterId} / ${o.testName}: expected "${o.expected}", got "${o.actual}"`
      );
    });
}
```

**آنچه اعتبارسنجی می‌کند**:

1. هر فیلتر بارگذاری شده و از اعتبارسنجی طرح‌واره عبور می‌کند
2. هر مدخل `tests[]` خروجی مورد انتظار را تولید می‌کند
3. شدت `minimal` یک no-op است (اصل را حفظ می‌کند، فقط فیلترهای ساختاری اعمال می‌شود)
4. شدت `aggressive` خطاها، شکست‌های آزمون و ردپای پشته را حفظ می‌کند
5. خروجی فشرده‌شده هرگز بزرگ‌تر از ورودی اصلی نیست

- منبع: `open-sse/services/compression/engines/rtk/` (۶۳ فایل، ~70KB)

- **قبل از ادغام تغییر فیلتر** — همیشه اطمینان حاصل کنید که آزمون‌ها عبور می‌کنند
- **پس از ارتقای موتور RTK** — طرح‌واره ممکن است تغییر کرده باشد
- **به‌صورت دوره‌ای در پایش** — از drift در fixtureهای آزمون محافظت می‌کند
- **هنگام افزودن یک خانواده ابزار/فرمان جدید** — اثبات می‌کند که فیلتر جدید کار می‌کند

---

## مراجعه کنید به

- [COMPRESSION_GUIDE.md](./COMPRESSION_GUIDE.md) — مرور کلی کامل خط لوله فشرده‌سازی
- [COMPRESSION_ENGINES.md](./COMPRESSION_ENGINES.md) — رجیستری موتور و موتورهای داخلی
- [EXTENDING_COMPRESSION.md](./EXTENDING_COMPRESSION.md) — موتورهای سفارشی، بسته‌های زبانی، خطوط لوله ترکیبی
- منبع: `open-sse/services/compression/engines/rtk/` (۶۳ فایل، ~70KB)
