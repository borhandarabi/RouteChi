---
title: "سرویس‌های تعبیه‌شده"
description: "مرجع 9Router، CLIProxyAPI، Mux و Bifrost"
---

# سرویس‌های تعبیه‌شده

> **نسخه:** v3.8.44
> **آخرین به‌روزرسانی:** 2026-07-03
> **مخاطب:** مهندسانی که سرویس‌های تعبیه‌شده (9Router، CLIProxyAPI، Mux، Bifrost) را اضافه، نگهداری یا دیباگ می‌کنند.

سرویس‌های تعبیه‌شده ابزارهای sidecar فرآیند محلی نصب‌شده هستند که RouteChi نصب، نظارت و
به‌عنوان اهداف routing درجه‌یک در معرض قرار می‌دهد. برخلاف providerهای خارجی (که از طریق
اینترنت با API key دسترسی پیدا می‌شوند)، سرویس‌های تعبیه‌شده روی همان ماشین RouteChi اجرا می‌شوند
و از طریق loopback ارتباط برقرار می‌کنند.

---

## فهرست مطالب

1. [نمای کلی](#1-نمای-کلی)
2. [معماری — ۴ لایه](#2-معماری--۴-لایه)
3. [ماشین حالت چرخه‌حیات](#3-ماشین-حالت-چرخهحیات)
4. [مرجع API](#4-مرجع-api)
5. [امنیت](#5-امنیت)
6. [افزودن یک سرویس تعبیه‌شده‌ی جدید](#6-افزودن-یک-سرویس-تعبیهشده-جدید)
7. [عیب‌یابی](#7-عیبیابی)
8. [سوالات متداول](#8-سوالات-متداول)

---

## 1. نمای کلی

### چرا سرویس‌های تعبیه‌شده؟

چهار سرویس از نسخه‌ی v3.8.44 به‌بعد تعبیه‌شده‌اند:

| سرویس           | بسته‌ی npm                                  | پورت پیش‌فرض | هدف                                                                                                       |
| --------------- | ------------------------------------------- | :----------: | --------------------------------------------------------------------------------------------------------- |
| **9Router**     | `9router`                                   |    20130     | مسیریاب AI که RouteChi می‌تواند به‌عنوان sub-provider استفاده کند. مدل‌ها به‌صورت `9router/{sub}/{model}` عرضه می‌شوند |
| **CLIProxyAPI** | `@anthropic/cli-proxy` (از طریق باینری `cliproxy`) |     auto     | آداپتور پروکسی محلی برای جریان‌های احراز هویت CLI مربوط به Anthropic. routing fallback را هنگام انقضای توکن‌های OAuth ارائه می‌دهد |
| **Mux**         | `mux` (headless `mux server`)               |     8322     | daemon هماهنگی عامل محلی (coder/mux). فقط مدیریت چرخه‌حیات — یک هدف routing نیست (بدون LLM proxying)        |
| **Bifrost**     | `@maximhq/bifrost`                          |    8080      | backend رله‌ی AI-gateway به Go. هنگام اجرا، توسط مسیر relay (`/v1/relay/`) به‌طور خودکار انتخاب می‌شود       |

همه‌ی چهار مورد از همان مدل نظارتی پیروی می‌کنند:

- RouteChi آن‌ها را زیر `DATA_DIR/services/{name}/` نصب می‌کند (جدا از `package.json` خود RouteChi)
- RouteChi آن‌ها را به‌عنوان فرآیند فرزند spawn کرده و نظارت می‌کند
- RouteChi یک API key موقت را به محیط فرزند تزریق کرده و بدون downtime چرخش می‌دهد (در صورت وجود)
- همه‌ی مسیرهای مدیریت (`/api/services/*`) **LOCAL_ONLY** هستند — فقط از loopback قابل دسترسی‌اند (قانون سخت #17)

### تصمیمات کلیدی (از طرح طراحی)

| تصمیم                                  | مقدار                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------ |
| دسترسی داشبورد به رابط کاربری بومی 9Router | Reverse proxy در `/dashboard/providers/services/9router/embed/*`         |
| مکانیزم نصب                            | `npm install {package}` از طریق `execFile` (بدون shell interpolation)    |
| حالت مصرف                              | Provider به‌صورت `9router/{sub}/{model}` در موتور routing ثبت می‌شود      |
| مدیریت API key                         | RouteChi تولید، در حال استراحت رمزنگاری (AES-256-GCM)، و از طریق env تزریق می‌کند |
| محل داشبورد                            | `/dashboard/providers/services` (سه تب)                                   |
| شروع خودکار                            | Toggle به ازای هر سرویس، پیش‌فرض خاموش                                    |

---

## 2. معماری — 4 لایه

```
┌────────────────────────────────────────────────────────────────────┐
│  Layer 1 — UI                                                      │
│  /dashboard/providers/services  (tabs: CLIProxyAPI | 9Router | Mux)│
│  Logs live (SSE), Start/Stop/Restart/Update, Settings, Install     │
│                                                                    │
│  src/app/(dashboard)/dashboard/providers/services/                 │
│    ├── page.tsx               Shell + tab routing by ?tab=         │
│    ├── tabs/                  CliproxyServiceTab, NinerouterServiceTab,│
│    │                          MuxServiceTab                        │
│    └── components/            ServiceStatusCard, ServiceLifecycleButtons,│
│                               ServiceLogsPanel, ApiKeyCard, ...    │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ HTTP (Next.js fetch)
┌──────────────────────▼─────────────────────────────────────────────┐
│  Layer 2 — API (LOCAL_ONLY — loopback only)                        │
│                                                                    │
│  /api/services/9router/{install|start|stop|restart|update|         │
│                          rotate-key|status|auto-start|logs}        │
│  /api/services/cliproxy/{install|start|stop|restart|update|        │
│                           status|auto-start|logs}                  │
│  /api/services/mux/{install|start|stop|restart|update|             │
│                      status|auto-start|logs}                       │
│  /dashboard/providers/services/9router/embed/[...path]             │
│    (reverse HTTP + WebSocket proxy → 9Router upstream)             │
│                                                                    │
│  Gate: LOCAL_ONLY_API_PREFIXES includes "/api/services/" and       │
│        "/dashboard/providers/services/*/embed/"                    │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ in-process calls
┌──────────────────────▼─────────────────────────────────────────────┐
│  Layer 3 — ServiceSupervisor (src/lib/services/)                   │
│                                                                    │
│  ServiceSupervisor.ts   Generic supervisor (child_process.spawn)   │
│    ├── install:    execFile('npm', ['install', pkg, '--prefix'])    │
│    ├── start:      spawn(node, [entrypoint], {env, cwd})           │
│    ├── api_key:    crypto.randomBytes(32) → env NINEROUTER_API_KEY  │
│    ├── port:       20130 for 9Router (configurable)                │
│    ├── logs:       stdio ring buffer 5 MB → SSE events             │
│    ├── health:     HTTP GET /health every 2–5 s, lazy recovery     │
│    └── lifecycle:  SIGTERM 15 s → SIGKILL                          │
│                                                                    │
│  registry.ts        getSupervisor(name) / registerSupervisor()     │
│  bootstrap.ts       Bootstraps all SERVICES[] at process start     │
│  apiKey.ts          getOrCreateApiKey(), generateServiceApiKey()   │
│  modelSync.ts       Periodic GET /v1/models → service_models table │
│  ringBuffer.ts      Circular log buffer (5 MB per service)         │
│  healthCheck.ts     Polling HTTP health probe                      │
│  installers/        ninerouter.ts, cliproxy.ts, mux.ts             │
│                      (installer adapters)                          │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ OpenAI-compatible HTTP (loopback)
┌──────────────────────▼─────────────────────────────────────────────┐
│  Layer 4 — Provider / Routing                                      │
│                                                                    │
│  open-sse/executors/ninerouter.ts                                  │
│    Re-looks up port and API key per-request (no caching).          │
│    Strips "9router/" prefix from model id before proxying.         │
│    Returns 503 service_not_running if supervisor not in "running". │
│                                                                    │
│  src/shared/constants/providers.ts                                 │
│    Entry for "9router": isEmbeddedService: true                    │
│                                                                    │
│  open-sse/config/providerRegistry.ts                               │
│    Models stored as "9router/{sub}/{model}" (prefixed).            │
│    Synced every 5 min by modelSync.ts.                             │
│                                                                    │
│  Mux is lifecycle-managed ONLY (Layers 1-3) — it is an agent-       │
│  orchestration daemon, not an LLM proxy, so it has no Layer 4      │
│  executor/provider entry and is never a routing target.            │
└────────────────────────────────────────────────────────────────────┘
```

### فایل‌های منبع کلیدی

| فایل                                        | نقش                                              |
| ------------------------------------------- | ------------------------------------------------ |
| `src/lib/services/ServiceSupervisor.ts`     | کلاس اصلی: چرخه‌حیات، lock، سلامت، ring buffer   |
| `src/lib/services/bootstrap.ts`             | ثبت در سطح فرآیند و شروع خودکار                   |
| `src/lib/services/registry.ts`              | نقشه‌ی singleton `tool → supervisor`              |
| `src/lib/services/apiKey.ts`                | تولید کلید، رمزنگاری AES-256-GCM در حال استراحت |
| `src/lib/services/modelSync.ts`             | همگام‌سازی دوره‌ای مدل (۵ دقیقه) + در صورت تقاضا  |
| `src/lib/services/ringBuffer.ts`            | بافر log دایره‌ای ۵ مگابایتی با subscribe مربوط به SSE |
| `src/lib/services/healthCheck.ts`           | probe سلامت HTTP (فاصله‌ی قابل‌پیکربندی)         |
| `src/lib/services/installers/ninerouter.ts` | npm install/update/uninstall برای 9Router        |
| `src/lib/services/installers/cliproxy.ts`   | npm install/update/uninstall برای CLIProxyAPI    |
| `src/lib/services/installers/mux.ts`        | npm install/update/uninstall برای Mux            |
| `src/app/api/services/9router/_lib.ts`      | helper `getOrInitSupervisor()`                    |
| `src/app/api/services/[name]/logs/route.ts` | endpoint مشترک logهای SSE                         |
| `open-sse/executors/ninerouter.ts`          | executor مربوط به Provider (لایه‌ی ۴)             |

---

## 3. ماشین حالت چرخه‌حیات

```
                    install()
  ┌─────────────┐ ──────────► ┌─────────────┐
  │ not_installed│             │   stopped   │◄──────────────────┐
  └─────────────┘             └──────┬──────┘                   │
                                     │ start()                   │
                                     ▼                           │ stop()
                               ┌──────────┐                      │
                               │ starting │                      │
                               └────┬─────┘                     │
                  health probe ok   │         crash / SIGTERM    │
                               ┌────▼─────┐  (exit within 5s)   │
                               │ running  │──── crash ──────────►┤
                               └────┬─────┘                   ┌─▼────┐
                             stop() │                          │error │
                                    ▼                          └──────┘
                               ┌──────────┐
                               │ stopping │
                               └──────────┘
```

حالت‌ها در جدول DB `version_manager` (ستون `status`) ذخیره شده و در
حالت درون‌حافظه‌ای `ServiceSupervisor` منعکس می‌شوند. حالت درون‌حافظه‌ای برای یک
فرآیند در حال اجرا مقتدر است؛ حالت DB یک fallback پایدار در زمان boot است.

### انتقال‌های حالت

| از               | رویداد                              | به                     |
| ---------------- | ---------------------------------- | ---------------------- |
| `not_installed`  | `install()` موفق شد                | `stopped`              |
| `stopped`        | `start()` فراخوانی شد              | `starting`             |
| `starting`       | probe سلامت 200 برگرداند           | `running`              |
| `starting`       | فرآیند پیش از سلامت خارج شد        | `error`                |
| `running`        | `stop()` فراخوانی شد               | `stopping` → `stopped` |
| `running`        | فرآیند به‌طور غیرمنتظره خارج شد (< 5 s) | `error` (fast crash)   |
| `running`        | فرآیند به‌طور غیرمنتظره خارج شد (> 5 s) | `error`                |
| `error`          | `start()` فراخوانی شد              | `starting`             |
| هر               | `stop()` هنگام `stopping`          | no-op                  |

### قفل عملیات

`ServiceSupervisor` عملیات چرخه‌حیات را از طریق یک قفل عملیات async
(`withLock()`) سریال می‌کند. فراخوانی‌های همزمان `start()` روی همان supervisor منجر به دقیقاً
یک spawn می‌شود؛ فراخوانی‌کننده‌ی دوم منتظر مانده و وضعیت موجود را برمی‌گرداند. این کار از
شرایط رقابتی هنگامی که مثلاً شروع خودکار و یک دکمه‌ی رابط کاربری همزمان فعال شوند، جلوگیری می‌کند.

---

## 4. مرجع API

همه‌ی مسیرهای زیر `/api/services/` **LOCAL_ONLY** هستند (فقط loopback، قانون سخت #17).
درخواست‌های غیر-loopback بدون توجه به توکن احراز هویت `403 LOCAL_ONLY` دریافت می‌کنند.

### 4.1 endpointهای 9Router (8 مسیر)

#### `POST /api/services/9router/install`

نصب 9Router از npm. `DATA_DIR/services/9router/` را با `package.json` و
`node_modules/` خودش ایجاد می‌کند. با وابستگی‌های خود RouteChi تداخل ندارد.

**بدنه‌ی درخواست** (همه‌ی اختیاری):

```json
{ "version": "latest" }
```

| فیلد    | نوع     | پیش‌فرض   | توضیحات                          |
| ------- | -------- | --------- | -------------------------------- |
| `version`| `string` | `"latest"`| tag نسخه‌ی npm یا semver برای نصب |

**پاسخ‌ها:**

| وضعیت | توضیحات                                            |
| ----- | -------------------------------------------------- |
| `200` | `{ ok: true, installedVersion: "x.y.z", path: "..." }` |
| `400` | بدنه‌ی درخواست نامعتبر (شکست اعتبارسنجی Zod)       |
| `409` | در حال نصب است (قفل نگه‌داشته شده)                 |
| `500` | npm install شکست خورد — برای پیام خطای دوستانه به `message` مراجعه کنید |

**نکات:** از `execFile('npm', [...])` استفاده می‌کند — بدون shell، بدون interpolation (قانون سخت #13).
خطاهای EACCES به‌عنوان پیام‌های دوستانه نمایش داده می‌شوند.

---

#### `POST /api/services/9router/start`

شروع 9Router. در صورت عدم ثبت، یک supervisor ثبت کرده سپس
`supervisor.start()` را فراخوانی می‌کند. هنگام اجرای از پیش Idempotent است.

**بدنه‌ی درخواست:** هیچ‌کدام

**پاسخ‌ها:**

| وضعیت | توضیحات                                          |
| ----- | ------------------------------------------------ |
| `200` | شیء `ServiceStatus` (به schema زیر مراجعه کنید)  |
| `409` | 9Router نصب نیست (`status: "not_installed"`)     |
| `503` | شروع شکست خورد (خطای فرآیند — به `lastError` مراجعه کنید) |

**schema مربوط به ServiceStatus:**

```json
{
  "tool": "9router",
  "state": "running",
  "pid": 12345,
  "port": 20130,
  "health": "healthy",
  "startedAt": "2026-05-25T10:00:00.000Z",
  "lastError": null
}
```

---

#### `POST /api/services/9router/stop`

توقف Aram 9Router. SIGTERM می‌فرستد، ۱۵ ثانیه صبر می‌کند، سپس در صورت زنده بودن SIGKILL.
هنگام توقف از پیش Idempotent است.

**بدنه‌ی درخواست:** هیچ‌کدام

**پاسخ‌ها:**

| وضعیت | توضیحات                        |
| ----- | ------------------------------ |
| `200` | `ServiceStatus` (state: "stopped") |
| `503` | توقف به‌طور غیرمنتظره شکست خورد |

---

#### `POST /api/services/9router/restart`

معادل `stop()` و سپس `start()` زیر قفل عملیات.

**بدنه‌ی درخواست:** هیچ‌کدام

**پاسخ‌ها:** همان `start` (نهایی `ServiceStatus` را برمی‌گرداند).

---

#### `POST /api/services/9router/update`

9Router را به نسخه‌ی npm جدیدتری به‌روزرسانی می‌کند. اگر سرویس در حال اجراست، ابتدا متوقف
می‌شود، npm install اجرا می‌شود (نصب نسخه‌ی جدیدتر در محل)، و سپس سرویس
دوباره راه‌اندازی می‌شود.

**بدنه‌ی درخواست** (همه‌ی اختیاری):

```json
{ "version": "latest" }
```

**پاسخ‌ها:**

| وضعیت | توضیحات                                                     |
| ----- | ----------------------------------------------------------- |
| `200` | `{ ok: true, previousVersion: "...", installedVersion: "..." }` |
| `400` | بدنه‌ی نامعتبر                                              |
| `500` | npm update شکست خورد                                        |

---

#### `POST /api/services/9router/rotate-key`

یک API key جدید برای 9Router تولید، در حال استراحت رمزنگاری و سرویس را (در صورت اجرا)
راه‌اندازی مجدد می‌کند تا کلید جدید را از محیط خود بردارد. کلید قدیدی
فوراً بی‌اعتبار می‌شود.

**بدنه‌ی درخواست:** هیچ‌کدام

**پاسخ‌ها:**

| وضعیت | توضیحات                                |
| ----- | -------------------------------------- |
| `200` | `{ keyRotated: true, restarted: boolean }` |
| `500` | چرخش شکست خورد                         |

**امنیت:** کلید جدید هرگز در پاسخ بازگردانده نمی‌شود (بدون نشت credential).
به‌صورت رمزنگاری‌شده (AES-256-GCM) در جدول `version_manager` ذخیره می‌شود.

---

#### `GET /api/services/9router/status`

وضعیت ترکیبی زنده + DB شامل متادیتای نسخه و پیش‌نمایش API key را برمی‌گرداند.

**پاسخ‌ها:**

| وضعیت | توضیحات            |
| ----- | ------------------ |
| `200` | به schema زیر مراجعه کنید |
| `500` | خواندن وضعیت شکست خورد |

**schema پاسخ:**

```json
{
  "tool": "9router",
  "state": "running",
  "pid": 12345,
  "port": 20130,
  "health": "healthy",
  "startedAt": "2026-05-25T10:00:00.000Z",
  "lastError": null,
  "installedVersion": "1.2.3",
  "latestVersion": "1.2.4",
  "updateAvailable": true,
  "apiKeyMasked": "nr_****abcd",
  "autoStart": false,
  "providerExpose": false
}
```

---

#### `POST /api/services/9router/auto-start`

Toggle فلگ شروع خودکار. هنگام `enabled: true`، سرویس در دفعه‌ی بعدی که RouteChi بوت می‌شود
به‌طور خودکار شروع می‌شود (اگر سرویس نصب باشد).

**بدنه‌ی درخواست:**

```json
{ "enabled": true }
```

**پاسخ‌ها:**

| وضعیت | توضیحات           |
| ----- | ----------------- |
| `200` | `{ autoStart: true }` |
| `400` | بدنه‌ی نامعتبر    |

---

#### `GET /api/services/9router/logs`

جریان SSE از logهای زنده از ring buffer مربوط به stdout/stderr در 9Router.

**پارامترهای query:**

| پارامتر | نوع       | پیش‌فرض | توضیحات                                               |
| ------- | --------- | ------- | ----------------------------------------------------- |
| `tail`  | `integer` | 200     | چه تعداد خط تاریخی ابتدا ارسال شود (حداکثر ۱۰۰۰)      |
| `filter`| `string`  | none    | فیلتر زیررشته‌ای case-insensitive (بدون regex — ReDoS-safe) |

**رویدادهای SSE:**

| رویداد      | داده        | توضیحات              |
| ----------- | ----------- | -------------------- |
| `snapshot`  | `LogLine[]` | tail تاریخی اولیه    |
| `log`       | `LogLine`   | خط log زنده          |
| `heartbeat` | `{}`        | Keep-alive هر ۱۵ ثانیه |

**schema مربوط به LogLine:**

```json
{ "ts": 1716633600000, "stream": "stdout", "line": "[9router] Listening on :20130" }
```

**پاسخ‌ها:**

| وضعیت | توضیحات                                       |
| ----- | --------------------------------------------- |
| `200` | `text/event-stream`                           |
| `400` | پارامتر `filter` خیلی بلند است (> 200 کاراکتر) |
| `404` | سرویس یافت نشد (supervisor ثبت نشده)           |

---

### 4.2 endpointهای CLIProxyAPI (7 مسیر)

CLIProxyAPI همان شکل endpoint را با 9Router منهای `rotate-key` دارد (CLIProxyAPI
نیاز به API key تزریق‌شده ندارد؛ از طریق config موجود CLI میزبان احراز هویت می‌کند) و
`status` شامل فیلدهای کمتری است.

| Method | Path                                | توضیحات                          |
| ------ | ----------------------------------- | -------------------------------- |
| `POST` | `/api/services/cliproxy/install`    | نصب CLIProxyAPI از npm           |
| `POST` | `/api/services/cliproxy/start`      | شروع CLIProxyAPI                 |
| `POST` | `/api/services/cliproxy/stop`       | توقف CLIProxyAPI                 |
| `POST` | `/api/services/cliproxy/restart`    | راه‌اندازی مجدد CLIProxyAPI      |
| `POST` | `/api/services/cliproxy/update`     | به‌روزرسانی به نسخه‌ی جدیدتر     |
| `GET`  | `/api/services/cliproxy/status`     | وضعیت زنده + DB (بدون `apiKeyMasked`) |
| `POST` | `/api/services/cliproxy/auto-start` | Toggle شروع خودکار               |

endpoint مشترک `GET /api/services/{name}/logs` (به §4.1 مراجعه کنید) برای هر
چهار سرویس با استفاده از بخش پویای `[name]` کار می‌کند.

---

### 4.3 endpointهای Mux (7 مسیر)

Mux همان شکل endpoint را با CLIProxyAPI دارد — مسیر `rotate-key` در سطح
API وجود ندارد (توکن bearer به همان روش 9Router از طریق
`getOrCreateApiKey("mux")` تولید و از طریق متغیر محیطی `MUX_SERVER_AUTH_TOKEN` تزریق می‌شود، اما
endpoint چرخش اختصاصی هنوز وجود ندارد). Mux فقط مدیریت چرخه‌حیات می‌شود: برخلاف
9Router، executor لایه‌ی ۴ ندارد و هرگز به‌عنوان provider routing ثبت نمی‌شود.

| Method | Path                            | توضیحات                          |
| ------ | -------------------------------- | --------------------------------- |
| `POST` | `/api/services/mux/install`      | نصب Mux از npm (`npm i mux`)      |
| `POST` | `/api/services/mux/start`        | شروع Mux (`mux server`)           |
| `POST` | `/api/services/mux/stop`         | توقف Mux                          |
| `POST` | `/api/services/mux/restart`      | راه‌اندازی مجدد Mux               |
| `POST` | `/api/services/mux/update`       | به‌روزرسانی به نسخه‌ی npm جدیدتر |
| `GET`  | `/api/services/mux/status`       | وضعیت زنده + DB                   |
| `POST` | `/api/services/mux/auto-start`   | Toggle شروع خودکار                |

---

### 4.4 endpointهای Bifrost (7 مسیر)

Bifrost یک backend رله‌ی AI-gateway به Go است (`@maximhq/bifrost`). از همان
شکل endpoint با CLIProxyAPI استفاده می‌کند (بدون `rotate-key` — Bifrost کلیدهای provider خود را
در `config.json` زیر `-app-dir` خود مدیریت می‌کند).

| Method | Path                               | توضیحات                                            |
| ------ | ---------------------------------- | -------------------------------------------------- |
| `POST` | `/api/services/bifrost/install`    | نصب Bifrost از npm (`@maximhq/bifrost`)            |
| `POST` | `/api/services/bifrost/start`      | شروع Bifrost روی پورت 8080 (پیش‌فرض)               |
| `POST` | `/api/services/bifrost/stop`       | توقف Bifrost                                       |
| `POST` | `/api/services/bifrost/restart`    | راه‌اندازی مجدد Bifrost                            |
| `POST` | `/api/services/bifrost/update`     | به‌روزرسانی به نسخه‌ی جدیدتر                      |
| `GET`  | `/api/services/bifrost/status`     | وضعیت زنده + DB                                    |
| `POST` | `/api/services/bifrost/auto-start` | Toggle شروع خودکار                                 |
| `GET`  | `/api/services/bifrost/logs`       | tail log SSE (از طریق مسیر پویای مشترک `[name]/logs`) |

**اتصال routing:** هنگامی که `BIFROST_BASE_URL` تنظیم‌نشده باشد و instance تحت نظارت Bifrost
در حال اجرا باشد، `getBifrostRoutingConfig()` (در `routingBackend.ts`) به‌طور خودکار
`http://127.0.0.1:{port}` را به‌عنوان URL پایه‌ی relay استفاده می‌کند. متغیر محیطی صریح `BIFROST_BASE_URL`
همیشه اولویت دارد.

---

### 4.4 Reverse proxy (embed داشبورد 9Router)

داشبورد رابط کاربری وب 9Router را از طریق یک reverse proxy داخلی در داخل iframe جاسازی می‌کند در:

```
GET|POST|... /dashboard/providers/services/9router/embed/[...path]
```

این proxy:

- درخواست را به `http://127.0.0.1:{port}/{path}` فوروارد می‌کند (فقط loopback)
- هدرهای ورودی `cookie` و `authorization` را حذف می‌کند (بدون نشت نشست RouteChi)
- `Authorization: Bearer {apiKey}` را برای احراز هویت 9Router تزریق می‌کند
- `set-cookie`، `content-security-policy`، `x-frame-options`، `cross-origin-*` را از پاسخ حذف می‌کند
- پاسخ‌های HTML را برای تزریق `<base href>` و نرمال‌سازی مسیرهای مطلق بازنویسی می‌کند (`/foo` → `/dashboard/.../embed/foo`)

ارتقا WebSocket برای داشبورد تعبیه‌شده توسط یک سرور همراه روی یک
پورت اختصاصی مدیریت می‌شود (به `src/lib/services/embedWsProxy.ts` مراجعه کنید).

**امنیت:** مسیرهای proxy تعبیه‌شده تحت `LOCAL_ONLY_API_PREFIXES`
طبقه‌بندی می‌شوند و فقط از loopback قابل دسترسی‌اند. مهاجمی که از طریق
tunnel مربوط به Cloudflare/Ngrok یک JWT به‌دست می‌آورد نمی‌تواند به سرویس‌های تعبیه‌شده پروکسی کند.

---

## 5. امنیت

### اعمال LOCAL_ONLY (قانون سخت #17)

همه‌ی مسیرهای زیر `/api/services/` و `/dashboard/providers/services/*/embed/` در
`src/server/authz/routeGuard.ts` به‌عنوان LOCAL_ONLY طبقه‌بندی می‌شوند. بررسی loopback
به‌طور غیرمشروط پیش از هر شاخه‌ی احراز هویت اجرا می‌شود:

```
request arrives
  → isLocalOnlyPath(path)?
      → non-loopback → 403 LOCAL_ONLY (always, before auth check)
      → loopback    → fall through to normal auth
```

این کار از راه‌اندازی `npm install` یا
spawn فرآیند توسط یک JWT نشت‌کرده (مثلاً از طریق tunnel) جلوگیری می‌کند. برای ماتریس کامل لایه به
`docs/security/ROUTE_GUARD_TIERS.md` مراجعه کنید.

### تزریق API key

9Router و Mux برای endpointهای HTTP خود نیازمند API key/bearer token هستند.
RouteChi:

1. تولید یک کلید از طریق `crypto.randomBytes(32).toString("base64url")` با یک
   پیشوند مختص سرویس (`nr_` برای 9Router، `mx_` برای Mux).
2. رمزنگاری در حال استراحت با AES-256-GCM (همان cipher که برای credentialهای provider استفاده می‌شود).
3. رمزگشایی و تزریق به‌عنوان یک متغیر محیطی در زمان spawn —
   `NINEROUTER_API_KEY` برای 9Router، `MUX_SERVER_AUTH_TOKEN` برای Mux (هرگز یک
   flag CLI، تا توکن هرگز در لیست‌های `ps`/فرآیند ظاهر نشود).
4. هرگز کلید plaintext را در هیچ پاسخ HTTP بازنمی‌گرداند.

CLIProxyAPI نیازمند کلید تزریق‌شده نیست (از طریق config موجود CLI
میزبان احراز هویت می‌کند).

### دفاع SSRF

reverse HTTP proxy (`/dashboard/.../embed/[...path]`) به فوروارد فقط به
`http://127.0.0.1:{port}` hardcoded شده است. هرگز redirectها به مقاصد غیر-loopback را دنبال نمی‌کند.
کتابخانه‌ی `ssrf-req-filter` برای رد هر URL upstream که خارج از
محدوده‌ی loopback resolve می‌شود، استفاده شده است.

### ایمنی shell (قانون سخت #13)

`npm install` از طریق `execFile('npm', ['install', pkg, '--prefix', dir])` فراخوانی می‌شود —
بدون template literal، بدون shell، بدون interpolation مسیرهای خارجی در رشته‌ی
فرمان. مقادیر runtime (پورت‌ها، API keyها) از طریق شیء `env` فرزند ارسال می‌شوند.

### پاک‌سازی خطا (قانون سخت #12)

همه‌ی پاسخ‌های خطا از `/api/services/*` از `buildErrorBody()` یا
`sanitizeErrorMessage()` عبور می‌کنند. `err.stack` و `err.message` خام هرگز به‌طور
verbatim به فراخوان‌کننده بازگردانده نمی‌شوند.

---

## 6. افزودن یک سرویس تعبیه‌شده‌ی جدید

این ۸ مرحله را دنبال کنید. پیاده‌سازی‌های موجود در `src/lib/services/installers/`
و `src/app/api/services/` را به‌عنوان مرجع کانونیک بخوانید.

### مرحله 1 — ایجاد installer

ایجاد `src/lib/services/installers/{name}.ts` مدل‌شده بر اساس `ninerouter.ts`:

```typescript
export const NAME_PACKAGE = "your-npm-package";
export const NAME_DEFAULT_PORT = 20132; // pick a free port

export async function install(version = "latest"): Promise<InstallResult> { ... }
export async function update(version = "latest"): Promise<InstallResult> { ... }
export async function uninstall(): Promise<void> { ... }
export function resolveSpawnArgs(apiKey: string, port: number): SpawnArgs { ... }
export async function getInstalledVersion(): Promise<string | null> { ... }
export async function getLatestVersion(): Promise<string | null> { ... }
```

از `runNpm(['install', NAME_PACKAGE, '--prefix', dir])` از `installers/utils.ts` استفاده کنید
— هرگز `execSync` یا shell interpolation نکنید.

### مرحله 2 — ثبت در bootstrap

افزودن یک `ServiceEntry` به آرایه‌ی `SERVICES` در `src/lib/services/bootstrap.ts`:

```typescript
{
  tool: "myservice",
  port: NAME_DEFAULT_PORT,
  healthPath: "/health",
  healthIntervalMs: 5_000,
  stopTimeoutMs: 15_000,
  logsBufferBytes: 5_242_880,
  needsApiKey: true, // false if no API key needed
}
```

`buildSpawnArgsFactory()` را برای مدیریت `cfg.tool === "myservice"` گسترش دهید.

### مرحله 3 — افزودن migration و seed پایگاه داده

اطمینان حاصل کنید سرویس یک ردیف در `version_manager` از طریق یک migration در
`src/lib/db/migrations/` دارد. ردیف باید دارای:

```sql
INSERT OR IGNORE INTO version_manager (tool, status, auto_start, provider_expose)
VALUES ('myservice', 'not_installed', 0, 0);
```

### مرحله 4 — ایجاد ۷ endpoint API

زیر `src/app/api/services/{name}/`:

```
_lib.ts            getOrInitSupervisor() helper
install/route.ts   POST — calls installer.install()
start/route.ts     POST — calls supervisor.start()
stop/route.ts      POST — calls supervisor.stop()
restart/route.ts   POST — calls supervisor.restart()
update/route.ts    POST — calls installer.update()
status/route.ts    GET  — merges live + DB status
auto-start/route.ts POST — toggles auto_start flag
```

مسیر مشترک `GET /api/services/[name]/logs` از قبل متصل شده — نیازی به تغییر
در آنجا نیست.

تمام پاسخ‌های خطا را از طریق `createErrorResponse()` / `buildErrorBody()` تفویض کنید.

### مرحله 5 — افزودن به LOCAL_ONLY_API_PREFIXES

در `src/server/authz/routeGuard.ts`، تأیید کنید که `/api/services/` از قبل فهرست شده است.
اگر یک پیشوند جدید معرفی می‌کنید (مثلاً `/api/tools/`)، آن را به هر دو
`LOCAL_ONLY_API_PREFIXES` و در صورت spawn فرآیند، به `SPAWN_CAPABLE_PREFIXES` اضافه کنید.
یک آزمون در `tests/unit/authz/routeGuard.test.ts` اضافه کنید.

### مرحله 6 — افزودن تب رابط کاربری

ایجاد `src/app/(dashboard)/dashboard/providers/services/tabs/{Name}ServiceTab.tsx`.
از اجزای مشترک استفاده مجدد کنید:

- `ServiceStatusCard` — حالت زنده + badge سلامت
- `ServiceLifecycleButtons` — Start / Stop / Restart / Update
- `ServiceLogsPanel` — tail log SSE (به `/api/services/{name}/logs` متصل می‌شود)
- `ApiKeyCard` — نمایش + چرخش کلید (اگر `needsApiKey: true`)

ثبت تب در `ServicesPageShell.tsx`.

### مرحله 7 — افزودن ورودی provider (اگر سرویس یک هدف routing است)

اگر سرویس تعبیه‌شده یک endpoint `/v1/chat/completions` سازگار با OpenAI عرضه می‌کند:

1. یک ورودی provider در `src/shared/constants/providers.ts` با `isEmbeddedService: true` اضافه کنید.
2. ایجاد `open-sse/executors/{name}.ts` که `BaseExecutor` را گسترش می‌دهد. port و
   API key را به ازای هر درخواست دوباره جستجو کنید (هرگز در constructor کش نکنید). یک پاسخ `503 service_not_running`
   هنگامی که وضعیت supervisor `"running"` نیست برگردانید.
3. ثبت مدل‌ها در `open-sse/config/providerRegistry.ts` با پیشوند سرویس
   (مثلاً `myservice/sub/model`). `modelSync.ts` آن‌ها را به‌روز نگه می‌دارد.

### مرحله 8 — مستندسازی و آزمون

1. به‌روزرسانی `docs/frameworks/EMBEDDED-SERVICES.md` (این فایل) — سرویس را به
   جدول در §1 و هر endpoint جدید را به §4 اضافه کنید.
2. افزودن آزمون واحد در `tests/unit/services/` (چرخه‌حیات، installer، شکل API).
3. افزودن آزمون یکپارچه‌سازی در `tests/integration/services/` (پشت `RUN_SERVICES_INT=1`).
4. به‌روزرسانی `docs/openapi.yaml` با endpointهای جدید.

---

## 7. عیب‌یابی

### سرویس شروع نمی‌شود

**علائم:** دکمه‌ی Start 503 برمی‌گرداند، حالت روی `"error"` یا `"starting"` می‌ماند.

**چک‌لیست:**

1. بررسی `GET /api/services/{name}/logs` (یا پنل Logs در داشبورد). به دنبال
   خطوطی مانند `Error: ENOENT`، `address already in use` یا `Cannot find module` بگردید.
2. تأیید `npm` در PATH است: `which npm` از همان حساب کاربری که RouteChi را اجرا می‌کند.
3. تأیید سرویس نصب شده است: `GET /api/services/{name}/status` را برای
   `installedVersion` بررسی کنید. اگر `null` است، ابتدا install را اجرا کنید.
4. بررسی `DATA_DIR/services/{name}/node_modules/` موجود است و خالی نیست.
5. فیلد `lastError` را در پاسخ وضعیت برای دلیل خروج پاک‌سازی‌شده بررسی کنید.

---

### شروع سرد کند است (> 10 ثانیه برای رسیدن به `running`)

**علائم:** حالت برای مدت طولانی روی `"starting"` می‌ماند قبل از رفتن به `"running"` یا `"error"`.

**توضیح:** شروع سرد 9Router شامل import کردن درخت وابستگی بزرگ (DNS،
tunnel، ماژول‌های MITM) است. فاصله‌ی پیش‌فرض سلامت ۲ ثانیه با ۳ تلاش پیش از آنکه
supervisor یک timeout اعلام کند (اما به poll ادامه می‌دهد) است.

**رفع:** `healthIntervalMs` و timeout `waitForHealthy`
(`healthIntervalMs * 3`) در `bootstrap.ts` قابل پیکربندی هستند. برای سرویس‌هایی با زمان‌های
شروع طولانی‌تر، `healthIntervalMs` را به 5000 و `stopTimeoutMs` را به 30 000 افزایش دهید.

---

### تداخل پورت (`EADDRINUSE`)

**علائم:** logها `address already in use :::20130` را نشان می‌دهند.

**علل:**

- یک فرآیند دیگر در حال حاضر از پورت 20130 استفاده می‌کند.
- یک فرآیند قبلی 9Router به‌طور کامل متوقف نشده است (PID زامبی).

**رفع:**

1. پورت پیش‌فرض را از طریق متغیر محیطی `NINEROUTER_PORT` در `.env` تغییر دهید.
2. یافتن و کشتن فرآیند متعارض: `lsof -ti :20130 | xargs kill -9`.
3. پورت به ازای هر سرویس در `bootstrap.ts` از طریق فیلد `port` قابل پیکربندی است.

**نکته:** 9Router به‌طور خاص برای جلوگیری از تداخل با
پورت پیش‌فرض 20128 مربوط به RouteChi، از پورت 20130 استفاده می‌کند.

---

### خطای Permission denied (EACCES) هنگام نصب

**علائم:** Install 500 برمی‌گرداند، logها `EACCES` یا `permission denied` را نشان می‌دهند.

**علل:**

- `DATA_DIR` یا والد آن توسط فرآیند RouteChi قابل نوشتن نیست.
- اجرا داخل Docker rootless بدون دسترسی نوشتن به volume نگاشت‌شده.

**رفع:**

1. بررسی `DATA_DIR` (پیش‌فرض: `~/.omniroute/`): `ls -la ~/.omniroute/`
2. اطمینان از اینکه کاربر فرآیند RouteChi مالک دایرکتوری است: `chown -R $USER ~/.omniroute/`
3. در Docker، اطمینان از اینکه volume mount دسترسی‌های صحیح برای کاربر container دارد.

---

### به‌روزرسانی شکست می‌خورد (timeout `npm install` یا خطای شبکه)

**علائم:** Update 500 با `InstallError` برمی‌گرداند، logها timeout شبکه را نشان می‌دهند.

**چک‌لیست:**

1. تأیید رجیستری npm قابل دسترسی است: `npm ping`.
2. بررسی proxy شرکتی: `npm config get proxy`، `npm config get https-proxy`.
3. install را به‌صورت دستی امتحان کنید: `npm install {package}@latest --prefix ~/.omniroute/services/{name}/`.
4. اگر پشت air-gap هستید، tarball را از پیش دانلود کرده و `npm install /path/to/tarball.tgz` استفاده کنید.

---

### سرویس بلافاصله پس از شروع حالت `"error"` نشان می‌دهد (fast crash)

**علائم:** حالت در کمتر از ۵ ثانیه از `"starting"` به `"error"` منتقل می‌شود.
`lastError` `"Fast crash (exited with code 1)"` را نشان می‌دهد.

**چک‌لیست:**

1. خواندن tail کامل log: `GET /api/services/{name}/logs?tail=500`.
2. علت رایج: متغیرهای محیطی مفقود که سرویس انتظار دارد.
3. برای 9Router: تأیید `NINEROUTER_DISABLE_MITM=true` و
   `NINEROUTER_DISABLE_TUNNEL=true` در env ارسالی در زمان spawn (به
   `installers/ninerouter.ts` `resolveSpawnArgs` مراجعه کنید) قرار دارند.

---

## 8. سوالات متداول

**س: آیا می‌توانم endpointهای سرویس‌های تعبیه‌شده را به کلاینت‌های غیر-loopback در دسترس قرار دهم؟**

خیر. لایه‌ی LOCAL_ONLY عمدی است (قانون سخت #17). مسیرهایی که می‌توانند
`npm install` یا فرآیندهای `node` را راه‌اندازی کنند نباید از ترافیک غیر-loopback
قابل دسترسی باشند، زیرا یک JWT نشت‌کرده از طریق tunnel (Cloudflare، Ngrok، Tailscale) در غیر این صورت
به spawn فرآیند دلخواه اجازه می‌داد. هیچ carve-out انصرافی برای
`/api/services/` وجود ندارد — برخلاف `/api/mcp/`، از فهرست دور زدن manage-scope مستثنی
است. به `docs/security/ROUTE_GUARD_TIERS.md` مراجعه کنید.

---

**س: آیا 9Router و CLIProxyAPI در استقرارهای production/cloud در دسترس خواهند بود؟**

بله. هر دو سرویس از همان مدل local-first به‌عنوان خود RouteChi پیروی می‌کنند. آن‌ها روی
همان ماشین اجرا شده و از طریق loopback ارتباط برقرار می‌کنند. "Production" در اینجا به معنای VPS
یا سرور محلی است که RouteChi روی آن مستقر شده، نه یک provider ابری ریموت.

---

**س: چگونه supervisor را دیباگ کنم؟**

1. tail جریان log SSE: `curl -N http://localhost:20128/api/services/9router/logs`.
2. بررسی logهای ساختاریافته در خروجی pino مربوط به RouteChi فیلتر‌شده بر اساس
   namespace `service:supervisor`.
3. بررسی ردیف DB: `sqlite3 ~/.omniroute/omniroute.db "SELECT * FROM version_manager WHERE tool='9router'"`.
4. استفاده از `GET /api/services/9router/status` برای دیدن حالت زنده فعلی، PID، سلامت،
   و `lastError` در یک فراخوانی.

---

**س: supervisor `health: "degraded"` یا `health: "unknown"` را نشان می‌دهد اما حالت `"running"` است. آیا این مشکل است؟**

`"degraded"` به این معنی است که probe سلامت یک پاسخ غیر-200 برگردانده است. `"unknown"` به این معنی است که هنوز هیچ
probe‌ای کامل نشده است (رقابت با اولین poll). هر دو در طول شروع گذرا هستند.
اگر سلامت بیش از `healthIntervalMs * 3` ms پس از
`"running"` روی `"degraded"` بماند، سرویس تعبیه‌شده در حال اجراست اما API HTTP آن پاسخ نمی‌دهد. بررسی
کنید که پورت در پاسخ وضعیت صحیح است و سرویس واقعاً روی آن پورت
در حال گوش دادن است.

---

**س: آیا می‌توانم API key مربوط به 9Router را بدون راه‌اندازی مجدد کامل تغییر دهم؟**

خیر. API key در زمان spawn از طریق یک متغیر محیطی به 9Router ارسال می‌شود.
متغیرهای محیطی در یک فرآیند در حال اجرا قابل تغییر نیستند. `POST .../rotate-key`
به‌طور خودکار سرویس را متوقف و مجدداً راه‌اندازی می‌کند تا کلید جدید را اعمال کند. چرخش کلید
در عرض `stopTimeoutMs` سرویس (پیش‌فرض ۱۵ ثانیه) به‌علاوه‌ی زمان شروع آن
معتبر می‌شود.

---

**س: محدودیت ring buffer چیست و وقتی پر می‌شود چه اتفاقی می‌افتد؟**

هر سرویس یک ring buffer اختصاصی ۵ مگابایتی دارد. وقتی بافر پر شود، قدیمی‌ترین
خطوط log برای جا دادن خطوط جدید evict می‌شوند. رویداد SSE `snapshot`
جدیدترین خطوط در محدوده‌ی `tail` را برمی‌گرداند. logها به دیسک ماندگار نمی‌شوند مگر
اینکه `logsBufferPath` در ردیف DB تنظیم شده باشد.

---

## همچنین ببینید

- `docs/security/ROUTE_GUARD_TIERS.md` — جزئیات لایه‌ی LOCAL_ONLY
- `docs/architecture/CODEBASE_DOCUMENTATION.md` — §3.2 نگاشت ماژول سرویس‌های تعبیه‌شده
- `docs/architecture/ARCHITECTURE.md` — context در سطح سیستم
- `docs/openapi.yaml` — تعاریف endpoint قابل‌خواندن توسط ماشین
- `CLAUDE.md` §"Adding a New Embedded Service" — چک‌لیست مرجع سریع
