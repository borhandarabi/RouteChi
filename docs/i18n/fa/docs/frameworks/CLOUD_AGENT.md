---
title: "عامل‌های ابری"
version: 3.8.40
lastUpdated: 2026-06-28
---

# عامل‌های ابری

> **منبع حقیقت:** `src/lib/cloudAgent/` و `src/app/api/v1/agents/tasks/`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40 (بازخوانی frontmatter؛ ۴ عامل شامل cursor-cloud)

RouteChi عامل‌های کدنویسی میزبان‌شده‌ی ابری شخص ثالث (Codex Cloud، Cursor، Devin، Jules)
را به‌عنوان وظایف طولانی‌مدت هماهنگ می‌کند. هر عامل پشت یک رابط یکنواخت بسته‌بندی شده است
تا کلاینت‌ها بتوانند یک prompt + URL ریپو ارسال کنند و بدون درگیری با APIهای مختص
ارائه‌دهنده، نتایج را دریافت کنند.

یک وظیفه‌ی عامل ابری یک تکمیل چت معمولی **نیست**. این یک واحد کار دوام‌دار، چندمرحله‌ای
است که ممکن است چند دقیقه تا چند ساعت طول بکشد، می‌تواند یک Pull Request به‌عنوان
خروجی خود تولید کند و از پیام‌های پیگیری و (در برخی ارائه‌دهندگان) دروازه‌های تأیید پلن
پشتیبانی می‌کند.

![چرخه‌ی حیات وظیفه‌ی عامل ابری](../diagrams/exported/cloud-agent-flow.svg)

> منبع: [diagrams/cloud-agent-flow.mmd](../diagrams/cloud-agent-flow.mmd)

## عامل‌های پشتیبانی‌شده

| Provider ID    | Class              | Source                                | Upstream Base URL                       | Plan Approval |
| -------------- | ------------------ | ------------------------------------- | --------------------------------------- | ------------- |
| `jules`        | `JulesAgent`       | `src/lib/cloudAgent/agents/jules.ts`  | `https://jules.googleapis.com/v1alpha`  | Yes           |
| `devin`        | `DevinAgent`       | `src/lib/cloudAgent/agents/devin.ts`  | `https://api.devin.ai/v1`               | Yes           |
| `codex-cloud`  | `CodexCloudAgent`  | `src/lib/cloudAgent/agents/codex.ts`  | `https://api.openai.com/v1/codex/cloud` | No (auto)     |
| `cursor-cloud` | `CursorCloudAgent` | `src/lib/cloudAgent/agents/cursor.ts` | `https://api.cursor.com/v0`             | No (auto)     |

رجیستری: `src/lib/cloudAgent/registry.ts` — `getAgent(providerId)`،
`getAvailableAgents()` و `isCloudAgentProvider(providerId)` را صادر می‌کند. این رجیستری یک
`Record<string, CloudAgentBase>` ساده‌ی درون‌حافظه‌ای است که هنگام بارگذاری ماژول پر می‌شود.

## معماری

```
Client (Dashboard / CLI / API)
  → POST /api/v1/agents/tasks (management auth required)
    → CreateCloudAgentTaskSchema validation (Zod)
    → registry.getAgent(providerId)
    → getCloudAgentCredentials(providerId)
      └─ pulls from getProviderConnections({ provider, isActive: true })
         (apiKey first, fallback to accessToken)
    → agent.createTask({ prompt, source, options }, credentials)
      └─ HTTP POST to upstream provider API
      └─ returns CloudAgentTask with internal id + externalId
    → insertCloudAgentTask(...) into cloud_agent_tasks (SQLite)

Polling (lazy sync on read):
  GET /api/v1/agents/tasks/[id]
    → getCloudAgentTaskById(id)
    → agent.getStatus(externalId, credentials)  // refreshes status + activities
    → updateCloudAgentTask(...) with new status, result, completed_at
    → return serialized task

Interactions:
  POST /api/v1/agents/tasks/[id]  body: { action: "approve" | "message" | "cancel" }
    → agent.approvePlan(externalId, credentials)        for "approve"
    → agent.sendMessage(externalId, message, credentials) for "message"
    → status flips to "cancelled"                       for "cancel" (local-only)
```

هماهنگ‌سازی **تنبل** است: وضعیت در هر `GET /tasks/[id]` از upstream بازخوانی می‌شود.
هیچ نظرسنج پس‌زمینه‌ای وجود ندارد. داشبوردهایی که به وضعیت تازه نیاز دارند باید نقطه‌ی
پایانی GET را در بازه‌های معقول نظرسنجی کنند.

## رابط `CloudAgentBase`

منبع: `src/lib/cloudAgent/baseAgent.ts`

```typescript
export interface AgentCredentials {
  apiKey: string;
  baseUrl?: string;
}

export interface CreateTaskParams {
  prompt: string;
  source: CloudAgentSource;
  options: {
    autoCreatePr?: boolean;
    planApprovalRequired?: boolean;
    environment?: Record<string, string>;
  };
}

export interface GetStatusResult {
  status: CloudAgentStatus;
  externalId?: string;
  result?: CloudAgentResult;
  activities: CloudAgentActivity[];
  error?: string;
}

export abstract class CloudAgentBase {
  abstract readonly providerId: string;
  abstract readonly baseUrl: string;

  abstract createTask(p: CreateTaskParams, c: AgentCredentials): Promise<CloudAgentTask>;
  abstract getStatus(externalId: string, c: AgentCredentials): Promise<GetStatusResult>;
  abstract approvePlan(externalId: string, c: AgentCredentials): Promise<void>;
  abstract sendMessage(
    externalId: string,
    message: string,
    c: AgentCredentials
  ): Promise<CloudAgentActivity>;
  abstract listSources(
    c: AgentCredentials
  ): Promise<{ name: string; url: string; branch?: string }[]>;

  protected mapStatus(raw: string): CloudAgentStatus; // heuristic upstream-string → enum
  protected generateTaskId(): string; // `task_<ts>_<rand>`
  protected generateActivityId(): string; // `act_<ts>_<rand>`
}
```

`CodexCloudAgent.approvePlan` عمداً پرتاب می‌کند — Codex Cloud به‌صورت خودکار پلن می‌سازد و
هیچ دروازه‌ی تأییدی ندارد. `CodexCloudAgent.listSources` مقدار `[]` را برمی‌گرداند.

`CursorCloudAgent` عامل‌های Background / Cloud ی Cursor را از طریق REST API رسمی
(`api.cursor.com/v0`) با یک **کلید API کاربر یا حساب سرویس** هدایت می‌کند — جایگزین امن‌تر
و شخص اول برای استفاده‌ی مجدد از نشست OAuth ی Cursor IDE (ارائه‌دهنده‌ی `cursor`، که هشدار
ریسک مسدودیت دارد). این یک آداپتور ساده‌ی REST است (بدون وابستگی بومی `@cursor/sdk`).
`approvePlan` پرتاب می‌کند (عامل‌های Cursor خودکار اجرا می‌شوند)؛ `listSources` مخازن قابل
دسترسی توسط کلید را فهرست می‌کند. Cursor مقادیر وضعیت UPPERCASE
(`CREATING`/`RUNNING`/`FINISHED`/`ERROR`) را برمی‌گرداند که به‌صورت صریح به
`CloudAgentStatus` مشترک نگاشت می‌شوند. `baseUrl` به‌ازای‌هراعتبار قابل‌بازنویسی است تا
نسخه/مسیر API بدون تغییر کد قابل اصلاح باشد.

## انواع دامنه

منبع: `src/lib/cloudAgent/types.ts`

```typescript
export const CLOUD_AGENT_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  AWAITING_APPROVAL: "awaiting_approval",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export interface CloudAgentSource {
  repoName: string;
  repoUrl: string; // must be a valid URL
  branch?: string;
}

export interface CloudAgentResult {
  prUrl?: string;
  prNumber?: number;
  commitMessage?: string;
  diffUrl?: string;
  summary?: string;
  duration?: number; // seconds, positive int
  cost?: number; // positive float
}

export interface CloudAgentActivity {
  id: string;
  type: "plan" | "command" | "code_change" | "message" | "error" | "completion";
  content: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

export interface CloudAgentTask {
  id: string; // internal `task_...` id
  providerId: "jules" | "devin" | "codex-cloud" | "cursor-cloud";
  externalId?: string; // upstream provider's id
  status: CloudAgentStatus;
  prompt: string; // 1..10000 chars
  source: CloudAgentSource;
  options: {
    autoCreatePr?: boolean;
    planApprovalRequired?: boolean;
    environment?: Record<string, string>;
  };
  result?: CloudAgentResult;
  activities: CloudAgentActivity[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

شمای اعتبارسنجی (`CreateCloudAgentTaskSchema`، `UpdateCloudAgentTaskSchema`) در کنار انواع
صادر شده‌اند و توسط هندلرهای مسیر استفاده می‌شوند.

## پایگاه داده

منبع: `src/lib/cloudAgent/db.ts` — جدول به‌صورت تنبل از طریق
`createCloudAgentTaskTable()` ساخته می‌شود (همچنین از `src/lib/cloudAgent/index.ts` هنگام
وارد کردن ماژول فراخوانی می‌شود).

```sql
CREATE TABLE IF NOT EXISTS cloud_agent_tasks (
  id           TEXT PRIMARY KEY,
  provider_id  TEXT NOT NULL,
  external_id  TEXT,
  status       TEXT NOT NULL DEFAULT 'queued',
  prompt       TEXT NOT NULL,
  source       TEXT NOT NULL,             -- JSON
  options      TEXT DEFAULT '{}',         -- JSON
  result       TEXT,                       -- JSON
  activities   TEXT DEFAULT '[]',          -- JSON
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cloud_agent_tasks_provider ON cloud_agent_tasks(provider_id);
CREATE INDEX IF NOT EXISTS idx_cloud_agent_tasks_status   ON cloud_agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cloud_agent_tasks_created  ON cloud_agent_tasks(created_at DESC);
```

`updateCloudAgentTask` برای جلوگیری از تزریق SQL یک **فهرست سفید ستون** اعمال می‌کند:
`status`، `prompt`، `source`، `options`، `result`، `activities`، `error`،
`completed_at`. هر کلید دیگر در به‌روزرسانی جزئی بی‌صدا نادیده گرفته می‌شود.

## REST API — چرخه‌ی حیات وظیفه

**احراز هویت:** همه‌ی نقاط پایانی `/api/v1/agents/tasks*` نیازمند **احراز هویت مدیریتی**
هستند (`requireCloudAgentManagementAuth` که `requireManagementAuth` از
`src/lib/api/requireManagementAuth` را می‌پوشاند). این پس از کامیت `588a0333`
(_"fix(auth): require management auth for agent and cooldown APIs"_) اعمال شده است.

| Method  | Path                          | Purpose                                                |
| ------- | ----------------------------- | ------------------------------------------------------ |
| OPTIONS | `/api/v1/agents/tasks`        | CORS preflight                                         |
| GET     | `/api/v1/agents/tasks`        | List tasks (filter: `provider`, `status`, `limit≤500`) |
| POST    | `/api/v1/agents/tasks`        | Create task (dispatches to upstream + persists)        |
| DELETE  | `/api/v1/agents/tasks?id=...` | Delete task by query id (does **not** cancel upstream) |
| OPTIONS | `/api/v1/agents/tasks/[id]`   | CORS preflight                                         |
| GET     | `/api/v1/agents/tasks/[id]`   | Read task + lazy-sync status from upstream             |
| POST    | `/api/v1/agents/tasks/[id]`   | Action: `approve` / `message` / `cancel`               |
| DELETE  | `/api/v1/agents/tasks/[id]`   | Delete task by path id                                 |

### ایجاد وظیفه

```bash
curl -X POST http://localhost:20128/api/v1/agents/tasks \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "devin",
    "prompt": "Fix the bug in src/foo.ts where the parser returns null",
    "source": {
      "repoName": "user/repo",
      "repoUrl": "https://github.com/user/repo",
      "branch": "main"
    },
    "options": {
      "autoCreatePr": true,
      "planApprovalRequired": false
    }
  }'
```

پاسخ `201`:

```json
{
  "data": {
    "id": "task_1731512345678_abc123def",
    "providerId": "devin",
    "externalId": "session_xyz",
    "status": "queued",
    "prompt": "...",
    "source": { "repoName": "user/repo", "repoUrl": "...", "branch": "main" },
    "options": { "autoCreatePr": true },
    "createdAt": "2026-05-13T12:34:56.789Z"
  }
}
```

### تأیید یک پلن

```bash
curl -X POST http://localhost:20128/api/v1/agents/tasks/<id> \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}'
```

### ارسال پیام پیگیری

```bash
curl -X POST http://localhost:20128/api/v1/agents/tasks/<id> \
  -d '{"action":"message","message":"Also add a unit test for the parser"}'
```

### لغو (فقط وضعیت محلی)

```bash
curl -X POST http://localhost:20128/api/v1/agents/tasks/<id> \
  -d '{"action":"cancel"}'
```

`cancel` در DB محلی `status` را به `"cancelled"` تغییر می‌دهد اما **پروایدر** upstream
را فراخوانی نمی‌کند — هیچ RPC ی لغو در `CloudAgentBase` وجود ندارد. برای توقف صورتحساب
upstream، وظیفه را در کنسول خود پروایدر خاتمه دهید.

## REST API — لوله‌کشی پروایدر ابری

این نقاط پایانی کمکی در `src/app/api/cloud/` توسط کلاینت‌های راه‌دور
(CLI، اپلیکیشن Electron یا کارگران هماهنگ‌سازی) برای خواندن فراداده‌ی اتصال پروایدر
و تفکیک نام‌مستعار مدل استفاده می‌شوند. آن‌ها با یک **کلید API معمولی**
(از طریق `validateApiKey`) احراز هویت می‌شوند، نه با احراز هویت مدیریتی که نقاط پایانی
وظیفه از آن استفاده می‌کنند.

| Method | Path                            | Purpose                                                             |
| ------ | ------------------------------- | ------------------------------------------------------------------- |
| POST   | `/api/cloud/auth`               | Validate API key, return masked connection metadata + model aliases |
| PUT    | `/api/cloud/credentials/update` | Refresh `accessToken` / `refreshToken` / `expiresAt`                |
| POST   | `/api/cloud/model/resolve`      | Resolve a model alias to `{ provider, model }`                      |
| GET    | `/api/cloud/models/alias`       | List all model aliases                                              |
| PUT    | `/api/cloud/models/alias`       | Set a model alias (and auto-sync to Cloud if enabled)               |

`/api/cloud/auth` هرگز `apiKey` / `accessToken` / `refreshToken` خام را برنمی‌گرداند. مقادیر
`hasApiKey`، `hasAccessToken`، `hasRefreshToken` و یک پیش‌نمایش نقاب‌دار
(`maskedApiKey`: ۴ کاراکتر اول + `****` + ۴ کاراکتر آخر) را برمی‌گرداند.

## تفکیک اعتبارنامه‌ها

`getCloudAgentCredentials(providerId)` در `src/lib/cloudAgent/api.ts`:

1. اتصالات فعال پروایدر را از طریق `getProviderConnections({ provider: providerId, isActive: true })` بارگذاری می‌کند.
2. برای هر اتصال، اول `apiKey` (برش‌خورده) را ترجیح می‌دهد. در صورت نبود به `accessToken` رجوع می‌کند.
3. اولین توکن غیرخالی را به‌صورت `{ apiKey: token }` بسته‌بندی شده برمی‌گرداند.
4. اگر هیچ توکن قابل‌استفاده‌ای یافت نشد `null` برمی‌گرداند — API با
   `"No active credentials configured for cloud agent provider: <id>"` پاسخ `400` می‌دهد.

این بدان معناست که عامل‌های ابری از همان جدول Provider Connection که پروایدرهای LLM معمول
استفاده می‌کنند، استفاده مجدد می‌کنند. برای فعال‌سازی Jules، یک اتصال فعال با `provider: "jules"`
و یک `apiKey` پرشده ایجاد کنید.

## داشبورد

منبع: `src/app/(dashboard)/dashboard/cloud-agents/page.tsx`

یک صفحه‌ی React ی `"use client"` که:

- وظایف را فهرست می‌کند (نظرسنجی از طریق `GET /api/v1/agents/tasks`).
- وظایف جدید را از طریق فرمی ارسال می‌کند که به `CreateCloudAgentTaskSchema` نگاشت می‌شود.
- نشان‌های وضعیت (`queued`، `running`، `awaiting_approval`، `completed`،
  `failed`، `cancelled`) را نمایش می‌دهد و تایم‌لاین `activities[]` را رندر می‌کند.
- هنگام `status === "completed"` مقادیر `result.prUrl` / `commitMessage` / `summary` را آشکار می‌سازد.

## یکپارچه‌سازی با A2A

عامل‌های ابری می‌توانند به‌عنوان مهارت‌های A2A با ثبت یک مهارت A2A که هندلر `tasks/send`
خود را به `getAgent(...).createTask(...)` واگذار می‌کند و رویدادهای وضعیت وظیفه‌ی A2A
را به پروتکل JSON-RPC 2.0 ترجمه می‌کند، افشا شوند. به [A2A-SERVER.md](./A2A-SERVER.md) مراجعه کنید.

## افزودن عامل ابری جدید

1. `src/lib/cloudAgent/agents/<name>.ts` را با گسترش `CloudAgentBase` ایجاد کنید.
2. `createTask`، `getStatus`، `approvePlan` (یا در صورت عدم کاربرد پرتاب کنید)،
   `sendMessage`، `listSources` را پیاده‌سازی کنید. از `this.mapStatus(...)` برای نرمال‌سازی وضعیت استفاده کنید.
3. در `src/lib/cloudAgent/registry.ts` تحت یک `providerId` پایدار ثبت کنید.
4. اجتماع تحت‌الفظری `providerId` در `src/lib/cloudAgent/types.ts`
   (`CloudAgentTask.providerId` و `CreateCloudAgentTaskSchema`) را گسترش دهید.
5. در صورت نیاز به رکورد اتصال، پروایدر را به `src/shared/constants/providers.ts` اضافه کنید.
   پروایدرهای مبتنی بر OAuth همچنین به `src/lib/oauth/providers/` نیاز دارند.
6. تست‌ها را در `tests/unit/cloud-agent-*.test.ts` اضافه کنید.
7. این مستند و ثابت `CLOUD_AGENTS` داشبورد را به‌روزرسانی کنید.

## پیکربندی

| Env Var          | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `DATA_DIR`       | Location of the SQLite database holding `cloud_agent_tasks` |
| `JWT_SECRET`     | Required for management auth on task endpoints              |
| `API_KEY_SECRET` | Required to encrypt provider connection credentials at rest |

امروزه هیچ متغیر محیطی مختص عامل ابری وجود ندارد — همه‌ی اسرار در جدول
`provider_connections` قرار دارند.

## مطالعه‌ی بیشتر

- [A2A-SERVER.md](./A2A-SERVER.md)
- [API_REFERENCE.md](../reference/API_REFERENCE.md)
- [SKILLS.md](./SKILLS.md)
- [MEMORY.md](./MEMORY.md)
- منبع: `src/lib/cloudAgent/`
- مسیرها: `src/app/api/v1/agents/tasks/`، `src/app/api/cloud/`
- داشبورد: `src/app/(dashboard)/dashboard/cloud-agents/page.tsx`
