---
title: "راهنمای پایش و مشاهده‌پذیری"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای پایش و مشاهده‌پذیری

> **خلاصه**: RouteChi به‌همراه پایش سلامت داخلی، خودنمایش ارائه‌دهنده، ردیابی سهمیه و قلاب‌های مشاهده‌پذیری عرضه می‌شود. این راهنما داشبورد، هشدارها و عیب‌یابی را پوشش می‌دهد.

**منابع:**

- `src/lib/monitoring/observability.ts` — snapshot مشاهده‌پذیری
- `src/lib/monitoring/comboHealthAutopilot.ts` — autopilot سلامت combo
- `src/lib/monitoring/providerHealthAutopilot.ts` — autopilot ارائه‌دهنده
- `src/lib/monitoring/providerHealthMatrix.ts` — ماتریس سلامت ارائه‌دهنده
- `src/lib/localHealthCheck.ts` — بررسی سلامت محلی
- `src/lib/tokenHealthCheck.ts` — سلامت refresh توکن
- `src/lib/proxyHealth.ts` — کش سلامت پراکسی (در PROXY_GUIDE.md پوشش داده شده)

---

## نمای کلی

RouteChi دارای **۳ لایهٔ پایش** است:

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: System Health (server-level)                        │
│  ├─ localHealthCheck.ts — DB, ports, native deps              │
│  ├─ db/healthCheck.ts — integrity, FK, orphaned artifacts     │
│  └─ Dashboard: /dashboard/health                              │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: Provider Health (per-provider resilience)            │
│  ├─ providerHealthAutopilot.ts — circuit breaker, cooldowns   │
│  ├─ providerHealthMatrix.ts — health scores by provider/model │
│  └─ Dashboard: /dashboard/providers                           │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Live Observability (runtime snapshots)               │
│  ├─ observability.ts — circuit breakers, sessions, quota       │
│  ├─ tokenHealthCheck.ts — OAuth token refresh health          │
│  └─ MCP tools: omniroute_get_health, omniroute_get_session_snapshot │
└──────────────────────────────────────────────────────────────┘
```

---

## صفحات داشبورد

### `/dashboard/health` (سلامت سیستم)

داشبورد سلامت سطح بالا نشان می‌دهد:

| بخش                  | چیزی که نشان می‌دهد                              |
| -------------------- | ------------------------------------------------ |
| **وضعیت سرور**       | آپ‌تایم، نسخه، پورت، اتصالهای فعال              |
| **پایگاه‌داده**       | اتصال، یکپارچگی، اندازهٔ WAL، مهاجرت‌های اخیر   |
| **خلاصهٔ ارائه‌دهنده**| تعداد فعال، تعداد سالم، تعداد breaker باز        |
| **نظارت‌گر سهمیه**    | نشست‌های فعال، هشدار، مصرف‌شده                   |
| **خطاهای اخیر**      | ۱۰ خطای آخر همراه با stack trace                |
| **مصرف منابع**       | حافظه، CPU، نشانگر فشار heap                     |

### `/dashboard/providers` (سلامت ارائه‌دهنده)

داشبورد هر ارائه‌دهنده:

| ستون        | توصیف                                  |
| ----------- | -------------------------------------- |
| Provider    | شناسهٔ ارائه‌دهنده + نام نمایشی       |
| Health      | وضعیت سبز/زرد/قرمز                     |
| Circuit     | حالت باز/بسته/نیمه‌بسته                |
| Connections | تعداد اتصال‌ها، آخرین refresh          |
| Models      | مدل‌های موجود، سلامت هر مدل            |
| Cost        | هزینهٔ امروز، روند ۷ روزه              |
| Errors      | تعداد خطاهای ۲۴ ساعت اخیر، کلاس خطای اصلی |

با کلیک روی یک ارائه‌دهنده ببینید:

- درخواست‌های اخیر با تفکیک تأخیر
- نمرات سلامت هر اتصال
- قفل‌های هر مدل
- پیشنهادهای autopilot

### `/dashboard/quota` (ردیابی سهمیه)

برای هر API key:

- مصرف فعلی در برابر سقف (نوار پیشرفت)
- روند سهمیه (نمودار ۳۰ روزه)
- زمان بازنشانی بعدی
- تاریخچهٔ هشدار

### `/dashboard/combos` (سلامت combo)

برای هر combo:

- استراتژی + هدف‌ها
- سلامت هر هدف
- رویدادهای fallback اخیر
- نرخ موفقیت (۲۴ ساعت، ۷ روز، ۳۰ روز)

---

## API بررسی سلامت

> **یادداشت:** تنها `GET /api/monitoring/health` به‌عنوان نقطهٔ پایانی REST در دسترس است. سایر داده‌های پایش (سلامت ارائه‌دهنده، مسائل autopilot، نظارت‌گرهای سهمیه، سلامت توکن، تأخیر) از طریق **ابزار MCP** `observability_snapshot` یا صفحات **داشبورد** قابل دسترسی‌اند — مسیرهای REST اختصاصی برای این‌ها وجود ندارد.

### سلامت سیستم

```bash
GET /api/monitoring/health
```

پاسخ:

```json
{
  "status": "healthy",
  "version": "3.8.16",
  "uptime": 123456,
  "checks": {
    "database": { "status": "pass", "latency_ms": 2 },
    "writeable": { "status": "pass" },
    "integrity": { "status": "pass", "result": "ok" },
    "foreign_keys": { "status": "pass", "violations": 0 },
    "heap_pressure": { "status": "pass", "usage_mb": 142, "threshold_mb": 512 },
    "active_sessions": 12,
    "providers": {
      "total": 7,
      "healthy": 6,
      "degraded": 1,
      "down": 0
    }
  }
}
```

### سلامت ارائه‌دهنده

> **بدون نقطهٔ پایانی REST.** داده‌های سلامت ارائه‌دهنده از طریق ابزار MCP `observability_snapshot` یا صفحهٔ داشبورد `/dashboard/providers` قابل دسترسی است.

### جزئیات ارائه‌دهنده

> **بدون نقطهٔ پایانی REST.** جزئیات هر ارائه‌دهنده از طریق صفحهٔ داشبورد `/dashboard/providers` قابل دسترسی است.

---

## Autopilot سلامت ارائه‌دهنده

ماژول `providerHealthAutopilot.ts` یک **سیستم خودترمیمی** است که:

1. مسائل ارائه‌دهنده را تشخیص می‌دهد (مدار باز، cooldown، قفل، هشدار سهمیه)
2. **اقدامات پیشنهادی** برای رفع آن‌ها تولید می‌کند
3. در صورت امکان، اقدامات کم‌خطر را **به‌طور خودکار اجرا** می‌کند

### انواع مسئلهٔ تشخیص‌داده‌شده

| نوع مسئله                      | شدت   | نمونهٔ شرط                           |
| ------------------------------ | ----- | ------------------------------------ |
| `provider_circuit_open`        | بحرانی | مدارشکن پس از ۵ شکست باز شده         |
| `provider_circuit_half_open`   | هشدار | مدار در حال آزمایش بازیابی           |
| `connection_cooldown`          | هشدار | اتصال در cooldown پس از 429          |
| `stale_connection_error`       | هشدار | آخرین refresh بیش از ۳۰ دقیقه پیش شکست خورده |
| `terminal_connection_error`    | بحرانی | OAuth لغو شده، کلید نامعتبر         |
| `inactive_connection`          | اطلاعاتی | اتصال در تنظیمات غیرفعال شده        |
| `model_lockout`                | هشدار | مدل مشخصی در قرنطینه                 |
| `quota_monitor_warning`        | هشدار | سهمیه در ۸۰٪+ مصرف                   |

### انواع اقدام تولیدشده

| اقدام                          | ریسک   | توصیف                                |
| ------------------------------ | ------ | ------------------------------------ |
| `clear_provider_breaker`       | متوسط  | بازنشانی مدارشکن به حالت بسته        |
| `clear_connection_cooldown`    | کم     | حذف cooldown از یک اتصال             |
| `clear_stale_connection_error` | کم     | پاک‌کردن پرچم خطای کهنه              |
| `clear_model_lockout`          | کم     | فعال‌سازی مجدد یک مدل قرنطینه‌شده     |
| `reactivate_connection`        | متوسط  | فعال‌سازی مجدد یک اتصال غیرفعال‌شده   |
| `deactivate_connection`        | بالا   | غیرفعال‌کردن یک اتصال مشکل‌دار        |

### API

> **بدون نقطهٔ پایانی REST.** مسائل autopilot از طریق ابزار MCP `observability_snapshot` یا داشبورد قابل دسترسی است. autopilot به‌صورت داخلی اجرا می‌شود؛ رفتار آن از طریق پایگاه‌دادهٔ تنظیمات (فیلد `autopilotMode` هر اتصال) پیکربندی می‌شود، نه متغیرهای محیطی — `grep -rn` برای متغیر محیطی autopilot-mode بدون نتیجه است.

### حالت Autopilot

autopilot به‌طور پیش‌فرض در **حالت دستی** عمل می‌کند — مسائل را تشخیص داده و اقدامات پیشنهادی تولید می‌کند، اما آن‌ها را به‌طور خودکار اعمال نمی‌کند. اقدامات از طریق داشبورد قابل اعمال‌اند.

---

## Autopilot سلامت combo

فایل `comboHealthAutopilot.ts` معادل **مخصوص combo** برای autopilot ارائه‌دهنده است. این ماژول:

- comboهای ناسالم را تشخیص می‌دهد
- بازترتیب‌کردن هدف را پیشنهاد می‌دهد
- غیرفعال‌کردن اهداف شکسته را پیشنهاد می‌دهد
- اهداف مرده را پس از N شکست به‌طور خودکار حذف می‌کند

### نمونهٔ مسائل combo

```
Combo "always-on" (priority strategy)
├─ Target 1: openai/gpt-5 (healthy)
├─ Target 2: anthropic/claude-opus-4-6 (⚠️ model lockout until 14:00)
└─ Target 3: kiro/claude-sonnet-4-5 (healthy)

Recommended action: Reorder — move kiro above anthropic until lockout expires
```

---

## نظارت‌گرهای سهمیه

فایل `observability.ts` **نظارت‌گرهای سهمیهٔ هر نشست** را برای ارائه‌دهنده‌های اشتراکی (Claude Code، Codex، GitHub Copilot) در معرض دید قرار می‌دهد:

```ts
interface QuotaMonitorSnapshot {
  sessionId: string;
  provider: string;
  accountId: string;
  status: "starting" | "idle" | "healthy" | "warning" | "exhausted" | "error";
  lastQuotaPercent: number | null; // 0-100
  lastQuotaUsed: number | null;
  lastQuotaTotal: number | null;
  lastResetAt: string | null;
  nextPollAt: string | null;
  totalPolls: number;
  totalAlerts: number;
  consecutiveFailures: number;
}
```

### معانی وضعیت

| وضعیت       | زمان                       | اقدام UI                            |
| ----------- | -------------------------- | ----------------------------------- |
| `starting`  | poll اولیه در حال انجام    | چرخنده                              |
| `idle`      | بدون فعالیت اخیر           | در داشبورد پنهان                    |
| `healthy`   | سهمیه > ۵۰٪ باقی           | نقطهٔ سبز                           |
| `warning`   | سهمیه < ۵۰٪ باقی           | هشدار زرد                           |
| `exhausted` | سهمیه = ۰٪                 | بلوک قرمز، هدایت به ارائه‌دهندهٔ بعدی |
| `error`     | polling شکست خورد          | نقطهٔ قرمز، تلاش مجدد به‌زودی        |

### API

> **بدون نقطهٔ پایانی REST.** داده‌های نظارت‌گر سهمیه از طریق ابزار MCP `observability_snapshot` یا داشبورد قابل دسترسی است.

---

## Snapshot مشاهده‌پذیری

ابزار MCP `observability_snapshot` یک **snapshot کامل سیستم** برای agentهای هوش مصنوعی بازمی‌گرداند:

```json
{
  "circuitBreakers": [
    {
      "name": "openai",
      "state": "closed",
      "failureCount": 0,
      "lastFailureTime": null,
      "retryAfterMs": null
    }
  ],
  "sessions": [
    {
      "sessionId": "sess-123",
      "createdAt": 1234567890,
      "lastActive": 1234567999,
      "requestCount": 42,
      "connectionId": "conn-456",
      "ageMs": 109
    }
  ],
  "quotaMonitors": {
    /* see above */
  },
  "uptime": 12345,
  "version": "3.8.16"
}
```

agentها از این snapshot برای **تصمیمات مسیریابی** استفاده می‌کنند — مثلاً «اگر مدار openai باز است، ابتدا به anthropic هدایت کن».

---

## بررسی سلامت توکن

ارائه‌دهنده‌های OAuth (Claude Code، GitHub Copilot، Cursor) نیازمند **refresh متناوب توکن** هستند. فایل `src/lib/tokenHealthCheck.ts` یک زمان‌بند پس‌زمینه اجرا می‌کند:

- **تیک sweep**: هر ۶۰ ثانیه (sweep در `TICK_MS = 60 * 1000` در `src/lib/tokenHealthCheck.ts:30`)
- **بازهٔ بررسی سلامت هر اتصال**: به‌طور پیش‌فرض ۶۰ دقیقه (`DEFAULT_HEALTH_CHECK_INTERVAL_MIN = 60`)؛ از طریق پایگاه‌دادهٔ تنظیمات قابل پیکربندی
- **refresh پیش‌دستانه در 401**: توسط interceptor هر اتصال مدیریت می‌شود

### وضعیت سلامت توکن

```ts
interface TokenHealth {
  connectionId: string;
  provider: string;
  status: "valid" | "expiring_soon" | "expired" | "refresh_failed";
  expiresAt: string;
  lastRefresh: string;
  nextRefresh: string;
  consecutiveFailures: number;
}
```

### پیکربندی

پیکربندی بررسی سلامت توکن به‌طور داخلی توسط `tokenHealthCheck.ts` مدیریت می‌شود.

### سلامت توکن

> **بدون نقطهٔ پایانی REST.** داده‌های سلامت توکن از طریق داشبورد یا ابزار MCP `observability_snapshot` قابل دسترسی است.

---

## هشدار

### کانال‌های داخلی

RouteChi از **۳ کانال هشدار** پشتیبانی می‌کند:

| کانال            | راه‌اندازی     | مورد استفاده                  |
| ---------------- | -------------- | ----------------------------- |
| بنر داشبورد      | همیشه فعال     | اعلان‌های درون‌اپلیکیشن       |
| Webhook          | پیکربندی URL   | Slack، Discord، PagerDuty     |
| لاگ              | پیش‌فرض        | برای تجمیع لاگ خارجی          |

### پیکربندی Webhook

> **یادداشت:** پیکربندی هشدار webhook از طریق صفحهٔ تنظیمات داشبورد مدیریت می‌شود. برای URL وب‌هوک، فیلتر رویداد و سفارشی‌سازی payload به رابط تنظیمات مراجعه کنید.

### انواع هشدار

| هشدار                        | زمان                              | شدت پیش‌فرض     |
| ---------------------------- | --------------------------------- | --------------- |
| `provider_circuit_open`      | مدار باز می‌شود                   | بحرانی          |
| `provider_circuit_half_open` | مدار در حال آزمایش بازیابی        | اطلاعاتی        |
| `quota_warning`              | سهمیه در ۸۰٪+                     | هشدار           |
| `quota_exhausted`            | سهمیه در ۱۰۰٪                     | بحرانی          |
| `token_refresh_failed`       | ۳+ شکست متوالی refresh            | هشدار           |
| `token_expired`              | توکن از تاریخ عبور کرده           | بحرانی          |
| `combo_target_unhealthy`     | هدف combo بیش از ۱ ساعت در cooldown | هشدار           |
| `db_integrity_warning`       | تخلف FK > 0                       | هشدار           |
| `heap_pressure`              | مصرف heap > ۸۰٪ آستانه            | هشدار           |

---

## معیارهای عملکرد

### معیارهای ردیابی‌شده

| معیار                    | نوع       | منبع                           |
| ------------------------ | --------- | ------------------------------ |
| `request_count`          | counter   | `services/usage.ts`            |
| `request_latency_ms`     | histogram | `services/usage.ts`            |
| `tokens_consumed`        | counter   | `services/usage.ts`            |
| `cost_usd`               | counter   | `services/usage.ts`            |
| `provider_errors`        | counter   | `services/errorClassifier.ts`  |
| `circuit_state_changes`  | counter   | `services/resilience.ts`       |
| `cache_hits`             | counter   | `services/signatureCache.ts`   |
| `compression_savings`    | histogram | `services/compression/stats.ts`|
| `quota_used`             | gauge     | `services/quotaMonitor.ts`     |
| `memory_used_mb`         | gauge     | `observability.ts`             |

### صدک‌های تأخیر (p50/p95/p99)

> **بدون نقطهٔ پایانی REST.** داده‌های صدک تأخیر از طریق صفحهٔ داشبورد `/dashboard/health` قابل دسترسی است. خروجی Prometheus/OpenTelemetry برای v3.9 برنامه‌ریزی شده است.

### خروجی Prometheus / OpenTelemetry (فاز ۲)

برنامه‌ریزی برای v3.9: خروجی بومی به Prometheus، OpenTelemetry، Datadog.

تا آن زمان، `/api/monitoring/health` را با هر سیستم پایش مبتنی بر HTTP (Prometheus blackbox exporter، Datadog HTTP check و غیره) scrape کنید.

---

### دستورالعمل‌های هشدار

### Slack

> **یادداشت:** هشدار webhook از طریق صفحهٔ تنظیمات داشبورد پیکربندی می‌شود — متغیرهای محیطی اختصاصی برای وب‌هوک وجود ندارد (`grep -rn` بدون نتیجه است). برای URL وب‌هوک، فیلتر رویداد و سفارشی‌سازی payload به رابط تنظیمات مراجعه کنید.

### Discord

> هشدار وب‌هوک از همان جریان رابط تنظیمات Slack استفاده می‌کند. Discord همان شکل payload JSON را می‌پذیرد.

### PagerDuty

> هشدار وب‌هوک از همان جریان رابط تنظیمات استفاده می‌کند. کلیدهای مسیریابی PagerDuty Events API v2 در رابط تنظیمات پیکربندی می‌شوند.

### Webhook سفارشی (JSON)

> هر نقطهٔ پایانی HTTP که POST با بدنهٔ JSON را بپذیرد کار می‌کند. URL را در رابط تنظیمات پیکربندی کنید.

---

## پیکربندی داشبورد

### سفارشی‌سازی داشبورد سلامت

یک فایل `~/.omniroute/dashboard.json` بسازید:

```json
{
  "health": {
    "sections": ["server_status", "database", "providers", "quota_monitors", "recent_errors"],
    "refresh_interval_ms": 5000
  }
}
```

### سنجاق‌کردن یک ارائه‌دهنده به بالا

```json
{
  "health": {
    "pinned_providers": ["openai", "anthropic"]
  }
}
```

---

## عیب‌یابی

### «ارائه‌دهنده سالم می‌گوید اما درخواست‌ها شکست می‌خورند»

1. **مسائل autopilot** را بررسی کنید — شاید یک مدل قفل شده
2. **خطاهای اخیر** را برای کلاس خطای مشخص ببینید
3. **آزمایش اتصال** را در کارت ارائه‌دهنده امتحان کنید
4. بررسی کنید آیا ارائه‌دهنده **در بالادست rate-limited** شده (به‌صورت محلی قابل مشاهده نیست)

### «سهمیه سالم می‌گوید اما 429 می‌بینم»

- 429 یعنی ارائه‌دهنده می‌گوید سهمیه‌تان را مصرف کرده‌اید
- ردیابی سهمیهٔ RouteChi ممکن است **کهنه** باشد — حقیقت ارائه‌دهنده در بالادست است
- داده‌های سهمیه از طریق نظارت‌گر داخلی به‌طور خودکار refresh می‌شوند

### «combo شکست می‌خورد اما همهٔ اهداف سالم به‌نظر می‌رسند»

- **داشبورد سلامت combo** را برای مسائل ترتیب هدف بررسی کنید
- **رویدادهای fallback** را ببینید — شاید combo خیلی زود تمام می‌شود
- تأیید کنید **استراتژی** با مورد استفادهٔ شما مطابقت دارد (priority در برابر round-robin در برابر auto)

### «بررسی سلامت پایگاه‌داده شکست می‌خورد»

- `sqlite3 ~/.omniroute/storage.sqlite "PRAGMA integrity_check;"` را اجرا کنید
- اگر «ok» بود — هشدار کاذب، بررسی سلامت بیش‌ازحد سخت‌گیر است
- در غیر این صورت — **RouteChi را متوقف کنید** و [راهنمای بازیابی فاجعه](./DATABASE_GUIDE.md#disaster-recovery) را دنبال کنید

### «فشار heap حافظه بحرانی است»

```bash
# Check current heap
node -e "console.log(process.memoryUsage())"

# Trigger manual GC (if --expose-gc)
node --expose-gc -e "global.gc(); console.log(process.memoryUsage())"

# Reduce concurrent requests (set via the dashboard Settings page, not an env var)
# There is no `MAX_CONCURRENT_REQUESTS` env var — configure it in Settings → Concurrency.
```

---

## مطالعهٔ بیشتر

- [USAGE_QUOTA_GUIDE.md](../guides/USAGE_QUOTA_GUIDE.md) — ردیابی مصرف و هزینه
- [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) — شِما و سلامت DB
- [PROXY_GUIDE.md](./PROXY_GUIDE.md) — سلامت پراکسی (کش مجزا)
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — معماری سیستم
- [RESILIENCE_GUIDE.md](../architecture/RESILIENCE_GUIDE.md) — جزئیات مدارشکن
- منبع: `src/lib/monitoring/` (۴ فایل، ۲۱۲۱ خط کد)
