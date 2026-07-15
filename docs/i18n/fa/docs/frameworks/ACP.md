---
title: ACP (پروتکل Agent Client)
---

# ACP (پروتکل Agent Client)

> **خلاصه:** ACP به OmniRoute اجازه می‌دهد عوامل CLI (مانند Claude Code، Codex) را به‌جای استفاده از HTTP APIها به‌عنوان فرآیندهای فرزند اجرا کند. این رویکرد یک انتقال «CLI به‌عنوان-backend» فراهم می‌کند.

---

## ACP چیست؟

ACP (Agent Client Protocol) یک انتقال **«CLI به‌عنوان-backend»** برای OmniRoute است. به‌جای رهگیری فراخوانی‌های HTTP API به ارائه‌دهندگان هوش مصنوعی، ACP **عوامل CLI را به‌عنوان فرآیندهای فرزند اجرا می‌کند** و درخواست‌ها را از طریق رابط بومی آن‌ها ارسال می‌کند.

### چرا از ACP استفاده کنیم؟

| مزیت                       | توضیحات                                  |
| -------------------------- | ---------------------------------------- |
| **بدون نیاز به API key**   | از احراز هویت بومی CLI موجود شما استفاده می‌کند |
| **پروتکل بومی**            | از قالب ورودی/خروجی بومی هر CLI استفاده می‌کند |
| **کشف خودکار**             | عوامل CLI نصب‌شده روی سیستم شما را شناسایی می‌کند |
| **۱۴ عامل داخلی**          | برای ابزارهای CLI محبوب از پیش پیکربندی شده است |
| **عوامل سفارشی**           | ابزارهای CLI خود را از طریق تنظیمات اضافه کنید |
| **مدیریت فرآیند**          | چرخه حیات (spawn، ارسال، kill) را مدیریت می‌کند |

---

## عوامل CLI پشتیبانی‌شده

ACP از **۱۴ عامل CLI داخلی** به‌صورت پیش‌فرض پشتیبانی می‌کند:

| شناسه عامل    | نام نمایشی         | باینری        | پروتکل |
| ------------- | ------------------ | ------------- | -------- |
| `codex`       | OpenAI Codex CLI   | `codex`       | stdio    |
| `claude`      | Claude Code CLI    | `claude`      | stdio    |
| `goose`       | Goose CLI          | `goose`       | stdio    |
| `openclaw`    | OpenClaw           | `openclaw`    | stdio    |
| `aider`       | Aider              | `aider`       | stdio    |
| `opencode`    | OpenCode           | `opencode`    | stdio    |
| `cline`       | Cline              | `cline`       | stdio    |
| `qwen-code`   | Qwen Code          | `qwen`        | stdio    |
| `forge`       | ForgeCode          | `forge`       | stdio    |
| `amazon-q`    | Amazon Q Developer | `q`           | stdio    |
| `interpreter` | Open Interpreter   | `interpreter` | stdio    |
| `cursor-cli`  | Cursor CLI         | `cursor`      | stdio    |
| `warp`        | Warp AI            | `warp`        | stdio    |

### عوامل سفارشی

می‌توانید عوامل CLI خود را از طریق تنظیمات اضافه کنید. عوامل سفارشی از همان قابلیت‌های عوامل داخلی پشتیبانی می‌کنند.

---

## شروع سریع

### مرحله ۱: نصب یک عامل CLI

```bash
# مثال: نصب Claude Code CLI
npm install -g @anthropic-ai/claude-code

# تأیید نصب
claude --version
```

### مرحله ۲: کشف خودکار ACP

ACP عوامل CLI نصب‌شده روی سیستم شما را به‌صورت خودکار شناسایی می‌کند. هیچ پیکربندی لازم نیست!

### مرحله ۳: استفاده از انتقال ACP

پس از شناسایی، ACP می‌تواند به‌عنوان انتقال برای هر ارائه‌دهنده پشتیبانی‌شده استفاده شود. OmniRoute به‌صورت خودکار زمانی که CLI در دسترس باشد از ACP استفاده می‌کند.

---

## نحوه کار ACP

### معماری

```
┌─────────────────┐
│  OmniRoute      │
│  (HTTP Proxy)   │
└────────┬────────┘
         │
         │ spawn()
         ▼
┌─────────────────┐
│  Child Process  │
│  (CLI Agent)    │
│                 │
│  stdin  ◄──────┤  Send prompt
│  stdout ──────►│  Receive response
│  stderr ──────►│  Receive errors
└─────────────────┘
```

### چرخه حیات فرآیند

۱. **Spawn** — ACP یک فرآیند فرزند برای عامل CLI ایجاد می‌کند
۲. **ارسال** — ACP درخواست‌ها را به stdin فرآیند می‌نویسد
۳. **دریافت** — ACP پاسخ‌ها را از stdout/stderr می‌خواند
۴. **کشف بیکاری** — ACP قبل از کامل‌شدن پاسخ، ۲ ثانیه عدم فعالیت را منتظر می‌ماند
۵. **Kill** — ACP فرآیند را خاتمه می‌دهد (SIGTERM، سپس SIGKILL پس از ۵ ثانیه)

### پروتکل ارتباطی

ACP برای ارتباط با عوامل CLI از **stdio** (ورودی/خروجی استاندارد) استفاده می‌کند. پروتکل به این شکل است:

۱. **ارسال درخواست** — نوشتن به stdin با یک خط جدید
۲. **انتظار برای پاسخ** — خواندن از stdout تا زمان بیکاری (۲ ثانیه بدون خروجی)
۳. **مهلت زمانی** — پیش‌فرض ۱۲۰ ثانیه (قابل پیکربندی)

---

## مرجع API

### توابع رجیستری

#### `detectInstalledAgents()`

تمام عوامل CLI نصب‌شده روی سیستم را شناسایی می‌کند. نتایج برای ۶۰ ثانیه کش می‌شوند.

```typescript
import { detectInstalledAgents } from "@/lib/acp";

const agents = detectInstalledAgents();
// خروجی: CliAgentInfo[]

interface CliAgentInfo {
  id: string; // مثلاً "codex" یا "claude"
  name: string; // نام نمایشی
  binary: string; // نام باینری برای اجرا
  versionCommand: string; // دستور تشخیص نسخه
  version: string | null; // نسخه شناسایی‌شده (null اگر نصب نباشد)
  installed: boolean; // آیا عامل نصب شده است
  providerAlias: string; // شناسه ارائه‌دهنده در OmniRoute
  spawnArgs: string[]; // آرگومان‌هایی که هنگام اجرا ارسال می‌شوند
  protocol: "stdio" | "http"; // پروتکل ارتباطی
  isCustom?: boolean; // آیا این عامل سفارشی تعریف‌شده توسط کاربر است
}
```

#### `getAvailableAgents()`

فقط عواملی که نصب شده‌اند و برای ACP در دسترس هستند را برمی‌گرداند.

```typescript
import { getAvailableAgents } from "@/lib/acp";

const available = getAvailableAgents();
// خروجی: CliAgentInfo[] (فقط عوامل نصب‌شده)
```

#### `getAgentById(id)`

یک عامل خاص را بر اساس ID دریافت می‌کند.

```typescript
import { getAgentById } from "@/lib/acp";

const agent = getAgentById("claude");
// خروجی: CliAgentInfo | undefined
```

#### `setCustomAgents(agents)`

تعاریف عوامل سفارشی را از تنظیمات تنظیم می‌کند.

```typescript
import { setCustomAgents } from "@/lib/acp";

setCustomAgents([
  {
    id: "my-custom-cli",
    name: "My Custom CLI",
    binary: "mycli",
    versionCommand: "mycli --version",
    providerAlias: "my-provider",
    spawnArgs: [],
    protocol: "stdio",
  },
]);
```

### توابع مدیریت

#### `acpManager.spawn(agentId, binary, args, env)`

یک فرآیند عامل CLI جدید اجرا می‌کند.

```typescript
import { acpManager } from "@/lib/acp";

const session = acpManager.spawn("claude", "claude", ["--print", "--output-format", "json"], {
  /* متغیرهای محیطی سفارشی */
});
// خروجی: AcpSession
```

**شناسه‌های عامل مجاز**: `["claude", "codex", "gemini", "qwen"]`

#### `acpManager.sendPrompt(sessionId, prompt, timeoutMs)`

یک درخواست به عامل CLI ارسال کرده و پاسخ را جمع‌آوری می‌کند.

```typescript
import { acpManager } from "@/lib/acp";

const response = await acpManager.sendPrompt(
  "acp-claude-1234567890-abc123",
  "What is 2+2?",
  120000 // مهلت ۲ دقیقه
);
// خروجی: Promise<string>
```

#### `acpManager.kill(sessionId)`

یک نشست را خاتمه داده و منابع را پاک‌سازی می‌کند.

```typescript
import { acpManager } from "@/lib/acp";

const killed = acpManager.kill("acp-claude-1234567890-abc123");
// خروجی: boolean
```

#### `acpManager.getActiveSessions()`

تمام نشست‌های فعال را برمی‌گرداند.

```typescript
import { acpManager } from "@/lib/acp";

const sessions = acpManager.getActiveSessions();
// خروجی: AcpSession[]
```

#### `acpManager.killAll()`

تمام نشست‌ها را خاتمه می‌دهد.

```typescript
import { acpManager } from "@/lib/acp";

acpManager.killAll();
```

### رابط نشست

```typescript
interface AcpSession {
  id: string; // شناسه یکتای نشست
  agentId: string; // شناسه عامل (مثلاً "claude")
  process: ChildProcess; // هندل فرآیند فرزند
  alive: boolean; // آیا فرآیند زنده است
  stdoutBuffer: string; // بافر انباشته stdout
  stderrBuffer: string; // بافر انباشته stderr
  createdAt: Date; // مهر زمانی ایجاد
}
```

### رویدادها

کلاس `AcpManager` از `EventEmitter` ارث‌بری می‌کند و رویدادهای زیر را منتشر می‌کند:

#### `stdout`

زمانی که عامل CLI به stdout می‌نویسد منتشر می‌شود.

```typescript
acpManager.on("stdout", ({ sessionId, data }) => {
  console.log(`[${sessionId}] stdout: ${data}`);
});
```

#### `stderr`

زمانی که عامل CLI به stderr می‌نویسد منتشر می‌شود.

```typescript
acpManager.on("stderr", ({ sessionId, data }) => {
  console.error(`[${sessionId}] stderr: ${data}`);
});
```

#### `exit`

زمانی که فرآیند عامل CLI خارج می‌شود منتشر می‌شود.

```typescript
acpManager.on("exit", ({ sessionId, code, signal }) => {
  console.log(`[${sessionId}] exited with code ${code}, signal ${signal}`);
});
```

#### `error`

زمانی که فرآیند عامل CLI دچار خطا می‌شود منتشر می‌شود.

```typescript
acpManager.on("error", ({ sessionId, error }) => {
  console.error(`[${sessionId}] error: ${error}`);
});
```

---

## پیکربندی

### متغیرهای محیطی

ACP تمام متغیرهای محیطی را از فرآیند والد به ارث می‌برد و می‌تواند با متغیرهای محیطی سفارشی گسترش یابد:

```typescript
acpManager.spawn("claude", "claude", [], {
  ANTHROPIC_API_KEY: "sk-...",
  DEBUG: "true",
});
```

### آرگومان‌های اجرا

هر عامل آرگومان‌های اجرای پیش‌فرضی دارد که در رجیستری تعریف شده‌اند. می‌توانید آن‌ها را بازنویسی کنید:

```typescript
acpManager.spawn("claude", "claude", ["--print", "--verbose"], {});
```

### مهلت‌های زمانی

مهلت پیش‌فرض درخواست **۱۲۰ ثانیه** (۲ دقیقه) است. می‌توانید آن را بازنویسی کنید:

```typescript
await acpManager.sendPrompt(sessionId, prompt, 300000); // 5 دقیقه
```

### کش تشخیص

تشخیص عامل برای **۶۰ ثانیه** کش می‌شود تا از اسکن‌های پرهزینه فایل‌سیستم جلوگیری شود. برای بازنشانی اجباری:

```typescript
import { refreshAgentCache } from "@/lib/acp";

refreshAgentCache();
```

---

## امنیت

### جلوگیری از تزریق دستور

ACP دستورات نسخه را برای جلوگیری از حملات تزریق دستور اعتبارسنجی می‌کند:

```typescript
const DISALLOWED_VERSION_COMMAND_CHARS = /[;&|<>`$\r\n]/;
```

دستورات نسخه‌ای که شامل این کاراکترها باشند رد می‌شوند:

- `;` — جداکننده دستور
- `&` — فرآیند پس‌زمینه
- `|` — لوله (pipe)
- `<`، `>` — تغییر مسیر
- `` ` `` — جایگزینی دستور
- `$` — بسط متغیر
- `\r`، `\n` — شکست خط

### اعتبارسنجی نام باینری

ACP بررسی می‌کند که باینری دستور نسخه با نام باینری مورد انتظار مطابقت دارد (مگر اینکه عامل سفارشی باشد).

### انزوای فرآیند

هر نشست ACP در فرآیند فرزند خودش اجرا می‌شود. فرآیند زمانی که نشست پایان می‌یابد یا مهلت آن منقضی می‌شود، kill می‌شود.

---

## عملکرد

### عملکرد تشخیص

- **اولین فراخوانی**: حدود ۵۰-۲۰۰ میلی‌ثانیه (دستور `version` را برای هر عامل اجرا می‌کند)
- **فراخوانی‌های کش‌شده**: کمتر از ۱ میلی‌ثانیه (از کش برمی‌گردد)
- **TTL کش**: ۶۰ ثانیه

### عملکرد درخواست

- **Spawn**: حدود ۵۰-۱۰۰ میلی‌ثانیه
- **ارسال درخواست**: حدود ۱۰-۵۰ میلی‌ثانیه
- **انتظار برای پاسخ**: بستگی به عامل CLI دارد (معمولاً ۱-۳۰ ثانیه)
- **Kill**: حدود ۵ ثانیه (SIGTERM) + فوری (SIGKILL)

### مصرف منابع

- **حافظه به ازای نشست**: حدود ۱۰-۵۰ مگابایت (بستگی به عامل CLI دارد)
- **CPU**: حداقل (I/O محدود)
- **دیسک**: هیچ

---

## عیب‌یابی

### خطای "Unknown agent"

**مشکل**: `acpManager.spawn()` خطای `Unknown agent: <id>` می‌دهد

**راه‌حل**: فقط ۴ عامل در `spawn()` مجاز هستند:

- `claude`
- `codex`
- `gemini`
- `qwen`

سایر عوامل باید به‌صورت دستی یا از طریق تعاریف عامل سفارشی اجرا شوند.

### خطای "Session not alive"

**مشکل**: `acpManager.sendPrompt()` خطای `Session ${sessionId} is not alive` می‌دهد

**راه‌حل**: ممکن است نشست خارج شده یا kill شده باشد. وضعیت نشست را بررسی کنید:

```typescript
const session = acpManager.getSession(sessionId);
if (!session?.alive) {
  // نشست را دوباره اجرا کنید
  acpManager.spawn("claude", "claude", [], {});
}
```

### خطای "ACP timeout"

**مشکل**: `acpManager.sendPrompt()` خطای `ACP timeout after 120000ms` می‌دهد

**راه‌حل**: مهلت زمانی را افزایش دهید:

```typescript
await acpManager.sendPrompt(sessionId, prompt, 300000); // 5 دقیقه
```

### CLI شناسایی نشد

**مشکل**: `detectInstalledAgents()` CLI شما را پیدا نمی‌کند

**راه‌حل‌ها**:

۱. **بررسی PATH**: مطمئن شوید CLI در PATH سیستم شما قرار دارد
۲. **بررسی دستور نسخه**: `claude --version` را به‌صورت دستی اجرا کنید
۳. **بررسی مجوزها**: مطمئن شوید CLI قابل اجرا است
۴. **عامل سفارشی**: برای CLIهای غیراستاندارد یک تعریف عامل سفارشی اضافه کنید

### دسترسی رد شد

**مشکل**: ACP نمی‌تواند CLI را اجرا کند

**راه‌حل‌ها**:

۱. **بررسی مجوزهای فایل**: `chmod +x /usr/local/bin/claude`
۲. **بررسی مالکیت**: مطمئن شوید OmniRoute مجوزهای خواندن/اجرا دارد
۳. **بررسی SELinux/AppArmor**: ممکن است اجرای فرآیند را مسدود کنند

---

## مثال‌ها

### مثال ۱: اجرا و استفاده از Claude Code

```typescript
import { acpManager, detectInstalledAgents } from "@/lib/acp";

// شناسایی عوامل نصب‌شده
const agents = detectInstalledAgents();
const claude = agents.find((a) => a.id === "claude");

if (claude?.installed) {
  // اجرای یک نشست جدید
  const session = acpManager.spawn("claude", claude.binary, ["--print", "--output-format", "json"]);

  // ارسال یک درخواست
  const response = await acpManager.sendPrompt(
    session.id,
    "Explain quantum computing in 100 words"
  );

  console.log("Claude's response:", response);

  // پاک‌سازی
  acpManager.kill(session.id);
}
```

### مثال ۲: کشف خودکار با Fallback

```typescript
import { acpManager, getAvailableAgents } from "@/lib/acp";

const available = getAvailableAgents();

// ابتدا Claude را امتحان کنید، در صورت عدم دسترسی به Codex رجوع کنید
let agentId = "claude";
if (!available.find((a) => a.id === "claude")) {
  if (available.find((a) => a.id === "codex")) {
    agentId = "codex";
  } else {
    throw new Error("No ACP-compatible CLI agent found");
  }
}

const agent = available.find((a) => a.id === agentId)!;
const session = acpManager.spawn(agentId, agent.binary, agent.spawnArgs);

const response = await acpManager.sendPrompt(session.id, "Hello!");

acpManager.kill(session.id);
```

### مثال ۳: عامل سفارشی

```typescript
import { setCustomAgents, detectInstalledAgents } from "@/lib/acp";

// ثبت یک عامل CLI سفارشی
setCustomAgents([
  {
    id: "my-llm-cli",
    name: "My LLM CLI",
    binary: "myllm",
    versionCommand: "myllm --version",
    providerAlias: "my-llm-provider",
    spawnArgs: ["--format", "json"],
    protocol: "stdio",
  },
]);

// حالا detectInstalledAgents() شامل "my-llm-cli" خواهد بود
const agents = detectInstalledAgents();
```

---

## گام بعدی

- **[مرجع API](../reference/API_REFERENCE.md)** — endpointهای REST API
- **[مرجع ارائه‌دهنده](../reference/PROVIDER_REFERENCE.md)** — تمام ۲۲۶ ارائه‌دهنده
- **[MCP Server](./MCP-SERVER.md)** — یکپارچه‌سازی Model Context Protocol
- **[A2A Server](./A2A-SERVER.md)** — پروتکل Agent-to-Agent
- **[Cloud Agent](./CLOUD_AGENT.md)** — عوامل مبتنی بر فضای ابری

---

## مرجع

- [پروژه AionUi](https://github.com/iOfficeAI/AionUi) — الهام‌بخش کشف خودکار ACP
- [کد منبع ACP](../../src/lib/acp/) — جزئیات پیاده‌سازی
  - `manager.ts` — مدیریت چرخه حیات فرآیند
  - `registry.ts` — کشف و ثبت عامل
  - `index.ts` — خروجی‌های API عمومی
