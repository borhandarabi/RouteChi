---
title: "بسته‌های زبانی فشرده‌سازی"
version: 3.8.40
lastUpdated: 2026-06-28
---

# بسته‌های زبانی فشرده‌سازی

فشرده‌سازی Caveman می‌تواند علاوه بر قواعد داخلی انگلیسی، بسته‌های قواعد خاص هر زبان را بارگذاری کند.
این کار باعث می‌شود موتور اصلی پایدار بماند و در عین حال بسته‌های پرتغالی، اسپانیایی، آلمانی، فرانسوی،
ژاپنی و زبان‌های آینده بتوانند به‌صورت مستقل تکامل پیدا کنند.

## محل قرارگیری

بسته‌های زبانی در مسیر زیر قرار می‌گیرند:

```txt
open-sse/services/compression/rules/<language>/
```

بسته‌های فعلی ارسالی (بر اساس محتوای پوشه `rules/` بررسی شده‌اند):

| زبان                | پوشه          | دسته‌بندی‌های قواعد موجود                            |
| ------------------- | -------------- | --------------------------------------------------- |
| انگلیسی             | `rules/en/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| اسپانیایی           | `rules/es/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| پرتغالی (برزیل)     | `rules/pt-BR/` | `context`, `dedup`, `filler`, `structural`, `ultra` |
| اندونزیایی          | `rules/id/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| آلمانی              | `rules/de/`    | `context`, `filler`, `structural`                   |
| فرانسوی             | `rules/fr/`    | `context`, `filler`, `structural`                   |
| ژاپنی               | `rules/ja/`    | `context`, `filler`, `structural`                   |

> **نکته برابری:** بسته‌های `en`، `es`، `pt-BR` و `id` هر ۵ دسته را دارند؛ بسته‌های `de`، `fr` و `ja` فقط ۳ دسته ارسال می‌کنند. دسته‌های `dedup` و `ultra` مفقود به‌صورت بی‌صدا به نسخه‌های داخلی انگلیسی بازمی‌گردند. مشارکت برای افزودن `dedup.json` و `ultra.json` به بسته‌های کوچک‌تر مورد استقبال قرار می‌گیرد.
>
> بسته `pt-BR` بر اساس **[Troglodita](https://github.com/leninejunior/troglodita)** اثر Lenine Júnior است — یک سیستم فشرده‌سازی که از پایه برای گرامر پرتغالی برزیل طراحی شده (کاهش حشو، حذف کلمات پرکن در PT-BR، اختصارات فنی برای جامعه توسعه‌دهندگان برزیلی).
>
> فهرست مرجع دسته‌بندی‌ها و طرح‌وارهٔ هر دسته در [`open-sse/services/compression/rules/_schema.json`](../../open-sse/services/compression/rules/_schema.json) قرار دارد (JSON Schema نسخه draft 2020-12).

## تشخیص زبان

فایل `languageDetector.ts` از اکتشافات سبک‌وزن برای استنتاج زبان از متن پرامپت استفاده می‌کند.
زبان پیش‌فرض پیکربندی‌شده همچنان رعایت می‌شود و در صورت نیاز به کنترل دقیق، تشخیص را می‌توان از طریق پیکربندی غیرفعال کرد.

خروجی تشخیص فقط برای انتخاب بسته‌های قواعد استفاده می‌شود. این کار مسیریابی provider،
انتخاب locale یا زبان رابط کاربری را تغییر نمی‌دهد.

## ساختار پیکربندی

تنظیمات فشرده‌سازی می‌تواند شامل موارد زیر باشد:

```json
{
  "languageConfig": {
    "enabled": true,
    "defaultLanguage": "en",
    "autoDetect": true,
    "enabledPacks": ["en", "pt-BR", "es", "id", "de", "fr", "ja"]
  },
  "cavemanConfig": {
    "language": "en",
    "autoDetectLanguage": true,
    "enabledLanguagePacks": ["en", "pt-BR", "es", "id", "de", "fr", "ja"]
  }
}
```

`languageConfig` پیش‌فرض‌های داشبورد/پیش‌نمایش را کنترل می‌کند. `cavemanConfig` پیکربندی موتور زمان اجرا
است که هنگام فشرده‌سازی متن پیام توسط Caveman استفاده می‌شود.

## افزودن بسته زبانی

1. فایل `open-sse/services/compression/rules/<language>/<pack>.json` را بسازید.
2. از قالب قواعد Caveman که در `docs/compression/COMPRESSION_RULES_FORMAT.md` آمده استفاده کنید.
3. جایگزینی‌ها را محافظه‌کارانه نگه دارید و از تغییر کد، شناسه‌ها، URLها یا JSON پرهیز کنید.
4. آزمون‌هایی برای انتخاب زبان و رفتار جایگزینی اضافه یا به‌روز کنید.
5. برچسب‌های جدید داشبورد/i18n را در صورتی که زبان در انتخابگرهای رابط کاربری ظاهر می‌شود، افشا کنید.

## API

بسته‌های موجود را می‌توان با دستور زیر پرس‌وجو کرد:

```bash
curl http://localhost:20128/api/compression/language-packs
```

اندپوینت پیش‌نمایش، بازنویسی‌های پیکربندی زبان را می‌پذیرد:

```bash
curl -X POST http://localhost:20128/api/compression/preview \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "standard",
    "text": "Por favor, eu gostaria que voce basicamente resumisse isso.",
    "config": {
      "languageConfig": {
        "defaultLanguage": "pt-BR",
        "autoDetect": true
      }
    }
  }'
```

## SHARED_BOUNDARIES (نسخه v3.8.0)

هر ۶ بسته زبانی در نسخه v3.8.0 یک شرط `SHARED_BOUNDARIES` دریافت کردند که در هر شدت Caveman
(LITE، FULL، ULTRA) اعمال می‌شود. این شرط به موتور دستور می‌دهد که این الگوها را دقیقاً همان‌طور که هستند
حفظ کند، بدون توجه به حذف کلمات پرکن اطراف:

| نوع الگو                         | مثال                                  |
| -------------------------------- | ------------------------------------- |
| بلوک‌های کد محصور شده            | ` ```python\n...\n``` `               |
| کد درون‌خطی                      | `` `my_var` ``                        |
| URLها                            | `https://example.com/path`            |
| مسیرهای فایل (مطلق + نسبی)      | `/etc/hosts`, `./src/index.ts`        |
| سرتیترهای خطا                    | `Error:`, `TypeError:`, `SyntaxError:`|
| خطوط ردپای پشته                  | `  at functionName (file.ts:12:3)`    |

این الگوها در `DEFAULT_CAVEMAN_CONFIG.preservePatterns` (که قبلاً `[]` بود) قرار می‌گیرند. این
ثابت در `open-sse/services/compression/types.ts` قرار دارد.

### چرا این موضوع اهمیت دارد

بدون SHARED_BOUNDARIES، حالت‌های تهاجمی Caveman می‌توانستند محتوایی را که شبیه متن تکراری به نظر می‌رسید
اما در واقع یک قطعه کد، مسیر فایل یا پشته خطا بود، حذف کنند. SHARED_BOUNDARIES به عنوان یک تور ایمنی
مستقل از زبان، قبل از اجرای قواعد حشو اعمال می‌شود.

### سفارشی‌سازی preservePatterns

می‌توان الگوهای اضافی را در زمان اجرا از طریق تنظیمات فشرده‌سازی اضافه کرد:

````json
{
  "cavemanConfig": {
    "preservePatterns": [
      "```[\\s\\S]*?```",
      "`[^`]+`",
      "https?://\\S+",
      "(?:/|\\./)[^\\s]+",
      "\\b(?:Error|TypeError|SyntaxError|RangeError):",
      "\\s+at\\s+\\S+\\s+\\(\\S+:\\d+:\\d+\\)"
    ]
  }
}
````
الگوهای سفارشی ۶ مقدار پیش‌فرض را گسترش (و نه جایگزین) می‌کنند.

---

## نکات عملیاتی

- قواعد داخلی انگلیسی همچنان به عنوان بازگشت استفاده می‌شوند وقتی بسته زبانی مفقود است.
- بسته‌های نامعتبر JSON داخلی در اعتبارسنجی شکست می‌خورند تا دارایی‌های انتشار به‌صورت بی‌صدا افت کیفیت پیدا نکنند.
- بسته‌های قواعد فقط داده هستند و نباید کد import کنند یا منطق دلخواهی اجرا کنند.
- لایه تحلیل فشرده‌سازی فقط حالت انتخاب‌شده و موتور را ثبت می‌کند، نه کل متن پرامپت را.
