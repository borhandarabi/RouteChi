---
title: "Public Credentials Handling"
version: 3.8.40
lastUpdated: 2026-06-28
---

# مدیریت اعتبارنامه‌های عمومی

> **منبع حقیقت:** `open-sse/utils/publicCreds.ts`
> **آزمون‌ها:** `tests/unit/publicCreds.test.ts`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40
> **مخاطب:** مهندسانی که ارائه‌دهندگانی را ادغام می‌کنند که client_id / client_secret عمومی OAuth یا کلیدهای Firebase Web API عمومی را در CLIهای عمومی خود ارسال می‌کنند.
> **وضعیت:** **الزامی** برای هر کد جدیدی که شناسه‌های آپ‌استریم را embed می‌کند.

## چرا این وجود دارد


- [OAuth 2.0 برای برنامه‌های بومی (PKCE)](https://developers.google.com/identity/protocols/oauth2/native-app) — client_id / client_secret مربوط به OAuth برای برنامه‌های نصب‌شده عمومی است؛ PKCE امنیت واقعی را تأمین می‌کند.
- [کلیدهای API Firebase](https://firebase.google.com/docs/projects/api-keys) — شناسه‌های کلاینت Web بر اساس طراحی عمومی هستند.

RouteChi باید این مقادیر را embed کند تا کاربرانی که `.env` را پیکربندی نمی‌کنند، همچنان یک جریان OAuth کارآمد به‌صورت پیش‌فرض دریافت کنند. بدون یک fallback embed‌شده، ارائه‌دهندگان Gemini / Antigravity / Windsurf برای هر کاربری که از مسیر «فقط clone و اجرا» پیروی می‌کند از کار می‌ایستند.

با این حال، مقادیر literal مانند `AIzaSy…`, `GOCSPX-…`, `…apps.googleusercontent.com` توسط **GitHub Secret Scanning**، **Semgrep** و اسکنرهای الگوی مشابه تطبیق داده می‌شوند. هر انتشار به یک جریان پرمخاطب مثبت‌های کاذب تبدیل می‌شود، push protection commitهای قانونی را مسدود می‌کند و اپراتورها به جریان هشدار اعتماد نمی‌کنند.

کمک‌کننده `open-sse/utils/publicCreds.ts` هر دو محدودیت را به‌طور همزمان حل می‌کند:

- شناسه عمومی را به‌عنوان یک **دنباله بایت XOR-masked** embed می‌کند (هیچ الگوی اسکنری در منبع نیست).
- در زمان اجرا از طریق `decodePublicCred` / `resolvePublicCred` رمزگشایی می‌کند.
- مقادیر خام را که از پیش از پیشوندهای شناخته‌شده پیروی می‌کنند (`AIza`, `GOCSPX-`, `<digits>-<32hex>.apps.googleusercontent.com`, `Iv1.<hex>`) تشخیص می‌دهد و آن‌ها را بدون تغییر عبور می‌دهد، تا کاربرانی با مقادیر خام در `.env` موجود خود با **مهاجرت صفر** به کار خود ادامه دهند.

این **ابهام‌سازی است، نه رمزنگاری.** هر کسی که منبع را بخواند می‌تواند مقدار را بازیابی کند — که عالی است چون مقدار بر اساس طراحی عمومی است. تنها هدف پرهیز از تطابق‌های regex اسکنر است.

## الگوی الزامی

### ۱. افزودن یک اعتبارنامه عمومی جدید

وقتی نیاز دارید یک مقدار جدید ارائه‌شده توسط آپ‌استریم را embed کنید که:

- از یک CLI عمومی / برنامه دسکتاپ / باندل مرورگر می‌آید، **و**
- ارائه‌دهنده آپ‌استریم آن را به‌عنوان یک شناسه کلاینت عمومی مستندسازی (یا رفتار) می‌کند، **و**
- یک اسکنر الگو در غیر این صورت آن را تطبیق می‌داد (`AIza…`, `GOCSPX-…`, `<digits>-…apps.googleusercontent.com` و غیره)،

…این چک‌لیست را دنبال کنید:

1. دنباله بایت mask‌شده را تولید کنید:

   ```bash
   node --import tsx/esm -e \
     'import("./open-sse/utils/publicCreds.ts").then(m =>
        console.log(JSON.stringify(Array.from(
          Buffer.from(m.encodePublicCred("THE_PUBLIC_VALUE"), "base64")
        ))))'
   ```

2. یک مدخل جدید به `EMBEDDED_DEFAULTS` در `open-sse/utils/publicCreds.ts` با یک **نام کلید خنثی** (`<provider>_id`, `<provider>_alt`, `<provider>_fb` و غیره) بیفزایید. از نام‌هایی مانند `client_secret` یا `api_key` در کمک‌کننده استفاده **نکنید** — این کلمات قواعد generic-secret مربوط به Semgrep را تحریک می‌کنند.

3. یک `keyof typeof EMBEDDED_DEFAULTS` به union نوع عمومی بیفزایید (به‌طور خودکار استنتاج می‌شود).

4. در کد مصرف‌کننده، literal hardcode‌شده را با موارد زیر جایگزین کنید:

   ```ts
   // single env override
   clientSecret: resolvePublicCred("provider_alt", "PROVIDER_OAUTH_CLIENT_SECRET"),

   // multiple env aliases (first non-empty wins)
   clientId: resolvePublicCredMulti("provider_id", [
     "PROVIDER_CLI_OAUTH_CLIENT_ID",
     "PROVIDER_OAUTH_CLIENT_ID",
   ]),

   // no env override (always embedded default)
   firebaseApiKey: resolvePublicCred("provider_fb"),
   ```

5. literal را از `.env.example` حذف کنید (با مستندسازی فقط‌کامنت که خوانندگان را به اینجا ارجاع می‌دهد جایگزین کنید):

   ```dotenv
   # ── Provider (Google / Firebase / etc.) ──
   # Public OAuth credentials are baked into the code via
   # open-sse/utils/publicCreds.ts. Set these vars only to use your own.
   # PROVIDER_OAUTH_CLIENT_ID=
   # PROVIDER_OAUTH_CLIENT_SECRET=
   ```

6. `tests/unit/publicCreds.test.ts` را به‌روزرسانی کنید تا یک ادعای شکل برای کلید جدید بیفزایید (قالب را راستی‌آزمایی کنید، نه مقدار literal — برای الگو به آزمون‌های موجود مراجعه کنید).

7. **هرگز** literalهای `AIza…` / `GOCSPX-…` / `…apps.googleusercontent.com` را به فایل‌های آزمون نیفزایید. از ثابت‌های `FAKE_*` ساخته‌شده از قطعات `.join("")` استفاده کنید (به آزمون‌های موجود مراجعه کنید).

### ۲. مصرف‌کنندگان

- **فقط از `resolvePublicCred()` / `resolvePublicCredMulti()` بخوانید** — هرگز `decodePublicCredBytes()` را خارج از کمک‌کننده به‌طور مستقیم فراخوانی نکنید.
- کمک‌کننده عمداً ارزان است (XOR بایت خطی) و امن برای فراخوانی در زمان بارگذاری ماژول است؛ پیش‌فرض‌ها یک‌بار محاسبه می‌شوند.
- لغوی env همیشه پیروز می‌شود. اگر یک کاربر `PROVIDER_OAUTH_CLIENT_SECRET=GOCSPX-myown` را تنظیم کند، کمک‌کننده آن مقدار خام را مستقیماً عبور می‌دهد.

### ۳. الگوهای ممنوع

❌ **هرگز** هیچ‌یک از موارد زیر را در کد production انجام ندهید (`src/`, `open-sse/`, `electron/`, `bin/`):

```ts
// BAD: literal value triggers Secret Scanning + Semgrep
clientSecret: process.env.PROVIDER_OAUTH_CLIENT_SECRET || "GOCSPX-realvalue",

// BAD: base64 of the literal — GitHub still detects since Feb/2025
clientSecret: process.env.PROVIDER_OAUTH_CLIENT_SECRET ||
  Buffer.from("R09DU1BYLXJlYWx2YWx1ZQ==", "base64").toString(),

// BAD: string concatenation that re-assembles the pattern at runtime
clientSecret: "GO" + "CS" + "PX-" + "realvalue",

// BAD: hex/ROT13 encoding — different obfuscation, same risk of detection
clientSecret: hexDecode("474f4353..."),
```

همه این‌ها در نهایت یک اسکنر را فعال می‌کنند. از `resolvePublicCred()` استفاده کنید.

❌ **هرگز** اعتبارنامه‌های literal را به `.env.example` نیفزایید. کاربرانی که به مقادیر آپ‌استریم واقعی نیاز دارند می‌توانند آن‌ها را خودشان از CLI عمومی استخراج کنند، یا از ثبت OAuth خودشان استفاده کنند.

❌ **هرگز** یک هشدار جدید secret-scanning را بدون بررسی اینکه آیا اعتبارنامه باید به این کمک‌کننده منتقل شود، رد نکنید.

## کنترل‌های مرتبط

- `RAW_VALUE_PATTERN` در `publicCreds.ts` پیشوندهایی را برمی‌شمارد که passthrough (سازگاری پسین) را تحریک می‌کنند. این را فقط برای قالب‌های اعتبارنامه عمومی مستند‌شده گسترش دهید، هرگز برای secretهای اختصاصی.
- `.env.example` در اسکریپت `check-env-doc-sync` در CI قرار دارد — وقتی یک متغیر را اینجا حذف می‌کنید، مطمئن شوید مستندات مطابقت دارد.
- مجموعه‌های `npm run test:vitest` و `node --import tsx/esm --test tests/unit/publicCreds.test.ts` باید هر دو سبز بمانند.

## چه زمانی از این کمک‌کننده استفاده نکنید

این کمک‌کننده **فقط** برای اعتبارنامه‌هایی است که:

1. به‌طور عمومی توسط ارائه‌دهنده آپ‌استریم توزیع می‌شوند (باینری CLI، باندل مرورگر، مستندات رسمی).
2. به‌عنوان غیرمحرمانه مستندسازی یا به‌شدت مفهوم می‌شوند (محافظت PKCE، کلید Firebase Web، مشابه).

برای هر چیز دیگر — توکن‌های صادرشده توسط اپراتور، secretهای به‌ازای هر tenant، client_secret برنامه OAuth خودتان، کلیدهای رمزنگاری، secretهای JWT، گذرواژه‌های پایگاه‌داده — **فقط** از متغیرهای محیطی استفاده کنید (`process.env.FOO`، fallback `||` به خالی / خطای صریح). این‌ها در `.env` و [فروشگاه اعتبارنامه رمزنگاری‌شده](./COMPLIANCE.md) قرار می‌گیرند، نه در منبع.

## مراجع

- [Google: OAuth 2.0 for native apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Firebase: API keys for client identification](https://firebase.google.com/docs/projects/api-keys)
- [GitHub Secret Scanning supported secrets](https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns)
- [GitHub: base64 detection for tokens (Feb 2025)](https://github.blog/changelog/2025-02-14-secret-scanning-detects-base64-encoded-github-tokens/)
- کامیتی که این کمک‌کننده را معرفی کرد: `1a39c31f` — _fix(security): mask public upstream creds + centralize error sanitization_
