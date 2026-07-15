---
title: "پایش و هزینه‌ها — ساختار ناوبری"
version: 3.8.40
lastUpdated: 2026-06-28
---

# پایش و هزینه‌ها — ساختار ناوبری

> پیاده‌سازی‌شده در Group B (برنامه ۱۶). به `src/shared/constants/sidebarVisibility.ts` مراجعه کنید.

---

## ناوبری سطح‌بالا

نوار کناری داشبورد (پس از Group B) این بخش‌های سطح‌بالا را به ترتیب دارد:

```
Home
Providers
Combos
API Keys
Settings
Analytics
Costs          ← جدید (Group B، برنامه ۱۶)
Monitoring     ← بازسازی‌شده (Group B، برنامه ۱۶)
...
```

---

## بخش Costs (جدید، سطح ۱)

پیشوند مسیر: `/dashboard/costs/`

| مورد            | URL                                  | توضیح                                            |
| --------------- | ------------------------------------ | ------------------------------------------------ |
| Overview        | `/dashboard/costs`                   | داشبورد هزینه تجمیع‌شده (انتقال‌یافته از Analytics) |
| Pricing         | `/dashboard/costs/pricing`           | جدول قیمت‌گذاری به‌ازای هر مدل                       |
| Budget          | `/dashboard/costs/budget`            | آستانه‌های بودجه + هشدارها                          |
| Quota Sharing   | `/dashboard/costs/quota-share`       | استخرهای Quota Share + استفاده                     |
| Plan Config     | `/dashboard/costs/quota-share/plans` | بازنویسی‌های plan به‌ازای هر provider                |

**دلیل**: Pricing، Budget و Quota Sharing پیش‌تر زیر `Monitoring > Costs Parameters` بودند. انتقال آن‌ها به یک بخش سطح‌بالای اختصاصی، قابلیت کشف آن‌ها را بدون ناوبری در ابزارهای مشاهده‌پذیری بهبود می‌بخشد.

---

## بخش Monitoring (بازسازی‌شده)

بخش Monitoring اکنون **Activity را در بالا** دارد و سپس **۳ زیرگروه** قرار می‌گیرد:

```
Monitoring
├── Activity             ← فید خط زمانی (آیتم سطح‌بالا)
├── Logs group
│   ├── Logs (all)
│   ├── Proxy Logs
│   └── Console Logs
├── Audit group
│   ├── Audit Log
│   ├── MCP Audit
│   └── A2A Audit
└── System group
    ├── Health
    └── Runtime
```

### تغییرات نسبت به ساختار قدیمی

| قبل                                                                              | بعد                                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Activity = تب داخل Logs که Audit Log را نمایش می‌داد                              | Activity = فید اختصاصی (`/dashboard/activity`)             |
| گروه Costs Parameters در Monitoring                                              | به بخش Costs منتقل شد                                     |
| لیست مسطح: Logs، Activity (logs)، Audit، Health، Runtime، Pricing، Budget، Quota | ساختار ۳-گروهی + بخش اختصاصی Costs                        |

---

## Activity در مقابل Audit Log

این دو اکنون متمایز هستند:

| بُعد             | Activity (`/dashboard/activity`)                       | Audit Log (`/dashboard/audit`)            |
| ---------------- | ------------------------------------------------------ | ----------------------------------------- |
| **هدف**          | فید رویداد کاربر-رو («اخیراً چه اتفاقی افتاده»)         | گزارش انطباق / امنیت                       |
| **منبع داده**    | `GET /api/compliance/audit-log?level=high`             | `GET /api/compliance/audit-log?level=all` |
| **قالب**         | خط زمانی، گروه‌بندی‌شده بر اساس روز، افعال قابل‌فهم + آیکون | جدول متراکم صفحه‌بندی‌شده، ۵۰/صفحه           |
| **فیلترها**      | دسته نوع رویداد                                        | Action، severity، actor، بازه تاریخ        |
| **خروجی**        | موجود نیست                                             | خروجی JSON                                |
| **فیلتر actor**  | قابل اعمال نیست                                       | قابل فیلتر بر اساس actor                   |
| **رویدادهای نمایش‌داده‌شده** | فقط اقدامات سطح‌بالا (allowlist)                       | همه رویدادهای ممیزی                       |

### Allowlist اقدامات سطح‌بالا

تعریف‌شده در `src/lib/audit/highLevelActions.ts`. کنترل می‌کند کدام رویدادها در فید Activity ظاهر شوند. Allowlist شامل موارد زیر است:

- رویدادهای افزودن/حذف/آزمایش provider
- ایجاد/به‌روزرسانی/حذف combo
- چرخه حیات API key (ایجاد، ابطال، چرخش)
- رسیدن به آستانه بودجه
- ورود/خروج احراز هویت
- ایجاد نشست Cloud agent
- ثبت ابزار MCP
- ایجاد/حذف Webhook
- تغییرات استخر/plan سهمیه (اقدامات `quota.*`، Group B)
- رویدادهای پلتفرم (به‌روزرسانی، استقرار)
- نصب/حذف Skill

رویدادهای خارج از این لیست فقط در Audit Log ظاهر می‌شوند.

### افزودن یک اقدام سطح‌بالای جدید

فایل `src/lib/audit/highLevelActions.ts` را ویرایش کرده و رشته اقدام را به `HIGH_LEVEL_ACTIONS` اضافه کنید. این کار نیازمند یک PR است (لیست کد است، در DB قابل پیکربندی نیست). آیکون مربوطه را می‌توان به `src/lib/audit/activityIcons.ts` اضافه کرد.

---

## تغییر مسیر: `/dashboard/logs/activity`

مسیر قدیمی `/dashboard/logs/activity` به‌طور دائم (HTTP 308) به `/dashboard/activity` تغییر مسیر می‌شود از طریق `permanentRedirect()` در `src/app/(dashboard)/dashboard/logs/activity/page.tsx`.

شناسه قدیمی نوار کناری `logs-activity` در `HIDEABLE_SIDEBAR_ITEM_IDS` حفظ می‌شود (اما از `SIDEBAR_DEFINITIONS` حذف شده) تا تنظیمات قبلی کاربر که به شناسه قدیمی ارجاع می‌دهند، خراب نشوند.

---

## i18n

فضاهای نام اضافه‌شده توسط Group B:

| کلید namespace         | پوشش                                                     |
| ---------------------- | -------------------------------------------------------- |
| `sidebar.costsSection` | برچسب بخش Costs                                          |
| `sidebar.activity`     | آیتم نوار کناری Activity                                 |
| `sidebar.logsGroup`    | برچسب زیرگروه Logs                                       |
| `sidebar.systemGroup`  | برچسب زیرگروه System                                     |
| `sidebar.costsOverview`| آیتم نمای کلی Costs                                      |
| `activity.*`           | تمام رشته‌های صفحه Activity (عنوان، افعال، فیلترها، حالت خالی) |

زبان‌های مرجع: `pt-BR` و `en`. هر ۳۹ زبان دیگر از طریق مکانیزم fallback در `next-intl` به انگلیسی بازمی‌گردند (پیکربندی‌شده در `src/i18n/config.ts`).
