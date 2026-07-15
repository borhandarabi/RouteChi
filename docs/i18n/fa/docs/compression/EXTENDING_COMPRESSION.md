---
title: "گسترش خط لوله فشرده‌سازی"
version: 3.8.44
lastUpdated: 2026-07-02
---

# گسترش خط لوله فشرده‌سازی

> **خلاصه**: موتور فشرده‌سازی OmniRoute **pluggable** است — می‌توانید موتورهای سفارشی ثبت کنید، بسته‌های زبانی برای زبان‌های جدید ارسال کنید و خطوط لوله ترکیبی بسازید. این راهنما نحوه انجام این کارها را نشان می‌دهد.

**راهنماهای مرتبط:**

- [COMPRESSION_GUIDE.md](./COMPRESSION_GUIDE.md) — مرور کلی کامل خط لوله
- [COMPRESSION_ENGINES.md](./COMPRESSION_ENGINES.md) — رجیستری موتور و موتورهای داخلی
- [RTK_COMPRESSION.md](./RTK_COMPRESSION.md) — موتور RTK و فیلترهای سفارشی
- [COMPRESSION_RULES_FORMAT.md](./COMPRESSION_RULES_FORMAT.md) — مرجع قالب بسته قواعد

---

## مرور کلی

سیستم فشرده‌سازی **۳ نقطه گسترش** دارد:

| نقطه گسترش          | مورد استفاده                                                            | دشواری     |
| ------------------- | ----------------------------------------------------------------------- | ---------- |
| **موتور سفارشی**     | افزودن یک الگوریتم فشرده‌سازی کاملاً جدید (مثلاً خلاصه‌ساز خاص دامنه)   | پیشرفته    |
| **بسته زبانی**       | افزودن پشتیبانی از یک زبان طبیعی جدید (مثلاً هندی، عربی)                | متوسط      |
| **خط لوله ترکیبی**   | ترکیب موتورهای موجود به‌ترتیب سفارشی                                     | مبتدی      |

```
┌─────────────────────────────────────────────────────────────┐
│                    استراتژی فشرده‌سازی                       │
│                                                              │
│   پیام‌های ورودی ──▶ getEffectiveMode() ──▶ mode            │
│                                              │               │
│                      ┌───────────────────────┼──────────┐    │
│                      │         │         │         │    │    │
│                      ▼         ▼         ▼         ▼    │    │
│                   "rtk"    "lite"   "standard" "stacked"    │
│                      │         │         │         │    │    │
│                      ▼         ▼         ▼         ▼    │    │
│                   RTK       Lite     Caveman   engines[]   │
│                   engine    engine   engine    chained     │
│                      │         │         │         │    │    │
│                      └─────────┴─────────┴─────────┘    │    │
│                                      │                    │
│                                      ▼                    │
│                             خروجی فشرده‌شده                │
└─────────────────────────────────────────────────────────────┘

انتخابگر استراتژی مبتنی بر حالت است: هر درخواست یک حالت انتخاب می‌کند
(rtk / lite / standard / aggressive / ultra / stacked / off).
فقط حالت "stacked" چندین موتور را به‌ترتیب زنجیر می‌کند.
حالت راه‌اندازی خودکار پیش‌فرض "lite" است (نه یک زنجیر اولویت ۳ سطحی).
```

---

## نوشتن یک موتور فشرده‌سازی سفارشی

رابط موتور (`open-sse/services/compression/engines/types.ts`) قراردادی است که هر موتور باید آن را
ارائه دهد. این رابط ۵ متد الزامی دارد.

### رابط `CompressionEngine`

```ts
interface CompressionEngine {
  id: string; // شناسه یکتای موتور
  name: string; // نام نمایشی
  description: string; // توضیح کوتاه
  icon: string; // آیکون (emoji یا URL)
  targets: CompressionEngineTarget[]; // ["messages", "tool_results", "code_blocks"]
  stackable: boolean; // می‌تواند در یک خط لوله ترکیبی استفاده شود
  stackPriority: number; // ترتیب در خطوط لوله ترکیبی (کمتر = زودتر)
  metadata: CompressionEngineMetadata;

  apply(body, options?): CompressionResult;
  compress(body, config?): CompressionResult;
  getConfigSchema(): EngineConfigField[];
  validateConfig(config): EngineValidationResult;
}
```

### مثال مینیمال: موتور فاصله‌گذاری

ساده‌ترین موتور ممکن — حذف فاصله‌های اضافی از پیام‌ها.

````ts
import type { CompressionEngine } from "omniroute/compression/engines/types";
import { registerCompressionEngine } from "omniroute/compression/engines/registry";

function preserveCodeBlocks(text: string): string {
  // تقسیم بر اساس نشانگرهای بلوک کد و حفظ فاصله داخل آن‌ها
  const parts = text.split(/(```[\s\S]*?```)/);
  return parts
    .map((part) => {
      if (part.startsWith("```")) {
        return part; // بلوک‌های کد را تغییر نده
      }
      return part.replace(/\n{3,}/g, "\n\n"); // فقط بر متن معمولی اعمال کن
    })
    .join("");
}

const whitespaceEngine: CompressionEngine = {
  id: "whitespace",
  name: "Whitespace Stripper",
  description: "Removes extra whitespace and blank lines",
  icon: "📝",
  targets: ["messages", "tool_results"],
  stackable: true,
  stackPriority: 100, // بعد از caveman/rtk اجرا شود

  metadata: {
    id: "whitespace",
    name: "Whitespace Stripper",
    description: "Removes extra whitespace and blank lines",
    inputScope: "messages",
    targetLatencyMs: 5,
    supportsPreview: true,
    stable: true,
  },

  apply(body, options) {
    return this.compress(body, options?.config);
  },

  compress(body, config = {}) {
    let originalLength = 0;
    let compressedLength = 0;

    // پیمایش آرایه پیام — مدیریت هم محتوای رشته‌ای و هم چندبخشی
    const compressedBody = (body.messages || []).map((msg) => {
      if (typeof msg.content === "string") {
        originalLength += msg.content.length;
        let compressed = msg.content
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/^\s+|\s+$/gm, "");
        compressedLength += compressed.length;
        return { ...msg, content: compressed };
      }
      // محتوای چندبخشی: پیمایش بخش‌ها، فقط فشرده‌سازی بخش‌های متنی
      if (Array.isArray(msg.content)) {
        const newParts = msg.content.map((part) => {
          if (part.type === "text" && typeof part.text === "string") {
            originalLength += part.text.length;
            let compressed = part.text
              .replace(/[ \t]+/g, " ")
              .replace(/\n{3,}/g, "\n\n")
              .replace(/^\s+|\s+$/gm, "");
            compressedLength += compressed.length;
            return { ...part, text: compressed };
          }
          return part; // image_url، tool_use و غیره را حفظ کن
        });
        return { ...msg, content: newParts };
      }
      return msg;
    });

    return {
      body: { ...body, messages: compressedBody },
      stats: {
        originalTokens: Math.ceil(originalLength / 4),
        compressedTokens: Math.ceil(compressedLength / 4),
        savingsPercent: originalLength > 0 ? 100 * (1 - compressedLength / originalLength) : 0,
        techniques: ["whitespace-collapse"],
        engineId: "whitespace",
      },
    };
  },

  getConfigSchema() {
    return [
      {
        key: "preserveCodeBlocks",
        type: "boolean",
        label: "Preserve code blocks",
        defaultValue: true,
        description: "Don't touch whitespace inside ```code``` blocks",
      },
    ];
  },

  validateConfig(config) {
    if (config.preserveCodeBlocks !== undefined && typeof config.preserveCodeBlocks !== "boolean") {
      return { valid: false, errors: ["preserveCodeBlocks must be a boolean"] };
    }
    return { valid: true, errors: [] };
  },
};

// ثبت سراسری
registerCompressionEngine(whitespaceEngine);
````

### محل قرارگیری موتورهای سفارشی

```
~/.omniroute/compression/engines/my-engine.ts    # سطح کاربر
<project>/compression-engines/my-engine.ts        # سطح پروژه (هنگام راه‌اندازی بارگذاری می‌شود)
```

یا به‌صورت برنامه‌نویسی از یک پلاگین بارگذاری کنید:

```ts
// در پلاگین شما
import {
  registerCompressionEngine,
  unregisterCompressionEngine,
} from "@omniroute/open-sse/services/compression/engines/registry";
import { myEngine } from "./engines/my-engine";

export default definePlugin({
  name: "my-compression-plugin",
  // SDK پلاگین هوک‌های onRequest / onResponse / onError را افشا می‌کند. موتور را
  // هنگام بارگذاری ماژول پلاگین ثبت کنید (یا در اولین onRequest)؛ آن را
  // از مسیر teardown خودتان لغو ثبت کنید.
  onRequest: async (ctx) => {
    registerCompressionEngine(myEngine);
  },
});

// هنگام teardown:
// unregisterCompressionEngine("my-engine");
```

### آزمایش موتور خود

موتور خود را در یک پلاگین یا تابع راه‌اندازی ثبت کنید. پس از ثبت، موتور از طریق `id` آن
در انتخابگر استراتژی در دسترس خواهد بود. یکپارچگی را با ترکیب آن در یک خط لوله ترکیبی آزمایش کنید:

---

## ساخت بسته‌های زبانی

فشرده‌سازی به سبک Caveman از **بسته‌های قواعد خاص زبان** برای مدیریت کلمات پرکن، تعارف و الگوهای
طولانی در هر زبان طبیعی استفاده می‌کند. OmniRoute با **۶ بسته زبانی** ارسال می‌شود: `en`، `es`، `fr`، `de`، `ja`، `pt-BR`.

### ساختار بسته

یک بسته زبانی یک پوشه از **فایل‌های JSON** در مسیر `open-sse/services/compression/rules/<language>/` است:

```
open-sse/services/compression/rules/
├── en/
│   ├── filler.json          # تعارفات، حشو، مؤدبانه
│   ├── context.json         # قواعد کاهش بافتار
│   ├── dedup.json           # قواعد حذف تکراری
│   ├── structural.json      # نقطه‌گذاری، قالب‌بندی
│   └── ultra.json           # قواعد فشرده‌سازی تهاجمی
├── es/  (ساختار یکسان)
├── fr/  (ساختار یکسان)
├── de/  (ساختار یکسان)
├── ja/  (ساختار یکسان)
└── pt-BR/ (ساختار یکسان)
```

### آناتومی قاعده

هر قاعده این شکل را دارد (از `open-sse/services/compression/ruleLoader.ts`):

```ts
interface FileRule {
  name: string; // نام قابل خواندن توسط انسان (kebab-case)
  pattern: string; // الگوی regex جاوا‌اسکریپت
  replacement?: string; // با چه چیزی تطبیق جایگزین شود
  replacementMap?: Record<string, string>; // یا یک نگاشت key→replacement
  flags?: string; // پرچم‌های regex (معمولاً "gi")
  context?: "all" | "user" | "system" | "assistant";
  category?: "filler" | "context" | "structural" | "dedup" | "terse" | "ultra";
  minIntensity?: "lite" | "full" | "ultra"; // زیر این شدت رد شود
  description?: string; // مستندات
}
```

### مثال: افزودن قواعد پرکن هندی

```json
{
  "language": "hi",
  "category": "filler",
  "rules": [
    {
      "name": "polite_opener",
      "pattern": "\\b(?:नमस्ते|नमस्कार|आदरणीय)\\b[,!\\s]*",
      "replacement": "",
      "context": "all",
      "category": "filler",
      "minIntensity": "lite",
      "description": "Strip polite openers like 'नमस्ते'"
    },
    {
      "name": "filler_actually",
      "pattern": "\\b(?:असल में|वास्तव में|दरअसल)\\b\\s*",
      "replacement": "",
      "context": "all",
      "category": "filler",
      "minIntensity": "lite",
      "description": "Strip 'actually' fillers"
    },
    {
      "name": "verbose_plea",
      "pattern": "\\b(?:कृपया|कृपया आप|अनुरोध है कि आप)\\b\\s*",
      "replacement": "",
      "context": "all",
      "category": "filler",
      "minIntensity": "full",
      "description": "Strip 'please' in Hindi"
    }
  ]
}
```

### اعتبارسنجی

بسته‌های قواعد در هنگام بارگذاری در برابر `_schema.json` اعتبارسنجی می‌شوند. یک بسته با ساختار نامعتبر
بارگذاری نمی‌شود و یک خطا ثبت می‌کند:

```
RULE_LOADER: pack "hi/filler.json" failed validation:
  - rules.0.pattern: Invalid regex
  - rules.1.context: must be one of [all, user, system, assistant]
```

اعتبارسنجی به‌صورت خودکار هنگام بارگذاری یک بسته اجرا می‌شود (در برابر `_schema.json`)؛ یک
بسته نامعتبر رد می‌شود و خطای بالا ثبت می‌شود. اسکریپت `npm run` جداگانه‌ای برای اعتبارسنجی بسته
وجود ندارد — بسته را بارگذاری کنید (مثلاً سرور را راه‌اندازی کنید یا
مسیر فشرده‌سازی را اجرا کنید) و لاگ‌ها را تماشا کنید.

### بارگذاری یک بسته زبانی سفارشی

```ts
import { loadRulePack } from "omniroute/compression/ruleLoader";

await loadRulePack("./my-custom-rules/hi/filler.json");
```

یا در یک مکان شناسایی‌شده قرار دهید:

```
~/.omniroute/compression/rules/hi/filler.json  # سطح کاربر
<project>/.compression/rules/hi/filler.json   # سطح پروژه
```

### بهترین روش‌ها برای بسته‌های زبانی

1. **با `filler` شروع کنید** — این قواعد بیشترین تأثیر را دارند
2. **از `minIntensity` استفاده کنید** تا قواعد تهاجمی را گیت کنید — از فشرده‌سازی بیش از حد محافظت می‌کند
3. **موارد آزمون اضافه کنید** — آرایه `tests[]` را در JSON اضافه کنید تا رفتار را تأیید کنید
4. **ترتیب مهم است** — قواعد ابتدایی اول اعمال می‌شوند؛ قواعد پرتأثیر را اول قرار دهید
5. **با `replacement` محافظه‌کار باشید** — رشته خالی معمولاً درست است؛ هرگز محتوای جدید اضافه نکنید

### استراتژی ترجمه

هنگام بومی‌سازی بسته‌های قواعد به یک زبان جدید:

1. **نام قواعد را ترجمه کنید** — آن‌ها در خروجی اشکال‌زدایی ظاهر می‌شوند
2. **الگوهای regex را تطبیق دهید** — ترجمه مستقیم اغلب شکست می‌خورد (مرزهای کلمه متفاوت است)
3. **در برابر مکالمات واقعی آزمایش کنید** — بسته باید روی ورودی واقعی امن باشد
4. **با قراردادهای فرهنگی مطابقت کنید** — بسته‌های ژاپنی مثلاً کلمات پرکن افتخاری بیشتری از انگلیسی دارند

---

## خطوط لوله ترکیبی

یک **خط لوله ترکیبی** چندین موتور را به‌ترتیب اجرا می‌کند، که خروجی هر موتور به موتور بعدی تغذیه می‌شود. این
نحوه کار `mode: stacked` به‌صورت داخلی است.

### نحوه کار ترکیب

```
ورودی (10,000 توکن)
        │
        ▼
   ┌──────────┐
   │  موتور   │  اولویت 10
   │  A       │  ──▶ خروجی: 6,000 توکن (-40%)
   └────┬─────┘
        ▼
   ┌──────────┐
   │  موتور   │  اولویت 50
   │  B       │  ──▶ خروجی: 2,400 توکن (-60%)
   └────┬─────┘
        ▼
   ┌──────────┐
   │  موتور   │  اولویت 100
   │  C       │  ──▶ خروجی: 1,200 توکن (-80%)
   └────┬─────┘
        │
        ▼
خروجی نهایی (1,200 توکن، ~88% صرفه‌جویی ترکیبی)
```

هنگامی که `mode: "stacked"` انتخاب می‌شود، موتورها به‌ترتیب مشخص‌شده در آرایه `pipeline` به‌ترتیب اجرا می‌شوند.
خروجی موتور N به ورودی موتور N+1 تبدیل می‌شود.

### حالت‌های فشرده‌سازی

OmniRoute بر اساس پیکربندی، آستانه‌های راه‌اندازی خودکار و بازنویسی‌های combo، **یک حالت برای هر درخواست** انتخاب می‌کند.
حالت‌های موجود در `open-sse/services/compression/types.ts` (نوع `CompressionMode`) تعریف شده‌اند:

| حالت        | موتورها              | مورد استفاده                                                                                                                                                                                         |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off`       | هیچ‌کدام              | غیرفعال کردن همه فشرده‌سازی                                                                                                                                                                            |
| `rtk`       | فقط RTK              | نشست‌های سنگین از نظر خروجی فرمان (۸۰٪+ صرفه‌جویی)                                                                                                                                                    |
| `lite`      | فقط Lite             | فشرده‌سازی محافظه‌کارانه (سریع، امن)                                                                                                                                                                   |
| `standard`  | Caveman              | فشرده‌سازی متن معمولی با بسته‌های زبانی                                                                                                                                                                |
| `aggressive`| Caveman + Aggressive | متن تهاجمی + یک پاس نهایی تهاجمی                                                                                                                                                                       |
| `ultra`     | Ultra                | حداکثر فشرده‌سازی (با تلفات، آخرین راه‌حل). به‌صورت اختیاری از طریق موتور SLM **LLMLingua-2** هنگام تنظیم `ultra.modelPath` مسیریابی می‌شود (هنگام عدم دسترسی به مدل به مسیر مبتنی بر قاعده fail-open می‌کند). |
| `stacked`   | خط لوله سفارشی       | ترکیب موتورها به هر ترتیبی (به زیر مراجعه کنید)                                                                                                                                                        |

> علاوه بر موتورهای حالت بالا، رجیستری همچنین موتورهای قابل ترکیب تخصصی را ارسال می‌کند —
> **CCR**، **headroom**، **ionizer** و **session-dedup** — که در
> [COMPRESSION_ENGINES.md](./COMPRESSION_ENGINES.md#additional-built-in-engines) مستند شده‌اند.

انتخاب حالت توسط `getEffectiveMode()` در `open-sse/services/compression/strategySelector.ts` تعیین می‌شود:

1. اگر فشرده‌سازی غیرفعال باشد: `"off"`
2. اگر بازنویسی combo وجود داشته باشد: از بازنویسی استفاده کنید
3. اگر آستانه راه‌اندازی خودکار تجاوز شده باشد: از `autoTriggerMode` (پیش‌فرض: `"lite"`) استفاده کنید
4. در غیر این صورت: از `defaultMode` استفاده کنید

### خط لوله ترکیبی پیش‌فرض

هنگامی که `mode: "stacked"` به‌صورت صریح پیکربندی می‌شود، خط لوله پیش‌فرض ترکیب می‌کند:

1. **RTK** — حذف نویز خروجی فرمان (~۸۰٪ صرفه‌جویی بر خروجی ترمینال)
2. **Caveman** — حذف کلمات پرکن، موجز کردن متن (~۴۶٪ بر متن باقی‌مانده)
3. **Lite** — پاس نهایی فاصله + حذف تکراری

این ترکیب به **۷۸-۹۵٪ صرفه‌جویی** بر نشست‌های سنگین از نظر ابزار دست می‌یابد.

### پیکربندی خطوط لوله ترکیبی

در پیکربندی combo:

```json
{
  "compression": {
    "mode": "stacked",
    "pipeline": [
      { "engine": "rtk", "config": { "intensity": "aggressive" } },
      { "engine": "caveman", "config": { "intensity": "full" } },
      { "engine": "lite", "config": {} }
    ]
  }
}
```

می‌توانید موتورها را حذف کنید، موتورهای سفارشی اضافه کنید یا آن‌ها را مرتب کنید.

### انتقال وضعیت

موتورها می‌توانند متادیتا را از بافتار درخستان (در `options`) بخوانند:

```ts
compress(body, config) {
  // خواندن متادیتا از موتورهای قبلی
  const original = options?.compressionComboId;  // "my-coding-combo"
  // ...
}
```

این متادیتا **فقط خواندنی** است — موتورها نمی‌توانند بافتار درخستان را تغییر دهند، فقط خروجی بدنه خودشان را.

### نکات ترتیب اجرا

| ترتیب موتور                        | اثر                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------- |
| RTK → Caveman → Lite                | **توصیه‌شده** (ابتدا نویز را حذف می‌کند، سپس زبان، سپس فاصله)               |
| Lite → RTK → Caveman                | بد — Lite فاصله را از خروجی خام حذف می‌کند، که تطبیق الگوی RTK را شکست می‌دهد |
| Caveman → RTK                       | بد — Caveman ممکن است متنی را به روش‌هایی بازنویسی کند که RTK تشخیص نمی‌دهد |
| هر ترتیبی با `tool_results` اول     | بهتر — خروجی ابزار پرنویزترین محتواست                                       |

### زمانی که نباید ترکیب کرد

ترکیب همیشه بهتر نیست:

- **پیام‌های ساده** (بدون خروجی ابزار) — یک Caveman یا Lite کافی است
- **حساس به هزینه** — هر موتور ~۵-۵۰ms تأخیر اضافه می‌کند
- **ابزارهای خاص** — RTK به تنهایی معمولاً برای خروجی shell کافی است

### ساخت یک خط لوله سفارشی

هیچ رجیستری خط لوله نام‌گذاری‌شده‌ای وجود ندارد. یک خط لوله ترکیبی فقط یک **آرایه درون‌خطی
از مراحل** است که به `applyStackedCompression()` (صادر شده از
`@omniroute/open-sse/services/compression/strategySelector`) ارسال می‌شود:

```ts
import { applyStackedCompression } from "@omniroute/open-sse/services/compression/strategySelector";

const result = applyStackedCompression(body, [
  { engine: "rtk", intensity: "aggressive" },
  { engine: "caveman", intensity: "full" },
]);
```

هنگامی که خط لوله‌ای ارسال نمی‌کنید، پیش‌فرض `rtk(standard) → caveman(full)` می‌شود.

برای هدایت آن از پیکربندی، `mode: "stacked"` را تنظیم کنید و آرایه مراحل را تحت
`stackedPipeline` قرار دهید (از `config.stackedPipeline` خوانده می‌شود):

```json
{
  "compression": {
    "mode": "stacked",
    "stackedPipeline": [
      { "engine": "rtk", "intensity": "aggressive" },
      { "engine": "caveman", "intensity": "full" }
    ]
  }
}
```

---

## سیاست همگام‌سازی بالادست

موتورهای فشرده‌سازی OmniRoute در README به چند پروژه بالادست اعتبار می‌دهند
("با الهام از RTK، Caveman، LLMLingua-2، Troglodita"). یک سؤال رایج از مشارکت‌کنندگان
این است: **هنگامی که RTK بالادست یک فیلتر ابزار جدید اضافه می‌کند یا Caveman یک بسته قاعده
اضافه می‌کند، چگونه به OmniRoute می‌رسد؟** این بخش پاسخ مرجع است.

### نسخه‌های vendored در مقابل پیاده‌سازی‌های مستقل

| موتور                          | رابطه با بالادست                                                                                                              | محل                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **RTK**                        | **پیاده‌سازی مجدد مستقل** (با الهام، نه کپی)                                                                                  | `open-sse/services/compression/engines/rtk/`                        |
| **Caveman**                    | **پیاده‌سازی مجدد مستقل** (با الهام)                                                                                          | `open-sse/services/compression/engines/cavemanAdapter.ts`           |
| **Headroom**                   | عمدتاً داخلی؛ فقط کدک `gcf/` واقعاً از `gcf-typescript` vendored شده است (MIT، با علامت SPDX، فقط پروفایل عمومی)               | `open-sse/services/compression/engines/headroom/gcf/`               |
| **LLMLingua-2 / Troglodita**   | با الهام (موتورهای `llmlingua` + `session-dedup` را هدایت می‌کنند)                                                            | `open-sse/services/compression/engines/llmlingua/`, `session-dedup` |

نکته کلیدی: **RTK و Caveman پیاده‌سازی‌های TypeScript اتاق تمیز از
_ایده‌ها_ (قواعد فیلتر، بسته‌های قواعد) هستند، نه درخت‌های کد منبع vendored.** هیچ
کپی بالادستی برای `git pull` وجود ندارد — که دقیقاً به همین دلیل README می‌گوید
"با الهام از" به جای "باندل شده".

### نحوه ادغام بهبودهای بالادست

**هیچ ردیابی خودکار انتشار بالادست و هیچ برچسب `compression-sync`**
وجود ندارد — بر اساس طراحی. از آنجا که موتورها پیاده‌سازی مجدد هستند، یک فیلتر RTK
بالادست یا بسته قاعده Caveman به‌عنوان کد ادغام نمی‌شود؛ بلکه **به‌عنوان یک قاعده/فیلتر
جدید در قالب خود OmniRoute بازنویسی می‌شود** (به
[COMPRESSION_RULES_FORMAT.md](./COMPRESSION_RULES_FORMAT.md) مراجعه کنید) و به‌صورت ad-hoc از طریق
یک PR عادی فرود می‌آید. نقاط گسترش بالا (موتور سفارشی، بسته زبانی، فیلتر RTK)
راه تأییدشده برای مشارکت یکی هستند.

نمونه‌های اخیر دقیقاً از این جریان:

- فیلترهای RTK برای خروجی build Gradle و `dotnet` (نسخه v3.8.42)
- فیلترهای RTK برای kubectl / docker-build / composer / gh (#2824)
- بسته زبانی اندونزیایی Caveman (#3975)، به علاوه بسته‌های آلمانی / فرانسوی / ژاپنی / چینی

### Headroom (پروکسی فشرده‌سازی ورودی)

Headroom **کاملاً داخلی** است — یک snapshot کدک `gcf` vendored پین‌شده به علاوه
لایه‌های `smartcrusher` / `toon` / `tabular` خود OmniRoute. هیچ بالادست زنده‌ای
برای ردیابی فراتر از کپی vendored وجود ندارد؛ به‌روزرسانی‌های `gcf` به‌صورت دستی
هنگام تغییر کدک تازه‌سازی می‌شوند و در برابر گیت بودجه فشرده‌سازی
(`check:compression-budget`) دوباره اعتبارسنجی می‌شوند.

### پیشنهاد یک بهبود با الهام از بالادست

1. **vendor نکنید** — قاعده/فیلتر بالادست را در قالب OmniRoute بازنویسی کنید.
2. آن را از طریق نقطه گسترش مطابق زیر اضافه کنید (بسته زبانی، فیلتر RTK یا
   موتور سفارشی).
3. به پروژه بالادست در توضیح PR ارجاع دهید (اعتبار)، نه با
   کپی کردن کد منبع حامل لایسنس آن.
4. آزمون‌ها را اضافه کنید و تأیید کنید که گیت `check:compression-budget` همچنان عبور می‌کند.

---

## بهترین روش‌ها

### توسعه موتور

1. **همیشه `validateConfig` را پیاده‌سازی کنید** — موتورها بدون اعتبارسنجی باعث شکست‌های بی‌صدا می‌شوند
2. **`targetLatencyMs` واقع‌بینانه تنظیم کنید** — توسط انتخابگر استراتژی برای انتخاب موتورها استفاده می‌شود
3. **از `getConfigSchema` برای داشبورد استفاده کنید** — هرگز پیکربندی را از کاربران پنهان نکنید
4. **اگر موتور شما خالص است `stackable: true` را پشتیبانی کنید** — موتورها با عوارض جانبی نباید ترکیب شوند
5. **آزمون‌های درون‌خطی بنویسید** — موتورها باید در کمتر از ۱ ثانیه قابل تأیید باشند

### توسعه بسته زبانی

1. **با شدت `lite` شروع کنید** — قواعد شما باید در کمترین تنظیم امن باشند
2. **از `context` برای محدود کردن قواعد استفاده کنید** — قواعد فقط `user` نمی‌توانند به‌طور تصادفی روی پرامپت‌های سیستم تأثیر بگذارند
3. **از گرفتن کلیدهای JSON پرهیز کنید** — `\\bword\\b` می‌تواند داخل JSON تطبیق کند و داده‌های ساختاریافته را خراب کند
4. **با موارد لبه آزمایش کنید** — ورودی خالی، unicode، متن RTL، emojiها
5. **از بسته‌های موجود به عنوان قالب استفاده کنید** — `en/filler.json` نمونه پرتوسعه‌یافته‌تر است

### طراحی خط لوله

1. **قبل از بهینه‌سازی پروفایل کنید** — ابتدا با `compression_stats` اندازه‌گیری کنید
2. **ترکیب را به جای پیاده‌سازی مجدد ترجیح دهید** — قواعد Caveman را قبل از نوشتن یک موتور جدید گسترش دهید
3. **دلیل ترتیب را مستند کنید** — توضیح دهید چرا موتور A قبل از موتور B
4. **در هر ۳ سطح شدت آزمایش کنید** — `lite` سریع اما با تلفات است، `ultra` کند اما دقیق است

---

## مرجع: موتورهای داخلی

| شناسه موتور         | قابل ترکیب | stackPriority پیش‌فرض | اهداف                               |
| ------------------- | ---------- | --------------------- | ----------------------------------- |
| `lite`              | بله        | 5                     | messages, tool_results              |
| `rtk`               | بله        | 10                    | tool_results                        |
| `standard` (caveman)| بله        | 20                    | messages, tool_results, code_blocks |
| `aggressive`        | بله        | 30                    | messages                            |
| `ultra`             | بله        | 40                    | messages, code_blocks               |

### مراجعه کنید به

- [COMPRESSION_GUIDE.md](./COMPRESSION_GUIDE.md) — مرور کلی خط لوله
- [COMPRESSION_ENGINES.md](./COMPRESSION_ENGINES.md) — مرجع رجیستری موتور
- [COMPRESSION_RULES_FORMAT.md](./COMPRESSION_RULES_FORMAT.md) — مشخصات قالب قواعد
- [COMPRESSION_LANGUAGE_PACKS.md](./COMPRESSION_LANGUAGE_PACKS.md) — جزئیات بسته زبانی
- [RTK_COMPRESSION.md](./RTK_COMPRESSION.md) — موتور RTK و فیلترهای سفارشی
- منبع: `open-sse/services/compression/` (۱۱۷ فایل، ~۲۵۰KB)
