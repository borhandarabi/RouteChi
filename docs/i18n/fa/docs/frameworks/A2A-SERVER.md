---
title: "مستندات سرور A2A ی RouteChi"
version: 3.8.40
lastUpdated: 2026-06-28
---

# مستندات سرور A2A ی RouteChi

> پروتکل Agent-to-Agent نسخه‌ی v0.3 — RouteChi به‌عنوان یک عامل مسیریابی هوشمند

سطح A2A دو چهره دارد:

- **JSON-RPC 2.0** در `POST /a2a` (نقطه‌ی ورود کانونیکال، تعریف‌شده در `src/app/a2a/route.ts`).
- **REST** تحت `/api/a2a/*` برای داشبوردها و ابزارها (وضعیت، فهرست وظایف، لغو).

وظایف توسط `A2ATaskManager` (`src/lib/a2a/taskManager.ts`، TTL پیش‌فرض ۵ دقیقه) ردیابی می‌شوند. مهارت‌ها از طریق `A2A_SKILL_HANDLERS` در `src/lib/a2a/taskExecution.ts` اعزام می‌شوند.

## کشف عامل

```bash
curl http://localhost:20128/.well-known/agent.json
```

Agent Card را برمی‌گرداند که قابلیت‌ها، مهارت‌ها و الزامات احراز هویت RouteChi را توصیف می‌کند.

فیلد `version` ی Agent Card از `process.env.npm_package_version` تامین می‌شود (به `src/app/.well-known/agent.json/route.ts:13` مراجعه کنید)، بنابراین در هر انتشار با `package.json` به‌صورت خودکار همگام می‌ماند.

---

## احراز هویت

همه‌ی درخواست‌های `/a2a` نیازمند یک کلید API از طریق هدر `Authorization` هستند:

```
Authorization: Bearer YOUR_OMNIROUTE_API_KEY
```

اگر هیچ کلید API روی سرور پیکربندی نشده باشد، احراز هویت دور زده می‌شود.

## فعال‌سازی

A2A توسط کلید **Endpoints → A2A** کنترل می‌شود و به‌صورت پیش‌فرض غیرفعال است. هنگام غیرفعال بودن،
`GET /api/a2a/status` مقدار `status: "disabled"` و `online: false` گزارش می‌دهد؛ فراخوانی‌های JSON-RPC به
`POST /a2a` با کد خطای JSON-RPC ی `-32000` HTTP 503 برمی‌گردانند.

---

## متدهای JSON-RPC 2.0

### `message/send` — اجرای همگام

یک پیام به یک مهارت ارسال می‌کند و منتظر پاسخ کامل می‌ماند.

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "skill": "smart-routing",
      "messages": [{"role": "user", "content": "Write a hello world in Python"}],
      "metadata": {"model": "auto", "combo": "fast-coding"}
    }
  }'
```

**پاسخ:**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "task": { "id": "uuid", "state": "completed" },
    "artifacts": [{ "type": "text", "content": "..." }],
    "metadata": {
      "routing_explanation": "Selected claude-sonnet via provider \"anthropic\" (latency: 1200ms, cost: $0.003)",
      "cost_envelope": { "estimated": 0.005, "actual": 0.003, "currency": "USD" },
      "resilience_trace": [
        { "event": "primary_selected", "provider": "anthropic", "timestamp": "..." }
      ],
      "policy_verdict": { "allowed": true, "reason": "within budget and quota limits" }
    }
  }
}
```

### `message/stream` — استریم SSE

مانند `message/send` اما Server-Sent Events را برای استریم در زمان واقعی برمی‌گرداند.

```bash
curl -N -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/stream",
    "params": {
      "skill": "smart-routing",
      "messages": [{"role": "user", "content": "Explain quantum computing"}]
    }
  }'
```

**رویدادهای SSE:**

```
data: {"jsonrpc":"2.0","method":"message/stream","params":{"task":{"id":"...","state":"working"},"chunk":{"type":"text","content":"..."}}}

: heartbeat 2026-03-03T17:00:00Z

data: {"jsonrpc":"2.0","method":"message/stream","params":{"task":{"id":"...","state":"completed"},"metadata":{...}}}
```

### `tasks/get` — جستجوی وضعیت وظیفه

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tasks/get","params":{"taskId":"TASK_UUID"}}'
```

### `tasks/cancel` — لغو یک وظیفه

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":"3","method":"tasks/cancel","params":{"taskId":"TASK_UUID"}}'
```

---

## مهارت‌های موجود

RouteChi ۶ مهارت A2A افشا می‌کند که در `src/lib/a2a/taskExecution.ts::A2A_SKILL_HANDLERS` متصل شده‌اند. هر ماژول مهارت در `src/lib/a2a/skills/` قرار دارد.

| Skill              | ID                   | Description                                                                                                     | Tags                       | Examples                               |
| :----------------- | :------------------- | :-------------------------------------------------------------------------------------------------------------- | :------------------------- | :------------------------------------- |
| Smart Routing      | `smart-routing`      | Routes a prompt through the optimal provider/combo using RouteChi's combo engine + scoring                     | routing, providers         | "Route this prompt via the best model" |
| Quota Management   | `quota-management`   | Reports per-provider quota state, helps callers decide when to throttle/switch                                  | quota, providers           | "Check quota for anthropic"            |
| Provider Discovery | `provider-discovery` | Lists installed providers with capabilities, free-tier flags, OAuth status                                      | providers, discovery       | "What providers are available?"        |
| Cost Analysis      | `cost-analysis`      | Estimates cost of a request/conversation given the catalog + recent usage                                       | cost, usage                | "Estimate cost for this conversation"  |
| Health Report      | `health-report`      | Aggregates circuit breaker, cooldown, lockout state per provider                                                | health, resilience         | "Show health status of all providers"  |
| List Capabilities  | `list-capabilities`  | Returns the full 42-entry Agent Skills catalog as a markdown table with raw SKILL.md URLs for context injection | catalog, discovery, skills | "List all RouteChi capabilities"      |

> نکته: توصیف Agent Card در حال حاضر «36+ providers» را تبلیغ می‌کند (`src/app/.well-known/agent.json/route.ts:26` و `:55`). فهرست واقعی به ۱۸۰+ پروایدر رشد کرده است — این رشته باید در یک تغییر پیگیری‌شده به‌روزرسانی شود (به‌عنوان یک TODO جداگانه‌ی مستند/کد پیگیری شده؛ در اینجا تغییر نکرده است).

### جزئیات مهارت `list-capabilities`

مهارت `list-capabilities` به‌ویژه برای عامل‌های خارجی که نیاز دارند پیش از ارسال فراخوانی‌های API بدانند RouteChi چه چیزی افشا می‌کند، مفید است. یک آرتیفکت جدول markdown ساختاریافته برمی‌گرداند:

```
| ID | Name | Category | Area | Endpoints/Commands | Raw URL |
| --- | --- | --- | --- | --- | --- |
| omni-auth | Auth & Sessions | api | auth | POST /api/auth/login, ... | https://raw.githubusercontent.com/... |
...
```

هر ردیف شامل ستون `rawUrl` است تا عامل‌ها بتوانند بلافاصله SKILL.md کامل را دریافت کنند. فیلد `metadata.totalSkills` همواره `42` است. پیاده‌سازی: `src/lib/a2a/skills/listCapabilities.ts`. همچنین به [AGENT-SKILLS.md](./AGENT-SKILLS.md) مراجعه کنید.

---

## REST API (کمکی)

نقطه‌ی پایانی JSON-RPC ی `/a2a` نقطه‌ی ورود کانونیکال A2A است. نقاط پایانی REST زیر دسترسی کمکی برای داشبوردها و ابزارهای خارجی فراهم می‌کنند:

| Endpoint                     | Method | Description                      | Auth                   |
| :--------------------------- | :----- | :------------------------------- | :--------------------- |
| `/api/a2a/status`            | GET    | Server status, registered skills | (public)               |
| `/api/a2a/tasks`             | GET    | List tasks with filters          | management             |
| `/api/a2a/tasks/[id]`        | GET    | Get task by ID                   | management             |
| `/api/a2a/tasks/[id]/cancel` | POST   | Cancel running task              | management             |
| `/.well-known/agent.json`    | GET    | Agent Card (A2A discovery)       | (public, cached 3600s) |

---

## افزودن یک مهارت جدید

1. **ایجاد فایل مهارت:** `src/lib/a2a/skills/<your-skill>.ts`

   یک تابع async `(task: A2ATask) => Promise<{ artifacts, metadata }>` صادر کنید. از شکل مهارت‌های موجود مانند `smartRouting.ts` پیروی کنید.

2. **ثبت هندلر:** در `src/lib/a2a/taskExecution.ts`، یک ورودی به `A2A_SKILL_HANDLERS` اضافه کنید:

   ```typescript
   export const A2A_SKILL_HANDLERS = {
     // ...existing skills
     "your-skill": async (task) => {
       const skillModule = await import("./skills/yourSkill");
       return skillModule.executeYourSkill(task);
     },
   };
   ```

3. **افشا در Agent Card:** در `src/app/.well-known/agent.json/route.ts`، به آرایه‌ی `skills` اضافه کنید:

   ```json
   {
     "id": "your-skill",
     "name": "Your Skill",
     "description": "Brief, intent-focused description",
     "tags": ["routing", "quota"],
     "examples": ["Sample natural-language invocation"]
   }
   ```

4. **نوشتن تست‌ها:** `tests/unit/a2a-<your-skill>.test.ts`. مسیر خوش‌‌آتیه + مسیر خطا را پوشش دهید.

5. **مستندسازی** مهارت جدید در جدول `Available Skills` این فایل.

---

## TTL ی وظیفه

وظایف پس از `ttlMinutes` (پیش‌فرض ۵ دقیقه) منقضی می‌شوند — در سازنده‌ی `A2ATaskManager` در `src/lib/a2a/taskManager.ts:82` پیکربندی شده است. برای سفارشی‌سازی، instantiation ی `A2ATaskManager` را fork کنید و یک مقدار متفاوت ارسال کنید (مثلاً `new A2ATaskManager(15)` برای TTL ی ۱۵ دقیقه‌ای). یک بازه‌ی پس‌زمینه وظایف منقضی‌شده را هر ۶۰ ثانیه پاک می‌کند.

---

## چرخه‌ی حیات وظیفه

```
submitted → working → completed
                    → failed
                    → cancelled
```

- وظایف پس از ۵ دقیقه به‌صورت پیش‌فرض منقضی می‌شوند (به [Task TTL](#task-ttl) مراجعه کنید)
- وضعیت‌های پایانی: `completed`، `failed`، `cancelled`
- log ی رویداد هر انتقال وضعیت را ردیابی می‌کند

---

## کدهای خطا

| Code   | Meaning                        |
| :----- | :----------------------------- |
| -32700 | Parse error (invalid JSON)     |
| -32600 | Invalid request / Unauthorized |
| -32601 | Method or skill not found      |
| -32602 | Invalid params                 |
| -32603 | Internal error                 |
| -32000 | A2A endpoint is disabled       |

---

## نمونه‌های یکپارچه‌سازی

### Python (requests)

```python
import requests

resp = requests.post("http://localhost:20128/a2a", json={
    "jsonrpc": "2.0", "id": "1",
    "method": "message/send",
    "params": {
        "skill": "smart-routing",
        "messages": [{"role": "user", "content": "Hello"}]
    }
}, headers={"Authorization": "Bearer YOUR_KEY"})

result = resp.json()["result"]
print(result["artifacts"][0]["content"])
print(result["metadata"]["routing_explanation"])
```

### TypeScript (fetch)

```typescript
const resp = await fetch("http://localhost:20128/a2a", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer YOUR_KEY",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "1",
    method: "message/send",
    params: {
      skill: "smart-routing",
      messages: [{ role: "user", content: "Hello" }],
    },
  }),
});
const { result } = await resp.json();
console.log(result.metadata.routing_explanation);
```
