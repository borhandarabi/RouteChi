---
title: "راهنمای احراز دسترسی"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای احراز دسترسی

> **منبع حقیقت:** `src/server/authz/`، `src/shared/constants/publicApiRoutes.ts`، `src/lib/api/requireManagementAuth.ts`، `src/shared/utils/apiAuth.ts`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

RouteChi یک خط لوله احراز دسترسی آگاه-از-مسیر دارد که هر درخواست API را دروازه‌بندی می‌کند. طبقه‌بندی **قطعی** و **fail-closed** است — هر چیزی که قابل طبقه‌بندی نباشد در `MANAGEMENT` قرار می‌گیرد و نیازمند نشست یا token سطح management است. این صفحه مدل را برای مهندسانی که مسیرها را نگهداری یا endpoint‌های جدید طراحی می‌کنند توضیح می‌دهد.

![خط لوله AuthZ (۳ کلاس مسیر + ارزیابی سیاست)](../diagrams/exported/authz-pipeline.svg)

> منبع: [diagrams/authz-pipeline.mmd](../diagrams/authz-pipeline.mmd)

## دو حالت احراز هویت

### ۱. API Key (Bearer)

برای API‌های کلاینت سازگار با OpenAI/Anthropic/Gemini و چند مسیر management وقتی کلید دارای scope `manage` است استفاده می‌شود.

```
Authorization: Bearer <api-key>
```

توسط `isValidApiKey()` / `extractApiKey()` در `src/sse/services/auth.ts` اعتبارسنجی و از طریق `src/shared/utils/apiAuth.ts` دوباره صادر می‌شود. اعتبارسنج همچنین متغیرهای محیطی `OMNIROUTE_API_KEY` / `ROUTER_API_KEY` را به‌عنوان کلیدهای passthrough پایا می‌پذیرد (issue #1350).

### ۲. نشست داشبورد (cookie auth_token)

برای صفحات داشبورد و عملیات‌های مدیریت.

```
Cookie: auth_token=<JWT signed with JWT_SECRET>
```

توسط `isDashboardSessionAuthenticated()` در `src/shared/utils/apiAuth.ts` اعتبارسنجی می‌شود. خط لوله JWT را وقتی کمتر از ۷ روز از عمر ۳۰-روزه آن باقی مانده باشد، به‌طور خودکار به‌روزرسانی می‌کند.

برخی مسیرهای management **هر دو** حالت را می‌پذیرند: cookie یا `Bearer <key>` وقتی API key دارای scope `manage` (یا `admin`) است. این چیزی است که جریان کاری «قابل پیکربندی از طریق فراخوانی‌های API» را در v3.8 ممکن می‌سازد.

## کلاس‌های مسیر

`src/server/authz/types.ts` سه کلاس تعریف می‌کند؛ هر مسیری که قابل طبقه‌بندی قطعی نباشد به `MANAGEMENT` بازمی‌گردد.

| کلاس         | توضیح                                                                                                                                                | احراز هویت مورد نیاز                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `PUBLIC`     | مسیرهای صراحتاً امن — login، logout، status، init، health، onboarding bootstrap.                                                                     | هیچ                                                                    |
| `CLIENT_API` | endpoint‌های سرویس‌دهی مدل — `/api/v1/*`، `/api/v1beta/*`، به اضافه alias‌های `/v1/*`، `/v1beta/*`، `/chat/completions`، `/responses`، `/models`، `/codex/*`. | کلید Bearer وقتی feature flag مؤثر `REQUIRE_API_KEY` فعال است          |
| `MANAGEMENT` | صفحات داشبورد، تنظیمات، provider‌ها، کلیدها، endpoint‌های مدیریت و تشخیص.                                                                              | نشست داشبورد یا Bearer با scope `manage`                               |

## خط لوله

```
درخواست ورودی → src/proxy.ts
  → runAuthzPipeline() در src/server/authz/pipeline.ts
    1. حذف هدرهای داخلی قابل‌اعتماد (x-omniroute-auth-*، x-omniroute-route-class)
    2. تولید request id، طبقه‌بندی مسیر از طریق classifyRoute()
    3. اگر pathname == "/" → تغییر مسیر به /dashboard
    4. اگر draining (خاموشی نرم) و /api/* → 503
    5. اگر non-GET /api/* → حفاظ checkBodySize()
    6. اگر OPTIONS → CORS preflight 204
    7. اگر options.enforce == false → pass-through با هدرهای route-class
    8. در غیر این صورت: POLICIES[routeClass].evaluate(ctx)
       - allow  → stamp x-omniroute-auth-{kind,id,label,scopes} → NextResponse.next()
       - reject → خطای JSON با correlation_id (صفحات داشبورد ← 302 /login)
```

هدرهای داخلی قابل‌اعتماد (تعریف‌شده در `src/server/authz/headers.ts`) **قبل از طبقه‌بندی از درخواست‌های ورودی حذف می‌شوند** — کلاینت‌ها نمی‌توانند `x-omniroute-auth-*` را برای جعل یک subject مقداردهی اولیه کنند.

### قراردادهای سیاست

هر کلاس مسیر یک سیاست در `src/server/authz/policies/` دارد:

- **`publicPolicy`** (`policies/public.ts`) — همیشه `allow({ kind: "anonymous", id: "anonymous" })` برمی‌گرداند.
- **`clientApiPolicy`** (`policies/clientApi.ts`) — Bearer را استخراج می‌کند، از طریق `validateApiKey()` اعتبارسنجی می‌کند. فقط وقتی feature flag مؤثر `REQUIRE_API_KEY` غیرفعال است به anonymous عبور می‌کند. flag مؤثر از طریق `isRequireApiKeyEnabled()` حل می‌شود (override DB feature flag > process.env.REQUIRE_API_KEY > پیش‌فرض) تا Feature Flags داشبورد و متغیرهای محیطی به‌طور سازگار `/api/v1/*`، `/api/v1beta/*` و alias‌ها را کنترل کنند؛ شکست resolver به‌صورت fail-closed است. درخواست‌های نشست-داشبورد را در مسیرهای client API مجاز می‌داند (از جمله `/api/v1/models` که با کاتالوگ مدل داشبورد استفاده می‌شود).
- **`managementPolicy`** (`policies/management.ts`) — نشست داشبورد را می‌پذیرد، درخواست‌های model-sync داخلی (مطابقت‌داده‌شده با `/api/providers/[name]/(sync-models|models)`)، یا کلاً عبور می‌کند اگر `isAuthRequired()` false برگرداند. وقتی یک token Bearer حاضر اما نامعتبر باشد ۴۰۳ (`AUTH_001`)، در غیر این صورت ۴۰۱ برمی‌گرداند. همچنین سط route-guard (LOCAL_ONLY / ALWAYS_PROTECTED) را قبل از هر شاخه auth اعمال می‌کند — به [سطRoute Guard](../security/ROUTE_GUARD_TIERS.md) مراجعه کنید. مسیرهای LOCAL_ONLY در `LOCAL_ONLY_MANAGE_SCOPE_BYPASS_PREFIXES` (امروز: `/api/mcp/`) می‌توانند از non-loopback وقتی کلید Bearer دارای scope `manage` است دسترسی پیدا کنند؛ همه مسیرهای LOCAL_ONLY دیگر صرف‌نظر از scope به strict-loopback باقی می‌مانند.

یک سیاست موفق `AuthSubject` با `kind ∈ { client_api_key, dashboard_session, management_key, anonymous }` برمی‌گرداند. handler‌های پایین‌دست می‌توانند از طریق `assertAuth(request, "CLIENT_API")` در `src/server/authz/assertAuth.ts` آن را بخوانند به جای اجرای مجدد منطق auth.

## فهرست مسیرهای Public

`src/shared/constants/publicApiRoutes.ts` allowlist صریح است:

```ts
PUBLIC_API_ROUTE_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/status",
  "/api/init",
  "/api/v1/", // در classify به‌عنوان CLIENT_API رفتار می‌شود، نه به‌عنوان "no-auth public"
  "/api/cloud/",
  "/api/sync/bundle",
  "/api/oauth/",
];

PUBLIC_READONLY_API_ROUTE_PREFIXES = ["/api/monitoring/health", "/api/settings/require-login"];

PUBLIC_READONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
```

پیشوندهای read-only فقط برای متدهای امن public هستند. توجه: `classifyRoute()` `/api/v1/*` و `/api/v1beta/*` را از fall-through PUBLIC حذف می‌کند — این‌ها همیشه `CLIENT_API` هستند تا سیاست کلید-Bearer همچنان اعمال شود.

## افزودن یک مسیر جدید

### الگو ۱ — endpoint API کلاینت public (احراز هویت Bearer)

مسیرهای زیر `/api/v1/` و `/api/v1beta/` به‌طور خودکار `CLIENT_API` طبقه‌بندی می‌شوند. میان‌افزار بررسی Bearer را اعمال می‌کند؛ handler‌های مسیر نیازی به تکرار آن ندارند اما در صورت مفید بودن می‌توانند subject را بخوانند.

```typescript
// src/app/api/v1/your-route/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertAuth } from "@/server/authz/assertAuth";

export async function POST(req: NextRequest) {
  const subject = assertAuth(req, "CLIENT_API");
  // subject.kind === "client_api_key" | "anonymous" | "dashboard_session"
  // ... منطق handler
}
```

### الگو ۲ — endpoint مدیریت (نشست یا Bearer + manage)

از `requireManagementAuth()` در `src/lib/api/requireManagementAuth.ts` استفاده کنید:

```typescript
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function POST(request: Request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  // ... منطق handler
}
```

`requireManagementAuth()` در صورت موفقیت `null` یا یک `Response` خطای JSON برمی‌گرداند:

- 401 `AUTH_001` «احراز هویت مورد نیاز است» — هیچ credential‌ای اصلاً وجود ندارد
- 403 — Bearer نامعتبر **یا** Bearer حاضر اما کلید فاقد scope `manage` / `admin`

`hasManageScope(scopes)` برای `"manage"` یا `"admin"` true برمی‌گرداند.

### الگو ۳ — افزودن به allowlist public

پیشوند را به `PUBLIC_API_ROUTE_PREFIXES` (یا `PUBLIC_READONLY_API_ROUTE_PREFIXES` برای GET-only) اضافه کنید. آزمون‌های واحد در `tests/unit/public-api-routes.test.ts` و `tests/unit/authz/classify.test.ts` را به‌روزرسانی کنید.

## Scope‌ها

کلیدهای API یک آرایه `scopes` حمل می‌کنند (به‌صورت JSON در `api_keys.scopes` ذخیره می‌شوند، به `src/lib/db/apiKeys.ts` مراجعه کنید).

### scope مدیریت

- `manage` / `admin` — وقتی به‌عنوان Bearer ارسال می‌شود، به کلید دسترسی به endpoint‌های API مدیریت را می‌دهد.

### scope‌های MCP (`src/shared/constants/mcpScopes.ts`)

هر ابزار MCP از طریق `MCP_TOOL_SCOPES` به scope‌های خاصی نیاز دارد. فهرست کامل (`MCP_SCOPE_LIST`):

```
read:health, read:combos, write:combos, read:quota, read:usage,
read:models, execute:completions, execute:search, write:budget,
write:resilience, pricing:write, read:cache, write:cache,
read:compression, write:compression, read:proxies
```

اعمال scope در `open-sse/mcp-server/server.ts` فهرست scope هر ابزار را بعد از `resolveCallerScopeContext()` که scope‌ها را از MCP auth info، metadata درخواست، یا `OMNIROUTE_MCP_SCOPES` حل می‌کند، به `evaluateToolScopes()` می‌فرستد.

## سوئیچ احراز هویت مورد نیاز

`isAuthRequired()` در `src/shared/utils/apiAuth.ts` تصمیم می‌گیرد آیا **هر** احراز هویتی برای یک درخواست اعمال می‌شود:

- `settings.requireLogin === false` → احراز هویت به‌طور سراسری غیرفعال است.
- هیچ رمز عبوری پیکربندی نشده **و** هیچ متغیر محیطی `INITIAL_PASSWORD` → حالت bootstrap به wizard onboarding و درخواست‌های loopback اجازه می‌دهد، اما درخواست‌های شبکه exposed همچنان به credential نیاز دارند.
- هر خطای DB → به‌صورت fail-closed (secure-by-default).

اعمال کلید API کلاینت از `isRequireApiKeyEnabled()` در `src/shared/utils/featureFlags.ts` استفاده می‌کند، نه یک خواندن مستقیم `process.env.REQUIRE_API_KEY`. این برای نمونه‌های مستقر مهم است: تغییر `REQUIRE_API_KEY` در Feature Flags داشبورد یک override DB ذخیره می‌کند و بلافاصله روی `/v1/*`، `/v1beta/*`، `/models`، `/responses`، `/chat/completions`، `/codex/*` و سایر بررسی‌های auth client-API که این helper را به اشتراک می‌گذارند، اثر می‌گذارد. اگر store feature flag قابل خواندن نباشد، auth client API به‌صورت fail-closed است و نیازمند کلید است.

## تغییر شکستن — v3.8.0

endpoint‌های `/api/v1/agents/tasks/*` و `/api/resilience/model-cooldowns` **اکنون به auth مدیریت نیاز دارند** (commit `588a0333`). کلاینت‌هایی که قبلاً یک کلید API عادی بدون scope `manage` ارسال می‌کردند، `403` دریافت می‌کنند. مهاجرت: یا به کلید scope `manage` در داشبورد API Keys بدهید، یا از یک نشست داشبورد واردشده استفاده کنید.

## تغییر رفتار — v3.8.2

`/api/mcp/*` (سرور MCP remote) همچنان به‌صورت پیش‌فرض LOCAL_ONLY است اما اکنون درخواست‌های non-loopback را وقتی هدر `Authorization: Bearer <api-key>` دارای scope `manage` است می‌پذیرد. این استثنا به‌صراحت به‌ازای-مسیر از طریق `LOCAL_ONLY_MANAGE_SCOPE_BYPASS_PREFIXES` در `src/server/authz/routeGuard.ts` کنترل می‌شود؛ پیشوند LOCAL_ONLY هم‌خانواده `/api/cli-tools/runtime/*` عمداً قابل عبور نیست زیرا می‌تواند subprocess دل‌خواه spawn کند. درخواست‌های anonymous به `/api/mcp/*` از non-loopback به دریافت `403 LOCAL_ONLY` ادامه می‌دهند — پیش‌فرض برای هر مسیر LOCAL_ONLY جدید به strict-loopback باقی می‌ماند. به [سطRoute Guard](../security/ROUTE_GUARD_TIERS.md#manage-scope-carve-out) مراجعه کنید.

## آزمون

- آزمون‌های واحد: `tests/unit/authz/` — `classify.test.ts`، `pipeline.test.ts`، `client-api-policy.test.ts`، `management-policy.test.ts`، `public-policy.test.ts`.
- allowlist public: `tests/unit/public-api-routes.test.ts`.
- اجرای متمرکز: `node --import tsx/esm --test tests/unit/authz/classify.test.ts`.

## رفع اشکال

خط لوله همیشه پاسخ‌ها را با این هدرها مهر می‌زند:

```
x-request-id:               <correlation id، در بدنه‌های خطا echo می‌شود>
x-omniroute-route-class:    PUBLIC | CLIENT_API | MANAGEMENT
```

برای درخواست‌های احراز هویت‌شده، هدرهای درخواست upstream (سمت handler) همچنین شامل:

```
x-omniroute-auth-kind:      client_api_key | dashboard_session | management_key | anonymous
x-omniroute-auth-id:        key_<last-4> | "dashboard" | "anonymous"
x-omniroute-auth-label:     (اختیاری)
x-omniroute-auth-scopes:    فهرست جداشده با کاما
```

از `assertAuth(req, expectedClass)` درون handler‌ها استفاده کنید — اگر میان‌افزار دور زده شده باشد `AuthzAssertionError` با کد `AUTHZ_NOT_INITIALIZED` پرتاب می‌کند (برای گرفتن regression‌های پیکربندی در آزمون‌ها مفید است).

## مراجع دیگر

- [API_REFERENCE.md](../reference/API_REFERENCE.md) — نشانگر auth به‌ازای هر endpoint
- [COMPLIANCE.md](../security/COMPLIANCE.md) — گزارش ممیزی برای رویدادهای auth
- [MCP-SERVER.md](../frameworks/MCP-SERVER.md) — جزئیات اعمال scope MCP
- منبع: `src/server/authz/`، `src/lib/api/requireManagementAuth.ts`
