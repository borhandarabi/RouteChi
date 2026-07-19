# RouteChi Cloud Worker — راهنمای نصب و بهره‌برداری

## فهرست

۱. [معرفی](#۱-معرفی)
۲. [پیش‌نیازها](#۲-پیش‌نیازها)
۳. [نصب دستی](#۳-نصب-دستی)
۴. [تنظیم RouteChi محلی](#۴-تنظیم-routechi-محلی)
۵. [تأیید عملکرد](#۵-تأیید-عملکرد)
۶. [مدیریت و نگهداری](#۶-مدیریت-و-نگهداری)
۷. [عیب‌یابی](#۷-عیب‌یابی)

---

## ۱. معرفی

RouteChi Cloud Worker یک Cloudflare Worker است که به‌عنوان رله‌ی ابری برای RouteChi محلی عمل می‌کند. این Worker:

- تنظیمات و اعتبارنامه‌های RouteChi محلی را دریافت و ذخیره می‌کند (`POST /sync/:machineId`)
- درخواست‌های OpenAI-compatible را از کلاینت‌های distant دریافت کرده و به ارائه‌دهنده‌ی بالادست هدایت می‌کند (`POST /:machineId/v1/chat/completions`)
- با امضای HMAC-SHA256 پاسخ‌ها را تأیید می‌کند

### نحوه‌ی عملکرد

```
RouteChi محلی                          کلاینت distant
    │                                       │
    │  POST /sync/:machineId                │
    │  (bundle: providers, keys, combos)    │
    ├──────────────────────────────────────►│
    │                                       │
    │                       Cloud Worker    │
    │                      ┌──────────────┐ │
    │                      │  ذخیره در KV │ │
    │                      └──────────────┘ │
    │                                       │
    │                  POST /:machineId/v1/chat/completions
    │                  (Bearer sk_omniroute_...)            │
    │                                       ├──────────────►│
    │                                       │               │
    │                                       │  ┌─────────┐  │
    │                                       │  │ upstream│  │
    │                                       │  │ provider│  │
    │                                       │  └────┬────┘  │
    │                                       │       │       │
    │                                       │  ◄────┘       │
    │                                       │  (SSE stream) │
    │                                       ◄───────────────┤
    │                                       │               │
```

---

## ۲. پیش‌نیازها

- حساب Cloudflare (رایگان کافی است)
- `wrangler` CLI نصب‌شده: `npm install -g wrangler`
- Node.js ≥ ۱۸
- RouteChi محلی با Cloud Sync فعال

---

## ۳. نصب دستی

### مرحله ۱: ورود به Cloudflare

```bash
cd cloud-worker
npm install
wrangler login
```

### مرحله ۲: ایجاد KV Namespace

```bash
wrangler kv namespace create BUNDLES
```

خروجی شبیه این خواهد بود:

```
[[kv_namespaces]]
binding = "BUNDLES"
id = "abcd1234efgh5678..."
```

شناسه‌ی `id` را کپی کنید.

### مرحله ۳: تنظیم wrangler.toml

فایل `wrangler.toml` را ویرایش کنید و شناسه‌ی KV را قرار دهید:

```toml
[[kv_namespaces]]
binding = "BUNDLES"
id = "abcd1234efgh5678..."  # ← این را جایگزین کنید

[vars]
CLOUD_SYNC_SECRET = "your-secret-here"  # ← یک رشته‌ی تصادفی ۶۴ کاراکتری
```

تولید secret:

```bash
openssl rand -hex 32
```

### مرحله ۴: استقرار Worker

```bash
wrangler deploy
```

خروجی آدرس Worker را نشان می‌دهد:

```
Deployed routechi-cloud to https://routechi-cloud.<your-subdomain>.workers.dev
```

### مرحله ۵: (اختیاری) دامنه‌ی اختصاصی

برای استفاده از دامنه‌ی خود:

```toml
# در wrangler.toml اضافه کنید:
routes = [
  { pattern = "cloud.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

سپس `wrangler deploy` را دوباره اجرا کنید.

---

## ۴. تنظیم RouteChi محلی

در فایل `.env` یا تنظیمات محیطی RouteChi:

```bash
# آدرس Worker (بدون / در انتها)
CLOUD_URL=https://routechi-cloud.your-subdomain.workers.dev

# همان secret که در wrangler.toml تنظیم کردید
OMNIROUTE_CLOUD_SYNC_SECRET=your-secret-here

# (اختیاری) همگام‌سازی اعتبارنامه‌های OAuth
OMNIROUTE_CLOUD_SYNC_SECRETS=true
```

سپس در داشبورد RouteChi:
1. به **Settings → Cloud Sync** بروید
2. **Enable Cloud** را کلیک کنید
3. آدرس ابری نمایش داده می‌شود: `https://routechi-cloud...workers.dev/<machineId>`
4. کلاینت‌های distant می‌توانند از این آدرس با کلید API RouteChi استفاده کنند

---

## ۵. تأیید عملکرد

### تست verify

```bash
# machineId و apiKey را با مقادیر واقعی جایگزین کنید
curl -s https://routechi-cloud.your-subdomain.workers.dev/<machineId>/v1/verify \
  -H "Authorization: Bearer sk_omniroute_..." | python3 -m json.tool
```

خروجی مورد انتظار:

```json
{
  "success": true,
  "machineId": "abcd1234efgh5678",
  "version": "sha256-hash...",
  "providerCount": 3,
  "apiKeyCount": 1,
  "syncedAt": "2026-07-19T..."
}
```

### تست chat completions

```bash
curl -s https://routechi-cloud.your-subdomain.workers.dev/<machineId>/v1/chat/completions \
  -H "Authorization: Bearer sk_omniroute_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }' | python3 -m json.tool
```

### تست streaming

```bash
curl -N https://routechi-cloud.your-subdomain.workers.dev/<machineId>/v1/chat/completions \
  -H "Authorization: Bearer sk_omniroute_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### تست مدل‌ها

```bash
curl -s https://routechi-cloud.your-subdomain.workers.dev/<machineId>/v1/models \
  -H "Authorization: Bearer sk_omniroute_..." | python3 -m json.tool
```

---

## ۶. مدیریت و نگهداری

### مشاهده‌ی لاگ‌ها

```bash
wrangler tail
```

### پاک‌سازی KV

برای حذف bundle یک machineId خاص:

```bash
wrangler kv key delete --binding=BUNDLES "bundle:<machineId>"
```

### به‌روزرسانی Worker

```bash
cd cloud-worker
git pull
wrangler deploy
```

### تغییر secret

۱. `wrangler.toml` را ویرایش کنید و `CLOUD_SYNC_SECRET` جدید را قرار دهید
۲. `wrangler deploy` را اجرا کنید
۳. در RouteChi محلی، `OMNIROUTE_CLOUD_SYNC_SECRET` را با همان مقدار به‌روزرسانی کنید
۴. RouteChi را ریستارت کنید

### ذخیره‌سازی secret به‌صورت امن

به‌جای قرار دادن secret در `wrangler.toml` (که در Git ذخیره می‌شود):

```bash
wrangler secret put CLOUD_SYNC_SECRET
# مقدار secret را وارد کنید
```

---

## ۷. عیب‌یابی

### خطای "Bundle not found — sync first"

Worker bundle را در KV پیدا نکرده. اطمینان حاصل کنید:
- `CLOUD_URL` درست تنظیم شده
- Cloud Sync در داشبورد فعال شده
- `POST /sync/:machineId` با موفقیت اجرا شده (لاگ RouteChi را بررسی کنید)

### خطای "Authorization failed: invalid API key"

کلید API در درخواست با کلیدهای ذخیره‌شده در bundle مطابقت ندارد. اطمینان حاصل کنید:
- از همان کلید API استفاده می‌کنید که در داشبورد RouteChi نمایش داده می‌شود
- bundle به‌روز است (sync را دوباره اجرا کنید)

### خطای "Upstream fetch failed"

Worker نتوانست به ارائه‌دهنده‌ی بالادست وصل شود. بررسی کنید:
- ارائه‌دهنده در bundle فعال است (`isActive !== false`)
- `apiKey` یا `accessToken` معتبر است
- آدرس base URL ارائه‌دهنده درست است

### خطای "Cloud sync signature verification failed"

کلاینت امضای HMAC را تأیید نکرده. بررسی کنید:
- `OMNIROUTE_CLOUD_SYNC_SECRET` در RouteChi محلی با `CLOUD_SYNC_SECRET` در Worker یکسان است
- اگر secret خالی است (حالت backward-compat)، این هشدار عادی است و در v3.9 اجباری می‌شود

### خطای 429 از upstream

ارائه‌دهنده‌ی بالادست rate-limit اعمال کرده. Worker retry نمی‌کند — این وظیفه‌ی کلاینت است. در صورت تکرار:
- از چندین ارائه‌دهنده در bundle استفاده کنید
- combo با fallback در RouteChi محلی تنظیم کنید
