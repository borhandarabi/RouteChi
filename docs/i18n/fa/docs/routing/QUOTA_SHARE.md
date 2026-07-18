---
title: "موتور اشتراک سهمیه"
version: 3.8.40
lastUpdated: 2026-06-28
---

# موتور اشتراک سهمیه

> **مرجع مستند:** `docs/routing/QUOTA_SHARE.md`
> بخشی از Group B (طرح‌های ۱۶ + ۲۲).

---

## مرور کلی

موتور اشتراک سهمیه (Quota Sharing Engine) سهمیهٔ مبتنی بر زمان یک پروایدر را (مثلاً پنجرهٔ ۵‌ساعته Codex، ۱۵۰۰ درخواست/ساعت Kimi) به‌طور عادلانه میان چندین کلید API که از یک اتصال مشترک استفاده می‌کنند، توزیع می‌کند.

**مشکلی که حل می‌کند:** RouteChi کلیدهای API زیادی را در برابر یک حساب پروایدر بالادست یکسان پراکسی می‌کند. بدون منطق اشتراک‌گذاری، یک جهش از کلید A می‌تواند سهمیهٔ پروایدر برای آن ساعت را تخلیه کند و کلیدهای B و C را تا زمان بازنشانی پنجره مسدود کند.
این موتور با کارهای زیر از این وضعیت جلوگیری می‌کند:

1. ردیابی مصرف غلتکی هر کلید به تفکیک بُعد (٪، درخواست، توکن، $).
2. اعمال الگوریتم fair-share کار-حفظ‌کننده: یک کلید می‌تواند هنگامی که مخزن سراسری اشباع نشده از سهم بی‌کاربرد قرض کند.
3. اعمال نتیجه در مسیر داغ (`chatCore.ts`) پیش از آنکه درخواست به executor بالادست برسد.

---

## الگوریتم: Fair-Share کار-حفظ‌کننده

پیاده‌سازی‌شده در `src/lib/quota/fairShare.ts`.

### حالت‌ها

| Condition                                  | Mode         | Behaviour                                              |
| ------------------------------------------ | ------------ | ------------------------------------------------------ |
| `globalUsedPercent < saturationThreshold`  | **Generous** | کلید می‌تواند تا سقف سراسری منهای کل مصرف‌شده قرض کند |
| `globalUsedPercent >= saturationThreshold` | **Strict**   | fair share فردی به‌طور سخت‌گیرانه اعمال می‌شود        |

پیش‌فرض `saturationThreshold = 0.5` (env `QUOTA_SATURATION_THRESHOLD`).

### تصمیم به‌تفکیک بُعد

برای هر بُعد فعال در pool، موتور محاسبه می‌کند:

```
fairShareAllowed = poolLimit × (allocationWeight / 100)
consumed        = current rolling value for this key (from QuotaStore.peek)
remaining       = fairShareAllowed - consumed
```

سپس:

- **`policy = hard`**: اگر `consumed > fairShareAllowed` و حالت strict باشد → **block**.
- **`policy = soft`**: اگر `consumed > fairShareAllowed` و حالت strict باشد → **penalize** (در combo اولویت‌کمتر؛ هرگز hard-block نمی‌کند).
- **`policy = burst`**: تا زمانی که سرسری headroom وجود دارد بدون توجه به fair share اجازه دهید.

### سقف مطلق

`capValue` + `capUnit` روی یک تخصیص یک سقف سخت مستقل از حالت یا سیاست است. هر بُعدی که در آن `consumed >= capValue` باشد همواره درخواست را **block** می‌کند.

### بررسی چند‌بُعدی

یک درخواست مسدود می‌شود اگر **هر** بُعدی در pool آن را مسدود کند. ابعاد مستقل هستند — تخلیهٔ 5h% روی بُعد weekly% تأثیری ندارد.

### قرض‌گیری

در حالت generous، کلیدی که تخصیص آن کمتر از حد مصرف شده باشد می‌تواند مازاد سهم تخصیص‌نیافتهٔ کلیدهای دیگر را استفاده کند. فرمول:

```
maxAllowed = globalLimit - consumedByOtherKeys
```

که در آن `consumedByOtherKeys = consumedTotal - consumedByThisKey`. سقف سراسری
(`limit` آن بُعد در pool) همواره سقف سخت است.

---

## شمارندهٔ پنجرهٔ غلتکی

پیاده‌سازی‌شده در `src/lib/quota/sqliteQuotaStore.ts` و `redisQuotaStore.ts`.

دو باکت به ازای هر `(apiKeyId, dimensionKey)`:

- `curr`: باکت فعلی (`floor(nowMs / windowMs)`)
- `prev`: باکت قبلی (`curr - 1`)

مقدار غلتکی مؤثر:

```
effectiveBucketIndex = floor(nowMs / windowMs)
bucketStartMs        = effectiveBucketIndex × windowMs
elapsed              = nowMs - bucketStartMs
weight               = 1 - elapsed / windowMs

effective = prev × weight + curr
```

**دقت:** حدود ۹۹٪ دقیق. خطا حداکثر ۱٪ اندازهٔ پنجره در مرز میان باکت‌ها است (ذاتی برای تقریب دو‌باکتی).

### همزمانی

درایور SQLite: یک mutex درون‌حافظه‌ای به ازای کلید `(apiKeyId | dimensionKey)` از رقابت read-modify-write جلوگیری می‌کند. این الگو از الگوی `src/sse/services/auth.ts` برای ضد طوفان-گله (anti-thundering-herd) پیروی می‌کند.

درایور Redis: اسکریپت Lua EVAL برای افزایش اتمیک — به‌عنوان یک دستور Redis اجرا می‌شود.

---

## درایورها

### SQLite (پیش‌فرض، بدون نیاز به نصب)

- جدول: `quota_consumption` (به migration `073_quota_pools.sql` / `074_quota_consumption.sql` مراجعه کنید).
- مناسب استقرارهای تک‌نمونه.
- تمامی پایداری در پایگاه‌دادهٔ SQLite موجود RouteChi ذخیره می‌شود (`DATA_DIR/storage.sqlite`).

### Redis (اختیاری، چند‌نمونه‌ای)

- نیازمند پکیج npm `ioredis`.
- شمارنده‌ها در Redis ذخیره می‌شوند؛ متادیتا (poolها/تخصیص‌ها) همچنان در SQLite است.
- مناسب استقرارهای چندنمونه‌ای که در آن شمارنده‌ها باید مشترک باشند.

### تعویض درایورها

از طریق رابط تنظیمات (`/dashboard/settings` → Quota Store)، یا از طریق متغیرهای محیطی:

```bash
QUOTA_STORE_DRIVER=redis
QUOTA_STORE_REDIS_URL=redis://localhost:6379
```

تنظیم DB بر env ارجحیت دارد. اگر `driver=redis` اما URL غایب باشد یا
`ioredis` نصب نباشد، factory به SQLite بازمی‌گردد و یک هشدار لاگ می‌کند.

ترتیب انتخاب درایور:

1. تنظیم DB `quotaStore.driver`
2. env `QUOTA_STORE_DRIVER`
3. پیش‌فرض: `sqlite`

---

## چندبُعدی

یک pool می‌تواند چند بُعد داشته باشد. هر بُعد مستقل است:

```ts
QuotaDimension {
  unit: "percent" | "requests" | "tokens" | "usd",
  window: "5h" | "hourly" | "daily" | "weekly" | "monthly",
  limit: number,  // global pool ceiling for this dimension
}
```

**نمونه: طرح Codex** (5h% + weekly%):

```json
[
  { "unit": "percent", "window": "5h", "limit": 100 },
  { "unit": "percent", "window": "weekly", "limit": 100 }
]
```

یک درخواست باید همهٔ ابعاد را برآورده کند تا اجازه داده شود.

---

## حل‌کنندهٔ طرح (Plan Resolver)

پیاده‌سازی‌شده در `src/lib/quota/planResolver.ts`.

ارجحیت (از بالا به پایین):

1. **بازنویسی دستی DB** — جدول `provider_plans`، به‌تفکیک `connectionId`.
2. **کاتالوگ شناخته‌شده** — `src/lib/quota/planRegistry.ts` (فقط داده).
3. **طرح خالی** — بدون ابعاد، پیکربندی دستی لازم است.

### کاتالوگ شناخته‌شده

| Provider              | Dimensions                                                    |
| --------------------- | ------------------------------------------------------------- |
| `codex`               | `percent/5h/100`, `percent/weekly/100`                        |
| `glm`                 | `tokens/5h` (limit=0, unknown), `tokens/weekly`               |
| `minimax`             | `tokens/5h`, `tokens/weekly`                                  |
| `bailian`             | `percent/5h/100`, `percent/weekly/100`, `percent/monthly/100` |
| `kimi`                | `requests/hourly/1500`                                        |
| `alibaba`             | `requests/monthly/90000`                                      |
| `openai`, `anthropic` | بدون پیش‌فرض — پیکربندی دستی لازم است                          |

---

## یکپارچه‌سازی خط‌لوله

### PRE hook (`open-sse/handlers/chatCore.ts`)

پیش از executor بالادست و پس از بررسی‌های احراز هویت و سیاست اجرا می‌شود:

```
resolveComboTargets / handleSingleModel
  → enforceQuotaShare(apiKeyId, connectionId, provider, estimatedCost)
      → getQuotaStore().peek() per dimension
      → fairShare.decideFairShare()
      → if block → return 429 (buildErrorBody, Hard Rule #12)
      → if allow + deprioritize → set quotaSoftPenalty=true on candidate
  → executor.execute()
```

**Fail-open:** اگر `enforceQuotaShare` استثنا پرتاب کند، درخواست با یک لاگ `pino.warn` اجازه عبور می‌یابد. این کار از مسدود شدن تمام ترافیک توسط یک باگ موتور سهمیه جلوگیری می‌کند.

### POST hook (ثبت مصرف)

پس از یک پاسخ موفق:

```
executor returns success
  → spendRecorder.recordConsumption(apiKeyId, connectionId, provider, actualCost)
      → getQuotaStore().consume() per dimension
      → fail-open: errors logged as pino.warn, never propagated to client
```

**نکتهٔ انحراف:** اگر `consume` پس از پاسخ شکست بخورد، شمارندهٔ غلتکی کمتر از واقعیت شمارش می‌کند.
سیگنال اشباع از پروایدر (مثلاً `anthropic-ratelimit-unified-5h-utilization`)
تخمین سراسری را در درخواست بعدی اصلاح می‌کند.

### جریمهٔ soft در combo (`open-sse/services/combo.ts`)

هنگامی که `decision.deprioritize === true`:

```ts
if (candidate.quotaSoftPenalty) {
  score *= QUOTA_SOFT_DEPRIORITIZE_FACTOR; // default 0.7
}
```

جریمه پس از همهٔ عوامل امتیازدهی دیگر اعمال می‌شود. این کار احتمال انتخاب یک کلید اشباع‌شده در auto-combo را کاهش می‌دهد بدون آنکه آن را hard-block کند.

---

## مرور رابط کاربری

### `/dashboard/costs/quota-share` — صفحهٔ اصلی poolها

کامپوننت‌ها (همگی در `src/app/(dashboard)/dashboard/costs/quota-share/`):

| Component              | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `QuotaConceptCard`     | کارت مقدماتی برای توضیح اشتراک سهمیه به کاربران جدید              |
| `CreatePoolModal`      | ایجاد یک pool جدید (اتصال + نام + تخصیص‌های اولیه)                |
| `PoolCard`             | خلاصه به‌تفکیک pool: نام، اتصال، تعداد تخصیص                       |
| `DimensionBar`         | نوار انباشته به‌تفکیک بُعد: سهم هر کلید + مصرف سراسری              |
| `AllocationTable`      | جدول با مصرف، fair share، کسری/مازاد، پرچم قرض‌گیری               |
| `BurnRateChart`        | نمودار خطی نرخ مصرف EMA (Recharts با بارگذاری تنبل از طریق `dynamic()`) |
| `EditAllocationsModal` | ویرایش وزنهای تخصیص، سقفها و سیاست‌ها برای یک pool               |

hookهای صفحه:

- `usePools` — هر ۳۰ ثانیه `GET /api/quota/pools` را فراخوانی می‌کند.
- `usePoolUsage` — در صورت نیاز `GET /api/quota/pools/[id]/usage` را فراخوانی می‌کند.
- `useLocalStoragePoolMigration` — یک‌بار هنگام mount برای مهاجرت داده‌های LS قدیمی اجرا می‌شود.

### `/dashboard/costs/quota-share/plans` — پیکربندی طرح پروایدر

- `ProviderPlanConfigClient.tsx`: فهرست کشویی برای انتخاب پروایدر، مشاهدهٔ طرح حل‌شده (خودکار از کاتالوگ یا بازنویسی دستی) و ویرایش ابعاد.
- تغییرات با `PUT /api/quota/plans/[connectionId]` نوشته می‌شوند.
- حذف، به کاتالوگ یا طرح خالی بازمی‌گردد.

---

## متغیرهای محیطی

| Variable                           | Default   | Description                                            |
| ---------------------------------- | --------- | ------------------------------------------------------ |
| `QUOTA_STORE_DRIVER`               | `sqlite`  | درایور مورد استفاده: `sqlite` یا `redis`               |
| `QUOTA_STORE_REDIS_URL`            | _(empty)_ | Redis URL، مثلاً `redis://localhost:6379`              |
| `QUOTA_SATURATION_THRESHOLD`       | `0.5`     | 0..1؛ `>= threshold` حالت strict را فعال می‌کند        |
| `QUOTA_SOFT_DEPRIORITIZE_FACTOR`   | `0.7`     | 0..1؛ ضریب امتیاز combo در سیاست soft                  |
| `QUOTA_CONSUMPTION_RETENTION_DAYS` | `14`      | روزها تا زمانی که GC باکتهای قدیمی `quota_consumption` را حذف کند |

تنظیمات DB (`quotaStore.*`) بر متغیرهای محیطی ارجحیت دارند.

---

## رفع اشکال

### Redis پیکربندی شده اما متصل نمی‌شود

بررسی کنید که `ioredis` نصب است (`npm ls ioredis`) و `QUOTA_STORE_REDIS_URL`
در دسترس است. هنگام شکست اتصال، factory به SQLite بازمی‌گردد (در سطح `warn` لاگ می‌شود).

### `peek` کهنه برمی‌گرداند / fail-open

اگر `peek` استثنا پرتاب کند، `enforceQuotaShare` نتیجه را «اجازه» فرض می‌کند (fail-open).
برای یافتن علت ریشه‌ای، لاگ‌های `pino` برای ورودی‌های `quota:enforce` و `quota:factory` بررسی کنید.

### انحراف شمارندهٔ مصرف

اگر مصرف واقعی پروایدر با شمارنده‌ها متفاوت است، این مورد انتظار می‌رود — پنجرهٔ غلتکی دوباکتی در مرزهای پنجره خطای حدود ۱٪ دارد و `consume` پس از پاسخ به‌صورت fire-and-forget است. سیگنال اشباع (`saturationSignals.ts`)
مصرف واقعی پروایدر را با TTL ۳۰ ثانیه می‌خواند و `globalUsedPercent` را مطابق آن تنظیم می‌کند.

### pool برای نرخ مصرف «بدون داده» نمایش می‌دهد

`computeBurnRate` حداقل به ۲ نمونهٔ تاریخی نیاز دارد. poolهای جدید بدون فراخوانی قبلی `consume`
مقدار `tokensPerSecond: 0` و `timeToExhaustionMs: null` نمایش می‌دهند.

---

## مهاجرت از localStorage

هنگام اولین بارگذاری `/dashboard/costs/quota-share`، hook `useLocalStoragePoolMigration`
بررسی می‌کند:

1. `localStorage.getItem("omniroute:quota-share:pools")` غیرخالی است.
2. `GET /api/quota/pools` برمی‌گرداند `[]` (DB خالی است).

اگر هر دو درست باشند، هر pool قدیمی را به‌صورت دسته‌ای به `POST /api/quota/pools` ارسال می‌کند،
سپس کلید localStorage را حذف می‌کند. این مهاجرت idempotent است: شرط ۲ از مهاجرت مجدد جلوگیری می‌کند.

---

## طبقه‌بندی استراتژی داخلی

`quota-share` یک استراتژی مسیریابی **صرفاً داخلی** است (`INTERNAL_ROUTING_STRATEGY_VALUES` در
`src/shared/constants/routingStrategies.ts`). این استراتژی منحصراً توسط comboهای pool `qtSd/`
که توسط سیستم ضرب شده‌اند استفاده می‌شود و عمداً از `ROUTING_STRATEGY_VALUES` حذف شده تا هرگز
به‌عنوان گزینهٔ قابل‌انتخاب کاربر در رابط کاربری یا API ظاهر نشود.

---

## پوشش تست

دو لایه پوشش خودکار همراه با موتور quota-share ارائه می‌شود:

| Suite              | Command                                                                | What it covers                                                                                                                                                                                       |
| :----------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (29 tests)    | `node --import tsx/esm --test tests/unit/quota-share-strategy.test.ts` | زمان‌بند DRR، gating اشباع، سقفهای همزمانی، ریاضیات fairShare، صف backlog                                                                                                                            |
| Integration matrix | `npm run test:combo:matrix`                                            | تصمیم مسیریابی انتها‌به‌انتها از طریق خط‌لولهٔ واقعی combo؛ انصاف DRR + کاهش اولویت اشباع از طریق درزهای زنده (`registerQuotaFetcher`, `setLKGP`, `__setHeadroomSaturationFetcherForTests`) |

ماتریس یکپارچه‌سازی در CI در کنار ۱۷ استراتژی عمومی دیگر اجرا می‌شود. مجموعه unit به‌تنهایی قابل اجراست.

---

## خلاصهٔ شمای DB

سه جدول با migrationهای `073–075` اضافه شده‌اند:

- `quota_pools` + `quota_allocations` — تعاریف pool و تخصیص به‌تفکیک کلید.
- `quota_consumption` — شمارنده‌های غلتکی دوباکتی به‌ازای `(apiKeyId, dimensionKey)`.
- `provider_plans` — بازنویسی‌های دستی طرح پروایدر (JSON ابعاد به‌ازای connectionId).

تمام جدول‌ها از طریق migrationهای idempotent `CREATE TABLE IF NOT EXISTS` اضافه شده‌اند.
