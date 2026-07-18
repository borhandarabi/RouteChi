---
title: "فلگ‌های ویژگی"
version: 3.8.40
lastUpdated: 2026-06-28
---

# فلگ‌های ویژگی

> کلیدهای زمان اجرا که رفتار RouteChi را **بدون نیاز به استقرار مجدد** تغییر می‌دهند.
> هر فلگ فهرست‌شده در اینجا در
> [`src/shared/constants/featureFlagDefinitions.ts`](../../src/shared/constants/featureFlagDefinitions.ts)
> تعریف شده است — منبع واحد حقیقت. داشبورد و REST API هر دو از آن
> فایل می‌خوانند، بنابراین جدول زیر برای مطابقت ۱:۱ با آن تولید شده است.

---

## فلگ‌های ویژگی چه هستند

یک فلگ ویژگی، یک کلید نام‌گذاری‌شده (بولی یا enum) است که مقدار آن می‌تواند در
زمان اجرا تغییر کند و در پایگاه‌داده ذخیره شود، بدون نیاز به استقرار مجدد فرآیند. هر
فلگ با یک `FeatureFlagDefinition` شامل `key`، `label`،
`description`، `category`، `defaultValue`، `type` و یک نشانه `requiresRestart` توصیف می‌شود.

### ترتیب تفکیک

**مقدار مؤثر** یک فلگ با
[`resolveFeatureFlag()`](../../src/shared/utils/featureFlags.ts) با این
اولویت (بالاترین برنده است) تفکیک می‌شود:

1. **ابطال DB** — مقداری که در جدول `key_value` زیر
   فضای‌نام `feature_flags` ذخیره شده (تنظیم از طریق داشبورد یا REST API).
2. **متغیر محیطی** — `process.env[<KEY>]`، اگر تنظیم شده و غیرخالی باشد.
3. **پیش‌فرض تعریف** — `defaultValue` از `featureFlagDefinitions.ts`.

یک فلگ بولی زمانی **فعال** در نظر گرفته می‌شود که مقدار مؤثر آن `"true"`،
`"1"` یا `"yes"` باشد (به `isFeatureFlagEnabled()` مراجعه کنید).

> [!NOTE]
> بیشتر فلگ‌ها همچنین یک متغیر محیطی هم‌نام دارند که در
> [`ENVIRONMENT.md`](./ENVIRONMENT.md) مستند شده است. ابطال DB فلگ بر آن
> متغیر محیطی ارجحیت دارد. فلگی با
> `requiresRestart: true` بلافاصله ذخیره می‌شود اما تنها در راه‌اندازی
> فرآیند دوباره خوانده می‌شود — تغییر آن یک بنر **«Restart Server»** در داشبورد نمایش می‌دهد.

---

## فهرست فلگ‌ها

۳۸ فلگ در ۶ دسته. **Default** پیش‌فرض تعریف است — مقداری که
زمانی استفاده می‌شود که نه ابطال DB و نه متغیر محیطی وجود داشته باشد.

### امنیت (۷)

| Key                              | Type    | Default  | Description                                                                   |
| -------------------------------- | ------- | -------- | ----------------------------------------------------------------------------- |
| `REQUIRE_API_KEY`                | boolean | `false`  | الزام به API key برای همه درخواست‌های ورودی.                                 |
| `INPUT_SANITIZER_ENABLED`        | boolean | `true`   | فعال‌سازی پاک‌سازی ورودی برای همه درخواست‌ها.                                   |
| `INJECTION_GUARD_MODE`           | enum    | `off`    | حالت محافظ تزریق پرامپت. مقادیر: `off`، `warn`، `block`، `redact`.        |
| `PII_REDACTION_ENABLED`          | boolean | `false`  | حذف اطلاعات هویتی شخصی از درخواست‌ها.                     |
| `PII_RESPONSE_SANITIZATION`      | boolean | `false`  | پاک‌سازی PII از پاسخ‌های ارائه‌دهنده.                                         |
| `PII_RESPONSE_SANITIZATION_MODE` | enum    | `redact` | حالت پاک‌سازی PII در پاسخ. مقادیر: `redact`، `warn`، `block`، `off`. |
| `OUTBOUND_SSRF_GUARD_ENABLED`    | boolean | `true`   | مسدودسازی درخواست‌های خروجی به بازه‌های IP خصوصی/داخلی.                        |

### شبکه (۸)

| Key                                             | Type    | Default | Restart | Description                                                                                                                                                                                   |
| ----------------------------------------------- | ------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENABLE_TLS_FINGERPRINT`                        | boolean | `false` | ✓       | فعال‌سازی حالت پنهان‌سازی اثرانگشت TLS.                                                                                                                                                          |
| `ONEPROXY_ENABLED`                              | boolean | `true`  |         | فعال‌سازی پروکسی درخواست 1proxy.                                                                                                                                                               |
| `PROXY_AUTO_SELECT_ENABLED`                     | boolean | `false` |         | وقتی هیچ پروکسی به یک اتصال اختصاص داده نشده، اولین پروکسی کارآمد از رجیستری به‌صورت خودکار انتخاب می‌شود. به‌طور پیش‌فرض خاموش (در غیر این صورت هر پروکسی رجیستری به‌عنوان fallback سراسری عمل می‌کند — #3332).            |
| `OMNIROUTE_CONTROL_PLANE_PROXY_DIRECT_FALLBACK` | boolean | `false` |         | اجازه به جریان‌های OAuth و اعتبارسنجی ارائه‌دهنده برای دور زدن پروکسی ثابت و اتصال مستقیم هنگام شکست پیش‌بررسی‌های دسترسی پروکسی. به‌طور پیش‌فرض خاموش است چون می‌تواند IP خروجی را تغییر دهد.            |
| `MITM_DISABLE_TLS_VERIFY`                       | boolean | `false` | ✓       | غیرفعال‌سازی تأیید گواهی TLS برای پروکسی MITM. **خطرناک.**                                                                                                                          |
| `OMNIROUTE_ALLOW_PRIVATE_PROVIDER_URLS`         | boolean | `false` |         | اجازه به URLهای ارائه‌دهنده که به شبکه‌های خصوصی/داخلی اشاره دارند.                                                                                                                                    |
| `OMNIROUTE_ALLOW_LOCAL_PROVIDER_URLS`           | boolean | `true`  |         | اجازه به افزودن/اعتبارسنجی ارائه‌دهندگان روی آدرس‌های محلی/خصوصی (127.0.0.1، localhost، LAN). به‌طور پیش‌فرض فعال (محلی‌محور)؛ برای مسدودسازی سخت‌گیرانه فقط-عمومی غیرفعال کنید. Cloud-metadata همچنان مسدود می‌ماند. |
| `ENABLE_CC_COMPATIBLE_PROVIDER`                 | boolean | `false` | ✓       | فعال‌سازی حالت ارائه‌دهنده سازگار با Claude Code.                                                                                                                                                  |

### خط‌مشی‌ها (۳)

| Key                                       | Type    | Default    | Restart | Description                                                            |
| ----------------------------------------- | ------- | ---------- | ------- | ---------------------------------------------------------------------- |
| `TOOL_POLICY_MODE`                        | enum    | `disabled` |         | حالت اجرای خط‌مشی ابزار. مقادیر: `disabled`، `warn`، `block`. |
| `RATE_LIMIT_AUTO_ENABLE`                  | boolean | `false`    |         | فعال‌سازی خودکار محدودسازی نرخ بر اساس الگوهای استفاده.            |
| `ALLOW_MULTI_CONNECTIONS_PER_COMPAT_NODE` | boolean | `false`    | ✓       | اجازه به اتصال‌های متعدد برای هر گره سازگاری.                     |

### زمان اجرا (۱۰)

| Key                                         | Type    | Default | Restart | Description                                                                                                                                         |
| ------------------------------------------- | ------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OMNIROUTE_MCP_ENFORCE_SCOPES`              | boolean | `true`  |         | اجرای محدودیت‌های scope روی دسترسی به ابزار MCP.                                                                                                      |
| `OMNIROUTE_MCP_COMPRESS_DESCRIPTIONS`       | boolean | `false` |         | فشرده‌سازی توضیحات ابزار MCP برای کاهش مصرف توکن.                                                                                               |
| `OMNIROUTE_ENABLE_RUNTIME_BACKGROUND_TASKS` | boolean | `false` |         | فعال‌سازی پردازش وظایف پس‌زمینه در زمان اجرا.                                                                                                       |
| `OMNIROUTE_DISABLE_BACKGROUND_SERVICES`     | boolean | `false` | ✓       | غیرفعال‌سازی همه سرویس‌های پس‌زمینه (بازخوانی سهمیه، همگام‌سازی و غیره).                                                                                         |
| `OMNIROUTE_RTK_TRUST_PROJECT_FILTERS`       | boolean | `false` |         | اعتماد به فیلترهای RTK در سطح پروژه بدون اعتبارسنجی.                                                                                                 |
| `OMNIROUTE_ENABLE_LIVE_WS`                  | boolean | `true`  | ✓       | راه‌اندازی سرور WebSocket داشبورد بلادرنگ هنگام import (پورت 20129 به‌طور پیش‌فرض).                                                                   |
| `OMNIROUTE_CODEX_WS_ENABLED`                | boolean | `true`  |         | اجازه به Codex برای استفاده از انتقال Responses-over-WebSocket. وقتی خاموش باشد، Codex به HTTP Responses برمی‌گردد.                                            |
| `OMNIROUTE_EMERGENCY_FALLBACK`              | boolean | `true`  |         | مسیریابی درخواست‌های تمام‌شده‌ی بودجه به ارائه‌دهنده/مدل fallback رایگان اضطراری. (به [Emergency Budget Fallback](#emergency-budget-fallback) در ادامه مراجعه کنید.) |
| `MODEL_CATALOG_INCLUDE_NAMES`               | boolean | `true`  |         | گنجاندن فیلدهای نام نمایش‌دوستانه در پاسخ‌های `/v1/models`. برای کلاینت‌هایی که فقط شناسه مدل می‌خواهند، غیرفعال کنید.                                     |
| `ARENA_ELO_SYNC_ENABLED`                    | boolean | `true`  |         | فعال‌سازی همگام‌سازی دوره‌ای ELO تابلوی برتری Arena AI برای رتبه‌بندی هوش مدل.                                                                      |

### CLI (۳)

| Key                          | Type    | Default | Restart | Description                                                                                                    |
| ---------------------------- | ------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `CLI_COMPAT_ALL`             | boolean | `false` | ✓       | فعال‌سازی حالت سازگاری برای همه کلاینت‌های CLI.                                                                 |
| `MODEL_ALIAS_COMPAT_ENABLED` | boolean | `false` |         | فعال‌سازی لایه سازگاری نام‌مستعار مدل.                                                                        |
| `PRICING_SYNC_ENABLED`       | boolean | `false` |         | فعال‌سازی همگام‌سازی خودکار داده‌های قیمت‌گذاری (همچنین به متغیر محیطی `PRICING_SYNC_ENABLED` نیاز دارد). |

### سلامت (۳)

| Key                                   | Type    | Default | Description                                              |
| ------------------------------------- | ------- | ------- | -------------------------------------------------------- |
| `OMNIROUTE_DISABLE_LOCAL_HEALTHCHECK` | boolean | `false` | غیرفعال‌سازی endpoint بررسی سلامت نمونه محلی.        |
| `OMNIROUTE_DISABLE_TOKEN_HEALTHCHECK` | boolean | `false` | غیرفعال‌سازی بررسی سلامت اعتبارسنجی توکن.               |
| `SKILLS_SANDBOX_NETWORK_ENABLED`      | boolean | `false` | فعال‌سازی دسترسی شبکه در محیط sandbox مهارت‌ها. |

> [!NOTE]
> ستون `Restart` فلگ‌هایی با `requiresRestart: true` را نشان می‌دهد — مقدار
> بلافاصله ذخیره می‌شود اما تنها پس از بارگذاری مجدد فرآیند اعمال می‌شود. فلگ‌های
> enum هر مقداری خارج از مجموعه مجاز خود را رد می‌کنند (هم در `setFeatureFlagOverride()` و هم در
> هندلر REST `PUT` سمت سرور اعتبارسنجی می‌شود).

---

## تغییر فلگ‌ها

### داشبورد

به **Dashboard → Settings → Feature Flags**
(`/dashboard/settings/feature-flags`) بروید. شبکه
(`src/app/(dashboard)/dashboard/settings/components/FeatureFlagsGrid.tsx`)
پشتیبانی می‌کند از:

- **جستجو** بر اساس کلید یا توضیح، و **فیلتر** بر اساس دسته (به‌علاوه یک نمای ترکیبی
  **Requires Restart**).
- یک **کلید toggler** برای فلگ‌های بولی و یک **dropdown** برای فلگ‌های enum
  (`src/app/(dashboard)/dashboard/settings/components/FeatureFlagCard.tsx`).
- یک **نشان منبع** برای هر فلگ — `DB`، `ENV` یا `DEF` — که نشان می‌دهد مقدار
> مؤثر از کجا آمده است.
- یک دکمه **Reset** (فقط برای فلگ‌های با منبع `DB` نمایش داده می‌شود) برای حذف ابطال،
  و یک دکمه **Reset All Overrides** در پایین.
- یک بنر **Restart Server** هنگامی که یک فلگ `requiresRestart` تغییر کند.

### REST API

همه عملیات از یک مسیر واحد عبور می‌کنند:
[`src/app/api/settings/feature-flags/route.ts`](../../src/app/api/settings/feature-flags/route.ts).
هر متد نیازمند یک session احراز هویت‌شده داشبورد است (در غیر این صورت `401`).

#### `GET /api/settings/feature-flags`

هر فلگ را با مقدار مؤثر، منبع و یک خلاصه برمی‌گرداند.

```jsonc
{
  "flags": [
    {
      "key": "REQUIRE_API_KEY",
      "label": "Require API Key",
      "description": "Require an API key for all incoming requests",
      "category": "security",
      "type": "boolean",
      "enumValues": null,
      "defaultValue": "false",
      "effectiveValue": "false",
      "source": "default", // "db" | "env" | "default"
      "requiresRestart": false,
      "warningLevel": "caution",
    },
    // ... all 33 flags
  ],
  "summary": {
    "total": 33,
    "active": 0,
    "inactive": 0,
    "overriddenByDb": 0,
    "overriddenByEnv": 0,
  },
}
```

#### `PUT /api/settings/feature-flags`

تنظیم یا حذف یک ابطال منفرد. بدنه: `{ key: string; value?: string }`.
حذف `value`، ابطال را حذف می‌کند (بازگرداندن env / پیش‌فرض).

```bash
# Set a DB override
curl -X PUT http://localhost:20128/api/settings/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"key":"REQUIRE_API_KEY","value":"true"}'

# Remove the override (no "value")
curl -X PUT http://localhost:20128/api/settings/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"key":"REQUIRE_API_KEY"}'
```

پاسخ، `effectiveValue`/`source` جدید، `previousValue`/
`previousSource` و `requiresRestart` را اکو می‌کند. کلیدهای ناشناخته و مقادیر enum خارج از
بازه با `400` رد می‌شوند.

#### `DELETE /api/settings/feature-flags`

همه ابطال‌های DB را یکباره پاک می‌کند و هر فلگ را به مقدار env / پیش‌فرض
بازمی‌گرداند. `{ cleared: <count>, message: "..." }` را برمی‌گرداند.

> [!NOTE]
> فلگ‌هایی با `requiresRestart: true` تنها پس از بارگذاری مجدد فرآیند اعمال می‌شوند.
> جریان راه‌اندازی مجدد داشبورد `POST /api/restart` را صدا می‌زند و سپس
> `GET /api/health/ping` را تا زمانی که سرور بالا بیاید نظرسنجی می‌کند.

---

## Emergency Budget Fallback

`OMNIROUTE_EMERGENCY_FALLBACK` (دسته `runtime`، پیش‌فرض `true`) مسیر
fallback رایگان اضطراری را در
[`open-sse/services/emergencyFallback.ts`](../../open-sse/services/emergencyFallback.ts)
کنترل می‌کند. وقتی فعال باشد، درخواست‌هایی که بودجه خود را تمام کرده‌اند به جای شکست
مستقیم، به یک ارائه‌دهنده/مدل fallback رایگان مسیریابی می‌شوند. آن را روی `false` (یا `0`)
تنظیم کنید — از طریق toggle داشبورد، یک ابطال DB یا متغیر محیطی `OMNIROUTE_EMERGENCY_FALLBACK`
— تا رفتار را غیرفعال کنید و اجازه دهید درخواست‌های تمام‌شده‌ی بودجه
شکست بخورند. (به‌عنوان یک toggle داشبورد در PRهای #3741 / #3752 نمایش داده شده است.)

---

## همچنین ببینید

- [مرجع متغیرهای محیطی](./ENVIRONMENT.md) — بیشتر فلگ‌ها یک
  متغیر محیطی هم‌نام دارند که آنجا مستند شده (ابطال DB بر آن
  ارجحیت دارد).
- [`src/shared/constants/featureFlagDefinitions.ts`](../../src/shared/constants/featureFlagDefinitions.ts)
  — منبع حقیقت برای هر فلگ.
- [`src/shared/utils/featureFlags.ts`](../../src/shared/utils/featureFlags.ts)
  — منطق تفکیک (`resolveFeatureFlag`، `isFeatureFlagEnabled`،
  `resolveAllFeatureFlags`).
- [`src/lib/db/featureFlags.ts`](../../src/lib/db/featureFlags.ts) — ماندگاری ابطال
  DB در فضای‌نام `feature_flags` از جدول `key_value`.
