---
title: "راهنمای پروتکل‌های عامل"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای پروتکل‌های عامل

> **منبع:** `src/lib/{a2a,acp,cloudAgent}/`, `src/app/api/{a2a,acp,cloud}/`, `src/app/api/v1/agents/`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

RouteChi سه سطح متفاوت مرتبط با عامل ارائه می‌دهد. آن‌ها در نگاه اول مشابه به‌نظر می‌رسند اما مسائل متفاوتی را حل می‌کنند. از این صفحه برای انتخاب درست استفاده کنید.

## خلاصه

| سطح                          | بهترین برای                                                                                                                                | ترنسپورت                   | استاندارد           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------- |
| **A2A — Agent-to-Agent**     | همکاری بین‌عاملی با عامل‌های همتا که به پروتکل A2A صحبت می‌کنند                                                                             | JSON-RPC 2.0 از طریق HTTP   | A2A v0.3 (spec باز) |
| **ACP — رجیستری عامل‌های CLI** | تشخیص / ثبت / راه‌اندازی عامل‌های کدنویسی CLI نصب‌شده روی ماشین کاربر (Cursor، Cline، Codex CLI، Claude Code، Aider و غیره)                  | HTTP REST                   | اختصاصی RouteChi    |
| **Cloud Agents**             | ارسال وظایف کدنویسی طولانی‌مدت به سرویس‌های ابری خارجی (Codex Cloud، Devin، Jules، Cursor Cloud)                                            | HTTP REST + taskهای مبتنی بر DB | اختصاصی RouteChi    |

این سه مستقل هستند — هر زیرمجموعه‌ای را انتخاب کنید.

## درخت تصمیم

```
Do you need a cloud service to do work outside this machine (Codex Cloud / Devin / Jules)?
├─ YES → Cloud Agents (POST /api/v1/agents/tasks)
└─ NO → Continue
    │
    Do you have a peer agent that speaks A2A and wants to collaborate?
    ├─ YES → A2A (POST /a2a)
    └─ NO → Continue
        │
        Do you need to list / configure CLI coding agents installed locally?
        ├─ YES → ACP (GET /api/acp/agents)
        └─ NO → Use plain /v1/chat/completions
```

## 1. A2A — Agent-to-Agent

**Spec:** [A2A v0.3](https://a2a-protocol.org)
**endpoint مربوط به RouteChi:** `POST /a2a` (JSON-RPC 2.0)
**Agent Card:** `GET /.well-known/agent.json`

### زمان استفاده

- ساخت یک سیستم چندعاملی که RouteChi یکی از همتایان است
- در معرض قرار دادن هوش routing مربوط به RouteChi (smart-routing، مدیریت سهمیه و غیره) برای عامل‌هایی در فریم‌ورک‌هایی مثل Google ADK یا meshهای عمومی عامل
- پوشاندن RouteChi پشت یک سطح کشف + فراخوانی استاندارد

### متدها

- `message/send` — ارسال یک پیام، دریافت پاسخ همگام
- `message/stream` — ارسال + دریافت رویدادهای پیشرفت SSE-streamed
- `tasks/get` — خواندن task بر اساس ID
- `tasks/cancel` — لغو یک task در حال اجرا

### مهارت‌های داخلی (6)

- `smart-routing` — هدایت یک prompt از طریق combo بهینه
- `quota-management` — گزارش وضعیت سهمیه به ازای هر provider
- `provider-discovery` — فهرست providerهای نصب‌شده با قابلیت‌ها
- `cost-analysis` — برآورد هزینه‌ی یک درخواست/مکالمه
- `health-report` — تجمیع وضعیت breaker/cooldown/lockout به ازای هر provider
- `list-capabilities` — شمارش مهارت‌ها و متادیتای در دسترس عامل

### بررسی عمیق

برای جزئیات ترنسپورت، ساختار agent card، پیکربندی TTL task و الگو برای افزودن مهارت‌های جدید به [A2A-SERVER.md](./A2A-SERVER.md) مراجعه کنید.

## 2. ACP — رجیستری عامل‌های CLI

**endpoint مربوط به RouteChi:** `GET /api/acp/agents`
**منبع:** `src/lib/acp/{index,manager,registry}.ts`

### چیست

ACP **فهرست عامل‌های CLI محلی** RouteChi است. این ماژول تشخیص می‌دهد کدام CLIهای کدنویسی روی میزبان نصب شده‌اند (Cursor، Cline، Claude Code، Codex CLI، Continue و غیره)، نسخه‌های آن‌ها را resolve کرده و در داشبورد نمایش می‌دهد تا کاربر بتواند هر CLI را به‌سمت RouteChi هدایت کند.

این یک پروتکل خارجی **نیست** — یک رجیستری داخلی است که رابط کاربری "CLI Tools" و پیگیری fingerprint مربوط به CLI را راه می‌اندازد (به [CLI-TOOLS.md](../reference/CLI-TOOLS.md) مراجعه کنید).

### چه می‌کند

- probing میزبان برای باینری‌های CLI نصب‌شده (از `which` / `where` بر اساس OS استفاده می‌کند)
- خواندن نسخه‌ی هر CLI (فراخوانی `<bin> --version`)
- اختیاری پذیرفتن عامل‌های سفارشی تعریف‌شده توسط کاربر (مسیر باینری + probing نسخه + spawn args)
- ماندگاری عامل‌های سفارشی در تنظیمات
- بازگرداندن فهرست یکپارچه به داشبورد

### REST API

| Endpoint          | Method | توضیحات                                                    | احراز هویت |
| ----------------- | ------ | ---------------------------------------------------------- | ---------- |
| `/api/acp/agents` | GET    | فهرست عامل‌های تشخیص‌داده‌شده + سفارشی (شمارش نصب‌شده/کل) | API key    |
| `/api/acp/agents` | POST   | افزودن/به‌روزرسانی/حذف عامل سفارشی (افعال متمایزکننده در بدنه) | API key    |

شکل بدنه برای POST (`customAgentBodySchema` در `src/app/api/acp/agents/route.ts`):

```json
{
  "action": "add|update|remove",
  "id": "cursor",
  "name": "Cursor",
  "binary": "/usr/local/bin/cursor",
  "versionCommand": "--version",
  "providerAlias": "cursor",
  "spawnArgs": ["--api-base", "http://localhost:20128"],
  "protocol": "stdio"
}
```

### موارد استفاده

- صفحه‌ی "CLI Tools" در داشبورد فهرستی از نصب‌شده‌ها را نشان داده و به شما کمک می‌کند هر کدام را به‌سمت RouteChi هدایت کنید
- عامل‌های سفارشی به کاربران قدرتمند اجازه می‌دهد CLIهای داخلی/اختصاصی که RouteChi به‌طور پیش‌فرض نمی‌شناسد را ثبت کنند
- نتیجه‌ی تشخیص، ماتریس fingerprint مربوط به `cli-tools` را تغذیه می‌کند

### چه زمان از ACP استفاده نکنید

- ACP taskها را _اجرا_ نمی‌کند. فقط CLIها را تشخیص + پیکربندی می‌کند. برای فراخوانی واقعی یک CLI، آن را خودتان با متغیرهای محیطی که RouteChi ارائه می‌کند (`OPENAI_BASE_URL`، `OPENAI_API_KEY` و غیره) راه‌اندازی کنید.

## 3. Cloud Agents

**endpointهای مربوط به RouteChi:** `/api/v1/agents/tasks/*` (چرخه‌حیات) + `/api/cloud/*` (plumbing)
**منبع:** `src/lib/cloudAgent/`

### چیست

یک رابط یکنواخت روی عامل‌های کدنویسی ابری شخص ثالث. یک prompt + URL repo ارسال می‌کنید، RouteChi به عامل ابری مناسب dispatch کرده، وضعیت را poll می‌کند، نتایج را برمی‌گرداند.

### عامل‌های پشتیبانی‌شده (3، همگی در `src/lib/cloudAgent/agents/` تأیید شده)

- `codex-cloud` — OpenAI Codex Cloud
- `devin` — Cognition Devin
- `jules` — Google Jules

### چرخه‌حیات

```
POST /api/v1/agents/tasks
  → BaseAgent.createTask() per agent class
  → external service starts work
  → task row created in DB (cloud_agent_tasks)
  ↓
GET /api/v1/agents/tasks/[id]
  → lazy status sync from provider
  → returns current status + plan + activity log
  ↓
POST /api/v1/agents/tasks/[id]   (action: "approve" | "message" | "cancel")
  → forwards to provider (or marks cancelled locally)
  ↓
DELETE /api/v1/agents/tasks/[id]
  → local cancel
```

### احراز هویت

⚠️ **همه‌ی endpointهای `/api/v1/agents/tasks/*` نیازمند احراز هویت مدیریتی هستند** (commit `588a0333`). فراخوان‌کننده‌های فقط-Bearer از نسخه‌ی v3.8.0 کد 401 دریافت می‌کنند.

### بررسی عمیق

برای قرارداد `CloudAgentBase`، جزئیات به ازای هر عامل، جزئیات schema و endpointهای plumbing مربوط به credential به [CLOUD_AGENT.md](./CLOUD_AGENT.md) مراجعه کنید.

## مقایسه: A2A در برابر Cloud Agents

هر دو "task طولانی‌مدت" دارند اما در لایه‌های متفاوت:

| جنبه             | A2A                                                                               | Cloud Agents                             |
| ----------------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| استاندارد         | A2A v0.3 باز                                                                       | اختصاصی RouteChi                         |
| محل اجرای محاسبات | داخل RouteChi (از comboهای پیکربندی‌شده استفاده می‌کند)                            | خارجی (سرورهای Codex / Devin / Jules)    |
| مدت task          | TTL پیش‌فرض ۵ دقیقه (قابل پیکربندی در `TaskManager`)                              | از چند دقیقه تا چند ساعت                  |
| آگاه از repo      | خیر (فقط prompt ارسال می‌کند)                                                      | بله (URL repo + branch)                  |
| مورد استفاده      | همکاری بین‌عاملی، smart routing به‌عنوان سرویس                                    | تفویض "feature X را در repo Y پیاده کن" |
| احراز هویت        | `OMNIROUTE_API_KEY` اختیاری برای `/a2a`؛ مدیریت برای helperهای REST `/api/a2a/*` | همیشه مدیریت                             |

## نمونه‌های یکپارچه‌سازی

### کشف قابلیت‌های A2A مربوط به RouteChi

```bash
curl http://localhost:20128/.well-known/agent.json
```

Agent Card را با همه‌ی ۵ مهارت، ترنسپورت‌ها و نسخه برمی‌گرداند.

### فراخوانی RouteChi به‌عنوان یک عامل A2A

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "messages": [{"role": "user", "content": "Route this prompt"}],
      "skillId": "smart-routing"
    },
    "id": 1
  }'
```

### فهرست عامل‌های CLI نصب‌شده از طریق ACP

```bash
curl http://localhost:20128/api/acp/agents \
  -H "Authorization: Bearer <api-key>"
```

### افزودن یک عامل CLI سفارشی

```bash
curl -X POST http://localhost:20128/api/acp/agents \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "id": "my-custom-cli",
    "name": "My Custom CLI",
    "binary": "/opt/mycli/bin/mycli",
    "versionCommand": "--version",
    "providerAlias": "openai"
  }'
```

### ارسال یک task مربوط به Cloud Agent

```bash
curl -X POST http://localhost:20128/api/v1/agents/tasks \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "devin",
    "prompt": "Implement feature X in repo Y",
    "repo": "https://github.com/user/repo",
    "branch": "main"
  }'
```

### poll وضعیت task ابری

```bash
curl http://localhost:20128/api/v1/agents/tasks/<task-id> \
  -H "Cookie: auth_token=..."
```

## چه زمان از چه چیزی استفاده کنید

- **فرانت‌اند چت‌بات / copilot** → `/v1/chat/completions` (سازگار با OpenAI — یک پروتکل عامل نیست)
- **همکاری چندعاملی** → A2A
- **فهرست کردن CLIهای محلی در داشبورد** → ACP
- **تفویض taskهای کدنویسی طولانی‌مدت به سرویس‌های ابری** → Cloud Agents

## معماری داخلی

```
                ┌─────────────────────┐
                │   RouteChi Core     │
                └─────────────────────┘
                  ↑       ↑        ↑
        ┌─────────┘       │        └─────────┐
        │                 │                  │
    ┌───────┐        ┌─────────┐       ┌────────────┐
    │  A2A  │        │   ACP   │       │  Cloud     │
    │ (/a2a)│        │ (/acp)  │       │  Agents    │
    └───────┘        └─────────┘       │ (/v1/agents│
        │                 │            │  /tasks)   │
        ↓                 ↓            └────────────┘
   External peer    Local CLI               │
   agents that      binaries on             ↓
   speak A2A v0.3   the host           Codex Cloud,
                                        Devin, Jules
```

## همچنین ببینید

- [A2A-SERVER.md](./A2A-SERVER.md) — بررسی عمیق A2A
- [CLOUD_AGENT.md](./CLOUD_AGENT.md) — بررسی عمیق Cloud Agents
- [CLI-TOOLS.md](../reference/CLI-TOOLS.md) — یکپارچه‌سازی‌های CLI خارجی (از ACP استفاده می‌کند)
- [SKILLS.md](./SKILLS.md) — فریم‌ورک مهارت‌ها (متفاوت از مهارت‌های A2A — sandbox اجرای محلی)
- [API_REFERENCE.md](../reference/API_REFERENCE.md#agents-protocol) — مرجع endpoint
- منبع: `src/lib/{a2a,acp,cloudAgent}/`
