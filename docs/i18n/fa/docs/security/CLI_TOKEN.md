---
title: "CLI Machine-ID Token"
---

# توکن Machine-ID مربوط به CLI

## مرور کلی

فرمان‌های CLI مربوط به RouteChi در برابر API مدیریت محلی با استفاده از یک
توکن `HMAC-SHA256(machine-id, salt)` که از طریق هدر درخواست
`x-omniroute-cli-token` ارسال می‌شود، احراز هویت می‌شوند.

این به زیرفرمان‌های CLI (`routechi status`, `routechi providers` و غیره)
اجازه می‌دهد تا بدون نیاز به تأمین JWT یا گذرواژه در هر فراخوانی، اندپوینت‌های
مدیریت را فراخوانی کنند.

## نحوه کار

1. `getMachineTokenSync()` شناسه سخت‌افزاری ماشین را از طریق `node-machine-id`
   می‌خواند (در صورت شکست به رشته خالی برمی‌گردد و احراز هویت CLI را غیرفعال می‌کند).
2. `HMAC-SHA256(machine_id, salt)` را محاسبه می‌کند و خلاصه hex کامل ۶۴ کاراکتری را
   برمی‌گرداند — یک توکن قطعی و غیرقابل‌برگشت که به این ماشین گره خورده است.
3. CLI این توکن را به‌عنوان `x-omniroute-cli-token` در هر درخواست به
   `http://localhost:<port>/api/...` ارسال می‌کند.
4. سرور (`src/server/authz/policies/management.ts`) توکن مورد انتظار را با همان
   salt محاسبه می‌کند و از طریق `timingSafeEqual` مقایسه می‌کند تا از استخراج مبتنی بر زمان جلوگیری شود.

## ویژگی‌های امنیتی

| ویژگی                           | جزئیات                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **فقط loopback**                | فقط وقتی `Host` برابر `localhost`, `127.0.0.1` یا `::1` باشد پذیرفته می‌شود.                                                       |
| **مقایسه در زمان ثابت**         | `crypto.timingSafeEqual` از حملات زمان‌بندی جلوگیری می‌کند.                                                                          |
| **غیرقابل‌برگشت**               | خروجی HMAC نمی‌تواند machine-id را بازیابی کند.                                                                                      |
| **بدون دور زدن `always`**       | `isAlwaysProtectedPath()` پیش از بررسی توکن CLI ارزیابی می‌شود. `/api/shutdown` و `/api/settings/database` همیشه به JWT نیاز دارند. |
| **غیرقابل صدور**                | توکن هرگز روی دیسک نوشته یا لاگ نمی‌شود.                                                                                             |

## چرخش salt

برای چرخش توکن مشتق‌شده بدون تغییر کد، `OMNIROUTE_CLI_SALT` را تنظیم کنید.
پس از چرخش، همه فرآیندهای CLI روی این ماشین به‌طور خودکار از توکن جدید استفاده
می‌کنند. این کار پس از نشت فهرست فرآیند که ممکن است مقدار مشتق قبلی را افشا کرده
باشد، مفید است.

```bash
# Persistent rotation (add to shell profile)
export OMNIROUTE_CLI_SALT="my-secret-salt-2026"

# Verify new token is in use
routechi status
```

Salt پیش‌فرض: `omniroute-cli-auth-v1`

## قالب قدیمی (SHA-256, 32-char) — هنوز پذیرفته می‌شود

پیش از قالب HMAC بالا، CLI توکن خود را به‌صورت
`SHA-256(machineId + salt).hex[0..32]` (یک پیشوند ۳۲ کاراکتری) در
`bin/cli/utils/cliToken.mjs` (`getLegacyCliTokenSync` در `src/lib/machineToken.ts`) مشتق می‌کرد.

برای سازگاری با نسخه‌های پیشین، سرور **هر دو** قالب را می‌پذیرد: بررسی‌کننده
`expectedTokens = [getMachineTokenSync(), getLegacyCliTokenSync()]` را می‌سازد و
هدر ورودی را با هر کدام از طریق `timingSafeEqual` مقایسه می‌کند
(`src/server/authz/policies/management.ts` و `src/lib/middleware/cliTokenAuth.ts`).
بنابراین یک توکن معتبر است اگر با **هرکدام** از خلاصه HMAC ۶۴ کاراکتری یا پیشوند
SHA-256 قدیمی ۳۲ کاراکتری تطابق داشته باشد.

**خروج اختیاری:** `OMNIROUTE_DISABLE_CLI_TOKEN=true` را (env یا `.env`) تنظیم کنید تا
مکانیزم توکن CLI به‌طور کامل غیرفعال شود؛ آنگاه همه دسترسی‌ها به کلید API صریح نیاز
دارند. در میزبان‌های چندکاربره این کار توصیه می‌شود، زیرا `machine-id` به‌ازای هر
دستگاه است (نه به‌ازای هر کاربر) و کاربر دیگری روی همان میزبان می‌تواند همان توکن را
محاسبه کند.

## فایل‌ها

| فایل                                      | هدف                                  |
| ----------------------------------------- | ------------------------------------ |
| `src/lib/machineToken.ts`                 | مشتق توکن (`getMachineTokenSync`)    |
| `src/server/authz/headers.ts`             | ثابت `CLI_TOKEN_HEADER`              |
| `src/server/authz/policies/management.ts` | راستی‌آزمایی سمت سرور                 |
| `src/server/authz/routeGuard.ts`          | بررسی میزبان loopback (`isLoopbackHost`) |

## همچنین ببینید

- `docs/security/ROUTE_GUARD_TIERS.md` — لایه‌های حفاظت مسیر
- `docs/architecture/AUTHZ_GUIDE.md` — خط لوله کامل احراز هویت
