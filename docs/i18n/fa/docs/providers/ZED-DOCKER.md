---
title: "یکپارچه‌سازی Zed IDE در محیط‌های Docker"
version: 3.8.40
lastUpdated: 2026-06-28
---

# یکپارچه‌سازی Zed IDE در محیط‌های Docker

هنگامی که RouteChi داخل Docker اجرا می‌شود، جریان استاندارد «Import from Zed Keychain» شکست می‌خورد؛ چرا که کانتینر نمی‌تواند به دیمن keychain سیستم‌عامل میزبان دسترسی پیدا کند (libsecret روی لینوکس، Keychain روی macOS، Credential Manager روی ویندوز) و شاخه‌های پیکربندی Zed روی سیستم‌فایل میزبان به‌طور پیش‌فرض داخل کانتینر قابل مشاهده نیستند.

## چرا import از keychain در Docker شکست می‌خورد

دو مشکل بازدارنده داخل کانتینر رخ می‌دهد:

1. **انزوای سیستم‌فایل** — `isZedInstalled()` به دنبال `~/.config/zed` (لینوکس)، `~/Library/Application Support/Zed` (macOS) یا معادل ویندوزی می‌گردد. این مسیرها روی میزبان قرار دارند و مگر آنکه به‌طور صریح volume-mount شده باشند، در دسترس نیستند.
2. **انزوای IPC** — حتی هنگام mount بودن شاخهٔ پیکربندی، ماژول بومی `keytar` با سرویس keychain سیستم‌عامل روی یک Unix socket یا نشست D-Bus ارتباط برقرار می‌کند. هیچ‌کدام به‌طور پیش‌فرض به کانتینر پل نمی‌شوند؛ بنابراین خواندن اعتبارنامه همواره شکست می‌خورد.

RouteChi محیط Docker را از طریق دو اکتشاف تشخیص می‌دهد:

- وجود `/.dockerenv` (نوشته‌شده توسط دیمن Docker هنگام شروع کانتینر).
- رشتهٔ `docker` در `/proc/1/cgroup` (Linux cgroup v1).

هنگامی که هرکدام از این اکتشاف‌ها فعال شود، مسیر import با HTTP 422 و `zedDockerEnvironment: true` به‌همراه پیامی که شما را به تب Manual Token Import هدایت می‌کند، برمی‌گردد.

## استفاده از تب Manual Token Import

1. **Dashboard → Providers → Zed** را باز کنید.
2. پنل **Manual Token Import** در زیر کارت import از keychain ظاهر می‌شود. هنگامی که RouteChi داکر را تشخیص دهد، این پنل پس از اولین تلاش ناموفق import از keychain به‌طور خودکار باز می‌شود.
3. پروایدر را از فهرست کشویی انتخاب کنید (OpenAI، Anthropic، Google، Mistral، xAI، OpenRouter یا DeepSeek).
4. کلید API را در فیلد گذرواژه جای‌گذاری کنید.
5. روی **Import** بزنید.

کلید به‌عنوان یک اتصال پروایدر جدید با نام
`Zed Manual Import (<provider>)` ذخیره می‌شود.

## Zed کلیدهای API را کجا روی میزبان ذخیره می‌کند

Zed کلیدهای پروایدر AI را در keychain سیستم‌عامل تحت نام‌های سرویسی مانند
`zed-openai`، `ai.zed.openai`، `zed-anthropic` و غیره ذخیره می‌کند. برای بازیابی آن‌ها جهت import دستی، جست‌وجو کنید:

**لینوکس**

```
~/.config/zed/settings.json
```

بخش `language_models` شامل پیکربندی‌های پروایدر است. کلیدهایی که از طریق رابط کاربری Zed در keychain ذخیره شده‌اند در `settings.json` به‌صورت متن ساده نیستند؛ آن‌ها را از طریق یک نمایشگر keychain مانند GNOME Keyring / Seahorse، یا با اجرای دستور زیر بازیابی کنید:

```bash
secret-tool lookup service zed-openai account api-key
```

**macOS**

```
~/Library/Application Support/Zed/settings.json
```

ورودی‌های keychain را می‌توان در **Keychain Access.app** با جست‌وجوی `zed` یافت.

## گزینهٔ Volume-Mount (پیشرفته)

می‌توانید به‌صورت اختیاری شاخهٔ پیکربندی Zed را فقط‌خواندنی داخل کانتینر mount کنید.
این کار مشکل keychain را حل نمی‌کند، اما ممکن است برای قابلیت‌های آینده که مقادیر پیکربندی غیرسری Zed را می‌خوانند (مثلاً ترجیحات مدل) مفید باشد.

```yaml
# docker-compose.yml snippet
services:
  omniroute:
    image: omniroute:latest
    volumes:
      # Linux host
      - "${HOME}/.config/zed:/host-zed-config:ro"
      # macOS host (uncomment instead)
      # - "${HOME}/Library/Application Support/Zed:/host-zed-config:ro"
    environment:
      # Future: ZED_CONFIG_PATH=/host-zed-config
      PORT: "20128"
```

نکته: بازنویسی متغیر محیطی `ZED_CONFIG_PATH` هنوز پیاده‌سازی نشده است. این قطعه به‌عنوان مرجعی برای زمانی که آن ویژگی اضافه شود ارائه شده است.

## API import دستی

اندپوینت import دستی همچنین می‌تواند مستقیماً فراخوانی شود:

```
POST /api/providers/zed/manual-import
Content-Type: application/json
Authorization: Bearer <management-token>

{
  "provider": "openai",
  "token": "sk-...",
  "label": "My Zed OpenAI key"   // optional
}
```

در صورت موفقیت برمی‌گرداند:

```json
{ "success": true, "connectionId": "...", "provider": "openai" }
```

## رفع اشکال

| Symptom                              | Cause                        | Fix                              |
| ------------------------------------ | ---------------------------- | -------------------------------- |
| 422 + `zedDockerEnvironment: true`   | اجرا داخل Docker             | از تب Manual Token Import استفاده کنید |
| 404 + `zedInstalled: false`          | Zed روی میزبان نصب نیست      | Zed را نصب کنید یا از import دستی استفاده کنید |
| 403 + keychain access denied         | سیستم‌عامل دسترسی keychain را رد کرد | در پنجرهٔ سیستم‌عامل اجازه دهید     |
| 404 + keychain service not available | `libsecret` روی لینوکس غایب است | `libsecret-1-dev` را نصب کنید     |
