---
title: "رفع اشکال"
version: 3.8.40
lastUpdated: 2026-06-28
---

# رفع اشکال

> **برای کاربران**: به دنبال راه‌حل‌های سریع هستید؟ به [مرجع سریع](#quick-reference) زیر مراجعه کنید.

🌐 **Languages:** 🇺🇸 [English](./TROUBLESHOOTING.md) | 🇧🇷 [Português (Brasil)](../i18n/pt-BR/docs/guides/TROUBLESHOOTING.md) | 🇪🇸 [Español](../i18n/es/docs/guides/TROUBLESHOOTING.md) | 🇫🇷 [Français](../i18n/fr/docs/guides/TROUBLESHOOTING.md) | 🇮🇹 [Italiano](../i18n/it/docs/guides/TROUBLESHOOTING.md) | 🇷🇺 [Русский](../i18n/ru/docs/guides/TROUBLESHOOTING.md) | 🇨🇳 [中文 (简体)](../i18n/zh-CN/docs/guides/TROUBLESHOOTING.md) | 🇩🇪 [Deutsch](../i18n/de/docs/guides/TROUBLESHOOTING.md) | 🇮🇳 [हिन्दी](../i18n/in/docs/guides/TROUBLESHOOTING.md) | 🇹🇭 [ไทย](../i18n/th/docs/guides/TROUBLESHOOTING.md) | 🇺🇦 [Українська](../i18n/uk-UA/docs/guides/TROUBLESHOOTING.md) | 🇸🇦 [العربية](../i18n/ar/docs/guides/TROUBLESHOOTING.md) | 🇯🇵 [日本語](../i18n/ja/docs/guides/TROUBLESHOOTING.md) | 🇻🇳 [Tiếng Việt](../i18n/vi/docs/guides/TROUBLESHOOTING.md) | 🇧🇬 [Български](../i18n/bg/docs/guides/TROUBLESHOOTING.md) | 🇩🇰 [Dansk](../i18n/da/docs/guides/TROUBLESHOOTING.md) | 🇫🇮 [Suomi](../i18n/fi/docs/guides/TROUBLESHOOTING.md) | 🇮🇱 [עברית](../i18n/he/docs/guides/TROUBLESHOOTING.md) | 🇭🇺 [Magyar](../i18n/hu/docs/guides/TROUBLESHOOTING.md) | 🇮🇩 [Bahasa Indonesia](../i18n/id/docs/guides/TROUBLESHOOTING.md) | 🇰🇷 [한국어](../i18n/ko/docs/guides/TROUBLESHOOTING.md) | 🇲🇾 [Bahasa Melayu](../i18n/ms/docs/guides/TROUBLESHOOTING.md) | 🇳🇱 [Nederlands](../i18n/nl/docs/guides/TROUBLESHOOTING.md) | 🇳🇴 [Norsk](../i18n/no/docs/guides/TROUBLESHOOTING.md) | 🇵🇹 [Português (Portugal)](../i18n/pt/docs/guides/TROUBLESHOOTING.md) | 🇷🇴 [Română](../i18n/ro/docs/guides/TROUBLESHOOTING.md) | 🇵🇱 [Polski](../i18n/pl/docs/guides/TROUBLESHOOTING.md) | 🇸🇰 [Slovenčina](../i18n/sk/docs/guides/TROUBLESHOOTING.md) | 🇸🇪 [Svenska](../i18n/sv/docs/guides/TROUBLESHOOTING.md) | 🇵🇭 [Filipino](../i18n/phi/docs/guides/TROUBLESHOOTING.md) | 🇨🇿 [Čeština](../i18n/cs/docs/guides/TROUBLESHOOTING.md)

مشکلات و راه‌حل‌های رایج برای OmniRoute.

---

## مرجع سریع

**با OmniRoute تازه آشنا شده‌اید؟** از اینجا شروع کنید — این موارد ۹۰٪ مشکلات را حل می‌کنند:

| این را می‌بینم          | معنی                                | چه کاری انجام دهید                                                                                 |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| "Can't connect"         | OmniRoute اجرا نمی‌شود               | `omniroute` یا `docker restart omniroute` را اجرا کنید                                              |
| "Invalid API key"       | کلید شما اشتباه یا منقضی است         | کلید را از وب‌سایت ارائه‌دهنده دوباره کپی کنید                                                       |
| "Rate limit exceeded"   | درخواست‌های زیادی می‌فرستید          | ۱ دقیقه صبر کنید، یا برای fallback خودکار از `model: "auto"` استفاده کنید                          |
| "Quota exceeded"        | سهمیهٔ رایگان/پرداختی‌تان تمام شده   | ارائه‌دهنده‌های بیشتری متصل کنید، یا از ارائه‌دهنده‌های رایگان (Kiro، Pollinations) استفاده کنید |
| "Slow responses"        | ارائه‌دهنده مشغول یا دور است         | از `model: "auto/fast"` استفاده کنید یا یک ارائه‌دهندهٔ سریع‌تر (Groq، Cerebras) متصل کنید       |
| "Wrong provider used"   | `auto` یک ارائه‌دهندهٔ متفاوت انتخاب کرده | این طبیعی است! `auto` بهترین را انتخاب می‌کند. یک ارائه‌دهندهٔ خاص را با `model: "openai/gpt-4o"` اجبار کنید |
| "502 Bad Gateway"       | ارائه‌دهنده از کار افتاده            | صبر و تلاش مجدد، یا برای تعویض ارائه‌دهنده از `model: "auto"` استفاده کنید                          |
| "401 Unauthorized"      | credentialهای شما اشتباه است         | کلید API خود را بررسی یا با OAuth دوباره احراز هویت کنید                                            |
| "429 Too Many Requests" | rate limited شده‌اید                | ۱ دقیقه صبر کنید، یا ارائه‌دهنده‌های بیشتری متصل کنید                                               |

**هنوز گیر کرده‌اید؟** به [رفع اشکال تفصیلی](#detailed-troubleshooting) زیر مراجعه کنید، یا در [Discord](https://discord.gg/EkzRkpzKYt) بپرسید.

---

## رفع اشکال تفصیلی

---

## راه‌حل‌های سریع

| مشکل                                                 | راه‌حل                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ورود اول کار نمی‌کند                                 | `INITIAL_PASSWORD` را در `.env` تنظیم کنید (هیچ پیش‌فرض hard-codedای وجود ندارد)                                                                          |
| داشبورد روی پورت اشتباه باز می‌شود                   | `PORT=20128` و `NEXT_PUBLIC_BASE_URL=http://localhost:20128` را تنظیم کنید                                                                                |
| هیچ لاگی روی دیسک نوشته نمی‌شود                      | `APP_LOG_TO_FILE=true` را تنظیم و فعال بودن ضبط call log را تأیید کنید                                                                                    |
| EACCES: permission denied                           | `DATA_DIR=/path/to/writable/dir` را برای بازنویسی `~/.omniroute` تنظیم کنید                                                                                |
| استراتژی مسیریابی ذخیره نمی‌شود                     | به آخرین نسخهٔ v3.x به‌روزرسانی کنید (رفع Zod schema برای ماندگاری تنظیمات در نسخه‌های قبلی منتشر شد)                                                     |
| کرش ورود / صفحهٔ خالی                                | نسخهٔ Node.js را بررسی کنید — به [سازگاری Node.js](#nodejs-compatibility) زیر مراجعه کنید                                                                  |
| `dlopen` / `slice is not valid mach-o file` (macOS) | `cd $(npm root -g)/omniroute/app && npm rebuild better-sqlite3 && omniroute` را اجرا کنید — به [بازسازی ماژول بومی macOS](#macos-native-module-rebuild) زیر مراجعه کنید |
| "fetch failed" پروکسی                                | مطمئن شوید پیکربندی پروکسی در سطح صحیح تنظیم شده — به [مشکلات پروکسی](#proxy-issues) زیر مراجعه کنید                                                       |

---

## سازگاری Node.js

<a name="nodejs-compatibility"></a>

### صفحهٔ ورود کرش می‌کند یا خطای "Module self-registration" نشان می‌دهد

**علت:** در حال اجرای یک نسخهٔ Node.js خارج از کف زمان‌اجرای امن تأییدشدهٔ OmniRoute هستید. رایج‌ترین حالت اجرای یک patch level قدیمی‌تر Node 22 یا 24 است که زیر کف امنیتی patch‌شده‌ای که OmniRoute نیاز دارد قرار می‌گیرد.

**علامت‌ها:**

- صفحهٔ ورود صفحهٔ خالی یا خطای سرور نشان می‌دهد
- کنسول `Error: Module did not self-register` یا خطاهای مشابه binding بومی را نشان می‌دهد
- صفحهٔ ورود یک **بنر هشدار نارنجی** با نسخهٔ Node شما نشان می‌دهد اگر runtime خارج از خط‌مشی امن پشتیبانی‌شده باشد

**راه‌حل:**

1. یک نسخهٔ LTS پشتیبانی‌شدهٔ Node.js را نصب کنید (پیشنهادی: Node.js 24.x):
   ```bash
   nvm install 24
   nvm use 24
   ```
2. نسخهٔ خود را تأیید کنید: `node --version` باید `v24.0.0` یا جدیدتر روی خط LTS 24.x را نشان دهد
3. نصب مجدد OmniRoute: `npm install -g omniroute`
4. راه‌اندازی مجدد: `omniroute`

> **نسخه‌های امن پشتیبانی‌شده:** `>=22.22.2 <23` یا `>=24.0.0 <27`. Node.js 24.x LTS (Krypton) و Node.js 26 کاملاً پشتیبانی می‌شوند.

### macOS: `dlopen` / "slice is not valid mach-o file"

<a name="macos-native-module-rebuild"></a>

**علت:** پس از یک `npm install -g omniroute` سراسری، باینری بومی `better-sqlite3` درون پکیج ممکن است برای معماری یا ABI متفاوتی از Node.js نسبت به آنچه محلی اجرا می‌شود، کامپایل شده باشد. این در macOS (هم Apple Silicon و هم Intel) هنگامی که باینری از پیش ساخته‌شده با محیط شما تطابق ندارد رایج است.

**علامت‌ها:**

- سرور بلافاصله هنگام راه‌اندازی با خطای `dlopen` شکست می‌خورد
- خطا شامل `slice is not valid mach-o file` است
- نمونهٔ کامل:

```
dlopen(/Users/<user>/.nvm/versions/node/v24.14.1/lib/node_modules/omniroute/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node, 0x0001): tried: '...' (slice is not valid mach-o file)
```

**راه‌حل — بازسازی برای محیط محلی خود (بدون نیاز به downgrade مربوط به Node.js):**

```bash
cd $(npm root -g)/omniroute/app
npm rebuild better-sqlite3
omniroute
```

> **یادداشت:** این binding بومی را در برابر نسخهٔ Node.js و معماری CPU محلی شما دوباره کامپایل می‌کند و عدم تطابق باینری را برطرف می‌سازد. بازهٔ runtime رسمی پشتیبانی‌شده **`>=22.22.2 <23` یا `>=24.0.0 <27`** است (`SUPPORTED_NODE_RANGE` در `src/shared/utils/nodeRuntimeSupport.ts`، هم‌راستا با فیلد `engines` در `package.json`). Node.js 24.x LTS (Krypton) و Node.js 26 با `better-sqlite3` v12.x کاملاً پشتیبانی می‌شوند.

---

## مشکلات پروکسی

<a name="proxy-issues"></a>

### اعتبارسنجی ارائه‌دهنده "fetch failed" نشان می‌دهد

**علت:** نقطهٔ پایانی اعتبارسنجی کلید API (`POST /api/providers/validate`) قبلاً پیکربندی پروکسی را دور می‌زد و باعث شکست در محیط‌هایی می‌شد که نیازمند مسیریابی پروکسی هستند.

**راه‌حل (v3.5.5+):** اکنون اصلاح شده است. اعتبارسنجی ارائه‌دهنده از طریق `runWithProxyContext` مسیریابی می‌شود و تنظیمات پروکسی سراسری و به‌ازای ارائه‌دهنده را به‌طور خودکار رعایت می‌کند.

### بررسی سلامت توکن با "fetch failed" شکست می‌خورد

**علت:** بازنشانی OAuth توکن پس‌زمینه پیکربندی پروکسی را به‌ازای اتصال تحلیل نمی‌کرد.

**راه‌حل (v3.5.5+):** زمان‌بند بررسی سلامت توکن اکنون پیش از تلاش برای بازنشانی، پیکربندی پروکسی را به‌ازای اتصال تحلیل می‌کند. به v3.5.5+ به‌روزرسانی کنید.

### پروکسی SOCKS5 "invalid onRequestStart method" بازمی‌گرداند

**علت:** در Node.js 22، dispatcher مربوط به undici@8 با پیاده‌سازی `fetch()` داخلی Node ناسازگار است.

**راه‌حل (v3.5.5+):** OmniRoute اکنون هنگامی که یک dispatcher پروکسی فعال است، از تابع `fetch()` خود undici استفاده می‌کند و رفتار یکسان را تضمین می‌کند. به v3.5.5+ به‌روزرسانی کنید.

### پروکسی MITM تحت WSL: برنامه‌های دسکتاپ روی میزبان ویندوز intercept نمی‌شوند

**علت:** پروکسی MITM و گواهی CA آن در محیطی که OmniRoute در آن اجرا می‌شود نصب می‌شوند. تحت WSL آن محیط guest لینوکس است، در حالی که برنامه‌های دسکتاپ AI (Kiro، Trae، Copilot، Zed، …) روی میزبان ویندوز اجرا می‌شوند. برنامه‌های میزبان به مخزن گواهی guest اعتماد نمی‌کنند و از پروکسی سامانهٔ guest عبور نمی‌کنند، بنابراین intercept دسکتاپ آنجا درگیر نمی‌شود.

**توصیه:** OmniRoute را به‌صورت بومی روی همان سیستم‌عامل برنامه‌های دسکتاپی که می‌خواهید intercept کنید اجرا کنید (ویندوز برای برنامه‌های ویندوز؛ به همین ترتیب macOS/لینوکس). نگه‌داشتن OmniRoute درون WSL در حالی که برنامه‌های میزبان را هدف قرار می‌دهید، نیازمند اعتماد دستی به گواهی CA تولیدشده روی میزبان ویندوز و هدایت تنظیمات شبکه/پروکسی هر برنامهٔ میزبان به نقطهٔ پایانی پروکسی WSL است — یک راه‌اندازی پشتیبانی‌نشده و شکننده.

---

## مشکلات ارائه‌دهنده

### "Language model did not provide messages"

**علت:** سهمیهٔ ارائه‌دهنده تمام شده است.

**راه‌حل:**

1. ردیاب سهمیهٔ داشبورد را بررسی کنید
2. از یک کامبو با tierهای fallback استفاده کنید
3. به tier ارزان‌تر/رایگان سوئیچ کنید

### Rate Limiting

**علت:** سهمیهٔ اشتراک تمام شده است.

**راه‌حل:**

- افزودن fallback: `cc/claude-opus-4-6 → glm/glm-4.7 → if/kimi-k2-thinking`
- استفاده از GLM/MiniMax به‌عنوان پشتیبان ارزان

### انقضای توکن OAuth

OmniRoute به‌طور خودکار توکن‌ها را بازنشانی می‌کند. اگر مشکلات ادامه یافتند:

1. Dashboard → Provider → Reconnect
2. حذف و افزودن مجدد اتصال ارائه‌دهنده

### چند حسابی Kiro: حساب دوم حساب اول را نامعتبر می‌کند

**علت:** بک‌اند Kiro یک نشست فعال به ازای هر ثبت‌نام OIDC client اعمال می‌کند.
هنگامی که دو حساب از همان کلاینت ثبت‌شده استفاده می‌کنند (اتصالات واردشده پیش از v3.8.0)،
بازنشانی توکن یک حساب، refresh token دیگری را باطل می‌کند.

**راه‌حل (v3.8.0+):** اتصالات آسیب‌دیده را دوباره وارد کنید.
از v3.8.0، هر اتصال جدید Kiro ایجاد‌شده از طریق **Import Token**،
**ورود اجتماعی Google/GitHub** یا **Auto-Import** به‌طور خودکار OIDC client اختصاصی خود را
ثبت می‌کند. بنابراین اتصال کاملاً ایزوله است و بازنشانی یک حساب روی هیچ حساب دیگری تأثیری ندارد.

اتصالاتی که _پیش از_ v3.8.0 وارد شده‌اند ثبت‌نام کلاینت به‌ازای اتصال ندارند. این اتصالات
به استفاده از نقطهٔ پایانی مشترک social-auth refresh ادامه می‌دهند. برای بهره‌گیری از
ایزوله‌سازی، اتصال قدیمی را از Dashboard → Providers حذف و از طریق هر یک از سه جریان واردسازی
مجدد اضافه کنید.

برای جزئیات کامل و دستورالعمل گام‌به‌گام برای افزودن دو حساب Kiro کنار هم، به
[`docs/guides/KIRO_SETUP.md`](./KIRO_SETUP.md) مراجعه کنید.

---

## مشکلات ابری

### خطاهای Cloud Sync

1. تأیید کنید `BASE_URL` به نمونهٔ در حال اجرای شما اشاره می‌کند (مثلاً `http://localhost:20128`)
2. تأیید کنید `CLOUD_URL` به نقطهٔ پایانی ابری شما اشاره می‌کند (مثلاً `https://omniroute.dev`)
3. مقادیر `NEXT_PUBLIC_*` را با مقادیر سمت سرور هم‌راستا نگه دارید

### ابر `stream=false` خطای 500 بازمی‌گرداند

**علامت:** `Unexpected token 'd'...` در نقطهٔ پایانی ابری برای فراخوانی‌های غیر streaming.

**علت:** بالادست payload مربوط به SSE را بازمی‌گرداند در حالی که کلاینت JSON انتظار دارد.

**راه‌حل موقت:** برای فراخوانی‌های مستقیم ابری از `stream=true` استفاده کنید. Runtime محلی شامل fallback از SSE به JSON است.

### ابر می‌گوید متصل است اما "Invalid API key"

1. یک کلید تازه از داشبورد محلی ایجاد کنید (`/api/keys`)
2. اجرای cloud sync: Enable Cloud → Sync Now
3. کلیدهای قدیمی/غیر همگام‌شده همچنان می‌توانند در ابر `401` بازگردانند

---

## مشکلات Docker

### ابزار CLI نشان می‌دهد نصب نشده است

1. فیلدهای runtime را بررسی کنید: `curl http://localhost:20128/api/cli-tools/runtime/codex | jq`
2. برای حالت portable: از target ایمیج `runner-cli` استفاده کنید (CLIهای همراه)
3. برای حالت host mount: `CLI_EXTRA_PATHS` را تنظیم و شاخهٔ bin میزبان را به‌صورت فقط‌خواندنی mount کنید
4. اگر `installed=true` و `runnable=false`: باینری یافت شد اما در healthcheck شکست خورد

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
2. مدل اصلی را به GLM/MiniMax سوئیچ کنید
3. برای وظایف غیرحیاتی از tier رایگان (Qoder، Kiro) استفاده کنید
4. بودجهٔ هزینه به ازای کلید API تنظیم کنید: Dashboard → API Keys → Budget

---

## اشکال‌زدایی

### فعال‌سازی فایل‌های لاگ

`APP_LOG_TO_FILE=true` را در فایل `.env` خود تنظیم کنید. لاگ‌های برنامه تحت `logs/` نوشته می‌شوند.
مصنوعات درخواست هنگام فعال بودن خط لولهٔ call log در تنظیمات تحت `${DATA_DIR}/call_logs/` ذخیره می‌شوند.
هنگام فعال بودن ضبط خط لوله، `CALL_LOG_PIPELINE_CAPTURE_STREAM_CHUNKS=false` را تنظیم کنید تا
payloadهای chunk جریان حذف شوند، یا `CALL_LOG_PIPELINE_MAX_SIZE_KB` را برای تغییر سقف مصنوعات بر حسب KB تنظیم کنید.

### بررسی سلامت ارائه‌دهنده

```bash
# Health dashboard
http://localhost:20128/dashboard/health

# API health check
curl http://localhost:20128/api/monitoring/health
```

### ذخیره‌سازی runtime

- وضعیت اصلی: `${DATA_DIR}/storage.sqlite` (ارائه‌دهنده‌ها، کامبوها، نام‌های مستعار، کلیدها، تنظیمات)
- استفاده: جداول SQLite در `storage.sqlite` (`usage_history`، `call_logs`، `proxy_logs`) + اختیاری `${DATA_DIR}/call_logs/`
- لاگ‌های برنامه: `<repo>/logs/...` (هنگامی که `APP_LOG_TO_FILE=true`)
- مصنوعات call log: `${DATA_DIR}/call_logs/YYYY-MM-DD/...` هنگامی که خط لولهٔ call log فعال باشد

اکشن **Clean history** در صفحهٔ Request Logs، `call_logs`، `request_detail_logs` قدیمی و شاخهٔ
مصنوعات محلی `${DATA_DIR}/call_logs/` را پاک می‌کند.

---

## مشکلات Circuit Breaker

### ارائه‌دهنده در حالت OPEN گیر کرده است

هنگامی که circuit breaker یک ارائه‌دهنده OPEN است، درخواست‌ها تا انقضای cooldown مسدود می‌شوند.

**راه‌حل:**

1. به **Dashboard → Settings → Resilience** بروید
2. کارت circuit breaker را برای ارائه‌دهندهٔ آسیب‌دیده بررسی کنید
3. روی **Reset All** کلیک کنید تا همه breakerها پاک شوند، یا صبر کنید تا cooldown منقضی شود
4. پیش از بازنشانی تأیید کنید که ارائه‌دهنده واقعاً در دسترس است

### ارائه‌دهنده مدام circuit breaker را فعال می‌کند

اگر یک ارائه‌دهنده به‌طور مکرر وارد حالت OPEN می‌شود:

1. **Dashboard → Health → Provider Health** را برای الگوی شکست بررسی کنید
2. به **Settings → Resilience → Provider Profiles** بروید و آستانهٔ شکست را افزایش دهید
3. بررسی کنید که آیا ارائه‌دهنده محدودیت‌های API را تغییر داده یا نیازمند احراز هویت مجدد است
4. تله‌متری latency را بازبینی کنید — latency بالا ممکن است باعث شکست‌های مبتنی بر timeout شود

---

## مشکلات Audio Transcription

### خطای "Unsupported model"

- مطمئن شوید از پیشوند صحیح استفاده می‌کنید: `deepgram/nova-3` یا `assemblyai/best`
- تأیید کنید که ارائه‌دهنده در **Dashboard → Providers** متصل است

### transcription خالی بازمی‌گرداند یا شکست می‌خورد

- قالب‌های صوتی پشتیبانی‌شده را بررسی کنید: `mp3`، `wav`، `m4a`، `flac`، `ogg`، `webm`
- تأیید کنید اندازهٔ فایل در محدودیت‌های ارائه‌دهنده است (معمولاً < 25MB)
- اعتبار کلید API ارائه‌دهنده را در کارت ارائه‌دهنده بررسی کنید

---

## اشکال‌زدایی Translator

برای اشکال‌زدایی مسائل ترجمهٔ قالب از **Dashboard → Translator** استفاده کنید:

| حالت             | چه زمان استفاده کنید                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Playground**   | مقایسهٔ قالب‌های ورودی/خروجی کنار هم — یک درخواست شکست‌خورده را جای‌گذاری کنید تا نحوهٔ ترجمه را ببینید |
| **Chat Tester**  | ارسال پیام‌های زنده و بررسی payload کامل درخواست/پاسخ شامل هدرها                                       |
| **Test Bench**   | اجرای آزمون‌های دسته‌ای در میان ترکیب‌های قالب برای یافتن ترجمه‌های شکست‌خورده                          |
| **Live Monitor** | تماشای جریان بلادرنگ درخواست برای گرفتن مسائل ترجمهٔ متناوب                                            |

### مسائل قالب رایج

- **ظاهر نشدن thinking tagها** — بررسی کنید که آیا ارائه‌دهندهٔ هدف از thinking پشتیبانی می‌کند و تنظیم thinking budget
- **افت tool callها** — برخی ترجمه‌های قالب ممکن است فیلدهای پشتیبانی‌نشده را حذف کنند؛ در حالت Playground تأیید کنید
- **گم شدن system prompt** — Claude و Gemini system promptها را متفاوت مدیریت می‌کنند؛ خروجی ترجمه را بررسی کنید
- **SDK رشتهٔ خام به‌جای object بازمی‌گرداند** — در v1.x حل شده؛ پاک‌کنندهٔ پاسخ فیلدهای غیراستاندارد (`x_groq`، `usage_breakdown` و...) را که باعث شکست اعتبارسنجی Pydantic SDK مربوط به OpenAI می‌شوند حذف می‌کند. اگر هنوز روی v3.x+ این را می‌بینید، لطفاً یک issue ثبت کنید.
- **GLM/ERNIE نقش `system` را رد می‌کند** — در v1.x حل شده؛ نرمالایزر نقش به‌طور خودکار پیام‌های سیستمی را برای مدل‌های ناسازگار در پیام‌های کاربر ادغام می‌کند. اگر هنوز روی v3.x+ این را می‌بینید، لطفاً یک issue ثبت کنید.
- **نقش `developer` شناخته نمی‌شود** — در v1.x حل شده؛ به‌طور خودکار به `system` برای ارائه‌دهنده‌های غیر OpenAI تبدیل می‌شود. اگر هنوز روی v3.x+ این را می‌بینید، لطفاً یک issue ثبت کنید.
- **`json_schema` با Gemini کار نمی‌کند** — در v1.x حل شده؛ `response_format` اکنون به `responseMimeType` + `responseSchema` مربوط به Gemini تبدیل می‌شود. اگر هنوز روی v3.x+ این را می‌بینید، لطفاً یک issue ثبت کنید.

---

## تنظیمات تاب‌آوری

### rate-limit خودکار راه‌اندازی نمی‌شود

- rate-limit خودکار تنها به ارائه‌دهنده‌های کلید API اعمال می‌شود (نه OAuth/اشتراک)
- تأیید کنید **Settings → Resilience → Provider Profiles** دارای auto-rate-limit فعال است
- بررسی کنید که آیا ارائه‌دهنده کد وضعیت `429` یا هدر `Retry-After` بازمی‌گرداند

### تنظیم backoff نمایی

پروفایل‌های ارائه‌دهنده از این تنظیمات پشتیبانی می‌کنند:

- **تأخیر پایه** — زمان انتظار اولیه پس از اولین شکست (پیش‌فرض: 1s)
- **حداکثر تأخیر** — سقف زمان انتظار (پیش‌فرض: 30s)
- **ضریب** — میزان افزایش تأخیر به ازای هر شکست متوالی (پیش‌فرض: 2x)

### ضد thundering herd

هنگامی که بسیاری از درخواست‌های هم‌زمان به یک ارائه‌دهندهٔ rate-limited می‌رسند، OmniRoute
از mutex + rate-limiting خودکار برای serialize کردن درخواست‌ها و جلوگیری از شکست‌های
آبشاری استفاده می‌کند. این برای ارائه‌دهنده‌های کلید API خودکار است.

---

## Taxonomy اختیاری شکست RAG / LLM (۱۶ مشکل)

برخی کاربران OmniRoute gateway را در جلوی پشته‌های RAG یا agent قرار می‌دهند. در این راه‌اندازی‌ها
مشاهدهٔ یک الگوی عجیب رایج است: OmniRoute سالم به نظر می‌رسد (ارائه‌دهنده‌ها فعال، پروفایل‌های
مسیریابی ok، هیچ هشدار rate limit) اما پاسخ نهایی همچنان اشتباه است.

در عمل این حوادث معمولاً از خط لولهٔ RAG پایین‌دست می‌آیند، نه از خود gateway.

اگر یک واژگان مشترک برای توصیف این شکست‌ها می‌خواهید، می‌توانید از WFGY ProblemMap استفاده
کنید، یک منبع متنی با مجوز MIT خارجی که شانزده الگوی شکست تکرارشوندهٔ RAG / LLM را تعریف می‌کند.
در سطح بالا پوشش می‌دهد:

- drift بازیابی و مرزهای context شکسته
- ایندکس‌ها و vector storeهای خالی یا قدیمی
- عدم تطابق embedding در برابر معنایی
- مسائل مونتاژ prompt و پنجرهٔ context
- فروپاشی منطق و پاسخ‌های بیش‌اعتماد
- شکست‌های هماهنگی chain طولانی و agent
- drift نقش و حافظهٔ multi agent
- مسائل ترتیب استقرار و bootstrap

ایده ساده است:

1. هنگام بررسی یک پاسخ بد، ضبط کنید:
   - وظیفه و درخواست کاربر
   - combo مسیر یا ارائه‌دهنده در OmniRoute
   - هر context مربوط به RAG استفاده‌شده در پایین‌دست (اسناد بازیابی‌شده، tool callها و...)
2. حادثه را به یک یا دو شمارهٔ WFGY ProblemMap نگاشت کنید (`No.1` … `No.16`).
3. شماره را در داشبورد، runbook یا ردیاب حادثهٔ خود کنار لاگ‌های OmniRoute ذخیره کنید.
4. از صفحهٔ WFGY مربوطه استفاده کنید تا تصمیم کنید آیا نیاز به تغییر پشتهٔ RAG، retriever یا
   استراتژی مسیریابی دارید.

متن کامل و دستورالعمل‌های مشخص در اینجا قرار دارد (مجوز MIT، فقط متن):

[WFGY ProblemMap README](https://github.com/onestardao/WFGY/blob/main/ProblemMap/README.md)

اگر RAG یا خطوط لولهٔ agent را پشت OmniRoute اجرا نمی‌کنید، می‌توانید این بخش را نادیده بگیرید.

---

## مسائل شناخته‌شدهٔ v3.8.0

مسائل خاص نسخهٔ v3.8.0 و راه‌حل‌های موقت فعلی آنها. اگر راه‌حلی در patch بعدی منتشر شود،
ورودی به‌روزرسانی یا حذف خواهد شد.

### جریان OAuth Windsurf با 401 شکست می‌خورد

**علامت‌ها:**

- "401 unauthorized" هنگام تکمیل جریان OAuth Windsurf از داشبورد
- کارت ارائه‌دهندهٔ Windsurf پس از callback در وضعیت "needs reconnection" باقی می‌ماند

**علت‌ها:**

- متغیر env `WINDSURF_FIREBASE_API_KEY` گمشده یا خالی
- `WINDSURF_API_KEY` به‌درستی پیکربندی نشده یا به یک توکن قدیمی اشاره می‌کند
- فایروال/پروکسی محلی callback مربوط به OAuth را مسدود می‌کند

**راه‌حل:**

1. تأیید کنید که هم `WINDSURF_FIREBASE_API_KEY` و هم `WINDSURF_API_KEY` در `.env` تنظیم شده‌اند
2. OmniRoute را راه‌اندازی مجدد کنید تا مقادیر env جدید گرفته شوند
3. جریان OAuth را از **Dashboard → Providers → Windsurf → Reconnect** دوباره اجرا کنید

### شکست احراز هویت Devin CLI

**علامت‌ها:**

- "Devin CLI not found" یا "auth failed" هنگام فراخوانی ابزارهای پشتیبان Devin
- بررسی runtime CLI گزارش می‌دهد `installed=false`

**علت‌ها:**

- `CLI_DEVIN_BIN` به مسیری اشاره می‌کند که وجود ندارد
- Devin CLI روی میزبان نصب نیست

**راه‌حل:**

1. Devin CLI را برای پلتفرم خود نصب کنید
2. `CLI_DEVIN_BIN=/usr/local/bin/devin` (یا مسیر واقعی) را در `.env` تنظیم کنید
3. OmniRoute را راه‌اندازی مجدد و از **Dashboard → CLI Tools** دوباره آزمایش کنید

### cooldown مدل گیر کرده (بازنشانی دستی)

**علامت‌ها:**

- یک مدل حتی پس از گذشت زمان انقضا در cooldown فهرست شده باقی می‌ماند
- درخواست‌ها همچنان مدل را در مسیریابی کامبو نادیده می‌گیرند با وجود اینکه مهر زمانی در گذشته است

**بازنشانی دستی:**

- **داشبورد:** **Settings → Model Cooldowns** → روی کارت آسیب‌دیده **Re-enable** کلیک کنید
- **API:** `DELETE /api/resilience/model-cooldowns` با هدرهای احراز هویت مدیریتی

### اتصال ارائه‌دهندهٔ Command Code با 403 شکست می‌خورد

**علامت‌ها:**

- 403 هنگام آزمایش اتصال ارائه‌دهندهٔ Command Code
- کارت ارائه‌دهنده پس از افزودن تازه "unauthorized" نشان می‌دهد

**علت:** جریان OAuth تکمیل نشده (callback دریافت یا توکن ماندگار نشده است).

**راه‌حل:**

- `omniroute providers` را از CLI اجرا کنید تا جریان OAuth دوباره راه‌اندازی شود، یا
- OAuth را از **Dashboard → Providers → Command Code → Reconnect** دوباره اجرا کنید

### ModelScope cooldownهای تهاجمی 429 بازمی‌گرداند

**علامت‌ها:**

- cooldownهای بسیار کوتاه یا فوری روی ModelScope پس از یک burst کوچک درخواست
- مسیریابی کامبو زودتر از انتظار ModelScope را نادیده می‌گیرد

**علت:** ModelScope هدرهای `Retry-After` خاص ارائه‌دهنده منتشر می‌کند. v3.8.0 مدیریت اختصاصی
برای این هدرها ارائه می‌کند، بنابراین نسخه‌های قدیمی‌تر آنها را به‌عنوان hintهای rate-limit
عمومی misinterpret می‌کردند.

**راه‌حل:**

- مطمئن شوید روی v3.8.0 یا جدیدتر هستید
- تأیید کنید toggle `useUpstream429BreakerHints` تحت **Settings → Resilience** فعال است

### OMNIROUTE_WS_BRIDGE_SECRET گمشده در محیط تولیدی

**علامت‌ها:**

- 401 در هر درخواست پل WebSocket مربوط به Codex/Responses هنگام اجرا روی یک میزبان تولیدی راهور
- handshake پل WebSocket بلافاصله پس از اتصال بسته می‌شود

**علت:** متغیر env `OMNIROUTE_WS_BRIDGE_SECRET` از محیط تولیدی گمشده است.

**راه‌حل:**

1. تولید یک راز تصادفی: `openssl rand -hex 32`
2. `OMNIROUTE_WS_BRIDGE_SECRET=<random-secret>` را در env سرور تولیدی (و هر کلاینتی که با پل صحبت می‌کند) تنظیم کنید
3. راه‌اندازی مجدد OmniRoute

### Responses API: حالت پس‌زمینه به هم‌زمان تنزل یافت

**علامت‌ها:**

- هشدار ثبت شده: `background mode degraded to synchronous`
- یک درخواست `background: true` به‌جای handle وظیفهٔ پس‌زمینه، یک پاسخ هم‌زمان عادی بازمی‌گرداند

**علت:** v3.8.0 به‌طور عمدی `background: true` در Responses API را با انتشار یک هشدار به اجرای
هم‌زمان تنزل می‌دهد. اجرای کامل پس‌زمینهٔ async یک deliverable آتی است.

**راه‌حل:**

- کلاینت را تنظیم کنید که بدون `background` فراخوانی کند، یا
- صبر کنید تا نسخهٔ بعدی که اجرای کامل حالت پس‌زمینهٔ async را ارائه می‌کند (changelog را پیگیری کنید)

---

## هنوز گیر کرده‌اید؟

- **GitHub Issues**: [github.com/diegosouzapw/OmniRoute/issues](https://github.com/diegosouzapw/OmniRoute/issues)
- **معماری**: برای جزئیات داخلی به [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) مراجعه کنید
- **مرجع API**: برای تمام نقاط پایانی به [`docs/reference/API_REFERENCE.md`](../reference/API_REFERENCE.md) مراجعه کنید
- **داشبورد سلامت**: برای وضعیت بلادرنگ سامانه **Dashboard → Health** را بررسی کنید
- **Translator**: برای اشکال‌زدایی مسائل قالب از **Dashboard → Translator** استفاده کنید
