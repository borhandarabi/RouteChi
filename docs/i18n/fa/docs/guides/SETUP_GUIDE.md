---
title: "📖 راهنمای راه‌اندازی — OmniRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# 📖 راهنمای راه‌اندازی — OmniRoute

> مرجع کامل راه‌اندازی OmniRoute. برای نسخهٔ کوتاه، [Quick Start در README](../README.md#-quick-start) را ببینید.

## فهرست مطالب

- [روش‌های نصب](#روش‌های-نصب)
- [پیکربندی ابزار CLI](#پیکربندی-ابزار-cli)
- [راه‌اندازی پروتکل (MCP + A2A)](#راه‌اندازی-پروتکل-mcp--a2a)
- [پیکربندی timeout](#پیکربندی-timeout)
- [حالت Split-Port](#حالت-split-port)
- [Void Linux (xbps-src)](#void-linux-xbps-src-template)
- [حذف نصب](#حذف-نصب)

---

## روش‌های نصب

### npm (پیشنهادی)

```bash
npm install -g omniroute
omniroute
```

داشبورد در `http://localhost:20128` باز می‌شود و URL پایهٔ API برابر `http://localhost:20128/v1` است.

### pnpm

```bash
pnpm add -g omniroute@latest --allow-build=better-sqlite3 --allow-build=@swc/core
omniroute
```

> **کاربران pnpm:** پرچم `--allow-build` برای فعال‌سازی اسکریپت‌های build بومی برای `better-sqlite3` و `@swc/core` لازم است. دستور `pnpm approve-builds -g` برای نصب‌های سراسری روی pnpm v11 پشتیبانی نمی‌شود.

### Arch Linux (AUR)

```bash
yay -S omniroute-bin
systemctl --user enable --now omniroute.service
```

[بستهٔ AUR](https://aur.archlinux.org/packages/omniroute-bin) OmniRoute را نصب کرده و یک سرویس systemd کاربر ارائه می‌دهد.

### از کدمنبع

```bash
npm install
PORT=20128 DASHBOARD_PORT=20129 NEXT_PUBLIC_BASE_URL=http://localhost:20129 npm run dev
```

> **نکته:** `npm install` در اولین اجرا به‌صورت خودکار `.env` را از `.env.example` تولید می‌کند. نصب‌های بعدی یک `.env` موجود را بازنویسی نمی‌کنند، بنابراین سفارشی‌سازی‌ها حفظ می‌شوند. برای بازتولید، پیش از اجرای مجدد `.env` را حذف کنید.

### Docker

برای راه‌اندازی کامل Docker شامل profileهای Compose و HTTPS با Caddy به [Docker Guide](./DOCKER_GUIDE.md) مراجعه کنید.

### اپ دسکتاپ (Electron)

OmniRoute یک wrapper دسکتاپ مبتنی بر Electron 41 + electron-builder 26.10 عرضه می‌کند. اسکریپت‌های موجود (ریشهٔ workspace):

```bash
npm run electron:dev          # اجرای دسکتاپ با hot-reload
npm run electron:build        # build برای سیستم‌عامل فعلی (تشخیص خودکار)
npm run electron:build:win    # نصب‌کنندهٔ ویندوز (NSIS + portable)
npm run electron:build:mac    # macOS (dmg + zip، arm64+x64)
npm run electron:build:linux  # لینوکس (AppImage + deb + rpm)
npm run electron:smoke:packaged  # تست دود build بسته‌بندی‌شده
```

نسخه‌های نصب‌کنندهٔ دسکتاپ به GitHub Releases پیوست می‌شوند. برای بررسی عمیق کامل Electron (امضا، پل IPC، توزیع‌ها)، به [`ELECTRON_GUIDE.md`](./ELECTRON_GUIDE.md) مراجعه کنید.

### سرور بدون headless (CI/اتوماسیون)

برای راه‌اندازی بدون نظارت (Docker، Kubernetes، CI)، از:

```bash
omniroute setup --non-interactive
omniroute providers test-batch
```

ترکیب با متغیرهای محیطی (`INITIAL_PASSWORD`، `OMNIROUTE_WS_BRIDGE_SECRET` و غیره)، به شما اجازه می‌دهد یک نمونهٔ OmniRoute کاملاً قابل اسکریپت‌نویسی راه‌اندازی کنید.

### گزینه‌های CLI

| دستور                   | توضیح                                                    |
| ----------------------- | --------------------------------------------------------- |
| `omniroute`             | راه‌اندازی سرور (`PORT=20128`، API و داشبورد روی یک پورت)    |
| `omniroute setup`       | onboarding تعاملی CLI برای گذرواژه و اولین ارائه‌دهنده          |
| `omniroute doctor`      | اجرای بررسی‌های سلامت محلی بدون راه‌اندازی سرور            |
| `omniroute providers`   | کشف، فهرست، اعتبارسنجی و تست ارائه‌دهندگان از CLI          |
| `omniroute config`      | پیکربندی ابزار CLI — فهرست، get، set، اعتبارسنجی پیکربندی‌ها      |
| `omniroute status`      | داشبورد وضعیت آفلاین — نسخه، DB، ابزارها، پیکربندی          |
| `omniroute logs`        | استریم لاگ‌های استفاده از API (پشتیبانی از `--follow`)           |
| `omniroute update`      | بررسی یا اعمال به‌روزرسانی‌های OmniRoute                           |
| `omniroute provider`    | مدیریت اتصالات ارائه‌دهنده — افزودن، فهرست، حذف، تست، پیش‌فرض |
| `omniroute --port 3000` | تنظیم پورت canonical/API روی ۳۰۰۰                                 |
| `omniroute --mcp`       | راه‌اندازی سرور MCP (انتقال stdio)                             |
| `omniroute --no-open`   | مرورگر به‌صورت خودکار باز نشود                                        |
| `omniroute --help`      | نمایش راهنما                                                      |

راه‌اندازی بدون headless می‌تواند با پرچم‌ها یا متغیرهای محیطی اسکریپت‌نویسی شود:

```bash
omniroute setup --non-interactive --password "$OMNIROUTE_PASSWORD"
omniroute setup --non-interactive --add-provider --provider openai --api-key "$OPENAI_API_KEY"
omniroute setup --non-interactive --add-provider --provider openai --api-key "$OPENAI_API_KEY" --test-provider
```

تشخیص‌های محلی را بدون باز کردن داشبورد اجرا کنید:

```bash
omniroute doctor
omniroute doctor --json
omniroute doctor --no-liveness
```

ارائه‌دهندگان را از SSH یا اسکریپت بدون باز کردن داشبورد مدیریت کنید:

```bash
omniroute providers available
omniroute providers available --search openai
omniroute providers available --category api-key
omniroute providers list
omniroute providers test <id-or-name>
omniroute providers test-all
omniroute providers validate
```

---

## پیکربندی ابزار CLI

### ۱) اتصال ارائه‌دهندگان و ایجاد کلید API

1. داشبورد → `Providers` را باز کنید و حداقل یک ارائه‌دهنده (OAuth یا کلید API) متصل کنید.
2. داشبورد → `Endpoints` را باز کنید و یک کلید API ایجاد کنید.
3. (اختیاری) داشبورد → `Combos` را باز کنید و زنجیرهٔ fallback خود را تنظیم کنید.

### ۲) اشاره ابزار کدنویسی شما

```txt
Base URL: http://localhost:20128/v1
API Key:  [از صفحهٔ Endpoint کپی کنید]
Model:    if/kimi-k2-thinking (یا هر پیشوند provider/model)
```

اگر ویرایشگر شما نمی‌تواند `Authorization: Bearer ...` ارسال کند، از base سازگار tokenized استفاده کنید:

```txt
Base URL: http://localhost:20128/api/v1/vscode/YOUR_KEY/
Models URL: http://localhost:20128/api/v1/vscode/YOUR_KEY/models
Chat URL: http://localhost:20128/api/v1/vscode/YOUR_KEY/chat/completions
Ollama Tags URL: http://localhost:20128/api/v1/vscode/YOUR_KEY/api/tags
```

با Claude Code، Codex CLI، Cursor، Cline، OpenClaw، OpenCode و SDKهای سازگار با OpenAI کار می‌کند.

#### پیکربندی خودکار با `setup-*`

به‌جای اینکه URL پایه و کلید را دستی جای‌گذاری کنید، اجازه دهید OmniRoute فایل پیکربندی هر ابزار را از کاتالوگ مدل زنده بنویسد. یک دستور به ازای هر ابزار:

```bash
omniroute setup-codex        # پروفایل‌های ~/.codex/<name>.config.toml
omniroute setup-claude       # ~/.claude/profiles/<name>/settings.json
omniroute setup-opencode     # ~/.config/opencode/opencode.json (سازگار با openai)
omniroute setup-cline        # تنظیمات Cline CLI + افزونهٔ VS Code
omniroute setup-kilo         # Kilo Code
omniroute setup-continue     # ~/.continue/config.yaml (Continue / cn)
omniroute setup-cursor       # مراحل درون‌برنامه‌ای Cursor را چاپ می‌کند
omniroute setup-roo          # import Roo Code + pointer autoImport
omniroute setup-crush        # ~/.config/crush/crush.json
omniroute setup-goose        # ~/.config/goose/config.yaml
omniroute setup-qwen         # ~/.qwen/settings.json
omniroute setup-aider        # ~/.aider.conf.yml
```

هر کدام `--remote <url> --api-key <key>` را برای پیکربندی یک ابزار محلی در برابر یک OmniRoute **دوردست** می‌پذیرد، به‌علاوهٔ `--dry-run` برای پیش‌نمایش. راه‌اندازهای `omniroute launch` (Claude Code) و `omniroute launch-codex` (Codex) CLI را با env درست تزریق‌شده spawn می‌کنند و اصلاً هیچ پیکربندی نمی‌نویسند.

برای جدول کامل (آنچه هر دستور می‌نویسد، هر پرچم، محلی در برابر دوردست، قراردادهای `/v1` base-URL)، به **[CLI Integrations](./CLI-INTEGRATIONS.md)** مراجعه کنید.

برای پیکربندی تفصیلی به ازای هر ابزار (Claude Code، Codex CLI، Cursor، Cline، OpenClaw، Kilo Code، Copilot و بیشتر)، به **[CLI Tools Guide](../reference/CLI-TOOLS.md)** اختصاصی مراجعه کنید.

---

## راه‌اندازی پروتکل (MCP + A2A)

### راه‌اندازی MCP (Model Context Protocol)

انتقال MCP را در حالت stdio راه‌اندازی کنید:

```bash
omniroute --mcp
```

جریان اعتبارسنجی پیشنهادی:

```bash
# ۱. راه‌اندازی سرور MCP
omniroute --mcp

# ۲. از کلاینت MCP خود، فراخوانی کنید:
omniroute_get_health        # باید سلامت سیستم را برگرداند
omniroute_list_combos       # باید comboهای فعال را برگرداند

# ۳. یا اجرای مجموعهٔ کامل E2E:
npm run test:protocols:e2e
```

#### پیکربندی کلاینت MCP

**Claude Code:**

```bash
claude mcp add-server omniroute --type http --url http://localhost:20128/api/mcp/stream
```

**Cursor / Cline:**

به تنظیمات MCP خود اضافه کنید:

```json
{
  "mcpServers": {
    "omniroute": {
      "command": "omniroute",
      "args": ["--mcp"],
      "env": {}
    }
  }
}
```

**مستندات کامل MCP:** [MCP Server README](../../open-sse/mcp-server/README.md) — ۸۷ ابزار، پیکربندی‌های IDE، کلاینت‌های Python/TS/Go.

### راه‌اندازی A2A (پروتکل Agent-to-Agent)

تأیید Agent Card:

```bash
curl http://localhost:20128/.well-known/agent.json
```

ارسال یک وظیفه:

```bash
curl -X POST http://localhost:20128/a2a \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"quickstart","method":"message/send","params":{"skill":"quota-management","messages":[{"role":"user","content":"Give me a short quota summary."}]}}'
```

**مستندات کامل A2A:** [A2A Server README](../../src/lib/a2a/README.md) — JSON-RPC 2.0، مهارت‌ها، استریم، چرخه‌حیات وظیفه.

---

## پیکربندی timeout

### timeoutهای پایه

برای اکثر استقرارها، تنها به این دو متغیر نیاز دارید:

| متغیر                   | پیش‌فرض                       | هدف                                                                                                                                      |
| ------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `REQUEST_TIMEOUT_MS`     | `600000`                      | پایهٔ مشترک برای timeout شروع پاسخ upstream، timeoutهای پنهان Undici، درخواست‌های fingerprint TLS، و timeoutهای درخواست/پروکسی API bridge |
| `STREAM_IDLE_TIMEOUT_MS` | ارث‌بری از `REQUEST_TIMEOUT_MS` | حداکثر فاصلهٔ بین chunkهای استریم پیش از آنکه OmniRoute جریان SSE را قطع کند                                                                  |

سازگاری به‌عقب حفظ شده: `FETCH_TIMEOUT_MS`، `API_BRIDGE_PROXY_TIMEOUT_MS` و سایر متغیرهای timeout به‌ازای-لایه‌ موجود همچنان کار می‌کنند و پایهٔ مشترک را بازنویسی می‌کنند.

### نکات خاص ارائه‌دهنده

برای upstreamهای سازگار با Claude Code (`anthropic-compatible-cc-*`)، OmniRoute هدر خروجی `X-Stainless-Timeout` را از timeout fetch حل‌شده مشتق می‌کند تا timeoutهای خواندن سمت ارائه‌دهنده با پیکربندی env شما هم‌راستا بمانند.

برای پروکسی‌های معکوس شخص ثالث سازگار با Claude Code، OmniRoute مجموعهٔ `anthropic-beta` پیش‌فرض را محافظه‌کارانه نگه می‌دارد و هنگامی که `Client Cache Control` روی `Auto` است، تنها نشانگرهای `cache_control` ارائه‌شده توسط کلاینت را ارسال می‌کند. فعال‌سازی toggle هر-اتصال "Enable redact-thinking beta" تنها زمانی ضروری است که upstream به‌طور خاص به جریان‌های تفکر Claude redact‌شده نیاز داشته باشد.

### بازنویسی‌های پیشرفتهٔ timeout

| متغیر                                 | پیش‌فرض                                    | هدف                                                              |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `FETCH_TIMEOUT_MS`                       | ارث‌بری از `REQUEST_TIMEOUT_MS`              | timeout شروع پاسخ upstream تا رسیدن هدرهای پاسخ   |
| `FETCH_HEADERS_TIMEOUT_MS`               | ارث‌بری از `FETCH_TIMEOUT_MS`                | محدودیت زمان Undici برای دریافت هدرهای پاسخ upstream            |
| `FETCH_BODY_TIMEOUT_MS`                  | ارث‌بری از `FETCH_TIMEOUT_MS`                | محدودیت زمان Undici بین chunkهای بدنهٔ upstream (`0` غیرفعال می‌کند)     |
| `FETCH_CONNECT_TIMEOUT_MS`               | `30000`                                    | timeout اتصال TCP Undici                                           |
| `FETCH_KEEPALIVE_TIMEOUT_MS`             | `4000`                                     | timeout سوکت keep-alive بیکار Undici                                |
| `TLS_CLIENT_TIMEOUT_MS`                  | ارث‌بری از `FETCH_TIMEOUT_MS`                | timeout برای درخواست‌های fingerprint TLS از طریق `wreq-js`          |
| `API_BRIDGE_PROXY_TIMEOUT_MS`            | ارث‌بری از `REQUEST_TIMEOUT_MS` یا `600000`  | timeout برای forward پروکسی `/v1` از پورت API به پورت داشبورد   |
| `API_BRIDGE_SERVER_REQUEST_TIMEOUT_MS`   | `max(API_BRIDGE_PROXY_TIMEOUT_MS, 300000)` | timeout درخواست ورودی روی سرور API bridge                    |
| `API_BRIDGE_SERVER_HEADERS_TIMEOUT_MS`   | `60000`                                    | timeout هدر ورودی روی سرور API bridge                     |
| `API_BRIDGE_SERVER_KEEPALIVE_TIMEOUT_MS` | `5000`                                     | timeout keep-alive روی سرور API bridge                          |
| `API_BRIDGE_SERVER_SOCKET_TIMEOUT_MS`    | `0`                                        | timeout بی‌تحری سوکت روی سرور API bridge (`0` غیرفعال می‌کند) |

> **نکته:** برای درخواست‌های استریم، `FETCH_TIMEOUT_MS` تنها راه‌اندازی اتصال / انتظار برای اولین پاسخ upstream را پوشش می‌دهد. هنگامی که استریم فعال است، OmniRoute تنها بر یک stall واقعی (`STREAM_IDLE_TIMEOUT_MS`) یا بی‌تحری بدنهٔ Undici (`FETCH_BODY_TIMEOUT_MS`) قطع می‌شود.

### سازگاری پروکسی معکوس

اگر OmniRoute را پشت Nginx، Caddy، Cloudflare یا یک پروکسی معکوس دیگر اجرا می‌کنید، اطمینان حاصل کنید timeoutهای پروکسی نیز بزرگ‌تر از timeoutهای استریم/fetch OmniRoute شما هستند.

---

## حالت Split-Port

API و داشبورد را برای سناریوهای پیشرفته (پروکسی معکوس، شبکه‌بندی کانتینر) روی پورت‌های جداگانه اجرا کنید:

```bash
PORT=20128 DASHBOARD_PORT=20129 omniroute
# API:       http://localhost:20128/v1
# Dashboard: http://localhost:20129
```

---

## قالب Void Linux (xbps-src)

کاربران Void Linux می‌توانند با استفاده از `xbps-src` یک بستهٔ بومی بسازند. این بلوک را به‌صورت `srcpkgs/omniroute/template` ذخیره کنید:

```bash
# Template file for 'omniroute'
pkgname=omniroute
version=3.8.0
revision=1
hostmakedepends="nodejs python3 make"
depends="openssl"
short_desc="Universal AI gateway with smart routing for multiple LLM providers"
maintainer="zenobit <zenobit@disroot.org>"
license="MIT"
homepage="https://github.com/diegosouzapw/OmniRoute"
distfiles="https://github.com/diegosouzapw/OmniRoute/archive/refs/tags/v${version}.tar.gz"
# Regenerate the checksum for each release with:
#   curl -L -o /tmp/omniroute.tar.gz "https://github.com/diegosouzapw/OmniRoute/archive/refs/tags/v${version}.tar.gz" && sha256sum /tmp/omniroute.tar.gz
checksum=PLACEHOLDER_REGENERATE_PER_RELEASE
system_accounts="_omniroute"
omniroute_homedir="/var/lib/omniroute"
export NODE_ENV=production
export npm_config_engine_strict=false
export npm_config_loglevel=error
export npm_config_fund=false
export npm_config_audit=false

do_build() {
        local _gyp_arch
        case "$XBPS_TARGET_MACHINE" in
                aarch64*) _gyp_arch=arm64 ;;
                armv7*|armv6*) _gyp_arch=arm ;;
                i686*) _gyp_arch=ia32 ;;
                *) _gyp_arch=x64 ;;
        esac

        NODE_ENV=development npm ci --ignore-scripts
        npm run build
        cp -r .next/static .next/standalone/.next/static
        [ -d public ] && cp -r public .next/standalone/public || true

        local _node_gyp=/usr/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js
        (cd node_modules/better-sqlite3 && node "$_node_gyp" rebuild --arch="$_gyp_arch")

        local _bs3_release=.next/standalone/node_modules/better-sqlite3/build/Release
        mkdir -p "$_bs3_release"
        cp node_modules/better-sqlite3/build/Release/better_sqlite3.node "$_bs3_release/"

        rm -rf .next/standalone/node_modules/@img

        for _mod in pino-abstract-transport split2 process-warning; do
                cp -r "node_modules/$_mod" .next/standalone/node_modules/
        done
}

do_check() {
        npm run test:unit
}

do_install() {
        vmkdir usr/lib/omniroute/.next
        vcopy .next/standalone/. usr/lib/omniroute/.next/standalone

        for _d in \
                .next/standalone/.next/server/app/dashboard \
                .next/standalone/.next/server/app/dashboard/settings \
                .next/standalone/.next/server/app/dashboard/providers; do
                touch "${DESTDIR}/usr/lib/omniroute/${_d}/.keep"
        done

        cat > "${WRKDIR}/omniroute" <<'EOF'
#!/bin/sh
export PORT="${PORT:-20128}"
export DATA_DIR="${DATA_DIR:-${XDG_DATA_HOME:-${HOME}/.local/share}/omniroute}"
export APP_LOG_TO_FILE="${APP_LOG_TO_FILE:-false}"
mkdir -p "${DATA_DIR}"
exec node /usr/lib/omniroute/.next/standalone/server.js "$@"
EOF
        vbin "${WRKDIR}/omniroute"
}

post_install() {
        vlicense LICENSE
}
```

---

## حذف نصب

| دستور                  | اقدام                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `npm run uninstall`      | اپ سیستم را حذف می‌کند اما **DB و پیکربندی‌های شما** را در `~/.omniroute` نگه می‌دارد.  |
| `npm run uninstall:full` | اپ را حذف و به‌طور دائم **همهٔ پیکربندی‌ها، کلیدها و پایگاه‌داده‌ها را پاک می‌کند**. |

> برای دستورالعمل‌های تفصیلی حذف نصب در همهٔ روش‌ها، به [UNINSTALL.md](./UNINSTALL.md) مراجعه کنید.
