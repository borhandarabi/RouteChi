---
title: "Manifest پلاگین ارائه‌دهنده"
version: 3.8.42
lastUpdated: 2026-07-01
---

# Manifest پلاگین ارائه‌دهنده

`open-sse/config/providerPluginManifest.ts` قرارداد پلاگین ارائه‌دهنده
JSON-safe را تعریف می‌کند. `open-sse/config/providerPluginManifestRegistry.ts` آن
قرارداد را به رجیستری ارائه‌دهنده فعلی برای sidecarهایی مانند Bifrost،
CLIProxyAPI یا یک روتر Go/Rust آینده متصل می‌کند. رجیستری TypeScript همچنان
منبع حقیقت باقی می‌ماند، اما sidecarها می‌توانند manifest را بدون import کردن
کد executor، پیش‌فرض‌های OAuth، headerها یا حالت محیط فرآیند مصرف کنند.

همان manifest از طریق HTTP در
`GET /api/v1/provider-plugin-manifest` برای sidecarهایی که out-of-process اجرا می‌شوند در دسترس است.

RouteChi آن URL را به Bifrost و CLIProxyAPI از طریق
header درخواست `X-RouteChi-Provider-Manifest-Url` اعلان می‌کند. زمانی که
sidecar به یک URL شبکه عمومی یا container نیاز دارد به‌جای origin درخواست محلی،
`OMNIROUTE_PROVIDER_MANIFEST_URL` را تنظیم کنید.

## هدف

متادیتای ارائه‌دهنده را به سمت یک قرارداد پلاگین حرکت دهید تا مسیر درخواست داغ
بتواند در نهایت توسط یک sidecar با تأخیر کمتر متعلق به آن شود، در حالی که RouteChi
مسیر TypeScript را به‌عنوان دروازه خط‌مشی و fallback نگه می‌دارد. manifest افزاینده است:
به‌خودی‌خود مسیریابی درخواست را تغییر نمی‌دهد.

## قرارداد

manifest شامل موارد زیر است:

- شناسه و نام‌مستعار ارائه‌دهنده
- فرمت upstream و نام executor
- نوع auth، header auth و پیشوند اختیاری auth
- متادیتای endpoint ایستا
- واجد شرایط بودن sidecar و دلایل صریح هنگامی که یک ارائه‌دهنده باید روی TS بماند
- متادیتای model JSON-safe مانند طول context، flagهای vision/reasoning و
  پارامترهای پشتیبانی‌نشده
- برچسب‌های قابلیت از جمله `apikey`، `oauth`، `custom-executor`،
  `passthrough-models`، `responses` و `sidecar-candidate`

manifest عمداً مستثنی می‌کند:

- secretهای کلاینت OAuth و مقادیر secret پیش‌فرض
- تفکیک محیط زمان اجرا
- headerهای درخواست و helperهای اعتبار عمومی
- سازنده‌های URL پویا
- توابع executor
- داخلی‌های session pool

## استفاده Sidecar

Sidecarها باید `sidecar.eligible` را به‌عنوان یک سیگنال کاندیدای محافظه‌کارانه در نظر بگیرند، نه
به‌عنوان یک تصمیم مسیریابی بدون قید و شرط. اولین هدف import باید
ارائه‌دهندگان API-key، static-endpoint با استفاده از executor پیش‌فرض باشد. ارائه‌دهندگان با
executorهای وب سفارشی، جریان‌های OAuth/session، سازنده‌های URL پویا یا پیکربندی pool
تا زمانی که یک sidecar رفتار معادل پیاده‌سازی کند و telemetry برابری را ثابت کند،
روی مسیر fallback TypeScript باقی می‌مانند.

فازهای پیشنهادی مهاجرت:

1. تولید و اعتبارسنجی manifest پلاگین ارائه‌دهنده از رجیستری TS.
2. آموزش Bifrost یا CLIProxyAPI برای import manifest برای ارائه‌دهندگان API-key/static.
3. مسیریابی ارائه‌دهندگان واجد شرایط از طریق sidecar پشت `OMNIROUTE_RELAY_BACKEND`
   در حالی که fallback TS فعال است.
4. ارتقای ارائه‌دهندگان تنها زمانی که نرخ موفقیت، تأخیر p99، رفتار streaming،
   و مدیریت پارامتر پشتیبانی‌نشده با مسیر TS مطابقت داشته باشد.
5. افزودن پلاگین‌های sidecar-native برای executorهای سفارشی، یک خانواده ارائه‌دهنده در هر
   زمان.

## چرا ارائه‌دهندگان مستقیماً در Next جاسازی نشوند

فرانت‌اند Next نباید مالک اجرای ارائه‌دهنده باشد. باید مرز API را صدا بزند.
سپس backend می‌تواند تصمیم بگیرد که آیا از executor TypeScript،
Bifrost، CLIProxyAPI یا یک sidecar بومی آینده استفاده کند. این کار امضای درخواست،
بررسی‌های allowlist، خط‌مشی DB و رفتار fallback را پیش از هر
تحویل sidecar متمرکز نگه می‌دارد.
