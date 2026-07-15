---
title: "وبهوک‌ها"
version: 3.8.40
lastUpdated: 2026-06-28
---

# وب‌هوک‌ها

> **منبع اصلی:** `src/lib/webhookDispatcher.ts`, `src/lib/db/webhooks.ts`, `src/app/api/webhooks/`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

OmniRoute می‌تواند در رویدادهای پلتفرم، وب‌هوک‌های HTTP را ارسال کند. از آن‌ها برای یکپارچه‌سازی با
Slack، PagerDuty، Datadog، سرویس‌های هشدار داخلی یا هر گیرنده‌ی HTTP استفاده کنید.

مبدل ارسال، هر تحویل را با HMAC-SHA256 امضا می‌کند، در صورت شکست موقت دوباره تلاش می‌کند،
سلامت تحویل را به ازای هر وب‌هوک پیگیری می‌کند و endpointهایی که دائماً شکست می‌خورند را به‌طور
خودکار غیرفعال می‌سازد.

## رویدادهای پشتیبانی‌شده

نوع `WebhookEvent` (در `src/lib/webhookDispatcher.ts`) در حال حاضر موارد زیر را مدل می‌کند:

| رویداد              | زمان اجرا                                                  |
| ------------------- | --------------------------------------------------------- |
| `request.completed` | یک درخواست پروکسی با موفقیت کامل شود                       |
| `request.failed`    | یک درخواست پروکسی پس از همه‌ی تلاش‌ها/fallbackها شکست بخورد  |
| `provider.error`    | یک provider خطایی برگرداند که واجد شرایط circuit-breaking باشد |
| `provider.recovered`| یک provider که قبلاً شکست می‌خورد به حالت سالم برگردد       |
| `quota.exceeded`    | یک API key از آستانه‌ی بودجه/سهمیه عبور کند                 |
| `combo.switched`    | یک استراتژی combo هدف اصلی خود را تغییر دهد                |
| `test.ping`         | رویداد سنتتیک که توسط endpoint آزمایشی استفاده می‌شود       |

اشتراک‌ها برای دریافت هر رویداد، مقدار تحت‌اللفظی `"*"` را می‌پذیرند. نام‌های رویداد ناشناخته
در `events` در زمان ارسال نادیده گرفته می‌شوند.

> نکته: API مبدل ارسال متصل شده است، اما siteهای فراخوانی production برای برخی از
> رویدادهای غیر از `test.ping` هنوز در حال پیاده‌سازی هستند. برای دیدن اینکه کدام مسیرها
> در نسخه‌ی شما مبدل را فراخوانی می‌کنند، `grep dispatchEvent` را بررسی کنید.

## معماری

```
Caller (handler, service, monitor)
  dispatchEvent(event, data)            [src/lib/webhookDispatcher.ts]
    -> getEnabledWebhooks()             [src/lib/db/webhooks.ts]
    -> filter by webhook.events
    -> for each match (in parallel):
       deliverWebhook(url, payload, secret)
         build payload { event, timestamp, data }
         sign body with HMAC-SHA256 (if secret present)
         POST with 10s timeout
         retry up to 3 times on 5xx / network error
       recordWebhookDelivery(id, status, success)
    -> disableWebhooksWithHighFailures(10)
```

ارسال برای فراخوانی‌کننده از نوع fire-and-forget است: `Promise.allSettled` خطاهای
هر وب‌هوک را بلعیده می‌کند تا یک گیرنده‌ی بد نتواند سایرین را مسدود کند.

## امضای HMAC

وقتی یک وب‌هوک دارای `secret` باشد، OmniRoute بدنه‌ی JSON را امضا کرده و می‌فرستد:

```
Content-Type: application/json
User-Agent: OmniRoute-Webhook/1.0
X-Webhook-Event: <event>
X-Webhook-Timestamp: <ISO-8601>
X-Webhook-Signature: sha256=<hex HMAC-SHA256(secret, body)>
```

> نام هدرها از پیشوند `X-Webhook-*` استفاده می‌کنند (نه `X-OmniRoute-*`). مقدار
> امضا به‌صورت `sha256=<hex>` است — کل پیشوند را تأیید کنید.

اگر `createWebhook` بدون secret فراخوانی شود، ماژول DB یکی تولید می‌کند
(`whsec_<48 hex>`) تا همه‌ی وب‌هوک‌ها به‌طور پیش‌فرض امضا شوند.

### تأیید در سمت گیرنده

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody: string, signature: string, secret: string) {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

همیشه امضا را در برابر بدنه‌ی **خام** درخواست، پیش از هرگونه JSON parsing تأیید کنید.

## سیاست تلاش مجدد و شکست

`deliverWebhook(url, payload, secret, maxRetries = 3)`:

- ۱۰ ثانیه timeout به ازای هر تلاش (`AbortController`).
- HTTP 2xx به‌عنوان موفقیت شمارش می‌شود.
- HTTP 3xx/4xx به‌عنوان وضعیت نهایی غیرقابل تلاش مجدد شمارش می‌شود — با
  `success = res.ok` به‌عنوان تحویل‌شده ثبت می‌شود.
- HTTP 5xx و خطاهای شبکه با backoff نمایی دوباره تلاش می‌شوند:
  `2^attempt * 1000 ms` (۱s، ۲s، ۴s).
- پس از `maxRetries`، تحویل به‌عنوان شکست‌خورده ثبت می‌شود.
- هر تحویل `last_triggered_at`، `last_status` را به‌روز می‌کند و یا
  `failure_count` را بازنشانی می‌کند یا افزایش می‌دهد.
- مبدل ارسال پس از هر fan-out، `disableWebhooksWithHighFailures(10)` را فراخوانی می‌کند،
  بنابراین هر وب‌هوک با `failure_count >= 10` به‌طور خودکار غیرفعال می‌شود.

## پایگاه داده

جدول `webhooks` (migration `011_webhooks.sql`):

| ستون                | نوع    | توضیحات                                            |
| ------------------- | ------ | -------------------------------------------------- |
| `id`                | TEXT PK | UUID                                              |
| `url`               | TEXT   | URL مقصد                                           |
| `events`            | TEXT   | آرایه‌ی JSON؛ پیش‌فرض `["*"]`                       |
| `secret`            | TEXT   | secret مربوط به HMAC (در صورت عدم ارائه، خودکار تولید می‌شود) |
| `enabled`           | INT    | ۰/۱؛ پیش‌فرض ۱                                     |
| `description`       | TEXT   | برچسب انسانی اختیاری                              |
| `created_at`        | TEXT   | `datetime('now')`                                  |
| `last_triggered_at` | TEXT   | در هر تلاش تحویل به‌روز می‌شود                     |
| `last_status`       | INT    | وضعیت HTTP آخرین تلاش (۰ = شبکه)                   |
| `failure_count`     | INT    | در موفقیت به ۰ بازنشانی می‌شود، در شکست +۱         |

در schema فعلی **جدول جداگانه‌ی `webhook_deliveries` وجود ندارد** — تاریخچه‌ی تحویل
روی ردیف `webhooks` تجمیع می‌شود. اگر به تاریخچه‌ی ممیزی کامل نیاز دارید، رویدادهای
`request.completed` / `audit` را از یک log store پایین‌دستی مصرف کنید.

## REST API

همه‌ی endpointها نیاز به احراز هویت مدیریتی دارند (`requireManagementAuth`).

| Endpoint                  | Method | توضیحات                         |
| ------------------------- | ------ | ------------------------------- |
| `/api/webhooks`           | GET    | فهرست وب‌هوک‌ها (secret ماسک می‌شود) |
| `/api/webhooks`           | POST   | ایجاد وب‌هوک                    |
| `/api/webhooks/[id]`      | GET    | جزئیات وب‌هوک (secret کامل)     |
| `/api/webhooks/[id]`      | PUT    | به‌روزرسانی فیلدها              |
| `/api/webhooks/[id]`      | DELETE | حذف                             |
| `/api/webhooks/[id]/test` | POST   | ارسال یک `test.ping` (بدون تلاش مجدد) |

`GET /api/webhooks` secret را به `<first 10 chars>...` ماسک می‌کند تا از نشت در
صفحات فهرست جلوگیری شود. وقتی واقعاً به secret نیاز دارید از GET `[id]` استفاده کنید.

### ایجاد وب‌هوک

```bash
curl -X POST http://localhost:20128/api/webhooks \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.slack.com/services/...",
    "secret": "whsec_my_shared_secret",
    "events": ["quota.exceeded", "provider.error"],
    "description": "Slack alerts"
  }'
```

اگر `secret` حذف شود، سرور یک secret `whsec_<hex>` تولید کرده و در پاسخ برمی‌گرداند.

### آزمایش وب‌هوک

```bash
curl -X POST http://localhost:20128/api/webhooks/<id>/test \
  -H "Cookie: auth_token=..."
```

`{ delivered, status, error }` را برمی‌گرداند. هیچ تلاش مجددی انجام نمی‌شود — برای
اعتبارسنجی سریع اینکه گیرنده payload و امضا را می‌پذیرد مفید است.

## داشبورد

صفحه‌ی داشبورد در `/dashboard/webhooks` (به
`src/app/(dashboard)/dashboard/webhooks/page.tsx` مراجعه کنید) ارائه می‌دهد:

- ایجاد/ویرایش وب‌هوک‌ها با انتخاب‌گر رویداد
- نشانگر وضعیت (فعال / غیرفعال / خطادار) بر اساس `enabled`،
  `failure_count` و `last_status`
- آزمایش تحویل با یک کلیک
- تغییر دستی فعال/غیرفعال

## نمونه‌های Payload

### request.completed

```json
{
  "event": "request.completed",
  "timestamp": "2026-05-13T20:30:00.123Z",
  "data": {
    "trace_id": "...",
    "api_key_id": "...",
    "provider": "openai",
    "model": "gpt-5",
    "status": 200,
    "tokens_in": 142,
    "tokens_out": 350,
    "cost_usd": 0.0042
  }
}
```

### provider.error

```json
{
  "event": "provider.error",
  "timestamp": "2026-05-13T20:31:00.000Z",
  "data": {
    "provider": "anthropic",
    "status": 503,
    "consecutive_failures": 5,
    "circuit_state": "open"
  }
}
```

### test.ping

```json
{
  "event": "test.ping",
  "timestamp": "2026-05-13T20:32:00.000Z",
  "data": {
    "message": "Test webhook delivery from OmniRoute",
    "webhookId": "<uuid>"
  }
}
```

ساختار فیلدها برای رویدادهای غیر از `test.ping` توسط siteهای فراخوانی که آن‌ها را
منتشر می‌کنند تعریف می‌شود؛ شیء `data` را forward-compatible در نظر بگیرید (فیلدها
اضافه می‌شوند، به نبود آن‌ها تکیه نکنید).

## بهترین روش‌ها

- **امضا را در هر تحویل تأیید کنید** در برابر بدنه‌ی خام — از POSTهای
  جعلی توسط هرکسی که URL وب‌هوک شما را حدس می‌زند جلوگیری می‌کند.
- **در عرض ~۵ ثانیه با 2xx پاسخ دهید** — مبدل ارسال در ۱۰ ثانیه timeout می‌شود.
  گیرنده‌های کند تلاش‌های مجدد را مصرف کرده و `failure_count` را بالا می‌برند.
- **handlerها را idempotent بسازید** — تلاش‌های مجدد و semantics تحویل at-least-once
  به‌معنای امکان تکرار هستند.
- **حداقل اشتراک بگیرید** — فقط رویدادهایی را فهرست کنید که واقعاً مصرف می‌کنید؛ `"*"`
  روی گیرنده‌هایی که کنترل نمی‌کنید هزینه‌افزایی ایجاد می‌کند.
- **`failure_count` را تحت نظر داشته باشید** — endpointها در ۱۰ شکست متوالی به‌طور
  خودکار غیرفعال می‌شوند؛ پس از تعمیر گیرنده با فراخوانی `PUT /api/webhooks/[id]`
  با `enabled: true` بازنشانی کنید.
- **secretها را به‌طور دوره‌ای چرخش دهید** — یک `secret` جدید با `PUT` بگذارید،
  مقدار جدید را روی گیرنده مستقر کنید و از طریق endpoint آزمایشی تأیید کنید.

## همچنین ببینید

- [API_REFERENCE.md](../reference/API_REFERENCE.md) — کامل‌ترین سطح API مدیریت
- [RESILIENCE_GUIDE.md](../architecture/RESILIENCE_GUIDE.md) — semantics مربوط به circuit breaker / cooldown
  که `provider.error` / `provider.recovered` را هدایت می‌کنند
- منبع: `src/lib/webhookDispatcher.ts`, `src/lib/db/webhooks.ts`
