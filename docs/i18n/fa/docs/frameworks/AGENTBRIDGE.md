---
title: "AgentBridge"
version: 3.8.40
lastUpdated: 2026-06-28
---

# AgentBridge

AgentBridge پراکسی MITM (Man-in-the-Middle) ی RouteChi است که ترافیک HTTPS از عامل‌های هوش مصنوعی IDE را قطع کرده و آن را از طریق موتور مسیریابی یکپارچه‌ی RouteChi مسیریابی مجدد می‌کند. این پراکسی از **۹ عامل IDE** پشتیبانی می‌کند — Antigravity، Kiro، GitHub Copilot، OpenAI Codex، Cursor، Zed، Claude Code، Open Code و Trae (در حال بررسی) — که RouteChi را به گسترده‌ترین‌پوشش پراکسی MITM برای دستیاران کدنویسی هوش مصنوعی در بازار تبدیل می‌کند.

**محل داشبورد:** `/dashboard/tools/agent-bridge`
**گروه نوار کناری:** Tools (پس از Cloud Agents)
**همچنین ببینید:** [`TRAFFIC_INSPECTOR.md`](./TRAFFIC_INSPECTOR.md) — نظارت بر همه‌ی ترافیک قطع‌شده در زمان واقعی؛ [`docs/security/MITM-TPROXY-DECRYPT.md`](../security/MITM-TPROXY-DECRYPT.md) — حالت capture ی transparent-decrypt ی Linux TPROXY که توسط مسیر `/api/tools/agent-bridge/tproxy` هدایت می‌شود.

---

## §1 مرور کلی

### AgentBridge چیست؟

هنگامی که یک عامل IDE (مثلاً GitHub Copilot، Cursor، Claude Code) یک فراخوانی API انجام می‌دهد، مستقیماً به پروایدر هوش مصنوعی upstream (OpenAI، Anthropic و غیره) متصل می‌شود. AgentBridge آن اتصال را به‌صورت شفاف در سطح TLS قطع می‌کند — بدون نیاز به هیچ تغییری در پیکربندی عامل — و درخواست را از طریق RouteChi بازنویسی می‌کند.

این بدان معناست که می‌توانید:

- **مسیریابی مجدد هر عامل به هر پروایدر**: Copilot با OpenAI صحبت می‌کند؟ آن را به Anthropic Claude، Gemini یا هر یک از ۲۲۶+ پروایدر RouteChi هدایت مجدد کنید.
- **اعمال نگاشت مدل‌ها**: `gemini-3-flash` → `claude-sonnet-4.7` به‌صورت شفاف در سطح هندلر.
- **مشاهده‌ی همه‌ی ترافیک عامل**: هر درخواست قطع‌شده به [Traffic Inspector](./TRAFFIC_INSPECTOR.md) منتشر می‌شود.
- **اعمال تاب‌آوری RouteChi**: مسیریابی combo، circuit breakerها، fallbackها و ردیابی هزینه برای ترافیک عامل IDE نیز کار می‌کنند.

### موقعیت‌یابی در برابر بازار

| Feature           | 9router | anti-api | llm-interceptor | **RouteChi AgentBridge** |
| ----------------- | :-----: | :------: | :-------------: | :-----------------------: |
| Antigravity       |    ✓    |    ✓     |        —        |             ✓             |
| GitHub Copilot    |    ✓    |    ✓     |        —        |             ✓             |
| Kiro (AWS)        |    ✓    |    ✓     |        —        |             ✓             |
| OpenAI Codex      |    —    |    ✓     |        —        |             ✓             |
| Cursor IDE        |    ✓    |    ✓     |        —        |             ✓             |
| Zed Industries    |    —    |    ✓     |        —        |             ✓             |
| Claude Code       |    —    |    —     |        ✓        |             ✓             |
| Open Code         |    —    |    —     |        ✓        |             ✓             |
| Trae              |    —    |    —     |        —        |     🔍 Investigating      |
| Dashboard UI      |    ✓    |    ✗     |        ✗        |             ✓             |
| Traffic Inspector |    ✗    |    ✗     |        ✓        |             ✓             |
| RouteChi routing |    ✗    |    ✗     |        ✗        |             ✓             |
| Model mapping UI  |    ✗    |    ✗     |        ✗        |             ✓             |
| Bypass list       |    ✗    |    ✗     |        ✓        |             ✓             |
| Upstream CA cert  |    ✗    |    ✗     |        ✓        |             ✓             |

---

## §2 معماری

### ۲.۱ مرور اجزا

```
IDE Agent (VS Code / Cursor / etc.)
    │  HTTPS (port 443)
    ▼
/etc/hosts — 127.0.0.1 api.githubcopilot.com   ← DNS redirect
    │
    ▼
src/mitm/server.cjs  (port 443, CJS child process)
    │  resolves target by Host header SNI
    │  generates per-SNI TLS cert signed by AgentBridge CA
    ├── Bypass list match? → TCP passthrough (no decrypt)
    ├── Target match? → fetch → OmniRoute router (port 20128)
    │       └── handler.intercept() — TypeScript
    │               ├── maskSecrets() on request body/headers
    │               ├── TrafficBuffer.push() — publishes to Traffic Inspector
    │               └── fetchRouter() → /v1/chat/completions
    └── No match? → TCP passthrough (no decrypt)
```

### ۲.۲ سرور MITM (`src/mitm/server.cjs`)

سرور MITM هسته‌ای به‌عنوان یک فرآیند فرزند CJS ی Node.js اجرا می‌شود (برای جلوگیری از بازنویسی codebase ی CJS موجود). این سرور:

- روی پورت ۴۴۳ گوشت می‌دهد (نیازمند امتیاز یا `authbind`/`setcap`)
- تونل‌های CONNECT را از OS دریافت می‌کند (از طریق redirect ی DNS ی `/etc/hosts`)
- گواهی‌های TLS به‌ازای‌هر‌SNI امضاشده‌توسط CA ی AgentBridge تولید می‌کند (`DATA_DIR/mitm/ca.crt`)
- target عامل را بر اساس هدر Host از طریق رجیستری `targets/index.ts` تفکیک می‌کند
- به لایه‌ی هندلر TypeScript از طریق HTTP به `http://127.0.0.1:20128` اعزام می‌کند

`TARGET_HOSTS` از `DATA_DIR/mitm/targets.json` (نوشته‌شده توسط `targets/index.ts` در زمان بوت) بارگذاری می‌شود، که به‌روزرسانی‌های پویا را بدون راه‌اندازی مجدد سرور CJS ممکن می‌سازد.

### ۲.۳ پایه‌ی هندلر (`src/mitm/handlers/base.ts`)

همه‌ی هندلرهای عامل `MitmHandlerBase` را گسترش می‌دهند:

```ts
export abstract class MitmHandlerBase {
  abstract readonly agentId: AgentId;

  abstract intercept(
    req: IncomingMessage,
    res: ServerResponse,
    body: Buffer,
    mappedModel: string
  ): Promise<void>;

  // Protected helpers: fetchRouter, pipeSSE, hookBufferStart, hookBufferUpdate
}
```

هر هندلر پیش از پروکسی‌کردن `hookBufferStart()` و هنگام تکمیل `hookBufferUpdate()` را فراخوانی می‌کند. این توابع ورودی‌های `InterceptedRequest` را در `globalTrafficBuffer` قرار می‌دهند (به [Traffic Inspector](./TRAFFIC_INSPECTOR.md) §4 مراجعه کنید).

### ۲.۴ رجیستری targetها (`src/mitm/targets/`)

هر عامل یک فایل target اعلانی دارد:

```ts
// src/mitm/targets/copilot.ts
export const COPILOT_TARGET: MitmTarget = {
  id: "copilot",
  name: "GitHub Copilot",
  hosts: ["api.githubcopilot.com", "copilot-proxy.githubusercontent.com"],
  port: 443,
  endpointPatterns: ["/chat/completions", "/v1/chat/completions"],
  defaultModels: [{ id: "gpt-4o", name: "GPT-4o", alias: "gpt-4o" }],
  handler: () => import("../handlers/copilot"),
  riskNoticeKey: "providers.riskNotice.oauth",
};
```

رجیستری (`targets/index.ts`) `ALL_TARGETS` را صادر می‌کند و `DATA_DIR/mitm/targets.json` را در زمان بوت تولید می‌کند.

### ۲.۵ Passthrough و فهرست bypass (`src/mitm/passthrough.ts`)

**فهرست bypass** (اول بررسی می‌شود، با تقدم بر تطبیق target):

- الگوهای پیش‌فرض: هاست‌های بانکی، `.gov.`، پروایدرهای OAuth/SSO (Okta، Auth0) و غیره.
- الگوهای کاربر: در جدول DB ی `agent_bridge_bypass` ذخیره می‌شوند
- هاست‌های bypass‌شده یک تونل TCP شفاف دریافت می‌کنند — TLS **هرگز رمزگشایی نمی‌شود**

**پیش‌فرض Passthrough** (بدون تطبیق target و در فهرست bypass نیست):

- همچنین یک تونل TCP دریافت می‌کند — اتصال‌ها هرگز قطع نمی‌شوند
- از قطع کردن ترافیک HTTPS عمومی سیستم توسط AgentBridge جلوگیری می‌کند

تقدم مسیریابی:

```
bypass list → target match → passthrough
```

### ۲.۶ گواهی CA ی upstream (`src/mitm/upstreamTrust.ts`)

برای محیط‌های شبکه‌ی شرکتی با CA ی سفارشی:

```bash
AGENTBRIDGE_UPSTREAM_CA_CERT=/path/to/corporate-ca.pem
```

هنگام تنظیم، dispatcher ی سراسری `undici` را با گواهی CA ی اضافی پیکربندی می‌کند، که به AgentBridge اجازه می‌دهد از طریق پروکسی‌های خاتمه‌ی TLS ی شرکتی به پروایدرهای upstream برسد.

### ۲.۷ نقاب‌کردن اسرار (`src/mitm/maskSecrets.ts`)

اعمال‌شده بر همه‌ی بدنه‌ها و هدرهای درخواست **پیش از** ورود به بافر Traffic Inspector یا هر log:

- توکن‌های دارای پیشوند `sk-` / `ak-` / `pk-` (سبک OpenAI/Anthropic)
- هدرهای `Authorization: Bearer <token>`
- توکن‌های عمومی طولانی (≥۴۰ کاراکتر)

---

## §3 راه‌اندازی

### ۳.۱ شروع/توقف سرور MITM

از AgentBridge Server Card در `/dashboard/tools/agent-bridge` استفاده کنید:

| Action          | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| Start Server    | Spawns `src/mitm/server.cjs` on port 443                                |
| Stop Server     | Gracefully shuts down the child process                                 |
| Restart Server  | Stop + start (picks up target changes)                                  |
| Trust Cert      | Installs `DATA_DIR/mitm/ca.crt` into OS trust store                     |
| Download Cert   | Downloads `ca.crt` for manual installation                              |
| Regenerate Cert | Creates a new CA keypair (all existing per-agent certs are invalidated) |

### ۳.۲ اعتماد به گواهی

گواهی CA ی AgentBridge باید پیش از آنکه IDEها اتصال MITM را بپذیرند توسط OS مورد اعتماد قرار گیرد.

**Linux (NSS — Chrome/Firefox):**

```bash
certutil -A -d sql:$HOME/.pki/nssdb -n "OmniRoute AgentBridge" -t CT,, -i ~/.omniroute/mitm/ca.crt
```

**macOS (Keychain):**

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ~/.omniroute/mitm/ca.crt
```

**Windows (certmgr):**

```powershell
certutil -addstore -f Root $env:USERPROFILE\.omniroute\mitm\ca.crt
```

یا از دکمه‌ی «Trust Cert» در داشبورد استفاده کنید (فرمان مناسب برای OS شما را اجرا می‌کند، با درخواست sudo در صورت نیاز).

#### IDEهای مبتنی‌بر Electron از فروشگاه اعتماد OS چشم‌پوشی می‌کنند (`NODE_EXTRA_CA_CERTS`)

برخی IDEها — به‌ویژه **Antigravity IDE** و سایر اپ‌های مبتنی‌بر Electron / VS Code —
runtime ی Node.js خود را بسته‌بندی می‌کنند که برای `fetch`/HTTPS خروجی **به فروشگاه اعتماد OS مراجعه نمی‌کند**.
اعتماد به CA در سطح OS/NSS برای backend ی بومی IDE (مثلاً یک language server ی Go، که از
بسته‌ی CA ی OS استفاده می‌کند) کافی است، اما **frontend ی Electron** همچنان
در TLS شکست خواهد خورد — این به‌صورت _logged out_ بودن اپ یا نمایش _"connection error"_
ظاهر می‌شود با اینکه log ی MITM فراخوانی‌های bootstrap ی backend را با کد `200` برمی‌گرداند.
دو مرحله لازم است و هر دو مهم هستند:

1. runtime را به‌صورت صریح به CA اشاره دهید:
   ```bash
   export NODE_EXTRA_CA_CERTS=/path/to/omniroute-agentbridge-ca.crt
   ```
2. **IDE را از آن shell اجرا کنید.** اجرای آن از آیکن دسکتاپ / Dock / Start menu
   exportهای shell را به ارث نمی‌برد، و `~/.config/environment.d/*.conf` تنها پس از
   یک ورود گرافیکی تازه اعمال می‌شود. ابتدا IDE را کاملاً ببندید — singleton lock ی Electron
   بدان معناست که اجرای دوم تنها پروسه‌ی موجود را focus می‌کند و محیط جدید نادیده گرفته می‌شود.

مرحله‌ی OS-trust + NSS بالا همچنان ضروری است (stack شبکه‌ی Chromium که توسط برخی
جریان‌های auth استفاده می‌شود فروشگاه NSS به‌ازای‌کاربر را می‌خواند، و pinهای استاتیک خود را برای
`*.googleapis.com` دارد که یک CA ی محلی‌مورد‌اعتماد آن را بازنویسی می‌کند). `NODE_EXTRA_CA_CERTS`
مسیر `fetch` ی Node را بر فراز آن پوشش می‌دهد.

### ۳.۳ مسیریابی DNS

برای هر عاملی که می‌خواهید قطع کنید، هاست(های) API آن باید به `127.0.0.1` تفکیک شوند. AgentBridge ورودی‌های `/etc/hosts` را هنگامی که DNS را برای یک عامل در Setup Wizard فعال می‌کنید به‌صورت خودکار مدیریت می‌کند.

نمونه‌ی ورودی‌های `/etc/hosts` برای GitHub Copilot:

```
127.0.0.1 api.githubcopilot.com
127.0.0.1 copilot-proxy.githubusercontent.com
```

### ۳.۴ نگاشت مدل

از جدول Model Mapping در هر کارت عامل برای تعریف نگاشت‌های source → target استفاده کنید:

| Source model (agent native) | Target model (RouteChi) |
| --------------------------- | ------------------------ |
| `gpt-4o`                    | `claude-sonnet-4.7`      |
| `*` (wildcard)              | `claude-haiku-4.7`       |

Wildcard ی `*` هر مدل شناسایی‌نشده‌ای را به target مشخص‌شده نگاشت می‌کند. در جدول `agent_bridge_mappings` ذخیره می‌شود.

> **نکته — شناسایی شناسه‌های مدل واقعی عامل.** ممکن است یک IDE نام‌های مدلی ارسال کند
> که با برچسب‌های UI آن متفاوت است و بین نسخه‌های اصلی تغییر می‌کند. مثلاً **Antigravity 2**
> `gemini-3.1-pro-low`، `gemini-pro-agent` و `gemini-3.1-flash-lite` را روی سیم ارسال می‌کند — نه
> `gemini-2.5-pro` نمایش‌داده‌شده در مستندهای قدیمی. یک چت بدون نگاشت منطبق ارسال کنید: MITM
> `model:` ورودی دقیق را log می‌کند و درخواست را عبور می‌دهد. آن مقدار تحت‌اللفظی را نگاشت کنید، سپس
> درخواست بعدی قطع شده و به target شما مسیریابی می‌شود.

### ۳.۵ اعلان ریسک

AgentBridge اعتبارنامه‌ها (توکن‌های OAuth، کلیدهای API) را که IDE برای احراز هویت با پروایدرهای upstream استفاده می‌کند، قطع می‌کند. این موارد **پیش از log‌کردن نقاب‌دار می‌شوند** (به §2.7 مراجعه کنید) اما برای لایه‌ی MITM ی RouteChi قابل‌مشاهده‌اند. اولین فعال‌سازی هر عامل یک مودال اعلان ریسک قابل‌ردکردن نمایش می‌دهد.

### ۳.۶ نگهداری و تشخیص

داشبورد یک کارت **Maintenance & Diagnostics** (`AgentBridgeMaintenanceCard`، در `src/app/(dashboard)/dashboard/tools/agent-bridge/components/`) افشا می‌کند که مسیرهای عملیاتی MITM را که پیش‌تر رابط کاربری نداشتند نمایش می‌دهد. زیرعنوان آن: _"خودآزمایی لوله‌ی capture، خنثی‌کردن وضعیت سیستم به‌جامانده، و انتقال راه‌اندازی خود بین ماشین‌ها."_ کمک‌کننده‌های کلاینت کارت در `src/lib/inspector/agentBridgeMaintenanceApi.ts` قرار دارند.

| Button            | Route                                  | What it does                                                                                                                                                                     |
| ----------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Diagnose**      | `GET /api/tools/agent-bridge/diagnose` | Runs the capture-pipeline self-test and shows a per-check report (✓/✗ + remediation hint).                                                                                       |
| **Repair**        | `POST /api/tools/agent-bridge/repair`  | Undoes orphaned MITM system state (DNS spoof entries, root CA, system proxy) left behind by a crash or SIGKILL. Idempotent — reports "Nothing to repair" when state is clean.    |
| **Remove CA**     | `DELETE /api/tools/agent-bridge/cert`  | Untrusts and removes the MITM root CA from the OS trust store (explicit, idempotent). Shown only when the CA is currently trusted; requires an inline "Remove CA?" confirmation. |
| **Export config** | `GET /api/tools/agent-bridge/config`   | Downloads the portable config JSON (see §3.7).                                                                                                                                   |
| **Import config** | `POST /api/tools/agent-bridge/config`  | Uploads a previously-exported config JSON (see §3.7).                                                                                                                            |

**بررسی‌های تشخیص** (`summarizeDiagnostics()` در `src/mitm/inspector/diagnostics.ts`). مسیر probe ی effectful را برای هر مورد اجرا می‌کند و مقادیر boolean را به summarizer ی خالص می‌ریزد؛ یک verdict ی `healthy` واحد به‌علاوه‌ی یک hint به‌ازای‌هرشکست برگردانده می‌شود:

| Check name         | What it verifies                                            | Hint on failure                                                                                                                        |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `server-running`   | The MITM server process is active                           | "The MITM server is not running. Start it from the AgentBridge tab."                                                                   |
| `server-reachable` | The MITM server accepts connections on its port (TCP probe) | "The MITM server is not accepting connections on its port. Check that the port is free and that you have privileges to bind it."       |
| `cert-exists`      | The MITM certificate has been generated on disk             | "No MITM certificate has been generated yet. Generate one from the AgentBridge tab."                                                   |
| `cert-trusted`     | The MITM root CA is in the OS trust store                   | "The MITM root CA is not trusted by the OS store, so TLS interception will fail. Trust the certificate from the AgentBridge tab."      |
| `dns-configured`   | Target hostnames are spoofed in `/etc/hosts`                | "Target hostnames are not spoofed in /etc/hosts, so traffic never reaches the proxy. Enable DNS for the agent(s) you want to capture." |

**بنر وضعیت یتیم:** هنگامی که صفحه وضعیت به‌جامانده از یک crash (DNS spoof / CA / system proxy) را تشخیص می‌دهد، کارت یک بنر کهربایی نمایش می‌دهد — _"یک نشست قبلی وضعیت سیستم را به‌جا گذاشته است (DNS spoof، CA یا system proxy). Repair را اجرا کنید تا پاک شود."_ — و دکمه‌ی **Repair** را برجسته می‌کند. `Repair` آنالوگ لایه‌ی اپلیکیشنِ پرچم `--cleanup` ی ProxyBridge است (به `repairMitm()` در `src/mitm/manager.ts` واگذار می‌کند).

> گواهی CA ی ریشه‌ی MITM میان stop/start نگه داشته می‌شود تا از درخواست‌های sudo ی
> مکرر جلوگیری شود (همان رفتار mitmproxy/Charles)، بنابراین حذف آن یک اکشن صریح
> **Remove CA** است نه چیزی که به‌صورت خودکار هنگام stop رخ می‌دهد.

### ۳.۷ وارد/صادرکردن پیکربندی قابل‌حمل

AgentBridge می‌تواند وضعیت **قابل‌تنظیم‌توسط‌اپراتور** را در یک blob ی JSON ی نسخه‌گذاری‌شده سریالایز کند تا یک راه‌اندازی بتواند بین ماشین‌ها تکثیر شود. سریالایزر `src/lib/inspector/configPortability.ts` (`exportConfig()` / `importConfig()`) است، که توسط `AgentBridgeConfigSchema` اعتبارسنجی می‌شود.

صادرات دقیقاً شامل سه بخش است (پیش‌فرض‌های داخلی عمداً **صادر نمی‌شوند**، تا واردکردن هرگز آن‌ها را تکثیر نکند یا با آن‌ها درگیری نکند):

| Field            | Source                                                    | Notes                                                                   |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `bypassPatterns` | user-defined bypass patterns (`agent_bridge_bypass`)      | default bank/gov/okta patterns are excluded                             |
| `customHosts`    | Traffic Inspector custom hosts (`inspector_custom_hosts`) | each: `{ host, kind: "llm"\|"app"\|"custom", label? }`                  |
| `agentMappings`  | per-agent model mappings (`agent_bridge_mappings`)        | `{ [agentId]: [{ source, target }] }` for every agent that has mappings |

```jsonc
// GET /api/tools/agent-bridge/config
{
  "version": 1,
  "bypassPatterns": ["*.internal.example.com"],
  "customHosts": [{ "host": "api.example.com", "kind": "llm", "label": null }],
  "agentMappings": { "copilot": [{ "source": "gpt-4o", "target": "claude-sonnet-4.7" }] },
}
```

**رفتار واردکردن** (`POST /api/tools/agent-bridge/config`): الگوهای bypass و نگاشت‌های به‌ازای‌عامل **به‌صورت کامل جایگزین** می‌شوند؛ هاست‌های سفارشی به‌صورت **idempotent** اضافه می‌شوند (`INSERT OR IGNORE`). پاسخ گزارش می‌دهد چند مورد از هر کدام اعمال شده‌اند:

```jsonc
{ "ok": true, "bypassPatterns": 1, "customHosts": 1, "agents": 1 }
```

آنچه در پیکربندی **نیست**: وضعیت اجرای سرور، مسیرهای گواهی، وضعیت DNS به‌ازای‌عامل، مسیر CA ی upstream، و تنظیمات TPROXY — این‌ها وضعیت host/runtime هستند، نه ترجیحات قابل‌حمل.

---

## §4 مرجع به‌ازای‌عامل

| #   | Agent              | Status           | Hosts intercepted                                                  | Auth type      |
| --- | ------------------ | ---------------- | ------------------------------------------------------------------ | -------------- |
| 1   | **Antigravity**    | ✅ Supported     | `daily-cloudcode-pa.googleapis.com`, `cloudcode-pa.googleapis.com` | Firebase OAuth |
| 2   | **Kiro (AWS)**     | ✅ Supported     | `prod.kiro.aws`, `dev.kiro.aws`                                    | AWS SigV4      |
| 3   | **GitHub Copilot** | ✅ Supported     | `api.githubcopilot.com`, `copilot-proxy.githubusercontent.com`     | GitHub OAuth   |
| 4   | **OpenAI Codex**   | ✅ Supported     | `api.openai.com` (Codex paths), `chatgpt.com`                      | OpenAI key     |
| 5   | **Cursor IDE**     | ✅ Supported     | `api2.cursor.sh`, `api.cursor.sh`                                  | Cursor OAuth   |
| 6   | **Zed Industries** | ✅ Supported     | `api.zed.dev`, `llm.zed.dev`                                       | Zed OAuth      |
| 7   | **Claude Code**    | ✅ Supported     | `api.anthropic.com` (opt-in)                                       | Anthropic key  |
| 8   | **Open Code**      | ✅ Supported     | `openrouter.ai`, `api.openai.com` (zen paths)                      | API key        |
| 9   | **Trae**           | 🔍 Investigating | TBD — see §8                                                       | TBD            |

### مراحل wizard راه‌اندازی (به‌ازای‌عامل)

هر کارت عامل یک wizard ی راه‌اندازی ۳ مرحله‌ای دارد:

1. **راستی‌آزمایی پیش‌نیازها** — سرور در حال اجرا؟ گواهی مورد اعتماد؟ IDE نصب شده (خودکار تشخیص داده می‌شود)؟
2. **فعال‌سازی DNS** — ورودی‌های `/etc/hosts` را اضافه می‌کند (نیازمند sudo). دقیقاً نشان می‌دهد کدام خطوط اضافه خواهند شد.
3. **نگاشت مدل‌ها** — جدول نگاشت مدل اختیاری. wildcard پذیرفته می‌شود.

### تشخیص عامل

برای عامل‌های ۱ تا ۸، AgentBridge تلاش می‌کند نصب IDE را به‌صورت خودکار تشخیص دهد:

```ts
export async function detectAgent(agentId: AgentId): Promise<DetectionResult>;
// Returns: { installed: boolean, version?: string, path?: string }
```

تشخیص از مسیرهای مختص‌OS و بررسی‌های باینری استفاده می‌کند (مثلاً `code --list-extensions | grep github.copilot` برای Copilot، `~/.config/antigravity/` برای Antigravity).

---

## §5 امنیت

### قوانین سخت اعمال‌شده

| Rule                              | Application                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| **#12** `sanitizeErrorMessage`    | All handler errors are sanitized before response or buffer entry                         |
| **#13** Shell env-passing         | `/etc/hosts` edits use `env` option — no string interpolation of paths                   |
| **#15 + #17** `isLocalOnlyPath()` | `/api/tools/agent-bridge/` is LOCAL_ONLY + SPAWN_CAPABLE — loopback enforced before auth |

### فهرست bypass برای هاست‌های حساس

فهرست bypass تضمین می‌کند که نهادهای مالی، پروایدرهای OAuth/SSO و سایر هاست‌های حساس **هرگز رمزگشایی نمی‌شوند**. ترافیک TLS آن‌ها به‌عنوان یک تونل TCP شفاف عبور می‌کند — RouteChi هرگز متن‌آشکار را نمی‌بیند.

الگوهای bypass پیش‌فرض شامل:

- `*.bank.*`، `*.gov.*` (مالی/دولتی)
- `*.okta.com`، `*.auth0.com`، `*.microsoft.com` (SSO/هویت)
- `*.apple.com`، `*.icloud.com` (سرویس‌های سیستمی Apple)

الگوهای bypass اضافه‌شده‌توسط‌کاربر در جدول `agent_bridge_bypass` ذخیره می‌شوند و بر همه‌چیز تقدم دارند.

### نقاب‌کردن اسرار

`maskSecrets()` از `src/mitm/maskSecrets.ts` اعمال می‌شود:

- روی هر بدنه‌ی درخواست پیش از `TrafficBuffer.push()`
- روی هر هدر پیش از log‌کردن یا broadcast

الگوها: توکن‌های دارای پیشوند `sk-`/`ak-`/`pk-`، توکن‌های `Bearer`، و توکن‌های عمومی ≥۴۰ کاراکتر.

### گواهی CA ی upstream

هنگامی که `AGENTBRIDGE_UPSTREAM_CA_CERT` تنظیم شده باشد، فایل در زمان شروع خوانده می‌شود. اگر مسیر وجود داشته باشد اما فایل غیرقابل‌خواندن باشد، AgentBridge یک خطای واضح log می‌کند و از شروع امتناع می‌ورزد (از شکست‌های بی‌صدا‌ی TLS در محیط‌های شرکتی جلوگیری می‌کند).

### محدودیت‌های شناخته‌شده

- **پورت ۴۴۳ نیازمند امتیاز است**: روی Linux، AgentChrome به `setcap 'cap_net_bind_service=+ep'` روی باینری Node نیاز دارد، یا از طریق `authbind` اجرا شود. Setup Wizard دستورالعمل‌های مختص‌OS را نمایش می‌دهد.
- **نیاز به راه‌اندازی مجدد IDE**: پس از redirect ی DNS، IDE باید برای اثرگذاری تفکیک هاست جدید راه‌اندازی مجدد شود.
- **توکن‌های OAuth ی hardcoded**: برخی عامل‌ها (Kiro، Antigravity) توکن‌های refresh ی OAuth را به‌صورت محلی ذخیره می‌کنند. این موارد برای AgentBridge شفاف هستند — این پراکسی توکن Bearer را در هر درخواست می‌بیند، که پیش از log‌کردن نقاب‌دار می‌شود.
- **frontendهای Electron به `NODE_EXTRA_CA_CERTS` نیاز دارند**: IDEهایی که frontend آن‌ها روی runtime ی Node/Electron بسته‌بندی‌شده اجرا می‌شود، از فروشگاه اعتماد OS/NSS چشم‌پوشی می‌کنند و باید از یک shell با `NODE_EXTRA_CA_CERTS` تنظیم‌شده اجرا شوند (به §3.2 مراجعه کنید). علامت هنگام نبود: backend ی IDE احراز هویت می‌کند (MITM کدهای `200` را نشان می‌دهد) اما UI در حالت logged-out می‌ماند.
- **نصب‌های چندگانه‌ی یک IDE مستقل‌اند**: یک نصب سیستمی (مثلاً `/usr/share/antigravity/antigravity`) و یک نصب «Full» محلی‌کاربر (مثلاً `~/AntigravityIDE_Full/antigravity-ide`) پروسه‌های جداگانه‌ای با runtimeهای خود هستند — هر کدام باید با CA ی تزریق‌شده راه‌اندازی مجدد شوند. پیش از راه‌اندازی مجدد با مسیر باینری آن مشخص کنید کدام در حال اجراست.
- **هویت توسط prompt سیستمی عامل تعیین می‌شود، نه مدل مسیریابی‌شده**: هنگامی که مدل یک عامل را به یک پروایدر متفاوت نگاشت مجدد می‌کنید، پاسخ همچنان هویت بومی عامل را ادعا می‌کند (مثلاً Antigravity پاسخ می‌دهد «من توسط Gemini تغذیه می‌شوم») زیرا IDE آن را در prompt سیستمی تزریق می‌کند. backend واقعی را در `call_logs` / `proxy_logs` (`provider`، `model`، `target_format`) تأیید کنید، نه با پرسیدن از مدل که چه‌کسی است.

---

## §6 رفع اشکال

### تداخل پورت ۴۴۳

اگر پروسه‌ی دیگری از قبل روی پورت ۴۴۳ گوشت می‌دهد (سرور وب، VPN و غیره):

```bash
lsof -i :443          # find the process
sudo fuser -k 443/tcp  # force-kill (use with care)
```

به‌جای آن، می‌توانید یک پورت بدون‌امتیاز در تنظیمات AgentBridge پیکربندی کنید و قواعد redirect ی `iptables` / `pf` راه‌اندازی کنید.

### گواهی مورد اعتماد نیست

اگر IDE پس از شروع AgentBridge خطاهای TLS نشان می‌دهد:

1. تأیید کنید گواهی نصب شده: `security find-certificate -c "OmniRoute AgentBridge"` (macOS) یا `certutil -L -d sql:$HOME/.pki/nssdb` (Linux/NSS)
2. برخی اپ‌ها فروشگاه اعتماد خود را نگه می‌دارند (Firefox، Chrome روی Linux). دوباره «Trust Cert» را اجرا کنید و فروشگاه گواهی مختص‌NSS/Firefox را بررسی کنید.
3. پس از اعتماد، IDE را راه‌اندازی مجدد کنید — نشست‌های TLS ی در حال اجرا از وضعیت اعتماد قدیمی استفاده می‌کنند.

### IDE در حالت logged-out / «connection error» با وجود CA ی مورد اعتماد

علامت: پس از redirect ی DNS و اعتماد به CA، یک IDE مبتنی‌بر Electron (مثلاً Antigravity)
به‌صورت **logged out** باز می‌شود یا خطای احراز‌هویت/اتصال نمایش می‌دهد، با این حال log ی MITM
فراخوانی‌های bootstrap (`loadCodeAssist`، `fetchAvailableModels`، …) را با کد `200` برمی‌گرداند.

علت: **runtime ی Node/Electron بسته‌بندی‌شده‌ی IDE از فروشگاه اعتماد OS چشم‌پوشی می‌کند**. backend ی
بومی (یک language server ی Go) به CA ی OS اعتماد دارد و احراز هویت می‌کند، اما frontend ی Electron
این‌طور نیست — پس UI باور دارد که آفلاین است.

رفع (هر دو مرحله): `NODE_EXTRA_CA_CERTS=<ca.crt>` را export کنید **و IDE را از همان
shell اجرا کنید**، نه از آیکن دسکتاپ. ابتدا IDE را کاملاً ببندید — singleton lock ی Electron بدان
معناست که اجرای دوم تنها پروسه‌ی موجود را focus می‌کند و محیط جدید نادیده گرفته می‌شود. به §3.2 مراجعه کنید.
این یک گزارش upstream ی باز را منعکس می‌کند که در آن یک عامل مستقل از طریق یک MITM کار می‌کند اما
variant ی IDE تحت همان راه‌اندازی شکست می‌خورد.

### DNS منتشر نشده

بررسی کنید `/etc/hosts` به‌روزرسانی شده:

```bash
grep "omniroute\|127.0.0.1.*github\|127.0.0.1.*cursor" /etc/hosts
```

فلاش کردن کش DNS:

```bash
# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
# Linux (systemd-resolved)
sudo systemctl restart systemd-resolved
# Windows
ipconfig /flushdns
```

### IDE تشخیص داده نشد

تشخیص خودکار از مسیرهای نصب رایج استفاده می‌کند. اگر تشخیص شکست بخورد اما IDE نصب است:

- بررسی کنید آیا باینری IDE در محل غیراستانداردی است
- Setup Wizard همچنان کار می‌کند — شکست تشخیص فقط بدان معناست که نشانbadge مسیر نصب را نشان نخواهد داد

### خطاهای هندلر (شکست fetch ی upstream)

اگر AgentBridge قطع می‌کند اما همه‌ی درخواست‌ها شکست می‌خورند:

1. تأیید کنید حداقل یک پروایدر در `/dashboard/providers` متصل است
2. logهای سرور RouteChi را بررسی کنید: `APP_LOG_LEVEL=debug` در `.env`
3. تأیید کنید `OMNIROUTE_BASE_URL` به نقطه‌ی پایانی router درست اشاره می‌کند (پیش‌فرض: `http://127.0.0.1:20128`)

---

## §7 مرجع API

همه‌ی مسیرها `LOCAL_ONLY` (فقط loopback، پیش از احراز هویت اعمال می‌شود) و `SPAWN_CAPABLE` هستند. به `src/server/authz/routeGuard.ts` مراجعه کنید.

مسیر پایه: `/api/tools/agent-bridge/`

| Method              | Path                                           | Description                                                                                                                |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET                 | `/api/tools/agent-bridge/state`                | Global server state + per-agent detection/status                                                                           |
| GET                 | `/api/tools/agent-bridge/agents`               | List registered agents (id, name, hosts, viability, state)                                                                 |
| GET                 | `/api/tools/agent-bridge/agents/{id}`          | State of one agent (target config + detection + stored state)                                                              |
| PATCH               | `/api/tools/agent-bridge/agents/{id}`          | Update `setup_completed` for agent                                                                                         |
| GET                 | `/api/tools/agent-bridge/agents/{id}/detect`   | Run detection probe for agent (`installed`, `version?`, `path?`)                                                           |
| POST                | `/api/tools/agent-bridge/agents/{id}/dns`      | Enable/disable DNS for agent (`{enabled: boolean}`)                                                                        |
| GET                 | `/api/tools/agent-bridge/agents/{id}/mappings` | Model mappings for agent                                                                                                   |
| PUT                 | `/api/tools/agent-bridge/agents/{id}/mappings` | Replace model mappings                                                                                                     |
| POST                | `/api/tools/agent-bridge/server`               | Start/stop/restart server (`action: "start"\|"stop"\|"restart"\|"trust-cert"\|"regenerate-cert"`)                          |
| GET                 | `/api/tools/agent-bridge/cert`                 | Cert status (`exists`, `trusted`, `path`)                                                                                  |
| POST                | `/api/tools/agent-bridge/cert`                 | Trust (install) the MITM root CA                                                                                           |
| DELETE              | `/api/tools/agent-bridge/cert`                 | Untrust (remove) the MITM root CA — idempotent (see §3.6)                                                                  |
| POST                | `/api/tools/agent-bridge/cert/regenerate`      | Regenerate the self-signed MITM cert                                                                                       |
| GET                 | `/api/tools/agent-bridge/cert/download`        | Stream the PEM cert for download                                                                                           |
| GET                 | `/api/tools/agent-bridge/bypass`               | List bypass patterns (`default` + `user`)                                                                                  |
| POST                | `/api/tools/agent-bridge/bypass`               | Replace user-defined bypass patterns wholesale                                                                             |
| DELETE              | `/api/tools/agent-bridge/bypass?pattern=...`   | Remove a single user-defined bypass pattern                                                                                |
| GET                 | `/api/tools/agent-bridge/diagnose`             | Capture-pipeline self-test (see §3.6)                                                                                      |
| POST                | `/api/tools/agent-bridge/repair`               | Undo orphaned MITM system state (see §3.6)                                                                                 |
| GET                 | `/api/tools/agent-bridge/config`               | Export portable config JSON (see §3.7)                                                                                     |
| POST                | `/api/tools/agent-bridge/config`               | Import portable config JSON (see §3.7)                                                                                     |
| GET                 | `/api/tools/agent-bridge/upstream-ca`          | Get configured upstream CA path                                                                                            |
| POST                | `/api/tools/agent-bridge/upstream-ca`          | Validate + persist upstream CA path                                                                                        |
| POST                | `/api/tools/agent-bridge/upstream-ca/test`     | Validate-only (dry-run) an upstream CA path — does not persist                                                             |
| GET / POST / DELETE | `/api/tools/agent-bridge/tproxy`               | TPROXY transparent-decrypt capture mode — see [`docs/security/MITM-TPROXY-DECRYPT.md`](../security/MITM-TPROXY-DECRYPT.md) |

شمای کامل OpenAPI: `docs/openapi.yaml` → tag `AgentBridge`.

---

## §8 نقشه‌راه

### بررسی Trae

Trae یک دستیار کدنویسی هوش مصنوعی نسبتاً جدید است. پیش از پیاده‌سازی هندلر:

1. باینری/اکستنشن را در مارکت‌پلیس‌های VS Code / JetBrains یا به‌عنوان اپ مستقل شناسایی کنید
2. ترافیک را با mitmproxy capture کنید تا هاست‌های API و شکل نقاط‌پایانی کشف شود
3. مکانیزم احراز هویت را تعیین کنید
4. ارزیابی go/no-go بر اساس TOS و قابلیت‌کشف API

تا پیش از تکمیل بررسی، کارت Trae در داشبورد یک نشانbadge «Investigating» با یک پیوند «Report viability» نمایش می‌دهد. stub ی هندلر در `src/mitm/handlers/trae.ts` یک خطای ساختاریافته‌ی `Not yet implemented` پرتاب می‌کند.

### عامل‌های backlog (نیازمند MITM — بدون پشتیبانی از base URL سفارشی)

ابزارهای زیر در نسخه‌های فعلی خود از base URLهای سفارشی پشتیبانی نمی‌کنند، که MITM را تنها مسیر قطع می‌سازد. ارزیابی امکان‌پذیری در حال انجام است:

- **Windsurf** (Codeium/Cognition)
- **Amp** (Sourcegraph)
- **Amazon Q / Kiro CLI** (AWS Bedrock — جدا از Kiro IDE)
- **Cowork** (Anthropic desktop)

نکته: GitHub Copilot CLI ≥v1.0.19 از `COPILOT_PROVIDER_BASE_URL` پشتیبانی می‌کند — برای آن ابزار از پیکربندی مستقیم به‌جای MITM استفاده کنید.
