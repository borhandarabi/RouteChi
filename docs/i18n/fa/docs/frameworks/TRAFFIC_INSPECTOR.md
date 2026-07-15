---
title: "بازرس ترافیک"
version: 3.8.40
lastUpdated: 2026-06-28
---

# بازرس ترافیک

بازرس ترافیک اشکال‌زدای HTTPS داخلی OmniRoute است — ابزاری شبیه Charles Proxy / mitmweb / HTTP Toolkit که **آگاه به LLM** و **آگاه به عامل** است. این ابزار در `/dashboard/tools/traffic-inspector` قرار دارد و ترافیک زنده را از حداکثر ۵ منبع capture همزمان دریافت می‌کند.

**موقعیت داشبورد:** `/dashboard/tools/traffic-inspector`
**گروه نوار کناری:** Tools (پس از AgentBridge)
**همچنین ببینید:** [`AGENTBRIDGE.md`](./AGENTBRIDGE.md) — AgentBridge حالت capture ۱ است.

---

## §۱ نمای کلی

### چه چیزی بازرس ترافیک را منحصربه‌فرد می‌کند

| قابلیت                                                             | mitmweb | Charles | Fiddler | **بازرس ترافیک OmniRoute** |
| ------------------------------------------------------------------- | :-----: | :-----: | :-----: | :-----------------------------: |
| مبتنی بر وب                                                           |    ✓    |    ✗    |    ✗    |                ✓                |
| متن‌باز                                                         |    ✓    |    ✗    | جزئی |                ✓                |
| **آگاه به عامل** (می‌داند درخواست از Antigravity/Copilot/... است یا نه) |    ✗    |    ✗    |    ✗    |                ✓                |
| **آگاه به LLM** (ساختار OpenAI/Anthropic/Gemini، توکن‌ها، مدل را تجزیه می‌کند) |    ✗    |    ✗    |    ✗    |                ✓                |
| **نگاشت مدل قابل‌مشاهده** (gemini-3-flash → claude-sonnet-4.7)      |    ✗    |    ✗    |    ✗    |                ✓                |
| **تفکیک latency پروکسی/upstream**                                    | جزئی |    ✗    |    ✗    |                ✓                |
| **یکپارچه با مسیریابی، fallback، هزینه OmniRoute**               |    ✗    |    ✗    |    ✗    |                ✓                |
| **اشکال‌زدای پروکسی سراسسی** (هر اپ روی ماشین)                |    ✓    |    ✓    |    ✓    |                ✓                |
| **capture میزبان سفارشی** (تغییر مسیر DNS به ازای میزبان)                     |    ✓    |    ✓    |    ✓    |                ✓                |
| **حالت env مربوط به HTTP_PROXY**                                             |    ✓    |    ✓    |    ✓    |                ✓                |
| **نمای مکالمه** (حباب‌های چندنوبتی، tool_use/tool_result)    |    ✗    |    ✗    |    ✗    |                ✓                |
| **ادغام جریان SSE** (بازسازی از رویدادهای delta)               |    ✗    |    ✗    |    ✗    |                ✓                |
| **ضبط نشست** (نام‌گذاری‌شده، قابل خروجی .har/.jsonl)               |    ✗    |    ✓    |    ✓    |                ✓                |

### معماری در یک پاراگراف

`TrafficBuffer` (`src/mitm/inspector/buffer.ts`) یک بافر حلقوی درون‌حافظه‌ای مشترک است (پیش‌فرض ۱۰۰۰ ورودی، قابل پیکربندی از طریق `INSPECTOR_BUFFER_SIZE`). تمام منابع capture از طریق `push()` به آن می‌نویسند. بافر هر ورودی را با استفاده از `kindDetector.ts` (تشخیص می‌دهد که آیا یک درخواست LLM است یا نه) طبقه‌بندی می‌کند، یک `contextKey` (اثرانگشت SHA-256 از system prompt) محاسبه می‌کند و از طریق `globalTrafficBuffer.subscribe()` به تمام مشترکین WebSocket پخش می‌کند. داشبورد از طریق `GET /api/tools/traffic-inspector/ws` متصل می‌شود و یک snapshot هنگام اتصال دریافت می‌کند، سپس رویدادهای `new`/`update`/`clear` دریافت می‌کند.

---

## §۲ حالت‌های capture

بازرس ترافیک از **۵ منبع capture همزمان** پشتیبانی می‌کند. هر کدام به‌صورت مستقل قابل toggle هستند. فیلد `source` روی هر `InterceptedRequest` (`src/mitm/inspector/types.ts`) یکی از `"agent-bridge"`، `"custom-host"`، `"http-proxy"`، `"system-proxy"` یا `"tproxy"` است.

### حالت ۱ — AgentBridge (پیش‌فرض، همیشه روشن)

**منبع:** هندلرهای AgentBridge (`src/mitm/handlers/base.ts`)
**مکانیزم:** هر فراخوانی `intercept()` در `MitmHandlerBase` قبل از forward کردن `hookBufferStart()` و پس از تکمیل `hookBufferUpdate()` را فراخوانی می‌کند. بدون پیکربندی اضافه — به‌محض اینکه AgentBridge در حال اجرا باشد کار می‌کند.
**دسترس:** ۹ عامل IDE پیکربندی‌شده در AgentBridge
**نکته:** فیلد `source` در `InterceptedRequest` = `"agent-bridge"`

### حالت ۲ — میزبان‌های سفارشی (تغییر مسیر DNS)

**منبع:** فهرست میزبان تعریف‌شده توسط کاربر (جدول `inspector_custom_hosts`)
**مکانیزم:** افزودن یک میزبان از طریق رابط کاربری، `127.0.0.1 <host>` را به `/etc/hosts` اضافه می‌کند (نیازمند sudo). سرور MITM موجود AgentBridge (پورت ۴۴۳) به‌صورت پویا یک گواهی SNI برای میزبان جدید تولید می‌کند.
**دسترس:** هر اپلیکیشن که از میزبان اضافه‌شده استفاده کند — بدون تغییر پیکربندی اپ
**نکته:** `source` = `"custom-host"`

نمونه موارد استفاده:

- مانیتور `api.openai.com` از اسکریپت‌های پایتون
- اشکال‌زدایی `my-internal-llm.company.com`
- capture ترافیک از دستگاه‌های موبایل روی همان شبکه (از طریق ARP spoofing — پیشرفته)

### حالت ۳ — شنونده HTTP_PROXY (پورت 8080)

**منبع:** اپلیکیشن‌هایی که از متغیرهای محیطی `HTTP_PROXY`/`HTTPS_PROXY` استفاده می‌کنند
**مکانیزم:** شنونده ثانویه در پورت ۸۰۸۰ (`src/mitm/inspector/httpProxyServer.ts`) که به‌عنوان یک پروکسی صریح HTTP/HTTPS استاندارد عمل می‌کند. تونل‌های `CONNECT` (HTTPS) و درخواست‌های مستقیم HTTP را می‌پذیرد.
**دسترس:** هر اپلیکیشنی که به `HTTP_PROXY` env احترام بگذارد — بدون تغییر DNS، بدون sudo
**نکته:** `source` = `"http-proxy"`

```bash
# capture سریع برای یک دستور واحد:
HTTPS_PROXY=http://127.0.0.1:8080 curl https://api.openai.com/v1/models

# capture پایدار در یک نشست shell:
export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080
```

**محدودیت TLS:** تونل‌های HTTPS `CONNECT` فقط به‌عنوان فراداده capture می‌شوند (میزبان، پورت، زمان‌بندی) — بدنه TLS به‌صورت پیش‌فرض رمزگشایی نمی‌شود. برای بازرسی کامل بدنه، toggle "Decrypt HTTPS in proxy mode" را فعال کنید (opt-in، نیازمند اعتماد به گواهی AgentBridge).

**تعارض پورت:** اگر پورت ۸۰۸۰ در حال استفاده باشد، AgentBridge یک ۴۰۹ با خطای ساختاریافته برمی‌گرداند. پورت را از طریق متغیر محیطی `INSPECTOR_HTTP_PROXY_PORT` تغییر دهید.

### حالت ۴ — پروکسی سراسسی (پیشرفته، opt-in)

**منبع:** تنظیمات پروکسی سطح OS (برای تمام اپ‌ها روی ماشین اعمال می‌شود)
**مکانیزم:** از APIهای OS برای تغییر مسیر تمام ترافیک HTTP/HTTPS از طریق شنونده HTTP_PROXY استفاده می‌کند:

- **macOS:** `networksetup -setwebproxy / -setsecurewebproxy`
- **Linux:** `gsettings set org.gnome.system.proxy` + `/etc/environment`
- **Windows:** `netsh winhttp set proxy 127.0.0.1:8080`
  **دسترس:** هر اپلیکیشن روی ماشین که به تنظیمات پروکسی سیستم احترام بگذارد
  **نکته:** `source` = `"system-proxy"`

**مکانیزم‌های ایمنی:**

- تایمر auto-disable (پیش‌فرض ۳۰ دقیقه، قابل پیکربندی از طریق `INSPECTOR_SYSTEM_PROXY_GUARD_MINUTES`)
- وضعیت قبلی پروکسی سیستم در DB ذخیره شده و هنگام بازگشت بازگردانده می‌شود
- داشبورد در صورت پیمایش کاربر به‌جای دیگری در حالی که فعال است، اعلان "Reverting system proxy" را نشان می‌دهد
- رابط کاربری نشانگر `⚠ Advanced` + checkbox تأیید صریح را نمایش می‌دهد

### حالت ۵ — رمزگشایی شفاف TPROXY (لینوکس، root، opt-in)

**منبع:** TPROXY هسته + policy routing (`src/mitm/tproxy/`)
**مکانیزم:** اتصالات TCP خروجی محلی جدید به یک پورت هدف (پیش‌فرض `443`) را در `mangle OUTPUT` علامت‌گذاری می‌کند، یک `ip rule` بسته‌های علامت‌گذاری‌شده را به تحویل محلی تغییر مسیر می‌دهد، و هدف `TPROXY` در `mangle PREROUTING` آن‌ها را به یک شنونده شفاف (**IP_TRANSPARENT**) تحویل می‌دهد (پورت پیش‌فرض `8443`). شنونده TLS را با یک گواهی برگ که **به‌ازای hostname SNI به‌موقع** توسط یک CA پویا صادر شده است، خاتمه می‌دهد، تبادل رمزگشایی‌شده را capture می‌کند، و درخواست را دوباره رمزگذاری‌شده به مقصد اصلی forward می‌کند.
**دسترس:** میزبان‌های مقصد **دلخواه** روی پورت هدف — بدون spoof مربوط به `/etc/hosts`، بدون env مربوط به `HTTP_PROXY`، بدون تغییر پروکسی سراسسی. فرآیند رهگیری‌شده نیازی به تغییر پیکربندی ندارد، اما باید به CA پویا اعتماد کند.
**نکته:** `source` = `"tproxy"`

**نیازمندی‌ها:** فقط لینوکس (**IP_TRANSPARENT** فقط لینوکس است)، قابلیت **CAP_NET_ADMIN** (root)، و یک addon بومی N-API که باید با یک toolchain C ساخته شود (`npm run build:native:tproxy`). وقتی در دسترس نباشد، toggle داشبورد با tooltip "TPROXY decrypt requires Linux + root + the native addon" غیرفعال می‌شود. قوانین فایروال به‌صورت تراکنشی اعمال/بازگشت می‌شوند (یک کرش هرگز یک قانون `mangle` پشت سر نمی‌گذارد) و هنگام reboot flush می‌شوند. یک anti-loop مبتنی بر SO_MARK جلوی forward مجدد رمزگذاری‌شده پروکسی را از رهگیری مجدد می‌گیرد.

این یک زیرسیستم قابل‌توجه با راهنمای اپراتور اختصاصی خود است — به **[`docs/security/MITM-TPROXY-DECRYPT.md`](../security/MITM-TPROXY-DECRYPT.md)** برای دستورالعمل کامل فایروال، CA پویا به ازای SNI + نصب‌کننده trust-store، مسیر فقط محلی، جزئیات anti-loop و schema پیکربندی مراجعه کنید. toggle توسط `GET / POST / DELETE /api/tools/agent-bridge/tproxy` هدایت می‌شود (نکته: مسیر زیر پیشوند AgentBridge قرار دارد، نه پیشوند بازرس ترافیک).

### مقایسه حالت‌های capture

| حالت              | راه‌اندازی                         |          Sudo؟          | دسترس                       | یادداشت‌ها                                                                                                       |
| ----------------- | ----------------------------- | :---------------------: | --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ۱. AgentBridge    | خودکار                     |    یک‌بار (cert+hosts)    | ۹ عامل IDE                | پیش‌فرض روشن                                                                                                  |
| ۲. میزبان‌های سفارشی   | ورودی به ازای میزبان                |    بله (فایل hosts)     | هر اپ با آن میزبان     | در DB ماندگار است                                                                                             |
| ۳. HTTP_PROXY     | `export HTTPS_PROXY=...`      |           خیر            | اپ‌هایی که به env احترام می‌گذارند         | پورت ۸۰۸۰، بدون رمزگشایی TLS به‌صورت پیش‌فرض                                                                        |
| ۴. سراسسی    | Toggle + تأیید              |           بله           | تمام اپ‌ها روی ماشین         | auto-disable در ۳۰ دقیقه                                                                                      |
| ۵. رمزگشایی TPROXY | Toggle (لینوکس + addon بومی) | بله (root + نصب CA) | هر میزبان روی پورت هدف | میزبان‌های دلخواه را رمزگشایی می‌کند؛ به‌صورت پیش‌فرض خاموش است — به [MITM-TPROXY-DECRYPT.md](../security/MITM-TPROXY-DECRYPT.md) مراجعه کنید |

---

## §۳ رابط کاربری

### ۳.۱ چیدمان

```
┌─ Traffic Inspector ─────────────────────────────────────────────────────┐
│ ┌─ Capture sources toolbar ─────────────────────────────────────────┐   │
│ │ [✓ AgentBridge]  [✓ Custom hosts (3)]  [○ HTTP_PROXY]  [○ System]│   │
│ └─────────────────────────────────────────────────────────────────────┘  │
│ ┌─ Filter/control bar ──────────────────────────────────────────────┐   │
│ │ Profile: (●) LLM only  (○) Custom  (○) All                        │   │
│ │ [⎉ Pause] [🗑 Clear] [⬇ .har] [● REC session]    ● live 482/1k  │   │
│ └─────────────────────────────────────────────────────────────────────┘  │
├══◀▶══════════════════════════════╬══════════════════════════════════════╤╡
│ REQUEST LIST (resizable)         ║ DETAIL PANE                         ▲ │
│ ────────────────────────────── │ ║ [Conversation][Headers][Request]    │ │
│ ▎ 14:32 POST 200 12k AG openai ║ [Response][Timing][LLM][Stats]      │ │
│ ▎ 14:31 POST 200 8k  CP openai ║                                     ▼ │
│ ▎ 14:31 POST 503 ⚠   KR ...   ║                                       │
│ ▎ 14:30 GET  200 3k  🌐 custom ║                                       │
└══════════════════════════════════╝══════════════════════════════════════╝
```

### ۳.۲ فهرست درخواست‌ها (پنل چپ)

- **مجازی‌شده** (`useVirtualList` + `ResizeObserver`): ۱۰۰۰ آیتم را بدون فریز هندل می‌کند
- **اسکرول خودکار** با toggle برای مکث هنگام بازرسی
- **وضعیت رنگی**: سبز (۲xx)، زرد (۳xx)، قرمز (۴xx/۵xx)، خاکستری (در حال انجام)
- **ایموجی عامل**: 🔵 Antigravity، 🟢 Copilot، 🟠 Kiro، 🟣 Codex، 🔷 Cursor، 🟤 Zed، 🟡 Claude Code، ⚫ Open Code، 🌐 میزبان سفارشی
- **نوار رنگ context**: حاشیه چپ ۱px رنگی بر اساس `contextKey` (SHA-256 از system prompt) — مکالمات مرتبط را به‌صورت بصری گروه‌بندی می‌کند
- **بدنه lazy**: فقط بدنه درخواست انتخاب‌شده در تب‌های جزئیات materialize می‌شود (از رندر ۱۰۰۰ × ۱MB بدنه جلوگیری می‌کند)

### ۳.۳ پنل جزئیات — ۷ تب

| تب              | محتوا                                                                      | یادداشت‌ها                                                                                       |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **مکالمه** | حباب‌های چندنوبتی چت (system/user/assistant + tool_use/tool_result)       | از هر فرمت ارائه‌دهنده نرمال‌شده؛ فقط برای `detectedKind === "llm"` نمایش داده می‌شود                |
| **Headers**      | جدول‌های هدر درخواست + پاسخ                                             | هدرهای حساس (Authorization, Cookie, api-key) به‌صورت پیش‌فرض ماسک می‌شوند؛ toggle "Show secrets" |
| **درخواست**      | بدنه خام، نمای درختی JSON، نشانگر فیلد مدل                                  | JSON pretty-print شده یا متن خام                                                             |
| **پاسخ**     | بدنه خام یا فهرست رویداد SSE؛ toggle "Raw ↔ Merged"                            | ادغام‌کننده SSE پیام نهایی را از رویدادهای delta بازسازی می‌کند                                     |
| **زمان‌بندی**       | Waterfall: سربار پروکسی در برابر latency upstream                                | مجموع، TTFB و اندازه                                                                       |
| **جزئیات LLM**  | ارائه‌دهنده، مدل، تعداد پیام‌ها، توکن ورودی/خروجی، برآورد هزینه، هدف نگاشت‌شده | فقط برای درخواست‌های LLM نمایش داده می‌شود                                                                 |
| **آمار**        | Recharts: timeline مربوط به latency، نمودار میله‌ای توکن، scatter مربوط به فراخوانی ابزار               | فقط هنگام load یک نشست ضبط‌شده نمایش داده می‌شود                                                |

### ۳.۴ کنترل‌های نوار ابزار

| کنترل          | اقدام                                                                |
| ---------------- | --------------------------------------------------------------------- |
| ⎉ مکث          | رندر درخواست‌های جدید را متوقف می‌کند؛ نشانگر "X new" انباشته می‌شود               |
| 🗑 پاک‌سازی         | فهرست رابط کاربری را پاک می‌کند (بافر سرور تحت تأثیر قرار نمی‌گیرد)                    |
| ⬇ خروجی .har    | فهرست فیلتر‌شده فعلی را به‌عنوان فایل HAR دانلود می‌کند                           |
| ● ضبط نشست | یک نشست ضبط نام‌گذاری‌شده را شروع می‌کند                                      |
| انتخابگر پروفایل | فقط LLM / میزبان‌های سفارشی / همه                                         |
| فیلتر میزبان      | تطابق زیررشته روی فیلد `host`                                       |
| فیلتر عامل     | Dropdown: همه / به ازای هر عامل                                             |
| فیلتر وضعیت    | همه / ۲xx / ۳xx / ۴xx / ۵xx / خطا                                   |
| فیلتر منبع    | همه / agent-bridge / custom-host / http-proxy / system-proxy / tproxy |
| فیلتر **زنده**  | فقط درخواست‌های در حال انجام (باز) را نشان می‌دهد — toggle مربوط به `liveOnly` (به §۴.۶ مراجعه کنید)    |

### ۳.۵ پنل‌های قابل تغییر اندازه

- فهرست و پنل جزئیات با یک هندل drag جدا شده‌اند
- عرض فهرست: حداقل ۲۸۰px، حداکثر ۷۲۰px، در `localStorage` (`inspector.listWidth`) ماندگار است
- قابل جمع‌شدن به یک rail ۴۸px (فقط آیکون)؛ روی یک ردیف در rail کلیک کنید تا باز شود

---

## §۴ قابلیت‌های آگاه به LLM

### ۴.۱ تشخیص‌کننده نوع (`src/mitm/inspector/kindDetector.ts`)

هر درخواست را با استفاده از ۴ سیگنال به‌عنوان `"llm"`، `"app"` یا `"unknown"` طبقه‌بندی می‌کند:

۱. **رجیستری میزبان** — حدود ۱۸ hostname مربوط به API LLM شناخته‌شده (OpenAI, Anthropic, Gemini, Groq, Mistral, Together, Fireworks, Cohere, Perplexity, Hugging Face, OpenRouter, xAI, Moonshot و غیره)
۲. **الگوهای مسیر** — `/v1/chat/completions`, `/v1/messages`, `/generateContent`, `/v1/responses` و غیره.
۳. **شکل بدنه** — `messages[]` (OpenAI/Claude), `contents[]` (Gemini), فیلدهای `prompt`, `input` را تشخیص می‌دهد
۴. **راهنمایی‌های user-agent** — `codex`, `claude`, `gemini`, `antigravity`, `kiro`, `copilot`, `cursor` در رشته UA

میزبان‌های سفارشی اضافه‌شده از طریق حالت ۲، `kind` خود را از ورودی فرم به ارث می‌برند (پیش‌فرض `"custom"`).

### ۴.۲ ادغام‌کننده SSE (`src/mitm/inspector/sseMerger.ts`)

**پورت MIT از [chouzz/llm-interceptor](https://github.com/chouzz/llm-interceptor)**

پیام دستیار نهایی را از رویدادهای delta خام SSE بازسازی می‌کند:

- **Anthropic**: `content_block_delta` را بر اساس index انباشته می‌کند؛ `text_delta`, `input_json_delta` (فراخوانی ابزار), `thinking_delta` را هندل می‌کند
- **OpenAI**: `choices[i].delta.content` و `tool_calls` را بر اساس index انباشته می‌کند
- **Gemini**: `candidates[i].content.parts` را انباشته می‌کند
- **ناشناخته**: رویدادهای خام را به‌همان‌شکل برمی‌گرداند

تب Response یک toggle نشان می‌دهد: **"Raw events ↔ Merged"**.

### ۴.۳ نرمالایزر مکالمه (`src/mitm/inspector/conversationNormalizer.ts`)

**پورت MIT از [chouzz/llm-interceptor](https://github.com/chouzz/llm-interceptor)**

فرمت‌های پیام OpenAI, Anthropic و Gemini را قبل از رندر به یک `NormalizedConversation` واحد تبدیل می‌کند:

```ts
interface NormalizedConversation {
  request: NormalizedTurn[]; // messages / contents / prompt از بدنه درخواست
  response: NormalizedTurn[]; // پاسخ دستیار (از طریق sseMerger ادغام‌شده)
  contextKey: string | null; // اثرانگشت SHA-256 از system prompt
}
```

انواع بلوک: `text`, `tool_use`, `tool_result`. تب Conversation از این شکل بدون توجه به ارائه‌دهنده استفاده می‌کند.

### ۴.۴ رنگ‌سازی کلید بافتار (`src/mitm/inspector/contextKey.ts`)

- `SHA-256` از system prompt (اولین پیام `role:system`، یا فیلد `system`، یا `systemInstruction` مربوط به Gemini) را محاسبه می‌کند
- یک پیشوند hex ۱۲ کاراکتری (`"a3f9c2..."`) برمی‌گرداند
- frontend کلید را به یک رنگ HSL قطعی برای نوار حاشیه چپ نگاشت می‌کند
- **فیلتر "same context"**: کلیک روی چیپ `ctx #a3f` یک فیلتر اضافه می‌کند تا فقط درخواست‌ها با همان اثرانگشت نشان داده شوند

این کار تشخیص بصری «شخصیت‌ها» یا وظایف مختلف در حال اجرا در همان نشست عامل را آسان می‌کند.

### ۴.۵ استخراج فراداده LLM

برای درخواست‌های LLM، تب LLM Details موارد زیر را استخراج می‌کند:

```ts
interface LlmMetadata {
  provider: string | null; // "openai" | "anthropic" | "gemini" | ...
  apiKind: string | null; // "chat.completions" | "messages" | "embeddings" | ...
  model: string | null; // از بدنه درخواست یا پاسخ
  messages: number; // تعداد نوبت‌ها
  tokensIn: number | null; // usage.prompt_tokens / usage.input_tokens
  tokensOut: number | null; // usage.completion_tokens / usage.output_tokens
  streamed: boolean; // true اگر پاسخ SSE باشد
  mappedTo: string | null; // هدر x-omniroute-mapped
  costEstimateUsd: number | null; // برآورد هزینه بر اساس قیمت‌گذاری OmniRoute
}
```

### ۴.۶ فیلتر درخواست زنده در حال انجام

فیلد `status` درخواست `number | "in-flight" | "error"` است — یک ورودی به‌محض
شروع درخواست به‌عنوان `"in-flight"` push می‌شود و **در محل به‌روزرسانی می‌شود**
وقتی پاسخ (یا خطا) می‌رسد. toggle **"Live"** در نوار ابزار
(`liveOnly`, کلید i18n `trafficInspector.liveOnly`) فهرست را به ورودی‌هایی محدود می‌کند
که `status === "in-flight"` دارند، تا بتوانید اتصالات باز را در زمان واقعی تماشا کنید.

این فیلتر یک مسلم سمت کلاینت خالص در
`src/lib/inspector/matchesTrafficFilter.ts` است:

```ts
if (f.liveOnly && req.status !== "in-flight") return false;
```

وضعیت toggle در `useTrafficFilters` (hook‌های داشبورد بازرس) قرار دارد و
با سایر فیلترها (پروفایل، میزبان، عامل، منبع، وضعیت، context) ترکیب می‌شود.

### ۴.۷ انتساب فرآیند (لینوکس)

در لینوکس، هر درخواست رهگیری‌شده می‌تواند به **فرآیند محلی
مبدأ** منتسب شود. دو فیلد اختیاری به `InterceptedRequest` اضافه می‌شود:

```ts
pid?: number;          // شناسه فرآیند مبدأ (فقط لینوکس)
processName?: string;  // نام فرآیند مبدأ (فقط لینوکس)
```

`src/mitm/inspector/processAttribution.ts` پورت ephemeral
 کلاینت اتصال را به یک PID + نام به این صورت نگاشت می‌کند:

۱. خواندن `/proc/net/tcp` و `/proc/net/tcp6` برای یافتن socket inode مربوط به
   پورت (`parseProcNetTcpForInode`, یک پارسر خالص قابل تست fixture).
۲. اسکن `/proc/<pid>/fd/` برای یک symlink به `socket:[<inode>]`.
۳. خواندن نام فرآیند از `/proc/<pid>/comm`.

یک کش TTL یک‌ثانیه‌ای هزینه اسکن procfs را تحت بار محدود می‌کند. انتساب
**best-effort** است — هر شکستی به `null` حل می‌شود و هرگز capture را مسدود نمی‌کند. در
macOS/Windows تابع `null` برمی‌گرداند (stub؛ پشتیبانی از `lsof`/`GetExtendedTcpTable`
یک پیگیری است).

---

## §۵ نشست‌ها

### ۵.۱ ضبط یک نشست

۱. روی **"● Record session"** در نوار ابزار کلیک کنید → یک نام وارد کنید (اختیاری)
۲. live tail به‌طور عادی ادامه می‌یابد؛ یک نشانگر قرمز نبضی `◉ REC · <name> · 00:42 · 23 reqs` را نمایش می‌دهد
۳. روی **"⏹ Stop"** کلیک کنید → snapshot نشست در `inspector_sessions` + `inspector_session_requests` ذخیره می‌شود

### ۵.۲ مشاهده یک نشست ضبط‌شده

Dropdown **Sessions** در نوار ابزار نشست‌های ذخیره‌شده را فهرست می‌کند. انتخاب یکی:

- snapshot نشست را load می‌کند (وضعیت ثابت)
- یک بنر نشان می‌دهد: `Viewing recorded session "<name>" — [Back to live]`
- تب Stats با تجمیع‌های Recharts در دسترس می‌شود

### ۵.۳ فرمت‌های خروجی

هر نشست می‌تواند به‌عنوان موارد زیر خروجی گرفته شود:

| فرمت                     | استفاده                                                                             |
| -------------------------- | ------------------------------------------------------------------------------- |
| **HAR** (HTTP Archive 1.2) | سازگار با Chrome DevTools, Charles, Fiddler — برای تحلیل آفلاین import کنید |
| **JSONL**                  | یک `InterceptedRequest` به ازای خط — سازگار با فرمت `llm-interceptor`    |

خروجی از طریق `GET /api/tools/traffic-inspector/sessions/{id}/export.har` یا دکمه ⬇ در dropdown نشست‌ها.

---

## §۶ امنیت

بازرس ترافیک **تمام ترافیک HTTPS رهگیری‌شده** را نشان می‌دهد، از جمله هدرهای authorization و بدنه‌های درخواست. کنترل‌های زیر اعمال می‌شود:

| کنترل                       | جزئیات                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **LOCAL_ONLY**                | تمام مسیرها و endpoint مربوط به WebSocket فقط loopback هستند (در `routeGuard.ts` قبل از auth اعمال می‌شود)                                    |
| **ماسک کردن secret**            | `maskSecrets()` قبل از `TrafficBuffer.push()` به تمام هدرها و بدنه‌ها اعمال می‌شود — به‌صورت پیش‌فرض فعال (`INSPECTOR_MASK_SECRETS=true`) |
| **سقف اندازه بدنه**             | بدنه‌های > `INSPECTOR_MAX_BODY_KB` (پیش‌فرض ۱۰۲۴ کیلوبایت) با اعلان `"(truncated for performance)"` بریده می‌شوند                         |
| **ماسک هدر حساس**  | `authorization`, `cookie`, `api-key`, `x-api-key`, `proxy-authorization` → `Bearer ***` در تب Headers؛ toggle "Show secrets"        |
| **CSP**                       | Content Security Policy سختگیرانه روی صفحات بازرس ترافیک برای جلوگیری از XSS از طریق بدنه‌های پاسخ تزریق‌شده                                |
| **بدون ماندگاری به‌صورت پیش‌فرض** | `TrafficBuffer` درون‌حافظه‌ای است و با راه‌اندازی مجدد سرور از بین می‌رود. نشست‌ها فقط زمانی ماندگار می‌شوند که به‌صورت صریح ضبط شوند                    |

### قوانین سخت اعمال‌شده

| قانون                              | کاربرد                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| **#۱۲** `sanitizeErrorMessage`    | تمام پاسخ‌های خطای HTTP از مسیرهای بازرس ترافیک پاک‌سازی می‌شوند                  |
| **#۱۵ + #۱۷** `isLocalOnlyPath()` | `/api/tools/traffic-inspector/` فقط LOCAL_ONLY + SPAWN_CAPABLE است (دستورات پروکسی سیستم) |

### محدودیت‌های شناخته‌شده

- **حالت پروکسی سراسسی** بر تمام اپلیکیشن‌ها روی ماشین تأثیر می‌گذارد، از جمله کلاینت‌های VPN و SSO. همیشه از تایمر auto-disable استفاده کنید. روی ماشین‌های اشتراکی استفاده نکنید.
- **HTTPS تونل CONNECT**: حالت ۳ (HTTP_PROXY) فقط فراداده تونل را برای مقاصد HTTPS capture می‌کند مگر اینکه رهگیری TLS فعال باشد. این by design است — capture شفاف بدون اعتماد به گواهی AgentBridge، تأیید TLS را برای آن اپ‌ها شکست می‌دهد.
- **رشته‌های hardcoded در برخی کامپوننت‌ها**: برخی کامپوننت‌های رابط کاربری (F7/F8) تعداد کمی رشته hardcoded دارند که هنوز با کلیدهای i18n پوشش داده نشده‌اند. این‌ها به‌عنوان یک محدودیت شناخته‌شده در گزارش شکاف i18n مستند شده‌اند؛ آن‌ها در یک پاس پیگیری مهاجرت خواهند شد. رشته‌های متأثر برچسب‌های تزئینی رابط کاربری هستند که برای استفاده عملیاتی نیازی به ترجمه ندارند.

---

## §۷ عیب‌یابی

### قطع اتصال WebSocket

اگر live tail "Disconnected" نشان می‌دهد:

۱. بررسی کنید سرور هنوز در حال اجرا است: `GET /api/tools/traffic-inspector/capture-modes`
۲. صفحه را reload کنید — WebSocket دوباره متصل می‌شود و یک snapshot تازه دریافت می‌کند
۳. اگر سرور راه‌اندازی مجدد شده بود، بافر درون‌حافظه‌ای پاک شده است — ورودی‌های قدیمی از بین رفته‌اند مگر اینکه یک نشست ضبط شده باشد

### تعارض پورت ۸۰۸۰

اگر حالت HTTP_PROXY شروع نمی‌شود:

```bash
lsof -i :8080    # یافتن فرآیند
```

پورت را تغییر دهید:

```bash
# .env
INSPECTOR_HTTP_PROXY_PORT=8888
```

### عدم بازگشت پروکسی سیستم

اگر OmniRoute هنگامی که حالت پروکسی سراسسی فعال است کرش کند:

**macOS:**

```bash
networksetup -setwebproxystate Wi-Fi off
networksetup -setsecurewebproxystate Wi-Fi off
```

**لینوکس (GNOME):**

```bash
gsettings set org.gnome.system.proxy mode 'none'
```

**ویندوز:**

```cmd
netsh winhttp reset proxy
```

داشبورد همچنین در load بعدی "Revert system proxy" را پیشنهاد می‌دهد اگر وضعیت DB نشان دهد پروکسی فعال بوده است.

### پر شدن بافر

وقتی بافر به `INSPECTOR_BUFFER_SIZE` (پیش‌فرض ۱۰۰۰) می‌رسد، ورودی‌های جدید قدیمی‌ترین‌ها را خارج می‌کنند. اگر درخواست‌های مهم از دست می‌روند:

- `INSPECTOR_BUFFER_SIZE` را افزایش دهید (مثلاً ۵۰۰۰) — حافظه را به retention مبادله می‌کند
- یک نشست ضبط کنید تا پنجره مربوطه را در DB ماندگار کنید

---

## §۸ مرجع API

تمام مسیرها `LOCAL_ONLY` (فقط loopback) و `SPAWN_CAPABLE` (دستورات پروکسی سیستم) هستند. به `src/server/authz/routeGuard.ts` مراجعه کنید.

مسیر پایه: `/api/tools/traffic-inspector/`

### مدیریت درخواست

| روش | مسیر                        | توضیحات                                                                        |
| ------ | --------------------------- | ---------------------------------------------------------------------------------- |
| GET    | `/requests`                 | فهرست درخواست‌ها (قابل فیلتر: `?profile=llm&host=&agent=&status=&source=&sessionId=`) |
| GET    | `/requests/{id}`            | جزئیات یک درخواست واحد                                                             |
| DELETE | `/requests`                 | پاک‌کردن بافر درون‌حافظه‌ای                                                         |
| POST   | `/requests/{id}/replay`     | اجرای مجدد همان درخواست از طریق روتر OmniRoute                               |
| PUT    | `/requests/{id}/annotation` | ذخیره یا به‌روزرسانی یک یادداشت روی یک درخواست                                                 |

### WebSocket

| روش | مسیر  | توضیحات                                                                            |
| ------ | ----- | -------------------------------------------------------------------------------------- |
| GET    | `/ws` | جریان زنده WebSocket. هنگام اتصال `snapshot` ارسال می‌کند، سپس رویدادهای `new`/`update`/`clear` |

### خروجی

| روش | مسیر          | توضیحات                             |
| ------ | ------------- | --------------------------------------- |
| GET    | `/export.har` | خروجی گرفتن فهرست فیلتر‌شده فعلی به‌عنوان HAR 1.2 |

### میزبان‌های سفارشی

| روش | مسیر            | توضیحات                        |
| ------ | --------------- | ---------------------------------- |
| GET    | `/hosts`        | فهرست میزبان‌های سفارشی                  |
| POST   | `/hosts`        | افزودن میزبان (به‌صورت خودکار `/etc/hosts` را ویرایش می‌کند) |
| DELETE | `/hosts/{host}` | حذف میزبان                        |
| PATCH  | `/hosts/{host}` | toggle `enabled`                   |

### حالت‌های capture

| روش | مسیر                           | توضیحات                                                                                            |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| GET    | `/capture-modes`               | وضعیت حالت‌های AgentBridge / custom-hosts / HTTP_PROXY / system-proxy + toggle مربوط به `tls-intercept` |
| POST   | `/capture-modes/http-proxy`    | شروع/توقف شنونده HTTP_PROXY (`{action: "start"\|"stop"}`)                                           |
| POST   | `/capture-modes/system-proxy`  | اعمال/بازگشت پروکسی سراسسی (`{action: "apply"\|"revert"}`)                                         |
| POST   | `/capture-modes/tls-intercept` | toggle رمزگشایی بدنه HTTPS در حالت پروکسی (`{enabled: boolean}`)                                      |

> **رمزگشایی TPROXY** (حالت capture ۵) توسط یک مسیر **مجزا** زیر
> پیشوند AgentBridge هدایت می‌شود — `GET / POST / DELETE /api/tools/agent-bridge/tproxy` — نه
> زیر `/api/tools/traffic-inspector/`. به
> [`docs/security/MITM-TPROXY-DECRYPT.md`](../security/MITM-TPROXY-DECRYPT.md) مراجعه کنید.

### نشست‌ها

| روش | مسیر                        | توضیحات                                                  |
| ------ | --------------------------- | ------------------------------------------------------------ |
| POST   | `/sessions`                 | شروع ضبط (`{name?: string}`)                          |
| PATCH  | `/sessions/{id}`            | توقف یا تغییر نام (`{action: "stop"\|"rename", name?: string}`) |
| GET    | `/sessions`                 | فهرست تمام نشست‌های ذخیره‌شده                                      |
| GET    | `/sessions/{id}`            | snapshot نشست (تمام درخواست‌ها)                              |
| DELETE | `/sessions/{id}`            | حذف نشست                                               |
| GET    | `/sessions/{id}/export.har` | خروجی گرفتن نشست به‌عنوان HAR 1.2                                    |

### ingest داخلی (fallback مربوط به D4)

| روش | مسیر               | توضیحات                                                                                                       |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------------- |
| POST   | `/internal/ingest` | درخواست رهگیری‌شده را از مسیر passthrough مربوط به `server.cjs` می‌پذیرد؛ نیازمند هدر `INSPECTOR_INTERNAL_INGEST_TOKEN` |

schemaهای کامل OpenAPI: `docs/openapi.yaml` → تگ `Traffic Inspector`.
