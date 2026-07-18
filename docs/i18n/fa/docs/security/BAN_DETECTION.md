---
title: Account-Ban / Banned-Keyword Detection
---

# شناسایی مسدودی حساب / کلیدواژه‌های ممنوع

RouteChi پاسخ‌های خطای آپ‌استریم را برای یافتن نشانه‌هایی که نشان می‌دهد **یک حساب کاربری به‌طور دائمی مرده است** (تعلیق‌شده / غیرفعال‌شده / مسدود بر اساس ToS) اسکن می‌کند و در صورت تطابق، آن اتصال را به یک **وضعیت پایانى `banned`** می‌برد تا دیگر برای درخواست‌ها انتخاب نشود. این همان چیزی است که کارت تنظیمات **Security → Banned Keywords** پیکربندی می‌کند («کلیدواژه‌های اضافی که شناسایی مسدودی دائمی حساب را تحریک می‌کنند. کلیدواژه‌های داخلی همیشه اعمال می‌شوند.»).

این صفحه فهرست داخلی، جریان شناسایی، دامنه آن، نحوه افزودن امن کلیدواژه‌های سفارشی و نحوه بازیابی یک اتصال پرچم‌گذاری‌شده را مستند می‌کند. خود وضعیت پایانى بخشی از مدل تاب‌آوری است — به
[RESILIENCE_GUIDE](../architecture/RESILIENCE_GUIDE.md) («Terminal states») مراجعه کنید.

**منبع حقیقت:** `open-sse/services/accountFallback.ts`
(`ACCOUNT_DEACTIVATED_SIGNALS`, `getMergedBannedSignals()`, `isAccountDeactivated()`).

## کلیدواژه‌های داخلی

این ۸ زیررشته همیشه (بدون حساسیت به حروف کوچک و بزرگ) اعمال می‌شوند، مستقل از هر فهرست سفارشی:

```
account_deactivated
account has been deactivated
account has been disabled
your account has been suspended
this account is deactivated
verify your account to continue                                 (Antigravity / Google Cloud Code)
this service has been disabled in this account for violation    (Antigravity)
this service has been disabled in this account                  (Antigravity)
```

> این فهرست با تغییر عبارت مسدودی از سوی ارائه‌دهندگان تکامل می‌یابد. نسخه معتبر `ACCOUNT_DEACTIVATED_SIGNALS` در `open-sse/services/accountFallback.ts` است؛
> بلوک بالا را به‌عنوان یک عکس فوری در نظر بگیرید.

دو جدول سیگنال **جدا** و مجاور در همان فایل قرار دارند که بخشی از شناسایی کلیدواژه‌های ممنوع *نیستند*:

- `CREDITS_EXHAUSTED_SIGNALS` — تمام‌شدن صورت‌حساب/سهمیه (`insufficient_quota`,
  `credit_balance_too_low`, `payment required`, …) → پایانى `credits_exhausted`.
- `OAUTH_INVALID_TOKEN_SIGNALS` — **غیرپایانى**؛ یک بازنشانی توکن می‌تواند آن را بازیابی کند.

نکته: عبارت‌های گذراى رایج مانند **`rate limit`** / `429` توسط مسیر محدودیت نرخ / کوچدان اتصال مدیریت می‌شوند و سیگنال‌های مسدودی **نیستند**.

## جریان شناسایی

```
upstream error response
  → body stringified + lowercased
  → isAccountDeactivated(body): getMergedBannedSignals().some(sig => body.includes(sig))   [substring match]
  → match?
      → connection testStatus = "banned"      (permanent — 1-year cooldown, never auto-recovers)
      → if setting `autoDisableBannedAccounts` is on → also isActive = false
      → connection is skipped during account selection (combo QUOTA_BLOCKING statuses)
```

- تطابق یک جستجوی **زیررشته‌ای بدون حساسیت به حروف** روی **بدنه** پاسخ است
  (`isAccountDeactivated`, `accountFallback.ts`).
- پایانى‌شدن دائمی `banned` هنگام وجود بدنه با سیگنال مسدودی در **هر وضعیت HTTP** رخ می‌دهد
  (از طریق `markAccountUnavailable` → `checkFallbackError`). برچسب محدودتر
  **`deactivated`** (`isActive=false` وقتی اتصال کلید API یدکی ندارد) توسط مسیر درون‌خطی
  `chatCore.ts` در **HTTP 401 / 403** نوشته می‌شود (طبقه‌بندی‌شده از طریق
  `classifyProviderError` → `ACCOUNT_DEACTIVATED`). توجه کنید که
  مسیر `markAccountUnavailable()` یک وضعیت پایانى *متفاوت* —
  **`expired`** — را برای همان سیگنال `ACCOUNT_DEACTIVATED` می‌نویسد (از طریق
  `resolveTerminalConnectionStatus`)، بنابراین همان مسدودی می‌تواند بسته به اینکه کدام مسیر پاسخ را
  مدیریت کرده، به‌صورت `deactivated` یا `expired` ظاهر شود. (کدنظر قدیمی می‌گوید «وقتی بدنه 401 این رشته‌ها را دارد» — که رفتار کنونی را کم‌تر از حد نشان می‌دهد.)
- یک اتصال `banned` در همه‌جا که وضعیت‌های پایانى فیلتر می‌شوند از انتخاب کنار گذاشته می‌شود
  (`isTerminalConnectionStatus`, combo `QUOTA_BLOCKING_CONNECTION_STATUSES`).

## دامنه — کدام ارائه‌دهندگان اسکن می‌شوند

**همه ارائه‌دهندگان.** این بررسی در خط لوله عمومی پردازش خطا که هر درخواست آپ‌استریم ناموفق از آن عبور می‌کند اجرا می‌شود — نه اینکه فقط به اسکرپرهای OAuth/اشتراک محدود باشد. وضعیت پایانى حاصل به ازای هر **اتصال** است، نه به ازای هر ارائه‌دهنده.

با این حال، *رشته‌های* داخلی به سوی ارائه‌دهندگان اشتراک/OAuth با ریسک واقعی مسدودی
(ChatGPT Web, Claude Web, Codex, Muse Spark, Antigravity) جهت‌گیری شده‌اند. یک ارائه‌دهنده با کلید API فقط در صورتی شناساساز را فعال می‌کند که بدنه خطای او واقعاً حاوی یکی از زیررشته‌ها باشد.

## کلیدواژه‌های ممنوع سفارشی

کلیدواژه‌ها را در **Security → Banned Keywords** بیفزایید یا حذف کنید (به‌عنوان تنظیم سراسری
`customBannedSignals` از طریق `PATCH /api/settings` ذخیره می‌شود). آن‌ها به فهرست داخلی
**افزوده** می‌شوند — هرگز جایگزین آن نمی‌شوند — و هنگام ذخیره (و هنگام راه‌اندازی) از طریق
`setCustomBannedSignals()` به‌صورت داغ بارگذاری مجدد می‌شوند. طول هر کلیدواژه نهایتاً ۲۰۰ نویسه است؛ محدودیتی برای طول آرایه وجود ندارد.

**⚠ ریسک مثبت کاذب — عبارت‌های مشخص را انتخاب کنید.** شناسایی یک تطابق خام زیررشته‌ای روی کل بدنه پاسخ است و تطابق **دائمی** است (کوچدان ۱ساله، بازیابی دستی). یک کلیدواژه عمومی می‌تواند یک اتصال کاملاً سالم را مسدود کند:

- **بد:** `quota`, `limit`, `error`, `denied` — در بسیاری از خطاهای گذرا ظاهر می‌شوند.
- **خوب:** جملات کامل مسدودی، مانند `your account has been suspended for`,
  `account permanently banned`, `violation of our terms`.

بلندترین عبارت غیر مبهمی که ارائه‌دهنده در یک مسدودی واقعی برمی‌گرداند را ترجیح دهید. در صورت
شک، ابتدا `lastError` اتصال را ببینید، سپس عبارت دقیق را بیفزایید.

## بازیابی یک اتصال پرچم‌گذاری‌شده

وضعیت‌های پایانى `banned` / `deactivated` **هرگز خودکار بازیابی نمی‌شوند** (از تیک بازیابی
پیش‌فعال کنار گذاشته می‌شوند — فقط کوچدان‌های `unavailable` خودشان بازیابی می‌شوند). یک
اپراتور باید آن‌ها را به‌صورت صریح پاک کند:

1. **اتصال را دوباره آزمایش کنید** — عمل **Test** داشبورد
   (`POST /api/providers/{id}/test`)؛ یک کاوش موفق `testStatus` را به
   `active` بازنشانی می‌کند و فیلدهای خطا را پاک می‌سازد.
2. **احراز هویت مجدد / ویرایش اعتبار** — برای ارائه‌دهندگان OAuth، جریان ورود
   / بازنشانی را دوباره اجرا کنید؛ مسیرهای create/import ارائه‌دهنده `isActive = true` را تنظیم می‌کنند.
3. **فعال‌سازی مجدد اتصال** — اگر `autoDisableBannedAccounts`
   `isActive = false` را تنظیم کرده، پس از اصلاح حساب آن را دوباره روشن کنید.

هیچ دکمه مجزای «پاک‌کردن پرچم مسدودی» وجود ندارد — بازیابی همان re-test، re-auth یا
re-enable است، منطبق بر قانون کلی وضعیت پایانى در
[RESILIENCE_GUIDE](../architecture/RESILIENCE_GUIDE.md).

## فایل‌های منبع

| موضوع | فایل |
| --- | --- |
| جداول سیگنال + تطابق | `open-sse/services/accountFallback.ts` |
| پایانى‌سازی / ماندگاری | `src/sse/services/auth.ts` (`markAccountUnavailable`, `resolveTerminalConnectionStatus`, `clearAccountError`) |
| طبقه‌بندی درون‌خطی | `open-sse/handlers/chatCore.ts`, `open-sse/services/errorClassifier.ts` |
| استثنای بازیابی وضعیت پایانى | `src/lib/quota/connectionRecovery.ts` |
| بارگذاری زمان اجرای کلیدواژه سفارشی | `src/lib/config/runtimeSettings.ts` (`setCustomBannedSignals`) |
| رابط تنظیمات | `src/app/(dashboard)/dashboard/settings/components/SecurityTab.tsx` |
