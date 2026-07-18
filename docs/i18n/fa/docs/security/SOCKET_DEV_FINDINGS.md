---
title: "Socket.dev Supply-Chain Finding Attestation"
description: "Maintainer attestation for the AI-detected potential-malware findings raised against omniroute and the v3.8.6 mitigations applied at each flagged call site."
---

# Socket.dev / گواهی یافته‌های زنجیره تأمین

این مستند گواهی نوشته‌شده توسط نگهدارنده برای شش یافته
`AI-detected potential malware` علیه `omniroute@3.8.5` و
تضعیف‌های اعمال‌شده در `omniroute@3.8.6` است. این مستند وجود دارد تا:

1. اپراتورهای خط لوله امنیتی یک مرجع واحد برای استناد داشته باشند وقتی نیاز به
   ارزیابی یافته‌ها در برابر منبع واقعی دارند.
2. اسکنرهای AI آینده بتوانند ادعای امضا‌شده توسط نگهدارنده را بردارند که هر
   مسیر پرچم‌گذاری‌شده عمدی، opt-in و مستند است.
3. یک رکورد مکتوب از *چرایی* شکل‌گیری هر callsite به این شکل داشته باشیم —
   تا یک بازآوری آینده به‌طور تصادفی یک اثر انگشتی را که
   عمداً حذف شده بود، دوباره معرفی نکند.

اگر یک اسکنر را اداره می‌کنید که پس از ارسال تضعیف‌های v3.8.6 هر کدام از
callsiteهای زیر را دوباره پرچم می‌زند، لطفاً یک issue با ردگیری اسکن باز کنید و
ما گواهی را در اینجا گسترش می‌دهیم.

---

## §1 — نصب CA ریشه MITM (`77484.js`)

**فایل‌های منبع**:

- `src/mitm/cert/install.ts` — `installCert()` / `uninstallCert()` عمومی،
  `installCertWindows/Mac/Linux` به‌ازای هر پلتفرم.
- `src/mitm/systemCommands.ts` — کمک‌کننده‌های مشترک `execFile` / `spawn` / PowerShell
  که توسط مسیرهای نصب استفاده می‌شوند.

**تحریک**: کاربر روی «Enable MITM proxy» در داشبورد محلی روی
`/dashboard/cli-tools/mitm` کلیک می‌کند. این مسیر فقط‌loopback است — به hard rule #17 در
`CLAUDE.md` و `src/server/authz/routeGuard.ts::isLocalOnlyPath()` مراجعه کنید. یک JWT
نشت‌شده که از طریق یک تونل افشا شده **نمی‌تواند** این مسیر کد را تحریک کند.

**عملیات امتیاز‌دار انجام‌شده (به‌ازای هر پلتفرم)**:

| OS      | فرمان(ها)                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------- |
| Windows | `certutil -addstore Root <cert>` از طریق UAC                                                   |
| macOS   | `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <cert>`  |
| Linux   | `sudo cp <cert> <distro-trust-dir>` + `sudo update-ca-certificates` (Debian) / `sudo update-ca-trust` (RHEL/SUSE) |
| Linux+Firefox/Chromium | به‌روزرسانی NSS DB به‌ازای پروفایل از طریق `certutil -d sql:<profile>`                          |

این همان فرمان‌هایی هستند که توسط `mitmproxy`, Charles Proxy, Fiddler و
Caddy استفاده می‌شوند. این واقعیت که آن‌ها در RouteChi وجود دارند در
`docs/security/STEALTH_GUIDE.md` مستند شده است.

**تضعیف v3.8.6**:

- `runElevatedPowerShell()` دیگر از `-EncodedCommand <base64utf16le>` استفاده نمی‌کند.
  payload امتیاز‌دار به یک فایل `.ps1` temp به‌ازای فراخوانی (حالت 0o600،
  درون یک دایرکتوری `mkdtempSync` خصوصی) نوشته می‌شود و از طریق `-File` ارجاع می‌شود. این
  فایل در `finally` unlink می‌شود. این اثر انگشتی کلاسیک
  base64-elevation-via-PowerShell را که توسط طبقه‌بند AI Socket.dev پرچم شده بود، حذف می‌کند.
- `installCertWindows` یک بلوک درون‌خطی `SECURITY-AUDITOR-NOTE:` دارد
  که به اینجا اشاره می‌کند.

**چرا نگه‌اش می‌داریم**: پراکسی MITM یک ویژگی مستند است که توسط
`docs/security/STEALTH_GUIDE.md` و `docs/frameworks/MITM-PROXY.md` استفاده می‌شود. حذف
آن مجموعه ویژگی agent-bridge را می‌شکند.

---

## §2 — import اعتبار Zed (`app/api/providers/zed/import/route.js`)

**فایل‌های منبع**:

- `src/app/api/providers/zed/discover/route.ts` *(جدید در v3.8.6)*
- `src/app/api/providers/zed/import/route.ts`
- `src/lib/zed-oauth/keychain-reader.ts`
- `src/lib/zed-oauth/credentialFingerprint.ts` *(جدید در v3.8.6)*

**تحریک**: کاربر روی «Import from Zed» در صفحه Providers
داشبورد محلی کلیک می‌کند. اندپوینت توسط `requireManagementAuth` گیت می‌شود. خود ویرایشگر Zed
کلیدهای API ارائه‌دهنده خود را به keychain OS تحت نام‌های سرویس مستند‌شده
می‌نویسد — به https://zed.dev/docs/ai/llm-providers مراجعه کنید.

**رفتار v3.8.5 (آنچه Socket.dev پرچم زد)**:

`POST /import` اعتبارنامه‌ها را کشف و در یک رفت‌وبرگشت واحد به
فروشگاه محلی SQLite ذخیره می‌کرد. بدون تأیید به‌ازای حساب، بدون
اثر انگشتی، فقط «N توکن یافت شد، همه import شدند.»

**تضعیف v3.8.6 — تأیید ۲ مرحله‌ای**:

1. **`POST /api/providers/zed/discover`**
   `{ candidates: [{ provider, service, account, fingerprint }] }` را برمی‌گرداند. توکن خام
   **هرگز** منتقل نمی‌شود. اثر انگشتی
   `sha256(service|account|token).slice(0,16)` است.
2. داشبورد فهرست candidate را رندر می‌کند، اپراتور انتخاب می‌کند کدام را
   import کند، و `{ confirmedAccounts: [{ service, account, fingerprint }] }` را به
   **`POST /api/providers/zed/import`** پست می‌کند.
3. اندپوینت import **keychain را روی سرور دوباره می‌خواند** و بر اساس
   `(service, account, fingerprint)` فیلتر می‌کند. یک پاسخ discover دستکاری یا replay‌شده نمی‌تواند اندپوینت import را فریب دهد تا یک توکن نامرتبط ذخیره کند —
   اگر توکن زنده از زمان discover تغییر کرده، اثر انگشتی دیگر
   تطابق ندارد و اعتبارنامه رد می‌شود.

یک پرچم env `OMNIROUTE_ZED_IMPORT_LEGACY_ONE_STEP=true` رفتار v3.8.5 را برای اپراتورهایی که هنوز اتوماسیون خود را به‌روز نکرده‌اند حفظ می‌کند. این در v3.9 حذف خواهد شد.

**چرا نگه‌اش می‌داریم**: import Zed دوست‌داشتنی‌ترین مسیر onboarding برای کاربرانی است
که از قبل از Zed استفاده می‌کنند و می‌خواهند کلیدهای ارائه‌دهنده خود را در RouteChi
بدون paste مجدد آینه کنند.

---

## §3 — `execFile` / `spawn` / PowerShell امتیاز‌دار (`21843.js`)

**فایل‌های منبع**: `src/mitm/systemCommands.ts`.

**چرا پرچم زده شد**: این chunk `execFileWithPassword`,
`runElevatedPowerShell` و کمک‌کننده مشترک `quotePowerShell` را دوباره صادر می‌کند. طبقه‌بند AI Socket.dev آن‌ها را به‌عنوان یک «ابزار اجرای میزبان + ارتقای امتیاز
عمومی» می‌بیند. درون RouteChi آن‌ها فقط توسط مسیر نصب گواهی MITM
(§1) و توسط `execFileWithPassword` برای اجرای فرمان `sudo` استفاده می‌شوند.

**تضعیف v3.8.6**:

- بازآوری `runElevatedPowerShell` (به §1 مراجعه کنید).
- بلوک درون‌خطی `SECURITY-AUDITOR-NOTE:` در هر دو
  `runElevatedPowerShell` و `execFileWithPassword` callerهای allowlist‌شده و فهرست اجرایی پین‌شده را مستند می‌کند.
- فراخوانی `spawn()` در `execFileWithPassword` یک نشانگر `nosemgrep` با
  allowlist اجرایی‌هایی که کمک‌کننده مجاز است دریافت کند، دارد —
  **هیچ مسیری از ورودی کاربر به `finalCommand`/`finalArgs` وجود ندارد**.

---

## §4 / §6 — ناظر سرویس 9router (`api/services/9router/{start,restart}/route.js`)

**فایل‌های منبع**:

- `src/app/api/services/9router/_lib.ts` — کارخانه ناظر.
- `src/app/api/services/9router/{start,stop,restart,status,install,update,auto-start}/route.ts`.
- `src/lib/services/ServiceSupervisor.ts` — spawn / health-poll / log-buffer عمومی.

**تحریک**: کاربر روی «Install» / «Start» در صفحه سرویس‌های embed‌شده در
داشبورد محلی کلیک می‌کند.

**محافظت‌های از پیش در جای خود**:

- همه مسیرهای `/api/services/*` طبق
  `src/server/authz/routeGuard.ts` (hard rule #17) LOCAL_ONLY هستند. اعمال loopback
  پیش از هر بررسی احراز هویت رخ می‌دهد — یک JWT نشت‌شده نمی‌تواند به آن‌ها برسد.
- ردیف DB 9router به‌عنوان `status='not_installed', auto_start=0` seed می‌شود (به
  `src/lib/db/migrations/071_services.sql:19` مراجعه کنید). سرویس هنگام
  اولین راه‌اندازی **شروع نمی‌شود**.
- `spawn()` با مسیر باینری برگردانده‌شده توسط
  `resolveSpawnArgs(apiKey, PORT)` در `src/lib/services/installers/ninerouter.ts`
  فراخوانی می‌شود، که یک allowlist ثابت از باینری‌های پشتیبانی‌شده است.
- stdout/stderr در حافظه بافر می‌شود (سقف ۵ MB، به `_lib.ts` مراجعه کنید) — هیچ نوشتار روی دیسک
  مگر اینکه کاربر لاگ‌گذاری را از داشبورد فعال کند.

**تضعیف v3.8.6**: هیچ تغییر عملکردی. پروفایل build حداقل
(`OMNIROUTE_BUILD_PROFILE=minimal`)
`src/lib/services/installers/ninerouter.ts` را با یک stub برای کاربرانی که می‌خواهند
مسیرهای امتیاز‌دار را به‌طور فیزیکی از باندل حذف کنند، جایگزین می‌کند.

**چرا نگه‌اش می‌داریم**: 9router یک سرویس همراه اختیاری و قابل نصب محلی است
(فکر کنید: افزونه سبک وردپرس) — opt-in سخت‌گیرانه.

---

## §5 — بازنویسی اعتبار RouteChi Cloud Sync (`api/keys/[id]/route.js`)

**فایل‌های منبع**:

- `src/lib/cloudSync.ts` — `syncToCloud()` / `updateLocalTokens()`.
- `src/app/api/keys/[id]/route.ts` — `syncKeysToCloudIfEnabled()` را فراخوانی می‌کند.

**تحریک**: `isCloudEnabled()` `true` برمی‌گرداند (تنظیم از داشبورد) **و**
`CLOUD_URL` پیکربندی شده. با هر دو خاموش، هیچ فراخوانی شبکه خروجی به
اندپوینت Cloud انجام نمی‌شود.

**رفتار v3.8.5 (باگی که Socket.dev درست گرفت)**:

`updateLocalTokens()` `accessToken`, `refreshToken` و
`providerSpecificData` را از پاسخ Cloud بازنویسی می‌کرد وقتی
`cloudUpdatedAt > localUpdatedAt`. بدون HMAC، بدون امضا، بدون checksum. یک
`CLOUD_URL` اشتباه پیکربندی یا خصمانک (یا یک MITM روی کانال) می‌توانست
توکن‌های OAuth ارائه‌دهنده را به‌طور خاموش جابجا کند.

**تضعیف v3.8.6**:

1. **راستی‌آزمایی HMAC**: `verifyCloudSignature(rawBody, sigHeader)` هدر
   `X-Cloud-Sig` (`HMAC-SHA256(OMNIROUTE_CLOUD_SYNC_SECRET,
   rawBody)`) را پیش از parse JSON بررسی می‌کند. اگر secret تنظیم شده باشد، امضا
   لازم است. اگر نه (حالت legacy)، یک هشدار لاگ می‌شود و پاسخ
   پذیرفته می‌شود — secret در v3.9 لازم خواهد بود.
2. **opt-in فیلد secret**: `accessToken` / `refreshToken` /
   `providerSpecificData` **فقط** وقتی
   `OMNIROUTE_CLOUD_SYNC_SECRETS=true` بازنویسی می‌شوند. حالت پیش‌فرض فقط
   متادیتای غیر اعتباری (`expiresAt`, `status`, `lastError*`,
   `rateLimitedUntil`, `updatedAt`) را sync می‌کند. این یک **تغییر شکستن** برای کاربرانی است
   که به sync توکن از راه دور تکیه کرده‌اند — آن‌ها باید صریح opt-in کنند.

**چرا نگه‌اش می‌داریم**: Cloud Sync تنها راه برای یک tenant RouteChi Cloud
برای متمرکز کردن اعتبار تیم است. تعمیر مدل تهدید را صادق می‌کند:
«سرور امضا می‌کند، کلاینت راستی‌آزمایی می‌کند، اپراتور opt-in می‌کند.»

---

## پروفایل build: `minimal`

برای کاربرانی که به یک artifact سازگار با Socket نیاز دارند، با:

```bash
OMNIROUTE_BUILD_PROFILE=minimal npm run build
```

ساخت کنید.

`NormalModuleReplacementPlugin` مربوط به webpack چهار ماژول را به stubها alias می‌کند:

| ماژول                                              | Stub                                                         |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `src/mitm/cert/install.ts`                          | `src/mitm/cert/install.stub.ts`                              |
| `src/lib/zed-oauth/keychain-reader.ts`              | `src/lib/zed-oauth/keychain-reader.stub.ts`                  |
| `src/lib/cloudSync.ts`                              | `src/lib/cloudSync.stub.ts`                                  |
| `src/lib/services/installers/ninerouter.ts`         | `src/lib/services/installers/ninerouter.stub.ts`             |

هر stub همان سطح را صادر می‌کند اما هر تابع در زمان اجرا یک
`featureDisabledError(name)` پرتاب می‌کند. مسیرهایی که به ماژول غیرفعال
وابسته‌اند به جای فعال‌سازی مسیر کد حساس، HTTP 503 با یک پیام واضح برمی‌گردانند.

باندل حاصل قصد دارد به‌عنوان `omniroute-secure` منتشر شود. برای دستور‌العمل انتشار به
`docs/ops/PUBLISHING_SECURE.md` مراجعه کنید.

---

## تفکیک افزونه (پیگیری برای v4)

در درازمدت، قصد داریم بسته npm را به ماژول‌های جداگانه قابل ممیزی
تقسیم کنیم. برای issue پیگیری به milestone v4 در ردیاب issue GitHub مراجعه کنید.
