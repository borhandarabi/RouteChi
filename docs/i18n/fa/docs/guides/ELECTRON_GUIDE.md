---
title: "راهنمای دسکتاپ Electron"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای دسکتاپ Electron

> **منبع حقیقت:** workspace مربوط به `electron/`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

OmniRoute یک برنامهٔ دسکتاپ چندسکویی (ویندوز / macOS / لینوکس) مبتنی بر
**Electron 41** + **electron-builder 26.10** ارائه می‌دهد. برنامهٔ دسکتاپ سرور standalone
مربوط به Next.js را به‌عنوان یک فرایند فرزند اجرا می‌کند، یک `BrowserWindow` به آن
هدایت می‌کند و یک system tray، به‌روزرسان خودکار، پل IPC و bootstrap راز بدون پیکربندی اضافه می‌کند.

## معماری

```
┌──────────────────────────────────────────────┐
│ Electron main process (electron/main.js)     │
│ ├─ Single-instance lock                       │
│ ├─ Child process: Next.js standalone server  │
│ │   (spawned with Electron's Node runtime)   │
│ ├─ BrowserWindow → http://localhost:PORT     │
│ ├─ System tray + context menu                │
│ ├─ Auto-update via electron-updater          │
│ ├─ Content Security Policy (session headers) │
│ └─ Secret bootstrap (JWT / API_KEY_SECRET)   │
└──────────────────────────────────────────────┘
            ↕ IPC bridge (electron/preload.js)
┌──────────────────────────────────────────────┐
│ Renderer (Next.js dashboard)                  │
│   window.electronAPI.* (contextIsolation)     │
└──────────────────────────────────────────────┘
```

## نسخه‌ها

تأییدشده از `electron/package.json`:

| پکیج              | نسخه                       |
| ----------------- | -------------------------- |
| `electron`        | `^41.5.1`                  |
| `electron-builder` | `^26.10.0`                 |
| `electron-updater` | `^6.8.5`                   |
| `better-sqlite3`  | `^12.9.0`                  |
| نسخهٔ برنامه      | `3.8.0`                    |
| شناسهٔ برنامه     | `online.omniroute.desktop` |
| نام محصول         | `OmniRoute`                |

## اسکریپت‌ها (`package.json` ریشه)

| اسکریپت                          | هدف                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `npm run electron:dev`            | اجرای `npm run dev` + انتظار برای `localhost:20128` + راه‌اندازی Electron   |
| `npm run electron:build`          | ساختن Next.js سپس اجرای `electron-builder` برای سیستم‌عامل فعلی             |
| `npm run electron:build:win`      | ساختن نصب‌کنندهٔ NSIS ویندوز + نسخهٔ portable (x64)                          |
| `npm run electron:build:mac`      | ساختن DMG مک (Intel + Apple Silicon)                                         |
| `npm run electron:build:linux`    | ساختن AppImage لینوکس + DEB (x64 + arm64)                                    |
| `npm run electron:smoke:packaged` | اجرای باینری packageشده و بررسی `/login` برای HTTP 200، سپس خاموش کردن        |

workspace مربوط به `electron/` همچنین موارد زیر را ارائه می‌دهد:

- `npm run prepare:bundle` — اجرای `scripts/build/prepare-electron-standalone.mjs`
- `npm run build:mac-x64` / `build:mac-arm64` — ساخت macOS تک‌معماری
- `npm run pack` — ساخت فقط‌شاخه‌ای برای آزمایش محلی (بدون نصب‌کننده)

## چیدمان شاخه

```
electron/
├── package.json              # Electron deps + electron-builder config
├── main.js                   # Main process (24 KB — see annotations below)
├── preload.js                # contextBridge IPC bridge
├── types.d.ts                # AppInfo / ServerStatus / ElectronAPI types
├── README.md                 # In-workspace notes
├── assets/                   # icon.png, icon.ico, icon.icns, tray-icon.png
└── dist-electron/            # electron-builder output (gitignored)

scripts/
├── build/
│   └── prepare-electron-standalone.mjs   # Stages .next/electron-standalone bundle
└── dev/
    └── smoke-electron-packaged.mjs       # Post-build smoke test
```

هر دو فایل `main.js` و `preload.js` **فایل‌های `.js` با فرمت CommonJS** هستند، نه TypeScript.
typings سمت renderer در `electron/types.d.ts` قرار دارد.

## پل IPC (`preload.js`)

preload یک API whitelistشده روی `window.electronAPI` با استفاده از `contextBridge` و با
`contextIsolation: true` و `nodeIntegration: false` نمایش می‌دهد.

```javascript
const VALID_CHANNELS = {
  invoke: [
    "get-app-info",
    "open-external",
    "get-data-dir",
    "restart-server",
    "check-for-updates",
    "download-update",
    "install-update",
    "get-app-version",
  ],
  send: ["window-minimize", "window-maximize", "window-close"],
  receive: ["server-status", "port-changed", "update-status"],
};
```

متدهای نمایش‌داده‌شده:

| فراخوانی renderer                                                 | نوع                        |
| ----------------------------------------------------------------- | -------------------------- |
| `getAppInfo()` → `{ name, version, platform, isDev, port }`       | invoke                     |
| `openExternal(url)`                                               | invoke                     |
| `getDataDir()`                                                    | invoke                     |
| `restartServer()`                                                 | invoke                     |
| `getAppVersion()`                                                 | invoke                     |
| `checkForUpdates()` / `downloadUpdate()` / `installUpdate()`      | invoke                     |
| `minimizeWindow()` / `maximizeWindow()` / `closeWindow()`         | send                       |
| `onServerStatus(cb)` / `onPortChanged(cb)` / `onUpdateStatus(cb)` | receive (برگرداندن disposer) |

helperهای receive به‌جای تکیه بر `removeAllListeners` یک **تابع disposer** باز می‌گردانند —
این از انباشت listener هنگام remount شدن کامپوننت‌های React جلوگیری می‌کند.

## چرخهٔ حیات سرور

`main.js` بستهٔ standalone مربوط به Next.js را مستقیماً با runtime مربوط به Node الکترون
اجرا می‌کند تا از عدم تطابق ABI ماژول بومی با Node سامانه جلوگیری شود:

```js
spawn(process.execPath, [serverScript], {
  cwd: NEXT_SERVER_PATH,
  env: { ...serverEnv, PORT, NODE_ENV: "production", ELECTRON_RUN_AS_NODE: "1", NODE_PATH },
  stdio: "pipe",
});
```

نکات برجسته:

- `waitForServer()` تا ۳۰ ثانیه URL را poll می‌کند قبل از نمایش پنجره (بدون صفحهٔ خالی هنگام شروع سرد).
- `stdio: "pipe"` خروجی stdout/stderr را ضبط می‌کند؛ عبارات آمادگی (`Ready` / `listening`)
  از طریق IPC رویداد `server-status: running` را ارسال می‌کنند.
- `before-quit` تا ۵ ثانیه برای SIGTERM آرام (WAL checkpoint) صبر می‌کند سپس SIGKILL می‌فرستد.
- تعویض‌کنندهٔ پورت در tray (`20128`، `3000`، `8080`) سرور را متوقف و دوباره راه‌اندازی می‌کند،
  سپس BrowserWindow را بازنشانی می‌کند.

## bootstrap راز بدون پیکربندی

در اولین راه‌اندازی، فرایند اصلی رازهای گمشده را به‌طور خودکار تولید و ذخیره می‌کند:

| راز                     | منبع                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `JWT_SECRET`            | `crypto.randomBytes(64).toString("hex")`                                            |
| `STORAGE_ENCRYPTION_KEY` | `crypto.randomBytes(32).toString("hex")` (در صورت وجود credentialهای رمزنگاری‌شده، امتناع می‌کند) |
| `API_KEY_SECRET`        | `crypto.randomBytes(32).toString("hex")`                                            |

در `<DATA_DIR>/server.env` ذخیره می‌شود. `DATA_DIR` به این صورت تحلیل می‌شود:

- ویندوز: `%APPDATA%\omniroute`
- لینوکس: `$XDG_CONFIG_HOME/omniroute` یا `~/.omniroute`
- macOS: `~/.omniroute`

## پنجره و Tray

- `BrowserWindow`: 1400×900 (حداقل 1024×700)، `backgroundColor: "#0a0a0a"`.
- macOS: `titleBarStyle: "hiddenInset"`، چراغ‌های ترافیکی در `{ x: 16, y: 16 }`.
- ویندوز/لینوکس: نوار عنوان بومی.
- دکمهٔ بستن به tray کمینه می‌کند؛ منوی tray شامل **Open OmniRoute**، **Open Dashboard**
  (مرورگر خارجی)، زیرمنوی **Server Port**، **Check for Updates**، **Quit** است.

## Content Security Policy

از طریق `session.defaultSession.webRequest.onHeadersReceived` تنظیم می‌شود. دستورالعمل‌های برجسته:

- `frame-ancestors 'none'`، `object-src 'none'`، `child-src 'none'`
- `connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://*.omniroute.online https://*.omniroute.dev`
- حالت dev تنها `'unsafe-eval'` را به `script-src` اضافه می‌کند

## به‌روزرسانی خودکار

از `electron-updater` با provider مربوط به GitHub (`diegosouzapw/OmniRoute`) استفاده می‌کند.

- `autoDownload = false`، `autoInstallOnAppQuit = true`
- رویدادها از طریق IPC `update-status` به renderer forward می‌شوند:
  `checking`، `available`، `not-available`، `downloading` (با `percent`)، `downloaded`، `error`
- `installUpdate()` سرور را kill می‌کند سپس `autoUpdater.quitAndInstall()` را فراخوانی می‌کند
- در حالت dev نادیده گرفته می‌شود (`!app.isPackaged`)

## خط لولهٔ ساخت

1. `npm run build` → Next.js standalone در `.next/standalone`.
2. `prepare-electron-standalone.mjs` → بازچیدمان در `.next/electron-standalone` و بازنویسی
   مسیرهای مطلق درون `server.js` + `required-server-files.json` تا بسته قابل جابجایی شود.
3. `electron-builder` بسته‌بندی `main.js`، `preload.js`، `node_modules` و
   `extraResources: { ../.next/electron-standalone → app }`.

### targetهای ساخت

| سیستم‌عامل | targetها                                 |
| --------- | ---------------------------------------- |
| ویندوز    | نصب‌کنندهٔ NSIS + portable (x64)         |
| macOS     | DMG (Intel + arm64، کشیدن به Applications) |
| لینوکس    | AppImage + DEB (x64 + arm64)             |

تنظیمات NSIS: `oneClick: false`، به کاربر اجازه می‌دهد شاخهٔ نصب را انتخاب کند، میان‌برهای
دسکتاپ و منوی استارت ایجاد می‌کند.

## آزمون دود بستهٔ packageشده

```bash
npm run electron:smoke:packaged
```

`scripts/dev/smoke-electron-packaged.mjs`:

- باینری packageشده را در `electron/dist-electron/` برای پلتفرم فعلی به‌طور خودکار کشف می‌کند.
- با شاخه‌های ایزولهٔ `HOME`/`APPDATA`/`XDG_*` راه‌اندازی می‌کند تا به دادهٔ توسعه‌دهنده دست نزند.
- `http://127.0.0.1:20128/login` را طی ۴۵ ثانیه برای HTTP 200 poll می‌کند.
- stderr/stdout را برای الگوهای مهلک (`Cannot find module`، `MODULE_NOT_FOUND`،
  `ERR_DLOPEN_FAILED`، `Failed to start server` و...) می‌بیند.
- ۲ ثانیه زمان اجرای پایدار پس از آمادگی صبر می‌کند، سپس SIGTERM می‌فرستد و منتظر آزاد
  شدن پورت می‌ماند.
- در CI، به‌طور خودکار `--no-sandbox --disable-gpu` (و `--disable-dev-shm-usage` روی لینوکس)
  را اضافه می‌کند.

بازنویسی‌های env: `ELECTRON_SMOKE_APP_EXECUTABLE`، `ELECTRON_SMOKE_URL`،
`ELECTRON_SMOKE_TIMEOUT_MS`، `ELECTRON_SMOKE_SETTLE_MS`، `ELECTRON_SMOKE_DATA_DIR`،
`ELECTRON_SMOKE_KEEP_DATA`، `ELECTRON_SMOKE_STREAM_LOGS`.

## امضای کد

`electron/package.json` مستقیماً credentialهای امضا را سیم‌کشی **نمی‌کند**. آنها را از طریق
متغیرهای env به `electron-builder` پاس دهید:

### macOS

```bash
export APPLE_ID=<email>
export APPLE_APP_SPECIFIC_PASSWORD=<password>
export APPLE_TEAM_ID=<id>
export CSC_LINK=path/to/cert.p12
export CSC_KEY_PASSWORD=<cert-password>
npm run electron:build:mac
```

### ویندوز

```bash
export CSC_LINK=path/to/cert.pfx
export CSC_KEY_PASSWORD=<cert-password>
npm run electron:build:win
```

### لینوکس

امضای AppImage اختیاری است — در صورت امضا `LINUX_GPG_KEY` را تنظیم کنید.

## توزیع

مصنوعات در `electron/dist-electron/` قرار می‌گیرند:

- `OmniRoute Setup X.Y.Z.exe`، `OmniRoute-X.Y.Z-portable.exe` (ویندوز)
- `OmniRoute-X.Y.Z-mac.dmg`، `OmniRoute-X.Y.Z-arm64-mac.dmg` (macOS)
- `OmniRoute-X.Y.Z.AppImage`، `omniroute-desktop_X.Y.Z_amd64.deb` (لینوکس)

انتشارات در GitHub Releases (`diegosouzapw/OmniRoute`) منتشر می‌شوند، که همان جایی است
که `electron-updater` نسخه‌های جدید را بررسی می‌کند.

## رفع اشکال

| علامت                                                           | راه‌حم                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Cannot find module 'better-sqlite3'` پس از ارتقای major الکترون | `cd electron && npm rebuild`                                                |
| `ERR_DLOPEN_FAILED` برای ماژول بومی                              | `prepare:bundle` را دوباره اجرا کنید و ABI منطبق با Node الکترون را تأیید کنید |
| پنجره روی لینوکس خالی ظاهر می‌شود                                | تأیید کنید که سرور Next.js واقعاً به PORT متصل شده (لاگ‌های `[Server]` را بررسی کنید) |
| توقف notarization مربوط به macOS                                 | مطمئن شوید `APPLE_*` متغیرها export شده‌اند، نه فقط در `.env`               |
| هشدار SmartScreen ویندوز                                         | با گواهی EV امضا کنید، یا کاربران راست‌کلیک → "Run anyway"                   |
| شکست آزمون دود با پورت اشغال‌شده                                 | قبل از اجرای `electron:smoke:packaged` هر سرور dev محلی روی 20128 را متوقف کنید |

## مطالعهٔ بیشتر

- [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- [RELEASE_CHECKLIST.md](../ops/RELEASE_CHECKLIST.md)
- منبع: `electron/main.js`، `electron/preload.js`، `electron/package.json`
- helperها: `scripts/build/prepare-electron-standalone.mjs`، `scripts/dev/smoke-electron-packaged.mjs`
