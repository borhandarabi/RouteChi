---
title: CORS Configuration & Security
---

# پیکربندی CORS و امنیت

RouteChi کنترل می‌کند کدام **مبدأهای مرورگری** مجاز به خواندن پاسخ‌های متقاطع‌مبدأ هستند
که از یک فهرست مجاز متمرکز واحد می‌آید. مدل به‌صورت **پیش‌فرض fail-closed** است:
هیچ مبدأی تا زمانی که آن را وارد نکنید مجاز نیست. این صفحه مستند می‌کند که فهرست مجاز
چگونه حل می‌شود، `CORS_ALLOW_ALL=true` در واقع چه چیزی را افشا می‌کند (و مهم‌تر، چه چیزی را
**افشا نمی‌کند**)، چگونه محیط dev در برابر production را به‌طور امن پیکربندی کنید و هشدار
زمان اجرایی که داشبورد وقتی یک wildcard فعال است نشان می‌دهد.

**منبع حقیقت:** `src/server/cors/origins.ts` (`resolveAllowedOrigin`,
`applyCorsHeaders`, `getCorsStatus`). فهرست مجاز یک‌بار، در
میدل‌ویر (`src/server/authz/pipeline.ts`) اعمال می‌شود — هندلرهای هر مسیر خودشان
`Access-Control-Allow-Origin` را تنظیم نمی‌کنند.

## نحوه حل یک مبدأ

برای هر درخواست، میدل‌ویر مقدار `Access-Control-Allow-Origin` را به این ترتیب محاسبه می‌کند:

1. **`CORS_ALLOW_ALL=true`** (یا `CORS_ORIGIN=*` قدیمی) → مبدأ `Origin` فراخواننده را
   بازگردان می‌کند (یا `*` وقتی هدر `Origin` وجود ندارد)، با `Vary: Origin` تا کش‌ها
   درست بمانند.
2. در غیر این صورت، `Origin` درخواست نرمالایز می‌شود (حروف کوچک، اسلش انتهایی حذف می‌شود) و
   در برابر **فهرست مجاز ادغام‌شده** تطبیق داده می‌شود:
   - متغیر محیطی **`CORS_ALLOWED_ORIGINS`** — فهرست با کاما جدا شده، و
   - تنظیم زمان اجرایی **`corsOrigins`** (Dashboard → Security → _CORS Allowed
     Origins_)، که از طریق `setRuntimeAllowedOrigins()` از
     `src/lib/config/runtimeSettings.ts` تزریق می‌شود.
3. عدم تطابق → **هیچ هدر `Access-Control-Allow-Origin`ای منتشر نمی‌شود**. مرورگر
   خواندن متقاطع‌مبدأ را مسدود می‌کند. این پیش‌فرض fail-closed مورد نظر است.

| متغیر محیطی            | معنی                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | فهرست CSV از مبدأهای دقیق مجاز (توصیه‌شده).                                         |
| `CORS_ALLOW_ALL`       | `true`/`1` → بازگرداندن هر مبدأ (wildcard). فقط برای dev.                           |
| `CORS_ORIGIN`          | قدیمی. `*` مانند `CORS_ALLOW_ALL` رفتار می‌کند؛ یک تک‌مقدار به فهرست مجاز افزوده می‌شود. |

## مدل تهدید — `CORS_ALLOW_ALL=true` در واقع چه چیزی را افشا می‌کند

هشدار عمومی OWASP («CORS wildcard = هر سایتی می‌تواند API شما را فراخوانی کند») شایسته
توجه جدی است، اما افشای RouteChi **محدودتر از مورد عمومی** است،
به دلیل یک واقعیت پیاده‌سازی مشخص:

> **`applyCorsHeaders()` متمرکز هرگز
> `Access-Control-Allow-Credentials` منتشر نمی‌کند.** یک مرورگر یک پاسخ متقاطع‌مبدأ
> _حاوی اعتبارنامه_ (دارای cookie) را افشا نمی‌کند مگر اینکه سرور
> `Access-Control-Allow-Credentials: true` را ارسال کند. مسیر اشتراکی CORS در RouteChi هرگز
> این کار را نمی‌کند.

این یعنی به ازای هر سطح، حتی با `CORS_ALLOW_ALL=true`:

| سطح                                  | مکانیزم احراز هویت          | اثر CORS wildcard                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| داشبورد / MANAGEMENT `/api/*`        | جلسه cookie                 | مبدأ بازگردانده می‌شود، اما **بدون `Allow-Credentials`** مرورگر خواندن اعتبارنامه‌دار را **مسدود می‌کند**. یک سایت مخرب متقاطع‌مبدأ **نمی‌تواند** پاسخ‌های داشبورد احراز هویت‌شده شما را بخواند و cookie جلسه افشا نمی‌شود. |
| Client API `/v1/*`, `/v1beta/*`      | هدر Bearer / `x-api-key`    | بر اساس طراحی **مهربان** است (`relaxForTokenAuth`): مرورگرها هرگز `Authorization`/`x-api-key` را به‌طور خودکار پیوست نمی‌کنند، بنابراین صفحه مهاجم نمی‌تواند کلید شما را تأمین کند. `CORS_ALLOW_ALL` این را گسترش نمی‌دهد.        |
| عمومی فقط‌خواندنی (`/api/health`, …) | هیچ                         | غیرحساس؛ wildcard بی‌ضرر است.                                                                                                                                                                                                     |

بنابراین افشای **باقی‌مانده** `CORS_ALLOW_ALL=true` محدود است به: (الف)
**خواندن**‌های متقاطع‌مبدأ بدون اعتبارنامه از داده‌های از قبل احراز‌هویت‌نشده، و (ب)
اجازه عبور **preflight** CORS روی مسیرهای مدیریتی — که همچنان به احراز هویت نیاز
دارند که یک صفحه متقاطع‌مبدأ نمی‌تواند آن را تأمین کند. این **یک بردار سرقت جلسه یا
سرقت اعتبارنامه** روی مسیر اشتراکی CORS نیست.

### یک استثنای واقعی — `/api/v1/agents/`

مسیرهای Cloud-Agent (`/api/v1/agents/{health,credentials,tasks,tasks/[id]}`) هدرهای
CORS **خودشان** را تنظیم می‌کنند
(`src/lib/cloudAgent/api.ts`, `getCloudAgentCorsHeaders`) و **بله**
`Access-Control-Allow-Origin: <origin>|*` را همراه با
`Access-Control-Allow-Credentials: true` منتشر می‌کنند. این تنها سطحی است که در آن
echo مبدأ و اعتبارنامه با هم وجود دارند، و **مستقل از
`CORS_ALLOW_ALL`** است. این مسیرها با احراز هویت مدیریتی هستند
(`requireManagementAuth`)؛ اپراتورهایی که داشبورد را خارج از میزبان افشا می‌کنند باید
آگاه باشند که این تنها جایی است که یک خواندن متقاطع‌مبدأ اعتبارنامه‌دار توسط هدرهای پاسخ
مجاز شده است. سفت‌کردن آن به یک فهرست مجاز صریح جدا از این راهنمای CORS پیگیری می‌شود.

## چک‌لیست production

- **هرگز `CORS_ALLOW_ALL=true` را در production تنظیم نکنید.** آن را تنظیم‌نشده رها کنید.
- یک فهرست مبدأ **صریح** تنظیم کنید — یا متغیر محیطی یا فیلد تب Security:

  ```bash
  CORS_ALLOWED_ORIGINS="https://app.example.com, https://admin.example.com"
  ```

- اگر RouteChi پشت یک پراکسی معکوس / تونل (nginx, Caddy, Cloudflare
  Tunnel, Tailscale) اجرا می‌شود، CORS **تنها** کنترل شما نیست — حفاظت مسیر loopback
  هنوز از مسیرهای دارای قابلیت spawn محافظت می‌کند (به
  [ROUTE_GUARD_TIERS](./ROUTE_GUARD_TIERS.md) مراجعه کنید). `X-Forwarded-For: 127.0.0.1` را
  برای «تعمیر» یک 403 جعل نکنید؛ این کار کلاس RCE‌ای را که route guard می‌بندد، دوباره باز می‌کند.
- وضعیت زمان اجرا را تأیید کنید: داشبورد یک **بنر کهربایی پایدار** تحت
  Dashboard → Security → Authorization Inventory نشان می‌دهد هر زمان که
  `CORS_ALLOW_ALL=true` فعال باشد، و `/api/settings/authz-inventory` یک
  پاکت `cors: { allowAll, allowedOrigins }` برمی‌گرداند که ابزارهای مانیتورینگ می‌توانند آن را نظرسنجی کنند.

## راحتی توسعه — مبدأهای محلی مشخص را مجاز کنید

حتی در dev به‌ندرت به wildcard نیاز دارید. فقط سرورهای dev که استفاده می‌کنید را مجاز کنید:

```bash
# Vite (5173) + Next.js (3000) dev servers calling a local RouteChi
CORS_ALLOWED_ORIGINS="http://localhost:5173, http://localhost:3000"
```

مبدأها بدون حساسیت به حروف با نادیده‌گرفتن اسلش انتهایی تطبیق داده می‌شوند، بنابراین
`http://localhost:3000` و `http://localhost:3000/` معادل هستند. همان CSV
می‌تواند در زمان اجرا در **Dashboard → Security → CORS Allowed Origins** بدون
راه‌اندازی مجدد تنظیم شود.

## کلیدهای API در برابر جلسات cookie

- **Bearer / `x-api-key` (سطح استنتاج `/v1/*`):** مرورگرها هرگز این‌ها را به‌طور
  خودکار پیوست نمی‌کنند. CORS در اینجا یک سد معنادار نیست — کلید API سد است —
  به همین دلیل آن سطح عمداً مهربان است تا مرورگر و کلاینت‌های Electron بتوانند
  پاسخ‌هایی را که از قبل مستحق آن هستند بخوانند.
- **جلسه cookie (داشبورد):** توسط پیش‌فرض fail-closed **و** نبود
  `Access-Control-Allow-Credentials` در مسیر اشتراکی محافظت می‌شود. مبدأهای
  مدیریت/داشبورد را از هر پیکربندی مهربانی خارج نگه دارید؛ آن‌ها باید دقیقاً
  fail-closed باقی بمانند.

## مثال: پراکسی معکوس در جلوی RouteChi

CORS توسط خود RouteChi اعمال می‌شود، بنابراین پراکسی عموماً نباید هدرهای
`Access-Control-*` را اضافه یا بازنویسی کند (هدرهای دوتایی مرورگرها را خراب می‌کند). TLS را
خاتمه دهید و فوروارد کنید — بگذارید RouteChi به preflight پاسخ دهد:

```nginx
# nginx — forward to RouteChi; do NOT inject Access-Control-* here
location / {
    proxy_pass http://127.0.0.1:20128;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Do NOT set X-Forwarded-For to 127.0.0.1 — it defeats the loopback route guard.
}
```

مبدأهای مرورگری مجاز را در RouteChi تنظیم کنید (`CORS_ALLOWED_ORIGINS` یا
تب Security)، نه در پراکسی.

## فایل‌های منبع

| موضوع                                           | فایل                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| حل فهرست مجاز + `getCorsStatus()`               | `src/server/cors/origins.ts`                                         |
| اعمال میدل‌ویر (منبع واحد حقیقت)                | `src/server/authz/pipeline.ts`                                       |
| تنظیمات ← تزریق مبدأ زمان اجرا                  | `src/lib/config/runtimeSettings.ts`                                  |
| وضعیت زمان اجرا برای داشبورد                    | `src/app/api/settings/authz-inventory/route.ts`                      |
| بنر هشدار داشبورد                               | `src/app/(dashboard)/dashboard/settings/components/AuthzSection.tsx` |
| فیلد CORS Allowed Origins                       | `src/app/(dashboard)/dashboard/settings/components/SecurityTab.tsx`  |
| CORS هر مسیر Cloud-Agent (استثنا)               | `src/lib/cloudAgent/api.ts`                                          |

## همچنین ببینید

- [لایه‌های حفاظت مسیر](./ROUTE_GUARD_TIERS.md) — اعمال loopback برای
  مسیرهای دارای قابلیت spawn (یک کنترل جدا و مکمل).
- [راهنمای احراز هویت](../architecture/AUTHZ_GUIDE.md) — خط لوله کامل احراز هویت.
