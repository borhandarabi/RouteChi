---
title: "Stealth Guide"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای مخفی‌کاری

> **منبع حقیقت:** `open-sse/utils/tlsClient.ts`, `open-sse/services/{chatgptTlsClient,claudeCodeCCH,claudeCodeFingerprint,claudeCodeObfuscation,claudeCodeCompatible,antigravityObfuscation}.ts`, `open-sse/config/cliFingerprints.ts`, `src/mitm/`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40
> **مخاطب:** مهندسانی که ادغام‌های مخفی‌کاری به‌ازای ارائه‌دهنده را نگه‌داری می‌کنند.

RouteChi با ارائه‌دهندگانی ادغام می‌شود که لبه‌های آن‌ها به‌طور فعال کلاینت‌های غیررسمی را اثر انگشتی می‌کنند (TLS JA3/JA4، ترتیب هدر، شکل بدنه JSON، توکن‌های یکپارچگی). این صفحه سطوح مخفی‌کاری که RouteChi افشا می‌کند و جایی که پیاده‌سازی شده‌اند را مستند می‌کند.

## اعلام قانونی و اخلاقی

ویژگی‌های مخفی‌کاری وجود دارند تا RouteChi بتواند به‌عنوان یک لایه سازگاری بین حساب‌های رسمی متعلق به کاربر (Claude Code CLI, ChatGPT Desktop/Web, Antigravity, Cursor و غیره) و API یکپارچه RouteChi عمل کند. این ویژگی‌ها **برای** دور زدن تشخیص تقلب، اشتراک‌گذاری اعتبارنامه یا نقض شرایط خدمات ارائه‌دهنده **نیستند**. نگهدارندگان انتظار دارند اپراتورها با ToS آپ‌استریمی که هنگام ایجاد حساب امضا کرده‌اند، انطباق داشته باشند.

---

## لایه اثر انگشتی TLS

### `open-sse/utils/tlsClient.ts` — wreq-js (Chrome 124)

نشست `wreq-js` با بارگذاری تنبل که **Chrome 124 روی macOS** را جعل می‌کند. به‌عنوان یک wrapper عمومی JA3/JA4 برای آپ‌استریم‌های پشت Cloudflare استفاده می‌شود. وقتی `wreq-js` نصب نیست به fetch بومی برمی‌گردد (`available = false`).

- نشست تک‌نمونه: `browser: "chrome_124", os: "macos"`
- رزولوشن پراکسی (اولویت): `HTTPS_PROXY` → `HTTP_PROXY` → `ALL_PROXY` (همچنین حروف کوچک)
- timeout: `TLS_CLIENT_TIMEOUT_MS` (از `FETCH_TIMEOUT_MS` ارث می‌برد، پیش‌فرض 600000)
- Response از `wreq-js` با fetch سازگار است (`headers`, `text()`, `json()`, `clone()`, `body`).

### `open-sse/services/chatgptTlsClient.ts` — tls-client-node (Firefox 148)

جعل‌کننده TLS اختصاصی برای `chatgpt.com`. پیکربندی Cloudflare در ChatGPT `cf_clearance` را به ترتیب فریم JA3/JA4 + SETTINGS HTTP/2 پین می‌کند — handshake undici حتی با cookieهای معتبر `cf-mitigated: challenge` دریافت می‌کند.

- پروفایل: `firefox_148` (باید با `User-Agent` Firefox 148 ارسال‌شده تطابق داشته باشد)
- حالت: `runtimeMode: "native"` (کتابخانه مشترک koffi-loaded؛ از HTTP sidecar مدیریت‌شده اجتناب می‌کند)
- `withRandomTLSExtensionOrder: true`
- `tlsFetchChatGpt(url, options)` از streaming پشتیبانی می‌کند (بدنه را به فایل temp می‌نویسد، به‌عنوان `ReadableStream` tail می‌شود)
- تشخیص hang: `raceWithTimeout` + `TlsClientHangError` `resetClientCache()` را تحریک می‌کند تا فراخوانی بعدی binding را دوباره spawn کند
- رزولوشن پراکسی (اولویت): `proxyUrl` به‌ازای فراخوانی → `OMNIROUTE_TLS_PROXY_URL` → `HTTPS_PROXY`/`HTTP_PROXY`/`ALL_PROXY` (binding بومی خودش این envها را **نمی‌خواند**؛ باید از طریق آن thread شود)
- خطاها: `TlsClientUnavailableError` (باینری مفقود)، `TlsClientHangError` (binding deadlock شده)

---

## باندل مخفی‌کاری Claude Code

وقتی `cliCompatMode` روشن است، RouteChi درخواست‌های خروجی Claude را به‌گونه‌ای بازشکل می‌دهد که از ترافیک `claude-cli` غیرقابل‌تمایز باشند. سه ماژول همکاری می‌کنند:

### `claudeCodeFingerprint.ts`

اثر انگشتی `cc_version` ۳ کاراکتری embed‌شده در هدر صورت‌حساب را محاسبه می‌کند:

```
SHA256(SALT + msg[4] + msg[7] + msg[20] + version)[:3]
```

- `FINGERPRINT_SALT = "59cf53e54c78"` (hardcode‌شده؛ با کلاینت رسمی تطابق دارد)
- ورودی‌ها: نویسه‌های ایندکس 4, 7, 20 از متن اولین پیام کاربر + رشته نسخه
- خروجی: پیشوند hex ۳ کاراکتری

### `claudeCodeCCH.ts` (Client Content Hash)

بررسی یکپارچگی سمت سرور که کلاینت رسمی Claude Code CLI از طریق Bun/Zig محاسبه می‌کند. RouteChi را با `xxhash-wasm` دوباره پیاده‌سازی می‌کند:

1. بدنه را با placeholder `cch=00000;` سریالایز کنید
2. `xxhash64(bytes, seed) & 0xFFFFF`
3. hex با حروف کوچک ۵ کاراکتری با padding صفر
4. `cch=00000;` را با توکن محاسبه‌شده جایگزین کنید

ثابت‌ها:

- Seed: `0x6e52736ac806831e`
- الگو: `/\bcch=([0-9a-f]{5});/`

### `claudeCodeObfuscation.ts`

یک **zero-width joiner** یونیکد (`U+200D`) را بعد از اولین نویسه نام‌های کلاینت «حساس» درج می‌کند تا فیلترهای آپ‌استریم نتوانند آن‌ها را grep کنند. فهرست کلمات پیش‌فرض:

```
opencode, open-code, cline, roo-cline, roo_cline, cursor, windsurf,
aider, continue.dev, copilot, avante, codecompanion
```

اعمال‌شده بر: بلوک‌های `system`، همه `messages[].content`، و `tools[].description` / `tools[].function.description`. قابل لغو توسط اپراتور از طریق `setSensitiveWords()`.

### `claudeCodeCompatible.ts` — ارائه‌دهندگان `anthropic-compatible-cc-*`

برای رله‌های Anthropic شخص ثالث که فقط ترافیک «Claude Code واقعی» را می‌پذیرند:

- `CLAUDE_CODE_COMPATIBLE_USER_AGENT = "claude-cli/2.1.207 (external, sdk-cli)"`
- `CLAUDE_CODE_COMPATIBLE_STAINLESS_PACKAGE_VERSION = "0.94.0"`
- `CLAUDE_CODE_COMPATIBLE_STAINLESS_RUNTIME_VERSION = "v24.3.0"`
- `anthropic-beta = "claude-code-20250219,interleaved-thinking-2025-05-14,effort-2025-11-24"` به‌طور پیش‌فرض
- تگل «Enable redact-thinking beta» به‌ازای اتصال `redact-thinking-2026-02-12` را وقتی یک آپ‌استریم CC Compatible به‌طور خاص به جریان‌های thinking سانسور‌شده نیاز دارد، اضافه می‌کند
- تگل «Enable summarized thinking display» به‌ازای اتصال `providerSpecificData.requestDefaults.summarizeThinking` را ذخیره می‌کند و `display: "summarized"` را به درخواست‌های thinking CC Compatible که هنوز حالت display را تنظیم نکرده‌اند، اضافه می‌کند
- `CONTEXT_1M_BETA_HEADER = "context-1m-2025-08-07"` (خانواده Opus/Sonnet 4.x)
- مسیر پیش‌فرض: `/v1/messages?beta=true`

ماژول‌های خواهر در همان باندل:

- `claudeCodeConstraints.ts` — قواعد temperature + cache-control
- `claudeCodeToolRemapper.ts` — بازنگاشت نام ابزار
- `claudeCodeExtraRemap.ts` — نرمالایز کردن payload اضافی

---

## مخفی‌کاری Antigravity

### `antigravityObfuscation.ts`

همان ترفند zero-width-joiner مانند Claude Code، اما با یک فهرست کلمات گسترش‌یافته که همچنین ماسک می‌کند: `claude code`, `claude-code`, `kilo code`, `kilocode`, **`omniroute`**. آینه‌ای از `ZEROGRAVITY_SENSITIVE_WORDS` در ZeroGravity و سیستم cloak در CLIProxyAPI.

### `antigravityHeaderScrub.ts`

نشانگرهای SDK Stainless (`x-stainless-lang`, `x-stainless-package-version`, `x-stainless-os`, `x-stainless-arch`, `x-stainless-runtime`, `x-stainless-runtime-version`, `x-stainless-timeout`, `x-stainless-retry-count`, `x-stainless-helper-method`) را پیش از فوروارد حذف می‌کند.

### ⚠️ ریسک: `ANTIGRAVITY_CREDITS=always` (نقطه داغ مسدودی حساب)

`ANTIGRAVITY_CREDITS=always` (مصرف‌شده توسط `open-sse/executors/antigravity.ts`) **هر** درخواست را از طریق Antigravity AI Credit Overages (اعتبارهای Google پولی) مسیری می‌کند به جای اینکه اجازه دهد سهمیه free-tier گوگل چیزها را گیت کند. این به‌عنوان یک ویژگی مستند شده، اما **شایع‌ترین گزارش نقض ToS است که می‌بینیم** — چندین حساب Google Ultra پس از اجرای چند ساعته با `=always` با `403 / "service disabled for ToS violation" / insufficient_quota` مسدود شده‌اند.

اعمال آپ‌استریم **سمت Google** است، نه چیزی که RouteChi بتواند جلوگیری کند. نام متغیر env و مستندات موجود آن را به‌عنوان یک knob امن برای flip کردن جلوه می‌دهند؛ این‌طور نیست.

**چرا این تشخیص سوءاستفاده را به‌شدت‌تر از استفاده فقط‌free-tier جذب می‌کند:**

- هزینه خودکار پایدار روی یک حساب Google متفاوت از free-tier که سهمیه‌اش تمام می‌شود و متوقف می‌شود، پرچم می‌خورد.
- اعتبار overages هیچ سقف نرخی ندارد، پس یک کلاینت اشتباه پیکربندی‌شده می‌تواند چندصد دلار را در چند دقیقه بسوزاند و شبیه فروش مجدد کلید API یا ترافیک bot به نظر برسد.
- چندین کاربر RouteChi که به‌موازات از overage credits از همان IP خارجی استفاده می‌کنند، سیگنال را تشدید می‌کنند.

**وضعیت توصیه‌شده:**

1. **پیش‌فرض به `ANTIGRAVITY_CREDITS=retry`** — overages فقط وقتی free-tier 429 برمی‌گرداند استفاده می‌شوند، نه در هر درخواست. این امن‌تر از دو حالت غیر صفر است.
2. **بار را بین ارائه‌دهندگان از طریق Auto-Combo پخش کنید** (`model: "auto"` یا `kr/glm/etc`-combo) به جای اشباع یک حساب Antigravity.
3. **محدودیت‌های RPM به‌ازای اتصال** را در صفحه ویرایش ارائه‌دهنده Antigravity تنظیم کنید (Dashboard → Providers → Antigravity → connection → rate limit). ۳۰–۶۰ RPM یک حد بالای قابل‌دفاع برای استفاده پایدار است.
4. **از IPهای آپ‌استریم متمایز** به‌ازای حساب Antigravity وقتی ممکن است استفاده کنید (پراکسی‌های مسکونی هدف‌گرفته همان حساب از سوی بسیاری از کاربران سیگنال سوءاستفاده را تشدید می‌کنند).
5. **اگر مسدود شدید**: از طریق `support.google.com` → «Restore Workspace/Account access» با بدنه پاسخ دقیق `quota_exceeded` / `service disabled` که Google ارسال کرده، درخواست تجدید نظر کنید. بازیابی تضمین‌شده نیست.

این هشدار همچنین به‌صورت درون‌خطی در داشبورد نزد صفحه ویرایش ارائه‌دهنده Antigravity وقتی `ANTIGRAVITY_CREDITS` روی `always` تنظیم شده (یا در v3.8.0 خواهد شد؛ جداگانه پیگیری می‌شود) نمایش داده می‌شود.

نقاط تماس:

- `open-sse/executors/antigravity.ts` — `process.env.ANTIGRAVITY_CREDITS` را می‌خواند
- `src/lib/oauth/providers/antigravity.ts` — لوله‌کشی اعتبار
- گزارش حادثه اصلی: Discussion [#1183](https://github.com/borhandarabi/routechi/discussions/1183)

---

## رجیستر اثر انگشتی CLI — `open-sse/config/cliFingerprints.ts`

جدول به‌ازای ارائه‌دهنده که **دقیقاً** ترتیب هدر و ترتیب فیلد بدنه JSON را از ردپای mitmproxy از CLIهای رسمی پین می‌کند. در حال حاضر ثبت‌شده: `codex`, `claude`، به‌علاوه پروفایل‌های runtime-مشتق در `providerHeaderProfiles.ts` برای `antigravity`, `qwen`, `github`.

```ts
interface CliFingerprint {
  headerOrder: string[]; // case-sensitive
  bodyFieldOrder: string[]; // top-level JSON keys
  userAgent?: string | (() => string);
  extraHeaders?: Record<string, string>;
}
```

تگل به‌ازای ارائه‌دهنده از طریق env (در پایین ببینید). وقتی غیرفعال است، هدرها/کلیدهای بدنه به هر ترتیبی که Node/JSON داده ظاهر می‌شوند — آسان برای اثر انگشتی.

---

## پراکسی MITM (Antigravity, Linux/macOS/Windows)

برای CLIهایی که باینری‌هایشان نمی‌توانند از طریق `OPENAI_BASE_URL` هدایت شوند، RouteChi یک پراکسی محلی خاتمه‌دهنده TLS اجرا می‌کند. اندپوینت‌ها تحت `src/app/api/cli-tools/antigravity-mitm/` قرار دارند.

| متد   | اندپوینت                                | هدف                                            |
| ------ | --------------------------------------- | ---------------------------------------------- |
| GET    | `/api/cli-tools/antigravity-mitm`       | وضعیت — در حال اجرا، pid، dnsConfigured، certExists |
| POST   | `/api/cli-tools/antigravity-mitm`       | شروع MITM (نیازمند `apiKey` + `sudoPassword`)  |
| DELETE | `/api/cli-tools/antigravity-mitm`       | توقف MITM                                       |
| GET    | `/api/cli-tools/antigravity-mitm/alias` | فهرست alias مدل‌ها                              |
| PUT    | `/api/cli-tools/antigravity-mitm/alias` | ذخیره alias مدل‌ها برای یک ابزار                 |

میزبان مقصد رهگیری‌شده: **`daily-cloudcode-pa.googleapis.com`** (آپ‌استریم Antigravity).

### دنباله شروع (`src/mitm/manager.ts::startMitm`)

1. تولید گواهی self-signed از طریق `selfsigned` (RSA-2048, SHA-256, 1y) — `cert/generate.ts`
2. نصب گواهی در trust-store سیستم — `cert/install.ts`
3. افزودن مدخل hosts `127.0.0.1 daily-cloudcode-pa.googleapis.com` — `dns/dnsConfig.ts`
4. spawn `src/mitm/server.cjs` با `ROUTER_API_KEY` + `MITM_LOCAL_PORT` (پیش‌فرض `443`)
5. ماندگاری PID در `<DATA_DIR>/mitm/.mitm.pid`

### تشخیص trust-store پویای لینوکس — `cert/install.ts`

`getLinuxCertConfig()` یک فهرست اولویت را پیمایش می‌کند و اولین دایرکتوری موجود را انتخاب می‌کند:

| خانواده توزیع            | دایرکتوری                                   | فرمان به‌روزرسانی       |
| ------------------------ | ------------------------------------------- | ------------------------ |
| Debian / Ubuntu          | `/usr/local/share/ca-certificates`          | `update-ca-certificates` |
| Arch / CachyOS / Manjaro | `/etc/ca-certificates/trust-source/anchors` | `update-ca-trust`        |
| Fedora / RHEL / CentOS   | `/etc/pki/ca-trust/source/anchors`          | `update-ca-trust`        |
| openSUSE                 | `/etc/pki/trust/anchors`                    | `update-ca-certificates` |

نام فایل گواهی: `omniroute-mitm.crt`. تطابق اثر انگشتی از طریق `getCertFingerprint()` (SHA-1 از DER).

علاوه بر این، `updateNssDatabases()` وقتی `certutil` در دسترس است در NSS DBهای به‌ازای کاربر نصب می‌کند: `~/.pki/nssdb`, `~/snap/chromium/.../nssdb`، همه پروفایل‌های Firefox (از جمله snap)، تحت نام مستعار **`RouteChi MITM Root CA`**.

### macOS / Windows

- **macOS:** `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain`
- **Windows:** PowerShell امتیاز‌دار → `certutil -addstore Root`

### احراز هویت

همه اندپوینت‌های MITM به احراز هویت مدیریتی نیاز دارند (`requireCliToolsAuth`). گذرواژه sudo در scope ماژول کش می‌شود (هرگز `globalThis`) و هنگام `stopMitm()` پاک می‌شود.

---

## لغوهای User-Agent — متغیرهای env (بخش ۱۲ `.env.example`)

| متغیر                  | پیش‌فرض                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `CLAUDE_USER_AGENT`    | `claude-cli/2.1.207 (external, cli)`                            |
| `CODEX_USER_AGENT`     | `codex-cli/0.142.0 (Windows 10.0.26200; x64)`                   |
| `GITHUB_USER_AGENT`    | `GitHubCopilotChat/0.54.0`                                      |
| `ANTIGRAVITY_USER_AGENT` | `antigravity/2.0.1 linux/arm64 google-api-nodejs-client/10.3.0` |
| `KIRO_USER_AGENT`      | `AWS-SDK-JS/3.0.0 kiro-ide/1.0.0`                               |
| `QODER_USER_AGENT`     | `Qoder-Cli`                                                     |
| `QWEN_USER_AGENT`      | `QwenCode/0.19.3 (linux; x64)`                                  |
| `CURSOR_USER_AGENT`    | `Cursor/3.4`                                                    |

توسط `open-sse/executors/base.ts::buildHeaders()` از طریق جستجوی پویا مصرف می‌شوند. **این‌ها را وقتی ارائه‌دهندگان نسخه‌های CLI جدید منتشر می‌کنند bump کنید** — رشته‌های UA کهنه شروع به رد شدن به‌عنوان کلاینت‌های قدیمی می‌کنند.

## تگل‌های حالت سازگاری CLI (بخش ۱۳ `.env.example`)

| متغیر                    | اثر                              |
| ------------------------ | -------------------------------- |
| `CLI_COMPAT_CODEX=1`     | اثر انگشتی Codex                 |
| `CLI_COMPAT_CLAUDE=1`    | اثر انگشتی claude-cli            |
| `CLI_COMPAT_GITHUB=1`    | اثر انگشتی GitHub Copilot Chat   |
| `CLI_COMPAT_ANTIGRAVITY=1` | اثر انگشتی Antigravity         |
| `CLI_COMPAT_KIRO=1`      | Kiro                             |
| `CLI_COMPAT_CURSOR=1`    | Cursor                           |
| `CLI_COMPAT_KIMI_CODING=1` | Kimi Coding                    |
| `CLI_COMPAT_KILOCODE=1`  | KiloCode                         |
| `CLI_COMPAT_CLINE=1`     | Cline                            |
| `CLI_COMPAT_QWEN=1`      | Qwen Code                        |
| `CLI_COMPAT_ALL=1`       | فعال‌سازی همه موارد بالا          |

IP ارائه‌دهنده **همیشه حفظ می‌شود** — تگل فقط تصویر سیمی درخواست را بازشکل می‌دهد، IP egress را تغییر نمی‌دهد.

---

## پاک‌سازی هدر ورودی

RouteChi هدرهای کلاینت ورودی را پیش از فوروارد پاک می‌کند تا درخواستی که از Cursor می‌آید `User-Agent: Cursor/X.Y.Z` را به یک آپ‌استریم Claude نشت ندهد. به `src/shared/constants/upstreamHeaders.ts` برای فهرست سیاه مراجعه کنید، که در قفل با هم با شِماهای Zod و آزمون‌های واحد نگه داشته می‌شود.

---

## به‌روزرسانی اثر انگشتی‌ها وقتی یک ارائه‌دهنده چرخش می‌کند

1. ترافیک CLI رسمی را با `mitmproxy` ضبط کنید (رهگیری TLS + dump)
2. JA3/JA4 و ترتیب literal هدر را استخراج کنید
3. مدخل `CLI_FINGERPRINTS[...]` مربوطه را به‌روزرسانی کنید
4. پیش‌فرض `*_USER_AGENT` مطابق را در `.env.example` bump کنید
5. اگر خود handshake TLS تغییر کرد: `chatgptTlsClient.ts::CHATGPT_PROFILE` یا گزینه `browser:` مربوط به wreq-js را به‌روزرسانی کنید
6. `chatgptTlsClient.test.ts` و یک canary دستی بر علیه ارائه‌دهنده زنده را اجرا کنید
7. در یک release patch ارسال کنید؛ در `CHANGELOG.md` مستند کنید

---

## آزمون‌ها

- `open-sse/services/__tests__/chatgptTlsClient.test.ts` — اولویت رزولوشن پراکسی، مدیریت abort، بازیابی hang
- `tests/unit/anthropic-cache-fingerprint.test.ts` — قطعیت اثر انگشتی
- `tests/unit/chatgpt-web.test.ts` — مسیر مخفی‌کاری end-to-end برای ChatGPT

---

## همچنین ببینید

- [RESILIENCE_GUIDE.md](../architecture/RESILIENCE_GUIDE.md) — وقتی یک مسیر مخفی‌کاری `403` می‌گیرد چه اتفاقی می‌افتد
- [TROUBLESHOOTING.md](../guides/TROUBLESHOOTING.md)
- [ENVIRONMENT.md](../reference/ENVIRONMENT.md) — مرجع کامل env
- [CLI-TOOLS.md](../reference/CLI-TOOLS.md) — دید اپراتور از گردش‌کار MITM
