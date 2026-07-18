---
title: "راهنمای تونل‌ها"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای تونل‌ها

> **منبع حقیقت:** `src/lib/{cloudflaredTunnel,ngrokTunnel,tailscaleTunnel}.ts`، `src/app/api/tunnels/`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

RouteChi می‌تواند سرور محلی خود (`http://localhost:20128`) را به اینترنت
عمومی ازطریق سه backend تونل در معرض دید قرار دهد. این برای موارد زیر مفید است:

- callbackهای OAuth از ارائه‌دهندگان ابری (Antigravity، Gemini، Cursor) که به یک
  URL تغییرمسیر قابل‌دسترس عمومی نیاز دارند.
- اشتراک‌گذاری نمونهٔ محلی‌تان با هم‌تیمی‌ها بدون استقرار یک VM.
- آزمایش موبایل، ازراه‌دور یا کراس‌شبکه.

هر سه backend درون فرایند مدیریت می‌شوند — RouteChi باینری یا SDK زیرین را
ازطریق داشبورد یا REST API شروع/متوقف می‌کند. هیچ راه‌اندازی reverse-proxy یا systemd لازم نیست.

## Backendها در یک نگاه

| Backend                     | ماندگاری                                              | هزینه             | راه‌اندازی                                       |
| --------------------------- | ----------------------------------------------------- | ----------------- | ------------------------------------------------ |
| **Cloudflare Quick Tunnel** | موقتی (URL در هر راه‌اندازی تغییر می‌کند)             | رایگان            | صفر — `cloudflared` را خودکار نصب می‌کند          |
| **ngrok**                   | پایدار هنگام پیکربندی طرح پولی یا دامنهٔ ثابت         | رایگان + پولی     | نیازمند حساب ngrok + authtoken                   |
| **Tailscale Funnel**        | پایدار به‌ازای گره در tailnet شما                     | رایگان برای شخصی  | نیازمند نصب Tailscale + login + Funnel ACL       |

پیاده‌سازی‌ها در `src/lib/cloudflaredTunnel.ts`،
`src/lib/ngrokTunnel.ts` و `src/lib/tailscaleTunnel.ts` قرار دارند. هر سه یک
شیء `status` با شکل مشترک با فیلدهای `phase`، `running`، `publicUrl`، `apiUrl`،
`targetUrl` و `lastError` بازمی‌گردانند، تا داشبورد بتواند به‌صورت یکنواخت آن‌ها را نمایش دهد.

## ۱. تونل Cloudflare (Quick Tunnel)

فایل `src/lib/cloudflaredTunnel.ts` دستور `cloudflared tunnel --url
http://localhost:<apiPort>` را به‌عنوان یک فرایند فرزند اجرا می‌کند و URL اختصاص‌یافتهٔ
`*.trycloudflare.com` را از stdout تجزیه می‌کند.

رفتارهای کلیدی:

- **نصب خودکار.** در اولین استفاده، RouteChi جدیدترین باینری `cloudflared`
  را از releaseهای رسمی گیت‌هاب دانلود می‌کند (نصب مدیریت‌شده در
  `DATA_DIR/cloudflared/` قرار دارد). SHA256 دارایی دانلودی پیش از اجرا در برابر
  مانیفست release راستی‌آزمایی می‌شود.
- **فقط Quick-tunnel.** پیاده‌سازی فعلی فقط
  quick-tunnel به سبک `--url` را اجرا می‌کند. تونل‌های نام‌دار/پایدار (`cloudflared tunnel
  login` + `cloudflared tunnel route dns ...`) توسط
  RouteChi هماهنگ نمی‌شوند. URLها موقتی‌اند و در هر راه‌اندازی تغییر می‌کنند.
- **نظارت بر فرایند.** PID و URL حل‌شدهٔ cloudflared در
  `cloudflared-state.json` ماندگار می‌شود تا داشبورد بتواند وضعیت را در طول reloadها بازیابی کند.

### فعال/غیرفعال‌سازی ازطریق REST

این نقطهٔ پایانی از یک بدنهٔ `{action: "enable" | "disable"}` استفاده می‌کند، نه مسیرهای
مجزای `start`/`stop`. احراز مدیریت (نشست ادمین یا API key ادمین) لازم است.

```bash
# Enable
curl -X POST http://localhost:20128/api/tunnels/cloudflared \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=..." \
  -d '{"action":"enable"}'

# Status
curl http://localhost:20128/api/tunnels/cloudflared \
  -H "Cookie: auth_token=..."

# Disable
curl -X POST http://localhost:20128/api/tunnels/cloudflared \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=..." \
  -d '{"action":"disable"}'
```

یا ازطریق داشبورد: **Settings → Tunnels → Cloudflare**.

### متغیرهای محیطی اختیاری

| متغیر                                                | هدف                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `CLOUDFLARED_BIN`                                    | بازنویسی مسیر باینری. اگر تنظیم و معتبر باشد، RouteChi به‌جای دانلود از آن استفاده می‌کند. |
| `CLOUDFLARED_PROTOCOL` / `TUNNEL_TRANSPORT_PROTOCOL` | پروتکل انتقال (پیش‌فرض `http2`).                                                   |

## ۲. ngrok

فایل `src/lib/ngrokTunnel.ts` از **SDK `@ngrok/ngrok`** استفاده می‌کند (درون فرایند، بدون subprocess CLI).
ماژول بومی به‌صورت تنبل در اولین شروع import می‌شود تا پلتفرم‌های
بدون باینری از پیش‌ساخته‌شده، اپ را هنگام بوت نشکنند.

### پیش‌نیازها

۱. در <https://ngrok.com> ثبت‌نام کنید.
۲. authtoken خود را از داشبورد ngrok کپی کنید.
۳. آن را ازطریق یکی از روش‌های زیر ارائه دهید:
   - `.env`: `NGROK_AUTHTOKEN=<token>`، یا
   - داشبورد: **Settings → Tunnels → ngrok**، یا
   - بدنهٔ REST (یک‌باره): `{"action":"enable","authToken":"<token>"}`.

اگر هیچ‌کدام پیکربندی نشده باشد، وضعیت `phase: "needs_auth"` بازمی‌گرداند.

### فعال/غیرفعال‌سازی ازطریق REST

```bash
# Enable (uses NGROK_AUTHTOKEN from env)
curl -X POST http://localhost:20128/api/tunnels/ngrok \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=..." \
  -d '{"action":"enable"}'

# Enable with inline token
curl -X POST http://localhost:20128/api/tunnels/ngrok \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=..." \
  -d '{"action":"enable","authToken":"2abc..."}'

# Status
curl http://localhost:20128/api/tunnels/ngrok \
  -H "Cookie: auth_token=..."

# Disable
curl -X POST http://localhost:20128/api/tunnels/ngrok \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=..." \
  -d '{"action":"disable"}'
```

پاسخ شامل `publicUrl` اختصاص‌یافته است (مثلاً
`https://abcd-1234.ngrok-free.app`). دامنه‌های سفارشی، مناطق و قواعد policy
باید در داشبورد ngrok پیکربندی شوند — خود RouteChi فقط
URL هدف محلی را به SDK پاس می‌دهد.

## ۳. Tailscale Funnel

فایل `src/lib/tailscaleTunnel.ts` CLI سیستمی `tailscale` را هماهنگ می‌کند تا پورت
API محلی را ازطریق **Funnel** (خروجی اینترنت عمومی Tailscale برای serve) در معرض دید قرار دهد.
این ماژول از چرخهٔ حیات کامل پشتیبانی می‌کند: نصب، login، شروع daemon، فعال‌سازی، غیرفعال‌سازی.

پیاده‌سازی `tailscale funnel --bg <port>` را (حالت پس‌زمینه) فراخوانی می‌کند. URL
عمومی به شکل `https://<machine>.<tailnet>.ts.net/` است.

### پیش‌نیازها

۱. Tailscale را نصب کنید (یا بگذارید RouteChi این کار را انجام دهد — ر.ک. نقطهٔ پایانی `install` زیر).
۲. وارد شوید (`tailscale login` یا ازطریق نقطهٔ پایانی `login` در RouteChi).
۳. Funnel را برای tailnet خود در کنسول مدیریت Tailscale فعال کنید:
   <https://login.tailscale.com/admin/settings/features>.

در Linux و macOS، daemon (`tailscaled`) برای کنترل نیازمند `sudo` است. نقاط پایانی
POST یک فیلد اختیاری `sudoPassword` می‌پذیرند که برای مدت فراخوانی به
کش گذرواژهٔ MITM در RouteChi (`getCachedPassword` / `setCachedPassword`) پاس داده می‌شود. ویندوز از نصب سرویس پیش‌فرض در
`C:\Program Files\Tailscale\tailscale.exe` استفاده می‌کند.

### نقاط پایانی REST

Tailscale سطح غنی‌تری نسبت به سایر backendها دارد زیرا نصب،
login، daemon و تونل مسائل مجزایی هستند.

| نقطهٔ پایانی                          | روش    | هدف                                                              |
| ------------------------------------- | ------ | ---------------------------------------------------------------- |
| `/api/tunnels/tailscale`              | `GET`  | وضعیت تجمیعی تونل (`phase`، `tunnelUrl`، `apiUrl` و غیره)        |
| `/api/tunnels/tailscale/check`        | `GET`  | بررسی سطح پایین‌تر: نصب‌شده؟ وارد‌شده؟ daemon در حال اجرا؟       |
| `/api/tunnels/tailscale/install`      | `POST` | نصب Tailscale (رویدادهای پیشرفت SSE) — Linux/macOS               |
| `/api/tunnels/tailscale/start-daemon` | `POST` | شروع `tailscaled` در Linux/macOS                                 |
| `/api/tunnels/tailscale/login`        | `POST` | شروع جریان login؛ `authUrl` را برای باز کردن در مرورگر بازمی‌گرداند |
| `/api/tunnels/tailscale/enable`       | `POST` | شروع Funnel برای پورت API                                        |
| `/api/tunnels/tailscale/disable`      | `POST` | توقف Funnel                                                      |

همهٔ نقاط پایانی Tailscale نیازمند احراز مدیریت هستند (ر.ک. `routeUtils.ts ::
requireTailscaleAuth`).

نمونهٔ فعال‌سازی:

```bash
curl -X POST http://localhost:20128/api/tunnels/tailscale/enable \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=..." \
  -d '{"sudoPassword":"<linux-pwd>","port":20128}'
```

اگر Funnel در کنسول مدیریت فعال نباشد، پاسخ شامل
`funnelNotEnabled: true` به‌همراه یک `enableUrl` برای باز کردن در مرورگر است.

### متغیرهای محیطی اختیاری

| متغیر          | هدف                                |
| -------------- | ---------------------------------- |
| `TAILSCALE_BIN`| بازنویسی مسیر باینری `tailscale`   |

## خلاصهٔ نقاط پایانی

| نقطهٔ پایانی                          | روش    | بدنه                                | احراز      |
| ------------------------------------- | ------ | ----------------------------------- | ---------- |
| `/api/tunnels/cloudflared`            | `GET`  | —                                   | مدیریت     |
| `/api/tunnels/cloudflared`            | `POST` | `{action: "enable" \| "disable"}`   | مدیریت     |
| `/api/tunnels/ngrok`                  | `GET`  | —                                   | مدیریت     |
| `/api/tunnels/ngrok`                  | `POST` | `{action, authToken?}`              | مدیریت     |
| `/api/tunnels/tailscale`              | `GET`  | —                                   | مدیریت     |
| `/api/tunnels/tailscale/check`        | `GET`  | —                                   | مدیریت     |
| `/api/tunnels/tailscale/install`      | `POST` | `{sudoPassword?}` (SSE)             | مدیریت     |
| `/api/tunnels/tailscale/start-daemon` | `POST` | `{sudoPassword?}`                   | مدیریت     |
| `/api/tunnels/tailscale/login`        | `POST` | `{hostname?}`                       | مدیریت     |
| `/api/tunnels/tailscale/enable`       | `POST` | `{sudoPassword?, hostname?, port?}` | مدیریت     |
| `/api/tunnels/tailscale/disable`      | `POST` | `{sudoPassword?}`                   | مدیریت     |

هیچ نقطهٔ پایانی مرکزی `/api/settings/tunnels` وجود ندارد — هر backend
مستقل است.

## ملاحظات callback OAuth

هنگامی که RouteChi را ازطریق یک تونل در معرض دید قرار می‌دهید، داشبورد و جریان‌های OAuth باید
URLهای callback را بر اساس نام میزبان **عمومی** بسازند، نه `localhost`. در غیر این‌صورت
ارائه‌دهندهٔ OAuth کاربر را به URLای تغییرمسیر می‌دهد که سرورهایش نمی‌توانند به آن برسند،
و handshake شکست می‌خورد.

ویرایش‌های داشبورد و ذخیرهٔ تنظیمات نیازی به سنجاق‌کردن نام میزبان تونل در
`NEXT_PUBLIC_BASE_URL` ندارند. داشبورد احراز‌شده درخواست‌های same-origin ناامن را با یک
توکن CSRF وابسته به نشست می‌فرستد، پس میزبان‌های موقتی Cloudflare Quick Tunnel
هنوز برای مدیریت عادی UI پس از ورود قابل استفاده‌اند.

تنظیم کنید:

```bash
NEXT_PUBLIC_BASE_URL=https://<your-tunnel-host>
```

و RouteChi را پیش از شروع OAuth راه‌اندازی مجدد کنید. برای تونل‌های موقتی Cloudflare Quick
URL پس از هر راه‌اندازی تغییر می‌کند، پس برای استفادهٔ OAuth عملیاتی، ngrok با یک دامنهٔ
رزرو‌شده یا Tailscale Funnel را ترجیح دهید.

## سلامت و پایش

داشبورد وضعیت تونل را در **Settings → Tunnels** نمایش می‌دهد:

- backend(های) فعال و `phase` فعلی (`stopped`، `starting`، `running`،
  `needs_auth`، `error`).
- URL عمومی فعلی و URL API مشتق‌شده (`<publicUrl>/v1`).
- URL هدف محلی که تونل به آن پاس می‌دهد.
- آخرین پیام خطا، در صورت وجود.

برای پایش برنامه‌نویسی‌شده، نقاط پایانی `GET` هر backend را poll کنید. اجرای همزمان بیش از یک backend مجاز است؛ RouteChi هرکدام را به‌صورت
مستقل ردیابی می‌کند.

## عیب‌یابی

### «cloudflared binary not found»

RouteChi تلاش می‌کند در اولین استفاده به‌صورت خودکار نصب کند. اگر نصب مسدود شده باشد
(شبکهٔ محدود، بدون دسترسی گیت‌هاب)، `cloudflared` را به‌صورت دستی از
<https://github.com/cloudflare/cloudflared/releases> دانلود کنید و
`CLOUDFLARED_BIN=/path/to/cloudflared` را تنظیم کنید.

### «ngrok: authtoken required»

`phase: "needs_auth"` یعنی هیچ authtokenی یافت نشد. `NGROK_AUTHTOKEN` را در
`.env` تنظیم کنید، ازطریق داشبورد پیکربندی کنید، یا `authToken` را در بدنهٔ POST فعال‌سازی
بفرستید.

### «tailscale: funnel not enabled»

هنگامی که پاسخ فعال‌سازی شامل `funnelNotEnabled: true` است، Funnel برای
tailnet شما غیرفعال است. `enableUrl` بازگشتی (یا صفحهٔ ویژگی کنسول مدیریت)
را باز کنید و Funnel را روشن کنید.

### تغییر URL تونل OAuth را می‌شکند

از ngrok با یک دامنهٔ رزرو‌شده یا Tailscale Funnel (هر دو پایدار به‌ازای گره) استفاده کنید.
Cloudflare Quick Tunnel بر اساس طراحی موقتی است و برای
callbackهای OAuth طولانی‌مدت توصیه نمی‌شود.

### خطای permission denied در Linux/macOS برای Tailscale

`tailscaled` به root نیاز دارد. `sudoPassword` را به نقطهٔ پایانی POST مربوطه بدهید،
یا خودتان daemon را اجرا کنید (`sudo systemctl start tailscaled`).

## مطالعهٔ بیشتر

- [PROXY_GUIDE.md](./PROXY_GUIDE.md) — پراکسی خروجی (1proxy، SOCKS5، HTTP) برای
  ترافیک egress.
- [ENVIRONMENT.md](../reference/ENVIRONMENT.md) — فهرست کامل متغیرهای محیطی شامل
  `NEXT_PUBLIC_BASE_URL`.
- [FLY_IO_DEPLOYMENT_GUIDE.md](./FLY_IO_DEPLOYMENT_GUIDE.md)،
  [DOCKER_GUIDE.md](../guides/DOCKER_GUIDE.md) — جایگزین‌های تونل‌زنی برای میزبانی عمومی
  پایدار.
- منبع: `src/lib/{cloudflaredTunnel,ngrokTunnel,tailscaleTunnel}.ts`،
  `src/app/api/tunnels/`.
