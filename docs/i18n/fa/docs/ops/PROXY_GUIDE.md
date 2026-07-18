---
title: "🌐 راهنمای پراکسی RouteChi"
version: 3.8.40
lastUpdated: 2026-06-28
---

# 🌐 راهنمای پراکسی RouteChi

> **دور زدن مسدودسازی جغرافیایی، محافظت از هویت و مسیریابی ترافیک هوش مصنوعی ازطریق هر پراکسی — بدون هیچ پیچیدگی پیکربندی.**

RouteChi شامل یک سیستم مدیریت پراکسی کامل است که به شما اجازه می‌دهد ترافیک بالادست ارائه‌دهنده‌های هوش مصنوعی را ازطریق پراکسی‌های HTTP، HTTPS یا SOCKS5 مسیریابی کنید. چه در منطقه‌ای مسدودشده باشید، چه به چرخش IP نیاز داشته باشید و چه به انگشت‌نگاری پنهان (stealth) علاقه‌مند باشید — این راهنما همه‌چیز را پوشش می‌دهد.

---

## فهرست مطالب

- [چرا از پراکسی استفاده کنیم؟](#why-use-proxies)
- [نمای کلی معماری](#architecture-overview)
- [سیستم پراکسی ۴ سطحی](#4-level-proxy-system)
- [رجیستری پراکسی (CRUD)](#proxy-registry-crud)
- [بازار رایگان 1proxy](#1proxy-free-proxy-marketplace)
- [چرخش پراکسی](#proxy-rotation)
- [ضد‌تشخیص و پنهان‌کاری](#anti-detection--stealth)
- [حالت‌های پراکسی بالادست](#upstream-proxy-modes)
- [رابط کاربری داشبورد](#dashboard-ui)
- [مرجع API](#api-reference)
- [متغیرهای محیطی](#environment-variables)
- [عیب‌یابی](#troubleshooting)

---

## چرا از پراکسی استفاده کنیم؟

بسیاری از ارائه‌دهنده‌های هوش مصنوعی دسترسی را بر اساس منطقهٔ جغرافیایی محدود می‌کنند. توسعه‌دهندگان در **روسیه، چین، ایران، کوبا، ترکیه** و سایر کشورها با خطاهایی مانند زیر مواجه می‌شوند:

```
unsupported_country_region_territory
```

حتی خارج از مناطق مسدودشده، پراکسی برای موارد زیر مفید است:

| مورد استفاده             | توصیف                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| **دور زدن جغرافیایی**    | دسترسی به OpenAI، Anthropic، Codex، Copilot از کشورهای مسدودشده      |
| **چرخش IP**              | توزیع درخواست‌ها روی چند IP برای جلوگیری از rate limiting            |
| **حریم خصوصی**           | پنهان‌کردن IP واقعی شما از ارائه‌دهنده‌های بالادست                   |
| **تطابق قانونی**         | مسیریابی ترافیک ازطریق حوزه‌های قضایی مشخص                            |
| **آزمایش**               | شبیه‌سازی درخواست‌ها از مناطق مختلف                                  |

---

## نمای کلی معماری

```
┌───────────────────────────────────────────────────────────────┐
│                       RouteChi Server                        │
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Proxy       │    │ Proxy        │    │ Proxy            │  │
│  │ Registry    │───▶│ Dispatcher   │───▶│ Fetch (undici)   │  │
│  │ (SQLite)    │    │ (cached)     │    │                  │  │
│  └─────────────┘    └──────────────┘    └────────┬─────────┘  │
│         ▲                                        │            │
│         │                                        ▼            │
│  ┌──────┴──────┐                        ┌──────────────────┐  │
│  │ 1proxy Sync │                        │ Upstream         │  │
│  │ (free pool) │                        │ Provider API     │  │
│  └─────────────┘                        └──────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### مؤلفه‌های کلیدی

| مؤلفه                  | فایل                                         | نقش                                                          |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| **رجیستری پراکسی**     | `src/lib/db/proxies.ts`                      | CRUD برای ورودی‌های پراکسی + تخصیص اسکوپ                     |
| **پراکسی دیسپچر**      | `open-sse/utils/proxyDispatcher.ts`          | ساخت دیسپچرهای ProxyAgent/SOCKS در undici با کش              |
| **Proxy Fetch**        | `open-sse/utils/proxyFetch.ts`               | پیچاندن `fetch()` با تزریق دیسپچر پراکسی                     |
| **مسیر تنظیمات**       | `src/app/api/settings/proxy/route.ts`        | API پیکربندی پراکسی قدیمی (GET/PUT/DELETE)                   |
| **مسیر مدیریت**        | `src/app/api/v1/management/proxies/route.ts` | API CRUD رجیستری (GET/POST/PATCH/DELETE)                     |
| **پایگاه‌دادهٔ 1proxy** | `src/lib/db/oneproxy.ts`                     | ماندگاری بازار پراکسی رایگان                                 |
| **همگام‌سازی 1proxy**   | `src/lib/oneproxySync.ts`                    | دریافت پراکسی‌ها از API 1proxy                              |
| **چرخش‌دهندهٔ 1proxy**   | `src/lib/oneproxyRotator.ts`                 | استراتژی‌های چرخش (کیفیت/تصادفی/ترتیبی)                      |

---

## سیستم پراکسی ۴ سطحی

RouteChi از پیکربندی پراکسی در **چهار اسکوپ مستقل** پشتیبانی می‌کند که به‌ترتیب اولویت حل می‌شوند:

```
Priority Resolution Order (highest → lowest):

  1. 🔵 Account/Connection Proxy  →  per API key / OAuth connection
  2. 🟡 Provider Proxy            →  per provider (e.g., all OpenAI traffic)
  3. 🟠 Combo Proxy               →  per combo/routing configuration
  4. 🟢 Global Proxy              →  all traffic, all providers
```

### نحوهٔ کارکرد حل و فصل

هنگامی که RouteChi درخواستی به یک ارائه‌دهندهٔ بالادست می‌فرستد، `resolveProxyForConnectionFromRegistry()` را فراخوانی می‌کند که هر سطح را به‌ترتیب بررسی می‌کند:

1. **سطح حساب** — آیا پراکسی به این شناسهٔ اتصال مشخص تخصیص یافته است؟
2. **سطح ارائه‌دهنده** — آیا پراکسی به این ارائه‌دهنده (مثلاً `openai`) تخصیص یافته است؟
3. **سطح سراسری** — آیا پراکسی سراسری پیکربندی شده است؟
4. **بدون پراکسی** — اتصال مستقیم به ارائه‌دهنده.

اولین تطبیق برنده می‌شود. این یعنی می‌توانید یک پراکسی سراسری به‌عنوان fallback تعیین کنید اما برای ارائه‌دهنده‌ها یا اتصال‌های مشخص آن را بازنویسی کنید.

### چه چیزی پراکسی می‌شود

| نوع ترافیک             | پراکسی؟ | یادداشت                                       |
| ---------------------- | ------- | --------------------------------------------- |
| تکمیل چت               | ✅      | همهٔ درخواست‌های `/v1/chat/completions`       |
| Embeddings             | ✅      | `/v1/embeddings`                              |
| تولید تصویر            | ✅      | `/v1/images/generations`                      |
| صوت (TTS/STT)          | ✅      | `/v1/audio/*`                                 |
| تبادل توکن OAuth       | ✅      | حل `unsupported_country_region_territory`     |
| آزمایش اتصال           | ✅      | دکمهٔ «Test Connection» از پراکسی استفاده می‌کند |
| refresh توکن           | ✅      | نوسازی OAuth در پس‌زمینه                       |
| همگام‌سازی مدل          | ✅      | فهرست‌کردن و کشف مدل                          |

---

## رجیستری پراکسی (CRUD)

رجیستری پراکسی یک جدول SQLite (`proxy_registry`) است که همهٔ پراکسی‌های شما را ذخیره می‌کند. هر پراکسی دارای:

| فیلد       | نوع     | توصیف                                |
| ---------- | ------- | ------------------------------------ |
| `id`       | UUID    | شناسهٔ یکتا                          |
| `name`     | String  | برچسب قابل‌خواندن توسط انسان         |
| `type`     | String  | پروتکل: `http`، `https`، `socks5`    |
| `host`     | String  | نام میزبان یا IP پراکسی              |
| `port`     | Integer | شمارهٔ پورت                          |
| `username` | String  | نام کاربری احراز (رمزنگاری در حال ساکن) |
| `password` | String  | گذرواژهٔ احراز (رمزنگاری در حال ساکن) |
| `region`   | String  | برچسب منطقهٔ جغرافیایی               |
| `notes`    | String  | یادداشت‌های متن آزاد                 |
| `status`   | String  | `active` یا `inactive`               |
| `source`   | String  | `manual` یا `oneproxy`               |

### ایجاد یک پراکسی

**ازطریق داشبورد:**

1. به **Settings → Proxy** بروید
2. روی **Add Proxy** کلیک کنید
3. نوع، میزبان، پورت و در صورت نیاز اعتبارنامه‌ها را پر کنید
4. ذخیره کنید

**ازطریق API:**

```bash
curl -X POST http://localhost:20128/api/v1/management/proxies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "US Proxy",
    "type": "http",
    "host": "proxy.example.com",
    "port": 8080,
    "username": "user",
    "password": "pass",
    "region": "US"
  }'
```

### به‌روزرسانی یک پراکسی

```bash
curl -X PATCH http://localhost:20128/api/v1/management/proxies \
  -H "Content-Type: application/json" \
  -d '{
    "id": "proxy-uuid-here",
    "host": "new-proxy.example.com",
    "port": 9090
  }'
```

> **یادداشت:** اعتبارنامه‌ها حفظ می‌شوند مگر آنکه به‌صراحت جایگزینی‌های غیرخالی بفرستید. ارسال رشته‌های خالی برای `username`/`password` مقادیر ذخیره‌شده را نگه می‌دارد.

### حذف یک پراکسی

```bash
# Fails if proxy is assigned to any scope
curl -X DELETE "http://localhost:20128/api/v1/management/proxies?id=proxy-uuid"

# Force delete (removes assignments too)
curl -X DELETE "http://localhost:20128/api/v1/management/proxies?id=proxy-uuid&force=1"
```

### فهرست‌کردن پراکسی‌ها

```bash
curl "http://localhost:20128/api/v1/management/proxies?limit=50&offset=0"
```

### تخصیص پراکسی به اسکوپ‌ها

```bash
# Assign to global scope
curl -X PUT http://localhost:20128/api/settings/proxy \
  -H "Content-Type: application/json" \
  -d '{"level": "global", "proxy": {"type":"http","host":"proxy.example.com","port":8080}}'

# Assign to a specific provider
curl -X PUT http://localhost:20128/api/settings/proxy \
  -H "Content-Type: application/json" \
  -d '{"level": "provider", "id": "openai", "proxy": {"type":"socks5","host":"socks.example.com","port":1080}}'

# Assign to a specific connection/key
curl -X PUT http://localhost:20128/api/settings/proxy \
  -H "Content-Type: application/json" \
  -d '{"level": "key", "id": "connection-uuid", "proxy": {"type":"http","host":"key-proxy.com","port":3128}}'
```

### حل پراکسی مؤثر

بررسی کنید کدام پراکسی برای یک اتصال مشخص استفاده می‌شود:

```bash
curl "http://localhost:20128/api/settings/proxy?resolve=connection-uuid"
```

پراکسی حل‌شده به‌همراه سطح (`account`، `provider` یا `global`) و منبع آن بازمی‌گردد.

### تخصیص گروهی

یک پراکسی را به‌یکباره به چند ارائه‌دهنده یا اتصال تخصیص دهید:

```bash
curl -X POST http://localhost:20128/api/v1/management/proxies/bulk-assign \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "provider",
    "scopeIds": ["openai", "anthropic", "codex"],
    "proxyId": "proxy-uuid"
  }'
```

### ورودی/خروجی

پراکسی‌ها در سیستم **Backup/Restore** گنجانده شده‌اند. هنگامی که پیکربندی RouteChi را خروجی می‌گیرید:

1. به **Dashboard → Settings → Backup** بروید
2. روی **Export** کلیک کنید — رجیستری پراکسی و تخصیص‌ها شامل می‌شوند
3. برای بازیابی، روی **Import** کلیک کنید و فایل پشتیبان را بارگذاری کنید

رجیستری پراکسی همچنین از **upsert بر اساس host+port** پشتیبانی می‌کند — اگر پراکسی‌ای که از قبل وجود دارد (همان host و port) را وارد کنید، به‌جای ایجاد نسخهٔ تکراری، به‌روزرسانی می‌شود.

### مهاجرت قدیمی

اگر در نسخهٔ قدیمی (پیش از رجیستری) پراکسی پیکربندی کرده‌اید، RouteChi به‌طور خودکار آن‌ها را مهاجرت می‌دهد:

```
Legacy key_value store → proxy_registry + proxy_assignments
```

این کار یک‌بار در اولین راه‌اندازی پس از ارتقا انجام می‌شود. از `migrateLegacyProxyConfigToRegistry({ force: true })` برای اجرای مجدد استفاده کنید.

---

## بازار پراکسی رایگان 1proxy

> 🆕 **مشارکت‌شده توسط [@oyi77](https://github.com/oyi77)** — PR [#1847](https://github.com/borhandarabi/routechi/pull/1847) (Issue [#1788](https://github.com/borhandarabi/routechi/issues/1788))

RouteChi با پلتفرم انجمنی **[1proxy](https://1proxy-api.aitradepulse.com)** یکپارچه می‌شود تا دسترسی به **صدها پراکسی رایگان و معتبر** از سراسر جهان را فراهم کند. این برای کاربرانی که زیرساخت پراکسی اختصاصی ندارند عالی است.

### نحوهٔ کارکرد

```
┌─────────────┐     Sync      ┌─────────────────┐    Rotate     ┌──────────┐
│  1proxy API │ ────────────▶ │  proxy_registry  │ ────────────▶ │ Provider │
│  (external) │   up to 500   │  source=oneproxy │  by quality   │   API    │
└─────────────┘    proxies    └─────────────────┘               └──────────┘
```

1. **همگام‌سازی** — RouteChi پراکسی‌های معتبر را از API 1proxy دریافت می‌کند
2. **ذخیره** — پراکسی‌ها در همان جدول `proxy_registry` با `source = 'oneproxy'` ذخیره می‌شوند
3. **فیلتر** — بر اساس پروتکل، کشور یا نمرهٔ کیفیت
4. **چرخش** — انتخاب بهترین پراکسی با استراتژی کیفیت، تصادفی یا ترتیبی
5. **تنزل خودکار** — پراکسی‌های ناموفق نمرهٔ کیفیت پایین‌تری می‌گیرند؛ زیر آستانه → غیرفعال می‌شوند

### همگام‌سازی پراکسی‌ها

**ازطریق داشبورد:**

1. به **Settings → 1proxy** tab بروید
2. روی **"Sync Now"** کلیک کنید
3. مشاهدهٔ آمار: مجموع پراکسی‌ها، تعداد فعال، میانگین کیفیت، تفکیک بر اساس کشور

**ازطریق API:**

```bash
# Trigger sync
curl -X POST http://localhost:20128/api/settings/oneproxy \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
# { "success": true, "added": 127, "updated": 45, "failed": 2, "total": 172 }
```

### فیلتر کردن پراکسی‌ها

```bash
# Filter by protocol
curl "http://localhost:20128/api/settings/oneproxy?protocol=socks5"

# Filter by country
curl "http://localhost:20128/api/settings/oneproxy?countryCode=US"

# Filter by minimum quality score
curl "http://localhost:20128/api/settings/oneproxy?minQuality=80"

# Combine filters
curl "http://localhost:20128/api/settings/oneproxy?protocol=http&countryCode=DE&minQuality=70"
```

### نمرات کیفیت پراکسی

هر پراکسی 1proxy دارای فراداده است:

| فیلد             | توصیف                                              |
| ---------------- | -------------------------------------------------- |
| `qualityScore`   | نمرهٔ ۰ تا ۱۰۰ از اعتبارسنجی 1proxy                |
| `latencyMs`      | تأخیر شبکهٔ اندازه‌گیری‌شده                        |
| `anonymity`      | `transparent`، `anonymous` یا `elite`              |
| `googleAccess`   | آیا پراکسی می‌تواند به سرویس‌های گوگل دسترسی یابد |
| `countryCode`    | کد کشور دو حرفی ISO                                |
| `lastValidated`  | timestamp آخرین اعتبارسنجی                         |

نمرات کیفیت به‌صورت پویا تنظیم می‌شوند:

- **درخواست‌های ناموفق** نمره را ۱۰ امتیاز کاهش می‌دهند
- **نمره به ≤۱۰ می‌رسد** → پراکسی `inactive` می‌شود
- پراکسی‌های غیرفعال از چرخش حذف می‌شوند

### استراتژی‌های چرخش

```bash
# Rotate by quality (best proxy first) — default
curl -X POST http://localhost:20128/api/settings/oneproxy/rotate \
  -H "Content-Type: application/json" \
  -d '{"strategy": "quality"}'

# Random rotation
curl -X POST http://localhost:20128/api/settings/oneproxy/rotate \
  -d '{"strategy": "random"}'

# Sequential (least recently validated first)
curl -X POST http://localhost:20128/api/settings/oneproxy/rotate \
  -d '{"strategy": "sequential"}'
```

### مدارشکن

همگام‌سازی 1proxy دارای مدارشکن داخلی است:

- پس از **۵ شکست متوالی همگام‌سازی**، تلاش‌های بعدی مسدود می‌شوند
- بازنشانی با: `resetOneproxyCircuitBreaker()` یا راه‌اندازی مجدد سرور
- وضعیت همگام‌سازی در `GET /api/settings/oneproxy?action=status` قابل دسترسی است

### پاک‌کردن پراکسی‌های 1proxy

```bash
# Delete a single 1proxy proxy
curl -X DELETE "http://localhost:20128/api/settings/oneproxy?id=proxy-uuid"

# Clear ALL 1proxy proxies (manual proxies are untouched)
curl -X DELETE "http://localhost:20128/api/settings/oneproxy?clearAll=1"
```

---

## ضد‌تشخیص و پنهان‌کاری

RouteChi فقط ترافیک را ازطریق پراکسی مسیریابی نمی‌کند — بلکه ترافیک را مشروع جلوه می‌دهد:

### جعل انگشت‌نگاری TLS

از `wreq-js` برای تولید انگشت‌نگاری TLS شبیه به مرورگر استفاده می‌شود که سیستم‌های تشخیص ربات که handshakeهای TLS غیر مرورگری را علامت‌گذاری می‌کنند را دور می‌زند.

### تطبیق انگشت‌نگاری CLI

**CLI Fingerprint Toggle** (`Settings → Security`) سرآیندهای HTTP و فیلدهای بدنهٔ JSON را بازترتیب می‌کند تا دقیقاً با امضای باینری‌های CLI بومی (Claude Code، Codex و غیره) تطابق کند. این **به‌علاوهٔ** پراکسی کار می‌کند:

```
Your IP (blocked) → Proxy IP (US) → Provider API
                    + TLS spoof
                    + CLI fingerprint
```

شما همزمان **پنهان‌کردن IP** و **اصالت درخواست** را به‌دست می‌آورید.

### حفظ IP پراکسی

نشان‌های رنگی در داشبورد نشان می‌دهند کدام سطح پراکسی فعال است:

| نشان | سطح       | معنی                                       |
| ---- | --------- | ------------------------------------------ |
| 🟢   | سراسری    | همهٔ ترافیک ازطریق این پراکسی می‌رود       |
| 🟡   | ارائه‌دهنده | فقط ترافیک این ارائه‌دهنده پراکسی می‌شود |
| 🔵   | اتصال     | این کلید/حساب مشخص از این پراکسی استفاده می‌کند |

نشان همچنین IP پراکسی حل‌شده را برای راستی‌آزمایی نمایش می‌دهد.

---

## حالت‌های پراکسی بالادست

برای ارائه‌دهنده‌هایی که از الگوی CLIProxyAPI استفاده می‌کنند، RouteChi سه حالت پراکسی بالادست پشتیبانی می‌کند:

| حالت          | توصیف                                                     |
| ------------- | --------------------------------------------------------- |
| `native`      | RouteChi مستقیماً مسیریابی پراکسی را مدیریت می‌کند (پیش‌فرض) |
| `cliproxyapi` | واگذاری به یک نمونهٔ خارجی CLIProxyAPI                    |
| `fallback`    | ابتدا native، سپس بازگشت به CLIProxyAPI                   |

برای هر ارائه‌دهنده پیکربندی کنید:

```bash
curl -X PUT "http://localhost:20128/api/upstream-proxy/openai" \
  -H "Content-Type: application/json" \
  -d '{"mode": "native", "enabled": true}'
```

---

## رابط کاربری داشبورد

### Settings → Proxy Tab

- پیکربندی **پراکسی سراسری** (یک‌بار برای همهٔ ترافیک)
- بازنویسی‌های **پراکسی هر ارائه‌دهنده**
- تخصیص‌های **پراکسی هر اتصال**
- **آزمایش اتصال** ازطریق پراکسی پیکربندی‌شده
- **نشان‌های رنگی** که سطح پراکسی فعال را نشان می‌دهند

### Settings → 1proxy Tab

- دکمهٔ **Sync Now** برای دریافت پراکسی‌های رایگان
- **کارت‌های آمار**: مجموع، فعال، میانگین کیفیت، آخرین همگام‌سازی
- **فیلترها**: پروتکل، کد کشور، حداقل کیفیت
- **جدول پراکسی** با host، پروتکل، کشور، نمرهٔ کیفیت، تأخیر، ناشناسی، دسترسی گوگل
- پنل **وضعیت همگام‌سازی** با ردیابی موفقیت/شکست و شمارش شکست متوالی
- **Clear All** برای حذف همهٔ ورودی‌های 1proxy

---

## مرجع API

### API تنظیمات پراکسی

| روش      | نقطهٔ پایانی                                   | توصیف                  |
| -------- | ---------------------------------------------- | ---------------------- |
| `GET`    | `/api/settings/proxy`                          | دریافت پیکربندی کامل   |
| `GET`    | `/api/settings/proxy?level=global`             | دریافت پراکسی سراسری   |
| `GET`    | `/api/settings/proxy?level=provider&id=openai` | دریافت پراکسی ارائه‌دهنده |
| `GET`    | `/api/settings/proxy?resolve=connectionId`     | حل پراکسی مؤثر         |
| `PUT`    | `/api/settings/proxy`                          | به‌روزرسانی پیکربندی   |
| `DELETE` | `/api/settings/proxy?level=provider&id=openai` | حذف پراکسی در سطح      |

### API رجیستری پراکسی

| روش      | نقطهٔ پایانی                                      | توصیف                       |
| -------- | ------------------------------------------------- | --------------------------- |
| `GET`    | `/api/v1/management/proxies`                      | فهرست همهٔ پراکسی‌ها        |
| `GET`    | `/api/v1/management/proxies?id=uuid`              | دریافت پراکسی با ID         |
| `GET`    | `/api/v1/management/proxies?id=uuid&where_used=1` | دریافت تخصیص‌های پراکسی     |
| `POST`   | `/api/v1/management/proxies`                      | ایجاد پراکسی                |
| `PATCH`  | `/api/v1/management/proxies`                      | به‌روزرسانی پراکسی          |
| `DELETE` | `/api/v1/management/proxies?id=uuid`              | حذف پراکسی                  |
| `DELETE` | `/api/v1/management/proxies?id=uuid&force=1`      | حذف اجباری                  |
| `POST`   | `/api/v1/management/proxies/bulk-assign`          | تخصیص گروهی                 |
| `GET`    | `/api/v1/management/proxies/assignments`          | فهرست تخصیص‌ها             |
| `GET`    | `/api/v1/management/proxies/health`               | آمار سلامت پراکسی          |

### API تونل‌ها

برای در معرض دید عمومی قرار دادن نمونهٔ RouteChi (Cloudflare/ngrok/Tailscale) به‌جای مسیریابی خروجی ازطریق پراکسی، ر.ک. [TUNNELS_GUIDE.md](./TUNNELS_GUIDE.md). REST API تونل در `/api/tunnels/{cloudflared,ngrok,tailscale}/*` قرار دارد و مستقل از زنجیرهٔ پراکسی خروجی است که در بالا مستند شده.

### API 1proxy

| روش      | نقطهٔ پایانی                          | توصیف                      |
| -------- | -------------------------------------- | -------------------------- |
| `GET`    | `/api/settings/oneproxy`               | فهرست پراکسی‌های 1proxy   |
| `GET`    | `/api/settings/oneproxy?action=stats`  | دریافت آمار + وضعیت همگام‌سازی |
| `GET`    | `/api/settings/oneproxy?action=status` | فقط وضعیت همگام‌سازی      |
| `POST`   | `/api/settings/oneproxy`               | راه‌اندازی همگام‌سازی      |
| `POST`   | `/api/settings/oneproxy/rotate`        | چرخش به پراکسی بعدی        |
| `DELETE` | `/api/settings/oneproxy?id=uuid`       | حذف یکی                    |
| `DELETE` | `/api/settings/oneproxy?clearAll=1`    | پاک‌کردن همه               |

### API پراکسی بالادست

| روش      | نقطهٔ پایانی                       | توصیف                       |
| -------- | ---------------------------------- | --------------------------- |
| `GET`    | `/api/upstream-proxy/:providerId`  | دریافت پیکربندی پراکسی بالادست |
| `PUT`    | `/api/upstream-proxy/:providerId`  | تنظیم حالت پراکسی بالادست   |
| `DELETE` | `/api/upstream-proxy/:providerId`  | حذف پیکربندی پراکسی بالادست |

---

## متغیرهای محیطی

| متغیر                            | پیش‌فرض                              | توصیف                                                          |
| -------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `ENABLE_SOCKS5_PROXY`            | `true`                               | فعال‌سازی پشتیبانی پراکسی SOCKS5 (پیش‌فرض `true` در `.env.example`) |
| `ONEPROXY_ENABLED`               | `true`                               | فعال‌سازی یکپارچگی 1proxy                                     |
| `ONEPROXY_API_URL`               | `https://1proxy-api.aitradepulse.com`| نقطهٔ پایانی API 1proxy                                       |
| `ONEPROXY_MAX_PROXIES`           | `500`                                | حداکثر پراکسی‌ها برای همگام‌سازی                             |
| `ONEPROXY_MIN_QUALITY_THRESHOLD` | `50`                                 | حداقل نمرهٔ کیفیت برای وارد کردن                              |

---

## عیب‌یابی

### «SOCKS5 proxy is disabled»

`ENABLE_SOCKS5_PROXY=true` را در فایل `.env` تنظیم کنید و راه‌اندازی مجدد کنید.

### خطاهای «socket hang up» ازطریق پراکسی

این با پراکسی‌های ارزان‌قیمتی که اتصال‌های بیکار را قطع می‌کنند طبیعی است. RouteChi این را ازطریق موارد زیر مدیریت می‌کند:

- غیرفعال‌کردن keep-alive روی اتصال‌های پراکسی (`keepAliveTimeout: 1`)
- غیرفعال‌کردن pipelining (`pipelining: 0`)
- کش کردن دیسپچرها برای جلوگیری از handshakeهای مکرر

اگر ادامه یافت، پراکسی متفاوتی را امتحان کنید یا از قابلیت چرخش 1proxy استفاده کنید.

### «unsupported_country_region_territory» در طول OAuth

مطمئن شوید پراکسی **پیش از** شروع جریان OAuth پیکربندی شده است. RouteChi تبادل توکن OAuth را ازطریق پراکسی پیکربندی‌شده مسیریابی می‌کند. ابتدا یک پراکسی سراسری یا سطح ارائه‌دهنده تنظیم کنید، سپس اتصال دهید.

### پراکسی استفاده نمی‌شود

ترتیب حل را بررسی کنید:

1. با `GET /api/settings/proxy?resolve=your-connection-id` راستی‌آزمایی کنید
2. بررسی کنید آیا `status` پراکسی `active` است (نه `inactive`)
3. مطمئن شوید اسکوپ تخصیص پراکسی با اتصال شما مطابقت دارد

### شکست همگام‌سازی 1proxy

وضعیت همگام‌سازی را بررسی کنید:

```bash
curl "http://localhost:20128/api/settings/oneproxy?action=status"
```

اگر `consecutiveFailures >= 5`، مدارشکن فعال شده است. برای بازنشانی سرور را restart کنید یا منتظر بازنشانی دستی بمانید.

---

## شِمای پایگاه‌داده

### جدول `proxy_registry`

```sql
CREATE TABLE proxy_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'http',
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT DEFAULT '',
  password TEXT DEFAULT '',
  region TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'manual',    -- 'manual' or 'oneproxy'
  quality_score INTEGER,                     -- 0-100 (1proxy only)
  latency_ms INTEGER,                        -- milliseconds (1proxy only)
  anonymity TEXT,                            -- transparent/anonymous/elite
  google_access INTEGER DEFAULT 0,           -- can access Google? (1proxy)
  last_validated TEXT,                       -- ISO timestamp (1proxy)
  country_code TEXT,                         -- ISO 2-letter code (1proxy)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### جدول `proxy_assignments`

```sql
CREATE TABLE proxy_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proxy_id TEXT NOT NULL REFERENCES proxy_registry(id),
  scope TEXT NOT NULL,        -- 'global', 'provider', 'account', 'combo'
  scope_id TEXT,              -- provider ID, connection ID, or combo ID
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope, scope_id)
);
```

---

## بررسی سلامت پراکسی (v3.8.16+)

مکانیزم **شکست‌سریع پراکسی** RouteChi (`src/lib/proxyHealth.ts`) پراکسی‌های مرده را در کمتر از ۲ ثانیه ازطریق یک بررسی سریع اتصال TCP تشخیص می‌دهد و سپس **نتیجه را کش می‌کند** تا از سربار هر درخواست جلوگیری شود.

### نحوهٔ کارکرد

```
Request ──▶ ProxyHealthCache.get(url)
             │
             ├─ Cache hit + fresh?  ──▶ return cached status
             │
             └─ Cache miss / stale?  ──▶ TCP connect to host:port
                                          (timeout: FAST_FAIL_TIMEOUT_MS)
                                          ──▶ cache for HEALTH_CACHE_TTL_MS
                                          ──▶ return result
```

بدون این مکانیزم، یک پراکسی مرده هر درخواست را برای کل `PROXY_TIMEOUT_MS` (پیش‌فرض ۳۰ ثانیه) قبل از شکست مسدود می‌کرد.

### متغیرهای محیطی قابل تنظیم

| متغیر                        | پیش‌فرض | هدف                                       |
| ---------------------------- | ------- | ----------------------------------------- |
| `PROXY_FAST_FAIL_TIMEOUT_MS` | `2000`  | timeout اتصال TCP هر بررسی سلامت         |
| `PROXY_HEALTH_CACHE_TTL_MS`  | `30000` | مدت زمان کش نتیجهٔ سلامت                 |

**مقادیر پیشنهادی:**

| سناریو                       | timeout شکست‌سریع | TTL کش    | استدلال                                                          |
| ---------------------------- | ----------------- | --------- | ---------------------------------------------------------------- |
| گیتوی API با توان بالا       | ۱۵۰۰ms            | ۶۰۰۰۰ms   | شکست‌سریع تهاجمی، کش طولانی‌تر برای کاهش بررسی‌ها               |
| گره‌های توزیع‌شده جغرافیایی  | ۳۰۰۰ms            | ۱۵۰۰۰ms   | شبکه‌های کندتر زمان بیشتری نیاز دارند؛ کش کوتاه‌تر برای failover سریع |
| توسعه / آزمایش               | ۱۰۰۰ms            | ۱۰۰۰۰ms   | تکرار سریع روی پراکسی‌های محلی                                  |
| پنهان‌کاری / ضد‌تشخیص        | ۲۵۰۰ms            | ۴۵۰۰۰ms   | اجتناب از probing سریع که می‌تواند rate limit را فعال کند       |

### بررسی سلامت پراکسی

```ts
import { getAllProxyHealthStatuses, invalidateProxyHealth } from "routechi/proxyHealth";

const statuses = getAllProxyHealthStatuses();
for (const s of statuses) {
  console.log(`${s.proxyUrl} → healthy=${s.healthy}, stale=${s.stale}`);
}

// Force re-check a specific proxy
invalidateProxyHealth("http://user:pass@1.2.3.4:8080");
```

پرچم `stale` زمانی `true` است که ورودی کش از `HEALTH_CACHE_TTL_MS` فراتر کرده باشد و درخواست بعدی یک بررسی تازه راه‌اندازی کند.

### پیش‌فرض‌های هر نوع پراکسی

بررسی سلامت از پیش‌فرض‌های معقول بر اساس scheme URL استفاده می‌کند:

| Scheme                     | پورت پیش‌فرض |
| -------------------------- | ------------ |
| `http://`                  | 8080         |
| `https://`                 | 443          |
| `socks5://` / `socks5h://` | 1080         |

پورت‌های سفارشی در URL (`http://host:9999`) همیشه بر پیش‌فرض scheme تقدم دارند.

---

## تحلیلات و مشاهده‌پذیری پراکسی

RouteChi استفادهٔ هر پراکسی را ردیابی می‌کند تا به اپراتورها در تشخیص الگوهای مسیریابی، جهش‌های تأخیر و شکست‌های مکرر کمک کند.

### چه چیزی ردیابی می‌شود

برای هر درخواست ازطریق یک پراکسی پیکربندی‌شده، RouteChi ثبت می‌کند:

| معیار       | توصیف                                                       |
| ----------- | ----------------------------------------------------------- |
| `proxy_url` | URL کامل پراکسی (با اعتبارنامه‌های احراز ماسک‌شده)        |
| `provider`  | شناسهٔ ارائه‌دهندهٔ بالادست (openai، anthropic و غیره)     |
| `latency_ms`| کل زمان رفت‌وبرگشت شامل handshake پراکسی                   |
| `connect_ms`| فقط زمان اتصال TCP                                          |
| `status`    | کد وضعیت HTTP از بالادست                                    |
| `error`     | کلاس خطا در صورت شکست درخواست                              |
| `timestamp` | ISO 8601 UTC                                                |

### دسترسی به داده‌ها

```bash
# Recent proxy events
curl -H "Authorization: Bearer $OMNIROUTE_KEY" \
  "http://localhost:20128/api/usage/proxy-logs?limit=100"
```

نقطهٔ پایانی واقعی `/api/usage/proxy-logs` است (ر.ک. `src/app/api/usage/proxy-logs/route.ts`). این نقطهٔ پایانی پشتیبانی می‌کند از:

- `GET /api/usage/proxy-logs` — دریافت لاگ‌های پراکسی
- `DELETE /api/usage/proxy-logs` — پاک‌کردن همهٔ لاگ‌های پراکسی

آمار تجمعی در صورت نیاز مستقیماً از جدول `proxy_logs` ازطریق SQL قابل کوئری است. رابط کاربری داشبورد ممکن است نماهای تجمعی ارائه دهد.

### الگوهای رایج

**تشخیص یک پراکسی نوسانی** (متناوب بین موفقیت/شکست):

```sql
SELECT proxy_url,
       COUNT(*) AS total,
       SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors,
       ROUND(100.0 * SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) / COUNT(*), 1) AS error_pct
FROM proxy_logs
WHERE timestamp > datetime('now', '-1 hour')
GROUP BY proxy_url
HAVING error_pct > 5
ORDER BY error_pct DESC;
```

**یافتن پراکسی‌های کند** (p95 تأخیر > ۲s):

```sql
WITH ranked AS (
  SELECT proxy_url, latency_ms,
         PERCENT_RANK() OVER (PARTITION BY proxy_url ORDER BY latency_ms) AS pct
  FROM proxy_logs
  WHERE timestamp > datetime('now', '-24 hour')
)
SELECT proxy_url, latency_ms
FROM ranked
WHERE pct >= 0.95
ORDER BY latency_ms DESC;
```

---

## درخت تصمیم استراتژی چرخش

هنگامی که چندین پراکسی به یک اسکوپ تخصیص می‌یابند، RouteChi از یک **استراتژی چرخش** برای انتخاب پراکسی برای هر درخواست استفاده می‌کند. استراتژی در سطح اسکوپ پیکربندی می‌شود (سراسری، هر ارائه‌دهنده، هر حساب، هر combo).

### استراتژی‌های موجود

| استراتژی              | زمان استفاده                 | مصالحه                                                          |
| --------------------- | ---------------------------- | --------------------------------------------------------------- |
| `quality` (پیش‌فرض)   | محیط عملیاتی با پراکسی‌های با کیفیت متفاوت | ترجیح به پراکسی‌های با نمره بالا؛ ممکن است پراکسی‌های ضعیف را گرسنه کند |
| `random`              | توزیع بار، حریم خصوصی        | توزیع یکنواخت؛ سیگنال‌های کیفیت را نادیده می‌گیرد               |
| `sequential`          | رفع‌اشکال، آزمایش قطعی       | به‌ترتیب از پراکسی‌ها می‌چرخد؛ استدلال آسان                     |

### درخت تصمیم

```
                    Do you have quality scores for your proxies?
                    │
        ┌───────────┴───────────┐
        │                       │
       YES                     NO
        │                       │
   Are all proxies             │
   roughly equal                  │
   in quality?                   │
        │                       │
   ┌────┴────┐                  │
   │         │                  │
  YES       NO                Use
   │         │              `random`
   │         │              (even spread
   │         │              builds quality
   │         │              data over time)
   │         │
   │    Use `quality`
   │    (best for
   │    mixed quality)
   │
Use `random`
(spread load
evenly)
```

### پیکربندی استراتژی چرخش

```ts
import { rotateOneproxyProxy } from "routechi/oneproxyRotator";

// In a one-off script
const proxy = await rotateOneproxyProxy({ strategy: "quality" });
if (proxy) {
  console.log(`Selected: ${proxy.host}:${proxy.port}, quality=${proxy.qualityScore}`);
}
```

### بازنشانی اندیس ترتیبی

هنگام استفاده از استراتژی `sequential`، اندیس داخلی انباشته می‌شود. برای بازنشانی:

```ts
import { resetSequentialIndex } from "routechi/oneproxyRotator";

resetSequentialIndex();
```

موارد مفید:

- راه‌اندازی مجدد یک آزمایش بار
- بازیابی از قطعی پراکسی (تا ابتدا از پراکسی‌های مرده عبور نکنید)
- تعادل مجدد دستی پس از افزودن پراکسی‌های جدید

### علامت‌گذاری یک پراکسی به‌عنوان ناموفق

هنگامی که یک پراکسی به‌طور مداوم شکست می‌خورد، آن را به‌صورت دستی علامت‌گذاری کنید تا چرخش‌دهنده آن را رد کند:

```ts
import { failOneproxyProxy } from "routechi/oneproxyRotator";

const removed = await failOneproxyProxy("1.2.3.4", 8080);
if (removed) {
  console.log("Proxy marked as failed; rotator will skip it");
}
```

پراکسی **حذف نمی‌شود** — به‌عنوان ناسالم علامت‌گذاری می‌شود و تا بررسی موفق بعدی سلامت (ازطریق `proxyHealth.ts`) یا بازنشانی دستی انتخاب نخواهد شد.

---

> 📖 **مستندات مرتبط:**
>
> - [راهنمای کاربر](../guides/USER_GUIDE.md) — راه‌اندازی و پیکربندی عمومی
> - [مرجع API](../reference/API_REFERENCE.md) — مستندات کامل API
> - [پیکربندی محیطی](../reference/ENVIRONMENT.md) — همهٔ متغیرهای محیطی
