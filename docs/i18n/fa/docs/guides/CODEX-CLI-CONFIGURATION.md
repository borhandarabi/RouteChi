---
title: "Codex CLI — پیکربندی با OmniRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Codex CLI — پیکربندی با OmniRoute

راهنمای کامل برای استفاده از Codex CLI که به OmniRoute به‌عنوان یک backend سازگار با OpenAI اشاره می‌کند.

---

## آماده برای جای‌گذاری: config.toml

`<YOUR_HOST>` و `<YOUR_KEY>` را با مقادیر خود جایگزین کنید:

```toml
# ~/.codex/config.toml
model                          = "cx/gpt-5.5"
model_provider                 = "omniroute"
model_reasoning_effort         = "xhigh"
model_context_window           = 400000
model_auto_compact_token_limit = 350000
tool_output_token_limit        = 32768    # سقف ذخیره‌سازی تاریخچه به ازای هر فراخوانی ابزار

[model_providers.omniroute]
name                 = "OmniRoute"
base_url             = "http://<YOUR_HOST>:20128/v1"
env_key              = "OMNIROUTE_API_KEY"
requires_openai_auth = false
wire_api             = "responses"
```

```bash
# ~/.bashrc یا ~/.zshrc — مقدار واقعی کلید، هرگز در config.toml قرار نگیرد
export OMNIROUTE_API_KEY="<YOUR_KEY>"
```

> **گزینه‌های رایج میزبان**
>
> | دسترسی        | URL                           |
> | ------------- | ----------------------------- |
> | شبکه محلی     | `http://192.168.0.1:20128/v1` |
> | Tailscale     | `http://100.x.x.x:20128/v1`   |
> | Loopback      | `http://localhost:20128/v1`   |

---

## `wire_api = "responses"` — چرا برای همهٔ مدل‌ها کار می‌کند

Codex CLI در فوریهٔ ۲۰۲۶ `wire_api = "chat"` (Chat Completions) را منسوخ کرد و اکنون `wire_api = "responses"` (OpenAI Responses API) را **الزامی** می‌کند. تنظیم `wire_api = "chat"` از نسخهٔ v0.138 باعث خرابی فوری هنگام راه‌اندازی می‌شود.

DeepSeek، GLM، Kimi و سایرین تنها یک نقطهٔ پایانی Chat Completions را ارائه می‌دهند — نه Responses API. اگر Codex را مستقیماً به آن‌ها اشاره می‌کردید، شکست می‌خورد.

**OmniRoute این مشکل را به‌صورت شفاف حل می‌کند:**

```
Codex CLI
  → wire_api = "responses"
  → POST /v1/responses (OmniRoute)
    → مبدل Responses ↔ Chat Completions در OmniRoute
    → POST /chat/completions (DeepSeek / Mistral / GLM / Kimi / هر ارائه‌دهنده)
```

هنگام استفاده از OmniRoute هرگز به یک پروکسی ترجمهٔ جداگانه نیاز ندارید. **همهٔ مدل‌ها از `wire_api = "responses"` استفاده می‌کنند** — OmniRoute بقیه را مدیریت می‌کند.

> **`wire_api` پیش‌فرض است** — این فیلد به `"responses"` پیش‌فرض است و می‌تواند کاملاً از `config.toml` حذف شود. تنها هنگامی که قصد مستندسازی را دارید آن را به‌صورت صریح تنظیم کنید.

---

## پنجرهٔ زمینه و فشرده‌سازی

### فیلدهای پیکربندی توکن

| فیلد                                | توضیح                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model_context_window`              | بودجهٔ کل توکن برای مدل فعال. روی حد advertised مدل تنظیم شود.                                                                                                                    |
| `model_auto_compact_token_limit`    | آستانه‌ای که فشرده‌سازی خودکار تاریخچه را فعال می‌کند. **حداکثر: ۹۰٪ `model_context_window`** — مقادیر بالاتر از ۹۰٪ بی‌صدا نادیده گرفته می‌شوند.                                    |
| `tool_output_token_limit`           | سقف توکن‌های ذخیره‌شده به ازای هر خروجی فراخوانی ابزار در تاریخچه. از پر شدن پنجره توسط یک پاسخ ابزار بزرگ جلوگیری می‌کند. **این مقدار خروجی حداکثر نیست** — این یک سقف ذخیره‌سازی تاریخچه است. |
| `compact_prompt`                    | جای‌گذاری inline برای system prompt استفاده‌شده هنگام فشرده‌سازی (v0.138+).                                                                                                       |

> **نکته‌ای دربارهٔ `model_max_output_tokens`**: این فیلد **بخشی از schema پیکربندی Codex CLI نیست** (در کدمنبع Rust Codex غایب است). در صورت تنظیم بی‌صدا نادیده گرفته می‌شود. به آن تکیه نکنید — از `tool_output_token_limit` برای کنترل میزان خروجی ابزار ذخیره‌شده در تاریخچه استفاده کنید.

### پنجره‌های زمینه به ازای مدل

| مدل                                  | شناسهٔ OmniRoute                      | پنجرهٔ زمینه           | `auto_compact` | `tool_output_limit` |
| ------------------------------------ | ------------------------------------ | ---------------------- | -------------- | ------------------- |
| GPT-5.5                              | `cx/gpt-5.5`                         | 400k قابل‌اعتماد (حداکثر 1M) | 350,000        | 32,768              |
| Kimi K2.7 (thinking)                 | `kmc/kimi-k2.7`                      | 131,072                | 112,000        | 32,768              |
| Kimi K2.6                            | `kmc/kimi-k2.6`                      | 131,072                | 112,000        | 32,768              |
| GLM-5.2 / 5.2-max (thinking)         | `glm/glm-5.2`                        | 131,072                | 112,000        | 32,768              |
| MiMo V2.5 Pro (thinking)             | `opencode-go/mimo-v2.5-pro`          | 131,072                | 112,000        | 32,768              |
| Qwen 3.7 Plus (thinking)             | `opencode-go/qwen3.7-plus`           | 32,768                 | 28,000         | 16,384              |
| DeepSeek V4 Pro (OllamaCloud)        | `ollamacloud/deepseek-v4-pro`        | 131,072                | 112,000        | 32,768              |
| DeepSeek V4 Pro                      | `ds/deepseek-v4-pro`                 | 1,000,000              | 900,000        | 65,536              |
| MiMo V2.5                            | `opencode-go/mimo-v2.5`              | 131,072                | 112,000        | 32,768              |
| Gemma 4 31B (OllamaCloud)            | `ollamacloud/gemma4:31b`             | 32,768                 | 28,000         | 16,384              |
| Nemotron 3 Super (OllamaCloud)       | `ollamacloud/nemotron-3-super`       | 32,768                 | 28,000         | 16,384              |
| GPT-OSS 20B (OllamaCloud)            | `ollamacloud/gpt-oss:20b`            | 32,768                 | 28,000         | 16,384              |
| DeepSeek V4 Flash (OllamaCloud)      | `ollamacloud/deepseek-v4-flash`      | 65,536                 | 56,000         | 16,384              |
| Gemini 3 Flash Preview (OllamaCloud) | `ollamacloud/gemini-3-flash-preview` | 1,000,000              | 850,000        | 32,768              |
| GLM-5 Turbo                          | `glm/glm-5-turbo`                    | 131,072                | 112,000        | 16,384              |
| GLM-4.7 Flash                        | `glm/glm-4.7-flash`                  | 131,072                | 112,000        | 16,384              |
| Mistral Large Latest                 | `mistral/mistral-large-latest`       | 262,144                | 220,000        | 16,384              |

> **فرمول فشرده‌سازی:** `effective_window = model_context_window - min(tool_output_token_limit, 20000)`. مقادیر بالاتر از ۲۰k triggers فشرده‌سازی را تغییر نمی‌دهند.

> **قاعدهٔ تجربی:** `model_auto_compact_token_limit` را روی ۸۵–۸۸٪ `model_context_window` تنظیم کنید. هرگز از ۹۰٪ فراتر نروید — بی‌صدا نادیده گرفته می‌شود.

---

## پیشوند مدل: `cx/`

همهٔ مدل‌های Codex در OmniRoute از پیشوند `cx/` استفاده می‌کنند:

| نام Codex CLI            | مدل OmniRoute       |
| ----------------------- | ------------------ |
| `cx/gpt-5.5`            | GPT-5.5 استاندارد  |
| `cx/gpt-5.4`            | GPT-5.4 استاندارد  |
| `cx/gpt-5.4-mini`       | GPT-5.4 mini       |
| `cx/gpt-5.1-codex-mini` | GPT-5.1 Codex mini |

سایر ارائه‌دهندگان از پیشوند خودشان استفاده می‌کنند (`kmc/`، `glm/`، `ds/`، `ollamacloud/`، `opencode-go/`، `mistral/`) — پیشوند با نام مستعار ارائه‌دهندهٔ OmniRoute مطابقت دارد.

---

## میزان استدلال (Reasoning Effort)

کنترل می‌کند مدل پیش از پاسخ چقدر «فکر» می‌کند.

| مقدار    | مناسب برای                                     |
| -------- | --------------------------------------------- |
| `none`   | بدون استدلال — پاسخ مستقیم                    |
| `low`    | وظایف پیش‌پاافتاده (تغییر نام، قالب‌بندی)     |
| `medium` | **پیش‌فرض سرور** هنگامی که مشخص نشده           |
| `high`   | وظایف متوسط (بازنویسی، رفع اشکال)             |
| `xhigh`  | معماری، تحلیل عمیق، مسائل پیچیده              |

```bash
# جای‌گذاری به ازای فراخوانی
codex -c model_reasoning_effort=low "rename variable x to count"
codex -c model_reasoning_effort=xhigh "design the auth module"
```

---

## پروفایل‌ها — پیکربندی‌های نام‌گذاری‌شده به ازای مدل/جریان‌کار

پروفایل‌ها به شما اجازه می‌دهند مدل + پنجرهٔ زمینه را با یک پرچم ساده تعویض کنید. هر پروفایل یک فایل مسطح
`~/.codex/<name>.config.toml` است که روی `config.toml` پایه overlay می‌شود.

> **قاعدهٔ نام‌گذاری (Codex CLI v0.137+):** فایل باید `~/.codex/<name>.config.toml` باشد — **بدون پیشوند `profile-`**.
> CLI مقدار `-p kimi-k27` را به `~/.codex/kimi-k27.config.toml` تفکیک می‌کند. اگر فایل یافت نشد، پیش‌فرض بی‌صدا اعمال می‌شود.

```bash
codex --profile kimi-k27 "analyze 10k lines of this codebase"
codex -p glm52 "architecture review"
codex --profile deepseek-flash "rename variable"   # سریع، ارزان
```

### پروفایل‌های استدلال (همان مدل، استدلال متفاوت)

```bash
codex -p low      # cx/gpt-5.5, effort=low
codex -p medium   # cx/gpt-5.5, effort=medium
codex -p high     # cx/gpt-5.5, effort=high
codex -p xhigh    # cx/gpt-5.5, effort=xhigh (پیش‌فرض)
codex -p chat     # cx/gpt-5.5, بدون effort (پیش‌فرض سرور)
```

### مدل‌های تفکر (alto pensamento) — xhigh + خلاصهٔ مفصل

| پروفایل    | مدل                         | زمینه  | مناسب برای                     |
| ---------- | --------------------------- | ------ | ------------------------------ |
| `kimi-k27` | `kmc/kimi-k2.7`             | 128k   | بهترین کیفیت تفکر (Kimi)       |
| `glm52`    | `glm/glm-5.2`               | 128k   | تفکر GLM                       |
| `glm52max` | `glm/glm-5.2-max`           | 128k   | حداکثر تفکر GLM               |
| `mimo-pro` | `opencode-go/mimo-v2.5-pro` | 128k   | تفکر MiMo                      |
| `qwen37plus` | `opencode-go/qwen3.7-plus`  | 32k    | تفکر Qwen                      |

### مدل‌های خوب (bons) — استدلال high

| پروفایل        | مدل                         | زمینه  | مناسب برای                          |
| -------------- | --------------------------- | ------ | ----------------------------------- |
| `kimi-k26`     | `kmc/kimi-k2.6`             | 128k   | کاربرد عمومی (Kimi)                 |
| `deepseek-pro` | `ollamacloud/deepseek-v4-pro` | 128k | DeepSeek Pro از طریق OllamaCloud    |
| `deepseek`     | `ds/deepseek-v4-pro`        | 1M     | DeepSeek Pro مستقیم، زمینهٔ بزرگ    |
| `mimo`         | `opencode-go/mimo-v2.5`     | 128k   | MiMo عمومی                          |

### مدل‌های ساده (simples) — بدون استدلال

| پروفایل    | مدل                          | زمینه  | مناسب برای              |
| ---------- | ----------------------------- | ------ | ----------------------- |
| `gemma4`   | `ollamacloud/gemma4:31b`      | 32k    | مقرون‌به‌صرفه، توانمند  |
| `nemotron` | `ollamacloud/nemotron-3-super` | 32k   | NVIDIA Nemotron         |
| `gptoss`   | `ollamacloud/gpt-oss:20b`     | 32k    | GPT متن‌باز             |

### مدل‌های سریع — استدلال low

| پروفایل          | مدل                                | زمینه  | مناسب برای              |
| ---------------- | ---------------------------------- | ------ | ----------------------- |
| `deepseek-flash` | `ollamacloud/deepseek-v4-flash`    | 64k    | وظایف سریع              |
| `gemini-flash`   | `ollamacloud/gemini-3-flash-preview` | 1M   | بسیار سریع، زمینهٔ بزرگ |
| `glm5turbo`      | `glm/glm-5-turbo`                  | 128k   | GLM Turbo               |
| `glm47flash`     | `glm/glm-4.7-flash`                | 128k   | GLM Flash               |
| `mistral`        | `mistral/mistral-large-latest`     | 256k   | Mistral Large           |

### جدول تصمیم‌گیری سریع

| وظیفه                                  | پروفایل پیشنهادی                                 |
| -------------------------------------- | ------------------------------------------------ |
| تغییر نام، قالب‌بندی، boilerplate      | `--profile deepseek-flash` یا `-p low`           |
| توضیح، بازبندی سبک                    | `-p chat` یا `-p gemini-flash`                   |
| رفع اشکال، بازنویسی متوسط              | `-p medium` یا `-p kimi-k26`                     |
| ویژگی جدید، تست‌های پیچیده             | `-p high` یا `-p mimo`                           |
| معماری، تحلیل عمیق                     | `-p kimi-k27` یا `-p glm52` یا `-p xhigh`        |
| تحلیل کدبیس (نیاز به زمینهٔ 1M)        | `--profile deepseek` یا `--profile gemini-flash` |
| حداکثر کیفیت تفکر                      | `-p glm52max` یا `-p mimo-pro`                   |
| آگاهانه از نظر هزینه                   | `-p gemma4` یا `-p gptoss`                       |

---

## تولید خودکار پروفایل‌ها با `routechi setup-codex`

اگر OmniRoute را روی یک VPS اجرا می‌کنید، می‌توانید فایل‌های پروفایل را از کاتالوگ مدل زنده تولید کنید:

```bash
# از یک VPS (از OmniRoute محلی روی پورت 20128 استفاده می‌کند)
routechi setup-codex

# از هر ماشین — به VPS خود اشاره کنید
routechi setup-codex --remote http://100.x.x.x:20128 --api-key sk-xxx

# پیش‌نمایش بدون نوشتن فایل
routechi setup-codex --remote http://100.x.x.x:20128 --dry-run

# تنها پروفایل‌های GLM و Kimi تولید شود
routechi setup-codex --only glm,kimi

# نوشتن در یک مسیر سفارشی
routechi setup-codex --codex-home /path/to/.codex
```

این دستور `/v1/models` را واکشی می‌کند، از پروفایل‌های تنظیم‌شده برای مدل‌های شناخته‌شده استفاده می‌کند، برای سایر مدل‌های متنی سازگار به فرادادهٔ کاتالوگ بازمی‌گردد، و `~/.codex/<name>.config.toml` را به ازای هر کدام می‌نویسد. Idempotent است — اجرای مجدد بی‌خطر است.

OmniRoute همچنین می‌تواند پس از یک کشف/وارد کردن مدل موفق ارائه‌دهنده که کاتالوگ زنده را تغییر می‌دهد، این فایل‌های پروفایل را به‌صورت **خودکار هماهنگ** کند. این ویژگی **اختیاری و به‌صورت پیش‌فرض خاموش** است: از داشبورد **CLI Code** (بخش "CLI profile auto-sync" → Codex) فعالش کنید، یا `OMNIROUTE_AUTO_SYNC_CODEX_PROFILES=true` را تنظیم کنید (همچنین `CLI_ALLOW_CONFIG_WRITES` را که به‌صورت پیش‌فرض روشن است رعایت می‌کند). هنگام فعال‌بودن تنها فایل‌های پروفایل جداگانهٔ `~/.codex/*.config.toml` را می‌نویسد؛ هرگز `~/.codex/config.toml` فعال/پیش‌فرض، تنظیمات Codex-lb، احراز هویت یا انتخاب ارائه‌دهنده را تغییر نمی‌دهد.

---

## راه‌اندازی Codex با `routechi launch-codex`

پیش از راه‌اندازی Codex، یک health-check روی نمونهٔ OmniRoute شما انجام می‌دهد:

```bash
# راه‌اندازی در برابر OmniRoute محلی (پورت پیش‌فرض 20128)
routechi launch-codex

# راه‌اندازی با پروفایل مشخص
routechi launch-codex --profile kimi-k27

# راه‌اندازی در برابر یک VPS دور
routechi launch-codex --remote http://100.x.x.x:20128/v1 --api-key sk-xxx

# ارسال آرگومان‌های اضافی به codex
routechi launch-codex --profile glm52 -- --yolo "fix this bug"
```

---

## ویژگی‌های جدید Codex CLI (v0.138–v0.141)

| نسخه | ویژگی                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v0.138  | تحویل به برنامهٔ دسکتاپ (`/app`)، توکن‌های دسترسی شخصی v2، `--profile` به‌عنوان انتخاب‌گر انحصاری پروفایل (جداول `[profiles]` درون‌فایلی legacy در راه‌اندازی خراب می‌شوند)         |
| v0.139  | `web_search = "live"` — جست‌وجوی وب بومی از حالت کد؛ `oneOf`/`allOf` در schemaهای ابزار MCP؛ `codex doctor` برای تشخیص محیط                                        |
| v0.140  | نمایش توکن `/usage` درون نشست؛ `/import` از نشست‌های Claude Code؛ زیردستور `codex delete <SESSION_ID>`؛ احراز هویت Amazon Bedrock از طریق شیء `aws` در پیکربندی ارائه‌دهنده |
| v0.141  | رلهٔ Noise رمزنگاری‌شدهٔ E2E برای اجراکنندگان دور؛ رفع SQLite WAL؛ پشتیبانی TLS از P-521                                                                                    |

### فیلدهای جدید `config.toml` (پس از v0.137)

```toml
# جست‌وجوی وب بومی (v0.139)
web_search = "live"   # "disabled" | "cached" | "live"

# system prompt جداگانه برای توسعه‌دهنده (v0.138)
developer_instructions = "Always prefer functional style."

# prompt فشرده‌سازی سفارشی
compact_prompt = "Summarise the above as bullet points."

# مسیریابی /review به یک مدل ارزان‌تر
review_model = "glm/glm-5-turbo"

# سطح خدمت OpenAI
service_tier = "fast"   # "fast" | "flex"
```

### فیلدهای جدید `[model_providers.<id>]`

```toml
[model_providers.omniroute]
base_url             = "http://100.x.x.x:20128/v1"
env_key              = "OMNIROUTE_API_KEY"
requires_openai_auth = false

# هدرهای اضافی ثابت روی هر درخواست
[model_providers.omniroute.http_headers]
"X-Custom-Header" = "value"

# هدرهایی که از متغیرهای محیطی خوانده می‌شوند
[model_providers.omniroute.env_http_headers]
"X-Trace-Id" = "TRACE_ID"

# پارامترهای query اضافی URL (کاربردی برای api-version آژور)
[model_providers.omniroute.query_params]
"api-version" = "2024-12-01-preview"
```

### احراز هویت Amazon Bedrock (v0.140)

```toml
[model_providers.bedrock]
base_url = "https://bedrock-runtime.us-east-1.amazonaws.com"

[model_providers.bedrock.aws]
profile = "default"   # profile در ~/.aws/credentials
region  = "us-east-1"
```

---

## چند سرور

```toml
[model_providers.omniroute-main]
base_url = "http://192.168.0.1:20128/v1"
env_key  = "OMNIROUTE_API_KEY"

[model_providers.omniroute-tailscale]
base_url = "http://100.x.x.x:20128/v1"
env_key  = "OMNIROUTE_API_KEY"
```

---

## Claude Code — پیکربندی معادل

| Codex CLI (`config.toml`)          | Claude Code (متغیر محیطی)             | اثر                  |
| --------------------------------- | ------------------------------------- | ----------------------- |
| `tool_output_token_limit = 32768` | _(مستقیماً در دسترس نیست)_              | سقف تاریخچه به ازای ابزار    |
| `model_context_window = 400000`   | _(توسط مدل تعیین می‌شود)_           | پنجرهٔ زمینه          |
| —                                 | `CLAUDE_CODE_MAX_OUTPUT_TOKENS=65536` | حداکثر توکن به ازای پاسخ |

```bash
# ~/.bashrc — سقف توکن Claude Code
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=65536
```

---

## مرجع سریع — پرچم‌های CLI

| پرچم                  | کوتاه | اثر                                       |
| --------------------- | ----- | -------------------------------------------- |
| `--model <id>`        | `-m`  | `model` را برای این فراخوانی بازنویسی می‌کند        |
| `--profile <name>`    | `-p`  | `~/.codex/<name>.config.toml` را بارگذاری می‌کند          |
| `--config key=value`  | `-c`  | هر فیلد config.toml را بازنویسی می‌کند (قابل تکرار) |
| `--enable <feature>`  | —     | یک پرچم ویژگی را به‌اجبار فعال می‌کند                 |
| `--disable <feature>` | —     | یک پرچم ویژگی را به‌اجبار غیرفعال می‌کند                |
| `--search`            | —     | جست‌وجوی زندهٔ وب را برای این فراخوانی فعال می‌کند   |

جدید در v0.140:

```bash
codex delete <SESSION_ID>          # حذف یک نشست
codex delete <SESSION_ID> --force  # ردکردن تأیید
codex debug models --bundled       # فهرست کاتالوگ مدل bundled به‌صورت JSON
```

درون یک نشست تعاملی:

| دستور    | اثر                                      |
| --------- | ------------------------------------------- |
| `/model`  | انتخابگر مدل را باز می‌کند                      |
| `/usage`  | استفادهٔ توکن این نشست را نمایش می‌دهد (v0.140) |
| `/app`    | تحویل به برنامهٔ دسکتاپ (v0.138)       |
| `/import` | وارد کردن یک نشست Claude Code (v0.140)       |
| `/help`   | فهرست همهٔ slash commandها                    |

---

## رفع اشکال

**`Error: wire_api = "chat" is no longer supported`**
`wire_api = "chat"` را از پیکربندی خود حذف کنید. `wire_api = "responses"` را تنظیم یا فیلد را حذف کنید (از v0.138 به `"responses"` پیش‌فرض است).

**`Error: model not found`**
راستی‌آزمایی کنید که مدل با پیشوند درست در OmniRoute موجود است. از `routechi models list` استفاده کنید یا `/dashboard/providers/<provider>` را باز کنید.

**`Authentication error`**
تأیید کنید `OMNIROUTE_API_KEY` export شده: `echo $OMNIROUTE_API_KEY`.

**`Connection refused`**
راستی‌آزمایی کنید OmniRoute در حال اجراست و `base_url` میزبان/پورت برای شبکهٔ شما (محلی در برابر Tailscale در برابر VPS) درست است.

**خرابی نشست نزدیک حد زمینه**
`model_context_window` و `model_auto_compact_token_limit` را به‌صورت صریح تنظیم کنید. به جدول پنجرهٔ زمینه در بالا مراجعه کنید.

**فشرده‌سازی دیر آتش می‌زند**
`model_auto_compact_token_limit` را به ۸۰–۸۵٪ پنجره کاهش دهید. هرگز بالای ۹۰٪ تنظیم نکنید.

**پروفایل بارگذاری نمی‌شود (`-p <name>` بی‌صدا نادیده گرفته می‌شود)**
تأیید کنید فایل در `~/.codex/<name>.config.toml` (بدون پیشوند `profile-`) وجود دارد. `ls ~/.codex/*.config.toml` را اجرا کنید.
