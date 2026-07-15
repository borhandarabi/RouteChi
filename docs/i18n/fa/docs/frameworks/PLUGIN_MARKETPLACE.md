---
title: "فروشگاه پلاگین"
version: 3.8.40
lastUpdated: 2026-06-28
---

# فروشگاه پلاگین

> **منبع حقیقت:** `src/lib/plugins/` (`marketplace.ts`, `manager.ts`, `manifest.ts`,
> `scanner.ts`, `loader.ts`), `src/app/api/plugins/`, و
> `src/app/(dashboard)/dashboard/plugins/`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

RouteChi یک سیستم پلاگین به سبک وردپرس عرضه می‌کند. پلاگین‌ها دایرکتوری‌های
خودکافی هستند — هر کدام با یک manifest مربوط به `plugin.json` و یک فایل ورودی — که به
pipeline درخواست (`onRequest` / `onResponse` / `onError`) و به
رویدادهای چرخه حیات (`onInstall` / `onActivate` / `onDeactivate` / `onUninstall`) متصل می‌شوند.

**فروشگاه پلاگین** لایه کشف روی آن سیستم است. یک کاتالوگ قابل مرور از
پلاگین‌های قابل نصب را نمایش می‌دهد. به‌صورت پیش‌فرض کاتالوگ یک رجیستری seed داخلی
کوچک است؛ یک اپراتور می‌تواند آن را به یک URL رجیستری راه‌دور سفارشی هدایت کند، که در این
صورت fetch توسط یک محافظ SSRF با قابلیت resolve کردن DNS سخت‌شده می‌شود
(به [امنیت](#security) مراجعه کنید).

هر مسیر پلاگین **فقط loopback** است (Tier 1 — `LOCAL_ONLY`): پلاگین‌ها
کد را در فرآیندهای فرزند load و اجرا می‌کنند، بنابراین مسیرها از یک
مبدا غیر loopback بدون توجه به auth غیرقابل دسترسی هستند. به
[`docs/security/ROUTE_GUARD_TIERS.md`](../security/ROUTE_GUARD_TIERS.md) مراجعه کنید.

## نحوه‌ی هماهنگی اجزا

```
Dashboard (/dashboard/plugins)
  ├─ "Installed" tab  → GET /api/plugins            (listPlugins)
  │                     POST /api/plugins/scan      (pluginManager.scan)
  │                     POST /api/plugins/{name}/activate|deactivate
  │                     DELETE /api/plugins/{name}   (uninstall)
  └─ "Marketplace" tab → GET /api/plugins/marketplace
                          → listMarketplacePlugins()
                            ├─ no custom URL → built-in SEED_REGISTRY
                            └─ custom URL → isSafeMarketplaceUrl() SSRF guard
                                          → safeOutboundFetch(guard:"public-only")
```

- **لایه رجیستری** — `src/lib/plugins/marketplace.ts`: کاتالوگ را فهرست/جستجو
  می‌کند، و در صورت بروز هرگونه شکست به رجیستری seed برمی‌گردد.
- **لایه چرخه حیات** — `src/lib/plugins/manager.ts` (singleton مربوط به `pluginManager`):
  install، ارتقا، activate، deactivate، uninstall، scan، startup load.
- **لایه manifest** — `src/lib/plugins/manifest.ts`: schema مربوط به Zod + پیش‌فرض‌های
  `plugin.json`.
- **اسکنر** — `src/lib/plugins/scanner.ts`: پلاگین‌ها را روی دیسک زیر
  دایرکتوری پلاگین کشف می‌کند.
- **Loader** — `src/lib/plugins/loader.ts`: هر پلاگین را در یک فرآیند فرزند
  ایزوله اجرا می‌کند و فراخوانی‌های hook را از طریق IPC واسطه‌گری می‌کند.

## کاتالوگ فروشگاه

`listMarketplacePlugins()` (`src/lib/plugins/marketplace.ts`) فهرستی از
اشیاء `MarketplaceEntry` را برمی‌گرداند:

| فیلد         | نوع     | یادداشت‌ها                                |
| ------------- | -------- | ------------------------------------ |
| `name`        | string   | نام پلاگین به سبک kebab-case               |
| `version`     | string   | semver                               |
| `description` | string   | خلاصه کوتاه                        |
| `author`      | string   | نویسنده / سازمان                         |
| `license`     | string   | شناسه لایسنس به سبک SPDX                |
| `downloadUrl` | string   | URL دانلود منبع (ممکن است خالی باشد)   |
| `repository`  | string?  | URL اختیاری repository              |
| `tags`        | string[] | تگ‌های جستجو/فیلتر                   |
| `downloads`   | number   | تعداد دانلود                       |
| `rating`      | number   | ۰–۵                                  |
| `verified`    | boolean  | آیا ورودی به‌عنوان تأیید‌شده علامت‌گذاری شده است |
| `lastUpdated` | string   | رشته تاریخ به سبک ISO                  |

وقتی هیچ URL رجیستری سفارشی پیکربندی نشده باشد، کاتالوگ
`SEED_REGISTRY` داخلی است (در حال حاضر `request-logger`, `rate-limiter`, `cost-tracker` و
`theme-manager`). رجیستری seed همیشه در دسترس است — اگر یک رجیستری راه‌دور
پیکربندی‌شده غیرقابل دسترسی باشد، یک وضعیت غیر از `200` برگرداند یا یک بدنه
شناسایی‌نشده برگرداند، `listMarketplacePlugins()` یک هشدار ثبت کرده و به فهرست seed برمی‌گردد.

> نکته: **کاتالوگ** فروشگاه (مرور/جستجو) به‌صورت کامل متصل شده است، اما
> نصب یک‌کلیکی فروشگاه از کاتالوگ هنوز پیاده‌سازی نشده است —
> دکمه "Install" داشبورد روی یک ورودی فروشگاه در حال حاضر یک
> اعلان "coming soon" نشان می‌دهد. نصب امروز از طریق گردش‌کار نصب
> مسیر محلی (`POST /api/plugins`) و کشف روی‌دیسک (`POST /api/plugins/scan`) انجام می‌شود.

## REST API

تمام endpointها نیازمند auth مدیریت (`requireManagementAuth`) **و**
فقط loopback هستند — `/api/plugins` و `/api/plugins/` در
`LOCAL_ONLY_API_PREFIXES` (`src/server/authz/routeGuard.ts`) فهرست شده‌اند.

| Endpoint                         | روش | توضیحات                                         |
| -------------------------------- | ------ | --------------------------------------------------- |
| `/api/plugins`                   | GET    | فهرست پلاگین‌های نصب‌شده (فیلتر اختیاری `?status=`) |
| `/api/plugins`                   | POST   | نصب یک پلاگین از یک مسیر محلی مطلق        |
| `/api/plugins/scan`              | POST   | اسکن دایرکتوری پلاگین و ثبت پلاگین‌های جدید  |
| `/api/plugins/marketplace`       | GET    | فهرست ورودی‌های کاتالوگ فروشگاه                    |
| `/api/plugins/[name]`            | GET    | دریافت جزئیات پلاگین نصب‌شده                        |
| `/api/plugins/[name]`            | DELETE | حذف نصب یک پلاگین                                  |
| `/api/plugins/[name]/activate`   | POST   | فعال‌سازی (load + ثبت hookها)                    |
| `/api/plugins/[name]/deactivate` | POST   | غیرفعال‌سازی (اجرای `onDeactivate`، لغو ثبت hookها)  |
| `/api/plugins/[name]/config`     | GET    | دریافت پیکربندی پلاگین + schema پیکربندی                   |
| `/api/plugins/[name]/config`     | PUT    | به‌روزرسانی پیکربندی پلاگین (اعتبارسنجی در برابر schema)     |

فیلتر `status` در `GET /api/plugins` یکی از
`installed` / `active` / `inactive` / `error` را می‌پذیرد. یک مقدار نامعتبر `400` برمی‌گرداند.

### فهرست پلاگین‌های نصب‌شده

```bash
curl http://localhost:20128/api/plugins \
  -H "Cookie: auth_token=..."
```

### نصب از یک مسیر محلی

```bash
curl -X POST http://localhost:20128/api/plugins \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{ "path": "/absolute/path/to/my-plugin" }'
```

`path` باید **مطلق** باشد و نباید شامل بخش‌های پیمایش `..` یا
بایت‌های null باشد (توسط Zod اعمال می‌شود). دایرکتوری منبع باید دارای یک
`plugin.json` معتبر (یا والد یکی از آن‌ها) باشد. در صورت موفقیت، پاسخ `201` همراه با
ردیف پلاگین نصب‌شده است.

### مرور فروشگاه

```bash
curl http://localhost:20128/api/plugins/marketplace \
  -H "Cookie: auth_token=..."
```

### به‌روزرسانی پیکربندی پلاگین

```bash
curl -X PUT http://localhost:20128/api/plugins/my-plugin/config \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{ "config": { "level": "debug", "maxItems": 100 } }'
```

`PUT .../config` هر مقدار ارائه‌شده را در برابر
`configSchema` پلاگین (در manifest اعلام شده) اعتبارسنجی می‌کند: فیلدهای `number` از `min`/`max`
پیروی می‌کنند، فیلدهای `select` باید با `enum` اعلام‌شده مطابقت داشته باشند. کلیدهایی که در schema
موجود نیستند عبور داده می‌شوند.

## پیکربندی

### دایرکتوری پلاگین

پلاگین‌ها زیر دایرکتوری داده RouteChi قرار دارند:

```
~/.omniroute/plugins/<plugin-name>/
  ├─ plugin.json
  └─ index.js          # (یا هر فایلی که manifest.main به آن اشاره می‌کند)
```

`getDefaultPluginDir()` (`src/lib/plugins/scanner.ts`) این را به
`<home>/.omniroute/plugins` حل می‌کند، که در آن `<home>` از متغیرهای محیطی `HOME` /
`USERPROFILE` گرفته می‌شود. `POST /api/plugins/scan` هر
زیردایرکتوری در آنجا که دارای یک `plugin.json` معتبر باشد را کشف کرده و ثبت می‌کند.

### URL رجیستری سفارشی فروشگاه

منبع کاتالوگ فروشگاه از تنظیم `pluginMarketplaceUrl` خوانده می‌شود
(`src/lib/plugins/marketplace.ts` از `settings.pluginMarketplaceUrl` می‌خواند). هنگامی که
به یک URL `http(s)` تنظیم شده باشد، `listMarketplacePlugins()` آن URL را fetch کرده و یا
یک آرایه JSON سطح‌بالا از ورودی‌ها یا یک شیء با یک آرایه `plugins` را می‌پذیرد؛
ورودی‌های بدون `name` به‌صورت رشته فیلتر می‌شوند. وقتی تنظیم نشده باشد (یا وقتی fetch
محافظ SSRF را رد می‌کند / یک پاسخ بد برمی‌گرداند)، رجیستری seed داخلی
استفاده می‌شود.

تب "Marketplace" داشبورد یک فیلد برای این URL نمایش می‌دهد (از
`GET /api/settings` بازخوانی می‌شود).

> نکته پیاده‌سازی: اقدام "Save" داشبورد،
> `pluginMarketplaceUrl` را به `PATCH /api/settings` ارسال می‌کند. در زمان نگارش این
> کلید در `updateSettingsSchema`
> (`src/shared/validation/settingsSchemas.ts`) اعلام نشده است، بنابراین ماندگاری را در
> انتشار خود قبل از تکیه بر آن تأیید کنید — مسیر **خواندن** (`getSettings()` →
> `listMarketplacePlugins()`) به محض اینکه کلید در فروشگاه
> تنظیمات موجود باشد از آن پیروی می‌کند.

## امنیت

### لایه مسیر — فقط loopback

پلاگین‌ها کد را در فرآیندهای فرزند اجرا می‌شوند، بنابراین کل سطح `/api/plugins`
به‌صورت `LOCAL_ONLY` (Tier 1) طبقه‌بندی می‌شود. اعمال loopback **قبل از**
هرگونه بررسی auth به‌صورت بدون قید و شرط اجرا می‌شود، بنابراین یک توکن مدیریت نشت‌کرده که
از طریق یک تونل به ماشین می‌رسد همچنان نمی‌تواند یک پلاگین را نصب، activate یا uninstall کند.
به [`docs/security/ROUTE_GUARD_TIERS.md`](../security/ROUTE_GUARD_TIERS.md) و
قوانین سخت #۱۵ / #۱۷ مراجعه کنید.

### محافظ SSRF رجیستری فروشگاه

یک URL رجیستری سفارشی یک پیکربندی قابل تأثیرگذاری توسط مهاجم است، بنابراین قبل از
fetch کردن آن `listMarketplacePlugins()` آن را از طریق دو لایه عبور می‌دهد:

۱. **`isSafeMarketplaceUrl(url)`** (`src/lib/plugins/marketplace.ts`):
   - هر چیزی که `http:` / `https:` نباشد را رد می‌کند.
   - hostهای private/loopback/link-local/ULA تحت‌اللفظی (IPv4 **و** IPv6،
     شامل IPv4-mapped) را از طریق `isPrivateHost` کانونیکال
     (`src/shared/network/outboundUrlGuard.ts`) رد می‌کند.
   - **هم** رکوردهای `A` و **هم** `AAAA` را resolve می‌کند و اگر **هر**
     آدرس resolve‌شده private باشد رد می‌کند — بسته‌بندی public-hostname → private-IP را می‌بندد.
   - **با بسته بودن fail می‌شود**: یک شکست resolve DNS، URL را رد می‌کند.
۲. **`safeOutboundFetch(url, { guard: "public-only", timeoutMs: 5000 })`**
   (`src/shared/network/safeOutboundFetch.ts`): محافظ URL public-only را در زمان fetch
   دوباره اعمال می‌کند و **redirectها را مسدود می‌کند** (بدون pivot `30x` از public به private).

یک URL که در هر دو لایه شکست بخورد درخواست را لغو نمی‌کند — فروشگاه
به‌صورت بی‌صدا به رجیستری seed داخلی برمی‌گردد و یک هشدار ثبت می‌کند.

> این محافظ در PR #3774 مخصوصاً برای resolve کردن A + AAAA و استفاده
> از `isPrivateHost` کانونیکال به جای یک بررسی فقط IPv4 سخت‌شده شد.

### انزوای اجرای پلاگین

- **انزوای فرآیند** — `loadPlugin()` (`src/lib/plugins/loader.ts`) هر
  پلاگین را در یک فرآیند فرزند Node.js مجزا اجرا کرده و از طریق IPC ارتباط برقرار می‌کند.
  فراخوانی‌های hook یک مهلت زمانی با تشدید `SIGTERM` → `SIGKILL` دارند.
- **allowlist محیطی** — فرزند تنها یک مجموعه allowlist‌شده از متغیرهای محیطی
  را دریافت می‌کند؛ مجموعه گسترده‌تر تنها زمانی اعطا می‌شود که manifest درخواست
  مجوز `env` کند.
- **مهار مسیر** — install/upgrade/uninstall اطمینان می‌دهند که دایرکتوری پلاگین
  و `manifest.main` **درون** ریشه پلاگین مدیریت‌شده resolve می‌شوند
  قبل از هرگونه کپی یا حذف بازگشتی (محافظت در برابر مسیرهای DB دستکاری‌شده و
  پیمایش `../` در `manifest.main`). فعال‌سازی symlinkها را از طریق
  `realpath` resolve می‌کند و از load یک نقطه ورودی که از دایرکتوری پلاگین
  فرار می‌کند امتناع می‌ورزد.
- **پین یکپارچگی اختیاری** — یک manifest ممکن است یک فیلد `integrity`
  (`sha256-<base64>`, فرمت SRI) اعلام کند. وقتی موجود باشد، loader هش فایل
  ورودی را در زمان load تأیید کرده و در صورت عدم تطابق از فعال‌سازی امتناع می‌ورزد. این
  یک تشخیص دستکاری opt-in است، **نه** یک مرز امنیتی — مسیریابی فقط loopback
  و مدل مجوز مرزهای واقعی هستند.

## Manifest (`plugin.json`)

توسط `PluginManifestSchema` (`src/lib/plugins/manifest.ts`) اعتبارسنجی می‌شود:

| فیلد              | نوع      | یادداشت‌ها                                                       |
| ------------------ | --------- | ----------------------------------------------------------- |
| `name`             | string    | مورد نیاز؛ kebab-case (`^[a-z0-9-]+$`)، ۱-۱۰۰ کاراکتر          |
| `version`          | string    | مورد نیاز؛ semver (`MAJOR.MINOR.PATCH`)                      |
| `description`      | string?   | ≤ ۵۰۰ کاراکتر                                                 |
| `author`           | string?   | ≤ ۲۰۰ کاراکتر                                                 |
| `license`          | string?   | پیش‌فرض `MIT`                                           |
| `main`             | string?   | فایل ورودی؛ پیش‌فرض `index.js`                          |
| `source`           | enum?     | `local` \| `marketplace` (پیش‌فرض `local`)              |
| `tags`             | string[]? | تگ‌های جستجو                                                 |
| `requires`         | object?   | `{ omniroute?, permissions[] }`                             |
| `hooks`            | object?   | booleanهایی که اعلام می‌کنند پلاگین کدام hookها را پیاده‌سازی می‌کند        |
| `skills`           | object[]? | تعاریف مهارت اختیاری                                  |
| `enabledByDefault` | boolean?  | فعال‌سازی خودکار هنگام نصب                                    |
| `configSchema`     | object?   | نگاشت فیلدهای پیکربندی (`string`/`number`/`boolean`/`select`) |
| `integrity`        | string?   | پین اختیاری `sha256-<base64>` برای فایل ورودی                   |

مجوزها از enum
`network` / `file-read` / `file-write` / `env` / `exec` گرفته می‌شوند.

## گردش‌کار چرخه حیات

```
install (POST /api/plugins, path)
  → scan/validate manifest → copy to staging → assert main within dir
  → atomic rename into ~/.omniroute/plugins/<name> → insert DB row
  → fire onInstall → if enabledByDefault: activate

activate (POST /api/plugins/{name}/activate)
  → realpath containment check → loadPlugin() (spawn child process)
  → register declared hooks → status = "active" → fire onActivate

deactivate (POST /api/plugins/{name}/deactivate)
  → fire onDeactivate (BEFORE unregister) → unregister hooks
  → kill child process → status = "inactive"

uninstall (DELETE /api/plugins/{name})
  → deactivate if active → fire onUninstall
  → containment-checked recursive delete of plugin dir → delete DB row
```

اجرای مجدد `install` در برابر یک دایرکتوری که نسخه manifest آن **به‌طور اکید
جدیدتر** از نسخه نصب‌شده است، یک ارتقای خودکار انجام می‌دهد (نصب مجدد تمیز؛ پیکربندی به
پیش‌فرض‌ها بازنشانی می‌شود). یک نسخه مشابه یا قدیمی‌تر رد می‌شود.

## پایگاه داده

جدول `plugins` (migration `076_create_plugins.sql`):

| ستون          | نوع    | یادداشت‌ها                                            |
| --------------- | ------- | ------------------------------------------------ |
| `id`            | TEXT PK | UUID                                             |
| `name`          | TEXT    | یکتا                                           |
| `version`       | TEXT    | semver; پیش‌فرض `1.0.0`                          |
| `description`   | TEXT    | اختیاری                                         |
| `author`        | TEXT    | اختیاری                                         |
| `license`       | TEXT    | پیش‌فرض `MIT`                                    |
| `main`          | TEXT    | فایل ورودی؛ پیش‌فرض `index.js`                   |
| `source`        | TEXT    | پیش‌فرض `local`                                  |
| `tags`          | TEXT    | آرایه JSON; پیش‌فرض `[]`                         |
| `status`        | TEXT    | `installed` \| `active` \| `inactive` \| `error` |
| `enabled`       | INT     | ۰/۱; پیش‌فرض ۰                                   |
| `manifest`      | TEXT    | JSON کامل manifest                               |
| `config`        | TEXT    | JSON; پیش‌فرض `{}`                               |
| `config_schema` | TEXT    | JSON; پیش‌فرض `{}`                               |
| `hooks`         | TEXT    | آرایه JSON از نام‌های hook اعلام‌شده; پیش‌فرض `[]`  |
| `permissions`   | TEXT    | آرایه JSON; پیش‌فرض `[]`                         |
| `plugin_dir`    | TEXT    | دایرکتوری نصب مطلق                       |
| `error_message` | TEXT    | تنظیم‌شده وقتی `status = "error"`                      |
| `installed_at`  | TEXT    | `datetime('now')`                                |
| `updated_at`    | TEXT    | `datetime('now')`                                |
| `activated_at`  | TEXT    | تنظیم‌شده هنگام فعال‌سازی                                |

متریک‌ها/تحلیل‌های پلاگین در جداول اضافی
(`090_plugin_metrics.sql`, `091_plugin_analytics.sql`) ردیابی می‌شوند.

## داشبورد

صفحه داشبورد در `/dashboard/plugins`
(`src/app/(dashboard)/dashboard/plugins/page.tsx`) دو تب ارائه می‌کند:

- **نصب‌شده** — پلاگین‌های نصب‌شده را با hookهای اعلام‌شده آنها، یک
  toggle فعال/غیرفعال، یک دکمه uninstall و یک اقدام "Scan for plugins"
  (`POST /api/plugins/scan`) فهرست می‌کند.
- **فروشگاه** — کاتالوگ را از `GET /api/plugins/marketplace` با یک
  فیلد برای تنظیم URL رجیستری سفارشی نشان می‌دهد.

یک صفحه پیکربندی به ازای پلاگین در `/dashboard/plugins/[name]/config`
(`src/app/(dashboard)/dashboard/plugins/[name]/config/page.tsx`) قرار دارد.

## همچنین ببینید

- [`docs/security/ROUTE_GUARD_TIERS.md`](../security/ROUTE_GUARD_TIERS.md) —
  چرا `/api/plugins` فقط loopback است (Tier 1)
- [`docs/frameworks/SKILLS.md`](./SKILLS.md) — چارچوب مهارت‌های مرتبط
  (`src/lib/skills/`)؛ پلاگین‌ها ممکن است در manifest خود مهارت اعلام کنند
- [`docs/frameworks/WEBHOOKS.md`](./WEBHOOKS.md) — یکپارچه‌سازی‌های
  خروجی مبتنی بر رویداد
- [`docs/security/ERROR_SANITIZATION.md`](../security/ERROR_SANITIZATION.md) —
  الگوی `buildErrorBody()` که هر مسیر پلاگین برای پاسخ‌های خطا استفاده می‌کند
