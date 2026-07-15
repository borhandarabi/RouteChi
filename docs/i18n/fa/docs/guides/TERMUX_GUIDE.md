---
title: "راه‌اندازی Headless مربوط به Termux"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راه‌اندازی Headless مربوط به Termux

OmniRoute می‌تواند به‌عنوان یک سرور headless روی اندروید از طریق Termux اجرا شود. برنامهٔ
دسکتاپ Electron در Termux پشتیبانی نمی‌شود، اما داشبورد وب و API سازگار با OpenAI از
مرورگر محلی یا از سایر دستگاه‌های روی همان شبکه کار می‌کنند.

## پیش‌نیازها

Termux را از F-Droid یا نسخه‌های GitHub نصب کنید، سپس پکیج‌ها را به‌روزرسانی و ابزارهای
ساخت مورد نیاز توسط وابستگی‌های بومی مانند `better-sqlite3` را نصب کنید.

```bash
pkg update
pkg upgrade
pkg install nodejs python build-essential git
```

> **نسخهٔ Node.js:** OmniRoute نیازمند Node `>=22.22.2 <23 || >=24.0.0 <27` است (با `engines`
> در `package.json` / `SUPPORTED_NODE_RANGE` تطابق دارد). `nodejs-lts` مربوط به Termux
> معمولاً Node 20 LTS را عرضه می‌کند، که **دیگر پشتیبانی نمی‌شود** — به‌جای آن `pkg install nodejs`
> (نسخهٔ فعلی) را نصب و تأیید کنید که `node --version` یک خط 22.x/24.x+ را گزارش می‌کند.

اگر کامپایل پکیج بومی شکست خورد، دستور `pkg install` بالا را دوباره اجرا و سپس نصب
OmniRoute را retry کنید.

## نصب

آخرین پکیج منتشرشده را مستقیماً اجرا کنید:

```bash
npx -y omniroute@latest
```

همچنین می‌توانید آن را به‌صورت سراسری نصب کنید:

```bash
npm install -g omniroute
omniroute
```

## اجرا

OmniRoute را در حالت سرور headless راه‌اندازی کنید:

```bash
omniroute
```

یا:

```bash
npx omniroute
```

داشبورد روی این نشانی گوش می‌دهد:

```text
http://localhost:20128
```

آن URL را در مرورگر اندروید باز کنید. اگر کلاینت‌ها را درون Termux اجرا می‌کنید، از همان
host و پورت به‌عنوان URL پایهٔ سازگار با OpenAI استفاده کنید.

## اجرای پس‌زمینه

برای یک فرایند پس‌زمینهٔ ساده:

```bash
nohup omniroute > omniroute.log 2>&1 &
```

برای توقف آن:

```bash
pkill -f omniroute
```

برای راه‌اندازی خودکار پس از boot دستگاه، افزونهٔ Termux:Boot را نصب و یک اسکریپت boot ایجاد کنید:

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/omniroute.sh <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
cd "$HOME"
nohup omniroute > "$HOME/omniroute.log" 2>&1 &
EOF
chmod +x ~/.termux/boot/omniroute.sh
```

بهینه‌سازی باتری اندروید می‌تواند فرایندهای پس‌زمینهٔ طولانی‌مدت را متوقف کند. اگر انتظار
دارید سرور آنلاین بماند، بهینه‌سازی باتری را برای Termux غیرفعال کنید.

## دسترسی از سایر دستگاه‌ها

آدرس IP تلفن را روی شبکهٔ WiFi پیدا کنید:

```bash
ip addr show wlan0
```

سپس داشبورد را از دستگاه دیگری باز کنید:

```text
http://PHONE_IP:20128
```

برای مثال:

```text
http://192.168.1.50:20128
```

تلفن و کلاینت را روی همان شبکهٔ قابل‌اعتماد نگه دارید. اگر OmniRoute را خارج از تلفن
نمایان می‌کنید، کلیدهای API و احراز هویت داشبورد را فعال کنید.

## شاخهٔ داده

به‌طور پیش‌فرض OmniRoute داده‌ها را تحت شاخهٔ home مربوط به Termux ذخیره می‌کند و از همان
رفتار مسیر دادهٔ سمت سرور استفاده‌شده در لینوکس پیروی می‌کند. برای قرار دادن پایگاه داده
در مکانی صریح:

```bash
export DATA_DIR="$HOME/.omniroute"
omniroute
```

## محدودیت‌ها

- Electron در Termux اجرا نمی‌شود.
- هیچ system tray یا یکپارچه‌سازی دسکتاپی وجود ندارد.
- این راه‌اندازی فقط سرور است: از داشبورد مرورگر استفاده کنید.
- وابستگی‌های بومی ممکن است نیازمند کامپایل محلی باشند.
- دستگاه‌های اندرویدی با حافظهٔ کم ممکن است نیازمند درخواست‌های هم‌زمان کمتری باشند.
- ویژگی‌های گواهی MITM/samانه ممکن است نیازمند کار trust-store در سطح اندروید خارج از Termux باشند.

## رفع اشکال

### خطاهای ساخت better-sqlite3

ابزارزنجیرهٔ ساخت Termux را نصب کنید:

```bash
pkg install nodejs python build-essential
```

سپس دوباره اجرا کنید:

```bash
npx -y omniroute@latest
```

### پورت از قبل در حال استفاده

بررسی کنید چه چیزی روی پورت پیش‌فرض گوش می‌دهد:

```bash
ss -ltnp | grep 20128
```

فرایند قدیمی را متوقف کنید:

```bash
pkill -f omniroute
```

### داشبورد از دستگاه دیگری قابل دسترسی نیست

تأیید کنید هر دو دستگاه روی همان شبکهٔ WiFi هستند، سپس از Termux آزمایش کنید:

```bash
curl http://localhost:20128
```

اگر دسترسی محلی کار می‌کند اما دسترسی LAN نه، isolation مربوط به hotspot/WiFi اندروید و
هر پروفایل فایروال یا VPN روی تلفن را بررسی کنید.
