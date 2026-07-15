---
title: "چارچوب مهارت‌ها"
version: 3.8.40
lastUpdated: 2026-06-28
---

# چارچوب مهارت‌ها

> **منبع حقیقت:** `src/lib/skills/` و `src/app/api/skills/`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40

OmniRoute یک چارچوب مهارت‌های قابل‌توسعه افشا می‌کند که به مدل‌های زبانی (و اپراتورها) اجازه می‌دهد قابلیت‌های قابل‌استفاده‌ی مجدد بسازند — از خواندن فایل‌سیستم و درخواست‌های HTTP تا اجرای کد سندباکس‌شده و مهارت‌های انتخاب‌شده‌ی مارکت‌پلیس.

یک مهارت یک واحد کار نسخه‌گذاری‌شده و تعریف‌شده‌توسط‌شما است. OmniRoute می‌تواند مهارت‌ها را به‌عنوان تعاریف ابزار به درخواست‌های خروجی تزریق کند، فراخوانی‌های ابزار برگشتی از مدل را قطع کند، هندلر منطبق را اجرا کند و نتیجه را به مدل بازگرداند تا مکالمه ادامه یابد. مدل هرگز پیاده‌سازی را نمی‌بیند — تنها رابط ابزار را.

---

## مهارت‌های Agent در برابر مهارت‌های Omni

OmniRoute دو سامانه‌ی مهارتی متمایز اما مکمل دارد:

| Dimension       | **Omni Skills** (this doc)                                    | **Agent Skills**                                                                            |
| :-------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------ |
| Purpose         | LLM tool injection + sandboxed execution                      | SKILL.md catalog for external agents to discover and consume                                |
| Source of truth | `src/lib/skills/` + marketplace                               | `src/lib/agentSkills/` + `skills/` directory                                                |
| Runtime mode    | Injected into outbound requests, executed on tool-call events | Static markdown catalog + REST/MCP/A2A discovery endpoints                                  |
| Who uses it     | OmniRoute itself (combo routing, inbound LLM calls)           | External agents, MCP clients, A2A orchestrators                                             |
| Count           | Variable (marketplace-driven)                                 | 42 canonical entries (22 API + 20 CLI)                                                      |
| Format          | `SkillDefinition` with tool schema + handler                  | `SKILL.md` frontmatter + markdown body                                                      |
| Discovery       | `/api/skills/*` REST + `omniroute_skills_*` MCP tools         | `/api/agent-skills/*` REST + `omniroute_agent_skills_*` MCP tools + A2A `list-capabilities` |

**Omni Skills** موتور اجرایی هستند — آن‌ها تعریف می‌کنند OmniRoute چه‌کاره است وقتی یک LLM ابزاری را فراخوانی می‌کند.

**Agent Skills** فهرست مستندات هستند — آن‌ها به عامل‌های خارجی توضیح می‌دهند چگونه از REST API و CLI ی OmniRoute استفاده کنند، با فایل‌های SKILL.md ساختاریافته که می‌توانند مستقیماً در promptهای عامل تزریق شوند.

برای فهرست Agent Skills، مولد، ابزارهای MCP و مهارت A2A، به [docs/frameworks/AGENT-SKILLS.md](./AGENT-SKILLS.md) مراجعه کنید.

---

## مفاهیم

### منابع مهارت

سه منبع مهارت در یک رجیستری مشترک همزیستی می‌کنند:

1. **مهارت‌های داخلی** (`src/lib/skills/builtins.ts`) — همراه OmniRoute توزیع می‌شوند. موارد رایج را پوشش می‌دهند:
   - `file_read`، `file_write` — فضای کار سندباکس به‌ازای‌کلید‌API تحت `<DATA_DIR>/skills/workspaces/<hashed-key>/`
   - `http_request` — HTTP خروجی از طریق `safeOutboundFetch` با `guard: "public-only"`
   - `web_search` — پروایدر جستجوی قابل‌تعویض با کش (`executeWebSearch`)
   - `eval_code` — اجرای `node` یا `python` سندباکس‌شده‌در‌Docker
   - `execute_command` — دستور شل سندباکس‌شده‌در‌Docker
   - `browser` — داربست مبتنی بر Playwright، به‌صورت پیش‌فرض غیرفعال (`builtin/browser.ts`)
2. **SkillsMP** (مارکت‌پلیس OmniRoute) — از `https://skillsmp.com/api/v1/skills/search` دریافت می‌شود. نیازمند `skillsmpApiKey` در Settings است.
3. **SkillsSH** (`skills.sh` فهرست جامعه) — از `https://skills.sh/api/search` دریافت می‌شود. نیازی به احراز هویت نیست؛ محتوای SKILL.md از GitHub raw دریافت می‌شود.

یک «active provider» واحد کنترل می‌کند که داشبورد از کدام فهرست نصب می‌کند (`src/lib/skills/providerSettings.ts`). آن را تحت **Settings → Memory & Skills** تعویض کنید. پیش‌فرض: `skillsmp`.

### هویت مهارت

مهارت‌ها در رجیستری درون‌حافظه‌ای (`src/lib/skills/registry.ts`) با `name@version` کلیدگذاری می‌شوند. نسخه باید semver (`^\d+\.\d+\.\d+$`) باشد. `resolveVersion()` محدودیت‌های `^`، `~`، `>`، `>=`، `<`، `<=`، `==` و تطبیق دقیق را درک می‌کند.

### حالت مهارت

هر مهارت یک حالت زمان‌اجرا دارد که کنترل می‌کند کِی تزریق می‌شود:

| Mode   | Behavior                                                                                   |
| ------ | ------------------------------------------------------------------------------------------ |
| `on`   | Always injected as a tool definition                                                       |
| `off`  | Never injected, never executable                                                           |
| `auto` | Scored against the incoming request; injected only if score ≥ `AUTO_MIN_SCORE` (default 3) |

`auto` پیش‌فرض برای مهارت‌های نصب‌شده‌ی مارکت‌پلیس است. `enabled=true` و `mode="off"` با هم به‌معنای «ثبت‌شده اما غیرفعال» است — تغییر `enabled` از طریق ستون legacy همچنین `mode` را هم بالا می‌برد تا مسیرهای کد قدیمی سازنده بمانند (`src/app/api/skills/[id]/route.ts`).

### وضعیت (اجراها)

اجراهای مهارت در جدول `skill_executions` با وضعیت‌های زیر ردیابی می‌شوند (`src/lib/skills/types.ts`):

```ts
enum SkillStatus {
  PENDING = "pending",
  RUNNING = "running",
  SUCCESS = "success",
  ERROR = "error",
  TIMEOUT = "timeout",
}
```

### کش رجیستری

`SkillRegistry` یک singleton با کش ۶۰ ثانیه‌ای TTL است (`registry.ts:14`). `loadFromDatabase()` idempotent است و فراخوانی‌های همزمان را از طریق `pendingLoad` عدم‌تکرار می‌کند. هر نوشتار (`register`/`unregister`/`unregisterById`) کش را نامعتبر می‌سازد. نسخه‌ها را از طریق `getSkillVersions(name)` و `resolveVersion(name, constraint)` جستجو کنید.

### تزریق آگاه‌از‌پروایدر

`injectSkills()` در `src/lib/skills/injection.ts` نقطه‌ی ورودی است که مهارت‌های ثبت‌شده را به تعاریف ابزار مختص‌پروایدر تبدیل می‌کند:

- **OpenAI** — `{ type: "function", function: { name, description, parameters } }`
- **Anthropic** — `{ name, description, input_schema }`
- **Google (Gemini)** — `{ name, description, parameters }`

نام ابزار به‌صورت `name@version` رمزگذاری می‌شود تا هندلر بتواند هنگام فراخوانی توسط مدل نسخه‌ی درست را انتخاب کند.

### امتیازدهی AUTO

هنگامی که `mode="auto"` است، هر مهارت کاندید در برابر زمینه‌ی درخواست امتیازدهی می‌شود (`scoreAutoSkill()` در `injection.ts`):

| Signal                                         | Points       |
| ---------------------------------------------- | ------------ |
| Skill name appears verbatim in context         | +6           |
| Each name token matches a context token        | +2           |
| Each tag substring matches context             | +3           |
| Each description token matches context         | +1           |
| Background reason matches a name token         | +2 per token |
| Background reason matches a tag                | +2 per token |
| Provider hint in tags matches request provider | +2 / −2      |

بالاترین `AUTO_MAX_SKILLS = 5` مهارت با `score >= AUTO_MIN_SCORE = 3` تزریق می‌شوند. مساوی‌ها با `installCount` (نزولی)، سپس نام الفبایی شکسته می‌شوند (`injection.ts:225-235`).

### قطع فراخوانی ابزار

`handleToolCallExecution()` در `src/lib/skills/interception.ts` توسط هندلر چت پس از آنکه upstream یک پاسخ فراخوانی‌ابزار برمی‌گرداند فراخوانی می‌شود:

1. `extractToolCalls()` شکل‌های مختص‌پروایدر را می‌خواند (OpenAI `tool_calls` / Responses `function_call`، Anthropic `tool_use`، Gemini `functionCalls`).
2. نام‌مستعارهای ابزار داخلی (مثلاً `omniroute_web_search` → `web_search`) ابتدا تفکیک می‌شوند. هندلرهای داخلی inline اجرا می‌شوند.
3. هر چیز دیگر از طریق `skillExecutor.execute(name@version, args, { apiKeyId, sessionId })` مسیریابی می‌شود.
4. نتایج در پاسخ — `tool_results`، آیتم‌های `function_call_output`، یا بلوک‌های `tool_result` ی Anthropic — درج می‌شوند.

`customSkillExecutionEnabled` در زمینه‌ی اجرا می‌تواند به `false` تنظیم شود تا فقط قطع داخلی مجاز باشد (توسط مسیرهای درخواستی که به‌صورت صریح هندلرهای تعریف‌شده‌توسط‌کاربر را غیرفعال می‌کنند استفاده می‌شود).

---

## سندباکس Docker

مسیرهای کد غیرداخلی (`eval_code`، `execute_command`) درون Docker از طریق `SandboxRunner` (`src/lib/skills/sandbox.ts`) اجرا می‌شوند. هر کانتینر با این موارد راه‌اندازی می‌شود:

```
--rm --network none|bridge --cap-drop ALL
--security-opt no-new-privileges --pids-limit 100
--cpus <cpuLimit/1000> --memory <memoryLimit>m
--tmpfs /tmp:rw,noexec,nosuid,size=64m
--tmpfs /workspace:rw,noexec,nosuid,size=64m
--read-only (when readOnly=true)
```

پیش‌فرض‌ها (`SandboxRunner.DEFAULT_CONFIG`):

| Field            | Default         | Notes                                                |
| ---------------- | --------------- | ---------------------------------------------------- |
| `cpuLimit`       | 100 (= 0.1 CPU) | Divided by 1000 before passing to `--cpus`           |
| `memoryLimit`    | 256 MB          | Hard limit                                           |
| `timeout`        | 30000 ms        | Soft kill via `SIGTERM` + `docker kill`              |
| `networkEnabled` | `false`         | Becomes `--network none`                             |
| `readOnly`       | `true`          | Root FS read-only; `/tmp` and `/workspace` are tmpfs |

`SandboxRunner.kill(id)` و `killAll()` برای خاموش‌سازی افشا شده‌اند؛ کانتینرهای در حال اجرا در `runningContainers: Map<string, ChildProcess>` ردیابی می‌شوند.

### متغیرهای محیطی سندباکس

پیکربندی‌شده از طریق `process.env` در `src/lib/skills/builtins.ts`:

| Env Var                           | Default          | Purpose                                                            |
| --------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `SKILLS_MAX_FILE_BYTES`           | `1048576` (1 MB) | Cap for `file_read` and `file_write`                               |
| `SKILLS_MAX_HTTP_RESPONSE_BYTES`  | `256000`         | Cap for `http_request` response body                               |
| `SKILLS_MAX_SANDBOX_OUTPUT_CHARS` | `100000`         | Cap for stdout/stderr returned to the caller                       |
| `SKILLS_SANDBOX_TIMEOUT_MS`       | `10000`          | Default timeout for sandboxed commands; capped at 60 s             |
| `SKILLS_SANDBOX_NETWORK_ENABLED`  | `false`          | Master gate for egress. Set `1` or `true` to allow per-call opt-in |
| `SKILLS_ALLOWED_SANDBOX_IMAGES`   | (see below)      | Comma-separated allowlist of Docker images                         |

ایمیج‌های مجاز پیش‌فرض: `alpine:3.20`، `node:22-alpine`، `python:3.12-alpine`. هر افزودنی از طریق `SKILLS_ALLOWED_SANDBOX_IMAGES` با پیش‌فرض‌ها ادغام می‌شود؛ ایمیج‌های ناشناخته توسط `normalizeImage()` رد می‌شوند.

> نکته: هیچ متغیر محیطی جداگانه‌ی `SKILLS_EXECUTION_TIMEOUT_MS` وجود ندارد. timeout هندلر غیرسندباکس در `SkillExecutor` (`executor.ts:13`) به‌صورت hard-coded روی ۳۰ ثانیه تنظیم شده است اما می‌تواند در زمان اجرا از طریق `skillExecutor.setTimeout(ms)` بازنویسی شود.

### ایزوله‌سازی فضای کار

`file_read` و `file_write` هر مسیر را نسبت به یک فضای کار به‌ازای‌کلید‌API در `<DATA_DIR>/skills/workspaces/<sha256(apiKeyId).slice(0,24)>/` تفکیک می‌کنند. پیمایش مسیر (`..`) و بخش‌های ممنوعه (`.env`، `.git`، `.ssh`، `.omniroute`، `.codex`، `secrets`) پیش از هر I/O ی دیسک رد می‌شوند.

### سخت‌سازی HTTP

`http_request` (`builtins.ts:257`):

- فهرست مجاز متدها: `GET, HEAD, POST, PUT, PATCH, DELETE`
- هدرهای خروجی مسدودشده: `host, connection, content-length, cookie, set-cookie, authorization, proxy-authorization`
- تغییرمسیرها غیرفعال‌اند (`allowRedirect: false`)
- از طریق `safeOutboundFetch` با `guard: "public-only"` مسیریابی می‌شود (محدوده‌های private/loopback مسدودند)
- پاسخ در `SKILLS_MAX_HTTP_RESPONSE_BYTES` بریده می‌شود؛ کلاینت `truncated: true` را می‌بیند

---

## اجراکننده‌ی ترکیبی (preview)

`src/lib/skills/hybrid.ts` یک `HybridExecutor` تعریف می‌کند که بین اجرای `direct` (درون‌پروسه) و `sandbox` به‌ازای‌هر‌فراخوانی تصمیم می‌گیرد، با مسیر retry ی `autoUpgrade` روی خطاهای timeout/حافظه. پیاده‌سازی‌های `directExecutor` / `sandboxRunner` متصل‌شده stub هستند (`executeDirect`، `executeInSandbox` اشیاء placeholder برمی‌گردانند) — با این ماژول به‌عنوان یک قرارداد در حال ساخت رفتار کنید. اجرای واقعی همچنان از طریق `skillExecutor` + `SandboxRunner` انجام می‌شود.

---

## ذخیره‌سازی

شما در دو مهاجرت قرار دارد:

- `src/lib/db/migrations/016_create_skills.sql` — جداول پایه‌ی `skills` و `skill_executions`، با ایندکس‌های روی `(api_key_id, name)` و `(skill_id, status, created_at)`.
- `src/lib/db/migrations/027_skill_mode_and_metadata.sql` — اضافه‌کردن `mode`، `source_provider`، `tags` (JSON)، `install_count` به `skills`.

`skill_executions.status` در سطح پایگاه داده محدود شده است: `CHECK(status IN ('pending', 'running', 'success', 'error', 'timeout'))`.

---

## REST API

همه‌ی نقاط پایانی در `src/app/api/skills/` قرار دارند. نقاط پایانی مدیریتی (`/api/skills`، `/api/skills/[id]`، `/api/skills/install`) نیازمند **احراز هویت مدیریتی** از طریق `requireManagementAuth()` هستند. جریان‌های مارکت‌پلیس/نصب از `isAuthenticated()` سبک‌تر (نشست یا کلید API) استفاده می‌کنند.

| Endpoint                          | Method | Purpose                                                                  |
| --------------------------------- | ------ | ------------------------------------------------------------------------ | --- | ------------------------ | -------- | ------------------ |
| `/api/skills`                     | GET    | List registered skills. Supports `?q=`, `?mode=on                        | off | auto`, `?source=skillsmp | skillssh | local`, pagination |
| `/api/skills/[id]`                | PUT    | Update `enabled` or `mode`                                               |
| `/api/skills/[id]`                | DELETE | Unregister by id                                                         |
| `/api/skills/install`             | POST   | Install a custom skill (handler code + schema)                           |
| `/api/skills/marketplace`         | GET    | Search the SkillsMP catalog (returns popular defaults when `q` is empty) |
| `/api/skills/marketplace/install` | POST   | Install a SkillsMP skill (requires active provider = `skillsmp`)         |
| `/api/skills/skillssh`            | GET    | Search the skills.sh catalog (`?q=&limit=`, capped at 100)               |
| `/api/skills/skillssh/install`    | POST   | Install a skills.sh skill (requires active provider = `skillssh`)        |
| `/api/skills/executions`          | GET    | Paginated execution history (`?apiKeyId=`)                               |
| `/api/skills/executions`          | POST   | Execute a registered skill ad-hoc                                        |

نقطه‌ی پایانی `POST /api/skills/executions` هنگامی که `settings.skillsEnabled === false` است HTTP `503` با `{ error: "Skills execution is disabled..." }` برمی‌گرداند (`executor.ts:42-45`). اپراتورها می‌توانند کلید اصلی را از **Settings → AI** تغییر دهند.

### مثال: نصب یک مهارت سفارشی

```bash
curl -X POST http://localhost:20128/api/skills/install \
  -H "Authorization: Bearer $OMNIROUTE_MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "reverse-text",
    "version": "1.0.0",
    "description": "Reverses a string",
    "schema": {
      "input":  { "type": "object", "properties": { "text": { "type": "string" } }, "required": ["text"] },
      "output": { "type": "object", "properties": { "reversed": { "type": "string" } } }
    },
    "handlerCode": "echo-handler",
    "apiKeyId": "your-api-key-id"
  }'
```

رشته‌ی `handlerCode` یک **جستجوی نام هندلر** است — نه کد قابل‌اجرا. اجراکننده آن را از طریق `skillExecutor.registerHandler(name, fn)` (`executor.ts:25`) نگاشت می‌کند. نصب‌های مارکت‌پلیس متن SKILL.md را در این فیلد به‌عنوان مستندات ذخیره می‌کنند و اجرا را از طریق فراخوانی‌های ابزار تولیدشده‌توسط‌مدل مسیریابی می‌کنند. کد منبع عرضه‌شده‌توسط‌کاربر به‌صورت دل‌خواه eval نمی‌شود.

---

## ابزارهای MCP

چهار ابزار MCP سطح مهارت‌ها را پوشش می‌دهند (`open-sse/mcp-server/tools/skillTools.ts`). آن‌ها هنگام بوت شدن سرور MCP به‌صورت خودکار ثبت می‌شوند.

| Tool                          | Description                                                  |
| ----------------------------- | ------------------------------------------------------------ |
| `omniroute_skills_list`       | List skills, optional filters: `apiKeyId`, `name`, `enabled` |
| `omniroute_skills_enable`     | Enable/disable a skill by `skillId`                          |
| `omniroute_skills_execute`    | Execute a skill with an input payload                        |
| `omniroute_skills_executions` | Recent execution history (default 50, max 100)               |

برای راه‌اندازی انتقال و تخصیص scope به [MCP-SERVER.md](./MCP-SERVER.md) مراجعه کنید.

---

## یکپارچه‌سازی A2A

`src/lib/skills/a2a.ts` توصیف‌گر مهارت A2A ی `memory_aware_routing` و یک کمک‌کننده‌ی `registerA2ASkill(registry)` را صادر می‌کند. مهارت‌های A2A سفارشی در `src/lib/a2a/skills/` قرار دارند و از طریق `A2A_SKILL_HANDLERS` (`src/lib/a2a/taskExecution.ts`) اعزام می‌شوند. برای چرخه‌ی حیات کامل وظیفه به [A2A-SERVER.md](./A2A-SERVER.md) مراجعه کنید.

---

## افزودن یک مهارت داخلی جدید

1. **هندلر را تعریف کنید** در `src/lib/skills/builtins.ts` (یا یک فایل همسایه تحت `src/lib/skills/builtin/`). امضا: `(input, { apiKeyId, sessionId }) => Promise<output>`.
2. **مسیر کد سندباکس‌شده؟** `sandboxRunner.run(image, command, env, sandboxConfig({...}))` را فراخوانی کنید. از `normalizeImage()` در برابر فهرست مجاز استفاده کنید.
3. **مسیر فایل‌سیستم؟** همیشه پیش از دسترسی به دیسک از `resolveWorkspacePath(input, context)` عبور دهید.
4. **فراخوانی شبکه؟** از `safeOutboundFetch` با `guard: "public-only"` استفاده کنید؛ هدرها را از طریق `sanitizeHeaders()` پاک‌سازی کنید.
5. **ثبت** با افزودن ورودی به `builtinSkills` (یا فراخوانی سبک `registerBrowserSkill(executor)` در زمان بوت).
6. **اتصال نام‌مستعار ابزار داخلی** (اختیاری) در `BUILTIN_TOOL_ALIASES` (`interception.ts:23`) در صورتی که مدل upstream نام متفاوتی منتشر کند.
7. **تست‌ها** در `src/lib/skills/__tests__/` (Vitest).

---

## افزودن یک مهارت سفارشی (غیرداخلی)

1. هندلر را در زمان شروع پروسه ثبت کنید:
   ```ts
   skillExecutor.registerHandler("my-handler", async (input, ctx) => { ... });
   ```
2. مهارت را از طریق `POST /api/skills/install` درج کنید (فیلد `handlerCode` باید با نام هندلر ثبت‌شده منطبق باشد).
3. `mode` را به `on` یا `auto` از طریق `PUT /api/skills/[id]` تغییر دهید.

---

## نکات عملیاتی

- **کلید اصلی:** `settings.skillsEnabled = false` همه‌ی اجرا را مسدود می‌کند و روی `/api/skills/executions` HTTP `503` برمی‌گرداند. رجیستری به بارگذاری ادامه می‌دهد.
- **قفل‌کردن خروجی:** `SKILLS_SANDBOX_NETWORK_ENABLED` را تنظیم‌نشده (پیش‌فرض) نگه دارید برای سندباکس کاملاً ایزوله‌شده. `networkEnabled: true` به‌ازای‌هر‌فراخوانی همچنان نیازمند کلید اصلی است.
- **اجازه‌ی ایمیج‌های خاص:** `SKILLS_ALLOWED_SANDBOX_IMAGES="myorg/sandbox:1.0,node:22-alpine"` را تنظید کنید تا فهرست مجاز را گسترش دهید.
- **ممیزی اجراها:** `/dashboard/skills/executions` و `omniroute_skills_executions` هردوم `skill_executions` را جستجو می‌کنند. اجراهای موفق شامل `durationMs` هستند؛ شکست‌ها شامل `errorMessage`.
- **نامعتبر‌سازی کش:** پس از ویرایش‌های دستی DB `skillRegistry.invalidateCache()` را فراخوانی کنید؛ در غیر این صورت ۶۰ ثانیه منتظر بمانید.
- **فضای کار ناشناس:** هنگامی که `apiKeyId` خالی است، همه‌ی فراخوانی‌ها به یک فضای کار `"anonymous"` یکسان hash می‌شوند — کد آگاه‌از‌اشتراک همواره باید یک کلید واقعی ارسال کند.

---

## چرخه‌ی حیات اجرا (v3.8.16+)

`SkillExecutor` (`src/lib/skills/executor.ts`) یک **singleton** است که هر فراخوانی مهارت را مدیریت می‌کند. درک چرخه‌ی حیات آن برای رفع‌اشکال timeoutها، retryها و وضعیت اجرا حیاتی است.

### چرخه‌ی حیات ۵ مرحله‌ای

```
   execute() called
        │
        ▼
  ┌─────────────┐
  │  PENDING    │  ← queued, not yet started (DB row created)
  └──────┬──────┘
         │ start handler
         ▼
  ┌─────────────┐
  │  RUNNING    │  ← handler invoked with timeout
  └──────┬──────┘
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
    ▼         ▼          ▼          ▼
  SUCCESS   ERROR     TIMEOUT   (no other path — killed by parent)
    │         │          │
    └────┬────┴──────────┘
         │
         ▼
   DB row updated with status, output, durationMs
```

### پیکربندی پیش‌فرض

| Setting      | Default       | Configurable via                     |
| ------------ | ------------- | ------------------------------------ |
| `timeout`    | `30000` (30s) | `skillExecutor.setTimeout(ms)`       |
| `maxRetries` | `3`           | `skillExecutor.setMaxRetries(count)` |

> **مهم:** اجراکننده یک singleton است — فراخوانی `setTimeout()` بر همه‌ی فراخوانی‌های بعدی به‌صورت سراسری اثر می‌گذارد. timeout به‌ازای‌هر‌مهارت در حال حاضر پشتیبانی نمی‌شود؛ اگر به timeoutهای متفاوت به‌ازای‌هر‌مهارت نیاز دارید، پروسه‌های جداگانه ارسال کنید یا اجراکننده را fork کنید.

### مقادیر وضعیت

از `src/lib/skills/types.ts`:

```ts
enum SkillStatus {
  PENDING = "pending", // Queued, not yet started
  RUNNING = "running", // Handler invoked
  SUCCESS = "success", // Handler returned valid output
  ERROR = "error", // Handler threw an exception
  TIMEOUT = "timeout", // Exceeded the executor's timeout
}
```

> **نکته:** وضعیت `TIMEOUT` در enum تعریف شده اما توسط پیاده‌سازی فعلی اجراکننده **در واقعیت در DB نوشته نمی‌شود** — timeoutها به‌صورت `ERROR` با پیام `"Skill execution timed out"` ظاهر می‌شوند. این enum وضعیت برای استفاده‌ی آینده رزرو شده است.

### بررسی اجراها

```ts
import { skillExecutor } from "omniroute/skills/executor";

// Get a specific execution by ID
const exec = skillExecutor.getExecution("exec-uuid-123");
if (exec) {
  console.log(`${exec.skillName}: ${exec.status} in ${exec.durationMs}ms`);
}

// List recent executions for an API key
const recent = skillExecutor.listExecutions("api-key-id", 50, 0);
for (const e of recent) {
  console.log(`${e.skillName} → ${e.status} (${e.durationMs}ms)`);
}

// Count total executions
const total = skillExecutor.countExecutions("api-key-id");
```

### رفتار retry

تنظیم `maxRetries` ذخیره می‌شود اما **در حال حاضر استفاده نمی‌شود** توسط متد `execute()` ی اجراکننده — این متد تنها یک تلاش انجام می‌دهد. مقدار `maxRetries` برای پیاده‌سازی آینده و برای hookهایی که می‌خواهند آن را بخوانند افشا شده است.

در حال حاضر، retryها باید درون هندلر مهارت خود پیاده‌سازی شوند. مهارت‌های داخلی
در برابر اجراکننده ثبت می‌شوند (مثلاً `registerBuiltinSkills(executor)`
/ `registerBrowserSkill(executor)` در `src/lib/skills/builtin/`)؛ هر هندلری
که ثبت می‌کنید می‌تواند حلقه‌ی retry خود را بپیچد:

```ts
// inside a skill handler
async function handler(input, ctx) {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchSomething(input);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}
```

---

## SkillMode به‌تفصیل

enum ی `SkillMode` (`src/lib/skills/types.ts`) کنترل می‌کند **کِی و چگونگی** فراخوانی مهارت‌ها:

```ts
enum SkillMode {
  AUTO = "auto", // LLM decides when to call the skill
  MANUAL = "manual", // Only invoked by explicit user request
  HYBRID = "hybrid", // AUTO scoring + manual override
}
```

> **نکته:** codebase ی `SkillMode` (AUTO/MANUAL/HYBRID) را تعریف می‌کند، در حالی که فیلد `Skill.mode` شکل متفاوتی (`"on" | "off" | "auto"`) استفاده می‌کند. این دو مرتبط اما یکسان نیستند — `SkillMode` برای سیاست اجراکننده است، `Skill.mode` برای فعال‌سازی به‌ازای‌هر‌مهارت.

### چه‌ زمانی از هر حالت استفاده کنیم

| Mode     | LLM behavior                                                                   | Use case                                           |
| -------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `AUTO`   | LLM can call the skill when it deems necessary                                 | General-purpose skills (file reads, HTTP requests) |
| `MANUAL` | LLM cannot call the skill; only an explicit `executeSkill` API call invokes it | Sensitive operations (database writes, payments)   |
| `HYBRID` | LLM can suggest the skill; user must confirm                                   | Skills that have side effects but aren't dangerous |

### امتیازدهی AUTO

هنگامی که حالت `AUTO` فعال است، هر مهارت کاندید در برابر زمینه‌ی درخواست
توسط `scoreAutoSkill()` در `src/lib/skills/injection.ts` امتیازدهی می‌شود — یک سیستم امتیازی
جمعی و عددصحیح (تطبیق نام‌مهارت، هم‌پوشانی توکن نام/برچسب/توضیحات،
اشاره‌های background-reason، پاداش/جریمه‌ی provider-hint). بالاترین
`AUTO_MAX_SKILLS = 5` مهارت با `score >= AUTO_MIN_SCORE = 3` به‌عنوان
ابزارهای قابل‌فراخوانی تزریق می‌شوند، مساوی‌ها با `installCount` سپس نام شکسته می‌شوند. جدول امتیازی کامل را
در [**تولید شمای ابزار → امتیازدهی AUTO**](#auto-scoring) پیش‌تر در این
مستند ببینید؛ هیچ آستانه‌ی اعشاری سبک `0.6` و هیچ امتیازدهی `registry.ts` وجود ندارد.

---

## فهرست مهارت‌های داخلی

OmniRoute با مجموعه‌ای انتخاب‌شده از مهارت‌های داخلی در `src/lib/skills/builtin/` همراه است. رایج‌ترین‌ها:

### مهارت اتوماسیون مرورگر

مهارت browser (`src/lib/skills/builtin/browser.ts`) اتوماسیون مرورگر headless را از طریق Playwright/Puppeteer ارائه می‌دهد. **پیاده‌سازی شده اما در فهرست مهارت‌های پیش‌فرض نیست** — برای استفاده، افزونه‌ی اکستنشن مرورگر را جداگانه نصب کنید.

```ts
// Enable in your config
const config: SkillConfig = {
  enabled: true,
  mode: SkillMode.MANUAL, // Always require explicit invocation
  allowedSkills: ["browser"],
  timeout: 60000, // 60s for page loads
  maxRetries: 1,
};
```

### سایر دسته‌های داخلی

| Category  | Skills                                      | Mode   |
| --------- | ------------------------------------------- | ------ |
| File I/O  | `file_read`, `file_write`                   | AUTO   |
| HTTP      | `http_request`                              | AUTO   |
| Search    | `web_search`                                | AUTO   |
| Code Exec | `eval_code` (sandboxed JavaScript/Python)   | HYBRID |
| System    | `execute_command` (sandboxed CLI execution) | MANUAL |

### افزودن یک مهارت سفارشی

برای افزودن یک مهارت سفارشی از طریق سامانه افزونه به [Plugin SDK & Skills Integration](./PLUGIN_SDK.md) مراجعه کنید.

---

## مطالعه‌ی بیشتر

- [MCP-SERVER.md](./MCP-SERVER.md) — ثبت ابزار MCP و انتقال‌ها
- [A2A-SERVER.md](./A2A-SERVER.md) — چرخه‌ی حیات وظیفه‌ی A2A و اعزام مهارت
- [USER_GUIDE.md](../guides/USER_GUIDE.md#-skills-system) — معرفی رو‌به‌کاربر
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — لوله‌ی درخواست و نقشه‌ی اجزا
- منبع: `src/lib/skills/`، `src/app/api/skills/`، `open-sse/mcp-server/tools/skillTools.ts`
- تست‌ها: `src/lib/skills/__tests__/integration.test.ts`
