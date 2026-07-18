---
title: "عیب‌یابی Relay"
version: 3.8.43
lastUpdated: 2026-07-11
---

# عیب‌یابی Relay

Relayها (Vercel، Deno، Cloudflare) اتصال upstream را روی یک
backend serverless خاتمه می‌دهند تا RouteChi بتواند از یک منطقه پایدار egress کند در حالی که
API key ارائه‌دهنده را سمت سرور نگه می‌دارد. این سند دو حالت شکست را پوشش می‌دهد
که اپراتورها در production با آن مواجه می‌شوند و مسیرهای بازیابی که RouteChi برای
هرکدام عرضه می‌کند.

## احراز هویت relay چگونه ذخیره می‌شود

هنگامی که یک relay از **Settings → Proxy Pool → Deploy Relay** استقرار می‌یابید،
جریان استقرار، auth token relay را در فیلد JSON `notes` پروکسی ذخیره می‌کند:

- اگر `STORAGE_ENCRYPTION_KEY` تنظیم شده باشد، token به‌صورت `relayAuthEnc`
  (AES-encrypted در حال سکون) نوشته می‌شود.
- در غیر این صورت به‌صورت `relayAuth` متن‌ساده نوشته می‌شود.

در زمان درخواست `extractRelayAuth(notes)` هر شکلی که موجود باشد را برمی‌گرداند،
تا relay در میان restartها به کار خود ادامه دهد.

## حالت شکست ۱ — token غیرقابل‌رمزگشایی پس از چرخش کلید

**علت:** relayهایی که قبلاً کار می‌کردند اکنون پس از یک چرخش محیط یا secret-managerِ
`STORAGE_ENCRYPTION_KEY`، خطای `401`/auth برمی‌گردانند. blob `relayAuthEnc` ذخیره‌شده دیگر قابل
رمزگشایی نیست، بنابراین `extractRelayAuth` رشته خالی برمی‌گرداند و relay هیچ
authی ارسال نمی‌کند.

**بازیابی — تعمیر در محل (بدون استقرار مجدد):**

1. **Settings → Proxy Pool** را باز کنید.
2. ردیف‌های relay که auth آن‌ها گمشده است یک نشان زرد `auth missing` و یک
   دکمه **Repair** نمایش می‌دهند.
3. روی **Repair** کلیک کنید. RouteChi فراخوانی می‌کند
   `POST /api/settings/proxies/[id]/repair-relay`، که:
   - `relayAuthEnc` را با کلید **فعلی** رمزگشایی می‌کند،
   - `relayAuth` متن‌ساده را به `notes` برمی‌گرداند،
   - `{ repaired: true, mode: "recovered" }` را برمی‌گرداند.

relay بدون نیاز به وارد کردن مجدد هیچ اعتبارنامه استقرار، به سرویس‌دهی ادامه می‌دهد.

این تنها زمانی کار می‌کند که `STORAGE_ENCRYPTION_KEY` فعلی همچنان بتواند
blob را رمزگشایی کند. اگر کلید را **بدون** یک migration چرخش داده‌اید، blob
غیرقابل‌بازیابی است.

## حالت شکست ۲ — token غیرقابل‌بازیابی (کلید چرخش یافته و از دسترس خارج شده)

**علت:** روی **Repair** کلیک کرده‌اید و دریافت کرده‌اید
`{ repaired: false, mode: "redeploy", status: 409 }`.

**بازیابی — استقرار مجدد:**

token ذخیره‌شده با کلید فعلی قابل بازیابی نیست. relay را از همان
modalی که در ابتدا استفاده کردید استقرار مجدد دهید (منوی **Deploy Relay** → Vercel / Deno
/ Cloudflare). جریان استقرار یک token تازه (با کلید فعلی رمزگذاری‌شده) می‌نویسد
و نشان `auth missing` ردیف پاک می‌شود.

در UI، خود دکمه **Repair** زمانی که
token غیرقابل‌بازیابی باشد، modal استقرار مجدد را راه‌اندازی می‌کند، تا هرگز مجبور نباشید به‌صورت دستی به دنبال آن بگردید.

## حالت شکست ۳ — relay قابل دسترسی اما ناسالم

**علت:** تست پروکسی (دکمه `speed`) نشان می‌دهد relay بالا است اما درخواست‌ها
هنوز به‌طور متناوب شکست می‌خورند.

headerهای آگاهی relay بازگردانده‌شده توسط probe تست خودکار RouteChi را بررسی کنید
(به **Settings → Proxy Pool** و شمارنده‌های `relayTested` / `relayAlive` مراجعه کنید):

- `x-relay-url` — کدام backend relay پاسخ داد.
- `x-relay-mode` — `ts` | `bifrost` | `auto` برای آن درخواست.
- `x-relay-attempts` — چند hop relay پیش از موفقیت امتحان شد.
- `x-relay-fallback` — `true` زمانی که درخواست از backend ترجیحی به
  relay TypeScript fallback رفت.

نرخ بالای `x-relay-fallback` با `relayAlive` پایین به این معنی است که backend
sidecar ناسالم است و باید آن را تعمیر کنید یا استراتژی backend relay را به
`ts` تغییر دهید (به `RELAY_BACKEND_STRATEGY.md` مراجعه کنید).

## مرجع API

| Method | Path                                      | Body                    | Success                                                                                                                             | Failure                                                                           |
| ------ | ----------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `POST` | `/api/settings/proxies/[id]/repair-relay` | `{ "id": "<proxyId>" }` | `200 { repaired: true, mode: "recovered" }` هنگام re-derive شده؛ `200 { repaired: false, mode: "noop" }` هنگامی که متن‌ساده از قبل موجود است | `409 { mode: "redeploy" }` غیرقابل‌بازیابی؛ `400` نوع relay نیست؛ `404` یافت نشد |

مسیر لیست `GET /api/settings/proxies` یک
`relayInfo: { isRelay, authMissing, repairMode }` بدون secret به هر آیتم ضمیمه می‌کند تا داشبورد
بتواند affordance تعمیر را بدون نمایش همیشگی token رندر کند.
