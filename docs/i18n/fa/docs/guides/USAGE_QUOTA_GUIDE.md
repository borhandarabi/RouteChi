---
title: "پیگیری استفاده، سهمیه و هزینه"
version: 3.8.40
lastUpdated: 2026-06-28
---

# پیگیری استفاده، سهمیه و هزینه

> **خلاصه:** RouteChi استفادهٔ توکن هر درخواست را پیگیری می‌کند، هزینه را محاسبه می‌کند،
> سهمیهٔ هر کلید API را اعمال می‌کند و تحلیل‌ها را در داشبورد نمایش می‌دهد. این راهنما
> نحوهٔ کار همه‌چیز را توضیح می‌دهد.

**منابع:**

- `open-sse/services/usage.ts` (~70KB) — پیگیری اصلی استفاده
- `src/lib/usageAnalytics.ts` (~10KB) — تجمیع برای داشبورد
- `src/lib/db/quotaSnapshots.ts` — دادهٔ تاریخی سهمیه
- `src/lib/db/usage*.ts` — چندین ماژول DB مرتبط با استفاده

---

## مرور کلی

هر درخواستی که از RouteChi عبور می‌کند یک **سابقهٔ استفاده** تولید می‌کند که شامل موارد زیر است:

- **هویت**: کدام کلید API، ارائه‌دهنده، مدل، کامبو
- **توکن‌ها**: prompt tokens، completion tokens، cached tokens، مجموع
- **هزینه**: مبلغ دلاری (محاسبه‌شده از دادهٔ قیمت‌گذاری)
- **زمان‌بندی**: latency، مهرهای زمانی شروع/پایان
- **وضعیت**: موفق، خطا، rate-limited و...

این سوابق به‌صورت **تحلیل‌ها** تجمیع می‌شوند، به‌عنوان **تصویر لحظه‌ای سهمیه** ذخیره
می‌شوند و برای اعمال **محدودیت‌های بودجهٔ هر کلید** استفاده می‌گردند.

```
Request ──▶ chatCore ──▶ usage.record() ──▶ SQLite
                                  │
                          ┌───────┼───────┐
                          ▼       ▼       ▼
                    analytics  quota   billing
                    (dashboard) (enforce) (export)
```

---

## چه چیزی ثبت می‌شود

سرویس `usage.ts` برای هر درخواست یک **رویداد استفاده** ثبت می‌کند:

| فیلد               | نوع     | منبع                                                       |
| ------------------ | ------- | ---------------------------------------------------------- |
| `id`               | string  | UUID تولید‌شده هنگام ثبت                                     |
| `apiKeyId`         | string  | کلید API که درخواست را آغاز کرده                           |
| `provider`         | string  | شناسهٔ ارائه‌دهنده (openai، anthropic و...)                  |
| `model`            | string  | شناسهٔ مدل (gpt-5، claude-opus-4-6 و...)                    |
| `comboId`          | string? | شناسهٔ کامبو در صورت مسیریابی از طریق کامبو                 |
| `promptTokens`     | number  | از پاسخ بالادست                                            |
| `completionTokens` | number  | از پاسخ بالادست                                            |
| `cachedTokens`     | number  | توکن‌های cache hit (prompt caching مربوط به Anthropic و...) |
| `totalTokens`      | number  | prompt + completion                                        |
| `costUsd`          | number  | محاسبه‌شده از دادهٔ قیمت‌گذاری                              |
| `latencyMs`        | number  | مدت زمان end-to-end درخواست                                |
| `status`           | enum    | `success`، `error`، `rate_limited`، `timeout`، `cancelled` |
| `errorClass`       | string? | کلاس خطا در صورت status != success                         |
| `timestamp`        | string  | ISO 8601 UTC                                               |
| `metadata`         | object  | دادهٔ سفارشی تزریق‌شده توسط افزونه                           |

### توکن‌ها از کجا می‌آیند

توکن‌ها از پاسخ ارائه‌دهندهٔ بالادست در **پاسخ‌دهنده (response handler)** استخراج می‌شوند:

```ts
// From open-sse/handlers/chatCore.ts
const response = await providerExecutor.execute(provider, request);
const usage = response.usage || {
  prompt_tokens: 0,
  completion_tokens: 0,
  cached_tokens: 0,
};
```

برای ارائه‌دهنده‌هایی که استفاده را بازنمی‌گردانند (برخی ارائه‌دهنده‌های web-cookie)،
RouteChi توکن‌ها را با استفاده از اکتشافی `~4 chars per token` **تخمین می‌زند**
(به `open-sse/services/autoCombo/pipelineRouter.ts` مراجعه کنید).

### توکن‌های کش‌شده

RouteChi `cached_tokens` را جدا از `prompt_tokens` پیگیری می‌کند زیرا:

- prompt caching مربوط به Anthropic برای توکن‌های کش‌شده نرخ کاهش‌یافته (۱۰٪ از نرخ عادی)
  charges می‌کند
- برخی ارائه‌دهنده‌ها `cache_read_input_tokens` بازمی‌گردانند که باید متفاوت قیمت‌گذاری شود
- تحلیل‌ها می‌توانند **cache hit rate** = `cached_tokens / prompt_tokens` را نمایش دهند

---

## محاسبهٔ هزینه

هزینه‌ها از **دادهٔ قیمت‌گذاری** همگام‌شده با LiteLLM محاسبه می‌شوند (`src/lib/pricingSync.ts`):

| مدل               | ورودی $/1M | خروجی $/1M | کش‌شده $/1M |
| ----------------- | ---------- | ---------- | ----------- |
| gpt-5             | $2.50      | $10.00     | —           |
| claude-opus-4-6   | $15.00     | $75.00     | $1.50       |
| claude-sonnet-4-5 | $3.00      | $15.00     | $0.30       |
| gemini-2.5-pro    | $1.25      | $10.00     | —           |

فرمول هزینه (`src/lib/usage/costCalculator.ts`):

```ts
cost =
  (prompt_tokens - cached_tokens) * input_price +
  cached_tokens * cached_price +
  completion_tokens * output_price;
```

> **چرا بخش کش‌شده از prompt کسر می‌شود؟** بخش کش‌شده به‌طور جداگانه قیمت‌گذاری می‌شود؛
> اعمال نرخ ورودی روی کل prompt باعث شمارش اضافی می‌شد.

### همگام‌سازی قیمت‌گذاری

دادهٔ قیمت‌گذاری از LiteLLM از طریق نقطهٔ پایانی `/api/pricing/sync` به‌طور خودکار
همگام می‌شود (توسط وظیفهٔ cron داخلی راه‌اندازی می‌شود، نه یک متغیر محیطی رو به کاربر):

```bash
# Manual trigger
curl -X POST http://localhost:20128/api/pricing/sync
```

برای مدل‌های بدون دادهٔ قیمت‌گذاری، RouteChi به **تخمین هزینه** با استفاده از نرخ‌های
متوسط داخلی (منبع‌گرفته از دادهٔ قیمت‌گذاری LiteLLM) برمی‌گردد.

---

## تجمیع بازهٔ زمانی

ماژول `usageAnalytics.ts` ویجت‌های داشبورد را از دادهٔ خام استفاده محاسبه می‌کند. این
ماژول ۷ بازهٔ زمانی را پشتیبانی می‌کند:

| بازه     | پنجره                       | مورد استفاده                      |
| -------- | --------------------------- | --------------------------------- |
| `1d`     | آخرین ۲۴ ساعت               | شناسایی جهش ساعتی هزینه           |
| `7d`     | آخرین ۷ روز                  | بازبینی هفتگی                     |
| `30d`    | آخرین ۳۰ روز                 | صورتحساب ماهانه                   |
| `90d`    | آخرین ۹۰ روز                 | تحلیل فصلی                        |
| `ytd`    | از ۱ ژانویهٔ سال جاری         | پیگیری بودجهٔ سالانه               |
| `all`    | همهٔ زمان‌ها                 | آمار طول‌عمر                       |
| `custom` | شروع/پایان تعریف‌شده توسط کاربر | ممیزی، پرس‌وجوهای موردی            |

### ویجت‌های داشبورد محاسبه‌شده

برای هر بازهٔ زمانی، لایهٔ تحلیل موارد زیر را محاسبه می‌کند:

| ویجت                    | توضیح                                                     |
| ----------------------- | --------------------------------------------------------- |
| **کارت‌های خلاصه**       | مجموع درخواست‌ها، مجموع هزینه، مجموع توکن‌ها، نرخ موفقیت    |
| **نمودار روند روزانه**   | هزینه + توکن در هر روز، روی هم چیده‌شده بر اساس مدل         |
| **نقشهٔ حرارتی فعالیت**  | شبکهٔ ساعت‌روز × روز-هفته، رنگ = تعداد درخواست             |
| **تفکیک مدل**            | نمودار دایره‌ای هزینه بر اساس مدل                          |
| **تفکیک ارائه‌دهنده**    | نمودار میله‌ای درخواست‌ها بر اساس ارائه‌دهنده              |
| **برترین کلیدهای API**   | جدول ۱۰ کلید برتر بر اساس هزینه                           |
| **تحلیل خطا**            | نرخ خطا در طول زمان، کلاس‌های برتر خطا                     |

### دسترسی برنامه‌نویسی

````ts
import { computeAnalytics } from "@/lib/usageAnalytics";

const analytics = await computeAnalytics(
  history,              // usage history records
  "7d",                 // time range: "1d" | "7d" | "30d" | "90d" | "ytd" | "all" | "custom"
  connectionMap,        // provider connection map (connectionId → account name)
  {
    startDate: "2025-01-01",  // optional: for "custom" range
    endDate: "2025-06-01",   // optional: for "custom" range
  }
);

console.log(analytics.summary.totalCost);   // 12.34 (cents)
console.log(analytics.byModel[0]);           // { model, cost, requests, promptTokens, completionTokens }

---

## اعمال سهمیه

سهمیهٔ هر کلید API در دو مکان اعمال می‌شود:

1. **محدودیت نرم** (`quotaWarnAt`): هشدار داشبورد هنگام عبور استفاده از آستانه
2. **محدودیت سخت** (`quotaLimit`): درخواست با HTTP 429 رد می‌شود هنگام عبور

### پیکربندی

```ts
// Per API key
await updateApiKey(keyId, {
  quotaWarnAt: 5_00,    // $5.00 — show warning
  quotaLimit: 10_00,    // $10.00 — hard stop
  quotaWindow: "month", // "day" | "week" | "month" | "all"
});
````

### جریان اعمال

```
Request ──▶ quotaCheck()
              │
              ├── Within limit?  ──▶ allow
              │
              └── Over limit?  ──▶ 429 Too Many Requests
                                   with Retry-After header
```

### تصویرهای لحظه‌ای سهمیه

جدول `quotaSnapshots` **وضعیت تاریخی سهمیه** را برای تحلیل روند ذخیره می‌کند:

| فیلد        | توضیح                            |
| ----------- | -------------------------------- | ------ | ------- |
| `apiKeyId`  | کلیدی که پیگیری می‌شود           |
| `window`    | "day"                            | "week" | "month" |
| `used`      | هزینهٔ استفاده‌شده در این پنجره (cents) |
| `limit`     | سقف (cents)                      |
| `resetAt`   | زمان بازنشانی پنجره              |
| `createdAt` | زمان گرفتن تصویر لحظه‌ای         |

تصویرهای لحظه‌ای **در هر درخواست** که هزینه > ۰ دارد گرفته می‌شوند و برای موارد زیر استفاده می‌شوند:

- رندر نوار پیشرفت سهمیه در داشبورد
- نمایش نمودارهای روند سهمیه ۳۰ روزه
- راه‌اندازی هشدارها هنگام نزدیک شدن استفاده به سقف

---

## REST API

### فهرست سوابق استفاده

```bash
GET /api/usage?range=7d&limit=100
GET /api/usage?apiKeyId=key-123&range=30d
GET /api/usage?provider=openai&range=1d
```

پاسخ:

```json
{
  "records": [
    {
      "id": "uuid",
      "apiKeyId": "key-123",
      "provider": "openai",
      "model": "gpt-5",
      "promptTokens": 1234,
      "completionTokens": 567,
      "totalTokens": 1801,
      "costUsd": 0.005,
      "latencyMs": 1234,
      "status": "success",
      "timestamp": "2026-06-08T12:00:00Z"
    }
  ],
  "total": 1234,
  "nextCursor": "..."
}
```

### دریافت خلاصهٔ تحلیل

```bash
GET /api/usage/analytics?range=7d&groupBy=model
```

پاسخ:

```json
{
  "summary": {
    "totalCost": 12.34,
    "totalRequests": 5678,
    "totalTokens": 12345678,
    "successRate": 0.987,
    "avgLatencyMs": 1234
  },
  "models": [
    { "model": "gpt-5", "cost": 8.5, "requests": 1234, "tokens": 4567890 },
    { "model": "claude-opus-4-6", "cost": 3.84, "requests": 234, "tokens": 234567 }
  ],
  "daily": [
    { "date": "2026-06-01", "cost": 1.5, "requests": 800 },
    { "date": "2026-06-02", "cost": 2.0, "requests": 1000 }
  ]
}
```

### پرس‌وجوی تحلیل استفاده

دادهٔ استفاده از طریق داشبورد یا ابزارهای MCP قابل دسترسی است، نه نقاط پایانی
مستقیم صادرات REST. تحلیل‌های موجود:

- **`/api/usage/analytics`** — معیارهای تجمیع‌شدهٔ استفاده (گروه‌بندی بر اساس مدل، ارائه‌دهنده، کلید)
- **`/api/usage/quota`** — وضعیت سهمیهٔ فعلی برای هر کلید API
- **`/api/usage/history`** — سوابق تاریخچهٔ درخواست

---

## ابزارهای MCP

دو ابزار MCP دادهٔ استفاده را به agentها نمایش می‌دهند (به `open-sse/mcp-server/tools/` مراجعه کنید):

| ابزار                    | توضیح                                              |
| ----------------------- | -------------------------------------------------- |
| `omniroute_cost_report` | تولید گزارش هزینهٔ هر کلید برای یک دورهٔ مشخص      |
| `omniroute_check_quota` | بازگرداندن وضعیت سهمیهٔ فعلی برای یک کلید API       |

نمونهٔ فراخوانی agent:

```json
{
  "tool": "omniroute_cost_report",
  "args": { "period": "week" }
}
```

---

## نگه‌داری و پاک‌سازی

دادهٔ استفاده حدود ۱-۱۰KB به ازای هر درخواست رشد می‌کند. در مقیاس بالا، می‌تواند قابل‌توجه باشد.

### تنظیمات نگه‌داری

نگه‌داری تاریخچهٔ استفاده از طریق Database Settings در رابط کاربری یا از طریق
`/api/settings/database` پیکربندی می‌شود.

به‌طور پیش‌فرض، تاریخچهٔ استفاده برای **۹۰ روز** نگه‌داری می‌شود.

### پاک‌سازی

سوابق قدیمی توسط `src/lib/db/cleanup.ts` پاک می‌شوند:

- توسط فرایند cron پس‌زمینه راه‌اندازی می‌شود
- سوابق `usage_history` قدیمی‌تر از تنظیم نگه‌داری `usageHistory` پیکربندی‌شده را حذف می‌کند

### تخمین ذخیره‌سازی

| نرخ درخواست      | ذخیره‌سازی ۳۰ روزه | ذخیره‌سازی ۹۰ روزه |
| ---------------- | ------------------ | ------------------ |
| 100 req/day     | ~3MB               | ~9MB               |
| 1,000 req/day   | ~30MB              | ~90MB              |
| 10,000 req/day  | ~300MB             | ~900MB             |
| 100,000 req/day | ~3GB               | ~9GB               |

برای ترافیک بسیار بالا، در نظر بگیرید:

- کاهش دورهٔ نگه‌داری از طریق Database Settings
- استفاده از `aggregated_metrics` به‌جای سوابق خام (تنها برای تحلیل)

---

## نکات بهینه‌سازی هزینه

### ۱. استفاده از مدل مناسب

```bash
# Quick answer — use cheap + fast
curl -d '{"model":"auto/fast","messages":[...]}'

# Complex task — use quality
curl -d '{"model":"auto/smart","messages":[...]}'
```

### ۲. فعال‌سازی کش‌سازی

prompt caching مربوط به Anthropic **۹۰٪ روی context تکراری** صرفه‌جویی می‌کند:

```ts
// The caching is automatic — just include the same large system prompt
const response = await openai.chat({
  model: "claude-sonnet-4-5",
  system: longSystemPrompt, // Will be cached automatically
  messages: [{ role: "user", content: "..." }],
});
```

### ۳. استفاده از فشرده‌سازی

فشرده‌سازی RTK + Caveman **۱۵-۹۵٪ روی نشست‌های tool-heavy** صرفه‌جویی می‌کند:

```ts
const config = {
  compression: {
    engine: "rtk",
    intensity: "aggressive",
  },
};
```

### ۴. تنظیم سهمیهٔ هر کلید

همیشه `quotaLimit` را برای جلوگیری از هزینه‌های مهارنشدنی تنظیم کنید:

```ts
await updateApiKey(keyId, { quotaLimit: 10_00 }); // $10/month cap
```

### ۵. ممیزی مصرف‌کنندگان برتر

از داشبورد یا **`/api/usage/analytics`** برای گروه‌بندی بر اساس کلید API و مرتب‌سازی
بر اساس هزینه استفاده کنید:

```bash
GET /api/usage/analytics?groupBy=apiKey
```

---

## رفع اشکال

### "هزینه بالاتر از انتظار است"

1. بررسی **`/api/usage/analytics?groupBy=model`** — مدل گران‌قیمت را پیدا کنید
2. بررسی **`/api/usage/analytics?groupBy=apiKey`** — مصرف‌کنندهٔ سنگین را پیدا کنید
3. تأیید به‌روز بودن دادهٔ قیمت‌گذاری: `POST /api/pricing/sync`

### "سوابق مفقودند"

- تنظیمات نگه‌داری DB را تحت Dashboard → Database → Cleanup بررسی کنید — سوابق قدیمی
  توسط وظیفهٔ پاک‌سازی دوره‌ای (`src/lib/db/cleanup.ts`) حذف می‌شوند
- بررسی خطاها در `src/lib/db/usage*.ts` — شکست‌های نوشتن DB ثبت می‌شوند اما نمایش داده نمی‌شوند
- تأیید کنید که درخواست واقعاً به `chatCore` رسیده — مسیریابی کامبو را بررسی کنید

### "سهمیه اعمال نمی‌شود"

- تنظیم `quotaLimit` کلید را بررسی کنید
- تأیید کنید `quotaWindow` به‌درستی تنظیم شده است
- به دنبال سوابق `quotaSnapshots` بگردید — باید در هر درخواست ایجاد شوند

---

## مطالعهٔ بیشتر

- [DATABASE_GUIDE.md](../ops/DATABASE_GUIDE.md) — شمای جدول‌های استفاده
- [ENVIRONMENT.md](../reference/ENVIRONMENT.md#18-pricing-sync) — متغیرهای محیطی همگام‌سازی قیمت‌گذاری
- [AUTO-COMBO.md](../routing/AUTO-COMBO.md) — نحوهٔ کاهش هزینه توسط `auto/fast`، `auto/cheap`
- [API_REFERENCE.md](../reference/API_REFERENCE.md) — مرجع کامل `/api/usage/*`
- منبع: `open-sse/services/usage.ts`، `src/lib/usageAnalytics.ts`، `src/lib/db/usage*.ts`
