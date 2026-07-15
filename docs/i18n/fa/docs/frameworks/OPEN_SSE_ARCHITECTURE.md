---
title: "معماری open-sse"
version: 3.8.40
lastUpdated: 2026-06-28
---

# معماری open-sse

> **خلاصه:** `open-sse/` موتور استریمی هسته‌ای است که هر درخواست LLM در RouteChi را تغذیه می‌کند. این ماژول شامل حدود ۹۰۰ فایل است که لوله‌ی درخواست، اجراکننده‌ها، سرویس‌ها، سرور MCP و لایه‌ی ترجمه را پیاده‌سازی می‌کند. این راهنما توضیح می‌دهد که قطعات چگونه به هم می‌پازند.

**منبع:** `open-sse/` (پکیج workspace، حدود ۹۰۰ فایل؛ ۸۱۱ فایل `.ts`)

---

## چرا یک پکیج workspace جداگانه؟

`open-sse/` یک **workspace مستقل** در مونوریپوی RouteChi است به چند دلیل:

1. **قابلیت استفاده مجدد** — `open-sse` به‌صورت `@omniroute/open-sse` روی npm منتشر می‌شود، تا پروژه‌های دیگر بتوانند آن را مستقلاً استفاده کنند
2. **مرزهای تمیز** — موتور استریمی از لایه‌ی UI/DB اختصاصی RouteChi جدا شده است
3. **عملکرد** — موتور هیچ وابستگی به Next.js ندارد، که شروع‌سرد سریع‌تری در زمینه‌های CLI/serverless ممکن می‌سازد
4. **نسخه‌گذاری** — `open-sse` می‌تواند با سرعت مستقل خود منتشر شود

```json
// package.json
"workspaces": ["open-sse"]
```

---

## ساختار سطح بالا

```
open-sse/
├── index.ts              # Public entry point
├── types.d.ts            # Public type exports
├── package.json          # @omniroute/open-sse
├── config/               # Provider configs, constants, registries
├── executors/            # Per-provider HTTP executors (67 + base.ts/index.ts)
├── handlers/             # Request handlers (chatCore, responses, etc.)
├── lib/                  # Internal utilities
├── mcp-server/           # Model Context Protocol server
├── services/             # ~298 service modules
├── transformer/          # Responses API format transformer
├── translator/           # Format translation (OpenAI ↔ Claude ↔ Gemini)
└── utils/                # Shared utilities (logging, error, stream, etc.)
```

### شمارش ماژول‌ها

| Directory | Files | Purpose |
| `executors/` | 68 | Per-provider HTTP executors (unified via DefaultExecutor factory) |
| `handlers/` | 16 | Request entry points (chatCore, responses, embeddings) |
| `services/` | ~298 | Routing, caching, rate limiting, refresh, etc. |
| `translator/` | ~27 | Format conversion (OpenAI ↔ Claude ↔ Gemini) |
| `mcp-server/` | 32 | MCP tools and transports |
| `utils/` | ~65 | Cross-cutting utilities (logging, error, stream) |
| `config/` | ~10 | Provider configs, constants, registries |

---

## لوله‌ی درخواست

هر درخواست LLM از یک **لوله‌ی ۵ مرحله‌ای** عبور می‌کند:

```
                              ┌──────────────┐
   HTTP request                │  1. ROUTE    │   combo resolution, model selection
   (Next.js route)             └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  2. TRANSLATE│   format conversion (OpenAI ↔ Claude ↔ Gemini)
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  3. EXECUTE  │   provider executor, HTTP, retry, breaker
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  4. STREAM   │   SSE transformation, backpressure
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  5. RECORD   │   usage tracking, call log, error classification
                              └──────┬───────┘
                                     │
                                     ▼
                              HTTP response (SSE or JSON)
```

### مرحله‌ی ۱: Route (services/combo.ts)

**نقطه‌ی ورود:** `handleComboChat()` در `services/combo.ts`

درخواست را به یک چندتایی `(provider, model, account, credentials)` مشخص تفکیک می‌کند:

- combo را بر اساس ID جستجو می‌کند (یا یک combo مجازی برای مدل‌های `auto/*` می‌سازد)
- استراتژی مسیریابی را اعمال می‌کند (اولویت، وزن‌دار، round-robin و غیره)
- پروایدرهای ناسالم را فیلتر می‌کند (circuit breaker)
- target بعدی قابل‌اجرا را انتخاب می‌کند

برای مدل‌های `auto/*`، این مرحله همچنین:

- الگوریتم **امتیازدهی ۹ عاملی** (`services/autoCombo/`) را اجرا می‌کند
- یک جفت `provider+model` را بر اساس سلامت، هزینه، تأخیر و غیره انتخاب می‌کند

### مرحله‌ی ۲: Translate (translator/)

اگر فرمت منبع (مثلاً OpenAI) با فرمت target (مثلاً Claude) متفاوت باشد، درخواست **ترجمه** می‌شود:

- prompt سیستمی → پیام سیستمی
- تعاریف ابزار → فرمت ابزار مختص‌پروایدر
- پارامترهای reasoning/thinking → معادل‌های مختص‌پروایدر
- نرمال‌سازی نقش پیام (`developer` → `system` برای غیر OpenAI)

`translator/index.ts` این موارد را افشا می‌کند:

```ts
translateRequest(body, sourceFormat, targetFormat): TranslatedRequest
needsTranslation(source, target): boolean
```

### مرحله‌ی ۳: Execute (executors/)

**نقطه‌ی ورود:** `getExecutor(providerId).execute(request, options)`

همه‌ی پروایدرها از `DefaultExecutor` (`executors/default.ts`) از طریق fallback ی factory ی
`getExecutor()` استفاده می‌کنند. اجراکننده:

- URL ی upstream را می‌سازد (`buildUrl()`)
- هدرهای مختص‌پروایدر را اضافه می‌کند (`buildHeaders()`)
- بدنه‌ی درخواست را تبدیل می‌کند (`transformRequest()`)
- درخواست HTTP را با retry + backoff نمایی ارسال می‌کند
- در صورت نیاز refresh ی احراز هویت را هندلبکند (پروایدرهای OAuth)

همه‌ی اجراکننده‌ها `BaseExecutor` (`executors/base.ts`، ۱۱۷۰ LOC) را گسترش می‌دهند که ارائه می‌کند:

- منطق retry مشترک
- یکپارچه‌سازی پراکسی
- یکپارچه‌سازی circuit breaker
- hookهای ضبط استفاده

### مرحله‌ی ۴: Stream (utils/stream.ts)

برای پاسخ‌های استریمی، اجراکننده یک **ReadableStream** برمی‌گرداند. هندلر:

- از یک تبدیل SSE عبور می‌کند (`createSSETransformStreamWithLogger`)
- pingهای heartbeat را برای تشخیص اتصالات مرده اعمال می‌کند
- قطع اتصال کلاینت را با ظرافت هندل می‌کند (`pipeWithDisconnect`)
- SSE → JSON را برای کلاینت‌های غیراستریمی تبدیل می‌کند

برای پاسخ‌های غیراستریمی، اجراکننده یک شیء JSON تجزیه‌شده برمی‌گرداند که تغییرنخورده عبور می‌کند.

### مرحله‌ی ۵: Record (services/usage.ts)

پس از پاسخ (موفقیت یا شکست)، استفاده ضبط می‌شود:

- `prompt_tokens`، `completion_tokens`، `cached_tokens` از پاسخ
- `cost_usd` محاسبه‌شده از داده‌های قیمت‌گذاری
- `latency_ms`، `status`، `error_class` در صورت شکست
- در جدول `usage_history` ذخیره می‌شود

آرتیفکت‌های log فراخوانی (در صورت فعال بودن) در `${DATA_DIR}/call_logs/` نوشته می‌شوند.

---

## بررسی عمیق فایل‌های کلیدی

### chatCore.ts (۵۹۷۷ خط)

**هندلر اصلی درخواست**. با وجود اندازه‌اش، ساختار روشنی دارد:

```ts
// Pseudo-structure of chatCore.ts
export async function handleChat(request: NextRequest) {
  // 1. Auth + CORS
  await authenticateRequest(request);
  applyCorsHeaders(response);

  // 2. Body validation
  const body = await parseRequestBody(request);

  // 3. Format detection + translation
  const sourceFormat = detectFormat(request);
  const targetFormat = getTargetFormat(providerId);
  if (needsTranslation(sourceFormat, targetFormat)) {
    body = translateRequest(body, sourceFormat, targetFormat);
  }

  // 4. Combo routing
  const targets = await resolveComboTargets(comboId, body);
  for (const target of targets) {
    try {
      const result = await executeOnTarget(target, body);
      await recordUsage(result);
      return result;
    } catch (err) {
      // Continue to next target
    }
  }

  // 5. Emergency fallback
  return await emergencyFallback(body);
}
```

با وجود اینکه یک تابع غول‌پیکر است، در **بخش‌های توضیح‌دار** سازمان‌دهی شده که به لوله‌ی ۵ مرحله‌ای نگاشت می‌شوند.

### combo.ts (۴۴۵۶ LOC)

**موتور مسیریابی** که یک combo را به targetهای مرتب‌شده تفکیک می‌کند.

```ts
// services/combo.ts
export async function handleComboChat(body, comboId): Promise<ChatResult> {
  const targets = await resolveComboTargets(comboId, body);
  for (const target of targets) {
    try {
      return await handleSingleModel(target, body);
    } catch (err) {
      log.warn("target failed, trying next", { target, err });
    }
  }
  throw new ComboExhaustedError("All targets failed");
}
```

از **۱۷ استراتژی مسیریابی** پشتیبانی می‌کند (به `src/shared/constants/routingStrategies.ts` مراجعه کنید):

| Strategy            | Behavior                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `priority`          | First-target ordered list                                                 |
| `weighted`          | Probabilistic by per-target weight                                        |
| `round-robin`       | Cycle through targets in order                                            |
| `context-relay`     | Hand off context across targets                                           |
| `fill-first`        | Fill quota before moving to next                                          |
| `p2c`               | Power of two choices                                                      |
| `random`            | Uniform random                                                            |
| `least-used`        | Pick the one with fewest recent uses                                      |
| `cost-optimized`    | Cheapest healthy target first                                             |
| `reset-aware`       | Aware of provider reset windows                                           |
| `reset-window`      | Reset window-based routing                                                |
| `headroom`          | Most remaining quota headroom first                                       |
| `strict-random`     | Truly uniform (no quality weighting)                                      |
| `auto`              | Use 9-factor scoring (`autoCombo/`)                                       |
| `lkgp`              | Last known good provider first                                            |
| `context-optimized` | Best for long-context requests                                            |
| `fusion`            | Fan out to a panel in parallel, then synthesize via a judge (`fusion.ts`) |

### base.ts (1170 LOC)

**اجراکننده‌ی انتزاعی** که همه‌ی ۶۷ اجراکننده آن را گسترش می‌دهند. شامل:

- `buildUrl()` — ساخت URL پیش‌فرض (زیرکلاس‌ها برای حالت سفارشی بازنویسی می‌کنند)
- `buildHeaders()` — هدرهای پیش‌فرض (احراز هویت، content-type)
- `transformRequest()` — به‌صورت پیش‌فرض pass-through
- `execute()` — حلقه‌ی اصلی HTTP با retry/backoff/breaker

```ts
// open-sse/executors/default.ts
export class DefaultExecutor extends BaseExecutor {
  // Handles all OpenAI/Anthropic-compatible providers
  // Providers register configurations (URL, auth, headers) but share executor logic
}
```

رفتار مختص‌پروایدر (هدرهای احراز هویت، URL پایه، هدرهای نسخه) از طریق رجیستری پروایدر پیکربندی می‌شود، نه کلاس‌های اجراکننده‌ی جداگانه.

````

---

## سرویس‌ها (۱۱۷ ماژول)

سرویس‌ها **ماژول‌های متمرکز تک‌منظوره‌ای** هستند که هندلرها آن‌ها را ترکیب می‌کنند. دسته‌های بزرگ:

### مسیریابی و Combo

- `combo.ts` — نقطه‌ی ورود برای درخواست‌های مسیریابی‌شده‌توسط‌combo
- `services/autoCombo/` — امتیازدهی ۹ عاملی، ۸ استراتژی مسیریابی خودکار
- `wildcardRouter.ts` — تطبیق مسیرهای wildcard (`gpt-*`)
- `modelFamilyFallback.ts` — fallback درون‌خانواده‌ای T5

### محدودسازی نرخ و سهمیه

- `rateLimitManager.ts` — token bucket به‌ازای‌کلید+پروایدر
- `usage.ts` — ضبط استفاده
- `quotaCache.ts` — اسنپ‌شات‌های سهمیه درون‌حافظه‌ای

### حساب و توکن

- `tokenRefresh.ts` — refresh ی OAuth روی 401
- `accountFallback.ts` — تعویض به حساب جایگزین
- `sessionManager.ts` — وضعیت نشست چندنوبته

### هوشمندی

- `intentClassifier.ts` — دسته‌بندی قصد درخواست
- `taskAwareRouter.ts` — مسیریابی بر اساس نوع وظیفه
- `thinkingBudget.ts` — تخصیص توکن‌های تفکر
- `contextManager.ts` — تزریق زمینه‌ی مسیریابی

### تاب‌آوری

- `resilience.ts` — هماهنگ‌سازی retry، backoff، breaker
- `emergencyFallback.ts` — fallback ی آخرین‌راه
- `modelDeprecation.ts` — مسیریابی خودکار به مدل‌های جانشین

### وضعیت

- `signatureCache.ts` — عدم‌تکرار بر اساس امضای درخواست
- `volumeDetector.ts` — load shedding
- `contextHandoff.ts` — سریالایز نشست

### فشرده‌سازی

- `compression/` (زیردایرکتوری) — لوله‌ی کامل فشرده‌سازی
- ۳۹ فایل پوشش‌دهنده‌ی موتورها، بسته‌های قاعده، آداپتورها

### مهارت‌ها

- (در [SKILLS.md](./SKILLS.md) پوشش داده شده)

### حافظه

- (در [MEMORY.md](./MEMORY.md) پوشش داده شده)

---

## اجراکننده‌ها (۷۵+ فایل)

یک فایل به‌ازای‌هرپروایدر. همگی `BaseExecutor` را گسترش می‌دهند و آنچه متفاوت است را بازنویسی می‌کنند.

### الگوهای رایج

پروایدرها از طریق `getExecutor(providerId)` تفکیک می‌شوند، که اجراکننده‌ی پیکربندی‌شده را برمی‌گرداند. پروایدرهای سازگار با OpenAI/Anthropic از `DefaultExecutor` (`executors/default.ts`) استفاده می‌کنند. رفتار مختص‌پروایدر (URL پایه، هدرهای احراز هویت، نسخه‌ی API) در `open-sse/config/providers/` پیکربندی می‌شود، در حالی که تبدیل‌های بدنه‌ی درخواست در `open-sse/translator/` هندل می‌شوند.

**URL سفارشی** از طریق پیکربندی پروایدر تنظیم می‌شود:

```ts
// Provider config in open-sse/config/providers/
export default {
  id: "together",
  baseURL: "https://api.together.xyz/v1/chat/completions",
}
````

**احراز هویت سفارشی** از طریق پیکربندی احراز هویت رجیستری پروایدر (کلید API، OAuth، پروفایل‌های هدر) هندل می‌شود.

**بدنه‌ی درخواست سفارشی** (مثلاً جداسازی `system` از `messages` در Anthropic) تبدیل‌های هرکدام به‌ازای‌پروایدر در `open-sse/translator/` ثبت می‌شوند.

````

### factory ی اجراکننده

`executors/index.ts` تابع `getExecutor(providerId)` را صادر می‌کند:

```ts
import { getExecutor } from "@omniroute/open-sse/executors";

const executor = getExecutor("anthropic");
const result = await executor.execute({
  model: "claude-sonnet-4-5",
  messages: [...],
});
````

این factory از `config/providerRegistry.ts` تولید می‌شود که هر ۲۱۲+ پروایدر و کلاس اجراکننده‌ی آن را فهرست می‌کند.

---

## مترجم‌ها

بین **۳ فرمت** ترجمه می‌کند: OpenAI، Anthropic، Gemini، به‌علاوه‌ی Responses API ی جدید.

### زمان وقوع ترجمه

```ts
import { needsTranslation, translateRequest } from "@omniroute/open-sse/translator";

if (needsTranslation(sourceFormat, targetFormat)) {
  body = translateRequest(body, sourceFormat, targetFormat);
}
```

ترجمه‌های رایج:

- `OpenAI → Anthropic`: فیلد `system` جداگانه، هدر `x-api-key`
- `OpenAI → Gemini`: `contents` به‌جای `messages`، `systemInstruction`
- `OpenAI → Responses API`: آرایه‌ی `input`، وضعیت `previous_response_id`

### موارد لبه‌ای هندل‌شده

- نقش `developer` → `system` برای غیر OpenAI
- نقش `system` → در اولین پیام کاربر برای GLM/ERNIE ادغام می‌شود
- `json_schema` → `responseMimeType` + `responseSchema` ی Gemini
- `tools` → فرمت ابزار مختص‌پروایدر
- پارامترهای تفکر (o1، Claude) → معادل‌های مختص‌پروایدر

---

## سرور MCP

`open-sse/mcp-server/` **پروتکل Model Context** را پیاده‌سازی می‌کند:

- **۳۰+ ابزار** (مدیریت پروایدر، comboها، حافظه، کش، فشرده‌سازی، 1proxy، مهارت‌ها)
- **۳ انتقال**: stdio، SSE، Streamable HTTP
- **۱۳ دامنه (scope)** برای مجوز دقیق

### ثبت ابزار

ابزارها به‌صورت فایل‌های مستقل در `open-sse/mcp-server/tools/` ثبت می‌شوند، هر کدام یک name، schema، handler و scope صادر می‌کنند:

```ts
// open-sse/mcp-server/tools/getHealth.ts
import { z } from "zod";
export default {
  name: "omniroute_get_health",
  description: "Get system health snapshot",
  scope: "read:health",
  inputSchema: z.object({}),
  handler: async (_args, ctx) => {
    return await getSystemHealth();
  },
};
```

### انتقال‌ها

```ts
// stdio (CLI usage)
startMcpStdio(server);

// SSE (HTTP-based streaming)
startMcpSse(server, port);

// Streamable HTTP (modern MCP)
startMcpStreamable(server, port);
```

### مجوز

هر فراخوانی ابزار از بررسی‌های scope عبور می‌کند (`open-sse/mcp-server/auth/`):

```ts
if (!hasScope(apiKey, "providers:read")) {
  throw new Error("Insufficient scope");
}
```

---

## ترانسفورمرها

`open-sse/transformer/` بین فرمت‌های **Chat Completions** و **Responses API** تبدیل می‌کند.

### چرا یک ترانسفورمر جداگانه؟

Responses API فرمت جدید OpenAI با **مکالمات حالت‌دار** (`previous_response_id`) است. وقتی کلاینت یک درخواست Responses ارسال می‌کند، RouteChi:

1. Responses را به‌صورت داخلی به Chat Completions تبدیل می‌کند
2. به پروایدر ارسال می‌کند (هر پروایدری که از Chat Completions پشتیبانی می‌کند)
3. پاسخ را دوباره به فرمت Responses تبدیل می‌کند
4. پاسخ تبدیل‌شده را به کلاینت استریم می‌کند

ترانسفورمر (`transformer/responsesTransformer.ts`) ارائه می‌دهد:

```ts
createResponsesApiTransformStream(): TransformStream
```

این هندل می‌کند:

- رویدادهای `response.output_item.added`
- رویدادهای `response.output_text.delta`
- رویداد `response.completed`
- نگاشت فراخوانی ابزار (`function_call` ↔ `tool_calls`)

---

## پیکربندی

`open-sse/config/` لایه‌ی پیکربندی را نگه می‌دارد:

| File                          | Purpose                           |
| ----------------------------- | --------------------------------- |
| `providerRegistry.ts`         | 212+ provider definitions         |
| `providerModels.ts`           | Model aliases, format mapping     |
| `constants.ts`                | Timeouts, limits, status codes    |
| `defaultThinkingSignature.ts` | Default Claude thinking signature |
| `modelStrip.ts` (in services) | Per-provider field stripping      |

### شمای رجیستری پروایدر

```ts
interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  authType: "bearer" | "api-key" | "oauth" | "cookie";
  executorClass: string;
  defaultModel: string;
  capabilities: ProviderCapabilities;
  models: ModelDefinition[];
}
```

اعتبارسنجی Zod هنگام بارگذاری ماژول تضمین می‌کند که همه‌ی پیکربندی‌های پروایدر معتبر هستند.

---

## محدودیت‌های عملکرد

موتور مسیریابی بودجه‌های عملکردی سخت‌گیرانه‌ای دارد:

| Operation                               | Target | Measurement               |
| --------------------------------------- | ------ | ------------------------- |
| Combo resolution                        | <10ms  | For 50 targets            |
| Rate limit check                        | <1ms   | In-memory token bucket    |
| Model family fallback                   | <5ms   | Cached family definitions |
| Request routing dispatch                | <2ms   | Hot path                  |
| **No blocking I/O in routing hot path** | —      | All async                 |

---

## الگوهای ضد‌الگو

❌ **فراخوانی‌های همگام DB در `combo.ts`** — پیش‌محاسبه و کش کنید
❌ **منطق retry در هندلرها** — از `retry()` سرویس resilience استفاده کنید
❌ **دسترسی مستقیم به پیکربندی پروایدر** — از getterهای `providerRegistry` استفاده کنید
❌ **زنجیره‌های fallback hardcoded** — در `modelFamilyFallback.ts` تعریف کنید
❌ **جهش‌های وضعیت میان درخواست‌های همزمان** — فقط از زمینه‌ی scoped به‌درخواست استفاده کنید

---

## افزودن یک جزء جدید

### افزودن یک سرویس جدید

1. `open-sse/services/[serviceName].ts` را با مسئولیت متمرکز ایجاد کنید
2. تابع هندلر اصلی و هر ثابتی را صادر کنید
3. تست‌های واحد را در `tests/unit/services/[serviceName].test.mjs` اضافه کنید
4. در لوله‌ی درخواست در `handlers/chatCore.ts` یکپارچه کنید (اگر مرتبط با مسیریابی است)
5. در صورت تأثیر سرویس بر انتخاب target، منطق مسیریابی در `combo.ts` را به‌روزرسانی کنید
6. در این فایل مستند کنید

### افزودن یک اجراکننده‌ی جدید

1. `open-sse/executors/[provider].ts` را با گسترش `BaseExecutor` ایجاد کنید
2. در `config/providerRegistry.ts` ثبت کنید
3. به factory ی `executors/index.ts` اضافه کنید
4. تست‌های واحد برای اجراکننده اضافه کنید
5. در `docs/architecture/ARCHITECTURE.md` مستند کنید

### افزودن یک ابزار MCP جدید

1. `open-sse/mcp-server/tools/[category]Tools.ts` را ایجاد یا به‌روزرسانی کنید
2. شمای Zod برای ورودی‌ها تعریف کنید
3. ابزار را در `mcp-server/index.ts` ثبت کنید
4. به ماتریس scope در `mcp-server/auth/` اضافه کنید
5. تست‌های واحد اضافه کنید

---

## مطالعه‌ی بیشتر

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — معماری سطح بالا
- [CODEBASE_DOCUMENTATION.md](../architecture/CODEBASE_DOCUMENTATION.md) — مرجع مهندسی
- [REPOSITORY_MAP.md](../architecture/REPOSITORY_MAP.md) — دایرکتوری‌به‌دایرکتوری
- [AUTO-COMBO.md](../routing/AUTO-COMBO.md) — امتیازدهی ۹ عاملی
- [MCP-SERVER.md](./MCP-SERVER.md) — سرور MCP
- [A2A-SERVER.md](./A2A-SERVER.md) — سرور A2A
- منبع: `open-sse/` (۴۰۰+ فایل، حدود ۱۴۳K LOC)
