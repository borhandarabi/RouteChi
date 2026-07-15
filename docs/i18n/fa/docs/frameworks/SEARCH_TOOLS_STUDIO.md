---
title: "استودیوی ابزارهای جستجو"
version: 3.8.40
lastUpdated: 2026-06-28
---

# استودیوی ابزارهای جستجو

> **قابلیت:** استودیوی ابزارهای جستجو — workspace یکپارچه ابزارهای وب برای `/dashboard/search-tools`.
> **برنامه‌ها:** `18-search-tools-studio-redesign.plan.md` + `_orchestration/master-plan-group-C.md`
> **وضعیت:** در v3.8.6 منتشر شد

---

## نمای کلی

استودیوی ابزارهای جستجو، `/dashboard/search-tools` را از یک محیط بازی جستجوی پایه به یک
استودیوی سه‌تبی تبدیل می‌کند که جستجوی وب، scrape وب و مقایسه ارائه‌دهنده‌ها به‌صورت کنار هم را یکپارچه می‌کند.

```
┌ Search Tools ──────────────────────────────────────────────────────────┐
│ [🔍 Search] [📄 Scrape] [⚖ Compare]             142ms · $0.001  </>    │
│ ⓘ [Modalities guide]                                                    │
├──────────────────────────────────────────┬─────────────────────────────┤
│  {active tab content}                    │ ─ Config                    │
│                                          │ Provider [auto ∨]           │
│                                          │   🟢 Serper  $0.001         │
│                                          │   🟢 Tavily  $0.008         │
│                                          │   🔥 Firecrawl (fetch)      │
│                                          │ Type   [web | news]         │
│                                          │ Full page [ ] (scrape)      │
│                                          │ Format [md|text|html]       │
│                                          │ Rerank model [∨]            │
└──────────────────────────────────────────┴─────────────────────────────┘
```

---

## تب‌ها

### تب جستجو

تب `SearchForm` + `ResultsPanel` + `RerankPanel` موجود را توسعه می‌دهد:

- پرس‌وجو → نتایج (عنوان، URL، قطعه، امتیاز مرتبط بودن).
- فراداده ارائه‌دهنده در پنل Config (هزینه، سهمیه، وضعیت).
- بخش rerank: انتخاب یک مدل rerank، مرتب‌سازی مجدد نتایج، نمایش `positionDelta`.
- حالت خالی با CTA زمانی که هیچ ارائه‌دهنده جستجویی پیکربندی نشده است.
- تاریخچه جستجو از طریق `SearchHistory.tsx`.
- فراخوانی `POST /v1/search` (endpoint موجود، بدون تغییر).

### تب Scrape

تب جدید برای استخراج محتوا از یک URL از طریق `POST /v1/web/fetch` (در برنامه ۰۵ ایجاد شده):

- ورودی: URL + toggle صفحه‌کامل + انتخابگر قالب (markdown / text / HTML).
- ارسال → fetch → رندر `ScrapeResult.tsx`.
- `ScrapeResult` پیش‌نمای markdown + toggle خام را رندر می‌کند.
- محدودیت: اگر بدنه پاسخ > **۲۵۶ کیلوبایت** باشد، رابط کاربری `(truncated, view raw)` را نشان می‌دهد و خام را در یک مودال Monaco باز می‌کند (D21).
- پنل فراداده: ارائه‌دهنده (firecrawl/jina-reader/tavily-search/tinyfish)، latency، هزینه، اندازه پاسخ، تعداد لینک‌ها.
- از hook `useScrapeFetch.ts` استفاده می‌کند.

### تب مقایسه

همان پرس‌وجو/URL را به‌صورت موازی روی حداکثر **۴ ارائه‌دهنده** اجرا می‌کند (D22):

- ستون‌های کنار هم به ازای هر ارائه‌دهنده.
- متریک‌ها: latency، هزینه، تعداد نتایج، اندازه پاسخ.
- محاسبه همپوشانی URL برای جستجو (تعداد URLهای مشترک در برابر نتیجه اولیه).
- به ازای هر ارائه‌دهنده `POST /v1/search` (جستجو) یا `POST /v1/web/fetch` (scrape) را فراخوانی می‌کند.

---

## پنل Config (مشترک)

`SearchToolsConfigPane.tsx` — همیشه قابل مشاهده، قابل جمع‌شدن.

| فیلد        | یادداشت‌ها                                                            |
| ------------ | ---------------------------------------------------------------- |
| Provider     | Dropdown با نشانگر وضعیت (پیکربندی‌شده / مفقود / rate limited) |
| Type         | `web` یا `news` (فقط جستجو)                                    |
| Full page    | Toggle برای scrape — کل صفحه در برابر اولین محتوای قابل مشاهده را fetch می‌کند                      |
| Format       | `markdown`, `text`, یا `html` (فقط scrape)                      |
| Rerank model | مدل اختیاری برای rerank پس از جستجو                         |
| History      | بخش قابل جمع‌شدن تاریخچه جستجو                               |

---

## SearchConceptCard

`SearchConceptCard.tsx` — همیشه قابل مشاهده، آکاردئون قابل جمع‌شدن. توضیح می‌دهد:

| مفهوم             | یک‌خطی                                                            |
| ------------------- | -------------------------------------------------------------------- |
| **جستجو**          | فهرستی از نتایج وب را fetch می‌کند (عنوان، URL، قطعه، امتیاز مرتبط بودن) |
| **Scrape**          | محتوای کامل یک URL را استخراج می‌کند (markdown، text یا HTML)          |
| **مقایسه**         | همان پرس‌وجو را در N ارائه‌دهنده کنار هم اجرا می‌کند                      |
| **Rerank**          | نتایج را از طریق LLM مرتب‌سازی مجدد می‌کند تا مرتبط بودن پرس‌وجو بهبود یابد                  |
| **Auto (ارزان‌ترین)** | ارزان‌ترین ارائه‌دهنده در دسترس را به‌صورت خودکار انتخاب می‌کند                  |

---

## فهرست ارائه‌دهندگان

`ProviderCatalog.tsx` فهرست کامل ارائه‌دهندگان را از `GET /api/search/providers`
(در F4 گسترش یافته تا شامل ارائه‌دهندگان fetch شود) نمایش می‌دهد:

| فیلد                          | منبع                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `id`, `name`                   | `searchRegistry.ts`                                                                        |
| `kind`                         | `"search"` (۱۲ ارائه‌دهنده) یا `"fetch"` (firecrawl, jina-reader, tavily-search, tinyfish)   |
| `costPerQuery`                 | داده رجیستری                                                                              |
| `freeMonthlyQuota`             | داده رجیستری                                                                              |
| `searchTypes` / `fetchFormats` | داده رجیستری                                                                              |
| `status`                       | `"configured"` / `"missing"` / `"rate_limited"` — در زمان اجرا از credential store مشتق می‌شود |
| `configureHref`                | `/dashboard/providers`                                                                     |

وضعیت **در زمان درخواست** با بررسی اینکه آیا اعتبارنامه‌ها موجود هستند و اینکه آیا
همه کلیدها در حال حاضر در cooldown هستند مشتق می‌شود.

---

## خروجی گرفتن کد

`ExportCodeModal` (وارد‌شده از Playground Studio) + `codeExport.ts` snippetهای
curl / Python / TypeScript را هم برای فراخوانی‌های `/v1/search` و هم `/v1/web/fetch` تولید می‌کنند.
placeholder کلید API همیشه `$OMNIROUTE_API_KEY` است (D11، مشترک با Playground Studio).

---

## تغییرات backend

فقط یک تغییر backend برای این قابلیت لازم بود:

### گسترش `GET /api/search/providers`

`src/app/api/search/providers/route.ts` گسترش یافت تا:

- شامل تمام ۴ ارائه‌دهنده fetch (`firecrawl`, `jina-reader`, `tavily-search`, `tinyfish`) در آرایه شود.
- `kind: "search" | "fetch"` به هر آیتم اضافه شود.
- `status: "configured" | "missing" | "rate_limited"` مشتق از وضعیت زنده اعتبارنامه اضافه شود.
- سازگاری با نسخه‌های قبلی حفظ شود — فیلدهای موجود (`id`, `name` و غیره) بدون تغییر باقی می‌مانند.

---

## فایل‌های کلیدی

| مسیر                                                                              | هدف                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/app/(dashboard)/dashboard/search-tools/SearchToolsClient.tsx`                | shell استودیو، هماهنگ‌کننده تب                    |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchToolsTopBar.tsx`     | تب‌ها + متریک‌ها + دکمه خروجی                    |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchToolsConfigPane.tsx` | پنل پیکربندی مشترک                               |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchConceptCard.tsx`     | کارت‌های توضیحی (همیشه قابل مشاهده)                  |
| `src/app/(dashboard)/dashboard/search-tools/components/ProviderCatalog.tsx`       | فهرست ارائه‌دهنده با فراداده                       |
| `src/app/(dashboard)/dashboard/search-tools/components/ScrapeResult.tsx`          | پیش‌نمای markdown + toggle خام                     |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/SearchTab.tsx`        | تب جستجو + rerank                               |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/ScrapeTab.tsx`        | تب scrape                                        |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/CompareTab.tsx`       | تب مقایسه چندارائه‌دهنده                        |
| `src/app/(dashboard)/dashboard/search-tools/hooks/useScrapeFetch.ts`              | hook مربوط به fetch scrape                                 |
| `src/app/api/search/providers/route.ts`                                           | گسترش‌یافته با `kind` + `status` + ارائه‌دهندگان fetch |
| `open-sse/config/searchRegistry.ts`                                               | منبع حقیقت برای فراداده ارائه‌دهنده جستجو      |

---

## عیب‌یابی

| نشانه                                   | علت                      | راه‌حل                                                                             |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| تب scrape "endpoint not available" را نشان می‌دهد | `/v1/web/fetch` متصل نشده  | تأیید کنید که برنامه ۰۵ ادغام شده است؛ بررسی `src/app/api/v1/web/fetch/route.ts` که موجود باشد      |
| فهرست ارائه‌دهنده همه را به‌عنوان "missing" نشان می‌دهد   | اعتبارنامه‌ها پیکربندی نشده‌اند | اعتبارنامه‌ها را در `/dashboard/providers` اضافه کنید                                       |
| محتوای scrape بریده می‌شود               | پاسخ > محدودیت ۲۵۶ کیلوبایت      | رفتار مورد انتظار (D21). از دکمه "view raw" برای محتوای کامل استفاده کنید                 |
| تب مقایسه فقط ۲ ارائه‌دهنده نشان می‌دهد        | محدودیت rate فعال است          | ممکن است دو یا چند ارائه‌دهنده در cooldown باشند — وضعیت ارائه‌دهنده را در پنل Config بررسی کنید |
| "Size" به‌عنوان کلید خام در جدول نشان داده می‌شود          | کلید i18n مفقود است           | تأیید کنید که `search.size` در فایل locale موجود باشد؛ i18n را بازسازی کنید                    |

---

## مراجع

- برنامه اصلی: `_tasks/features-v3.8.6/refactorpages/_orchestration/master-plan-group-C.md`
- برنامه قابلیت: `_tasks/features-v3.8.6/refactorpages/18-search-tools-studio-redesign.plan.md`
- رجیستری ارائه‌دهنده جستجو: `open-sse/config/searchRegistry.ts`
- Playground Studio (`ExportCodeModal` مشترک + `codeExport.ts`): `docs/frameworks/PLAYGROUND_STUDIO.md`
- backend مربوط به fetch وب: `src/app/api/v1/web/fetch/route.ts`
