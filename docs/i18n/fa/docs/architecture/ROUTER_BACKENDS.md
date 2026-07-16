---
title: "Backend‌های مسیریاب و سرویس‌های تعبیه‌شده (ADR)"
version: 3.8.43
lastUpdated: 2026-07-02
---

# Backend‌های مسیریاب و سرویس‌های تعبیه‌شده — قرارداد معماری (ADR)

> **وضعیت:** پذیرفته‌شده · **زمینه:** [#5670](https://github.com/borhandarabi/routechi/issues/5670)،
> [#5603](https://github.com/borhandarabi/routechi/issues/5603) · **قرارداد:** `domain/routing/routerBackends.ts`
> (رجیستری تایپ‌شده — کد با [#5868](https://github.com/borhandarabi/routechi/pull/5868) ادغام می‌شود)

این ADR مشخص می‌کند که `ts` (بومی)، `bifrost`، `cliproxy`، `9router` و موتورهای سازگار با VibeProxy چگونه به هم مربوط می‌شوند، تا مشارکت‌کنندگان از ترکیب دو چیز معماری‌ا متمایز دست بردارند. این سند رجیستری تایپ‌شده را که توسط کار router-backend-registry معرفی شده است، به‌عنوان منبع واحد حقیقت برای آن مدل مستند می‌کند.

## تمایز اصلی — دو محور متعامد

نقش یک موتور با **دو محور مستقل** توصیف می‌شود که با هم در `RouterBackendDefinition` رجیستری کدگذاری شده‌اند:

1. **چرخه حیات** (`RouterBackendLifecycle`) — _موتور چگونه اجرا می‌شود_:
   - `in-process` — درون فرآیند Node OmniRoute اجرا می‌شود (خط لوله TS بومی).
   - `supervised` — یک فرآیند فرزند محلی که OmniRoute از طریق `ServiceSupervisor` نصب/راه‌اندازی/توقف/بررسی سلامت می‌کند، سپس به‌عنوان اتصال provider مصرف می‌کند.
   - `external` — یک endpoint HTTP که OmniRoute به آن ارسال می‌کند اما مدیریت **نمی‌کند** (با یک URL پایه env پیکربندی می‌شود).
   - `disabled` — ثبت‌شده اما قابل انتخاب نیست.
2. **محور انتخاب** (backend مسیریابی relay) — _آیا relay به آن ارسال می‌کند_:
   `RelayRoutingBackend = "ts" | "bifrost" | "auto"` در
   `src/app/api/v1/relay/chat/completions/routingBackend.ts`.

اشتباهی که باید از آن اجتناب کنید: در نظر گرفتن «سرویس تعبیه‌شده» و «backend مسیریابی» به‌عنوان یک لیست. این‌طور نیست. یک موتور `supervised` (9router/cliproxy) یک **اتصال provider مصرف‌شده توسط خط لوله بومی** است، نه یک backend ارسال relay جایگزین. `bifrost` برعکس است — یک backend ارسال relay که (از نظر تاریخی) فقط `external` بود.

## رجیستری — منبع واحد حقیقت

قرارداد `domain/routing/routerBackends.ts` (کد با [#5868](https://github.com/borhandarabi/routechi/pull/5868) ادغام می‌شود) هر موتور را یک‌بار با چرخه حیات، قابلیت‌ها، هویت سرویس، پورت پیش‌فرض، پیکربندی سلامت و پشتیبانی تلمتری اعلان می‌کند. مصرف‌کنندگان موتورها را از طریق `getRouterBackend(id)`، `listRouterBackends()` و `listRouterBackendsByCapability(cap)` جستجو می‌کنند به جای case-by-case هر sidecar.

| Backend     | چرخه حیات    | سرویس (محور A) | Backend relay (محور B) | سلامت         | پورت پیش‌فرض |
| ----------- | ------------ | -------------- | ---------------------- | ------------- | ------------ |
| `ts`        | `in-process` | —              | `ts` (بومی)            | —             | —            |
| `bifrost`   | `external`¹  | —¹             | `bifrost` / `auto`     | `/health`     | —            |
| `cliproxy`  | `supervised` | `cliproxy`     | — (provider)           | `/v1/models`  | 8317         |
| `9router`   | `supervised` | `9router`      | — (provider)           | `/api/health` | 20130        |
| `vibeproxy` | `external`   | —              | — (آداپتور provider)   | `/v1/models`  | —            |

¹ ارتقای Bifrost به یک سرویس تعبیه‌شده `supervised` (قابل‌نصب/راه‌اندازی از `/api/services/bifrost/`) در
[#5817](https://github.com/borhandarabi/routechi/pull/5817) پیگیری می‌شود؛ تا زمان ادغام،
Bifrost فقط `external` است (فقط از طریق `BIFROST_BASE_URL` قابل دسترس).

`capabilities` (`chat`, `responses`, `streaming`, `tools`, `vision`,
`oauth-backed`, `dashboard-embed`, `model-sync`, `native-hot-path`) به فراخوانی‌ها اجازه می‌دهند بر اساس آنچه یک موتور واقعاً می‌تواند انجام دهد فیلتر کنند، به جای شاخه‌بندی کدگذاری‌شده به‌ازای-id.

## محور A — سرویس‌های تعبیه‌شده (سمت فرآیند supervised)

- **رجیستری فرآیندهای supervised:** `src/lib/services/bootstrap.ts` `SERVICES[]`
  (امروز: `9router`, `cliproxy`).
- **مالک چرخه حیات:** `src/lib/services/ServiceSupervisor.ts` — `start()` فرآیند فرزند را spawn می‌کند، با `waitForHealthy()` دروازه می‌سازد، stdout/stderr را به یک ring buffer ضبط می‌کند؛
  `stop()` از SIGTERM→SIGKILL استفاده می‌کند؛ همه زیر یک قفل serialized شده‌اند.
- **اتحاد حالت** (`src/lib/services/types.ts`):
  `not_installed | stopped | starting | running | stopping | error`، به اضافه یک
  `HealthState = healthy | unhealthy | unknown` متعامد.
- **چرا فرآیند جداگانه (نه SDK درون-فرآیندی)؟** ایزوله‌کردن فرآیند چیزی است که نصب/راه‌اندازی/توقف/سلامت/گزارش‌ها را مستقل به‌ازای sidecar قابل کنترل می‌کند و به spawn-guard loopback اجازه اعمال می‌دهد. مدل‌سازی یک آداپتور درون-فرآیندی کار آینده است — پرچم قابلیت `native-hot-path` جایی است که آن بیان می‌شود.

### قرارداد مسیر چرخه حیات (`/api/services/<tool>/…`)

کدهای وضعیت **به‌طرز طراحی‌ای state/verb/path-specific هستند** — این قرارداد است، نه ناسازگاری:

| فراخوانی                       | شرط                              | وضعیت                                  |
| ------------------------------ | -------------------------------- | -------------------------------------- |
| `POST .../start`               | سرویس `not_installed`            | **409** (precondition)                 |
| `POST .../stop`                | از قبل متوقف‌شده                 | **200** (no-op idempotent)             |
| `GET .../status`               | OK                               | **200** (`live ?? row ?? "unknown"`)   |
| `POST .../start`               | شکست spawn                       | **503** (گذارا)                        |
| `GET .../status`, `.../stop`   | خطای non-caught                  | **500**                                |
| `GET /api/services/<x>/logs`   | ابزار ناشناخته `<x>`             | **404** `Service '<x>' not found`      |
| `GET .../status?reveal=key`    | فقدان `X-Reveal-Confirm: yes`    | **403** (فقط 9router)                  |
| **هرکدام** `/api/services/*`   | فراخوان non-loopback/private-LAN | **403 LOCAL_ONLY**                     |

همه بدنه‌های خطا توسط `createErrorResponse()` →
`{ error: { message, type }, requestId }` شکل می‌گیرند، که در آن `type` از وضعیت مشتق می‌شود
(`500→server_error`، `404→not_found`، `409→conflict`، وگرنه `invalid_request`) و
تشخیص‌دهنده machine-actionable است. پیام‌ها از قبل sanitize شده‌اند
(`sanitizeErrorMessage()`، Hard Rule #12).

**محافظ loopback** رایج‌ترین منبع یک `403` است: `/api/services/` در
`LOCAL_ONLY_API_PREFIXES` (`src/server/authz/routeGuard.ts`) است و
`src/server/authz/policies/management.ts` هر فراخوان non-loopback / non-private-LAN را **قبل از auth** رد می‌کند،
زیرا این مسیرها فرآیندهای فرزند spawn می‌کنند (Hard Rules 15
و 17). رسیدن به آن‌ها از طریق تانل عمومی به‌طرز طراحی `403` است.

## محور B — backend مسیریابی relay (سمت ارسال)

فقط مسیر پروکسی relay `/api/v1/relay/chat/completions` یک backend ارسال انتخاب می‌کند؛ سطح `/api/v1/chat/completions` اصلی هرگز `routingBackend.ts` را مشورت نمی‌کند.

- **انتخاب** (`resolveRelayRoutingBackend`): یک سوئیچ محیطی سراسری —
  `OMNIROUTE_RELAY_BACKEND` / `RELAY_ROUTING_BACKEND` ∈ {`ts`, `bifrost`, `auto`}.
  اگر تنظیم نشده باشد، `auto` وقتی Bifrost پیکربندی‌شده+فعال باشد، در غیر این صورت `ts`.
- **رفتار:**
  - `bifrost` (اجباری): شکست Bifrost ← `502` سخت، بدون fallback.
  - `auto`: تلاش Bifrost، در صورت شکست/cooldown به‌صورت بی‌صدا به بومی عبور می‌کند.
  - `ts` / post-fallback: خط لوله بومی `open-sse` translator/executor.
- **Cooldown:** cooldown شکست به‌ازای-`baseUrl` در `bifrostCooldown.ts`.

انتخاب **امروز در سطح relay all-or-nothing است** — هیچ تعویض موتور به‌ازای-provider یا به‌ازای-درخواست روی `release/v3.8.43` وجود ندارد. دروازه به‌ازای-درخواست توسط کار sidecar-manifest در حال افزودن است
([#5869](https://github.com/borhandarabi/routechi/pull/5869) manifest +
[#5870](https://github.com/borhandarabi/routechi/pull/5870) `shouldTryBifrostForRequest`)،
که به `auto` اجازه می‌دهد فقط provider‌های manifest-eligible را از طریق Bifrost مسیریابی کند.

## ادغام داشبورد

داشبورد سرویس‌ها هر ۵ ثانیه `GET /api/services/<tool>/status` را از طریق
`src/app/(dashboard)/dashboard/providers/services/hooks/useServiceStatus.ts` نظرسنجی می‌کند،
که `{ tool, state, pid, port, health, installedVersion, latestVersion,
updateAvailable, autoStart, … }` را برمی‌گرداند. هیچ provider context در دسترس‌پذیری مشترک وجود ندارد —
هر مؤلفه hook را به‌ازای tool فراخوانی می‌کند. هنگام `!res.ok` hook در حال حاضر یک
`HTTP <status>` ساده را نمایش می‌دهد؛ نگاشت فیلد `error.type` به یک توضیح انسانی،
یک بهبود UX پیگیری‌شده است، نه تغییر قرارداد.

## پیامدها

- موتورهای جدید یک‌بار در `ROUTER_BACKENDS` ثبت می‌شوند؛ مصرف‌کنندگان از طریق query قابلیت
  به آن‌ها دست می‌یابند بدون شاخه‌های جدید به‌ازای-id.
- «این یک سرویس است یا یک backend مسیریابی؟» با فیلد `lifecycle` پاسخ داده می‌شود، نه
  با اینکه یک id در کدام لیست اتفاقاً ظاهر می‌شود.
- نظارت بر Bifrost (#5817) و مهاجرت native hot-path (#5670) روی این
  قرارداد مشترک بنا می‌شوند به جای case-by-case هر sidecar.
