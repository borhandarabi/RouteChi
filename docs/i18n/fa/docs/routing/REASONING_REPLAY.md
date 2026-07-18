---
title: "کش بازپخش reasoning"
version: 3.8.40
lastUpdated: 2026-06-28
---

# کش بازپخش reasoning

> **منبع حقیقت:** `src/lib/db/reasoningCache.ts`, `open-sse/services/reasoningCache.ts`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

RouteChi محتوای `reasoning_content` دستیار که توسط مدل‌های حالت تفکر تولید شده را ضبط کرده و در درخواست‌های چندنوبتی به‌صورت شفاف بازپخش می‌کند، زمانی که پروایدر بالادست به آن نیاز دارد. این کار خطاهای HTTP 400 که پروایدرهای سخت‌گیر هنگام غیبت reasoning نوبت پیشین در تاریخچهٔ مکالمهٔ کلاینت تولید می‌کردند را از بین می‌برد.

## چرا این کش وجود دارد

چندین پروایدر حالت تفکر، نوبت پیگیری را رد می‌کنند مگر آنکه **پیام دستیار قبلی شامل `reasoning_content` اصلی** باشد. بالادست با پیام‌هایی شبیه به زیر 400 برمی‌گرداند:

```
Param Incorrect: The reasoning_content in the thinking mode must be passed back to the API.
```

اما کلاینت‌های معمول (Cursor، Cline، Roo Code، OpenAI SDK) `reasoning_content` را از تاریخی که بازپخش می‌کنند حذف می‌کنند. RouteChi آن را از یک کش سمت سرور بازیابی می‌کند تا درخششی که بالادست می‌بیند یکپارچه باشد. issue #1628 persistence ترکیبی memory/SQLite را معرفی کرد تا کش از بازراه‌اندازی فرایند جان سالم به‌در ببرد.

## معماری

```
Turn N (assistant generates):
  → response contains reasoning_content + tool_calls
  → cacheReasoningFromAssistantMessage() writes (memory + DB), keyed by every tool_call.id
  → forward response to client (which may or may not retain reasoning)

Turn N+1 (client sends follow-up):
  → translator detects: requiresReasoningReplay(provider, model) === true
  → for each assistant message with tool_calls and no reasoning_content:
      lookupReasoning(toolCalls[0].id) → memory → DB
      hit  → msg.reasoning_content = cached; recordReplay()
      miss → msg.reasoning_content = "" (legacy fallback for older DeepSeek)
  → upstream sees consistent history → no 400
```

ضبط در `open-sse/handlers/chatCore.ts` (دو محل، حدود خطوط 4093 و 4380) رخ می‌دهد. بازپخش در `open-sse/translator/index.ts` پس از تحمیل شمای (schema coercion) اما پیش از dispatch انجام می‌شود.

## ذخیره‌سازی — حافظه + SQLite ترکیبی

مسیر داغ از یک `Map` درون‌حافظه‌ای (LRU بر اساس زمان ایجاد) استفاده می‌کند که توسط یک جدول SQLite برای بازیابی پس از خرابی و قابلیت مشاهده در داشبورد پشتیبانی می‌شود.

| Layer  | Implementation                                 | Purpose                                |
| ------ | ---------------------------------------------- | -------------------------------------- |
| Memory | `Map` در `open-sse/services/reasoningCache.ts` | جست‌وجوهای سریع، قدیمی‌ترین را در ۲۰۰۰ خارج می‌کند |
| DB     | جدول `reasoning_cache` (`src/lib/db/`)        | در سراسر بازراه‌اندازی پایدار است، آمار را هدایت می‌کند |

نوشته‌ها به هر دو می‌روند. خواندن‌ها ابتدا حافظه را بررسی می‌کنند، سپس به DB بازمی‌گردند (DB hitها به حافظه ارتقا می‌یابند). شکست DB غیرمهلک است — کش درون‌حافظه‌ای به سرو کردن مسیر داغ ادامه می‌دهد.

**پیش‌فرض‌ها:**

- TTL: `2h` (`TTL_MS = 2 * 60 * 60 * 1000`)
- حداکثر ورودی‌های حافظه: `2000` (`MAX_MEMORY_ENTRIES`)
- خروج: قدیمی‌ترین `createdAt` اول

## شمای پایگاه‌داده

Migration: `src/lib/db/migrations/033_create_reasoning_cache.sql`

```sql
CREATE TABLE IF NOT EXISTS reasoning_cache (
  tool_call_id   TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  reasoning      TEXT NOT NULL,
  char_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     INTEGER NOT NULL
);
```

ایندکس‌ها: `expires_at`، `provider`، `model`، `created_at`. `expires_at` به‌صورت ثانیه‌های epoch یونیکس ذخیره می‌شود؛ لایهٔ SELECT مقادیر متنی قدیمی را از طریق `EXPIRES_AT_EPOCH_SQL` نرمال‌سازی می‌کند.

## تشخیص پروایدر / مدل

بازپخش هنگامی فعال می‌شود که `requiresReasoningReplay(provider, model)` مقدار `true` برگرداند. این تابع دو فهرست در `open-sse/services/reasoningCache.ts` را بررسی می‌کند.

**شناسه‌های پروایدر (تطابق دقیق، ناهمحساس به حروف بزرگ‌و‌کوچک):**

- `deepseek`
- `opencode-go`
- `siliconflow`
- `nebius`
- `deepinfra`
- `sambanova`
- `fireworks`
- `together`
- `xiaomi-mimo`

**الگوهای regex مدل (ناهمحساس به حروف بزرگ‌و‌کوچک):**

- `/deepseek-r1/i`
- `/deepseek-reasoner/i`
- `/deepseek-chat/i`
- `/deepseek[-/]?v4[-.]flash/i` و `/deepseek[-/]?v4[-.]pro/i` (V4 Flash / Pro، پسوند اختیاری `-free`)
- `/(deepseek|zen\/deepseek)-v4/i`
- `/kimi-k2/i`
- `/qwq/i`
- `/qwen.*think/i`
- `/glm.*think/i`
- `/^mimo[-.]?v\d/i`

افزودن یک پروایدر/مدل سخت‌گیر جدید به معنای اضافه‌کردن به یکی از این فهرست‌ها و نوشتن یک تست واحد است که تزریق بازپخش را تأیید کند. توضیحات PR باید دقیقاً رشتهٔ 400 بالادست که انگیزهٔ تغییر بوده را ذکر کند.

## REST API

کش دو اندپوینت تحت `src/app/api/cache/reasoning/route.ts` ارائه می‌کند. هر دو نیازمند احراز هویت مدیریتی هستند (`isAuthenticated` از `@/shared/utils/apiAuth`).

| Method | Endpoint                                                  | Description                                              |
| ------ | --------------------------------------------------------- | -------------------------------------------------------- |
| GET    | `/api/cache/reasoning`                                    | آمار + ورودی‌های صفحه‌بندی‌شده                            |
| GET    | `/api/cache/reasoning?provider=deepseek&model=...&limit=` | فهرست فیلترشده (`limit` به `[1, 200]` محدود می‌شود)      |
| DELETE | `/api/cache/reasoning`                                    | پاک کردن همه چیز (حافظه + DB) و بازنشانی شمارندههای hit/miss |
| DELETE | `/api/cache/reasoning?provider=deepseek`                  | فقط ورودی‌های یک پروایدر را پاک می‌کند                    |
| DELETE | `/api/cache/reasoning?toolCallId=call_abc`                | حذف یک ورودی واحد                                        |

**شکل پاسخ GET:**

```json
{
  "stats": {
    "memoryEntries": 12,
    "dbEntries": 47,
    "totalEntries": 47,
    "totalChars": 138291,
    "hits": 84,
    "misses": 6,
    "replays": 81,
    "replayRate": "90.0%",
    "byProvider": { "deepseek": { "entries": 32, "chars": 98412 } },
    "byModel": { "deepseek-reasoner": { "entries": 32, "chars": 98412 } },
    "oldestEntry": "2026-05-13T10:00:00.000Z",
    "newestEntry": "2026-05-13T11:42:11.000Z"
  },
  "entries": [
    {
      "toolCallId": "call_abc",
      "provider": "deepseek",
      "model": "deepseek-reasoner",
      "reasoning": "...",
      "charCount": 3128,
      "createdAt": "...",
      "expiresAt": "..."
    }
  ]
}
```

## یادداشت‌های عملیاتی

- **پاکسازی:** `cleanupReasoningCache()` ورودی‌های منقضی‌شدهٔ حافظه را حذف کرده و `DELETE FROM reasoning_cache WHERE expires_at <= unixepoch('now')` را اجرا می‌کند. کارگرهای health-check این کار را به‌صورت دوره‌ای فراخوانی می‌کنند.
- **بازیابی پس از خرابی:** پس از بازراه‌اندازی، حافظه خالی است اما DB هنوز ورودی‌های منقضی‌نشده را نگه می‌دارد. اولین جست‌وجو برای یک `tool_call_id` مشخص، یک DB hit است؛ جست‌وجوهای بعدی memory hit هستند.
- **بدون reasoning، بدون کش:** `cacheReasoningFromAssistantMessage` هنگامی که پیام دستیار فیلد `reasoning_content` / `reasoning` نداشته باشد، `0` برمی‌گرداند؛ بنابراین پاسخ‌های غیرتفکری هیچ هزینه‌ای ندارند.
- **پروایدرهای غیرسخت‌گیر:** هنگامی که `requiresReasoningReplay` مقدار `false` است و فرمت هدف OpenAI است، مترجم هر فیلد `reasoning_content` را از پیام‌های خروجی **حذف می‌کند** — OpenAI Chat Completions آن را نمی‌پذیرد.

## همچنین ببینید

- [RESILIENCE_GUIDE.md](../architecture/RESILIENCE_GUIDE.md) — شکستن مدار، cooldownها، قفل مدل
- [TROUBLESHOOTING.md](../guides/TROUBLESHOOTING.md) — تشخیص 400های بالادست
- Source: `src/lib/db/reasoningCache.ts`, `open-sse/services/reasoningCache.ts`, `open-sse/translator/index.ts`
- Migration: `src/lib/db/migrations/033_create_reasoning_cache.sql`
- API route: `src/app/api/cache/reasoning/route.ts`
- Original issue: #1628
