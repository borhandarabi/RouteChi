---
title: "رفع اشکال"
version: 3.8.40
lastUpdated: 2026-06-28
---

# رفع اشکال

> **برای کاربران**: به دنبال راه‌حل‌های سریع هستید؟ به [مرجع سریع](#quick-reference) در ادامه مراجعه کنید.

🌐 **زبان‌ها:** 🇺🇸 [English](./TROUBLESHOOTING.md) | 🇧🇷 [Português (Brasil)](../i18n/pt-BR/docs/guides/TROUBLESHOOTING.md) | 🇪🇸 [Español](../i18n/es/docs/guides/TROUBLESHOOTING.md) | 🇫🇷 [Français](../i18n/fr/docs/guides/TROUBLESHOOTING.md) | 🇮🇹 [Italiano](../i18n/it/docs/guides/TROUBLESHOOTING.md) | 🇷🇺 [Русский](../i18n/ru/docs/guides/TROUBLESHOOTING.md) | 🇨🇳 [中文 (简体)](../i18n/zh-CN/docs/guides/TROUBLESHOOTING.md) | 🇩🇪 [Deutsch](../i18n/de/docs/guides/TROUBLESHOOTING.md) | 🇮🇳 [हिन्दी](../i18n/in/docs/guides/TROUBLESHOOTING.md) | 🇹🇭 [ไทย](../i18n/th/docs/guides/TROUBLESHOOTING.md) | 🇺🇦 [Українська](../i18n/uk-UA/docs/guides/TROUBLESHOOTING.md) | 🇸🇦 [العربية](../i18n/ar/docs/guides/TROUBLESHOOTING.md) | 🇯🇵 [日本語](../i18n/ja/docs/guides/TROUBLESHOOTING.md) | 🇻🇳 [Tiếng Việt](../i18n/vi/docs/guides/TROUBLESHOOTING.md) | 🇧🇬 [Български](../i18n/bg/docs/guides/TROUBLESHOOTING.md) | 🇩🇰 [Dansk](../i18n/da/docs/guides/TROUBLESHOOTING.md) | 🇫🇮 [Suomi](../i18n/fi/docs/guides/TROUBLESHOOTING.md) | 🇮🇱 [עברית](../i18n/he/docs/guides/TROUBLESHOOTING.md) | 🇭🇺 [Magyar](../i18n/hu/docs/guides/TROUBLESHOOTING.md) | 🇮🇩 [Bahasa Indonesia](../i18n/id/docs/guides/TROUBLESHOOTING.md) | 🇰🇷 [한국어](../i18n/ko/docs/guides/TROUBLESHOOTING.md) | 🇲🇾 [Bahasa Melayu](../i18n/ms/docs/guides/TROUBLESHOOTING.md) | 🇳🇱 [Nederlands](../i18n/nl/docs/guides/TROUBLESHOOTING.md) | 🇳🇴 [Norsk](../i18n/no/docs/guides/TROUBLESHOOTING.md) | 🇵🇹 [Português (Portugal)](../i18n/pt/docs/guides/TROUBLESHOOTING.md) | 🇷🇴 [Română](../i18n/ro/docs/guides/TROUBLESHOOTING.md) | 🇵🇱 [Polski](../i18n/pl/docs/guides/TROUBLESHOOTING.md) | 🇸🇰 [Slovenčina](../i18n/sk/docs/guides/TROUBLESHOOTING.md) | 🇸🇪 [Svenska](../i18n/sv/docs/guides/TROUBLESHOOTING.md) | 🇵🇭 [Filipino](../i18n/phi/docs/guides/TROUBLESHOOTING.md) | 🇨🇿 [Čeština](../i18n/cs/docs/guides/TROUBLESHOOTING.md)

مشکلات رایج و راه‌حل‌های آن‌ها برای OmniRoute.

---

## مرجع سریع

**تازه با OmniRoute آشنا شده‌اید؟** از اینجا شروع کنید — این موارد ۹۰٪ مشکلات را حل می‌کنند:

| این پیام را می‌بینید         | معنی                                | چه کاری انجام دهید                                                                                 |
| --------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| «Can't connect»             | OmniRoute در حال اجرا نیست            | `omniroute` را اجرا کنید یا `docker restart omniroute`                                             |
| «Invalid API key»           | کلید شما اشتباه یا منقضی است         | کلید را از وب‌سایت ارائه‌دهنده دوباره کپی کنید                                                     |
| «Rate limit exceeded»       | درخواست‌های زیادی ارسال می‌کنید      | ۱ دقیقه صبر کنید، یا برای fallback خودکار از `model: "auto"` استفاده کنید                          |
| «Quota exceeded»            | سهمیه رایگان/پولی شما تمام شده       | ارائه‌دهندگان بیشتری متصل کنید، یا از ارائه‌دهندگان رایگان (Kiro، Pollinations) استفاده کنید       |
| «Slow responses»            | ارائه‌دهنده مشغول یا دور است         | از `model: "auto/fast"` استفاده کنید یا یک ارائه‌دهنده سریع‌تر (Groq، Cerebras) متصل کنید          |
| «Wrong provider used»       | `auto` یک ارائه‌دهنده دیگر انتخاب کرده | این طبیعی است! `auto` بهترین را انتخاب می‌کند. یک ارائه‌دهنده خاص را با `model: "openai/gpt-4o"` اجبار کنید |
| «502 Bad Gateway»           | ارائه‌دهنده از کار افتاده            | صبر کنید و دوباره امتحان کنید، یا برای تعویض ارائه‌دهنده از `model: "auto"` استفاده کنید            |
| «401 Unauthorized»          | اعتبارنامه‌های شما اشتباه است        | کلید API خود را بررسی کنید یا دوباره با OAuth احراز هویت کنید                                       |
| «429 Too Many Requests»     | محدود شده‌اید                        | ۱ دقیقه صبر کنید، یا ارائه‌دهندگان بیشتری متصل کنید                                                |

**هنوز گیر کرده‌اید؟** به [راه‌حل‌های سریع](#quick-fixes) در ادامه مراجعه کنید، یا در [Discord](https://discord.gg/EkzRkpzKYt) بپرسید.

---

## راه‌حل‌های سریع

| مشکل                                                  | راه‌حل                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| اولین ورود کار نمی‌کند                                | `INITIAL_PASSWORD` را در `.env` تنظیم کنید (هیچ پیش‌فرض hardcode شده‌ای وجود ندارد)                                                                       |
| داشبورد روی پورت اشتباه باز می‌شود                    | `PORT=20128` و `NEXT_PUBLIC_BASE_URL=http://localhost:20128` را تنظیم کنید                                                                                |
| هیچ لاگی روی دیسک نوشته نمی‌شود                       | `APP_LOG_TO_FILE=true` را تنظیم کنید و بررسی کنید که ضبط call log فعال باشد                                                                               |
| EACCES: permission denied                             | `DATA_DIR=/path/to/writable/dir` را تنظیم کنید تا `~/.omniroute` جایگزین شود                                                                              |
| استراتژی مسیریابی ذخیره نمی‌شود                      | به آخرین نسخه v3.x به‌روزرسانی کنید (رفع Zod schema برای ماندگاری تنظیمات در نسخه‌های قبلی منتشر شده است)                                                 |
| کرش ورود / صفحه خالی                                  | نسخه Node.js را بررسی کنید — به [سازگاری Node.js](#nodejs-compatibility) در ادامه مراجعه کنید                                                              |
| `dlopen` / `slice is not valid mach-o file` (macOS)    | `cd $(npm root -g)/omniroute/app && npm rebuild better-sqlite3 && omniroute` را اجرا کنید — به [بازسازی ماژول بومی macOS](#macos-native-module-rebuild) مراجعه کنید |
| «fetch failed» پروکسی                                 | مطمئن شوید پیکربندی پروکسی در سطح صحیح تنظیم شده — به [مشکلات پروکسی](#proxy-issues) مراجعه کنید                                                          |

---

## سازگاری Node.js

<a name="nodejs-compatibility"></a>

### صفحه ورود کرش می‌کند یا خطای «Module self-registration» نشان می‌دهد

**علت:** در حال اجرای نسخه‌ای از Node.js هستید که خارج از کف امن تأییدشده OmniRoute است. رایج‌ترین حالت، اجرای یک patch قدیمی‌تر از Node 22 یا 24 است که از کف امن وصله‌شده مورد نیاز OmniRoute پایین‌تر است.

**علائم:**

- صفحه ورود صفحه خالی یا خطای سرور نشان می‌دهد
- کنسول `Error: Module did not self-register` یا خطاهای مشابه native binding را نمایش می‌دهد
- صفحه ورود اگر runtime خارج از سیاست امن پشتیبانی‌شده باشد، یک **بنر هشدار نارنجی** با نسخه Node شما نشان می‌دهد

**راه‌حل:**

1. یک نسخه LTS پشتیبانی‌شده Node.js را نصب کنید (پیشنهادی: Node.js 24.x):
   ```bash
   nvm install 24
   nvm use 24
   ```
2. نسخه خود را بررسی کنید: `node --version` باید `v24.0.0` یا جدیدتر در خط LTS 24.x را نشان دهد
3. OmniRoute را دوباره نصب کنید: `npm install -g routechi`
4. راه‌اندازی مجدد: `omniroute`

> **نسخه‌های امن پشتیبانی‌شده:** `>=22.22.2 <23` یا `>=24.0.0 <27`. Node.js 24.x LTS (Krypton) و Node.js 26 به‌طور کامل پشتیبانی می‌شوند.

### macOS: `dlopen` / «slice is not valid mach-o file»

<a name="macos-native-module-rebuild"></a>

**علت:** پس از `npm install -g routechi` سراسری، ممکن است باینری بومی `better-sqlite3` داخل پکیج برای معماری یا ABI متفاوتی از Node.js نسبت به آنچه در محلی اجرا می‌شود، کامپایل شده باشد. این در macOS (هم Apple Silicon و هم Intel) وقتی باینری از پیش ساخته‌شده با محیط شما مطابقت ندارد، رایج است.

**علائم:**

- سرور بلافاصله هنگام راه‌اندازی با خطای `dlopen` شکست می‌خورد
- خطا شامل `slice is not valid mach-o file` است
- مثال کامل:

```
dlopen(/Users/<user>/.nvm/versions/node/v24.14.1/lib/node_modules/omniroute/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node, 0x0001): tried: '...' (slice is not valid mach-o file)
```

**راه‌حل — برای محیط محلی خود بازسازی کنید (بدون نیاز به کاهش نسخه Node.js):**

```bash
cd $(npm root -g)/omniroute/app
npm rebuild better-sqlite3
omniroute
```

> **توجه:** این کار native binding را بر اساس نسخه Node.js و معماری CPU محلی شما دوباره کامپایل می‌کند و عدم تطابق باینری را برطرف می‌کند. محدوده runtime رسمی پشتیبانی‌شده **`>=22.22.2 <23` یا `>=24.0.0 <27`** است (`SUPPORTED_NODE_RANGE` در `src/shared/utils/nodeRuntimeSupport.ts`، هم‌تراز با فیلد `engines` در `package.json`). Node.js 24.x LTS (Krypton) و Node.js 26 به‌طور کامل با `better-sqlite3` v12.x پشتیبانی می‌شوند.

---

## مشکلات پروکسی

<a name="proxy-issues"></a>

### اعتبارسنجی ارائه‌دهنده «fetch failed» نشان می‌دهد

**علت:** نشانی پایانی اعتبارسنجی کلید API (`POST /api/providers/validate`) پیش از این پیکربندی پروکسی را دور می‌زد و در محیط‌هایی که نیاز به مسیریابی پروکسی دارند، باعث شکست می‌شد.

**راه‌حل (v3.5.5+):** این مشکل اکنون برطرف شده است. اعتبارسنجی ارائه‌دهنده از طریق `runWithProxyContext` مسیریابی می‌شود و به‌طور خودکار تنظیمات پروکسی در سطح ارائه‌دهنده و سراسری را رعایت می‌کند.

### بررسی سلامت توکن با «fetch failed» شکست می‌خورد

**علت:** بازخوانی توکن OAuth در پس‌زمینه، پیکربندی پروکسی را به ازای هر اتصال بررسی نمی‌کرد.

**راه‌حل (v3.5.5+):** زمان‌بند بررسی سلامت توکن اکنون پیش از تلاش برای بازخوانی، پیکربندی پروکسی را به ازای هر اتصال بررسی می‌کند. به v3.5.5+ به‌روزرسانی کنید.

### پروکسی SOCKS5 خطای «invalid onRequestStart method» برمی‌گرداند

**علت:** در Node.js 22، dispatcher مربوط به undici@8 با پیاده‌سازی `fetch()` داخلی Node ناسازگار است.

**راه‌حل (v3.5.5+):** OmniRoute اکنون وقتی یک dispatcher پروکسی فعال است، از تابع `fetch()` خود undici استفاده می‌کند و رفتار یکنواخت را تضمین می‌کند. به v3.5.5+ به‌روزرسانی کنید.

---

## مشکلات ارائه‌دهنده

### «Language model did not provide messages»

**علت:** سهمیه ارائه‌دهنده تمام شده است.

**راه‌حل:**

1. ردیاب سهمیه در داشبورد را بررسی کنید
2. از یک کامبو با سطوح fallback استفاده کنید
3. به سطح ارزان‌تر/رایگان تغییر دهید

### محدودیت نرخ (Rate Limiting)

**علت:** سهمیه اشتراک تمام شده است.

**راه‌حل:**

- افزودن fallback: `cc/claude-opus-4-6 → glm/glm-4.7 → if/kimi-k2-thinking`
- از GLM/MiniMax به‌عنوان پشتیبان ارزان استفاده کنید

### انقضای توکن OAuth

OmniRoute توکن‌ها را به‌طور خودکار بازخوانی می‌کند. اگر مشکلات ادامه داشت:

1. داشبورد → ارائه‌دهنده → اتصال مجدد
2. اتصال ارائه‌دهنده را حذف و دوباره اضافه کنید

### Kiro چند حسابی: حساب دوم، حساب اول را نامعتبر می‌کند

**علت:** بک‌اند Kiro یک نشست فعال برای هر ثبت‌نام کلاینت OIDC اعمال می‌کند. وقتی دو حساب از یک کلاینت ثبت‌شده مشترک استفاده می‌کنند (اتصالات واردشده قبل از v3.8.0)، بازخوانی توکن یک حساب، refresh token حساب دیگر را نامعتبر می‌کند.

**راه‌حل (v3.8.0+):** اتصالات آسیب‌دیده را دوباره وارد کنید. از v3.8.0 به بعد، هر اتصال جدید Kiro ایجادشده از طریق **Import Token**، **ورود اجتماعی Google/GitHub** یا **Auto-Import** به‌طور خودکار کلاینت OIDC اختصاصی خود را ثبت می‌کند. بنابراین اتصال کاملاً ایزوله است و بازخوانی یک حساب هیچ تأثیری بر حساب‌های دیگر ندارد.

اتصالاتی که قبل از v3.8.0 وارد شده‌اند، ثبت‌نام کلاینت به ازای هر اتصال ندارند. این اتصالات همچنان از نشانی بازخوانی احراز هویت اجتماعی مشترک استفاده می‌کنند. برای ایزوله شدن، اتصال قدیمی را از داشبورد → Providers حذف کنید و از طریق هر یک از سه جریان import دوباره اضافه کنید.

برای جزئیات کامل و دستورالعمل گام‌به‌گام برای افزودن دو حساب Kiro کنار هم، به [`docs/guides/KIRO_SETUP.md`](../guides/KIRO_SETUP.md) مراجعه کنید.

---

## مشکلات کلود

### خطاهای همگام‌سازی کلود

1. بررسی کنید `BASE_URL` به نمونه در حال اجرای شما اشاره می‌کند (مثلاً `http://localhost:20128`)
2. بررسی کنید `CLOUD_URL` به نشانی پایانی کلود شما اشاره می‌کند (مثلاً `https://omniroute.dev`)
3. مقادیر `NEXT_PUBLIC_*` را با مقادیر سمت سرور هم‌تراز نگه دارید

### کلود با `stream=false` خطای ۵۰۰ برمی‌گرداند

**علامت:** `Unexpected token 'd'...` روی نشانی پایانی کلود برای فراخوانی‌های غیر استریمی.

**علت:** upstream بار SSE برمی‌گرداند در حالی که کلاینت انتظار JSON دارد.

**راه‌حل موقت:** برای فراخوانی‌های مستقیم کلود از `stream=true` استفاده کنید. runtime محلی شامل fallback از SSE به JSON است.

### کلود می‌گوید متصل است اما «Invalid API key»

1. یک کلید جدید از داشبورد محلی بسازید (`/api/keys`)
2. همگام‌سازی کلود را اجرا کنید: فعال‌سازی Cloud → Sync Now
3. کلیدهای قدیمی/غیر همگام‌شده همچنان می‌توانند در کلود `401` برگردانند

---

## مشکلات Docker

### ابزار CLI نشان می‌دهد نصب نشده است

1. فیلدهای runtime را بررسی کنید: `curl http://localhost:20128/api/cli-tools/runtime/codex | jq`
2. برای حالت portable: از هدف image `runner-cli` استفاده کنید (CLIهای همراه)
3. برای حالت host mount: `CLI_EXTRA_PATHS` را تنظیم کنید و دایرکتوری bin هاست را فقط‌خواندنی mount کنید
4. اگر `installed=true` و `runnable=false`: باینری پیدا شده اما در healthcheck شکست خورده

### اعتبارسنجی سریع runtime

```bash
curl -s http://localhost:20128/api/cli-tools/codex-settings | jq '{installed,runnable,commandPath,runtimeMode,reason}'
curl -s http://localhost:20128/api/cli-tools/claude-settings | jq '{installed,runnable,commandPath,runtimeMode,reason}'
curl -s http://localhost:20128/api/cli-tools/openclaw-settings | jq '{installed,runnable,commandPath,runtimeMode,reason}'
```

---

## مشکلات هزینه

### هزینه‌های بالا

1. آمار استفاده را در Dashboard → Usage بررسی کنید
2. مدل اصلی را به GLM/MiniMax تغییر دهید
3. برای وظایف غیر حیاتی از سطح رایگان (Qoder، Kiro) استفاده کنید
4. بودجه هزینه به ازای هر کلید API تنظیم کنید: Dashboard → API Keys → Budget

---

## دیباگ

### فعال‌سازی فایل‌های لاگ

`APP_LOG_TO_FILE=true` را در فایل `.env` خود تنظیم کنید. لاگ‌های برنامه در `logs/` نوشته می‌شوند. مصنوعات درخواست هنگام فعال بودن pipeline لاگ فراخوانی در تنظیمات، در `${DATA_DIR}/call_logs/` ذخیره می‌شوند.
وقتی ضبط pipeline فعال است، `CALL_LOG_PIPELINE_CAPTURE_STREAM_CHUNKS=false` را تنظیم کنید تا بارهای chunk استریم حذف شوند، یا `CALL_LOG_PIPELINE_MAX_SIZE_KB` را برای تغییر سقف مصنوعات به KB تنظیم کنید.

### بررسی سلامت ارائه‌دهنده

```bash
# داشبورد سلامت
http://localhost:20128/dashboard/health

# بررسی سلامت API
curl http://localhost:20128/api/monitoring/health
```

### ذخیره‌سازی runtime

- وضعیت اصلی: `${DATA_DIR}/storage.sqlite` (ارائه‌دهندگان، کامبوها، aliasها، کلیدها، تنظیمات)
- استفاده: جداول SQLite در `storage.sqlite` (`usage_history`، `call_logs`، `proxy_logs`) + `${DATA_DIR}/call_logs/` اختیاری
- لاگ‌های برنامه: `<repo>/logs/...` (وقتی `APP_LOG_TO_FILE=true`)
- مصنوعات call log: `${DATA_DIR}/call_logs/YYYY-MM-DD/...` هنگام فعال بودن pipeline لاگ فراخوانی

عملکرد **Clean history** در صفحه Request Logs، `call_logs`، `request_detail_logs` قدیمی و دایرکتوری مصنوعات محلی `${DATA_DIR}/call_logs/` را پاک می‌کند.

---

## مشکلات Circuit Breaker

### ارائه‌دهنده در حالت OPEN گیر می‌کند

وقتی circuit breaker یک ارائه‌دهنده در حالت OPEN است، درخواست‌ها تا انقضای cooldown مسدود می‌شوند.

**راه‌حل:**

1. به **Dashboard → Settings → Resilience** بروید
2. کارت circuit breaker مربوط به ارائه‌دهنده آسیب‌دیده را بررسی کنید
3. روی **Reset All** کلیک کنید تا همه breakerها پاک شوند، یا منتظر انقضای cooldown بمانید
4. پیش از بازنشانی مطمئن شوید ارائه‌دهنده واقعاً در دسترس است

### ارائه‌دهنده مدام circuit breaker را فعال می‌کند

اگر یک ارائه‌دهنده به‌طور مکرر وارد حالت OPEN می‌شود:

1. **Dashboard → Health → Provider Health** را برای الگوی شکست بررسی کنید
2. به **Settings → Resilience → Provider Profiles** بروید و آستانه شکست را افزایش دهید
3. بررسی کنید که آیا ارائه‌دهنده محدودیت‌های API را تغییر داده یا نیاز به احراز هویت مجدد دارد
4. تله‌متری تأخیر را بررسی کنید — تأخیر بالا ممکن است باعث شکست‌های مبتنی بر timeout شود

---

## مشکلات رونویسی صوتی

### خطای «Unsupported model»

- مطمئن شوید از پیشوند صحیح استفاده می‌کنید: `deepgram/nova-3` یا `assemblyai/best`
- بررسی کنید ارائه‌دهنده در **Dashboard → Providers** متصل است

### رونویسی خالی برمی‌گرداند یا شکست می‌خورد

- فرمت‌های صوتی پشتیبانی‌شده را بررسی کنید: `mp3`، `wav`، `m4a`، `flac`، `ogg`، `webm`
- بررسی کنید حجم فایل در محدودیت‌های ارائه‌دهنده است (معمولاً < ۲۵MB)
- اعتبار کلید API ارائه‌دهنده را در کارت ارائه‌دهنده بررسی کنید

---

## دیباگ مترجم

برای دیباگ مشکلات ترجمه فرمت از **Dashboard → Translator** استفاده کنید:

| Mode             | چه زمانی استفاده کنید                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Playground**   | مقایسه فرمت‌های ورودی/خروجی کنار هم — یک درخواست ناموفق را paste کنید تا نحوه ترجمه را ببینید |
| **Chat Tester**  | پیام‌های زنده بفرستید و کل بار درخواست/پاسخ شامل هدرها را بررسی کنید                          |
| **Test Bench**   | تست‌های دسته‌ای روی ترکیب فرمت‌ها اجرا کنید تا ببینید کدام ترجمه‌ها خراب هستند               |
| **Live Monitor** | جریان درخواست در زمان واقعی را ببینید تا مشکلات ترجمه متناوب را بگیرید                        |

### مشکلات رایج فرمت

- **ظاهر نشدن thinking tagها** — بررسی کنید آیا ارائه‌دهنده هدف از thinking پشتیبانی می‌کند و تنظیم بودجه thinking را بررسی کنید
- **از دست رفتن tool callها** — برخی ترجمه‌های فرمت ممکن است فیلدهای پشتیبانی‌نشده را حذف کنند؛ در حالت Playground بررسی کنید
- **نبود system prompt** — Claude و Gemini با system prompt متفاوت رفتار می‌کنند؛ خروجی ترجمه را بررسی کنید
- **SDK رشته raw به‌جای object برمی‌گرداند** — در v1.x برطرف شده؛ پاک‌کننده پاسخ فیلدهای غیر استاندارد (`x_groq`، `usage_breakdown` و غیره) را که باعث شکست اعتبارسنجی Pydantic SDK OpenAI می‌شوند، حذف می‌کند. اگر هنوز در v3.x+ این مشکل را می‌بینید، لطفاً issue ثبت کنید.
- **GLM/ERNIE نقش `system` را رد می‌کند** — در v1.x برطرف شده؛ نرمالایزر نقش، پیام‌های سیستم را برای مدل‌های ناسازگار به‌طور خودکار در پیام‌های کاربر ادغام می‌کند. اگر هنوز در v3.x+ این مشکل را می‌بینید، لطفاً issue ثبت کنید.
- **نقش `developer` شناخته نمی‌شود** — در v1.x برطرف شده؛ برای ارائه‌دهندگان غیر OpenAI به‌طور خودکار به `system` تبدیل می‌شود. اگر هنوز در v3.x+ این مشکل را می‌بینید، لطفاً issue ثبت کنید.
- **`json_schema` با Gemini کار نمی‌کند** — در v1.x برطرف شده؛ `response_format` اکنون به `responseMimeType` + `responseSchema` مربوط به Gemini تبدیل می‌شود. اگر هنوز در v3.x+ این مشکل را می‌بینید، لطفاً issue ثبت کنید.

---

## تنظیمات تاب‌آوری

### فعال نشدن محدودیت نرخ خودکار

- محدودیت نرخ خودکار فقط برای ارائه‌دهندگان کلید API اعمال می‌شود (نه OAuth/اشتراک)
- بررسی کنید **Settings → Resilience → Provider Profiles** محدودیت نرخ خودکار را فعال دارد
- بررسی کنید آیا ارائه‌دهنده کد وضعیت `429` یا هدر `Retry-After` برمی‌گرداند

### تنظیم backoff نمایی

پروفایل‌های ارائه‌دهنده از این تنظیمات پشتیبانی می‌کنند:

- **تأخیر پایه** — زمان انتظار اولیه پس از اولین شکست (پیش‌فرض: ۱s)
- **حداکثر تأخیر** — سقف حداکثر زمان انتظار (پیش‌فرض: ۳۰s)
- **ضریب** — چقدر تأخیر به ازای هر شکست متوالی افزایش یابد (پیش‌فرض: ۲x)

### ضد thundering herd

وقتی بسیاری از درخواست‌های همزمان به یک ارائه‌دهنده محدودشده می‌رسند، OmniRoute از mutex + محدودیت نرخ خودکار برای سریال‌سازی درخواست‌ها و جلوگیری از شکست‌های آبشاری استفاده می‌کند. این برای ارائه‌دهندگان کلید API خودکار است.

---

## تاکسونومی اختیاری شکست RAG / LLM (۱۶ مشکل)

برخی کاربران OmniRoute، gateway را در جلوی پشته‌های RAG یا agent قرار می‌دهند. در این تنظیمات رایج است که یک الگوی عجیب ببینید: OmniRoute سالم به نظر می‌رسد (ارائه‌دهندگان بالا، پروفایل‌های مسیریابی خوب، بدون هشدار محدودیت نرخ) اما پاسخ نهایی هنوز اشتباه است.

در عمل، این اتفاقات معمولاً از pipeline RAG پایین‌دست می‌آیند، نه از خود gateway.

اگر می‌خواهید یک واژگان مشترک برای توصیف این شکست‌ها داشته باشید، می‌توانید از WFGY ProblemMap استفاده کنید — یک منبع متنی خارجی با مجوز MIT که شانزده الگوی تکرارشونده شکست RAG / LLM را تعریف می‌کند. در سطح بالا این موارد را پوشش می‌دهد:

- انحراف بازیابی و مرزهای زمینه شکسته
- ایندکس‌ها و vector storeهای خالی یا کهنه
- عدم تطابق embedding با معنای معنایی
- مونتاژ prompt و مشکلات پنجره زمینه
- فروپاشی منطق و پاسخ‌های بیش‌ازحد مطمئن
- زنجیره طولانی و شکست‌های هماهنگی agent
- حافظه چند agent و انحراف نقش
- مشکلات ترتیب استقرار و bootstrap

ایده ساده است:

1. هنگام بررسی یک پاسخ بد، این موارد را ثبت کنید:
   - وظیفه و درخواست کاربر
   - route یا combo ارائه‌دهنده در OmniRoute
   - هر زمینه RAG استفاده‌شده در پایین‌دست (اسناد بازیابی‌شده، tool callها و غیره)
2. اتفاق را به یک یا دو شماره WFGY ProblemMap (`No.1` … `No.16`) نگاشت کنید.
3. شماره را در داشبورد، runbook یا ردیاب incident خود کنار لاگ‌های OmniRoute ذخیره کنید.
4. از صفحه مربوطه WFGY استفاده کنید تا تصمیم بگیرید آیا باید پشته RAG، retriever یا استراتژی مسیریابی خود را تغییر دهید.

متن کامل و دستورالعمل‌های مشخص در اینجا قرار دارند (مجوز MIT، فقط متن):

[WFGY ProblemMap README](https://github.com/onestardao/WFGY/blob/main/ProblemMap/README.md)

اگر RAG یا pipelineهای agent پشت OmniRoute اجرا نمی‌کنید، می‌توانید این بخش را نادیده بگیرید.

---

## مشکلات شناخته‌شده v3.8.0

مشکلات خاص نسخه v3.8.0 و راه‌حل‌های موقت فعلی آن‌ها. اگر راه‌حلی در patch بعدی عرضه شود، این مدخل به‌روزرسانی یا حذف خواهد شد.

### جریان OAuth Windsurf با ۴۰۱ شکست می‌خورد

**علائم:**

- «401 unauthorized» هنگام تکمیل جریان OAuth Windsurf از داشبورد
- کارت ارائه‌دهنده Windsurf پس از callback در وضعیت «needs reconnection» باقی می‌ماند

**علل:**

- متغیر محیطی `WINDSURF_FIREBASE_API_KEY` مفقود یا خالی است
- `WINDSURF_API_KEY` به‌اشتباه پیکربندی شده یا به یک توکن کهنه اشاره می‌کند
- فایروال/پروکسی محلی callback OAuth را مسدود می‌کند

**راه‌حل:**

1. بررسی کنید هر دو `WINDSURF_FIREBASE_API_KEY` و `WINDSURF_API_KEY` در `.env` تنظیم شده‌اند
2. OmniRoute را راه‌اندازی مجدد کنید تا مقادیر env جدید اعمال شوند
3. جریان OAuth را از **Dashboard → Providers → Windsurf → Reconnect** دوباره اجرا کنید

### شکست احراز هویت Devin CLI

**علائم:**

- «Devin CLI not found» یا «auth failed» هنگام فراخوانی ابزارهای مبتنی بر Devin
- بررسی runtime CLI گزارش می‌دهد `installed=false`

**علل:**

- `CLI_DEVIN_BIN` به مسیری اشاره می‌کند که وجود ندارد
- Devin CLI روی هاست نصب نیست

**راه‌حل:**

1. Devin CLI را برای پلتفرم خود نصب کنید
2. `CLI_DEVIN_BIN=/usr/local/bin/devin` (یا مسیر واقعی) را در `.env` تنظیم کنید
3. OmniRoute را راه‌اندازی مجدد کنید و از **Dashboard → CLI Tools** دوباره تست کنید

### گیر کردن cooldown مدل (بازنشانی دستی)

**علائم:**

- یک مدل حتی پس از گذشت زمان انقضا در لیست cooldown باقی می‌ماند
- درخواست‌ها همچنان مدل را در مسیریابی combo رد می‌کنند با وجود اینکه timestamp در گذشته است

**بازنشانی دستی:**

- **داشبورد:** **Settings → Model Cooldowns** → روی کارت آسیب‌دیده روی **Re-enable** کلیک کنید
- **API:** `DELETE /api/resilience/model-cooldowns` با هدرهای احراز هویت مدیریت

### اتصال ارائه‌دهنده Command Code با ۴۰۳ شکست می‌خورد

**علائم:**

- ۴۰۳ هنگام تست اتصال ارائه‌دهنده Command Code
- کارت ارائه‌دهنده پس از افزودن تازه «unauthorized» نشان می‌دهد

**علت:** جریان OAuth تکمیل نشده (callback دریافت نشده یا توکن ذخیره نشده).

**راه‌حل:**

- `routechi providers` را از CLI اجرا کنید تا جریان OAuth دوباره راه‌اندازی شود، یا
- OAuth را از **Dashboard → Providers → Command Code → Reconnect** دوباره اجرا کنید

### ModelScope cooldownهای تهاجمی ۴۲۹ برمی‌گرداند

**علائم:**

- cooldownهای بسیار کوتاه یا فوری روی ModelScope پس از یک burst کوچک درخواست
- مسیریابی combo زودتر از انتظار ModelScope را رد می‌کند

**علت:** ModelScope هدرهای `Retry-After` خاص ارائه‌دهنده ارسال می‌کند. v3.8.0 مدیریت اختصاصی برای این هدرها عرضه می‌کند، بنابراین نسخه‌های قدیمی آن‌ها را به‌اشتباه به‌عنوان hintهای محدودیت نرخ عمومی تفسیر می‌کردند.

**راه‌حل:**

- مطمئن شوید روی v3.8.0 یا جدیدتر هستید
- بررسی کنید toggle `useUpstream429BreakerHints` در **Settings → Resilience** فعال است

### مفقود بودن OMNIROUTE_WS_BRIDGE_SECRET در تولید

**علائم:**

- ۴۰۱ روی هر درخواست WebSocket bridge کدکس/Responses هنگام اجرا روی هاست تولید راه‌دور
- handshake مربوط به WebSocket bridge بلافاصله پس از اتصال بسته می‌شود

**علت:** متغیر محیطی `OMNIROUTE_WS_BRIDGE_SECRET` در محیط تولید مفقود است.

**راه‌حل:**

1. یک secret تصادفی تولید کنید: `openssl rand -hex 32`
2. `OMNIROUTE_WS_BRIDGE_SECRET=<random-secret>` را در env سرور تولید (و هر کلاینتی که با bridge صحبت می‌کند) تنظیم کنید
3. OmniRoute را راه‌اندازی مجدد کنید

### Responses API: حالت پس‌زمینه به همگام تنزل یافته

**علائم:**

- هشدار لاگ شده: `background mode degraded to synchronous`
- یک درخواست `background: true` به‌جای handle شغل پس‌زمینه، یک پاسخ همگام عادی برمی‌گرداند

**علت:** v3.8.0 عمداً `background: true` را روی Responses API به اجرای همگام تنزل می‌دهد و در عین حال هشداری صادر می‌کند. اجرای کامل پس‌زمینه async یک تحویل‌دهی آینده است.

**راه‌حل:**

- کلاینت را تنظیم کنید که بدون `background` فراخوانی کند، یا
- منتظر نسخه بعدی بمانید که حالت کامل پس‌زمینه async را عرضه می‌کند (changelog را دنبال کنید)

---

## هنوز گیر کرده‌اید؟

- **GitHub Issues**: [github.com/borhandarabi/routechi/issues](https://github.com/borhandarabi/routechi/issues)
- **معماری**: برای جزئیات داخلی به [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) مراجعه کنید
- **مرجع API**: برای همه نشانی‌های پایانی به [`docs/reference/API_REFERENCE.md`](../reference/API_REFERENCE.md) مراجعه کنید
- **داشبورد سلامت**: برای وضعیت سیستم در زمان واقعی **Dashboard → Health** را بررسی کنید
- **مترجم**: برای دیباگ مشکلات فرمت از **Dashboard → Translator** استفاده کنید
