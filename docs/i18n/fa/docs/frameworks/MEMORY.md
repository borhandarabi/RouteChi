---
title: "سیستم حافظه"
version: 3.8.40
lastUpdated: 2026-06-28
---

# سیستم حافظه

> **منبع حقیقت:** `src/lib/memory/` و `src/app/api/memory/`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40 (خاموش‌بودن پیش‌فرض + به‌روزرسانی int8 quantization)

OmniRoute یک حافظه مکالمه‌ای ماندگار، کلیدبندی‌شده بر اساس API key (و
به‌صورت اختیاری شناسه نشست) ارائه می‌دهد. حافظه‌ها به‌صورت خودکار از پاسخ‌های LLM
از طریق تطبیق الگوی regex سبک استخراج می‌شوند و در درخواست‌های بعدی به‌عنوان یک
پیام system پیشرو (یا اولین پیام کاربر برای ارائه‌دهندگانی که نقش system را
رد می‌کنند) تزریق می‌گردند.

> **حافظه به‌صورت پیش‌فرض خاموش است (v3.8.30+).** `DEFAULT_MEMORY_SETTINGS.enabled`
> اکنون `false` است (`src/lib/memory/settings.ts`). فعال‌کردن حافظه تا
> `maxTokens` (حدود ۲k) از بافتار بازیابی‌شده را به **هر** درخواست چت تزریق می‌کند که
> هزینه‌بر است — هزینه‌ای غافلگیرکننده برای نصب‌های جدید و برای کلاینت‌هایی که بافتار
> خود را مدیریت می‌کنند. به‌صورت صریح تحت **Settings → Memory** فعال کنید
> (`MemorySkillsTab` یک callout هشدار هزینه توکن را هنگام فعال‌بودن حافظه نشان می‌دهد).
> یک کلاینت می‌تواند یک درخواست واحد را با هدر درخواست `x-omniroute-no-memory`
> (`true`/`1`/`yes`) مستثنی کند — به جدول هدرهای درخواست در
> [API_REFERENCE.md](../reference/API_REFERENCE.md) مراجعه کنید. یک درخواست بدون حافظه
> `memoryOwnerId = null` را تنظیم می‌کند، که **هم** تزریق حافظه و **هم** تزریق مهارت را برای
> آن درخواست غیرفعال می‌کند (`open-sse/handlers/chatCore/headers.ts::isNoMemoryRequested`).

حافظه **به ازای API key** تعیین scope می‌شود، نه به ازای کاربر — هر درخواست احراز هویت‌شده
با همان API key همان مجموعه حافظه را به اشتراک می‌گذارد، با scoping بیشتر اختیاری بر اساس `sessionId`.

## معماری

```
Client → /v1/chat/completions (apiKeyInfo resolved upstream)
  → handleChatCore() [open-sse/handlers/chatCore.ts]
    → resolveMemoryOwnerId(apiKeyInfo)        # extracts id
    → getMemorySettings()                     # cached settings
    → shouldInjectMemory(body, {enabled})     # gate
    → retrieveMemories(apiKeyId, config)      # SQL + FTS5 + optional vector
    → injectMemory(body, memories, provider)  # system or user message
  → upstream provider call
  → on response: extractFacts(text, apiKeyId, sessionId)  # non-blocking
    → setImmediate → createMemory(fact) per match
                   → embed(content) + upsertVector(id, vec)
```

محل‌های اتصال تزریق و استخراج در
`open-sse/handlers/chatCore.ts` سیم‌کشی شده‌اند (به دنبال `retrieveMemories`، `injectMemory`،
و `extractFacts` بگردید).

## معماری موتور (حل سه‌لایه‌ای)

موتور حافظه مسیر بازیابی را در زمان اجرا بر اساس زیرساخت و تنظیمات موجود حل می‌کند. سه لایه وجود دارد که به ترتیب اولویت اعمال می‌شوند:

```
  ┌─────────────────────────────────────────────────────────────┐
  │  TIER 0 — Keyword (FTS5)                                     │
  │  Always available. SQLite FTS5 full-text search over         │
  │  content + key. Used when strategy = "exact" or as fallback. │
  └──────────────────────────────────┬──────────────────────────┘
                                     │ strategy = semantic|hybrid?
                                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  TIER 1 — Embedded Vector (sqlite-vec)                       │
  │  sqlite-vec v0.1.9 loaded via db.loadExtension().            │
  │  KNN brute-force over Float32 vectors. Active when:          │
  │   • sqlite-vec loadExtension succeeds                        │
  │   • An embedding source is available (remote | static |      │
  │     transformers) that can produce a Float32Array            │
  │   • vec_memories table exists (created on first ready())     │
  └──────────────────────────────────┬──────────────────────────┘
                                     │ qdrant.enabled?
                                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  TIER 2 — Qdrant (opt-in external vector database)           │
  │  When enabled, replaces sqlite-vec for semantic/hybrid.      │
  │  Requires running Qdrant instance + configured host/port.    │
  └─────────────────────────────────────────────────────────────┘
```

تنزل خودکار و شفاف است:

- اگر sqlite-vec بارگذاری نشود، لایه ۱ در دسترس نیست → به لایه ۰ برمی‌گردد.
- اگر منبع embedding خطا برگرداند، لایه ۱ به لایه ۰ برمی‌گردد.
- اگر Qdrant ناسالم باشد، لایه ۲ به لایه ۱ (یا لایه ۰ اگر لایه ۱
  نیز در دسترس نباشد) برمی‌گردد.

## منابع embedding

لایه embedding (`src/lib/memory/embedding/`) تصمیم می‌گیرد از کدام منبع بر اساس
`MemorySettingsExtended.embeddingSource` استفاده شود:

| منبع         | توضیحات                                                                  | کلید مورد نیاز | Cold start       |
| -------------- | ---------------------------------------------------------------------------- | ------------ | ---------------- |
| `remote`       | از API embedding یک ارائه‌دهنده پیکربندی‌شده (OpenAI، Cohere و غیره) استفاده می‌کند            | بله          | هیچ             |
| `static`       | embedding جدول جستجوی محلی از طریق `potion-base-8M` (WordPiece + mean pooling) | خیر           | حدود ۲۰۰ms           |
| `transformers` | استنتاج ONNX محلی از طریق `@huggingface/transformers` v4، `all-MiniLM-L6-v2`  | خیر           | حدود ۳s + حدود ۴۰۰MB RAM |
| `auto`         | حل زمان اجرا: remote (اگر کلید موجود باشد) → static → transformers → null    | بستگی دارد      | بستگی دارد          |

**ترتیب حل برای `auto`:**

۱. یافتن اولین ارائه‌دهنده در `listEmbeddingProviders()` با `hasKey === true` → `remote`.
۲. اگر `settings.staticEnabled === true` → `static`.
۳. اگر `settings.transformersEnabled === true` → `transformers`.
۴. در غیر این صورت → `null` (تنزل به جستجوی کلیدواژه FTS5).

کش embedding (`src/lib/memory/embedding/cache.ts`) از یک نقشه
LRU درون‌حافظه‌ای با کلید `${source}:${model}:${dim}:${sha256(text)}` استفاده می‌کند، محدود به
`MEMORY_EMBEDDING_CACHE_MAX` ورودی (پیش‌فرض ۱۰۰۰) با TTL
`MEMORY_EMBEDDING_CACHE_TTL_MS` (پیش‌فرض ۵ دقیقه). در طول چرخه حیات فرآیند بین تمام فراخوانی‌کنندگان مشترک است.

## RRF هیبریدی (k=60)

وقتی `strategy = "hybrid"` و فروشگاه بردار در دسترس است، بازیابی از
Reciprocal Rank Fusion برای ادغام نتایج FTS5 و بردار استفاده می‌کند:

```
RRF(d) = Σ  1 / (k + rank_i(d))      where k = 60 (configurable via MEMORY_RRF_K)
          i
```

به‌طور مشخص:

۱. اجرای جستجوی FTS5 → فهرست رتبه‌بندی‌شده `R_fts` (موقعیت ۱..N).
۲. اجرای جستجوی بردار KNN → فهرست رتبه‌بندی‌شده `R_vec` (موقعیت ۱..M).
۳. به ازای هر `memoryId` یکتا:  
   `rrf_score = 1/(60 + fts_rank)` + `1/(60 + vec_rank)` (اگر در فهرست نباشد ۰).
۴. مرتب‌سازی بر اساس `rrf_score` نزولی، اعمال پیمایش بودجه توکن.

معروف است که RRF بدون نیاز به نرمال‌سازی امتیاز در میان سیستم‌های بازیابی
ناهمگن مؤثر است. پیش‌فرض `k=60` از مقاله اصلی
Cormack et al. گرفته شده و برای پیکره‌های کوچک (کمتر از ۱۰k حافظه) خوب کار می‌کند.

## Backfill (تنبل + reindex)

وقتی مدل embedding تغییر می‌کند (تشخیص از طریق `embedding_signature`)،
فروشگاه بردار بازسازی شده و تمام حافظه‌های موجود
`needs_reindex = 1` در جدول `memories` علامت‌گذاری می‌شوند.

**Backfill تنبل**: در بازیابی بعدی، هر حافظه‌ای که ورودی بردار ندارد
قبل از اجرای جستجو embed شده و در `vec_memories` درج می‌شود. این کار
هزینه backfill را در میان درخواست‌های واقعی توزیع می‌کند بدون اینکه startup را مسدود کند.

**Reindex صریح**: تب Engine در `/dashboard/memory` یک
دکمه "Reindex Now" ارائه می‌دهد که `POST /api/memory/reindex` را فراخوانی می‌کند. هندلر
`runReindexBatch()` از `src/lib/memory/reindex.ts` را فراخوانی می‌کند، که حداکثر
`limit` ورودی معلق را به ازای درخواست پردازش می‌کند. پیشرفت را می‌توان از طریق
`GET /api/memory/engine-status` (`vectorStore.needsReindex`) نظارت کرد.

جدول `memory_vec_meta` (migration `073_memory_vec.sql`) ذخیره می‌کند:

- `active_dim` — ابعاد بردار فعلی (null = هنوز کالیبره نشده).
- `embedding_signature` — `${source}:${model}:${dim}` برای تشخیص تغییرات.
- `last_reset_at` — مهر زمانی آخرین بازنشانی کامل.
- `vec_loaded` — پرچم ۰/۱ که آیا sqlite-vec با موفقیت بارگذاری شده است.

## توسعه تنظیمات

هفت فیلد جدید به `MemorySettingsExtended` (برنامه ۲۱، D9) در
`src/shared/schemas/memory.ts` اضافه شد، از طریق `src/lib/db/settings.ts` ماندگار می‌شوند:

| فیلد                    | نوع                                               | پیش‌فرض  | توضیحات                                      |
| ------------------------ | -------------------------------------------------- | -------- | ------------------------------------------------ |
| `embeddingSource`        | `"remote" \| "static" \| "transformers" \| "auto"` | `"auto"` | کدام منبع embedding استفاده شود                    |
| `embeddingProviderModel` | `string \| null`                                   | `null`   | ارائه‌دهنده/مدل در فرمت `provider/model`        |
| `transformersEnabled`    | `boolean`                                          | `false`  | opt-in برای Transformers.js (MiniLM، حدود ۴۰۰MB)      |
| `staticEnabled`          | `boolean`                                          | `false`  | opt-in برای مدل محلی potion-base-8M     |
| `rerankEnabled`          | `boolean`                                          | `false`  | فعال‌کردن مرحله rerank (افزودن +۲۰۰-۵۰۰ms/req)      |
| `rerankProviderModel`    | `string \| null`                                   | `null`   | ارائه‌دهنده/مدل rerank در فرمت `provider/model` |
| `vectorStore`            | `"sqlite-vec" \| "qdrant" \| "auto"`               | `"auto"` | کدام backend بردار استفاده شود                      |

این موارد از طریق `GET /PUT /api/settings/memory` (schema `MemorySettingsExtendedSchema`) exposed می‌شوند.

> **TODO (D20):** Scope `global` (اشتراک‌گذاری حافظه در میان تمام کلیدهای API)
> در این نسخه پیاده‌سازی نشده است. این نیازمند تغییرات schema و یک مسیر بازیابی
> سراسری است. به‌طور جداگانه پیگیری کنید.

## لایه‌های ذخیره‌سازی

### اصلی: SQLite (جدول `memories`)

توسط migration `015_create_memories.sql` ایجاد می‌شود:

| ستون                      | نوع               | یادداشت‌ها                                                                |
| --------------------------- | ------------------ | -------------------------------------------------------------------- |
| `id`                        | `TEXT PRIMARY KEY` | UUID تولید‌شده از طریق `crypto.randomUUID()`                             |
| `api_key_id`                | `TEXT NOT NULL`    | کلید API مالک                                                       |
| `session_id`                | `TEXT`             | scope اختیاری به ازای مکالمه                                      |
| `type`                      | `TEXT NOT NULL`    | یکی از `factual`، `episodic`، `procedural`، `semantic`               |
| `key`                       | `TEXT`             | کلید upsert پایدار، مثلاً `preference:i_prefer_python`                 |
| `content`                   | `TEXT NOT NULL`    | متن واقعی факт                                                 |
| `metadata`                  | `TEXT`             | JSON blob (category، extractedAt، source، ...)                       |
| `created_at` / `updated_at` | `TEXT`             | رشته‌های ISO 8601                                                     |
| `expires_at`                | `TEXT`             | انقضای اختیاری؛ `NULL` یعنی دائمی                              |
| `memory_id`                 | `INTEGER UNIQUE`   | توسط `023_fix_memory_fts_uuid.sql` اضافه شد تا UUIDها ← rowidهای FTS5 را پل کند |

ایندکس‌ها: `api_key_id`، `session_id`، `type`، `expires_at`، به‌علاوه ایندکس
یکتا `memory_id`.

**semantics مربوط به upsert**: `createMemory()` به دنبال یک ردیف موجود با همان
`(api_key_id, key)` می‌گردد و در صورت یافتن آن را در محل به‌روزرسانی می‌کند (ادغام `metadata` از طریق
shallow spread). این کار جلوگیری می‌کند جدول برای عبارات ترجیحی تکراری به‌طور نامحدود رشد کند.

### جستجوی full-text (جدول مجازی `memory_fts`)

`022_add_memory_fts5.sql` یک جدول مجازی FTS5 روی `content` و
`key` ایجاد می‌کند. `023_fix_memory_fts_uuid.sql` یک باگ دنیای واقعی را اصلاح می‌کند که در آن
کلید اصلی UUID به rowid عدد صحیح FTS5 متصل نمی‌شد — migration
ستون `memory_id` را اضافه می‌کند، جدول FTS را بازسازی می‌کند، و triggerهایی
(`memory_fts_ai`، `memory_fts_ad`، `memory_fts_au`) را سیم‌کشی می‌کند که FTS را در
INSERT، DELETE، و UPDATE همگام نگه می‌دارند.

توسط `retrieval.ts` برای استراتژی‌های `semantic` و `hybrid` استفاده می‌شود (به زیر مراجعه کنید).
کد بازیابی با `hasTable("memory_fts")` محافظت می‌شود و در صورت مفقودبودن جدول FTS یا پرتاب خطای FTS به
ترتیب زمانی برمی‌گردد.

### اختیاری: Qdrant (لایه ۲ فروشگاه بردار)

`src/lib/memory/qdrant.ts` یک یکپارچه‌سازی اختیاری Qdrant به‌عنوان فروشگاه بردار لایه ۲
پیاده‌سازی می‌کند. بازیابی تنها زمانی به Qdrant هدایت می‌شود که انتخابگر موتور
`memoryVectorStore === "qdrant"` باشد — پیش‌فرض `"auto"` (و `"sqlite-vec"`)
**هرگز** Qdrant را انتخاب نمی‌کنند. toggle تب Engine **هم** `qdrantEnabled` و
`memoryVectorStore` را با هم تنظیم می‌کند: فعال‌کردن Qdrant را به‌عنوان فروشگاه اصلی می‌سازد، غیرفعال‌کردن
به `"auto"` بازنشانی می‌کند (#5597 — قبل از آن اصلاح، فعال‌کردن بی‌اثر بود زیرا هیچ‌چیز
انتخابگر موتور را نمی‌نوشت). اگر Qdrant غیرقابل دسترس باشد یا چیزی برنگرداند، بازیابی
به sqlite-vec → FTS5 برمی‌گردد.

- `upsertSemanticMemoryPoint()` — `key + content` را با مدل
  embedding پیکربندی‌شده embed می‌کند، اطمینان حاصل می‌کند collection موجود است (در اولین استفاده بردارهای
  cosine-distance ایجاد می‌کند)، و یک point با payload `{memoryId,
  apiKeyId, sessionId, key, content, metadata, createdAtUnix, expiresAtUnix}` را upsert می‌کند.
- `searchSemanticMemory(query, topK, scope)` — پرس‌وجو را embed می‌کند، collection را
  جستجو می‌کند فیلتر شده بر اساس `kind = "omniroute_memory"` و به‌صورت اختیاری بر اساس
  `apiKeyId` / `sessionId`. `topK` را به `[1, 20]` محدود می‌کند.
- `deleteSemanticMemoryPoint(id)` — حذف یک point. توسط
  `deleteMemory()` پس از حذف ردیف SQLite فراخوانی می‌شود (D15).
- `cleanupSemanticMemoryPoints({retentionDays})` — حذف انبوه pointهایی که
  `expiresAtUnix` آنها در گذشته است یا `createdAtUnix` آنها قدیمی‌تر از حد
  retention است. ابتدا شمارش می‌کند تا داشبورد بتواند اعداد واقعی را نشان دهد.
- `checkQdrantHealth()` — پروب سلامت `GET /readyz` با latency.

رابط تنظیمات پیکربندی Qdrant، بررسی سلامت، تست جستجوی semantic،
و پاک‌سازی را در **تب Engine** `/dashboard/memory` exposed می‌کند. مسیرهای
مربوطه زیر `src/app/api/settings/qdrant/` از v3.8.6 همگی سیم‌کشی شده‌اند:

| مسیر                                   | روش        | توضیحات                     |
| --------------------------------------- | ------------- | ------------------------------- |
| `/api/settings/qdrant`                  | `GET` / `PUT` | خواندن / به‌روزرسانی تنظیمات Qdrant   |
| `/api/settings/qdrant/health`           | `GET`         | پروب زنده‌بودن + latency        |
| `/api/settings/qdrant/search`           | `POST`        | تست جستجوی semantic            |
| `/api/settings/qdrant/cleanup`          | `POST`        | حذف pointهای منقضی / قدیمی     |
| `/api/settings/qdrant/embedding-models` | `GET`         | فهرست مدل‌های embedding در دسترس |

**یادداشت‌های رفتاری (انتظارات):**

- **انتخاب موتور** — فعال‌کردن Qdrant در تب Engine آن را به فروشگاه اصلی
  می‌سازد (`memoryVectorStore="qdrant"` را تنظیم می‌کند)؛ غیرفعال‌کردن به `"auto"` بازنشانی می‌کند (#5597).
- **بدون back-fill** — فقط حافظه‌هایی که **پس از** فعال‌شدن Qdrant ایجاد/به‌روزرسانی می‌شوند
  در آن نوشته می‌شوند (dual-write از نوع fire-and-forget). حافظه‌های SQLite از پیش موجود
  منتقل **نمی‌شوند**؛ "Reindex Now" فقط ایندکس sqlite-vec را بازسازی می‌کند، نه Qdrant را.
- **ابعاد بردار به‌صورت خودکار** در اولین استفاده از embedding واقعی تشخیص داده می‌شود — هیچ
  فیلد ابعادی برای پر کردن وجود ندارد. تغییر مدل embedding پس از موجودبودن یک collection
  به‌صورت خودکار هندل **نمی‌شود**: collection موجود دست‌نخورده باقی می‌ماند، نوشتن/جستجوهای
  با ابعاد ناهماهنگ شکست می‌خورند و به sqlite-vec برمی‌گردند. برای تغییر embedder
  collection را بازسازی کنید (نام جدید، یا در Qdrant حذف کنید).
- **معیار فاصله** — همیشه **Cosine** (در ایجاد collection hardcoded شده است؛
  قابل پیکربندی نیست).
- **احراز هویت** — فقط API key (به‌عنوان هدر `api-key` ارسال می‌شود؛ برای Docker محلی
  غیراحراز هویت‌شده اختیاری است). JWT/RBAC استفاده نمی‌شوند.
- **فیلدهای پیکربندی** — رابط کاربری `host`، `port`، `collection`، `embeddingModel`،
  `apiKey` را exposed می‌کند. `vectorSize` / `hnswEfConstruct` فقط env/DB هستند و `vectorSize`
  برای ایجاد collection استفاده نمی‌شود (ابعاد از embedding می‌آید).

### Quantization بردار (int8 — opt-in، هر دو backend)

هر دو backend بردار از **quantization int8 opt-in** پشتیبانی می‌کنند تا ردپای حافظه
بردارهای ذخیره‌شده را کاهش دهد (حدود ۴ برابر کوچک‌تر از Float32) با هزینه کوچکی در recall.
پیش‌فرض روی هر دو **خاموش** است — بردارها با دقت کامل باقی می‌مانند مگر اینکه به‌صراحت
فعال شوند.

| Backend    | تنظیم                         | نوع                           | پیش‌فرض  | محل خوانده شدن                                                  |
| ---------- | ------------------------------- | ------------------------------ | -------- | ----------------------------------------------------------- |
| Qdrant     | `qdrantQuantization` (کلید DB)   | `"none" \| "int8" \| "binary"` | `"none"` | `src/lib/memory/qdrant.ts::normalizeQdrantConfig()`         |
| sqlite-vec | `MEMORY_VEC_QUANTIZATION` (env) | `"none" \| "int8"`             | `"none"` | `src/lib/memory/vectorStore.ts::requestedVecQuantization()` |

- **Qdrant** به ازای نمونه از طریق کلید تنظیم `qdrantQuantization`
  پیکربندی می‌شود (به‌عنوان فیلد `quantization` در `PUT /api/settings/qdrant` exposed می‌شود). وقتی
  `"int8"` است، `buildQuantizationConfig()` quantization اسکالر درخواست می‌کند
  (`always_ram`, quantile `0.99`) و جستجوها `rescore: true` را فعال می‌کنند تا
  بردارهای با دقت کامل مجموعه کاندیدای int8 را اصلاح کنند.
- **quantization sqlite-vec** **فقط محیطی** است (یک تنظیم DB نیست):
  `MEMORY_VEC_QUANTIZATION=int8` را تنظیم کنید تا بردارهای محلی به‌عنوان یک ستون
  `int8[dim]` از طریق `vec_quantize_int8(?, 'unit')` ذخیره شوند. حالت انتخاب‌شده در
  `embedding_signature` (یک پسوند `:int8`) تا می‌شود، بنابراین تغییر حالت یک reindex کامل
  جدول `vec_memories` را تحریک می‌کند — همان مسیر backfill تنبل استفاده‌شده وقتی
  مدل embedding تغییر می‌کند.

## انواع حافظه

`MemoryType` (`src/lib/memory/types.ts`):

| نوع         | مورد استفاده برای                                                     |
| ------------ | ------------------------------------------------------------ |
| `factual`    | ترجیحات، حقایق پایدار کاربر، الگوهای رفتاری          |
| `episodic`   | تصمیمات مرتبط با یک لحظه خاص ("من Postgres را انتخاب کردم")     |
| `procedural` | حافظه گردش‌کار / how-to (رزرو‌شده؛ امروزه استخراج‌کننده خودکار ندارد) |
| `semantic`   | رزرو‌شده برای ورودی‌های فروشگاه بردار                            |

استراتژی بازیابی `MemoryConfig` یکی از `exact`، `semantic` یا `hybrid` است،
و scope یکی از `session`، `apiKey` یا `global` است. scope پیش‌فرض از
`getMemorySettings()` برابر `apiKey` است.

## استخراج فکت (`extraction.ts`)

استخراج **مبتنی بر regex** است، نه مبتنی بر LLM — در فرآیند با
`setImmediate()` اجرا می‌شود تا هرگز جریان پاسخ را مسدود نکند:

- **الگوهای ترجیح** → `MemoryType.FACTUAL`
  (مثلاً `I prefer …`، `I really like …`، `my favorite is …`، `I hate …`)
- **الگوهای تصمیم** → `MemoryType.EPISODIC`
  (مثلاً `I'll use …`، `I chose …`، `I went with …`، `I'm going to adopt …`)
- **الگوهای رفتاری** → `MemoryType.FACTUAL`
  (مثلاً `I usually …`، `I always …`، `I tend to …`)

هر تطبیق پاک‌سازی می‌شود (`trim`, فروپاشی فضای سفید، محدود به ۵۰۰ کاراکتر)،
در داخل دسته از طریق یک `factKey(category, content)` پایدار عدم‌تکرار می‌شود، و
از طریق `createMemory()` با فراداده
`{category, extractedAt, source: "llm_response"}` ذخیره می‌شود. متن ورودی محدود به
۵۰۰۰ کاراکتر است.

## بازیابی (`retrieval.ts`)

`retrieveMemories(apiKeyId, config)` نقطه ورود اصلی است. این تابع:

۱. پیکربندی را از طریق `MemoryConfigSchema` نرمال و اعتبارسنجی می‌کند.
۲. وقتی `enabled` false است یا `maxTokens <= 0`، بلافاصله `[]` برمی‌گرداند.
۳. `maxTokens` را به `[1, 8000]` محدود می‌کند.
۴. تشخیص می‌دهد که آیا جدول مدرن `memories` وجود دارد (در مقابل جدول legacy `memory`)
   تا پایگاه‌های داده قدیمی به کار ادامه دهند.
۵. پرس‌وجوی پایه را با محافظ انقضای
   (`expires_at IS NULL OR datetime(expires_at) > datetime('now')`)، scope اختیاری
   نشست، و حد `retentionDays` اختیاری می‌سازد.
۶. بر اساس استراتژی شاخه می‌شود:
   - **`exact`** (پیش‌فرض): `ORDER BY created_at DESC LIMIT 100` زمانی.
   - **`semantic`**: اگر `config.query` و `memory_fts` وجود داشته باشند، JOIN
     `memory_fts MATCH ?` و مرتب بر اساس رتبه FTS؛ در صورت صفر برگرداندن ردیف توسط FTS به زمانی برمی‌گردد.
   - **`hybrid`**: اجتماع نتایج FTS (مرتبط بودن بالاتر) و مجموعه
     زمانی، عدم‌تکرار بر اساس id.
۷. یک امتیاز مرتبط بودن کلیدواژه (`getRelevanceScore`) را روی
   `content`، `key` و JSON `metadata` هنگام ارائه پرس‌وجو محاسبه می‌کند. ردیف‌هایی با
   امتیاز صفر فیلتر می‌شوند.
۸. مرتب‌سازی بر اساس امتیاز نزولی، سپس `createdAt` نزولی.
۹. در فهرست رتبه‌بندی‌شده پیمایش کرده و ورودی‌ها را تا زمانی که یک `estimateTokens(content)`
   در حال اجرا (حدود `length / 4`) زیر بودجه بماند می‌پذیرد. همیشه
   حداقل یک ورودی هنگام تطبیق هر مورد برمی‌گرداند.

`estimateTokens` export شده و توسط بازیابی، خلاصه‌سازی، و ابزار
MCP `omniroute_memory_search` استفاده می‌شود.

## تزریق (`injection.ts`)

`injectMemory(request, memories, provider)`:

۱. تمام محتوای حافظه‌ها را به یک رشته `Memory context: …` واحد می‌چسباند.
۲. یک استراتژی بر اساس نام ارائه‌دهنده انتخاب می‌کند:
   - **پیام system** (پیش‌فرض برای OpenAI، Anthropic، Gemini، …) — یک
     `{role: "system", content: memoryText}` را قبل از هر پیام system موجود prepend می‌کند
     تا پیام‌های system کاربر همچنان تقدم داشته باشند.
   - **پیام کاربر** (fallback) — برای ارائه‌دهندگان در
     `PROVIDERS_WITHOUT_SYSTEM_MESSAGE`: `o1`، `o1-mini`، `o1-preview`،
     `glm`، `glmt`، `glm-cn`، `zai`، `qianfan`. این‌ها نقش system را رد می‌کنند
     و در غیر این صورت ۴۰۰ می‌دادند (به issue #1701 برای GLM/Zhipu مراجعه کنید).
۳. تعداد، استراتژی، و مدل را تحت `memory.injection.injected` ثبت می‌کند.

`providerSupportsSystemMessage(provider)` برای فراخوانی‌کنندگانی که نیاز به
تصمیم‌گیری مسیریابی خود دارند export شده است. ارائه‌دهندگان ناشناخته به‌طور پیش‌فرض `true`
(نقش system مجاز) برای ایمنی هستند.

## تنظیمات (`settings.ts`)

پیکربندی حافظه **در جدول تنظیمات DB ذخیره می‌شود**، نه در متغیرهای env.
`getMemorySettings()` از `getSettings()` می‌خواند و نتیجه را
در فرآیند کش می‌کند؛ `invalidateMemorySettingsCache()` پس از نوشتن توسط مسیر PUT تنظیمات فراخوانی می‌شود.

### فیلدهای legacy (تمام نسخه‌ها)

| کلید DB                | نوع    | پیش‌فرض                                            | کنترل رابط کاربری                                      |
| --------------------- | ------- | -------------------------------------------------- | ----------------------------------------------- |
| `memoryEnabled`       | boolean | `false` (خاموش به‌صورت پیش‌فرض از v3.8.30)             | حافظه روشن/خاموش                                   |
| `memoryMaxTokens`     | integer | `2000` (محدوده `0–16000`)                           | بودجه توکن برای تزریق                      |
| `memoryRetentionDays` | integer | `30` (محدوده `1–365`)                               | پنجره retention                                |
| `memoryStrategy`      | enum    | `"hybrid"` (یکی از `recent`، `semantic`، `hybrid`) | استراتژی بازیابی                              |
| `skillsEnabled`       | boolean | `false`                                            | تزریق مهارت به ازای کلید را toggle می‌کند (به SKILLS.md مراجعه کنید) |

نکته: استراتژی رابط کاربری `"recent"` از طریق `toMemoryRetrievalConfig()` به استراتژی بازیابی داخلی `"exact"`
نگاشت می‌شود (ترتیب زمانی).

### فیلدهای جدید (v3.8.6، برنامه ۲۱ D9)

همچنین به بخش "توسعه تنظیمات" بالا برای توضیحات فیلد مراجعه کنید.

| کلید DB                      | فیلد API                | پیش‌فرض  |
| --------------------------- | ------------------------ | -------- |
| `memoryEmbeddingSource`     | `embeddingSource`        | `"auto"` |
| `memoryEmbeddingModel`      | `embeddingProviderModel` | `null`   |
| `memoryTransformersEnabled` | `transformersEnabled`    | `false`  |
| `memoryStaticEnabled`       | `staticEnabled`          | `false`  |
| `memoryRerankEnabled`       | `rerankEnabled`          | `false`  |
| `memoryRerankModel`         | `rerankProviderModel`    | `null`   |
| `memoryVectorStore`         | `vectorStore`            | `"auto"` |

کلیدهای DB مربوط به Qdrant (`qdrantEnabled`، `qdrantHost`، `qdrantPort`،
`qdrantApiKey`، `qdrantCollection` پیش‌فرض `"omniroute_memory"`،
`qdrantEmbeddingModel` پیش‌فرض `"openai/text-embedding-3-small"`) توسط
`normalizeQdrantConfig()` در `qdrant.ts` خوانده می‌شوند.

### متغیرهای محیطی (v3.8.6)

شش متغیر env اختیاری رفتار زمان اجرای موتور را تنظیم می‌کنند (در `.env.example` مستند شده‌اند):

| متغیر                        | پیش‌فرض                    | توضیحات                                                                                                    |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `MEMORY_EMBEDDING_CACHE_TTL_MS` | `300000`                   | TTL کش embedding (۵ دقیقه)                                                                                    |
| `MEMORY_EMBEDDING_CACHE_MAX`    | `1000`                     | حداکثر ورودی‌ها در کش LRU embedding                                                                             |
| `MEMORY_TRANSFORMERS_MODEL`     | `Xenova/all-MiniLM-L6-v2`  | repo مربوط به HF برای مدل Transformers.js                                                                              |
| `MEMORY_STATIC_MODEL`           | `minishlab/potion-base-8M` | repo مربوط به HF برای مدل potion استاتیک                                                                                |
| `MEMORY_STATIC_CACHE_DIR`       | `<DATA_DIR>/embeddings`    | محل ذخیره مدل‌های دانلود‌شده                                                                               |
| `MEMORY_VEC_TOP_K`              | `20`                       | پیش‌فرض top-K برای جستجوی بردار                                                                                |
| `MEMORY_RRF_K`                  | `60`                       | ثابت RRF k برای جستجوی هیبریدی                                                                               |
| `MEMORY_VEC_QUANTIZATION`       | `none`                     | روی `int8` تنظیم کنید تا بردارهای محلی sqlite-vec quantize شوند (حدود ۴ برابر کوچک‌تر؛ opt-in). تغییر حالت یک reindex تحریک می‌کند. |

## خلاصه‌سازی (`summarization.ts`)

`summarizeMemories(apiKeyId, sessionId?, maxTokens = 4000)` محتوای قدیمی‌تر را
وقتی مجموع توکن در حال اجرا روی حافظه‌های یک کلید از بودجه فراتر می‌رود فشرده می‌کند. این تابع ردیف‌ها را DESC بر اساس `created_at` پیمایش می‌کند، ردیف‌هایی که جا می‌شوند را نگه می‌دارد، و برای
بقیه `content` را در محل با سه جمله اول
اصل جایگزین می‌کند. `tokensSaved` تفاوت در `estimateTokens` بین محتوای قدیم و
جدید است.

این روال **در دسترس است اما به‌طور خودکار فراخوانی نمی‌شود** در pipeline چت
فعلی — آن را از یک cron، یک اقدام ادمین، یا
چسب `MemoryConfig.autoSummarize` فراخوانی کنید اگر به فشرده‌سازی مداوم نیاز دارید. از دست رفتن داده
یک‌طرفه است: متن اصلی بازنویسی می‌شود.

## REST API

تمام endpointها نیازمند auth مدیریت (`requireManagementAuth`) هستند.

### Endpointهای حافظه اصلی (موجود + به‌روزرسانی‌شده)

| روش    | مسیر                 | توضیحات                                                                                                                                                                      |
| -------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/memory`        | فهرست صفحه‌بندی‌شده با فیلترها: `apiKeyId`، `type`، `sessionId`، `q`، `limit`، `page`، `offset`. پاسخ شامل `stats.total`، `stats.tokensUsed`، `stats.hitRate`، `cacheStats` است |
| `POST`   | `/api/memory`        | ایجاد ورودی (اعتبارسنجی‌شده با Zod: `content`، `key`، اختیاری `type`، `sessionId`، `apiKeyId`، `metadata`، `expiresAt`). `createMemory()` را فراخوانی می‌کند که روی `(apiKeyId, key)` upsert می‌کند     |
| `GET`    | `/api/memory/[id]`   | دریافت یک ورودی واحد بر اساس UUID                                                                                                                                                     |
| `PUT`    | `/api/memory/[id]`   | به‌روزرسانی فیلدهای ورودی (`type`، `key`، `content`، `metadata`). بدنه: `MemoryUpdatePutSchema`. همچنین بردار را در صورت موجودبودن منبع embedding همگام می‌کند.                                      |
| `DELETE` | `/api/memory/[id]`   | حذف یک ورودی؛ همچنین از `vec_memories` (D15) و Qdrant best-effort حذف می‌کند. هنگام مفقودبودن ۴۰۴ برمی‌گرداند.                                                                        |
| `GET`    | `/api/memory/health` | `verifyExtractionPipeline("health-check")` را اجرا می‌کند — رفت‌وبرگشت create→list→delete. `{working, latencyMs, error?}` برمی‌گرداند                                                          |

### Endpointهای جدید موتور حافظه (برنامه ۲۱)

| روش | مسیر                              | توضیحات                                                                                                                                          |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/memory/retrieve-preview`    | Dry-run مربوط به `retrieveMemories` — نتایج رتبه‌بندی‌شده با امتیاز، لایه، توکن برمی‌گرداند. بدنه: `RetrievePreviewSchema`. حافظه‌ها را تزریق یا تغییر نمی‌دهد.  |
| `GET`  | `/api/memory/embedding-providers` | ارائه‌دهندگانی با مدل‌های embedding را فهرست می‌کند، نشان می‌دهد کدام دارای API key پیکربندی‌شده هستند.                                                                   |
| `GET`  | `/api/memory/engine-status`       | وضعیت کامل موتور: لایه کلیدواژه، حل embedding، آمار فروشگاه بردار، سلامت Qdrant، پیکربندی rerank. شکل: `MemoryEngineStatusSchema`. |
| `POST` | `/api/memory/summarize`           | راه‌اندازی دستی فشرده‌سازی حافظه. بدنه: `MemorySummarizeSchema` (`olderThanDays`، `apiKeyId?`، `dryRun`). `{candidates, tokensSaved}` برمی‌گرداند.     |
| `POST` | `/api/memory/reindex`             | راه‌اندازی reindex بردار برای حافظه‌های با `needs_reindex=1`. بدنه: `MemoryReindexSchema` (`force`). `{started, pending}` برمی‌گرداند.                     |

### Endpointهای تنظیمات

| روش | مسیر                                    | توضیحات                                                                                      |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/settings/memory`                  | `MemorySettingsExtended` نرمال‌شده فعلی (۷ فیلد جدید + legacy)                              |
| `PUT`  | `/api/settings/memory`                  | به‌روزرسانی هر فیلد از `MemorySettingsExtendedSchema` (در مجموع ۱۲ فیلد)                           |
| `GET`  | `/api/settings/qdrant`                  | تنظیمات فعلی Qdrant (`QdrantSettingsSchema`)                                                 |
| `PUT`  | `/api/settings/qdrant`                  | به‌روزرسانی تنظیمات Qdrant. بدنه: `QdrantSettingsUpdateSchema`. `apiKey` = رشته خالی کلید را حذف می‌کند. |
| `GET`  | `/api/settings/qdrant/health`           | پروب زنده‌بودن در برابر نمونه Qdrant پیکربندی‌شده. `QdrantHealthResultSchema` برمی‌گرداند.           |
| `POST` | `/api/settings/qdrant/search`           | تست جستجوی semantic در برابر Qdrant. بدنه: `QdrantSearchSchema` (`query`, `topK`).               |
| `POST` | `/api/settings/qdrant/cleanup`          | حذف pointهای Qdrant برای حافظه‌های منقضی / قدیمی.                                                 |
| `GET`  | `/api/settings/qdrant/embedding-models` | فهرست مدل‌های embedding در دسترس برای Qdrant.                                                      |

پرس‌وجوی فهرست `/api/memory` هم صفحه‌بندی مبتنی بر `page`
(`parsePaginationParams`) **یا** `offset` خام را پشتیبانی می‌کند — وقتی `offset` موجود باشد
تقدم دارد و یک `page` مشتق‌شده برای شکل پاسخ محاسبه می‌شود.

## ابزارهای MCP (`open-sse/mcp-server/tools/memoryTools.ts`)

وقتی MCP server فعال است، سه ابزار حافظه ثبت می‌شوند:

- `omniroute_memory_search` — `{apiKeyId, query?, type?, maxTokens?, limit?}`
  → `retrieveMemories()` را wrap می‌کند. از v3.8.6 (D16)، `strategy` از
  `getMemorySettings()` خوانده می‌شود نه اینکه به `"exact"` hardcoded شده باشد. اگر
  `query` ارائه شده و `strategy` بر `semantic` یا `hybrid` باشد، فروشگاه
  بردار در صورت موجودبودن استفاده می‌شود.
- `omniroute_memory_add` — `{apiKeyId, sessionId?, type, key, content,
metadata?}` → `createMemory()` را wrap می‌کند. فقط ۴ نوع کانونیکال را می‌پذیرد:
  `factual`، `episodic`، `procedural`، `semantic` (D17).
- `omniroute_memory_clear` — `{apiKeyId, type?, olderThan?}` → ورودی‌های تطبیقی را فهرست می‌کند،
  به‌صورت اختیاری بر اساس مهر زمانی created-before فیلتر می‌کند، سپس هر کدام را
  از طریق `deleteMemory()` حذف می‌کند (که همچنین بردارها را از sqlite-vec + Qdrant حذف می‌کند).

به [MCP-SERVER.md](./MCP-SERVER.md) برای جزئیات انتقال و scope مراجعه کنید.

## داشبورد (استودیوی حافظه)

`src/app/(dashboard)/dashboard/memory/page.tsx` اکنون یک **استودیوی ۳ تب** است:

### تب: حافظه‌ها

- کارت مفهوم (توضیح‌دهنده "How it works" قابل جمع‌شدن).
- فهرست، جستجو و صفحه‌بندی در زمان واقعی (debounce شده ۳۰۰ ms).
- فیلتر نوع (`factual` / `episodic` / `procedural` / `semantic` / همه).
- مودال افزودن حافظه (کلید، محتوا، نوع).
- ویرایش درجا (دکمه مداد → `PUT /api/memory/[id]`).
- حذف به ازای ردیف (با دیالوگ تأیید).
- خروجی JSON صفحه فعلی؛ import JSON از طریق انتخابگر فایل.
- کارت‌های آماری: `totalEntries`، `tokensUsed`، `hitRate`.
- دکمه "Compact old" → `POST /api/memory/summarize` (ابتدا dry-run تعداد
  کاندید را نشان می‌دهد، سپس تأیید می‌کند).
- یک نقطه سلامت سبز/قرمز هدایت‌شده توسط `GET /api/memory/health`.

### تب: Playground

- ورودی پرس‌وجو + انتخابگر استراتژی (Exact / Semantic / Hybrid) + بودجه توکن.
- "Simulate" → `POST /api/memory/retrieve-preview` — نتایج رتبه‌بندی‌شده با
  `score`، `tier`، `tokens`، `vecScore`، `ftsScore` را نشان می‌دهد.
- پنل حل نشان می‌دهد از کدام منبع embedding / فروشگاه بردار استفاده شده و
  آیا fallback رخ داده است.

### تب: Engine

- پنل وضعیت موتور (چیپ FTS5 کلیدواژه، چیپ embedding، چیپ فروشگاه بردار،
  چیپ سلامت Qdrant، چیپ rerank).
- دکمه "Reindex Now" → `POST /api/memory/reindex`.
- انتخابگر منبع embedding (auto / remote / static / transformers + toggleها).
- کارت پیکربندی Qdrant (toggle فعال، host/port/collection/key، تست اتصال،
  تست جستجوی semantic، پاک‌سازی).
- کارت پیکربندی rerank (toggle فعال، انتخابگر ارائه‌دهنده/مدل).

تنظیمات حافظه و Qdrant همچنین تحت
`/dashboard/settings → Memory & Skills` (`MemorySkillsTab.tsx`) برای
سطح تنظیمات legacy/سراسری قرار دارند.

## کش‌کردن

`src/lib/memory/store.ts` یک کش درون‌فرآیندی تقریباً LRU
(`MEMORY_CACHE_TTL = ۵ دقیقه`، `MEMORY_MAX_CACHE_SIZE = ۱۰ ۰۰۰`، با ۲۰ %
اخراج قدیمی‌ترین) برای خواندن‌های `getMemory(id)` نگه می‌دارد، به‌علاوه یک لایه
key/value عمومی `memoryCache` (`src/lib/memory/cache.ts`) با متدهای `get`/`set`/`invalidate`
که توسط فراخوانی‌کنندگانی که کش scope‌شده خود را می‌خواهند استفاده می‌شود (LRU با ۱ ۰۰۰ ورودی،
TTL پیش‌فرض ۵ دقیقه).

## حریم خصوصی و چرخه حیات

- مالکیت حافظه شناسه کلید API است (`resolveMemoryOwnerId` در
  `chatCore.ts`). بدون یک `apiKeyInfo.id` نه بازیابی، نه تزریق و نه
  استخراج اجرا می‌شود.
- ورودی‌ها با یک `expires_at` در آینده از بازیابی فیلتر می‌شوند؛ ورودی‌های قدیمی
  فراتر از `retentionDays` توسط شرط
  `created_at >= cutoff` در `retrieveMemories` مستثنی می‌شوند.
- برای حذف سخت، از `DELETE /api/memory/[id]` یا `omniroute_memory_clear` استفاده کنید.
- استخراج fire-and-forget از طریق `setImmediate` است؛ شکست‌ها تحت
  `memory.extraction.background.failed` ثبت می‌شوند و هرگز به فراخوانی‌کننده surface نمی‌شوند.
- رفت‌وبرگشت‌های تأیید (`verifyExtractionPipeline`) ورودی‌های تست خود را در یک
  بلوک `finally` پاک‌سازی می‌کنند.

## همچنین ببینید

- [SKILLS.md](./SKILLS.md) — تنظیم `skillsEnabled` تعاریف ابزار را در کنار
  حافظه تزریق می‌کند.
- [MCP-SERVER.md](./MCP-SERVER.md) — انتقال / scopeهای MCP.
- [API_REFERENCE.md](../reference/API_REFERENCE.md) — سطح گسترده‌تر API.
- ماژول‌های منبع:
  - `src/lib/memory/types.ts`، `schemas.ts`
  - `src/lib/memory/store.ts`، `retrieval.ts`، `injection.ts`، `reindex.ts`
  - `src/lib/memory/extraction.ts`، `summarization.ts`، `verify.ts`
  - `src/lib/memory/settings.ts`، `qdrant.ts`، `cache.ts`
  - `src/lib/memory/vectorStore.ts` — sqlite-vec + RRF هیبریدی
  - `src/lib/memory/embedding/index.ts` — لایه embedding چندمنبعی
  - `src/lib/memory/embedding/types.ts`، `remote.ts`، `staticPotion.ts`،
    `transformersLocal.ts`، `cache.ts`
  - `src/shared/schemas/memory.ts` — schemaهای Zod برای تمام بدنه‌های API حافظه
  - `src/shared/schemas/qdrant.ts` — schemaهای Zod برای تنظیمات/عملیات Qdrant
  - `src/lib/db/memoryVec.ts` — CRUD برای `memory_vec_meta`
  - `src/lib/db/migrations/015_create_memories.sql`،
    `022_add_memory_fts5.sql`، `023_fix_memory_fts_uuid.sql`،
    `073_memory_vec.sql`
  - `src/app/api/memory/route.ts`، `[id]/route.ts`، `health/route.ts`
  - `src/app/api/memory/retrieve-preview/route.ts`
  - `src/app/api/memory/engine-status/route.ts`
  - `src/app/api/memory/embedding-providers/route.ts`
  - `src/app/api/memory/summarize/route.ts`
  - `src/app/api/memory/reindex/route.ts`
  - `src/app/api/settings/memory/route.ts`
  - `src/app/api/settings/qdrant/route.ts` + sub-routes
  - `src/app/(dashboard)/dashboard/memory/` — رابط کاربری استودیو (صفحه + کامپوننت‌ها +
    تب‌ها + hookها)
  - `open-sse/handlers/chatCore.ts` (سیم‌کشی تزریق / استخراج)
  - `open-sse/mcp-server/tools/memoryTools.ts`

---

## انتخاب یک ارائه‌دهنده embedding (v3.8.16+)

موتور حافظه OmniRoute از **چهار منبع embedding** (`src/lib/memory/embedding/`) پشتیبانی می‌کند. هر کدام در **latency، هزینه، کیفیت مدل و پیچیدگی راه‌اندازی** موارد مبادله متفاوتی دارند.

### چهار ارائه‌دهنده

| ارائه‌دهنده       | منبع                                     | latency                         | هزینه                 | کیفیت                    | راه‌اندازی              |
| -------------- | ------------------------------------------ | ------------------------------- | -------------------- | -------------------------- | ------------------ |
| `transformers` | مدل ONNX محلی (Xenova/all-MiniLM-L6-v2) | ~50-150ms (CPU)                 | رایگان                 | خوب                       | فقط `npm install` |
| `static`       | بردارهای از پیش محاسبه‌شده (کش‌شده)              | <1ms                            | رایگان                 | N/A (بستگی به کش hit دارد) | هیچ               |
| `remote`       | OpenAI / Cohere / Voyage API               | ~100-300ms                      | $0.02-0.10/1M tokens | عالی                  | API key            |
| `cache`        | لایه LRU درون‌حافظه‌ای روی هر منبع        | <1ms (hit)، latency کامل (miss) | رایگان                 | مشابه منبع زیرین         | هیچ               |

### درخت تصمیم

```
                  زمینه استقرار شما چیست?
                  │
      ┌───────────┼───────────┬──────────────┐
      │           │           │              │
  DEV/TEST    SMALL PROD   LARGE PROD    EDGE / OFFLINE
      │           │           │              │
      ▼           ▼           ▼              ▼
  transformers transformers remote (Qdrant) transformers
  (رایگان، بدون API)            (بهترین کیفیت)   (بدون اینترنت)
      │           │           │              │
      └────────┬──┴───────────┴──────────────┘
               │
               ▼
            همیشه لایه `cache` را روی اضافه کنید
            (LruCache هر ارائه‌دهنده‌ای را wrap می‌کند)
```

### پیکربندی پایگاه داده و API

گزینه‌های embedding حافظه از طریق رابط کاربری/API تنظیمات پیکربندی می‌شوند، نه متغیرهای محیطی. کلیدهای پایگاه داده تنظیمات مرتبط زیر Settings (`normalizeMemorySettings` در `src/lib/memory/settings.ts`) عبارتند از:

- `memoryEmbeddingSource`: `"transformers"` (محلی)، `"remote"` (مبتنی بر API، مثلاً OpenAI)، `"static"` (ذخیره خارجی)، یا `"auto"`
- `memoryEmbeddingProviderModel`: شناسه مدل برای منابع remote/static (مثلاً، `"text-embedding-3-small"`)
- `memoryTransformersEnabled`: `true` | `false`
- `memoryStaticEnabled`: `true` | `false`
- `memoryVectorStore`: `"sqlite-vec"`، `"qdrant"` یا `"auto"`

#### مدل محلی (`transformers`)

از transformers.js به‌صورت داخلی برای اجرای مدل‌های محلی استفاده می‌کند:

```bash
# متغیرهای env در کد خوانده می‌شوند (src/lib/memory/embedding/index.ts):
MEMORY_TRANSFORMERS_MODEL=Xenova/all-MiniLM-L6-v2  # repo مدل HF
MEMORY_STATIC_MODEL=minishlab/potion-base-8M       # مدل potion استاتیک HF
MEMORY_STATIC_CACHE_DIR=<DATA_DIR>/embeddings      # دایرکتوری کش
```

#### کش LRU embedding

کش همیشه به‌صورت پیش‌فرض روشن است و از طریق متغیرهای env پیکربندی می‌شود:

```bash
MEMORY_EMBEDDING_CACHE_MAX=1000                    # حداکثر آیتم‌های کش‌شده
MEMORY_EMBEDDING_CACHE_TTL_MS=300000               # TTL (۵ دقیقه)
```

### اعداد عملکرد

بنچمارک روی یک سرور ۴-هسته‌ای x86 معمولی (متن‌ها هر کدام حدود ۱۰۰ توکن):

| ارائه‌دهنده             | p50   | p95   | p99   | هزینه / ۱M embedding               |
| -------------------- | ----- | ----- | ----- | ---------------------------------- |
| `transformers` (CPU) | 80ms  | 180ms | 350ms | رایگان                               |
| `remote` (OpenAI)    | 120ms | 220ms | 400ms | ~$0.02 (ada-002) / $0.13 (3-large) |
| `static` (Qdrant)    | 15ms  | 30ms  | 60ms  | بستگی به هاستing Qdrant دارد          |
| `cache` (hit)        | <1ms  | <1ms  | 2ms   | رایگان                               |

---

## الگوهای استخراج فکت (v3.8.16+)

ماژول `extraction.ts` (`src/lib/memory/extraction.ts`) از **تطبیق الگوی regex** برای استخراج فکت‌های ساختاریافته از پیام‌های مکالمه استفاده می‌کند. درک این الگوها به شما کمک می‌کند کیفیت استخراج را برای مورد استفاده خود تنظیم کنید.

### دسته‌بندی‌های پیش‌فرض الگو

| دسته‌بندی            | نمونه الگو                                             | captures                       |
| ------------------- | ----------------------------------------------------------- | ------------------------------ |
| PREFERENCE_PATTERNS | `"I prefer <X>"`، `"I like <X>"`، `"I hate <X>"`            | ترجیحات کاربر               |
| DECISION_PATTERNS   | `"I'll use <X>"`، `"I decided to <X>"`، `"I went with <X>"` | تصمیمات کاربر (episodic)      |
| PATTERN_PATTERNS    | `"I usually <X>"`، `"I always <X>"`، `"I never <X>"`        | الگوهای رفتاری پایدار |

### نمونه الگوها (ساده‌شده)

```ts
// From src/lib/memory/extraction.ts
const PREFERENCE_PATTERNS = [
  /\bI\s+(?:really\s+)?prefer\s+([^.,\n]+)/gi,
  /\bI\s+(?:really\s+)?like\s+([^.,\n]+)/gi,
  /\bI\s+(?:hate|dislike|avoid)\s+([^.,\n]+)/gi,
];
const DECISION_PATTERNS = [
  /\bI'?(?:ll|will)\s+use\s+([^.,\n]+)/gi,
  /\bI\s+(?:have\s+)?decided\s+(?:to\s+)?([^.,\n]+)/gi,
];
const PATTERN_PATTERNS = [/\bI\s+usually\s+([^.,\n]+)/gi, /\bI\s+always\s+([^.,\n]+)/gi];
```

### چه چیزی استخراج می‌شود

وقتی یک کاربر می‌گوید:

> "I prefer TypeScript. I'll use Postgres for this project. I always commit before pushing. I don't like Python."
> استخراج ۴ حافظه تولید می‌کند:
>
> | کلید                                  | دسته‌بندی   | نوع     | محتوا                     |
> | ------------------------------------ | ---------- | -------- | --------------------------- |
> | `preference:typescript`              | preference | factual  | "TypeScript"                |
> | `decision:postgres_for_this_project` | decision   | episodic | "Postgres for this project" |
> | `pattern:commit_before_pushing`      | pattern    | factual  | "commit before pushing"     |
> | `preference:python`                  | preference | factual  | "Python"                    |

### محدودیت‌های استخراج

برای جلوگیری از استخراج بیش از حد، محدودیت‌های زیر اعمال می‌شود:

| حداقل طول محتوا | ۳ کاراکتر |
| حداکثر طول محتوا | ۵۰۰ کاراکتر |

### چه زمانی استخراج را غیرفعال کنیم

استخراج هر زمان که حافظه فعال باشد به‌طور خودکار اجرا می‌شود؛ هیچ toggle
فقط-استخراج جداگانه‌ای وجود ندارد. برای خاموش کردن آن، حافظه را به‌طور کامل غیرفعال کنید (`enabled: false`
از طریق `PUT /api/settings/memory`). در موارد زیر آن را در نظر بگیرید:

- شما حجم پیام بالایی دارید و هزینه استخراج ناچیز نیست
- مکالمات شما عمدتاً گذرا هستند (چت، اشکال‌زدایی) بدون ارزش بلندمدت
- شما در حال capture بافتار از طریق پلاگین‌های سفارشی هستید

---

## تنظیم RRF هیبریدی (v3.8.16+)

الگوریتم **Reciprocal Rank Fusion (RRF)** نتایج FTS5 (کلیدواژه) و بردار (semantic) را ترکیب می‌کند. پارامتر `k` کنترل می‌کند چه میزان وزن به نتایج رتبه‌پایین‌تر داده می‌شود.

### فرمول

به ازای هر حافظه کاندید، امتیاز RRF برابر است با:

```
RRF(d) = Σ  1 / (k + rank_i(d))
```

که در آن:

- `k` ثابت است (پیش‌فرض ۶۰)
- `rank_i(d)` رتبه سند `d` در i-امین سیستم بازیابی (FTS، بردار) است
- مجموع روی تمام سیستم‌های بازیابی اجرا می‌شود

### چگونه `k` بر نتایج تأثیر می‌گذارد

| مقدار `k`            | اثر                                                                          | بهترین برای                               |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| `k=0`                | ادغام رتبه خالص (بدون هموارسازی)                                                 | baseline نظری                   |
| `k=10-30`            | نتایج برتر را به‌شدت وزن می‌دهد، رتبه‌پایین به‌سختی مشارکت می‌کند                        | وقتی نتایج top-3 معمولاً درست هستند |
| **`k=60`** (پیش‌فرض) | متعادل — نتایج top-10 همگی به‌معناداری مشارکت می‌کنند                           | بازیابی همه‌منظوره              |
| `k=100+`             | مسطح‌تر — حتی نتایج رتبه‌پایین اگر در چند سیستم ظاهر شوند می‌توانند غالب شوند | وقتی recall > precision حیاتی است    |

### تنظیم `k` در عمل

```bash
# پیش‌فرض
MEMORY_RRF_K=60

# دقت تهاجمی (حافظه کوچک، اسناد کم)
MEMORY_RRF_K=20

# حداکثر recall (حافظه بزرگ، پرس‌وجوهای متنوع)
MEMORY_RRF_K=120
```

**مثال با `k=20`:**

- رتبه FTS ۱ → مشارکت `1/21 = 0.048`
- رتبه FTS ۱۰ → مشارکت `1/30 = 0.033`
- رتبه بردار ۱ → مشارکت `0.048`
- حداکثر ترکیبی: `0.096`

**مثال با `k=60`:**

- رتبه FTS ۱ → مشارکت `1/61 = 0.016`
- رتبه FTS ۱۰ → مشارکت `1/70 = 0.014`
- رتبه بردار ۱ → مشارکت `0.016`
- حداکثر ترکیبی: `0.033`

با `k` بالاتر، **تفاوت نسبی** بین top-1 و رتبه-۱۰ کوچک‌تر است، بنابراین الگوریتم بیشتر به **اجماع در میان سیستم‌های بازیابی** تکیه می‌کند تا اعتماد به رتبه برتر.

### چه زمانی `k` را تغییر دهیم

| نشانه                                | امتحان کنید                                                          |
| -------------------------------------- | ------------------------------------------------------------ |
| نتیجه برتر همیشه می‌برد، اما اشتباه است | **کاهش** k (مثلاً ۲۰) — اعتماد به رتبه برتر مهم‌تر است    |
| پاسخ درست در top-5 است اما نه top-1 | **افزایش** k (مثلاً ۱۰۰) — امتیازدهی مسطح‌تر به اجماع پاداش می‌دهد |
| recall بالا اما precision پایی است    | **کاهش** k — رتبه‌بندی را تیز کنید                            |
| recall پایی است (اسناد مرتبط مفقود)  | **افزایش** k — به اسناد رتبه‌پایین‌تر شانسی بدهید               |

### وزن‌دهی RRF

ادغام رتبه متقابل از وزن‌های مساوی برای رتبه بردار semantic و رتبه جستجوی full-text استفاده می‌کند:

```
RRF(d) = 1/(k + rank_vector) + 1/(k + rank_fts)
```

هیچ متغیر محیطی برای تنظیم وزن‌های فردی وجود ندارد (`MEMORY_RRF_VECTOR_WEIGHT`/`MEMORY_RRF_FTS_WEIGHT` وجود ندارند).

---

## استراتژی خلاصه‌سازی (v3.8.16+)

ماژول `summarization.ts` (`src/lib/memory/summarization.ts`) حافظه‌های قدیمی‌تر را فشرده می‌کند تا مجموع فعال کوچک بماند در حالی که recall حفظ می‌شود.

### چه زمانی خلاصه‌سازی تحریک می‌شود

| تحریک                | آستانه (پیش‌فرض) |
| ---------------------- | ------------------- |
| تحریک دستی از طریق API | n/a                 |

### چه چیزی خلاصه می‌شود

دو نقطه ورود از `summarization.ts` export می‌شوند:

- **`summarizeMemories(apiKeyId, sessionId?, maxTokens = 4000)`** — حافظه‌های
  یک نشست را در یک متن خلاصه واحد محدود شده توسط یک بودجه توکن فشرده می‌کند.
- **`summarizeMemoriesOlderThan(apiKeyId, days, dryRun)`** — فشرده‌سازی مبتنی بر سن
  استفاده‌شده توسط API: هر حافظه قدیمی‌تر از `days` را انتخاب می‌کند، یک
  حافظه خلاصه فشرده از آن‌ها می‌سازد، و (وقتی `dryRun` بر `false` باشد) موارد اصلی را حذف می‌کند. `dryRun: true` را عبور دهید تا مجموعه کاندید و مجموع توکن را بدون تغییر دادن چیزی پیش‌نمایش کنید.

هیچ پاس clustering تگ/کلید یا امتیازدهی per-memory «core در برابر summarizable» وجود ندارد —
انتخاب صرفاً حد سن است، و متن خلاصه یک خط فشرده‌شده با
پیشوند نوع به ازای هر کاندید است.

### تحریک خلاصه‌سازی

خلاصه‌سازی **دستی / opt-in** است — تنظیم `autoSummarize` به‌صورت پیش‌فرض `false` است،
پس چیزی به‌طور خودکار فشرده نمی‌شود. آن را از طریق API تحریک کنید:

```bash
curl -X POST http://localhost:20128/api/memory/summarize \
  -H "Authorization: Bearer $OMNIROUTE_KEY"
```

برای خاموش گذاشتن آن، کافی است `autoSummarize` را در پیش‌فرض خود (`false`) نگه دارید.

### نکته‌های کیفیت خلاصه‌سازی

- **ابتدا با `dryRun` پیش‌نمایش کنید** — `summarizeMemoriesOlderThan(..., true)` فهرست
  کاندید و تعداد کل توکن را برمی‌گرداند تا بتوانید قبل از حذف موارد اصلی تأیید کنید چه چیزی ادغام می‌شود.
- **خلاصه‌سازی را در ساعات کم‌ترافیک اجرا کنید** اگر یک پیکره حافظه بزرگ دارید — فراخوانی LLM بخش کند است

```bash
# سبک cron: خلاصه‌سازی روزانه ساعت ۳ صبح
0 3 * * * curl -X POST http://localhost:20128/api/memory/summarize \
  -H "Authorization: Bearer $OMNIROUTE_KEY"
```
