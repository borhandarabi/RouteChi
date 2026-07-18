---
title: "API پروکسی‌های رایگان"
version: 3.8.43
lastUpdated: 2026-07-11
---

# API پروکسی‌های رایگان

RouteChi یک مجموعه curated از پروکسی‌های رایگان را در جدول `free_proxies` عرضه
می‌کند، که از ارائه‌دهندگان خارجی (1proxy، proxifly، iplocate، webshare) همگام می‌شود. این
پروکسی‌ها در داشبورد زیر **Settings → Free Proxies** نمایش داده می‌شوند. این سند
پوشش می‌دهد فیلتر کردن، مرتب‌سازی، شمارش و گزارش خطای همگام‌سازی سمت سرور را که
مسیر لیست در دسترس قرار می‌دهد.

## مسیر لیست — `GET /api/settings/free-proxies`

یک slice فیلترشده، مرتب‌شده، صفحه‌بندی‌شده به همراه مجموع شمارش را برمی‌گرداند. فیلتر کردن و
شمارش در SQL انجام می‌شود، تا UI بتواند مجموع واقعی را (مثلاً `Total: 0`)
نمایش دهد بدون اینکه هر ردیفی را در حافظه بارگذاری کند.

### پارامترهای query

| Param             | Type                               | Default   | Meaning                                                                                        |
| ----------------- | ---------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| `search`          | string                             | `""`      | `LIKE` حساس به حروف کوچک/بزرگ روی ستون host (و source).                                         |
| `protocol`        | string                             | `""`      | فیلتر `type`: `http` / `https` / `socks4` / `socks5`. خالی = همه.                            |
| `country`         | string                             | `""`      | فیلتر `countryCode` (ISO-2). خالی = همه.                                                     |
| `minQuality`      | number                             | `0`       | فقط ردیف‌هایی با `qualityScore >= minQuality`. `0` = بدون کف.                                   |
| `disabledSources` | string                             | `""`      | شناسه‌های منبع جدا شده با کاما برای استثنا (مثلاً `proxifly,webshare`).                              |
| `sortBy`          | `quality` \| `latency` \| `recent` | `quality` | `quality` = امتیاز نزولی؛ `latency` = تأخیر صعودی (nullها آخر)؛ `recent` = `lastValidated` نزولی. |
| `offset`          | number                             | `0`       | شروع صفحه‌بندی.                                                                              |
| `limit`           | number                             | `50`      | اندازه صفحه (سمت سرور محدود می‌شود).                                                                |

### پاسخ

```json
{
  "success": true,
  "data": {
    "proxies": [/* FreeProxyRecord[] */],
    "total": 137,
    "hasMore": true
  },
  "stats": {
    "total": 137,
    "inPool": 12,
    "avgQuality": 64.2,
    "bySource": [{ "source": "1proxy", "count": 90 }],
    "lastSyncAt": "2026-07-11T09:30:00.000Z"
  },
  "syncErrors": {
    "proxifly": ["HTTP 429 from upstream"],
    "webshare": ["network timeout"]
  }
}
```

`total` مجموع فیلترشده را **قبل از** صفحه‌بندی منعکس می‌کند، تا UI بتواند
`Total: N` و `hasMore` را به‌صورت مستقل رندر کند. `syncErrors` بر اساس شناسه منبع
کلید شده و فقط برای منابعی که همگام‌سازی آخرشان شکست خورده پر می‌شود — یک نتیجه `Total: 0` هرگز
بی‌صدا نیست.

## افزودن به pool — `POST /api/settings/free-proxies/[id]/add-to-pool`

یک پروکسی رایگان را به pool مدیریت‌شده `proxy_registry` ارتقا می‌دهد. ابتدا
upstream را اعتبارسنجی می‌کند؛ در صورت موفقیت، شناسه پروکسی pool جدید و تأخیر اندازه‌گیری‌شده را برمی‌گرداند.

## همگام‌سازی — `POST /api/settings/free-proxies/sync`

تمام منابع فعال را دوباره pull می‌کند (یا زیرمجموعه در `{ "sources": [...] }`). هر
منبع به‌طور مستقل همگام می‌شود؛ یک منبعِ در حال شکست در `syncErrors` ثبت می‌شود و
بقیه همچنان کامل می‌شوند، تا همگام‌سازی‌های جزئی هرگز داده‌های خوب قبلی را پاک نکنند.

## آمار — `GET /api/settings/free-proxies/stats`

مجموع `total / inPool / avgQuality / bySource / lastSyncAt` را
بدون payload ردیف برمی‌گرداند — استفاده شده توسط ویجت‌های هدر داشبورد.
