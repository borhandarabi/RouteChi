---
title: "Compliance & Audit"
version: 3.8.40
lastUpdated: 2026-06-28
---

# انطباق و ممیزی

> **منبع حقیقت:** `src/lib/compliance/`, `src/app/api/compliance/`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40

RouteChi کنش‌های مدیریتی، رویدادهای احراز هویت، تغییرات چرخه عمر اعتبار
ارائه‌دهنده و فراخوانی‌های ابزار MCP را در جداول ممیزی مبتنی بر SQLite ثبت
می‌کند. این صفحه موارد زیر را پوشش می‌دهد: چه چیزی لاگ می‌شود، کجا قرار
می‌گیرد، چقدر نگه داشته می‌شود، چگونه کلیدهای API می‌توانند انصراف دهند و
چگونه داده‌ها را پرس‌وجو کنید.

پیاده‌سازی در `src/lib/compliance/index.ts` (T-43 — «کنترل‌های انطباق»)
و `src/lib/compliance/providerAudit.ts` قرار دارد. نوشتن ممیزی هرگز استثنا پرتاب
نمی‌کند: در صورت هر شکست، فراخوانی به‌صورت خاموش نادیده گرفته می‌شود تا
ثبت ممیزی نتواند جریان اصلی درخواست را بشکند.

## چه چیزی لاگ می‌شود

### رویدادهای ممیزی مدیریتی (`audit_log`)

هر فراخوانی `logAuditEvent({ action, actor, target, details, ... })` یک ردیف
تولید می‌کند. رشته‌های اکشن از الگوی `domain.verb` (یا `domain.verb.outcome`)
پیروی می‌کنند. انواع اکشن تأیید‌شده در درخت شامل موارد زیر است:

| اکشن                                | منبع                                  |
| ----------------------------------- | ------------------------------------- |
| `auth.login.success`                | `src/app/api/auth/login/route.ts`     |
| `auth.login.failed`                 | `src/app/api/auth/login/route.ts`     |
| `auth.login.locked`                 | `src/app/api/auth/login/route.ts`     |
| `auth.login.error`                  | `src/app/api/auth/login/route.ts`     |
| `auth.login.misconfigured`          | `src/app/api/auth/login/route.ts`     |
| `auth.login.setup_required`         | `src/app/api/auth/login/route.ts`     |
| `auth.logout.success`               | `src/app/api/auth/logout/route.ts`    |
| `provider.credentials.created`      | `src/app/api/providers/route.ts`      |
| `provider.credentials.updated`      | `src/app/api/providers/[id]/route.ts` |
| `provider.credentials.revoked`      | `src/app/api/providers/[id]/route.ts` |
| `provider.credentials.batch_revoked`| `src/app/api/providers/route.ts`      |
| `sync.token.created`                | `src/app/api/sync/tokens/route.ts`    |
| `sync.token.revoked`                | `src/app/api/sync/tokens/[id]/route.ts` |
| `compliance.cleanup`                | `src/lib/compliance/index.ts`         |

هر مدخل شامل `action`, `actor` (پیش‌فرض `"system"`), `target`,
`details`/`metadata` (JSON), `ip_address`, `resource_type`, `status`,
`request_id` و `timestamp` است. کلیدهای حساس (`apiKey`, `accessToken`,
`refreshToken`, `password`، و هر چه با `*token`/`*secret`/`*apikey` تطابق
داشته باشد و غیره) به‌صورت بازگشتی پیش از نوشته‌شدن ردیف به `"[redacted]"`
تغییر می‌یابند.

### فراخوانی‌های ابزار MCP (`mcp_tool_audit`)

هر فراخوانی ابزار MCP یک ردیف از طریق
`open-sse/mcp-server/audit.ts` می‌نویسد. شِما (از
`src/lib/db/migrations/002_mcp_a2a_tables.sql`):

| ستون            | یادداشت                                   |
| --------------- | ----------------------------------------- |
| `id`            | خودافزایشنده                              |
| `tool_name`     | شناسه ابزار MCP                            |
| `input_hash`    | sha256 ورودی (بدون ذخیره payload)         |
| `output_summary`| خلاصه کوتاه و بریده‌شده                    |
| `duration_ms`   | زمان واقعی                                |
| `api_key_id`    | فراخواننده (nullable)                     |
| `success`       | `1` / `0`                                 |
| `error_code`    | کد خطای پایانى هنگام شکست                 |
| `created_at`    | مهر زمانی ISO                              |

### لاگ‌های درخواست / استفاده

این‌ها تلمتری عملیاتی هستند (نه دقیقاً ممیزی مدیریتی) اما از همان
خط لوله نگه‌داری استفاده می‌کنند:

- `usage_history` — خلاصه استفاده به‌ازای هر درخواست
- `call_logs` — لاگ کامل به‌ازای هر درخواست (مشمول سقف ردیف، در ادامه ببینید)
- `proxy_logs` — لاگ ترافیک پراکسی (مشمول سقف ردیف)
- `request_detail_logs` — لاگ قدیمی جزئیات درخواست (اگر وجود داشته باشد همچنان هرس می‌شود)

## شِمای ذخیره‌سازی

`audit_log` به‌صورت تنبل توسط `ensureAuditLogSchema()` هنگام اولین استفاده ساخته می‌شود:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
  action        TEXT NOT NULL,
  actor         TEXT NOT NULL DEFAULT 'system',
  target        TEXT,
  details       TEXT,
  ip_address    TEXT,
  resource_type TEXT,
  status        TEXT,
  request_id    TEXT,
  metadata      TEXT
);
```

ایندکس‌ها روی `timestamp`, `action`, `actor`, `resource_type`,
`status` و `request_id` ساخته می‌شوند. ستون‌های مفقود در پایگاه‌داده‌های قدیمی
به‌صورت درخواستی با `ALTER TABLE` افزوده می‌شوند.

## نگه‌داری و پاکسازی

دو پنجره مجزای نگه‌داری رعایت می‌شود:

| متغیر محیطی                 | پیش‌فرض  | اعمال‌شده بر                                                       |
| ---------------------------- | -------- | ----------------------------------------------------------------- |
| `APP_LOG_RETENTION_DAYS`     | `7`      | `audit_log`, `mcp_tool_audit`                                     |
| `CALL_LOG_RETENTION_DAYS`    | `7`      | `usage_history`, `call_logs`, `proxy_logs`, `request_detail_logs` |
| `CALL_LOGS_TABLE_MAX_ROWS`   | `100000` | هرس با سقف ردیف برای `call_logs`                                  |
| `PROXY_LOGS_TABLE_MAX_ROWS`  | `100000` | هرس با سقف ردیف برای `proxy_logs`                                 |

`cleanupExpiredLogs()` اجرای نگه‌داری را انجام می‌دهد. این تابع هنگام راه‌اندازی
سرور از `src/server-init.ts` و `src/instrumentation-node.ts` فراخوانی می‌شود.
هر اجرا یک رویداد ممیزی `compliance.cleanup` با شمارش حذف به‌ازای هر جدول لاگ
می‌کند. هرس لاگ پراکسی/فراخوانی دسته‌ای (`BATCH_SIZE = 5000`) انجام می‌شود تا
از قفل‌های نوشتاری طولانی جلوگیری شود.

پاکسازی دستی تاریخچه درخواست مستقل از نگه‌داری است. صفحه Request Logs
به `POST /api/settings/purge-request-history` فراخوانی می‌کند که `call_logs`،
`request_detail_logs` قدیمی و آرتیفکت‌های محلی درخواست تحت
`${DATA_DIR}/call_logs/` را حذف می‌کند.

پیش‌فرض‌ها در `src/lib/logEnv.ts` تعریف شده‌اند
(`DEFAULT_APP_LOG_RETENTION_DAYS = 7`, `DEFAULT_CALL_LOG_RETENTION_DAYS = 7`).

## انصراف `noLog` (به ازای هر کلید API)

کلیدهای API می‌توانند به‌گونه‌ای پرچم‌گذاری شوند که ترافیک فراخوانی پایین‌دست
آن‌ها لاگ نشود. این پرچم روی جدول `api_keys` قرار دارد (`no_log INTEGER DEFAULT 0`)
و در یک مجموعه درون‌حافظه‌ای برای جستجوهای مسیر داغ آینه می‌شود.

```bash
# Create a no-log key (management auth required)
curl -X POST http://localhost:20128/api/keys \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Privacy key", "noLog": true}'
```

کمک‌کننده‌ها (`src/lib/compliance/index.ts`):

- `setNoLog(apiKeyId, true|false)` — تغییر وضعیت مدخل درون‌حافظه‌ای
- `isNoLog(apiKeyId)` — در مسیر درخواست بررسی می‌شود؛ در صورت نبودن به خواندن
  بافر ۳۰ ثانیه‌ای از `api_keys.no_log` برمی‌گردد
- `NO_LOG_API_KEY_IDS` (env، با کاما جدا شده) — هنگام بوت در مجموعه درون‌حافظه‌ای
  پیش‌بارگذاری می‌شود؛ وقتی نمی‌توانید مستقیماً ستون را تغییر دهید مفید است

رویدادهای ممیزی مدیریتی (ورود، تغییرات ارائه‌دهنده، فراخوانی‌های ابزار MCP و غیره)
توسط `noLog` تحت تأثیر قرار ** نمی‌گیرند** — تنها لاگ‌گذاری ترافیک به‌ازای هر
درخواست انصراف می‌یابد.

## REST API

| اندپوینت                    | متد   | توضیح                                   | احراز هویت |
| --------------------------- | ----- | --------------------------------------- | ---------- |
| `/api/compliance/audit-log` | `GET` | مدخل‌های ممیزی مدیریتی صفحه‌بندی‌شده با فیلترها | مدیریت     |
| `/api/mcp/audit`            | `GET` | مدخل‌های ممیزی ابزار MCP صفحه‌بندی‌شده    | (open-sse) |
| `/api/mcp/audit/stats`      | `GET` | آمار تجمیعی ممیزی MCP                    | (open-sse) |

امروزه هیچ اندپوینت خروجی CSV ارسال نمی‌شود — از داشبورد خروجی بگیرید یا
مستقیماً پایگاه‌داده SQLite را پرس‌وجو کنید.

### پرس‌وجوی `/api/compliance/audit-log`

پارامترهای پرس‌وجوی پشتیبانی‌شده (همه اختیاری، همگی برای فیلترهای متنی از
تطابق `LIKE %value%` استفاده می‌کنند):

- `action`, `actor`, `target`, `resourceType` (یا `resource_type`),
  `status`, `requestId` (یا `request_id`)
- `from` / `since`, `to` / `until` — مهرهای زمانی ISO
- `limit` (پیش‌فرض `50`, حداقل `1`, حداکثر `500`)
- `offset` (پیش‌فرض `0`, حداکثر `10_000`)

پاسخ یک آرایه JSON است. متادیتای صفحه‌بندی در هدرها بازگردانده می‌شود:
`x-total-count`, `x-page-limit`, `x-page-offset`.

```bash
curl "http://localhost:20128/api/compliance/audit-log?action=provider.credentials&from=2026-05-01" \
  -H "Cookie: auth_token=..."
```

## داشبورد

داشبورد داده‌های ممیزی را در **`/dashboard/audit`**
(`src/app/(dashboard)/dashboard/audit/page.tsx`) نمایش می‌دهد. این صفحه دو تب دارد:

- **انطباق** (`ComplianceTab.tsx`) — رویدادهای ممیزی مدیریتی از
  `/api/compliance/audit-log`. فیلتر بر اساس نوع رویداد، شدت (info / warning
  / critical، مشتق‌شده از اکشن + وضعیت) و بازه تاریخ. شدت به‌صورت سمت کلاینت
  از رشته‌های اکشن/وضعیت محاسبه می‌شود.
- **MCP** (`McpAuditTab.tsx`) — ممیزی ابزار MCP از `/api/mcp/audit`، با
  فیلتر بر اساس نام ابزار و موفقیت/شکست.

هر دو تب با اندازه صفحه `50` (انطباق) و `25` (MCP) صفحه‌بندی می‌شوند.

## کمک‌کننده‌های اعتبار ارائه‌دهنده

`src/lib/compliance/providerAudit.ts` کمک‌کننده‌های شکل‌دهی ارائه می‌کند که
مسیرهای مدیریت ارائه‌دهنده هنگام انتشار رویدادهای اعتبار از آن‌ها استفاده می‌کنند:

- `summarizeProviderConnectionForAudit(connection)` — `apiKey`,
  `accessToken`, `refreshToken`, `idToken` و
  `providerSpecificData.consoleApiKey` را پیش از نوشته‌شدن عکس فوری اتصال در
  `details` حذف می‌کند.
- `getProviderAuditTarget(connection)` — یک رشته پایدار
  `"<provider>:<name|id>"` برای فیلد `target` می‌سازد.
- `extractProviderWarnings(...payloads)` — پاسخ‌های ارائه‌دهنده را برای
  هشدارهای سیاست/ایمنی (`[sanitizer]`, `prompt injection detected`,
  `content has been filtered`, `safety filter`, `policy violation`) اسکن می‌کند
  و نهایتاً ۵ مورد را نمایش می‌دهد، هر کدام بریده‌شده به ۴۰۰ نویسه.

## بهترین رویه‌ها

- به کلیدهای API که با PII سروکار دارند (حقوقی، پزشکی و غیره) پرچم `noLog: true` بزنید.
- `APP_LOG_RETENTION_DAYS` / `CALL_LOG_RETENTION_DAYS` را برای برآورده‌کردن
  سیاست نگه‌داری خود تنظیم کنید. پیش‌فرض‌های ۷ روزه محافظه‌کارانه هستند.
- جدول ممیزی را با هر دوره‌ای که برنامه انطباق شما نیاز دارد، خارج از پلتفرم
  خروجی بگیرید (`sqlite3 dump`) — هیچ بایگانی داخلی وجود ندارد.
- شمارش `auth.login.failed` و `auth.login.locked` را برای شناسایی brute-force
  پیگیری کنید.
- هنگام افزودن اندپوینت‌های مدیریتی جدید، `logAuditEvent({ ... })` را با یک رشته
  اکشن پایدار `domain.verb.outcome` فراخوانی کنید و زمینه درخواست را از طریق
  `getAuditRequestContext(request)` ارسال کنید تا IP و `requestId` به‌طور خودکار
  ضبط شوند.

## همچنین ببینید

- [`docs/security/GUARDRAILS.md`](./GUARDRAILS.md) — ماسک کردن PII، تزریق پرامپت
- [`docs/frameworks/MCP-SERVER.md`](../frameworks/MCP-SERVER.md) — فهرست و scopeهای ابزار MCP
- [`docs/reference/ENVIRONMENT.md`](../reference/ENVIRONMENT.md) — مرجع کامل متغیرهای محیطی
- منبع: `src/lib/compliance/`, `src/app/api/compliance/`,
  `src/app/api/mcp/audit/`, `src/lib/logEnv.ts`
