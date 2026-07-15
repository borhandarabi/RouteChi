---
title: "منبع بافتار Obsidian"
version: 3.8.40
lastUpdated: 2026-06-28
---

# منبع بافتار Obsidian

> **منبع حقیقت:** `src/lib/obsidian/api.ts` (کلاینت REST + sync)،
> `src/lib/db/obsidian.ts` (ماندگاری توکن / base-URL / WebDAV)،
> `src/lib/obsidianSync.ts` (همگام‌سازی vault با WebDAV)، `open-sse/mcp-server/tools/obsidianTools.ts`
> (۲۲ ابزار MCP)، `src/app/api/settings/obsidian/route.ts` +
> `src/app/api/settings/obsidian/webdav/route.ts` (APIهای تنظیمات). ثبت ابزار
> و اتصال scope در `open-sse/mcp-server/server.ts` قرار دارد.

## این چیست

RouteChi به یک vault مربوط به **Obsidian** به‌عنوان یک **منبع بافتار** متصل می‌شود — یک
پایگاه دانش Markdown محلی که عوامل از طریق MCP server داخلی آن را می‌خوانند و می‌نویسند. این
یکپارچه‌سازی با پلاگین کامینیتی **Obsidian Local REST API** که داخل اپ دسکتاپ در حال اجراست صحبت می‌کند،
تا عوامل بتوانند یادداشت‌ها را جستجو کنند، فایل‌ها را بخوانند/بنویسند/patch کنند، vault را فهرست کنند، با
یادداشت‌های دوره‌ای روزانه/هفتگی کار کنند، تگ‌ها را مدیریت کنند، دستورات Obsidian را اجرا کنند و (به‌صورت اختیاری)
یک همگام‌سازی دوطرفه vault بین دسکتاپ و موبایل را هماهنگ کنند.

کلاینت (`src/lib/obsidian/api.ts`) Local REST API را با موارد زیر پوشش می‌دهد:

- **Retry با backoff** برای `5xx` گذرا، **مهلت ۳۰ ثانیه‌ای** از طریق `AbortController`.
- **دسته‌بندی خطای تایپ‌شده** — `ObsidianAuthError` (401/403)،
  `ObsidianNotFoundError` (404)، `ObsidianServerError` (5xx)، `ObsidianTimeoutError`.
- یک **راهنمای دوستانه «امکان دسترسی به Obsidian وجود ندارد»** که اشتباه رایج پورت را یادآوری می‌کند
  (HTTP روی `27123`، **نه** endpoint مربوط به MCP روی `27124`) و فرم Tailscale را.
- **رمزگذاری مسیر** نسبی به vault تا مسیرهای یادداشت با فاصله/اسلش امن باشند.

## راه‌اندازی

**هیچ متغیر محیطی** برای توکن Obsidian یا base URL وجود ندارد — هر دو در جدول SQLite
`key_value` (namespace مربوط به `obsidian`) از طریق `src/lib/db/obsidian.ts` ذخیره می‌شوند. توکن
**در حالت ساکن رمزگذاری می‌شود** (AES-256-GCM، با fallback سازگار با نسخه plaintext). از تب **Context Sources**
داشبورد Endpoint (`ObsidianSourceCard`) یا از طریق API تنظیمات REST پیکربندی کنید.

> [!IMPORTANT]
> پلاگین **Obsidian Local REST API** باید نصب و در حال اجرا باشد. رابط REST
> آن روی **HTTP `127.0.0.1:27123`** گوش می‌دهد (base URL پیش‌فرض). پورت `27124`
> یک endpoint _مجزای_ MCP/HTTPS است و به‌صراحت توسط مسیر تنظیمات رد می‌شود.
> اگر از دستگاه دیگری متصل می‌شوید، از `http://<tailscale-ip>:27123` استفاده کنید.

### کلیدهای پیکربندی (SQLite `key_value`، namespace مربوط به `obsidian`)

| کلید              | هدف                                          | رمزگذاری‌شده |
| ----------------- | ------------------------------------------------ | --------- |
| `api_key`         | Bearer token مربوط به Local REST API                      | بله       |
| `base_url`        | REST base URL (پیش‌فرض `http://127.0.0.1:27123`) | خیر        |
| `vault_path`      | مسیر مطلق به دایرکتوری vault (برای همگام‌سازی)  | خیر        |
| `webdav_username` | نام کاربری WebDAV تولید‌شده (همگام‌سازی vault)           | خیر        |
| `webdav_password` | رمز عبور WebDAV تولید‌شده (همگام‌سازی vault)           | بله       |
| `webdav_enabled`  | آیا همگام‌سازی vault با WebDAV فعال است             | خیر        |

### پیکربندی از طریق REST

```bash
# ذخیره + اعتبارسنجی توکن Local REST API (POST با یک بررسی وضعیت اعتبارسنجی می‌کند)
curl -X POST http://localhost:20128/api/settings/obsidian \
  -H "Content-Type: application/json" \
  -d '{"token":"<obsidian-rest-api-key>","baseUrl":"http://127.0.0.1:27123"}'

# بررسی وضعیت اتصال (connected, hasToken, baseUrl, vaultPath را برمی‌گرداند)
curl http://localhost:20128/api/settings/obsidian

# قطع اتصال (توکن ذخیره‌شده را پاک می‌کند)
curl -X DELETE http://localhost:20128/api/settings/obsidian
```

تمام روش‌ها نیازمند احراز هویت داشبورد هستند. `POST` هر URL روی پورت `27124`
را رد می‌کند و توکن را با فراخوانی endpoint وضعیت Local REST API قبل از ذخیره اعتبارسنجی می‌کند.

### همگام‌سازی vault با WebDAV

`src/app/api/settings/obsidian/webdav/route.ts` یک همگام‌سازی vault اختیاری مبتنی بر WebDAV را
مدیریت می‌کند (هدایت‌شده توسط `src/lib/obsidianSync.ts`). فعال‌کردن آن، RouteChi را به یک
دایرکتوری vault محلی اشاره می‌دهد و یک جفت نام کاربری/رمز عبور WebDAV تصادفی تولید می‌کند:

```bash
# فعال‌کردن همگام‌سازی WebDAV برای یک دایرکتوری vault (نام کاربری/رمز عبور تولید می‌کند)
curl -X POST http://localhost:20128/api/settings/obsidian/webdav \
  -H "Content-Type: application/json" \
  -d '{"vaultPath":"/home/me/MyVault"}'

# دریافت وضعیت همگام‌سازی WebDAV (اعتبارنامه‌ها فقط در صورت فعال‌بودن برگردانده می‌شوند)
curl http://localhost:20128/api/settings/obsidian/webdav

# غیرفعال‌کردن همگام‌سازی WebDAV (اعتبارنامه‌ها + .stignore مدیریت‌شده را پاک می‌کند)
curl -X DELETE http://localhost:20128/api/settings/obsidian/webdav
```

### منبع بافتار به ازای کلید API (اختیاری)

پیکربندی Obsidian می‌تواند **به ازای کلید API** تعریف شود از طریق جدول `api_key_context_sources`
(`src/lib/db/apiKeyContextSources.ts`). وقتی یک فراخوانی MCP یک شناسه کلید API احراز هویت‌شده
همراه دارد، `getObsidianConfigForApiKey()` توکن/base-URL/vault-path خود آن کلید را ترجیح می‌دهد
(`source: "api_key"`) و در غیر این صورت به پیکربندی سراسری برمی‌گردد (`source: "global"`).

## ابزارهای MCP (۲۲ مورد)

در `open-sse/mcp-server/tools/obsidianTools.ts` تعریف شده‌اند. توکن/base-URL به ازای هر
فراخوانی حل می‌شوند (ابتدا به ازای کلید API، سپس سراسری). ابزارهایی که به sync server مربوط به
RouteChi (چهار ابزار `obsidian_sync_*`) می‌رسند، علاوه بر این نیازمند توکن احراز هویت همگام‌سازی
پیکربندی‌شده در تنظیمات RouteChi هستند.

### ابزارهای خواندن (`read:obsidian`)

| ابزار                         | توضیحات                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `obsidian_check_status`      | بررسی اینکه آیا Local REST API قابل دسترسی و احراز هویت‌شده است.                     |
| `obsidian_search_simple`     | جستجوی full-text محتوای یادداشت؛ قطعات همراه با مسیرهای فایل را برمی‌گرداند.                  |
| `obsidian_search_structured` | جستجو با استفاده از یک عبارت JSON Logic (and/or/regex/فیلترهای مسیر).                    |
| `obsidian_read_note`         | خواندن یک یادداشت بر اساس مسیر نسبی به vault؛ به‌اختیار یک heading/block/frontmatter خاص. |
| `obsidian_list_vault`        | فهرست‌کردن فایل‌ها و دایرکتوری‌ها در vault (درختی از ورودی‌ها).                           |
| `obsidian_get_document_map`  | دریافت ساختار heading یادداشت به‌عنوان یک نگاشت از headingها به شماره خطوط.                |
| `obsidian_get_note_metadata` | دریافت frontmatter، تگ‌ها، لینک‌ها، تعداد کاراکتر/کلمه بدون محتوای کامل.              |
| `obsidian_get_active_file`   | دریافت مسیر + محتوای فایلی که در حال حاضر در Obsidian فعال است.                     |
| `obsidian_get_periodic_note` | دریافت یادداشت دوره‌ای روزانه/هفتگی/ماهانه برای یک تاریخ (اگر حذف شود، امروز).            |
| `obsidian_get_tags`          | فهرست‌کردن تمام تگ‌های vault با فرکانس‌های آنها.                                          |
| `obsidian_list_commands`     | فهرست‌کردن شناسه‌های دستورات Obsidian در دسترس (با `obsidian_execute_command` استفاده شود).           |
| `obsidian_sync_status`       | وضعیت sync server مربوط به RouteChi: در حال اجرا، نام vault، پورت، uptime، آخرین همگام‌سازی.          |
| `obsidian_sync_conflicts`    | فهرست‌کردن تعارضات همگام‌سازی حل‌نشده (مسیر، مسیر تعارض، زمان تشخیص).                   |

### ابزارهای نوشتن (`write:obsidian`)

| ابزار                             | توضیحات                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `obsidian_write_note`            | ایجاد یا بازنویسی یک یادداشت با محتوای Markdown داده‌شده.                             |
| `obsidian_append_note`           | افزودن محتوا به یک یادداشت؛ به‌اختیار به یک heading/block خاص.                   |
| `obsidian_patch_note`            | افزودن/-prepend/جایگزینی جراحی در یک heading، block یا فیلد frontmatter.        |
| `obsidian_delete_note`           | حذف دائمی یک یادداشت از vault.                                           |
| `obsidian_move_note`             | انتقال یا تغییر نام یک یادداشت در داخل vault.                                             |
| `obsidian_execute_command`       | اجرای یک دستور Obsidian با شناسه دستور آن.                                      |
| `obsidian_open_file`             | باز کردن یک فایل در Obsidian (اگر وجود نداشته باشد ایجاد می‌کند).                          |
| `obsidian_sync_trigger`          | راه‌اندازی یک همگام‌سازی فوری دوطرفه vault بین دسکتاپ و موبایل.                       |
| `obsidian_sync_resolve_conflict` | حل یک تعارض همگام‌سازی: نگه‌داشتن `local` (موبایل)، `remote` (دسکتاپ) یا `keep-both`. |

> [!NOTE]
> هدف‌های `obsidian_patch_note` یک `targetType` از `heading | block | frontmatter`
> و یک `operation` از `append | prepend | replace` را می‌پذیرند، با یک
> `createTargetIfMissing` اختیاری. چهار ابزار `obsidian_sync_*` با sync server محلی
> (`http://127.0.0.1:27781` به‌صورت پیش‌فرض) صحبت می‌کنند و نیازمند توکن همگام‌سازی هستند.

### Scopeها

ابزارهای خواندن نیازمند `read:obsidian` هستند؛ ابزارهای نوشتن نیازمند `write:obsidian`. اعمال
مشابه Notion است — توسط `withScopeEnforcement()` در
`open-sse/mcp-server/server.ts` انجام می‌شود، مشروط به `OMNIROUTE_MCP_ENFORCE_SCOPES=true`، با
scopeهای مجاز از `OMNIROUTE_MCP_SCOPES` یا زمینه scope کلید API می‌آیند. به
[MCP-SERVER.md](./MCP-SERVER.md) مراجعه کنید.

## Endpointها

| روش     | مسیر                            | هدف                                               |
| -------- | ------------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/settings/obsidian`        | بازگرداندن `{ connected, hasToken, baseUrl, vaultPath }`. |
| `POST`   | `/api/settings/obsidian`        | ذخیره + اعتبارسنجی توکن (پورت `27124` را رد می‌کند).         |
| `DELETE` | `/api/settings/obsidian`        | قطع اتصال (پاک‌کردن توکن ذخیره‌شده).                      |
| `GET`    | `/api/settings/obsidian/webdav` | وضعیت همگام‌سازی WebDAV + اعتبارنامه‌ها (در صورت فعال‌بودن).     |
| `POST`   | `/api/settings/obsidian/webdav` | فعال‌کردن همگام‌سازی WebDAV برای یک دایرکتوری vault.             |
| `DELETE` | `/api/settings/obsidian/webdav` | غیرفعال‌کردن همگام‌سازی WebDAV.                                  |

> این‌ها مسیرهای تنظیمات داشبورد هستند. خود vault از طریق
> Obsidian Local REST API (base URL پیکربندی‌شده) و از طریق ابزارهای MCP فوق قابل دسترسی است —
> هیچ endpoint پروکسی عمومی `/v1` مربوط به Obsidian وجود ندارد.

## موارد استفاده

- **پاسخ‌های مبتنی بر vault** — `obsidian_search_simple` / `obsidian_search_structured`
  سپس `obsidian_read_note` تا یک عامل از یادداشت‌های واقعی شما پاسخ دهد.
- **تألیف یادداشت / روزنامه‌نویسی** — `obsidian_write_note`، `obsidian_append_note` یا
  `obsidian_patch_note` جراحی برای ثبت خروجی عامل، خلاصه‌ها یا یادداشت‌های روزانه
  (`obsidian_get_periodic_note`) در vault.
- **ناوبری vault** — `obsidian_list_vault`، `obsidian_get_document_map` و
  `obsidian_get_tags` برای کاوش ساختار قبل از خواندن/نوشتن.
- **اتوماسیون Obsidian** — `obsidian_list_commands` + `obsidian_execute_command` برای
  هدایت پلاگین‌ها/دستورات از یک عامل؛ `obsidian_open_file` برای نمایش یک یادداشت در رابط کاربری.
- **همگام‌سازی موبایل** — فعال‌کردن همگام‌سازی WebDAV، سپس `obsidian_sync_trigger` /
  `obsidian_sync_status` / `obsidian_sync_conflicts` / `obsidian_sync_resolve_conflict`
  برای هماهنگ‌کردن دسکتاپ با موبایل و حل تعارضات.

## مرتبط

- [MCP Server](./MCP-SERVER.md) — انتقال‌ها، اعمال scope، فهرست کامل ابزار.
- [منبع بافتار Notion](./NOTION_CONTEXT.md) — منبع بافتار داخلی دیگر.
- [سیستم حافظه](./MEMORY.md) — حافظه ماندگار مکالمه (لایه بافتار
  تکمیلی، که به‌صورت خودکار تزریق می‌شود نه با fetch ابزار).
