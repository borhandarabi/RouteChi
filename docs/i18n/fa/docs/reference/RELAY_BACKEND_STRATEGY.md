---
title: "استراتژی Backend Relay"
version: 3.8.42
lastUpdated: 2026-06-30
---

# استراتژی Backend Relay

## خلاصه

RouteChi اکنون سه حالت relay را برای `/api/v1/relay/chat/completions` پشتیبانی می‌کند:

- `ts`: استفاده از relay TypeScript در-process.
- `bifrost`: اجبار gateway Bifrost.
- `auto`: ترجیح Bifrost هنگام در دسترس بودن، fallback به TypeScript هنگام شکست.

هنگامی که با نرخ درخواست بالا اجرا می‌کنید (تعداد زیادی tokens/day، throughput نزدیک به ثابت)، بهترین استراتژی این است که مسیر fallback را صریح و سریع نگه دارید تا مسیر داغ هرگز روی یک sidecar مرده مسدود نشود.

## رفتار حالت

- `ts`
  - کمترین پیچیدگی عملیاتی.
  - همه مسیریابی و اعتبارسنجی در Node اجرا می‌شود.
  - بدون وابستگی sidecar برای دسترس‌پذیری.
- `bifrost`
  - اجبار همه درخواست‌ها از طریق gateway sidecar.
  - بدون fallback خودکار.
  - فقط زمانی مفید که سلامت و تأخیر sidecar تضمین‌شده باشد.
- `auto`
  - هنگامی که sidecar قابل دسترسی و فعال باشد استفاده می‌شود.
  - تلاش‌های ناموفق headerهای fallback را راه‌اندازی و ترافیک را به TS برمی‌گرداند تا موفقیت درخواست محدود بماند.
  - این حالت امن‌ترین انتخاب برای production است زمانی که uptime بیشتر از مسیریابی فقط-sidecar اهمیت دارد.

## 9router در برابر CLIPROXYAPI امروز

9router و CLIPROXYAPI هر دو یکپارچه‌سازی‌هایی هستند که از نظر تاریخی مسیرهای سازگاری را برای ارائه‌دهندگان upstream نمایش می‌دادند.

- 9router یک مسیر embedded برای orchestration و رفتار سازگاری upstream است.
- CLIPROXYAPI یک bridge API پروکسی برای ترافیک سبک CLI / SDK است.
- Bifrost در حال پایدار شدن به‌عنوان مسیر externalized است زمانی که به یک hop sidecar-manند اختصاصی و dispatch محلی با تأخیر کم نیاز دارید.

اگر در حال حاضر 9router/CLIPROXYAPI را مقایسه می‌کنید:

- امضای درخواست، بررسی‌های allowlist و دروازه‌های خط‌مشی DB را در مسیر API پیش از تحویل نگه دارید.
- اگر یک workflow نیاز به رفتار sidecar سخت‌گیرانه و واریانس کمتر به‌ازای درخواست دارد، از `OMNIROUTE_RELAY_BACKEND=bifrost` استفاده کنید.
- اگر نیاز به تاب‌آوری sidecar با تخریب نرم تحت شرایط incident دارید، از `OMNIROUTE_RELAY_BACKEND=auto` استفاده کنید.

## قرارداد مرز backend

مرز محصول پایدار، API relay RouteChi است، نه پیاده‌سازی داشبورد. داشبورد Next.js ممکن است سرویس‌های محلی را نصب، پیکربندی و نظارت کند، اما مسیریابی درخواست باید از طریق API relay وارد شود و پشت آن مرز تحویل داده شود.

انتخاب‌های backend بلندمدت:

- relay TypeScript را به‌عنوان مسیر خط‌مشی و fallback در-process نگه دارید. Auth، allowlistها، نرمال‌سازی درخواست، حسابداری و بررسی‌های ایمنی پیش از هر تحویل backend در اینجا می‌مانند.
- از Bifrost به‌عنوان sidecar Tier-1 با throughput بالا ترجیحی استفاده کنید زمانی که استقرار نیاز به واریانس مسیریابی کمتر، چرخش متمرکز ارائه‌دهنده یا scale-out در میان چند replica از RouteChi دارد.
- 9router و CLIPROXYAPI را به‌عنوان سرویس‌های سازگاری embedded نگه دارید. آن‌ها به‌عنوان فرآیندهای محلی تحت نظارت اجرا می‌شوند و زمانی که رفتار provider/CLI آن‌ها adapter مورد نظر است مفیدند، اما نباید به موتور مسیریابی پیش‌فرض Tier-1 تبدیل شوند.
- داشبورد نباید URLهای سرویس دلخواه را به مسیر داغ ارسال کند. URLهای ارائه‌شده توسط UI ورودی‌های پیکربندی هستند؛ کد مسیریابی باید backendهای ثبت‌شده، بررسی‌شده-سلامت را از تنظیمات سمت سرور و حالت supervisor تفکیک کند.
- امروز برای سرویس‌های تحت نظارت، HTTP loopback را ترجیح دهید چون فرآیندهای مدیریت‌شده از قبل APIهای سازگار با HTTP نمایش می‌دهند، route guard می‌تواند مرز را ممیزی کند و رفتار شکست/fallback در لاگ‌های درخواست قابل‌مشاهده است. یک SDK یا transport socket آینده تنها زمانی ارزش افزودن دارد که به‌طور قابل‌سنجشی تأخیر مسیریابی p99 را بدون تضعیف ایزولاسیون یا semanticsهای fallback کاهش دهد.

برای یک استقرار با throughput بسیار بالا، پاسخ پیش‌فرض بنابراین `auto` با Bifrost فعال است: از sidecar Go در مسیر داغ استفاده کنید در حالی که fallback TypeScript برای نرخ موفقیت حفظ می‌شود. از `bifrost` فقط زمانی استفاده کنید که رفتار سخت‌گیرانه فقط-sidecar مهم‌تر از تخریب نرم باشد.

## راهنمای throughput بالا

برای RPM/RPS پایدار بالا و SLO موفقیت سخت‌گیرانه:

1. از `auto` با یک cooldown عملی و telemetry شکست استفاده کنید.
2. اعتبارسنجی upstream و بررسی‌های API-key را روی مرز مسیر TypeScript نگه دارید.
3. headerها/شمارنده‌های صریح را فعال کنید تا alerting شما فرکانس و دلایل fallback را ببیند.
4. timeoutهای sidecar را تنظیم کنید که سریع شکست بخورند، نه برای همیشه صبر کنند.
5. حلقه auto-restart سرویس و telemetry سلامت را سالم نگه دارید تا fallback واقعاً استثنایی باشد.

## baseline پیشنهادی

- `OMNIROUTE_RELAY_BACKEND=auto`
- `BIFROST_ENABLED=1`
- API keyها، allowlist، sanitizer و بررسی‌های rate-limit را در هندلرهای مسیر فعال نگه دارید (آن‌ها همیشه پیش از forwarding downstream اجرا می‌شوند).
- متریک fallback را از reverse proxy و لاگ‌های درخواست خود export کنید تا قطعی‌های sidecar در عرض یک دقیقه قابل‌مشاهده باشند.

## قرارداد پلاگین ارائه‌دهنده

Sidecarها باید متادیتای ارائه‌دهنده را از طریق manifest
پلاگین ارائه‌دهنده JSON-safe import کنند به‌جای وابستگی به داخلی‌های executor TypeScript. به
[Manifest پلاگین ارائه‌دهنده](./PROVIDER_PLUGIN_MANIFEST.md) برای قرارداد واجد شرایط بودن
sidecar و فازهای مهاجرت مراجعه کنید.
