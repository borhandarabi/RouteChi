---
title: "RouteChi — راهنمای حذف نصب"
version: 3.8.40
lastUpdated: 2026-06-28
---

# RouteChi — راهنمای حذف نصب

🌐 **Languages:** 🇺🇸 [English](./UNINSTALL.md) | 🇧🇷 [Português (Brasil)](../i18n/pt-BR/docs/guides/UNINSTALL.md) | 🇪🇸 [Español](../i18n/es/docs/guides/UNINSTALL.md) | 🇫🇷 [Français](../i18n/fr/docs/guides/UNINSTALL.md) | 🇮🇹 [Italiano](../i18n/it/docs/guides/UNINSTALL.md) | 🇷🇺 [Русский](../i18n/ru/docs/guides/UNINSTALL.md) | 🇨🇳 [中文 (简体)](../i18n/zh-CN/docs/guides/UNINSTALL.md) | 🇩🇪 [Deutsch](../i18n/de/docs/guides/UNINSTALL.md) | 🇮🇳 [हिन्दी](../i18n/in/docs/guides/UNINSTALL.md) | 🇹🇭 [ไทย](../i18n/th/docs/guides/UNINSTALL.md) | 🇺🇦 [Українська](../i18n/uk-UA/docs/guides/UNINSTALL.md) | 🇸🇦 [العربية](../i18n/ar/docs/guides/UNINSTALL.md) | 🇯🇵 [日本語](../i18n/ja/docs/guides/UNINSTALL.md) | 🇻🇳 [Tiếng Việt](../i18n/vi/docs/guides/UNINSTALL.md) | 🇧🇬 [Български](../i18n/bg/docs/guides/UNINSTALL.md) | 🇩🇰 [Dansk](../i18n/da/docs/guides/UNINSTALL.md) | 🇫🇮 [Suomi](../i18n/fi/docs/guides/UNINSTALL.md) | 🇮🇱 [עברית](../i18n/he/docs/guides/UNINSTALL.md) | 🇭🇺 [Magyar](../i18n/hu/docs/guides/UNINSTALL.md) | 🇮🇩 [Bahasa Indonesia](../i18n/id/docs/guides/UNINSTALL.md) | 🇰🇷 [한국어](../i18n/ko/docs/guides/UNINSTALL.md) | 🇲🇾 [Bahasa Melayu](../i18n/ms/docs/guides/UNINSTALL.md) | 🇳🇱 [Nederlands](../i18n/nl/docs/guides/UNINSTALL.md) | 🇳🇴 [Norsk](../i18n/no/docs/guides/UNINSTALL.md) | 🇵🇹 [Português (Portugal)](../i18n/pt/docs/guides/UNINSTALL.md) | 🇷🇴 [Română](../i18n/ro/docs/guides/UNINSTALL.md) | 🇵🇱 [Polski](../i18n/pl/docs/guides/UNINSTALL.md) | 🇸🇰 [Slovenčina](../i18n/sk/docs/guides/UNINSTALL.md) | 🇸🇪 [Svenska](../i18n/sv/docs/guides/UNINSTALL.md) | 🇵🇭 [Filipino](../i18n/phi/docs/guides/UNINSTALL.md) | 🇨🇿 [Čeština](../i18n/cs/docs/guides/UNINSTALL.md)

این راهنما نحوهٔ حذف کامل RouteChi از سامانه شما را پوشش می‌دهد.

---

## حذف نصب سریع (v3.6.2 به بعد)

RouteChi دو اسکریپت داخلی برای حذف تمیز ارائه می‌دهد:

### نگه‌داشتن داده‌های شما

```bash
npm run uninstall
```

این دستور برنامهٔ RouteChi را حذف می‌کند اما پایگاه داده، پیکربندی‌ها، کلیدهای API و تنظیمات ارائه‌دهنده را در `~/.omniroute/` **حفظ می‌کند**. اگر قصد دارید بعداً دوباره نصب کنید و می‌خواهید راه‌اندازی فعلی را نگه دارید، از این گزینه استفاده کنید.

### حذف کامل

```bash
npm run uninstall:full
```

این دستور برنامه را **به‌طور دائمی پاک می‌کند** و تمام داده‌ها را محو می‌سازد:

- پایگاه داده (`storage.sqlite`)
- پیکربندی‌های ارائه‌دهنده و کلیدهای API
- فایل‌های پشتیبان
- فایل‌های گزارش
- تمام فایل‌های موجود در شاخهٔ `~/.omniroute/`

> ⚠️ **هشدار:** `npm run uninstall:full` قابل بازگشت نیست. تمام اتصالات ارائه‌دهنده، کامبوها، کلیدهای API و تاریخچهٔ استفاده به‌طور دائمی حذف خواهند شد.

---

## حذف نصب دستی

### نصب سراسری NPM

```bash
# Remove the global package
npm uninstall -g omniroute

# (Optional) Remove data directory
rm -rf ~/.omniroute
```

### نصب سراسری pnpm

```bash
pnpm uninstall -g omniroute
rm -rf ~/.omniroute
```

### Docker

```bash
# Stop and remove the container
docker stop omniroute
docker rm omniroute

# Remove the volume (deletes all data)
docker volume rm omniroute-data

# (Optional) Remove the image
docker rmi diegosouzapw/omniroute:latest
```

### Docker Compose

```bash
# Stop and remove containers
docker compose down

# Also remove volumes (deletes all data)
docker compose down -v
```

### برنامهٔ دسکتاپ Electron

**ویندوز:**

- باز کنید `Settings → Apps → OmniRoute → Uninstall`
- یا اجرای حذف‌نصب‌کنندهٔ NSIS از شاخهٔ نصب

**macOS:**

- `OmniRoute.app` را از `/Applications` به سطل زباله بکشید
- حذف داده‌ها: `rm -rf ~/Library/Application Support/omniroute`

**لینوکس:**

- حذف فایل AppImage
- حذف داده‌ها: `rm -rf ~/.omniroute`

### نصب از روی سورس (git clone)

```bash
# Remove the cloned directory
rm -rf /path/to/omniroute

# (Optional) Remove data directory
rm -rf ~/.omniroute
```

---

## شاخه‌های داده

RouteChi به‌طور پیش‌فرض داده‌ها را در مسیرهای زیر ذخیره می‌کند:

| پلتفرم       | مسیر پیش‌فرض                  | متغیر بازنویسی            |
| ------------- | ----------------------------- | ------------------------- |
| Linux         | `~/.omniroute/`               | متغیر محیطی `DATA_DIR`   |
| macOS         | `~/.omniroute/`               | متغیر محیطی `DATA_DIR`   |
| Windows       | `%APPDATA%/omniroute/`        | متغیر محیطی `DATA_DIR`   |
| Docker        | `/app/data/` (volume متصل شده) | متغیر محیطی `DATA_DIR`   |
| سازگار با XDG | `$XDG_CONFIG_HOME/omniroute/` | متغیر محیطی `XDG_CONFIG_HOME` |

### فایل‌های موجود در شاخهٔ داده

| فایل/شاخه            | توضیح                                             |
| -------------------- | ------------------------------------------------- |
| `storage.sqlite`     | پایگاه دادهٔ اصلی (ارائه‌دهنده‌ها، کامبوها، تنظیمات، کلیدها) |
| `storage.sqlite-wal` | گزارش write-ahead مربوط به SQLite (موقت)          |
| `storage.sqlite-shm` | حافظهٔ اشتراکی SQLite (موقت)                       |
| `call_logs/`         | آرشیو payload درخواست‌ها                          |
| `backups/`           | پشتیبان‌گیری خودکار پایگاه داده                   |
| `log.txt`            | گزارش قدیمی درخواست (اختیاری)                    |

---

## بررسی حذف کامل

پس از حذف نصب، بررسی کنید که هیچ فایل باقی‌مانده‌ای وجود ندارد:

```bash
# Check for global npm package
npm list -g omniroute 2>/dev/null

# Check for data directory
ls -la ~/.omniroute/ 2>/dev/null

# Check for running processes
pgrep -f omniroute
```

اگر هنوز فرایندی در حال اجراست، آن را متوقف کنید:

```bash
pkill -f omniroute
```
