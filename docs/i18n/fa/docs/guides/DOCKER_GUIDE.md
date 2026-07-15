---
title: "🐳 راهنمای Docker — RouteChi"
version: 3.8.40
lastUpdated: 2026-06-28
---

# 🐳 راهنمای Docker — RouteChi

> مرجع کامل استقرار Docker. برای شروع سریع، به [بخش Docker در README](../README.md#-docker) مراجعه کنید.

## فهرست مطالب

- [اجرای سریع](#quick-run)
- [با فایل متغیر محیطی](#with-environment-file)
- [Docker Compose](#docker-compose)
- [پروفایل‌های موجود](#available-profiles)
- [Redis Sidecar](#redis-sidecar)
- [Compose تولیدی](#production-compose)
- [مراحل Dockerfile](#dockerfile-stages)
- [متغیرهای محیطی حیاتی](#critical-environment-variables)
- [Docker Compose با Caddy (HTTPS)](#docker-compose-with-caddy-https-auto-tls)
- [Cloudflare Quick Tunnel](#cloudflare-quick-tunnel)
- [تگ‌های ایمیج](#image-tags)
- [یادداشت‌های مهم](#important-notes)

---

## اجرای سریع

```bash
docker run -d \
  --name omniroute \
  --restart unless-stopped \
  --stop-timeout 40 \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  diegosouzapw/omniroute:latest
```

## با فایل متغیر محیطی

```bash
# Copy and edit .env first
cp .env.example .env

docker run -d \
  --name omniroute \
  --restart unless-stopped \
  --stop-timeout 40 \
  --env-file .env \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  diegosouzapw/omniroute:latest
```

## Docker Compose

```bash
# Base profile (no CLI tools)
docker compose --profile base up -d

# CLI profile (Claude Code, Codex, OpenClaw built-in)
docker compose --profile cli up -d

# Host profile (Linux-first; mounts host CLI binaries read-only)
docker compose --profile host up -d

# Combine CLI + CLIProxyAPI sidecar
docker compose --profile cli --profile cliproxyapi up -d
```

## پروفایل‌های موجود

RouteChi چهار پروفایل Compose ارائه می‌دهد. آنچه با محیط شما سازگار است را انتخاب کنید.

| پروفایل         | سرویس           | چه زمان استفاده کنید                                                                                                              | دستور                                       |
| --------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `base` (پیش‌فرض) | `omniroute-base` | سرور headless / زمان‌اجرا Minimum، بدون CLIهای ارائه‌دهنده                                                                          | `docker compose --profile base up -d`       |
| `cli`           | `omniroute-cli`  | گردش‌کاری‌های agentic که `omniroute providers/setup/doctor` و CLIهای همراه (Codex، Claude Code، Droid، OpenClaw) را فراخوانی می‌کنند | `docker compose --profile cli up -d`        |
| `host`          | `omniroute-host` | میزبان‌های لینوکسی که می‌خواهند با mount کردن `~/.local/bin`، `~/.codex`، `~/.claude` و... به‌صورت فقط‌خواندنی، دسترسی network_mode مانند به CLIهای میزبان داشته باشند | `docker compose --profile host up -d`       |
| `cliproxyapi`   | `cliproxyapi`    | اجرای sidecar مربوط به [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) روی پورت `8317` برای پروکسی بالادست CLI            | `docker compose --profile cliproxyapi up -d` |

> می‌توان چند پروفایل را ترکیب کرد: `docker compose --profile cli --profile cliproxyapi up -d`.

## Redis Sidecar

RouteChi برای پشتیبانی از rate limiter توزیع‌شده و کش مشترک به Redis وابسته است. سرویس
`redis` **همیشه در `docker-compose.yml` تعریف می‌شود** (هیچ پروفایل‌گری ندارد) و در کنار
هر پروفایل دیگری راه‌اندازی می‌شود.

| جزئیات             | مقدار                            |
| ------------------ | -------------------------------- |
| ایمیج              | `redis:7-alpine`                 |
| نام کانتینر        | `omniroute-redis`                |
| پورت داخلی         | `6379`                           |
| پورت میزبان (بازنویسی) | `REDIS_PORT` (پیش‌فرض `6379`)    |
| Volume             | `omniroute-redis-data` → `/data` |
| Healthcheck        | `redis-cli ping` (فاصلهٔ ۱۰ ثانیه) |

متغیرهای محیطی مرتبط:

- `REDIS_URL` — رشتهٔ اتصال به برنامه تزریق می‌شود (`redis://redis:6379` به‌صورت پیش‌فرض).
- `REDIS_PORT` — نگاشت پورت سمت میزبان برای کانتینر Redis.

**غیرفعال کردن Redis** توصیه نمی‌شود (rate limiter به fallback حافظه‌محلی تنزل می‌یابد).
اگر مجبورید، یا بلوک سرویس `redis:` را در `docker-compose.yml` حذف/کامنت کنید یا آن را
به صفر scale کنید:

```bash
docker compose up -d --scale redis=0
```

## Compose تولیدی

برای یک تصویر تولیدی ایزوله که در کنار dev اجرا می‌شود، از `docker-compose.prod.yml` استفاده کنید.

| جزئیات                | مقدار                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| فایل                  | `docker-compose.prod.yml`                                                          |
| پورت پیش‌فرض داشبورد   | `PROD_DASHBOARD_PORT=20130` (نگاشت به `${DASHBOARD_PORT:-20128}` داخلی)            |
| پورت پیش‌فرض API       | `PROD_API_PORT=20131`                                                              |
| ایمیج                 | `omniroute:prod` (ساخته‌شده از target `runner-cli`)                                |
| کانتینر Redis         | `omniroute-redis-prod` (`redis:8.6.2`، volume اختصاصی `redis-prod-data`)           |
| Volume داده           | `omniroute-prod-data` (نام‌دار، در میان بازسازی‌ها ماندگار است)                       |
| Healthcheckها         | `node healthcheck.mjs` + `redis-cli ping`، با `depends_on` گیت‌شده بر اساس سلامت Redis |

نحوهٔ استفاده:

```bash
# Build & start the production stack
docker compose -f docker-compose.prod.yml up -d --build

# Stream logs
docker compose -f docker-compose.prod.yml logs -f

# Tear down (keep volumes)
docker compose -f docker-compose.prod.yml down
```

این استک تولیدی موازی با compose توسعه اجرا می‌شود (نام‌های کانتینر، پورت‌ها و volumeهای
متفاوت)، تا بتوانید در حالی که تولید فعال است، محلی تکرار کنید.

## مراحل Dockerfile

مخزن یک Dockerfile چندمرحله‌ای (`Dockerfile`) ارائه می‌دهد. سه مرحله نمایان است؛
`target` مناسب برای مورد استفادهٔ خود را انتخاب کنید.

| مرحله         | ایمیج پایه                 | هدف                                                                                                                                                                |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `builder`     | `node:24.15.0-trixie-slim` | نصب وابستگی‌ها (`npm ci --legacy-peer-deps`) و اجرای `npm run build -- --webpack`                                                                                  |
| `runner-base` | `node:24.15.0-trixie-slim` | زمان اجرای تولیدی با خروجی standalone مربوط به Next.js. **بدون CLIهای ارائه‌دهنده.**                                                                               |
| `runner-cli`  | `runner-base`              | افزودن `git`، `docker.io`، `docker-compose` و CLIهای سراسری: `@openai/codex`، `@anthropic-ai/claude-code`، `droid`، `openclaw`. **برای گردش‌کاری‌های agentic این را انتخاب کنید.** |

ساختن یک target خاص به‌صورت دستی:

```bash
docker build --target runner-base -t omniroute:base .
docker build --target runner-cli  -t omniroute:cli  .
```

پیش‌فرض‌های صادرشده توسط `runner-base`: `PORT=20128`، `HOSTNAME=0.0.0.0`،
`NODE_OPTIONS=--max-old-space-size=512`، `DATA_DIR=/app/data`، `OMNIROUTE_MIGRATIONS_DIR=/app/migrations`.

رفتار حافظه در Docker:

- `NODE_OPTIONS=--max-old-space-size=512` به‌عنوان fallback در ایمیج تعبیه شده است.
- فرایند سرور در واقع توسط راه‌انداز standalone شروع می‌شود که `OMNIROUTE_MEMORY_MB`
  را می‌خواند و `--max-old-space-size=<OMNIROUTE_MEMORY_MB>` را اضافه می‌کند.
- Node از آخرین مقدار تکرارشدهٔ `--max-old-space-size` استفاده می‌کند، بنابراین تنظیم
  `OMNIROUTE_MEMORY_MB` سقف heap مؤثر در Docker را کنترل می‌کند.
- اگر `OMNIROUTE_MEMORY_MB` تنظیم نشود، راه‌انداز از `512` استفاده می‌کند.

## متغیرهای محیطی حیاتی

علاوه بر پیش‌فرض‌های مستندشده در [ENVIRONMENT.md](../reference/ENVIRONMENT.md)، متغیرهای
زیر در اجرا تحت Docker اهمیت بیشتری دارند:

| متغیر                        | هدف                                                                                                | پیش‌فرض                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------ |
| `OMNIROUTE_WS_BRIDGE_SECRET` | راز مشترک برای پل WebSocket. **در محیط تولیدی الزامی است** — به یک رشتهٔ تصادفی قوی تنظیم کنید.    | تنظیم‌نشده (باید ارائه شود) |
| `REDIS_URL`                  | رشتهٔ اتصال برای backend مربوط به rate limiter / کش                                                 | `redis://redis:6379`     |
| `REDIS_PORT`                 | پورت سمت میزبان برای کانتینر Redis همراه                                                            | `6379`                   |
| `AUTO_UPDATE_HOST_REPO_DIR`  | مسیر میزبان mount شده در پروفایل `cli` به `/workspace/omniroute` برای گردش‌کاری‌های self-update     | `.` (شاخهٔ جاری)         |
| `OMNIROUTE_MEMORY_MB`        | سقف heap زمان اجرا Node برای سرور standalone مربوط به Docker؛ بر fallback ایمیج بالا بازنویسی می‌کند | `512`                    |
| `DASHBOARD_PORT` / `API_PORT` | بازنویسی پورت‌های نمایان برای داشبورد (20128) و API (20129)                                          | `20128` / `20129`        |
| `PROD_DASHBOARD_PORT`        | پورت داشبورد سمت میزبان برای `docker-compose.prod.yml`                                              | `20130`                  |
| `CLIPROXYAPI_PORT`           | پورت سمت میزبان برای sidecar `cliproxyapi`                                                          | `8317`                   |

## Docker Compose با Caddy (HTTPS Auto-TLS)

RouteChi می‌تواند به‌طور امن با استفاده از تأمین SSL خودکار Caddy نمایان شود. مطمئن شوید
رکورد DNS A دامنهٔ شما به IP سرور اشاره می‌کند.

```yaml
services:
  omniroute:
    image: diegosouzapw/omniroute:latest
    container_name: omniroute
    restart: unless-stopped
    volumes:
      - omniroute-data:/app/data
    environment:
      - PORT=20128
      # Browser-facing origin for OAuth callbacks, dashboard links, and generated public URLs.
      - NEXT_PUBLIC_BASE_URL=https://your-domain.com
      # Internal server-to-server URL for scheduled jobs / self-fetches.
      - BASE_URL=http://omniroute:20128
      - AUTH_COOKIE_SECURE=true

  caddy:
    image: caddy:latest
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    command: caddy reverse-proxy --from https://your-domain.com --to http://omniroute:20128

volumes:
  omniroute-data:
```

Caddy هدرهای استاندارد forwarding را برای کانتینر بالادست تنظیم می‌کند. RouteChi از
`NEXT_PUBLIC_BASE_URL` به‌عنوان origin عمومی متعارف برای callbackهای OAuth و لینک‌های
عمومی تولیدشده استفاده می‌کند؛ نوشتن‌های احراز‌هویت‌شدهٔ داشبورد از درخواست‌های
same-origin به‌علاوهٔ حفاظت CSRF متصل به نشست استفاده می‌کنند. تنها در استقرارهای
پیشرفته‌ای که عمداً می‌خواهید RouteChi origin عمومی را از هدرهای forwarding قابل‌اعتماد
استخراج کند به‌جای پیکربندی صریح، `OMNIROUTE_TRUST_PROXY` را فعال کنید.

## Cloudflare Quick Tunnel

پشتیبانی داشبورد برای استقرارهای Docker شامل یک **Cloudflare Quick Tunnel** یک‌کلیکی روی
`Dashboard → Endpoints` است. اولین فعال‌سازی تنها در صورت نیاز `cloudflared` را دانلود
می‌کند، یک تونل موقت به نقطهٔ پایانی `/v1` فعلی شما آغاز می‌کند و URL تولیدشدهٔ
`https://*.trycloudflare.com/v1` را مستقیماً زیر URL عمومی عادی شما نمایش می‌دهد.

پنل‌های تونل نقطهٔ پایانی (Cloudflare، Tailscale، ngrok) می‌توانند از `Settings → Appearance`
نمایش یا پنهان شوند بدون آنکه وضعیت فعال تونل تغییر کند.

### یادداشت‌های تونل

- URLهای Quick Tunnel موقتی هستند و پس از هر راه‌اندازی مجدد تغییر می‌کنند.
- Quick Tunnelها پس از راه‌اندازی مجدد RouteChi یا کانتینر به‌طور خودکار بازگردانده نمی‌شوند.
  در صورت نیاز از داشبورد دوباره فعالشان کنید.
- نصب مدیریتشده در حال حاضر از لینوکس، macOS و ویندوز روی `x64` / `arm64` پشتیبانی می‌کند.
- Quick Tunnelهای مدیریت‌شده به‌طور پیش‌فرض از انتقال HTTP/2 استفاده می‌کنند تا از هشدارهای
  پر سر و صدای QUIC UDP buffer در محیط‌های کانتینری محدود جلوگیری شود. در صورت تمایل به
  انتقال متفاوت، `CLOUDFLARED_PROTOCOL=quic` یا `auto` را تنظیم کنید.
- ایمیج‌های Docker ریشه‌های CA سامانه را همراه دارند و به `cloudflared` مدیریت‌شده می‌دهند،
  که از شکست اعتماد TLS هنگام bootstrap تونل درون کانتینر جلوگیری می‌کند.
- اگر می‌خواهید RouteChi به‌جای دانلود، از یک باینری موجود استفاده کند، `CLOUDFLARED_BIN=/absolute/path/to/cloudflared` را تنظیم کنید.

## تگ‌های ایمیج

| ایمیج                   | تگ       | حجم    | توضیح               |
| ----------------------- | -------- | ------ | ------------------- |
| `diegosouzapw/omniroute` | `latest` | ~250MB | آخرین نسخهٔ پایدار  |
| `diegosouzapw/omniroute` | `3.8.0`  | ~250MB | نسخهٔ فعلی          |

Manifest چندسکویی: `linux/amd64` + `linux/arm64` بومی (Apple Silicon، AWS Graviton،
Raspberry Pi). Docker معماری منطبق را به‌طور خودکار انتخاب می‌کند؛ در صورت نیاز به اجبار
شبیه‌سازی AMD64 روی میزبان‌های ARM، `--platform linux/amd64` را اضافه کنید.

## یادداشت‌های مهم

- **حالت WAL مربوط به SQLite:** باید اجازه داده شود `docker stop` به پایان برسد تا RouteChi
  بتواند آخرین تغییرات را به `storage.sqlite` بازگرداند. فایل‌های Compose همراه از قبل
  یک دورهٔ مهلت توقف ۴۰ ثانیه‌ای تعیین کرده‌اند. اگر ایمیج را مستقیماً اجرا می‌کنید،
  `--stop-timeout 40` را نگه دارید.
- **`DISABLE_SQLITE_AUTO_BACKUP`:** اگر پشتیبان‌گیری به‌صورت خارجی مدیریت می‌شود، روی
  `true` تنظیم کنید.
- **ماندگاری داده:** همیشه یک volume به `/app/data` متصل کنید تا پایگاه داده، کلیدها و
  پیکربندی‌های شما در میان راه‌اندازی‌های مجدد کانتینر ماندگار بمانند.
- **پیکربندی پورت:** برای تغییر پورت پیش‌فرض `20128`، متغیر محیطی `PORT` را بازنویسی کنید.

## مطالعهٔ بیشتر

- [راهنمای استقرار VM](../ops/VM_DEPLOYMENT_GUIDE.md) — راه‌اندازی VM + nginx + Cloudflare
- [راهنمای استقرار Fly.io](../ops/FLY_IO_DEPLOYMENT_GUIDE.md) — استقرار روی Fly.io
- [پیکربندی محیط](../reference/ENVIRONMENT.md) — مرجع کامل `.env`
