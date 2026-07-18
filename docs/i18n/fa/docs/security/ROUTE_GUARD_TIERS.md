---
title: "Route Guard Tiers"
---

# لایه‌های حفاظت مسیر

## مرور کلی

همه مسیرهای API مدیریت RouteChi در یکی از سه لایه حفاظت طبقه‌بندی می‌شوند. طبقه‌بندی ایستا است، در `src/server/authz/routeGuard.ts` تعریف شده، و پیش از اجرای هر شاخه احراز هویت دیگری ارزیابی می‌شود.

## لایه‌ها

### لایه ۱ — LOCAL_ONLY

**اعمال‌شده توسط:** `isLocalOnlyPath(path)` → بررسی میزبان loopback
**دور زدن:** به‌طور پیش‌فرض هیچ‌کدام. carve-out محدود برای مسیرهای موجود در
`LOCAL_ONLY_MANAGE_SCOPE_BYPASS_PREFIXES` وقتی درخواست یک کلید API معتبر
با scope `manage` حمل می‌کند (به [Carve-out با scope manage](#manage-scope-carve-out) مراجعه کنید).

این مسیرها فرآیندهای فرزند spawn می‌کنند یا کد زمان اجرا را اجرا می‌کنند. افشای آن‌ها به
ترافیک غیر loopback به مهاجمی که یک JWT معتبر کسب کرده (مثلاً
از طریق یک تونل Cloudflared/Ngrok) اجازه می‌دهد فرآیند spawning را تحریک کند — یک کلاس CVE
شناخته‌شده ([GHSA-fhh6-4qxv-rpqj](https://github.com/advisories/GHSA-fhh6-4qxv-rpqj)).

**GHSA-fhh6-4qxv-rpqj چیست (کلاس حمله):** یک سرور management/agent
یک اندپوینت را افشا می‌کند که یک subprocess (`npm install`, `node`، یک مرورگر،
یک پراکسی، `git`, `tar` و …) راه‌اندازی می‌کند. اگر آن اندپوینت از خارج از میزبان قابل دسترس باشد — چون
اپراتور RouteChi را پشت یک تونل nginx/Cloudflare/Tailscale قرار داده و یک JWT
نشسته، یا احراز هویت اشتباه پیکربندی شده — مهاجم «فراخوانی یک API» را به «اجرای یک
فرمان روی میزبان» (اجرای کد از راه دور) تبدیل می‌کند. RouteChi این را با اعمال یک
**بررسی میزبان loopback به‌طور غیرشرطی، پیش از هر بررسی احراز هویت**، روی هر
مسیر دارای قابلیت spawn می‌بندد: یک توکن نشت‌شده روی یک تونل همچنان نمی‌تواند به spawn برسد.

**مجموعه LOCAL_ONLY کامل.** منبع معتبر
`LOCAL_ONLY_API_PREFIXES` / `LOCAL_ONLY_API_PATTERNS` در
`src/server/authz/routeGuard.ts` است؛ جدول زیر وضعیت کنونی را منعکس می‌کند. گیت
`check-route-guard-membership` هر `route.ts` را تحت پیشوندهای
دارای قابلیت spawn برمی‌شمارد و اگر هر کدام local-only طبقه‌بندی نشده باشند CI را شکست می‌دهد.

| پیشوند / الگو                       | چرا فقط‌محلی                                                                | قابل دور زدن با scope manage?  |
| ----------------------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| `/api/mcp/`                         | سرور MCP — پل‌های stdio + هندلرهای SSE را spawn می‌کند                       | **بله** (فقط یکی)              |
| `/api/cli-tools/runtime/`           | زمان اجرای ابزار CLI — کد افزونه دلخواه را اجرا می‌کند                       | نه — دارای قابلیت spawn        |
| `/api/services/`                    | سرویس‌های embed‌شده (9router/CLIProxy) — `npm install` + spawn               | نه — دارای قابلیت spawn        |
| `/dashboard/providers/services/`    | پراکسی معکوس به UIهای سرویس embed‌شده                                       | نه                             |
| `/api/copilot/`                     | درایور LLM بدون احراز هویت — به‌طور پیش‌فرض فقط CLI                            | opt-in اپراتور: manage/admin   |
| `/api/tools/agent-bridge/`          | AgentBridge — سرور MITM + ویرایش‌های DNS را spawn می‌کند                     | نه — دارای قابلیت spawn        |
| `/api/tools/traffic-inspector/`     | Traffic Inspector — شنونده http-proxy + system proxy                        | نه — دارای قابلیت spawn        |
| `/api/plugins/`, `/api/plugins`     | افزونه‌ها — بارگذاری/اجرا از طریق `worker_threads` + `child_process`        | نه — دارای قابلیت spawn        |
| `/api/system/version`               | به‌روزرسانی خودکار (فقط POST؛ GET/HEAD/OPTIONS معاف) — `git checkout` + `npm install` را spawn می‌کند | نه                             |
| `/api/db-backups/exportAll`         | `tar` را برای آرشیو خروجی spawn می‌کند                                       | نه                             |
| `/api/local/`                       | راه‌اندازهای محلی ۱-کلیکی (Redis امروز) — podman/docker را spawn می‌کند      | نه — دارای قابلیت spawn        |
| `/api/headroom/start`, `/stop`      | چرخه‌حیات پراکسی headroom — CLI پایتون را spawn می‌کند / PID را سیگنال می‌دهد | نه — دارای قابلیت spawn        |
| `/api/oauth/cursor/auto-import`     | `execFile("which", ["cursor"])` پیش از import اعتبار                         | نه                             |
| `/api/providers/{id}/login` (regex) | یک Chromium Playwright headful برای ورود با cookie وب راه‌اندازی می‌کند      | نه                             |

**پاسخ هنگام نقض:** `403 LOCAL_ONLY`

#### Carve-out با scope manage

یک زیرمجموعه از مسیرهای LOCAL_ONLY ممکن است از غیر loopback نیز قابل دسترس باشد اگر و
فقط اگر درخواست یک `Authorization: Bearer <api-key>` حمل کند که
متادیتای آن شامل scope `manage` (یا `admin`) باشد. carve-out به‌صورت صریح به‌ازای هر مسیر
از طریق `LOCAL_ONLY_MANAGE_SCOPE_BYPASS_PREFIXES` گیت می‌شود تا
پیش‌فرض هر مسیر LOCAL_ONLY جدید همچنان loopback-سخت‌گیرانه باشد. درخواست‌های بدون احراز هویت
و درخواست‌ها با کلیدهای غیر manage همچنان با
`403 LOCAL_ONLY` رد می‌شوند.

امروز تنها پیشوند قابل دور زدن `/api/mcp/` است. `/api/cli-tools/runtime/` و
`/api/services/` عمداً مستثنی شده‌اند چون می‌توانند subprocessهای دلخواه
(`npm install`, `node`) را spawn کنند، که دقیقاً کلاس CVE‌ای است که
لایه LOCAL_ONLY برای جلوگیری از آن وجود دارد.

| درخواست                                      | مسیر                       | نتیجه              |
| -------------------------------------------- | -------------------------- | ------------------ |
| غیر loopback، بدون Bearer                    | `/api/mcp/*`               | 403 LOCAL_ONLY     |
| غیر loopback، Bearer با scope `manage`       | `/api/mcp/*`               | اجازه              |
| غیر loopback، Bearer بدون scope `manage`     | `/api/mcp/*`               | 403 LOCAL_ONLY     |
| غیر loopback، Bearer با scope `manage`       | `/api/cli-tools/runtime/*` | 403 LOCAL_ONLY     |
| loopback، هر/بدون Bearer                     | هر LOCAL_ONLY              | اجازه (گیت عبور)   |

#### راهنمای اپراتور و ممیزی

اگر RouteChi را پشت یک پراکسی معکوس یا تونل (nginx, Caddy, Cloudflare
Tunnel, Tailscale, Ngrok) اجرا می‌کنید، بررسی loopback همچنان از مسیرهای دارای قابلیت spawn بالا محافظت می‌کند — یک درخواست که آدرس کلاینت آن غیر loopback است با
`403 LOCAL_ONLY` **پیش از اجرای احراز هویت** رد می‌شود، پس یک JWT نشت‌شده نمی‌تواند به spawn برسد. دو مسئولیت اپراتور باقی می‌ماند:

- **یک 403 را با جعل IP کلاینت به‌عنوان loopback «تعمیر» نکنید.** تنظیم
  `X-Forwarded-For: 127.0.0.1`، یا یک پراکسی که آدرس مبدأ را به
  loopback بازنویسی می‌کند، دقیقاً کلاس RCE‌ای را که این لایه می‌بندد باز می‌کند. داشبورد/API را از طریق پراکسی افشا کنید — نه مسیرهای دارای قابلیت spawn.
- **carve-out با scope manage را حداقل نگه دارید.** فقط `/api/mcp/` قابل دور زدن است، و
  فقط با یک کلید API با scope `manage`. `SPAWN_CAPABLE_PREFIXES` هرگز نمی‌توانند
  به فهرست bypass افزوده شوند — شِمای zod آن‌ها را رد می‌کند و
  `isLocalOnlyBypassableByManageScope` در زمان اجرا آن‌ها را رد می‌کند (دفاع در عمق)،
  که همان چیزی است که داشبورد با «نمی‌تواند قابل‌دورزدن شود» منظور دارد.

**ممیزی دسترسی** — برای تأیید اینکه هیچ چیز خارج از میزبان به این مسیرها نمی‌رسد:

- **Authorization Inventory** را روی `/dashboard/settings/security` باز کنید: فهرست پیشوند LOCAL_ONLY زنده، کدام پیشوندها قابل دور زدن هستند و مجموعه
  دارای قابلیت spawn زمان کامایل («نمی‌تواند قابل‌دورزدن شود») را رندر می‌کند.
- لاگ‌های پراکسی معکوس / دسترسی خود را برای پیشوندهای بالا همراه با یک
  آدرس کلاینت غیر loopback بگردید. هر hit такого که `200` به جای
  `403 LOCAL_ONLY` برگرداند یعنی پراکسی IP کلاینت واقعی را ماسک می‌کند — پراکسی را تعمیر کنید.
- یک `403 LOCAL_ONLY` در لاگ‌های RouteChi برای یکی از این مسیرها، گیت است که
  مطابق طراحی کار می‌کند، نه خطایی برای سرکوب.

### لایه ۲ — ALWAYS_PROTECTED

**اعمال‌شده توسط:** `isAlwaysProtectedPath(path)` → skip دور زدن `requireLogin=false`
**دور زدن:** هیچ‌کدام وقتی `requireLogin=false`؛ همیشه JWT لازم است

این مسیرها مخرب یا غیرقابل‌برگشت هستند. اجازه آن‌ها در یک نصب «بدون گذرواژه»
یعنی هر کسی روی همان LAN می‌تواند پایگاه‌داده را پاک کند یا فرآیند
سرور را بکشد.

| مسیر                     | دلیل                            |
| ------------------------ | -------------------------------- |
| `/api/shutdown`          | فرآیند سرور را خاتمه می‌دهد       |
| `/api/settings/database` | خروجی، import و wipe پایگاه‌داده |

**پاسخ هنگام نقض:** `401 Authentication required`

### لایه ۳ — MANAGEMENT (پیش‌فرض)

همه مسیرهای مدیریتی دیگر. احراز هویت لازم مگر اینکه `requireLogin=false`
پیکربندی شده باشد. توکن‌های CLI می‌توانند این مسیرها را احراز هویت کنند (loopback + HMAC معتبر).

## ترتیب ارزیابی

```
managementPolicy.evaluate(ctx)
  1. isLocalOnlyPath(path)?
     → loopback                                  → fall through
     → non-loopback, manage-scope Bearer
        AND isLocalOnlyBypassableByManageScope   → allow (management_key)
     → otherwise                                  → reject 403 LOCAL_ONLY
  2. isInternalModelSyncRequest(ctx)?
     → allow (system)
  3. hasValidCliToken(headers)?
     → allow (cli) [loopback + timingSafeEqual HMAC check]
  4. isAlwaysProtectedPath(path) or requireLogin=true?
     → isDashboardSessionAuthenticated?
        → allow (dashboard_session)
     → manage-scope Bearer on a non-bypassable path?
        → allow (management_key)
     → reject 401/403
  5. requireLogin=false?
     → allow (anonymous)
```

شاخه scope manage در گام ۱ تنها مسیر احراز هویت‌شده‌ای است که می‌تواند یک
مسیر LOCAL_ONLY را برآورده کند؛ حالت شکست auth-backend 503 (نه 403) برمی‌گرداند تا یک
DB منقضی به‌صورت خاموش به «deny» تنزل نیابد.

## افزودن یک مسیر جدید دارای قابلیت spawn

1. پیشوند مسیر را به `LOCAL_ONLY_API_PREFIXES` در
   `src/server/authz/routeGuard.ts` بیفزایید
2. یک آزمون در `tests/unit/authz/routeGuard.test.ts` بیفزایید که ادعا می‌کند
   `isLocalOnlyPath()` برای پیشوند جدید true برمی‌گرداند
3. **هرگز این گام را رد نکنید** — به Hard Rule #15 در `CLAUDE.md` مراجعه کنید
4. تصمیم بگیرید: آیا این مسیر همچنین در `LOCAL_ONLY_MANAGE_SCOPE_BYPASS_PREFIXES` قرار می‌گیرد؟
   پاسخ پیش‌فرض **نه** است. فقط opt-in کنید وقتی مسیر برای افشا به یک
   دارنده scope manage امن است (یعنی کد کنترل‌شده توسط کاربر دلخواه spawn نمی‌کند).

## افزودن یک مسیر قابل‌دورزدن با scope manage

1. تأیید کنید مسیر کد یا فرمان تأمین‌شده توسط کاربر را اجرا نمی‌کند. اگر
   می‌کند، متوقف شوید — این carve-out ابزار اشتباهی است.
2. پیشوند را به `LOCAL_ONLY_MANAGE_SCOPE_BYPASS_PREFIXES` در
   `src/server/authz/routeGuard.ts` اضافه کنید
3. پوشش در `tests/unit/authz/management-policy.test.ts` برای هر چهار
   شکل درخواست بیفزایید: بدون Bearer (403)، manage Bearer (اجازه)، Bearer غیر manage
   (403)، و رگرسیون به‌ازای هر پیشوند که `/api/cli-tools/runtime/*` حتی با یک manage Bearer همچنان
   loopback-سخت‌گیرانه می‌ماند.

## فایل‌ها

| فایل                                         | هدف                            |
| -------------------------------------------- | ------------------------------ |
| `src/server/authz/routeGuard.ts`             | ثابت‌ها و توابع کمک‌کننده       |
| `src/server/authz/policies/management.ts`    | منطق ارزیابی                   |
| `tests/unit/authz/routeGuard.test.ts`        | آزمون‌های واحد برای کمک‌کننده‌های لایه |
| `tests/unit/authz/management-policy.test.ts` | آزمون‌های واحد برای evaluate()  |

## مستندسازی لایه‌های امنیتی در OpenAPI

هنگام افزودن یک مسیر جدید به `docs/openapi.yaml`، اگر مسیر توسط `routeGuard.ts` طبقه‌بندی شده است، توسعه‌دهنده متناظر را اعمال کنید:

| طبقه‌بندی routeGuard.ts       | یادداشت YAML               | اعمال                                                       |
| ----------------------------- | -------------------------- | ----------------------------------------------------------- |
| `LOCAL_ONLY_API_PREFIXES`     | `x-loopback-only: true`    | به‌طور غیرشرطی از غیر loopback مسدود                        |
| `ALWAYS_PROTECTED_API_PATHS`  | `x-always-protected: true` | احراز هویت حتی با `requireLogin=false` لازم                 |
| مسیر admin/debug داخلی        | `x-internal: true`         | به‌طور پیش‌فرض از /dashboard/api-endpoints پنهان             |
| هیچ (دسترسی عمومی / احراز هویت استاندارد) | (هیچ یادداشت لازم نیست)    | دسترسی استاندارد کنترل‌شده با `requireLogin`                |

### اعتبارسنجی

دو اسکریپت سازگاری بین یادداشت‌های YAML و `routeGuard.ts` را اعمال می‌کنند:

- `scripts/check/check-openapi-coverage.mjs` — اگر پوشش < ۹۹٪ باشد شکست می‌خورد
- `scripts/check/check-openapi-security-tiers.mjs` — اگر یادداشت‌های `x-loopback-only` یا
  `x-always-protected` با ثابت‌های زمان کامایل واگرا باشند شکست می‌خورد

هر دو اسکریپت در hook پیش‌commit و در CI اجرا می‌شوند.

### قاعده مثبت کاذب

اگر `x-always-protected` یا `x-loopback-only` روی یک مسیر که در
ثابت `routeGuard.ts` **نیست**، یادداشت شود، اسکریپت پوشش شکست می‌خورد. تعمیر همیشه هم‌راستا‌کردن
YAML با آنچه `routeGuard.ts` واقعاً اعمال می‌کند است — نه افزودن مسیرها به `routeGuard.ts`
بدون پیاده‌سازی منطق اعمال.

---

## همچنین ببینید

- `docs/security/CLI_TOKEN.md` — توکن machine-ID مربوط به CLI
- `docs/architecture/AUTHZ_GUIDE.md` — خط لوله کامل احراز هویت
- `docs/frameworks/MCP-SERVER.md` — انتقال‌ها و scopeهای سرور MCP
