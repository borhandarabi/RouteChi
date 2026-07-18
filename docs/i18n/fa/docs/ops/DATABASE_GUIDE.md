---
title: "راهنمای شِما و عملیات پایگاه‌داده"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای شِما و عملیات پایگاه‌داده

> **خلاصه**: RouteChi از **SQLite با WAL journaling** به‌عنوان ذخیره‌ساز اصلی خود استفاده می‌کند و برای فیلدهای حساس، رمزنگاری **AES-256-GCM** در حال ساکن (at rest) به‌کار می‌رود. این راهنما شِما، مهاجرت‌ها (migrations)، پشتیبان‌گیری/بازیابی و runbookهای عملیاتی را پوشش می‌دهد.

**منابع:**

- `src/lib/db/core.ts` — سینگلتون + SCHEMA_SQL (۱۷ جدول پایه)
- `src/lib/db/migrationRunner.ts` — مهاجرت‌های نسخه‌دار
- `src/lib/db/migrations/` — ۱۰۶ فایل SQL نسخه‌دار
- `src/lib/db/encryption.ts` — توابع کمکی رمزنگاری
- `src/lib/db/backup.ts` — خروجی/ورودی پشتیبان
- `src/lib/db/healthCheck.ts` — تشخیص‌های سلامت

---

## چرا SQLite؟

RouteChi به چند دلیل SQLite را به PostgreSQL/MySQL ترجیح داده است:

| عامل            | SQLite                              | PostgreSQL                          |
| --------------- | ----------------------------------- | ----------------------------------- |
| **استقرار**     | جاسازی‌شده — بدون سرور مجزا         | نیازمند راه‌اندازی سرور             |
| **رمزنگاری**    | در لایهٔ اپلیکیشن (AES-256-GCM)     | TDE داخلی                           |
| **عملکرد**      | برای بارهای کوچک/متوسط سریع‌تر      | برای نوشتن همزمان عالی بهتر         |
| **همزمانی**     | حالت WAL اجازهٔ خواندن همزمان می‌دهد | MVCC کامل                           |
| **پشتیبان**     | کپی تک‌فایلی                        | `pg_dump` یا snapshot فایل‌سیستم    |
| **مورد استفاده**| نصب تک‌کاربره، جاسازی‌شده            | SaaS چندمستاجره                     |

برای استقرارهای **تک‌کاربره و تک‌نمونه‌ای** (مورد استفادهٔ اصلی RouteChi)، SQLite ساده‌تر و سریع‌تر است.

### WAL Journaling

فایل `core.ts` پایگاه‌داده را در **حالت WAL (Write-Ahead Logging)** باز می‌کند:

```ts
// src/lib/db/core.ts
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 2000");
db.pragma("synchronous = NORMAL");
// Settings > System & Storage > Cache Size is applied as KiB.
db.pragma("cache_size = -16384");
```

WAL امکان **خواندن همزمان** در حین نوشتن را فراهم می‌کند — این برای داشبورد که هم‌زمان با ثبت درخواست‌ها کوئری می‌زند، مهم است.

---

## مکان پایگاه‌داده

فایل SQLite در مسیر زیر ذخیره می‌شود:

| سیستم‌عامل | مسیر                                                     |
| ---------- | -------------------------------------------------------- |
| Linux      | `~/.omniroute/storage.sqlite`                            |
| macOS      | `~/.omniroute/storage.sqlite`                            |
| Windows    | `%USERPROFILE%\.omniroute\storage.sqlite`                |
| Docker     | `/app/data/storage.sqlite` (قابل تنظیم با `DATA_DIR`)    |

فایل‌های همراه:

- `storage.sqlite-wal` — لاگ write-ahead
- `storage.sqlite-shm` — فایل حافظهٔ مشترک
- `call_logs/` — مصنوعات payload درخواست (در صورت فعال بودن)

**لغو مسیر پیش‌فرض:**

```bash
DATA_DIR=/custom/path omniroute
```

---

## معماری ماژول دامنه‌ای

پایگاه‌دادهٔ RouteChi دارای **۹۴ ماژول دامنه‌ای** در `src/lib/db/` است. هر ماژول:

- مالک یک یا چند جدول مشخص است
- توابع CRUD تایپ‌دار را صادر می‌کند
- هرگز به جداول ماژول دیگر دسترسی مستقیم ندارد
- برای دسترسی به DB از `getDbInstance()` در `core.ts` استفاده می‌کند

### ۹۴ ماژول DB

RouteChi دارای **۹۴ فایل ماژول** در `src/lib/db/` است. در ادامه نمونه‌ای از ماژول‌های اصلی آمده است؛ برای فهرست کامل به محتوای دایرکتوری مراجعه کنید:

| ماژول                  | جداول                                                            | مسئولیت                                                                |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `providers.ts`         | `provider_connections`                                           | ثبت ارائه‌دهنده با OAuth/API key و مدیریت اعتبارنامه‌ها               |
| `models.ts`            | `key_value` (دادهٔ مدل)                                          | تعاریف مدل‌ها، قابلیت‌ها، قیمت‌گذاری                                    |
| `combos.ts`            | `combos`                                                         | پیکربندی‌ها و ترتیب مسیریابی Combo                                      |
| `apiKeys.ts`           | `api_keys`                                                       | چرخهٔ حیات API key، اسکوپ‌ها، ردیابی سهمیه                              |
| `settings.ts`          | `key_value`, `api_keys`, `combos`                                | پیکربندی سیستم و KV store مشترک                                       |
| `backup.ts`            | —                                                                | عملیات خروجی/ورودی پشتیبان                                             |
| `proxies.ts`           | `proxy_registry`, `proxy_assignments`, `provider_connections`    | پیکربندی پراکسی و قوانین مسیریابی                                      |
| `prompts.ts`           | `prompt_templates`                                               | قالب‌های آمادهٔ پرامپت، نسخه‌گذاری                                     |
| `webhooks.ts`          | `webhooks`                                                       | اشتراک‌های webhook مبتنی بر رویداد و لاگ‌ها                           |
| `detailedLogs.ts`      | `request_detail_logs`                                            | لاگ ممیزی هر درخواست (اختیاری، حجم بالا)                              |
| `domainState.ts`       | `domain_*` (۵ جدول)                                              | بودجه‌های دامنه، مدارشکن‌ها، قفل‌ها، زنجیره‌های fallback، تاریخچهٔ هزینه |
| `registeredKeys.ts`    | `registered_keys`, `account_key_limits`, `provider_key_limits`   | API keyهای لیست‌سفید برای MCP/A2A                                     |
| `quotaSnapshots.ts`    | `quota_snapshots`                                                | تاریخچهٔ مصرف سهمیه                                                    |
| `modelComboMappings.ts`| `model_combo_mappings`                                           | نگاشت مدل‌ها به پیش‌فرض‌های combo                                     |
| `cliToolState.ts`      | `cli_tool_state`                                                 | وضعیت پایدار مخصوص CLI                                                |
| `encryption.ts`        | —                                                                | توابع کمکی رمزنگاری/رمزگشایی فیلدها                                   |
| `readCache.ts`         | —                                                                | کش درون‌حافظه‌ای برای عملیات پرخوانی                                  |
| `secrets.ts`           | `key_value` (ورودی‌های رمزنگاری‌شده)                              | ذخیره‌سازی رمزنگاری‌شدهٔ secretها                                     |
| `stateReset.ts`        | —                                                                | پاک‌سازی/بازنشانی وضعیت DB برای تست                                   |
| `contextHandoffs.ts`   | `context_handoffs`                                               | کانتکست نشست برای انتقال agent                                       |
| `usage*.ts`            | `usage_history`, `call_logs`, `proxy_logs`                       | ردیابی مصرف                                                            |
| `compression*.ts`      | `compression_settings`, `compression_combos`                     | پیکربندی فشرده‌سازی                                                  |

### مرزهای ماژول

یک قانون معماری کلیدی: **ماژول‌ها به جداول یکدیگر مستقیماً دسترسی ندارند**. برای کار با داده‌های ماژول دیگر، تابع را از آن ماژول import کنید.

```ts
// ❌ WRONG: direct SQL from another module
db.prepare("SELECT * FROM provider_connections").all();

// ✅ RIGHT: use the providers module function
import { listProviders } from "@/lib/db/providers";
const providers = await listProviders();
```

این قانون توسط بازبینی کد اعمال می‌شود — بررسی ایستا وجود ندارد، اما تخلف‌ها علامت‌گذاری می‌شوند.

---

## شِمای پایه (۱۷ جدول)

فایل `core.ts` این ۱۷ جدول پایه را در `SCHEMA_SQL` تعریف می‌کند. این جداول توسط مهاجرت `001_initial_schema.sql` ساخته می‌شوند و شِمای اصلی را تشکیل می‌دهند.

### جداول اصلی (در مهاجرت اولیه ساخته می‌شوند)

| جدول                      | هدف                              | ستون‌های کلیدی                                                         |
| ------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `provider_connections`    | اعتبارنامههای ارائه‌دهنده (رمزنگاری‌شده) | `id`, `provider`, `auth_type`, `api_key`, `is_active`                   |
| `provider_nodes`          | اطلاعات مسیریابی گره ارائه‌دهنده | `id`, `type`, `name`, `base_url`, `created_at`                          |
| `key_value`               | KV store عمومی                   | `namespace`, `key`, `value`                                             |
| `combos`                  | تعاریف combo مسیریابی            | `id`, `name`, `data`, `sort_order`                                      |
| `api_keys`                | API keyهای گیتوی                 | `id`, `name`, `key`, `machine_id`, `allowed_models`                     |
| `db_meta`                 | فرادادهٔ پایگاه‌داده             | `key`, `value`                                                          |
| `usage_history`           | رکوردهای مصرف درخواست            | `id`, `provider`, `model`, `tokens_input`, `tokens_output`, `timestamp` |
| `call_logs`               | payload و پاسخ درخواست‌ها        | `id`, `timestamp`, `status`, `model`, `provider`, `latency_ms`          |
| `proxy_logs`              | لاگ درخواست‌های پراکسی           | `id`, `timestamp`, `proxy_type`, `status`, `provider`                   |
| `domain_fallback_chains`  | زنجیره‌های مدل-به-ارائه‌دهنده    | `model`, `chain`                                                        |
| `domain_budgets`          | بودجه‌های هزینه هر دامنه         | `api_key_id`, `daily_limit_usd`, `warning_threshold`, `reset_interval`  |
| `domain_budget_reset_logs`| تاریخچهٔ بازنشانی بودجه          | `id`, `api_key_id`, `reset_interval`, `previous_spend`, `reset_at`      |
| `domain_cost_history`     | ردیابی هزینه هر دامنه            | `id`, `api_key_id`, `cost`, `timestamp`                                 |
| `domain_lockout_state`    | وضعیت rate-limit دامنه           | `identifier`, `attempts`, `locked_until`                                |
| `domain_circuit_breakers` | وضعیت مدارشکن هر دامنه           | `name`, `state`, `failure_count`, `last_failure_time`                   |
| `semantic_cache`          | کش پاسخ LLM                      | `id`, `signature`, `model`, `prompt_hash`, `response`                   |
| `quota_snapshots`         | snapshotهای تاریخی سهمیه         | `id`, `provider`, `connection_id`, `window_key`, `remaining_percentage` |

### جداول اضافی (توسط مهاجرت‌های بعدی اضافه شده‌اند)

مهاجرت‌های بعدی جداولی مانند زیر را اضافه می‌کنند:

- `cli_tool_state` (مهاجرت 011) — وضعیت ابزار CLI
- جداول `mcp_*` — ممیزی سرور MCP
- جداول `a2a_*` — وضعیت تسک A2A
- جداول `usage_*` — ردیابی مصرف
- جداول `plugin_*` — سیستم افزونه
- `skill_executions` — تاریخچهٔ اجرای skill
- جداول `memory_*` — سیستم حافظه
- جداول `compression_*` — سیستم فشرده‌سازی
- جداول `webhook_*` — لاگ تحویل webhook
- جداول `acp_*` — Agent Client Protocol
- جداول `oneproxy_*` — بازار 1proxy
- `proxy_assignments` — اتصال اسکوپ پراکسی
- `detailed_call_artifacts` — فرادادهٔ مصنوعات لاگ فراخوانی
- `quota_alert_history` — ممیزی هشدار سهمیه
- `command_code_auth_sessions` — نشست‌های OAuth کد Command

فهرست کامل بیش از ۳۰ جدول در `src/lib/db/migrations/` قرار دارد.

---

## مهاجرت‌ها (Migrations)

RouteChi از **مهاجرت‌های نسخه‌دار و idempotent** در `src/lib/db/migrations/` استفاده می‌کند. هر مهاجرت یک فایل SQL با نام `NNN_description.sql` است.

### نام‌گذاری مهاجرت

```
001_initial_schema.sql
002_mcp_a2a_tables.sql
003_provider_node_custom_paths.sql
...
021_combo_call_log_targets.sql
```

### نحوهٔ اجرای مهاجرت‌ها

در زمان راه‌اندازی، `migrationRunner.ts`:

1. در صورت عدم وجود، جدول `_omniroute_migrations` را می‌سازد
2. مهاجرت‌های اعمال‌شده را کوئری می‌گیرد
3. مهاجرت‌های جدید را به‌ترتیب، هرکدام در یک تراکنش اعمال می‌کند
4. هر مهاجرت اعمال‌شده را با timestamp ثبت می‌کند

```ts
// src/lib/db/migrationRunner.ts (simplified)
export async function runMigrations(db: SqliteDatabase, migrationsDir: string) {
  const applied = getAppliedMigrations(db);
  const available = readMigrationFiles(migrationsDir);

  for (const migration of available) {
    if (applied.includes(migration.id)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      recordAppliedMigration(db, migration.id);
    })();
  }
}
```

### Idempotency

مهاجرت‌ها باید **idempotent** باشند — اجرای دوبار آن‌ها باید no-op باشد:

```sql
-- 004_proxy_registry.sql
CREATE TABLE IF NOT EXISTS proxy_registry (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  ...
);
```

از عبارات `IF NOT EXISTS`، `IF EXISTS` و `OR IGNORE` / `OR REPLACE` به‌فراوانی استفاده کنید.

### افزودن مهاجرت جدید

1. **یافتن شمارهٔ بعدی**: `ls src/lib/db/migrations/ | tail -1`
2. **ایجاد فایل**: `NNN_my_change.sql`
3. **استفاده از DDL امن**: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN`
4. **backfill با احتیاط**: از `UPDATE ... WHERE ...` برای ردیف‌های موجود استفاده کنید
5. **آزمایش روی یک کپی**: هرگز مهاجرت آزمایش‌نشده را روی محیط عملیاتی اجرا نکنید

مثال:

```sql
-- 022_add_combo_priority.sql
ALTER TABLE combos ADD COLUMN priority INTEGER DEFAULT 100;
UPDATE combos SET priority = 100 WHERE priority IS NULL;
CREATE INDEX IF NOT EXISTS idx_combos_priority ON combos(priority);
```

> **تغییرات ناسازگار با عقب** (مثلاً حذف ستون) دشوار هستند. RouteChi از downgrade پشتیبانی نمی‌کند — هنگامی که مهاجرت اعمال شد، تغییر شِما دائمی است. مطمئن شوید که برنامه‌ریزی لازم را انجام داده‌اید.

---

## رمزنگاری در حالت ساکن (At Rest)

فیلدهای حساس (API keyها، توکن‌های OAuth، رشته‌های اتصال) در حالت ساکن با **AES-256-GCM** رمزنگاری می‌شوند.

### نحوهٔ کارکرد

```ts
// src/lib/db/encryption.ts (simplified)
const key = deriveKeyFromPassphrase(passphrase, salt);
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const authTag = cipher.getAuthTag();
return { encrypted, iv, authTag };
```

### محل استفاده

- `provider_connections.api_key` — در سطح اپلیکیشن رمزنگاری می‌شود
- `provider_connections.access_token`, `refresh_token`, `id_token` — در سطح اپلیکیشن رمزنگاری می‌شوند
- ورودی‌های `key_value` با `namespace = "secrets"` — در سطح اپلیکیشن رمزنگاری می‌شوند
- `proxy_registry.auth` — در صورت وجود، در سطح اپلیکیشن رمزنگاری می‌شود

### کلید رمزنگاری

کلید رمزنگاری از یک **passphrase** (تنظیم‌شده با متغیر محیطی `STORAGE_ENCRYPTION_KEY`) و یک **salt** (ذخیره‌شده در DB) مشتق می‌شود. هر دو برای رمزگشایی داده‌ها لازم هستند.

```bash
# Generate a secure passphrase
openssl rand -hex 32

# Set in .env
STORAGE_ENCRYPTION_KEY=<your-key>
```

> **حیاتی**: گم کردن کلید رمزنگاری به معنای از دست دادن دسترسی به همهٔ داده‌های رمزنگاری‌شده است. **کلید را جدا از پایگاه‌داده پشتیبان بگیرید**.

### آنچه رمزنگاری نمی‌شود

به دلایل عملکردی، موارد زیر به‌صورت متن ساده ذخیره می‌شوند:

- نام‌های نمایشی ارائه‌دهنده
- تعاریف مدل (از قبل عمومی هستند)
- قوانین مسیریابی
- رکوردهای مصرف (بدون PII)

---

### محدودیت‌های رمزنگاری (v3.8.16+)

RouteChi از **`migrateLegacyEncryptedString()`** برای مدیریت شفاف دو طرح رمزنگاری استفاده می‌کند:

- **قدیمی** (پیش از v3.5.0): «رمزنگاری» مبتنی بر XOR (رمزنگاری واقعی نیست)
- **فعلی**: AES-256-GCM با IV و auth tag مناسب

تابع کمکی، قالب قدیمی را تشخیص می‌دهد و در اولین خواندن با طرح جدید رمزنگاری مجدد می‌کند. این یعنی می‌توانید یک پایگاه‌دادهٔ قدیمی را ارتقا دهید بدون آنکه اعتبارنامه‌ها را از دست بدهید.

---

## کش خواندن

برای داده‌های پرخوانی (مدل‌ها، ارائه‌دهنده‌ها، تنظیمات)، فایل `readCache.ts` یک **کش درون‌حافظه‌ای** فراهم می‌کند:

```ts
// Cached at startup, invalidated on write
const providers = await getCachedProviders(); // Fast, in-memory
const fresh = await listProviders(); // Slow, hits DB
```

| موجودیت کش‌شده         | کلید کش        | TTL            |
| ----------------------- | -------------- | -------------- |
| `models`                | `models:v1`    | تا زمان نوشتن  |
| `provider_connections`  | `providers:v1` | تا زمان نوشتن  |
| `settings`              | `settings:v1`  | تا زمان نوشتن  |
| `combos`                | `combos:v1`    | تا زمان نوشتن  |

کش با هر نوشتن در جدول مربوطه نامعتبر می‌شود.

---

## پشتیبان‌گیری و بازیابی

### پشتیبان دستی

```bash
# Use the CLI to create a local backup
routechi backup create --name pre-migration

# Or via the API
curl -X PUT http://localhost:20128/api/db-backups \
  -H "Authorization: Bearer $MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "pre-migration"}'
```

فایل پشتیبان شامل موارد زیر است:

- همهٔ جداول DB (سریالایز به JSON)
- مصنوعات لاگ فراخوانی (base64-encoded، اختیاری)
- تنظیمات + secretها (رمزنگاری‌شده)
- پیکربندی افزونه

### بازیابی

```bash
# Via CLI
routechi restore pre-migration

# Via API
curl -X POST http://localhost:20128/api/db-backups/restore \
  -H "Authorization: Bearer $MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "pre-migration"}'
```

> **هشدار**: بازیابی کل DB را بازنویسی می‌کند. ابتدا همهٔ کلاینت‌ها را متوقف کنید.

### پشتیبان‌گیری خودکار

```bash
# Enable automated daily backups via CLI
routechi backup auto enable --cron "0 2 * * *" --retention 7
```

### پشتیبان Hot در SQLite

برای پشتیبان‌گیری بدون توقف از یک DB زنده:

```bash
sqlite3 ~/.omniroute/storage.sqlite ".backup /backups/omniroute-hot.db"
```

این روش از API پشتیبان آنلاین SQLite استفاده می‌کند — در حالی که RouteChi در حال اجراست، امن است.

---

## تنظیم عملکرد

### حالت WAL

حالت WAL به‌طور پیش‌فرض فعال است. برای بارهای با نوشتن بالا، موارد زیر را در نظر بگیرید:

```sql
PRAGMA wal_autocheckpoint = 1000;  -- Checkpoint every 1000 pages
PRAGMA journal_size_limit = 67108864;  -- 64MB WAL cap
```

### ایندکس‌ها

ایندکس‌های کلیدی برای عملکرد (به‌صورت خودکار توسط مهاجرت‌ها ساخته می‌شوند):

- `idx_models_provider` — جستجوی مدل بر اساس ارائه‌دهنده
- `idx_combo_targets_combo_id` — بسط هدف combo
- `idx_usage_history_api_key_timestamp` — تحلیل مصرف
- `idx_quota_snapshots_api_key_window` — ردیابی سهمیه
- `idx_call_logs_timestamp` — کوئری‌های لاگ فراخوانی

برای افزودن ایندکس جدید، یک مهاجرت بسازید:

```sql
-- 023_add_my_index.sql
CREATE INDEX IF NOT EXISTS idx_my_table_my_column ON my_table(my_column);
```

### ورودی/خروجی حافظه‌نگاشت‌شده (Memory-Mapped I/O)

برای پایگاه‌داده‌های بسیار بزرگ (>۱۰ گیگابایت)، memory mapping از طریق pragma قابل تنظیم است:

```sql
-- Set via SQLite pragma (adjust in core.ts or runtime)
PRAGMA mmap_size = 268435456;  -- 256MB
```

### فشردگی (Compaction)

نمونه‌های طولانی‌مدت RouteChi از اجرای متناوب `VACUUM` سود می‌برند:

```bash
sqlite3 ~/.omniroute/storage.sqlite "VACUUM;"
```

این را ماهانه در بازه‌های کم‌ترافیک اجرا کنید. (حالت WAL نیاز را کاهش می‌دهد اما حذف نمی‌کند.)

---

## بررسی سلامت

فایل `src/lib/db/healthCheck.ts` **تشخیص‌های سلامت در سطح DB** را فراهم می‌کند:

````bash
GET /api/db/health

Returns:

```json
{
  "status": "healthy",
  "checks": {
    "writable": { "status": "pass" },
    "integrity": { "status": "pass", "result": "ok" },
    "foreign_keys": { "status": "pass", "violations": 0 },
    "orphaned_artifacts": { "status": "warn", "count": 12 },
    "table_sizes": {
      "usage_history": { "rows": 12345, "size_mb": 12.3 },
      "call_logs": { "rows": 567, "size_mb": 2.1 }
    }
  }
}
````

برای تشخیص خرابی `PRAGMA integrity_check` را اجرا کنید:

```bash
sqlite3 ~/.omniroute/storage.sqlite "PRAGMA integrity_check;"
# Should print: ok
```

اگر چیزی جز `ok` بازگرداند، **بلافاصله از پایگاه‌داده استفاده را متوقف کنید** و از پشتیبان بازیابی نمایید.

---

## بازیابی فاجعه

### سناریو ۱: گم‌شدن فایل WAL

فایل `-wal` گم شده اما `-shm` و DB اصلی سالم هستند:

```bash
# Recovers automatically on next open
omniroute
```

اگر SQLite نتواند به‌طور خودکار بازیابی کند:

```bash
sqlite3 ~/.omniroute/storage.sqlite ".recover" > recovered.sql
sqlite3 recovered.db < recovered.sql
mv recovered.db ~/.omniroute/storage.sqlite
```

### سناریو ۲: خرابی فایل DB اصلی

از پشتیبان بازیابی کنید:

```bash
routechi sync pull --merge   # or: omniroute backup restore <backup-id>
```

### سناریو ۳: گم‌شدن کلید رمزنگاری

**بازیابی ممکن نیست** بدون کلید. فیلدهای رمزنگاری‌شده غیرقابل‌خواندن می‌مانند. همهٔ ارائه‌دهنده‌ها را به‌صورت دستی با اعتبارنامه‌های جدید اضافه کنید.

> **تعدیل**: همیشه کلید رمزنگاری را جداگانه پشتیبان بگیرید، ترجیحاً در یک مدیریتگر گذرواژه یا KMS.

### سناریو ۴: پُر شدن دیسک

SQLite خطای `SQLITE_FULL` بازمی‌گرداند. فضای دیسک را آزاد کنید، سپس:

```bash
# Checkpoint WAL to free up space
sqlite3 ~/.omniroute/storage.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"
```

---

## عملیات‌های رایج

### بررسی یک جدول

```bash
sqlite3 ~/.omniroute/storage.sqlite "SELECT * FROM api_keys LIMIT 5;"
```

### شمارش ردیف‌ها در همهٔ جداول

```bash
sqlite3 ~/.omniroute/storage.sqlite <<EOF
SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
EOF
```

### بازنشانی (پاک‌سازی) همهٔ داده‌ها

```bash
# Stop RouteChi first
routechi stop

# Delete the DB file
rm ~/.omniroute/storage.sqlite*

# Restart (will recreate empty DB)
omniroute
```

برای بازنشانی **انتخابی** (نگه‌داشتن ارائه‌دهنده‌ها، پاک‌کردن مصرف):

```bash
DELETE FROM usage_history WHERE timestamp < datetime('now', '-30 day');
DELETE FROM call_logs WHERE timestamp < datetime('now', '-30 day');
DELETE FROM proxy_logs WHERE timestamp < datetime('now', '-30 day');
```

### خروجی تک جدول

```bash
sqlite3 ~/.omniroute/storage.sqlite <<EOF
.mode csv
.output api_keys.csv
SELECT * FROM api_keys;
EOF
```

---

## عیب‌یابی

### «Database is locked»

فرایند دیگری قفل نوشتن را نگه داشته است. یا:

- منتظر پایان فرایند دیگر بمانید (با `lsof | grep storage.sqlite` بررسی کنید)
- فرایند دیگر را kill کنید
- اگر مستمر بود، RouteChi را راه‌اندازی مجدد کنید

### «Foreign key constraint failed»

یک ماژول دامنه یکپارچگی ارجاعی را نقض کرده است. بررسی کنید:

- ردیف‌های یتیم در جداول وابسته
- حذف‌های آبشاری که منتشر نشده‌اند
- مهاجرت اخیر که کلید خارجی را تغییر داده است

برای یافتن تخلف‌ها `PRAGMA foreign_key_check;` را اجرا کنید.

### «Out of memory»

ورودی/خروجی حافظه‌نگاشت‌شدهٔ SQLite از حد سیستم‌عامل فراتر رفته است. با pragma آن را کاهش دهید:

```sql
PRAGMA mmap_size = 134217728;  -- 128MB instead of 256MB
```

یا غیرفعال کنید:

```sql
PRAGMA mmap_size = 0;
```

### «Migration failed mid-way»

مهاجرت در یک تراکنش اجرا شده، بنابراین باید rollback شده باشد. اگر نه:

1. **RouteChi را متوقف کنید** (از تلاش‌های بیشتر جلوگیری کنید)
2. **وضعیت DB را** با `sqlite3` بررسی کنید
3. **مهاجرت ناقص را** به‌صورت دستی اصلاح کنید
4. **RouteChi را دوباره اجرا کنید** (مهاجرت دوباره امتحان می‌شود)

برای جلوگیری از این حالت، همیشه مهاجرت‌ها را ابتدا روی یک کپی آزمایش کنید.

---

## مطالعهٔ بیشتر

- [USAGE_QUOTA_GUIDE.md](../guides/USAGE_QUOTA_GUIDE.md) — جداول مصرف
- [MONITORING_GUIDE.md](./MONITORING_GUIDE.md) — پایش سلامت
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — جریان انتشار
- منبع: `src/lib/db/` (بیش از ۸۰ فایل، حدود ۲۵K خط کد)
