---
title: "منبع بافتار Notion"
version: 3.8.40
lastUpdated: 2026-06-28
---

# منبع بافتار Notion

> **منبع حقیقت:** `src/lib/notion/api.ts` (کلاینت REST)، `src/lib/db/notion.ts`
> (ماندگاری توکن)، `open-sse/mcp-server/tools/notionTools.ts` (۶ ابزار MCP)،
> `src/app/api/settings/notion/route.ts` (API تنظیمات). ثبت ابزار و اتصال scope
> در `open-sse/mcp-server/server.ts` قرار دارد.

## این چیست

RouteChi می‌تواند به یک فضای کاری **Notion** به‌عنوان یک **منبع بافتار** متصل شود — یک پایگاه دانش خواندنی/نوشتنی که عوامل از طریق MCP server داخلی به آن دسترسی دارند. پس از پیکربندی یک توکن یکپارچه‌سازی Notion، ابزارهای MCP به یک LLM اجازه می‌دهند صفحات و پایگاه‌های داده را جستجو کند، محتوای صفحه و درخت بلوک‌ها را بخواند، پایگاه‌های داده را با فیلتر/مرتب‌سازی پرس‌وجو کند و بلوک‌های جدید اضافه کند — همگی از طریق RouteChi پروکسی می‌شوند (با retry، timeout و دسته‌بندی خطا) تا مدل هرگز مستقیماً با API مربوط به Notion ارتباط نمی‌گیرد.

این یکپارچه‌سازی یک wrapper نازک و سخت‌شده روی REST API رسمی Notion است
(`https://api.notion.com/v1`، `Notion-Version: 2026-03-11`). کلاینت
(`src/lib/notion/api.ts`) این موارد را اضافه می‌کند:

- **Retry با backoff نمایی** (تا ۳ تلاش) برای `429` و `5xx`.
- **مهلت زمانی ۵۵ ثانیه‌ای** درخواست از طریق `AbortController`.
- **دسته‌بندی خطای تایپ‌شده** — `NotionAuthError` (401/403)،
  `NotionNotFoundError` (404)، `NotionRateLimitError` (429، از راهنمایی‌های
  `retry after` پیروی می‌کند)، `NotionValidationError` (400/409)،
  `NotionServerError` (5xx)، `NotionTimeoutError`.
- **پاک‌سازی پیام** که قطعات شبیه stack-trace را قبل از نمایش حذف می‌کند.

## راه‌اندازی

**هیچ متغیر محیطی** برای توکن Notion وجود ندارد — آن در جدول SQLite
`key_value` (namespace مربوط به `notion`، کلید `integration_token`) از طریق
`src/lib/db/notion.ts` ذخیره می‌شود. آن را از تب **Context Sources** داشبورد
Endpoint (همتای `ObsidianSourceCard` یعنی `NotionSourceCard`) یا از طریق
API تنظیمات REST پیکربندی کنید.

> [!NOTE]
> توکن یک **توکن یکپارچه‌سازی داخلی Notion** است. یک یکپارچه‌سازی در
> <https://www.notion.com/my-integrations> بسازید، سپس صفحات/پایگاه‌های داده‌ای
> که می‌خواهید RouteChi به آن‌ها دسترسی داشته باشد را با آن یکپارچه‌سازی به اشتراک
> بگذارید (مدل مجوز Notion مبتنی بر اشتراک‌گذاری است، نه در سطح فضای کاری).

### پیکربندی از طریق REST

```bash
# ذخیره + اعتبارسنجی توکن یکپارچه‌سازی (POST با انجام یک جستجوی آزمایشی اعتبارسنجی می‌کند)
curl -X POST http://localhost:20128/api/settings/notion \
  -H "Content-Type: application/json" \
  -d '{"token":"ntn_xxx"}'

# بررسی وضعیت اتصال
curl http://localhost:20128/api/settings/notion

# قطع اتصال (توکن ذخیره‌شده را پاک می‌کند)
curl -X DELETE http://localhost:20128/api/settings/notion
```

تمام سه روش نیازمند احراز هویت داشبورد (`isAuthenticated`) هستند. هنگام `POST`،
RouteChi توکن را ذخیره کرده و بلافاصله یک جستجوی آزمایشی تک‌نتیجه‌ای اجرا می‌کند؛
اگر Notion یک شیء خطا برگرداند، توکن پاک شده و فراخوانی با `400` شکست می‌خورد.

## ابزارهای MCP (۶ مورد)

در `open-sse/mcp-server/tools/notionTools.ts` تعریف شده‌اند. توکن در زمان
فراخوانی از طریق `getNotionToken()` حل می‌شود؛ اگر هیچ‌کدام پیکربندی نشده باشد،
ابزار خطای زیر را می‌دهد:
`"Notion integration token not configured. Set it in Settings > Context Sources."`

| ابزار                         | Scope          | توضیحات                                                                       |
| ---------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `notion_search`              | `read:notion`  | جستجوی صفحات و پایگاه‌های داده بر اساس پرس‌وجوی متنی (عناوین، شناسه‌ها، URLها را برمی‌گرداند). صفحه‌بندی‌شده.  |
| `notion_get_page`            | `read:notion`  | دریافت محتوا و فراداده یک صفحه بر اساس شناسه آن.                                     |
| `notion_list_block_children` | `read:notion`  | فهرست‌کردن تمام فرزندان بلوک یک بلوک یا صفحه (درخت بلوک). صفحه‌بندی‌شده.           |
| `notion_query_database`      | `read:notion`  | پرس‌وجوی یک پایگاه داده با `filter` + `sorts` اختیاری (فرمت API مربوط به Notion). صفحه‌بندی‌شده. |
| `notion_get_database`        | `read:notion`  | دریافت schema/فراداده یک پایگاه داده بر اساس شناسه.                                      |
| `notion_append_blocks`       | `write:notion` | افزودن فرزندان بلوک به یک بلوک یا صفحه موجود (حداکثر ۱۰۰ بلوک به ازای درخواست).  |

### پارامترهای ورودی

- `notion_search` — `query` (۱-۵۰۰ کاراکتر)، `pageSize` (۱-۱۰۰، پیش‌فرض ۲۰)،
  `startCursor` (اختیاری).
- `notion_get_page` — `pageId` (هگز ۳۲ کاراکتری یا UUID).
- `notion_list_block_children` — `blockId`، `pageSize` (۱-۱۰۰، پیش‌فرض ۵۰)،
  `startCursor` (اختیاری).
- `notion_query_database` — `databaseId`، `filter` (اختیاری، فرمت فیلتر Notion)،
  `sorts` (آرایه اختیاری)، `pageSize` (۱-۱۰۰، پیش‌فرض ۵۰)، `startCursor` (اختیاری).
- `notion_get_database` — `databaseId`.
- `notion_append_blocks` — `blockId`، `children` (آرایه‌ای از اشیاء بلوک)،
  `after` (موقعیت اختیاری).

### Scopeها

ابزارهای خواندن نیازمند `read:notion` و ابزار نوشتن نیازمند `write:notion` هستند.
Scopeها توسط `withScopeEnforcement()` در
`open-sse/mcp-server/server.ts` فقط زمانی که `OMNIROUTE_MCP_ENFORCE_SCOPES=true`
باشد اعمال می‌شوند؛ scopeهای مجاز فراخوان از `OMNIROUTE_MCP_SCOPES` (جدا‌شده با
کاما) یا زمینه scope کلید API احراز هویت‌شده می‌آیند. برای مدل کامل scope به
[MCP-SERVER.md](./MCP-SERVER.md) مراجعه کنید.

## Endpointها

| روش    | مسیر                   | هدف                                |
| -------- | ---------------------- | -------------------------------------- |
| `GET`    | `/api/settings/notion` | بازگرداندن `{ connected, hasToken }`.      |
| `POST`   | `/api/settings/notion` | ذخیره + اعتبارسنجی توکن یکپارچه‌سازی. |
| `DELETE` | `/api/settings/notion` | قطع اتصال (پاک‌کردن توکن ذخیره‌شده).   |

> این‌ها مسیرهای تنظیمات داشبورد هستند. **هیچ endpoint پروکسی عمومی `/v1` مربوط به Notion
> وجود ندارد** — Notion منحصراً از طریق ابزارهای MCP فوق قابل دسترسی است.

## موارد استفاده

- **پاسخ‌های مبتنی بر دانش** — اجازه دهید یک عامل `notion_search` فضای کاری را جستجو کند و
  قبل از پاسخ‌دادن نتیجه برتر را `notion_get_page` کند، تا پاسخ‌ها به اسناد داخلی واقعی ارجاع دهند.
- **گردش‌کارهای مبتنی بر پایگاه داده** — یک پایگاه داده وظایف/CRM را با
  فیلتر + مرتب‌سازی `notion_query_database` کنید، سپس ردیف‌ها را خلاصه یا دسته‌بندی کنید.
- **بازنویسی / ثبت** — `notion_append_blocks` برای افزودن یادداشت‌های جلسه،
  خلاصه‌های اجرایی یا خروجی عامل به یک صفحه موجود (فقط افزودن؛ بدون ویرایش مخرب).
- **کاوش ساختار** — `notion_list_block_children` برای پیمایش درخت بلوک یک صفحه،
  یا `notion_get_database` برای کشف schema ویژگی یک پایگاه داده قبل از پرس‌وجوی آن.

## مرتبط

- [MCP Server](./MCP-SERVER.md) — انتقال‌ها، اعمال scope، فهرست کامل ابزار.
- [منبع بافتار Obsidian](./OBSIDIAN_CONTEXT.md) — منبع بافتار داخلی دیگر.
- [سیستم حافظه](./MEMORY.md) — حافظه ماندگار مکالمه (لایه بافتار
  تکمیلی، که به‌صورت خودکار تزریق می‌شود نه با fetch ابزار).
