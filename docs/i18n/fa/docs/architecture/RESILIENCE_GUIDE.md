---
title: "راهنمای تاب‌آوری"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای تاب‌آوری

OmniRoute سه مکانیسم تاب‌آوری متمایز اما مرتبط دارد. هر کدام دامنه و هدف متفاوتی دارند. هنگام رفع اشکال رفتار مسیریابی، آن‌ها را جدا نگه دارید.

![مدل تاب‌آوری ۳-لایه‌ای](../diagrams/exported/resilience-3layers.svg)

> منبع: [diagrams/resilience-3layers.mmd](../diagrams/resilience-3layers.mmd)

## ۱. مدارشکنی provider

**دامنه:** کل یک provider (مثلاً `glm`، `openai`، `anthropic`).

**هدف:** توقف ارسال ترافیک به provider‌یی که به‌طور مکرر در سطح upstream/سرویس شکست می‌خورد.

**پیاده‌سازی:**

- کلاس اصلی: `src/shared/utils/circuitBreaker.ts`
- اتصال: `src/sse/handlers/chatHelpers.ts`، `src/sse/handlers/chat.ts`
- API وضعیت: `GET /api/monitoring/health`
- API بازنشانی: `POST /api/resilience/reset`
- Wrapper‌ها: `open-sse/services/accountFallback.ts`
- جدول DB: `domain_circuit_breakers`

**حالت‌ها:**

- `CLOSED` — ترافیک عادی مجاز است
- `DEGRADED` — ترافیک همچنان مجاز است، اما شکست‌های بالای provider ردیابی می‌شوند
- `OPEN` — provider به‌طور موقت مسدود شده؛ مسیریابی combo از آن عبور می‌کند
- `HALF_OPEN` — زمان بازنشانی گذشته؛ درخواست probe مجاز است

**پیش‌فرض‌های قابل‌پیکربندی (`open-sse/config/constants.ts`، نمایش‌داده‌شده در داشبورد ← تنظیمات ← تاب‌آوری):**

| کلاس        | DEGRADED در | OPEN در      | زمان بازنشانی |
| ----------- | ----------- | ------------ | ------------- |
| OAuth       | ۵ شکست      | ۸ شکست       | ۶۰ث           |
| API-key     | ۷ شکست      | ۱۲ شکست      | ۳۰ث           |
| Local       | مشتق‌شده    | ۲ شکست       | ۱۵ث           |

`degradationThreshold` کنترل می‌کند چه زمانی یک provider وارد `DEGRADED` می‌شود؛ `failureThreshold` کنترل می‌کند چه زمانی باز (OPEN) می‌شود و از آن عبور می‌کند. پروفایل‌های Local provider هنوز در صفحه تنظیمات تاب‌آوری نمایش داده نمی‌شوند.

**کدهای فعال‌سازی:** فقط وضعیت‌های سطح provider `[408, 500, 502, 503, 504]`. برای خطاهای سطح حساب (اکثر ۴۰۱/۴۰۳/۴۲۹ — این‌ها متعلق به cooldown یا lockout هستند) فعال **نمی‌شود**.

**بازیابی تنبل:** وقتی `OPEN` منقضی می‌شود، `getStatus()`، `canExecute()`، `getRetryAfterMs()` حالت را به `HALF_OPEN` به‌روزرسانی می‌کنند. نیازی به تایمر پس‌زمینه نیست.

---

## ۲. cooldown اتصال

**دامنه:** یک اتصال/حساب/کلید provider.

**هدف:** عبور از یک کلید بد در حالی که سایر اتصالات همان provider به سرویس‌دهی ادامه می‌دهند.

**پیاده‌سازی:**

- علامت‌گذاری به‌عنوان unavailable: `src/sse/services/auth.ts::markAccountUnavailable()`
- انتخاب: `getProviderCredentials*` در همان فایل
- محاسبه cooldown: `open-sse/services/accountFallback.ts::checkFallbackError()`
- تنظیمات: `src/lib/resilience/settings.ts`

**فیلدهای هر اتصال:**

- `rateLimitedUntil` — مهر زمانی تا انقضای cooldown
- `testStatus: "unavailable"`
- `lastError`, `lastErrorType`, `errorCode`
- `backoffLevel` — شمارنده backoff نمایی

**cooldown‌های پیش‌فرض:**

- پایه OAuth: ۵ث
- پایه API-key: ۳ث
- API-key 429: `Retry-After` بالادستی/هدرهای reset/متن reset قابل‌تجزیه را ترجیح می‌دهد
- Backoff: `baseCooldownMs * 2 ** failureIndex`

**محافظ ضد thundering-herd:** از تمدید بیش‌ازحد cooldown یا افزایش دوگانه `backoffLevel` توسط شکست‌های همزمان جلوگیری می‌کند.

**حالت‌های پایانی (cooldown نیستند):**

- `banned` — با شناسایی کلیدواژه ممنوع / شناسایی ban حساب تنظیم می‌شود (به [BAN_DETECTION](../security/BAN_DETECTION.md) مراجعه کنید)
- `expired`
- `credits_exhausted`

این‌ها تا زمان تغییر credentials یا بازنشانی توسط اپراتور باقی می‌مانند. حالت‌های پایانی را با حالت cooldown گذرا بازنویسی نکنید.

**بازیابی تنبل:** وقتی `rateLimitedUntil` گذشته باشد، اتصال دوباره واجد شرایط می‌شود. پس از استفاده موفق، `clearAccountError()` همه فیلدهای خطا را پاک می‌کند.

---

## ۳. قفل مدل

**دامنه:** سه‌تایی provider + اتصال + مدل.

**هدف:** جلوگیری از غیرفعال‌کردن کل اتصال وقتی فقط یک مدل unavailable یا محدودیت-سهمیه‌ای است.

**نمونه‌ها:**

- provider‌های با سهمیه به‌ازای-مدل که ۴۲۹ برمی‌گردانند
- provider‌های محلی که ۴۰۴ برای یک مدل گمشده برمی‌گردانند
- شکست‌های مجوز حالت/مدل خاص provider (مثلاً حالت‌های Grok)

**پیاده‌سازی:** `open-sse/services/accountFallback.ts` — `lockModel()`، `clearModelLock()`، `getAllModelLockouts()`.

### داشبورد cooldown مدل‌ها (v3.8.0)

رابط کاربری: تنظیمات ← cooldown مدل‌ها (`src/app/(dashboard)/dashboard/settings/components/ModelCooldownsCard.tsx`)

قفل‌های فعال را با: provider، اتصال، مدل، دلیل، expiresAt فهرست می‌کند. اپراتورها می‌توانند یک مدل را به‌صورت دستی از کارت فعال کنند.

**REST API:**

- `GET /api/resilience/model-cooldowns` — فهرست قفل‌های فعال
- `DELETE /api/resilience/model-cooldowns` — فعال‌سازی دستی. بدنه: `{provider, connection, model}`. احراز هویت: management.

### رابط تنظیمات قفل + بازیابی success-decay (v3.8.23)

قفل مدل از یک رفتار همیشه-رو کدگذاری‌شده به یک ویژگی کاملاً قابل‌پیکربندی و اختیاری با کارت تنظیمات مختص به خود و مسیر بازیابی خود-شفابخش تبدیل شد.

**کارت تنظیمات:** تنظیمات ← قفل مدل
(`src/app/(dashboard)/dashboard/settings/components/ModelLockoutCard.tsx`).
این **متمایز** از `ModelCooldownsCard` فقط‌خواندنی بالا (که فقط قفل‌های فعال را _فهرست می‌کند_) است — کارت جدید _پارامترها را پیکربندی می‌کند_. پیش‌فرض‌ها
در `DEFAULT_MODEL_LOCKOUT_SETTINGS`
(`src/lib/resilience/modelLockoutSettings.ts`) قرار دارند:

| تنظیم                    | پیش‌فرض                          | معنی                                                            |
| ------------------------ | -------------------------------- | --------------------------------------------------------------- |
| `enabled`                | `false`                          | سوئیچ اصلی — قفل مدل **به‌صورت پیش‌فرض خاموش** است.             |
| `errorCodes`             | `[403, 404, 429, 502, 503, 504]` | وضعیت‌های upstream که به‌عنوان شکست scope-مدل حساب می‌شوند.       |
| `baseCooldownMs`         | `120_000` (۱۲۰ ث)                | مدت قفل اولیه برای اولین شکست.                                  |
| `maxCooldownMs`          | `1_800_000` (۳۰ دقیقه)           | سقف cooldown تشدید‌شده.                                          |
| `maxBackoffSteps`        | `10`                             | حداکثر مراحل تشدید backoff نمایی.                                |
| `useExponentialBackoff`  | `true`                           | آیا شکست‌های مکرر cooldown را به‌صورت نمایی تشدید می‌کنند.        |

تنظیمات از طریق store تنظیمات معمول ذخیره می‌شوند و با schema تنظیمات تاب‌آوری اعتبارسنجی می‌گردند؛ کارت `baseCooldownMs`/`maxCooldownMs` را (با `maxCooldownMs ≥ baseCooldownMs`) و `maxBackoffSteps` را محدود می‌کند.

**بازیابی success-decay:** بازیابی **صرفاً** انقضای تایمر نیست. یک پاسخ سالم، شمارش شکست مدل را به‌عقب برمی‌گرداند تا مدلی که در میانه-پنجره بهبود یافته است، قبل از زمان تایمر خود، تشدید را متوقف کند (و پاک شود). هنگام موفقیت در هدف combo، `open-sse/services/combo.ts` تابع `decayModelFailureCount()` (`open-sse/services/accountFallback.ts`) را فراخوانی می‌کند که `failureCount` ذخیره‌شده را **نصف** می‌کند (`Math.floor(failureCount / 2)`)؛ وقتی به `0` برسد، ورودی قفل کامل حذف می‌شود. همتای آن `recordModelLockoutFailure()` شمارش را (و cooldown را تشدید می‌کند) در شکست‌های درون پنجره تشدید افزایش می‌دهد. این success-decay علاوه بر انقضای تایمر ساده است — هر کدام از مسیرها می‌توانند یک مدل را فعال کنند.

**حالت:** قفل‌ها **در حافظه** نگهداری می‌شوند (`Map`‌های هر-فرآیند از `ModelLockoutEntry` با کلید `provider:connectionId:model`)، در DB ذخیره نمی‌شوند — با راه‌اندازی مجدد از بین می‌روند. _تنظیمات_ پایا هستند؛ _حالت_ قفل فعال گذرا است.

---

## ۴. کنترل همزمانی Quota-Share (v3.8.36)

حساب‌های اشتراکی (GLM، MiniMax، و غیره) اغلب فقط حدود ۱-۳ درخواست همزمان را می‌پذیرند؛ تجاوز از آن باعث ۴۲۹ و cooldown می‌شود. این موضوع در combo‌های **quota-share** (`qtSd/…`) که در آن چندین کلید API یک حساب upstream را به اشتراک می‌گذارند، حاد است. سه لایه از غرق‌شدن یک حساب مشترک جلوگیری می‌کنند.

### سقف همزمانی هر اتصال (`max_concurrent`)

هر اتصال provider می‌تواند یک سقف `max_concurrent` تعریف کند
(`provider_connections.max_concurrent`، تنظیم‌شده در مودال اتصال / API / DB).
برای بدون محدودیت خالی بگذارید. این تنها تنظیمی است که لایه serialization زیر را هدایت می‌کند — آن را به همزمانی واقعی حساب تنظیم کنید (مثلاً GLM ~۱، MiniMax ~۲).

### Serialization درخواست quota-share

وقتی یک ارسال quota-share به اتصالی هدف می‌گیرد که `max_concurrent` مثبت تعریف کرده است، درخواست‌های همزمان به آن **حساب** از طریق یک سمافور هر-اتصال (کلید `qsconn:<connectionId>`) serialized می‌شوند: درخواست‌های مازاد **در صف منتظر می‌مانند** به جای غرق‌کردن حساب. این **fail-open** است — یک صف اشباع یا timeout بدون slot ادامه می‌یابد به جای اینکه یک درخواست قابل‌ارسال را رد کند. در **تنظیمات ← تاب‌آوری ← همزمانی هر-اتصال quota-share** فعال کنید (`resilienceSettings.quotaShareConcurrencyLimit.enabled`، پیش‌فرض روشن). بدون سقف `max_concurrent` رفتار بدون تغییر می‌ماند.

> دروازه مسیریابی quota-share (`selectQuotaShareTarget`، DRR + P2C) خودش fail-open است و فقط یک اتصال در-سقف را _کم‌اولویت_ می‌کند — با یک استخر تک‌اتصالی نمی‌تواند به‌سختی محدود کند، بنابراین این سمافور چیزی است که در عمل سیل را مهار می‌کند.

### retry آگاه از cooldown در combo

فقط برای combo‌های quota-share، درخواستی که یک ۴۲۹ را برای cooldown گذار کوتاه متبلور می‌کند، به جای بازگرداندن ۴۲۹، آن را منتظر می‌ماند و دوباره ارسال می‌کند. با `comboCooldownWait` (`enabled`، `maxWaitMs` ۵ث، `maxAttempts` ۲، `budgetMs` ۸ث) در **تنظیمات ← تاب‌آوری** محدود می‌شود. هرگز بر `quota_exhausted` (قفل‌شده تا نیمه‌شب) یا دلایل auth/not-found منتظر نمی‌ماند.

---

## سایر ویژگی‌های تاب‌آوری

- **۱۸ استراتژی مسیریابی** (priority، weighted، round-robin، context-relay، fill-first، p2c، random، least-used، cost-optimized، reset-aware، reset-window، headroom، strict-random، auto، lkgp، context-optimized، fusion، pipeline) — به [AUTO-COMBO.md](../routing/AUTO-COMBO.md) مراجعه کنید.
- **مسیریابی reset-aware** (v3.8.0) — اتصالات را بر اساس زمان reset سهمیه اولویت‌بندی می‌کند.
- **تنزل حالت پس‌زمینه** — Responses API `background: true` به همراه هشدار به حالت sync تنزل می‌یابد.
- **شناسایی پویای محدودیت ابزار** — هنگام رسیدن به محدودیت تعداد ابزار، از provider‌ها عقب‌نشینی می‌کند.
- **fallback اضطراری** — توسط `OMNIROUTE_EMERGENCY_FALLBACK` کنترل می‌شود؛ اپراتورها می‌توانند بدون راه‌اندازی مجدد از صفحه Feature Flags آن را بازنویسی کنند.

---

## رفع اشکال

- همه کلیدها برای یک provider عبور داده شدند ← هم وضعیت مدارشکنی و هم `rateLimitedUntil`/`testStatus` هر اتصال را بررسی کنید.
- provider پس از پنجره reset به‌طور دائم مستثنی شده ← کد raw `state` را به جای `getStatus()`/`canExecute()` می‌خواند.
- یک کلید شکست می‌خورد، بقیه باید کار کنند ← cooldown اتصال را به مدارشکنی ترجیح دهید.
- فقط یک مدل شکست می‌خورد ← قفل مدل را به cooldown اتصال ترجیح دهید.
- حالت باید خود-بازیابی شود اما نمی‌شود ← مهر زمانی آینده + مسیر خواندن که حالت منقضی را به‌روزرسانی می‌کند، بررسی کنید. وضعیت‌های دائمی نیازمند تغییرات دستی هستند.

---

## TLS Fingerprinting و Stealth

Stealth خاص provider (JA3/JA4، CCH، obfuscation) به‌طور جداگانه مستند شده است — به [STEALTH_GUIDE.md](../security/STEALTH_GUIDE.md) مراجعه کنید.

---

## آزمون تاب‌آوری (Phase 8 · Block C)

علاوه بر آزمون‌های واحد برای منطق تاب‌آوری، سه آزمون runtime را تحت شرایط استرس/شکست واقعی اجرا می‌کنند (همه integration/nightly — هیچ‌کدام PR‌ها را مسدود نمی‌کنند):

| آزمون        | چه چیزی                                                                                                                                                                       | اجرا                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Chaos        | گره fake-upstream تأخیر/reset/timeout/503 واقعی تزریق می‌کند؛ اعتبارسنجی می‌کند که مدارشکنی باز/بازیابی می‌شود و `checkFallbackError` 503 را به‌عنوان fallback قابل‌بازیابی طبقه‌بندی می‌کند. | `RUN_CHAOS_INT=1 npm run test:chaos`     |
| Heap-growth  | حدود ۵۰۰ استریم به‌ازای `createSSEStream` تحت `--expose-gc`؛ اگر heap از سقف رشد کند شکست می‌خورد (OOM guard #3069).                                                            | `npm run test:heap`                      |
| k6 soak      | بار پایدار علیه `/api/monitoring/health`؛ آستانه‌های p95/خطا.                                                                                                                  | `k6 run tests/load/k6-soak.js` (nightly) |

به‌وسیله `.github/workflows/nightly-resilience.yml` هماهنگ می‌شود (cron + dispatch). در
`test:integration` پیش‌فرض، chaos و heap خود-عبور می‌کنند (بدون `RUN_CHAOS_INT`/`--expose-gc`).

---

## مراجع دیگر

- [راهنمای معماری](./ARCHITECTURE.md) — معماری سیستم و internals
- [راهنمای کاربر](../guides/USER_GUIDE.md) — provider‌ها، combo‌ها، یکپارچه‌سازی CLI
- [موتور Auto-Combo](../routing/AUTO-COMBO.md) — امتیازدهی ۱۲-عاملی، mode packs
