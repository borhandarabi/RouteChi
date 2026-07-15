---
title: "مستندات کدبیس OmniRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# مستندات کدبیس OmniRoute

> **نسخه:** v3.8.0
> **آخرین به‌روزرسانی:** 2026-06-28
> **مخاطب:** مهندسانی که به OmniRoute مشارکت می‌کنند یا ادغام‌هایی روی آن می‌سازند.
>
> برای نمودارهای معماری سطح‌بالا و استدلال پشت هر زیرسیستم،
> [ARCHITECTURE.md](./ARCHITECTURE.md) را بخوانید. برای بررسی عمیق زیرسیستم‌های فردی
> (Auto Combo، MCP server، A2A server، Skills، Memory، Cloud Agents، Resilience،
> Compression، و غیره) به فایل‌های اختصاصی آن‌ها در این دایرکتوری `docs/` مراجعه کنید.

این فایل توصیف می‌کند **امروز چه چیزی در مخزن وجود دارد** تا یک مهندس جدید
بتواند درخت را پیمایش کند، لایه‌بندی runtime را درک کند، و بداند کجا کد اضافه کند
بدون اختراع ماژول‌های جدید.

---

## ۱. پشته فنی

| دغدغه            | انتخاب                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| چارچوب وب        | **Next.js 16** (App Router، standalone output، بدون میان‌افزار سراسری)                                                              |
| زبان             | **TypeScript 6.0+** — target `ES2022`، `module: esnext`، `moduleResolution: bundler`، `strict: false`                            |
| Runtime          | **Node.js** `>=22.22.2 <23` یا `>=24.0.0 <27` (از طریق `engines` + `SUPPORTED_NODE_RANGE` اعمال می‌شود)                            |
| پایگاه داده      | **SQLite** از طریق `better-sqlite3` (singleton، WAL journaling)                                                                    |
| دسکتاپ           | **Electron 41** + `electron-builder` 26.10 (workspace جدا در `electron/`)                                                         |
| آزمون            | **Node native test runner** (unit/integration)، **Vitest** (MCP, autoCombo, cache)، **Playwright** (e2e + protocols-e2e)          |
| Build            | Next.js standalone از طریق `scripts/build/build-next-isolated.mjs`                                                                 |
| Lint/format      | ESLint flat config + Prettier (`lint-staged` از طریق Husky pre-commit)                                                            |
| سیستم ماژول      | ESM در همه جا (`"type": "module"`)                                                                                                |
| Workspace‌ها     | npm workspace — `open-sse` تنها sub-workspace است                                                                                  |

alias‌های مسیر (`tsconfig.json`):

- `@/*` → `src/*`
- `@omniroute/open-sse` → `open-sse/index.ts`
- `@omniroute/open-sse/*` → `open-sse/*`

پورت HTTP پیش‌فرض: **`20128`** (API و داشبورد یک فرآیند را به اشتراک می‌گذارند). دایرکتوری
داده `DATA_DIR` env var است، با پیش‌فرض `~/.omniroute/`.

---

## ۲. چیدمان مخزن

```
OmniRoute/
├── src/                  Next.js application (App Router, libs, domain, server, shared)
├── open-sse/             Streaming engine workspace (@omniroute/open-sse)
├── electron/             Desktop wrapper (Electron 41 main + preload)
├── bin/                  CLI entry points (omniroute, reset-password)
├── tests/                Unit, integration, e2e, protocols-e2e, translator, security, fixtures
├── scripts/              Build, sync, check, migration, and runtime helper scripts
├── docs/                 Public documentation (this directory)
├── public/               Static assets, PWA manifest, service worker
├── config/               Runtime config samples
├── images/               Marketing/screenshot assets
├── _ideia/, _references/, _mono_repo/, _tasks/   Internal scratch / planning (not shipped)
├── CLAUDE.md             Repo rules for Claude Code
├── AGENTS.md             Deeper architecture reference for agents
├── package.json          v3.8.0, workspace root
└── tsconfig.json         Path aliases + core compiler options
```

---

## ۳. `src/` — اپلیکیشن Next.js

```
src/
├── app/                  App Router pages + API routes
├── lib/                  Core libraries (DB, auth, OAuth, skills, memory, …)
├── domain/               Pure domain layer (policy, fallback, cost, lockout, …)
├── server/               Server-only modules (authz, cors, auth)
├── shared/               Types, constants, validation, contracts, utils (cross-boundary safe)
├── mitm/                 Man-in-the-middle proxy helpers for CLI integration
├── models/               Local model metadata / aliasing
├── sse/                  Legacy SSE handlers that still live under src/ (not open-sse/)
├── store/                Client-side state stores
├── middleware/           Route-level middleware utilities (not Next.js global middleware)
├── scripts/              In-tree scripts importable by app code
├── types/                Ambient and shared TS types
├── i18n/                 Locale bundles
├── instrumentation.ts    Next.js instrumentation hook
├── instrumentation-node.ts
├── server-init.ts        Process-level bootstrap (env, DB, jobs, sync)
└── proxy.ts              Top-level proxy bootstrap helper
```

### 3.1 `src/app/` — App Router

App Router هم UI داشبورد و هم HTTP API public/management را نشان می‌دهد.
**هیچ میان‌افزار سراسری وجود ندارد** — دروازه‌بندی به‌ازای-مسیر انجام می‌شود.

segment‌های سطح‌بالا زیر `src/app/`:

| مسیر                                                                          | هدف                                   |
| ----------------------------------------------------------------------------- | ----------------------------------------- |
| `api/`                                                                        | همه مسیرهای HTTP API (به تفکیک زیر مراجعه کنید) |
| `a2a/`                                                                        | endpoint A2A JSON-RPC 2.0 (`POST /a2a`)   |
| `.well-known/agent.json/`                                                     | سند کشف A2A Agent Card         |
| `(dashboard)/`                                                                | UI داشبورد (route group، بدون پیشوند URL) |
| `auth/`, `login/`, `forgot-password/`, `callback/`                            | جریان‌های احراز هویت                                |
| `landing/`                                                                    | صفحه فرود بازاریابی                    |
| `error.tsx`, `global-error.tsx`, `not-found.tsx`, `forbidden/`, `loading.tsx` | مرزهای خطا/بارگیری چارچوب        |
| `layout.tsx`, `page.tsx`, `globals.css`, `manifest.ts`                        | Root shell                                |

#### 3.1.1 `src/app/(dashboard)/dashboard/` — صفحات UI

`agents`، `analytics`، `api-manager`، `audit`، `auto-combo`، `batch`، `cache`،
`changelog`، `cli-tools`، `cloud-agents`، `combos`، `compression`، `context`،
`costs`، `endpoint`، `health`، `limits`، `logs`، `memory`، `onboarding`،
`playground`، `providers`، `search-tools`، `settings`، `skills`، `system`،
`translator`، `usage`، `webhooks`، به اضافه `page.tsx` ریشه، `HomePageClient.tsx`،
`BootstrapBanner.tsx`.

#### 3.1.2 `src/app/api/` — گروه‌های API سطح‌بالا

```
src/app/api/
├── a2a/{status, tasks}
├── acp/
├── admin/
├── analytics/
├── assess/
├── auth/
├── batches/
├── cache/
├── cli-tools/
├── cloud/{codex-responses-ws}
├── combos/
├── compliance/
├── compression/
├── context/
├── db/, db-backups/
├── evals/
├── fallback/
├── files/
├── health/
├── init/
├── internal/{concurrency}
├── keys/
├── logs/
├── mcp/{audit, sse, status, stream, tools}
├── memory/{health, [id]/, route.ts}
├── model-combo-mappings/
├── models/
├── monitoring/
├── oauth/
├── openapi/
├── policies/
├── pricing/
├── provider-metrics/, provider-models/, provider-nodes/
├── providers/
├── rate-limit/, rate-limits/
├── resilience/
├── restart/, shutdown/
├── search/
├── sessions/
├── settings/
├── skills/{executions, [id], install, marketplace, route.ts, skillssh}
├── storage/
├── sync/{bundle, cloud, tokens}
├── telemetry/
├── tools/{agent-bridge, traffic-inspector}
├── usage/{budget, …}
├── version-manager/
└── webhooks/
```

#### 3.1.2a `src/app/api/services/` — مدیریت سرویس‌های تعبیه‌شده

مسیرهایی برای نصب، راه‌اندازی، توقف و پایش 9Router و CLIProxyAPI.
همه مسیرها **LOCAL_ONLY** (فقط loopback، hard rule #17) طبقه‌بندی شده‌اند زیرا
می‌توانند `npm install` را فراخوانی و فرآیند فرزند spawn کنند.

```
src/app/api/services/
├── 9router/
│   ├── _lib.ts             getOrInitSupervisor() helper
│   ├── install/route.ts    POST — npm install via execFile
│   ├── start/route.ts      POST — supervisor.start()
│   ├── stop/route.ts       POST — supervisor.stop()
│   ├── restart/route.ts    POST — supervisor.restart()
│   ├── update/route.ts     POST — npm install newer version
│   ├── rotate-key/route.ts POST — generate new API key + restart
│   ├── status/route.ts     GET  — live + DB status + version metadata
│   └── auto-start/route.ts POST — toggle auto_start flag
├── cliproxy/
│   ├── _lib.ts             getOrInitSupervisor() helper
│   ├── install/route.ts    POST — npm install
│   ├── start/route.ts      POST — supervisor.start()
│   ├── stop/route.ts       POST — supervisor.stop()
│   ├── restart/route.ts    POST — supervisor.restart()
│   ├── update/route.ts     POST — npm install newer version
│   ├── status/route.ts     GET  — live + DB status + version metadata
│   └── auto-start/route.ts POST — toggle auto_start flag
└── [name]/
    └── logs/route.ts       GET  — SSE log tail (shared by all services)
```

UI داشبورد مربوطه:
`src/app/(dashboard)/dashboard/providers/services/` — صفحه دو-زبانه (CLIProxyAPI + 9Router).
پروکسی معکوس برای UI تعبیه‌شده 9Router:
`src/app/(dashboard)/dashboard/providers/services/[name]/embed/[...path]/route.ts`

بررسی عمیق: `docs/frameworks/EMBEDDED-SERVICES.md`

#### 3.1.3 `src/app/api/v1/` — API عمومی سازگار با OpenAI

```
v1/
├── accounts/[id]/                       account lookup
├── agents/tasks/[id]/, agents/tasks/    A2A-flavored task endpoints
├── api/                                 internal API helpers exposed under v1/api
├── audio/{speech, transcriptions}/      TTS + STT
├── batches/[id]/{cancel}, batches/      OpenAI Batches API
├── chat/completions/                    Chat Completions (the main endpoint)
├── chatgpt-web/                         ChatGPT-Web compat
├── completions/                         Legacy text completions
├── embeddings/                          Embeddings
├── files/[id]/, files/                  Files API
├── _helpers/                            Shared route helpers (no public URL)
├── images/{edits, generations}/         Image gen + edit
├── issues/                              Triage helper endpoints
├── management/{proxies}/                Management-scoped routes inside v1
├── messages/{count_tokens}/             Anthropic-style messages compat
├── models/                              Model listing (`route.ts`, `catalog.ts`)
├── moderations/                         Moderation
├── music/                               Music gen
├── providers/[provider]/                Per-provider operations
├── quotas/{check}                       Quota probes
├── registered-keys/                     Registered key admin
├── rerank/                              Reranking
├── responses/[...path]/                 OpenAI Responses API (catch-all)
├── search/                              Web search
├── videos/                              Video gen
├── ws/                                  WebSocket bridge
└── _middleware/route.ts                 Auth + body size + OPTIONS guard
```

### 3.2 `src/lib/` — کتابخانه‌های اصلی

همیشه داده، sync، OAuth، skill، memory و غیره را از طریق این ماژول‌ها import کنید. جدول
دایرکتوری‌های واقعی و فایل‌های قابل‌توجه سطح‌بالا را گروه‌بندی می‌کند.

| ماژول            | هدف                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a2a/`            | سرور پروتکل A2A: `taskManager.ts`، `streaming.ts`، `taskExecution.ts`، `routingLogger.ts`، `skills/` (۶ skill: تحلیل هزینه، گزارش سلامت، کشف provider، مدیریت سهمیه، مسیریابی هوشمند، list-capabilities)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `acp/`            | Agent-Control-Protocol: `index.ts`، `manager.ts`، `registry.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `api/`            | helper‌های داخلی API: `requireManagementAuth.ts`، `requireCliToolsAuth.ts`، `errorResponse.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `auth/`           | `managementPassword.ts` (بازنشانی رمز عبور / hashing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `batches/`        | سرویس OpenAI Batches API (`service.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `catalog/`        | sync کاتالوگ OpenRouter (`openrouterCatalog.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `cloudAgent/`     | رجیستری Cloud agent: `api.ts`، `baseAgent.ts`، `db.ts`، `index.ts`، `registry.ts`، `types.ts`، `agents/{codex, devin, jules}.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `combos/`         | helper‌های حل combo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `compliance/`     | Audit + provider audit: `index.ts`، `providerAudit.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `config/`         | چسب پیکربندی runtime                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `db/`             | ماژول‌های domain SQLite (به §3.2.1 مراجعه کنید)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `display/`        | helper‌های UI/display که توسط پاسخ‌های API استفاده می‌شوند                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `embeddings/`     | رجیستری سرویس embedding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `env/`            | بارگذاری env + introspection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `evals/`          | runtime ارزیابی                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `guardrails/`     | `piiMasker.ts`، `promptInjection.ts`، `visionBridge.ts`، `visionBridgeHelpers.ts`، `registry.ts`، `base.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `jobs/`           | job‌های پس‌زمینه (`autoUpdate.ts`، …)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `memory/`         | حافظه پایا: `store.ts`، `cache.ts`، `retrieval.ts`، `summarization.ts`، `extraction.ts`، `injection.ts`، `qdrant.ts`، `settings.ts`، `verify.ts`، `schemas.ts`، `types.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `monitoring/`     | `observability.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `oauth/`          | provider‌های OAuth (۱۴): `antigravity`، `claude`، `cline`، `codex`، `cursor`، `gemini`، `github`، `gitlab-duo`، `kilocode`، `kimi-coding`، `kiro`، `qoder`، `qwen`، `windsurf` به اضافه `services/`، `utils/{pkce, server, banner, codexAuthFile, ui}`، `constants/oauth.ts`                                                                                                                                                                                                                                                                                                                                                                                                            |
| `plugins/`        | بارگذار plugin (`index.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `promptCache/`    | `prefixAnalyzer.ts`، `index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `providerModels/` | چرخه حیات مدل مدیریت‌شده: `modelDiscovery.ts`، `managedModelImport.ts`، `managedAvailableModels.ts`، `cursorAgent.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `providers/`      | helper‌های provider: `catalog.ts`، `validation.ts`، `imageValidation.ts`، `claudeExtraUsage.ts`، `codexConnectionDefaults.ts`، `codexFastTier.ts`، `webCookieAuth.ts`، `managedAvailableModels.ts`، `requestDefaults.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `resilience/`     | `settings.ts` — تنظیمات برای مدارشکنی، cooldown، lockout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `runtime/`        | شناسایی ویژگی runtime                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `search/`         | `executeWebSearch.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `services/`       | چارچوب سرویس‌های تعبیه‌شده: `ServiceSupervisor.ts` (supervisor فرآیند فرزند generic با قفل عملیات، ring buffer، بررسی سلامت)، `bootstrap.ts` (ثبت و auto-start سطح فرآیند)، `registry.ts` (نقشه tool ← supervisor)، `apiKey.ts` (key store با AES-256-GCM)، `modelSync.ts` (sync دوره‌ای مدل)، `ringBuffer.ts` (بافر گزارش دوری ۵ MB)، `healthCheck.ts` (probe سلامت HTTP)، `types.ts`، `embedWsProxy.ts` (پروکسی WebSocket)، `installers/{ninerouter,cliproxy}.ts`. به `docs/frameworks/EMBEDDED-SERVICES.md` مراجعه کنید                                                                                                                                      |
| `agentSkills/`    | کاتالوگ + تولیدکننده Agent Skills: `catalog.ts` (getCatalog/getSkillById/filterCatalog/computeCoverage)، `generator.ts` (generateAgentSkills → `skills/{id}/SKILL.md` می‌نویسد)، `openapiParser.ts` (endpoint‌های REST را از spec OpenAPI استخراج می‌کند)، `cliRegistryParser.ts` (subcommand‌های CLI را از bin/cli-registry استخراج می‌کند)، `schemas.ts` (Zod: AgentSkillSchema, SkillCoverageSchema, ListQuerySchema, GenerateBodySchema)، `types.ts` (AgentSkill, SkillCoverage, SkillMarkdown, GeneratorReport). توسط مسیرهای REST (`/api/agent-skills/*`)، ابزارهای MCP (`omniroute_agent_skills_*`)، و skill A2A `list-capabilities` مصرف می‌شود. به [AGENT-SKILLS.md](../frameworks/AGENT-SKILLS.md) مراجعه کنید. |
| `skills/`         | چارچوب Skill: `registry.ts`، `executor.ts`، `interception.ts`، `injection.ts`، `sandbox.ts`، `custom.ts`، `hybrid.ts`، `builtins.ts`، `a2a.ts`، `providerSettings.ts`، `schemas.ts`، `skillssh.ts`، `types.ts`، به اضافه `builtin/browser.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `spend/`          | `batchWriter.ts` (بافر write-behind)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `sync/`           | `bundle.ts`، `tokens.ts` (Cloud Sync)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `system/`         | helper‌های سطح سیستم                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `translator/`     | چسب ترجمه‌گر سطح‌بالا (به `open-sse/translator/` تفویض می‌کند)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `usage/`          | حسابداری استفاده: `costCalculator.ts`، `tokenAccounting.ts`، `usageHistory.ts`، `aggregateHistory.ts`، `usageStats.ts`، `callLogs.ts`، `callLogArtifacts.ts`، `fetcher.ts`، `providerLimits.ts`، `migrations.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `versionManager/` | auto-update + manifest نسخه                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ws/`             | پل WebSocket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `zed-oauth/`      | جریان OAuth ویرایشگر Zed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

فایل‌های سطح‌بالا در `src/lib/`:

- `localDb.ts` — فقط لایه re-export. **هرگز** logic اینجا اضافه نکنید.
- `proxyHealth.ts`، `proxyLogger.ts`، `tokenHealthCheck.ts`، `localHealthCheck.ts`
- `oneproxyRotator.ts`، `oneproxySync.ts`
- `apiBridgeServer.ts`، `cacheLayer.ts`، `semanticCache.ts`، `settingsCache.ts`
- `cloudSync.ts`، `initCloudSync.ts`
- `cloudflaredTunnel.ts`، `ngrokTunnel.ts`، `tailscaleTunnel.ts`
- `consoleInterceptor.ts`، `container.ts`، `gracefulShutdown.ts`، `idempotencyLayer.ts`
- `ipUtils.ts`، `logEnv.ts`، `logPayloads.ts`، `logRotation.ts`
- `modelAliasSeed.ts`، `modelCapabilities.ts`، `modelMetadataRegistry.ts`، `modelsDevSync.ts`
- `piiSanitizer.ts`، `pricingSync.ts`
- `apiKeyExposure.ts`، `cacheControlSettings.ts`، `dataPaths.ts`، `toolPolicy.ts`
- `translatorEvents.ts`، `usageDb.ts`، `usageAnalytics.ts`، `webhookDispatcher.ts`

#### 3.2.1 `src/lib/db/`

پایگاه داده singleton SQLite (`getDbInstance()` در `core.ts`، WAL journaling).
**هرگز SQL raw در مسیرها یا handler‌ها ننویسید** — از این ماژول‌ها عبور کنید.

![نمای کلی schema پایگاه داده (جدول‌های اصلی انتخاب‌شده)](../diagrams/exported/db-schema-overview.svg)

> منبع: [diagrams/db-schema-overview.mmd](../diagrams/db-schema-overview.mmd)

ماژول‌های domain (هر کدام مالک یک یا چند جدول): `apiKeys.ts`، `backup.ts`،
`batches.ts`، `cleanup.ts`، `cliToolState.ts`، `combos.ts`،
`commandCodeAuth.ts`، `compression.ts`، `compressionAnalytics.ts`،
`compressionCacheStats.ts`، `compressionCombos.ts`، `compressionScheduler.ts`،
`contextHandoffs.ts`، `core.ts`، `creditBalance.ts`، `databaseSettings.ts`،
`detailedLogs.ts`، `domainState.ts`، `encryption.ts`، `evals.ts`، `files.ts`،
`healthCheck.ts`، `jsonMigration.ts`، `migrationRunner.ts`،
`modelComboMappings.ts`، `models.ts`، `oneproxy.ts`، `prompts.ts`،
`providers.ts`، `providerLimits.ts`، `proxies.ts`، `quotaSnapshots.ts`،
`readCache.ts`، `reasoningCache.ts`، `registeredKeys.ts`، `secrets.ts`،
`sessionAccountAffinity.ts`، `settings.ts`، `stateReset.ts`، `stats.ts`،
`syncTokens.ts`، `tierConfig.ts`، `upstreamProxy.ts`، `versionManager.ts`،
`webhooks.ts`.

`migrations/` شامل ۵۵ فایل `.sql` نسخه‌دار (idempotent، transactional) است و
توسط `migrationRunner.ts` در boot اجرا می‌شود.

جدول‌های ایجادشده در مهاجرت‌ها (مجموع ۵۲):

`a`, `account_key_limits`, `api_keys`, `batches`, `call_logs`,
`combo_adaptation_state`, `combos`, `command_code_auth_sessions`,
`compression_analytics`, `compression_cache_stats`,
`compression_combo_assignments`, `compression_combos`, `context_handoffs`,
`daily_usage_summary`, `db_meta`, `domain_budgets`, `domain_circuit_breakers`,
`domain_cost_history`, `domain_fallback_chains`, `domain_lockout_state`,
`eval_cases`, `eval_runs`, `eval_suites`, `files`, `hourly_usage_summary`,
`key_value`, `mcp_tool_audit`, `memories`, `model_combo_mappings`,
`provider_connections`, `provider_key_limits`, `provider_nodes`,
`proxy_assignments`, `proxy_logs`, `proxy_registry`, `quota_snapshots`,
`reasoning_cache`, `registered_keys`, `request_detail_logs`,
`routing_decisions`, `semantic_cache`, `session_account_affinity`,
`skill_executions`, `skills`, `sync_tokens`, `tier_assignments`,
`tier_config`, `upstream_proxy_config`, `usage_history`, `version_manager`,
`webhooks` (به اضافه جدول‌های مجازی FTS5 برای جست‌وجوی حافظه).

### 3.3 `src/domain/` — لایه domain

منطق تجاری خالص، بدون I/O. توسط مسیرها و handler‌ها import می‌شود.

| فایل                                       | هدف                                           |
| ------------------------------------------ | --------------------------------------------- |
| `policyEngine.ts`                          | resolver سیاست سطح‌بالا                         |
| `fallbackPolicy.ts`                        | درخت تصمیم fallback                            |
| `costRules.ts`                             | قواعد محاسبه هزینه                            |
| `lockoutPolicy.ts`                         | تصمیمات قفل مدل                              |
| `tagRouter.ts`                             | مسیریابی مبتنی‌بر-تگ                          |
| `comboResolver.ts`                         | حل combo از درخواست ← فهرست هدف       |
| `connectionModelRules.ts`                  | فیلترهای مدل به‌ازای-اتصال                    |
| `modelAvailability.ts`                     | بررسی دسترسی مدل                              |
| `degradation.ts`                           | انتقال‌های حالت تنزل‌یافته                    |
| `providerExpiration.ts`                    | شناسایی حساب/کلید منقضی‌شده                   |
| `quotaCache.ts`                            | تصمیمات سهمیه cache‌شده                       |
| `responses.ts`, `omnirouteResponseMeta.ts` | helper‌های شکل پاسخ                            |
| `configAudit.ts`                           | ممیزی تغییر پیکربندی                          |
| `assessment/`                              | ارزیابی مدل (مطابق RFC، به‌طور جزئی پیاده‌سازی‌شده) |
| `types.ts`                                 | انواع domain مشترک                            |

### 3.4 `src/server/` — فقط سرور

نمی‌تواند از مؤلفه‌های کلاینت import شود.

```
server/
├── auth/loginGuard.ts
├── authz/
│   ├── classify.ts        Classifies routes as public vs management
│   ├── assertAuth.ts      Assertion helper
│   ├── context.ts         Per-request authz context
│   ├── headers.ts
│   ├── pipeline.ts        Authz pipeline
│   ├── policies/          Concrete policies
│   └── types.ts
└── cors/origins.ts        CORS origin allowlist
```

### 3.5 `src/shared/` — امن برای اشتراک

به زیردایرکتوری‌های متمرکز تقسیم شده است:

- `constants/` — `providers.ts` (کاتالوگ provider اعتبارسنجی‌شده با Zod)، `models.ts`،
  `modelSpecs.ts`، `modelCompat.ts`، `pricing.ts`، `cliTools.ts`،
  `cliCompatProviders.ts`، `routingStrategies.ts`، `comboConfigMode.ts`،
  `headers.ts`، `upstreamHeaders.ts` (denylist)، `mcpScopes.ts`،
  `errorCodes.ts`، `publicApiRoutes.ts`، `batch.ts`، `batchEndpoints.ts`،
  `bodySize.ts`، `colors.ts`، `appConfig.ts`، `config.ts`،
  `sidebarVisibility.ts`، `visionBridgeDefaults.ts`.
- `validation/` — `schemas.ts` (حدود ۸۰ schema Zod)، `compressionConfigSchemas.ts`،
  `oneproxySchemas.ts`، `providerSchema.ts`، `settingsSchemas.ts`، `helpers.ts`.
- `contracts/` — قراردادهای API عمومی که به npm منتشر می‌شوند.
- `types/` — انواع TS مشترک.
- `utils/` — `circuitBreaker.ts`، `apiAuth.ts`، `apiKey.ts`، `apiKeyPolicy.ts`،
  `apiResponse.ts`، `api.ts`، `classify429.ts`، `cliCompat.ts`، `clipboard.ts`،
  `cloud.ts`، `cn.ts`، `cors.ts`، `costEstimator.ts`، `featureFlags.ts`،
  `fetchTimeout.ts`، `formatting.ts`، `inputSanitizer.ts`، `logger.ts`،
  `machine.ts`، `machineId.ts`، `maskEmail.ts`، `modelCatalogSearch.ts`،
  `nodeRuntimeSupport.ts`، `parseApiKeys.ts`، `providerHints.ts`،
  `providerModelAliases.ts`، `rateLimiter.ts`، `releaseNotes.ts`،
  `a11yAudit.ts`، به اضافه hook‌ها/مؤلفه‌های داشبورد زیر `services/`، `network/`،
  `middleware/`، `schemas/`، `hooks/`، `components/`.

---

## ۴. `open-sse/` — workspace موتور streaming

workspace جداگانه npm که به‌عنوان `@omniroute/open-sse` منتشر می‌شود. پردازش درخواست،
executor‌ها، translator‌ها، سرویس‌ها، transformer و سرور MCP را مالک است.

```
open-sse/
├── index.ts                Public exports
├── package.json            Workspace manifest
├── tsconfig.json
├── types.d.ts
├── config/                 Provider registries, header profiles, identity, …
├── handlers/               Request handlers (chat, embeddings, audio, image, …)
├── executors/              75 provider-specific HTTP executors
├── translator/             Format conversion (OpenAI ↔ Claude ↔ Gemini ↔ Cursor ↔ Kiro)
├── transformer/            Responses API ↔ Chat Completions stream transformer
├── services/               80+ service modules (combos, fallback, quotas, identity, …)
├── utils/                  Streaming helpers, TLS client, AWS SigV4, proxy fetch, …
└── mcp-server/             MCP server (3 transports, 30 scopes, 94 tools)
```

### 4.1 `open-sse/handlers/`

| Handler                 | هدف                                                                  |
| ----------------------- | -------------------------------------------------------------------- |
| `chatCore.ts`           | خط لوله اصلی chat (cache، rate limit، مسیریابی combo، dispatch executor) |
| `responsesHandler.ts`   | نقطه ورود OpenAI Responses API                                         |
| `embeddings.ts`         | Embeddings                                                            |
| `imageGeneration.ts`    | تولید تصویر                                                          |
| `audioSpeech.ts`        | متن‌به‌گفتار                                                          |
| `audioTranscription.ts` | گفتار‌به‌متن                                                          |
| `videoGeneration.ts`    | تولید ویدئو                                                          |
| `musicGeneration.ts`    | تولید موسیقی                                                         |
| `rerank.ts`             | reranking                                                            |
| `moderations.ts`        | moderation                                                           |
| `search.ts`             | جست‌وجوی وب                                                          |
| `sseParser.ts`          | تجزیه‌کننده رویداد SSE                                               |
| `usageExtractor.ts`     | استخراج تعداد token از استریم‌های upstream                           |
| `responseSanitizer.ts`  | حذف نویز خاص provider                                                |
| `responseTranslator.ts` | چسب بین پاسخ provider و لایه translator                              |

### 4.2 `open-sse/executors/`

۷۵ executor provider، هر کدام `BaseExecutor` (`base.ts`) را extend می‌کنند:

`antigravity`, `azure-openai`, `blackbox-web`, `chatgpt-web`, `cliproxyapi`,
`cloudflare-ai`, `codex`, `commandCode`, `cursor`, `default`, `devin-cli`,
`muse-spark-web`, `nlpcloud`, `opencode`, `perplexity-web`, `petals`,
`pollinations`, `puter`, `qoder`, `vertex`, `windsurf`, به اضافه `claudeIdentity.ts`
(helper هویت مشترک) و `index.ts` (رجیستری).

> توجه: provider‌هایی که در اینجا فهرست نشده‌اند توسط `default.ts` با استفاده از executor
> عمومی سازگار با OpenAI سرو می‌شوند. کاتالوگ کامل provider (۲۳۷ ورودی) در
> `src/shared/constants/providers.ts` قرار دارد.

### 4.3 `open-sse/translator/`

ترجمه hub-and-spoke (OpenAI محور است).

- **۹ translator درخواست** (`translator/request/`):
  `antigravity-to-openai`, `claude-to-gemini`, `claude-to-openai`,
  `gemini-to-openai`, `openai-responses`, `openai-to-claude`,
  `openai-to-cursor`, `openai-to-gemini`, `openai-to-kiro`.
- **۹ translator پاسخ** (`translator/response/`):
  `claude-to-openai`, `cursor-to-openai`, `gemini-to-claude`, `gemini-to-openai`,
  `kiro-to-openai`, `openai-responses`, `openai-to-antigravity`,
  `openai-to-claude`.
- **۹ helper** (`translator/helpers/`):
  `claudeHelper`, `geminiHelper`, `geminiToolsSanitizer`, `maxTokensHelper`,
  `openaiHelper`, `responsesApiHelper`, `schemaCoercion`, `toolCallHelper`, به اضافه
  آزمون‌های helper.
- **helper‌های تصویر** (`translator/image/sizeMapper.ts`).
- سطح‌بالا: `bootstrap.ts`, `formats.ts`, `registry.ts`, `index.ts`.

### 4.4 `open-sse/transformer/`

- `responsesTransformer.ts` — مبدل Responses API ↔ Chat
  Completions مبتنی‌بر `TransformStream` (توسط catch-all مسیر `responses/` استفاده می‌شود).

### 4.5 `open-sse/services/`

نکات برجسته (فهرست کامل زیر `open-sse/services/`):

| دغدغه               | فایل‌ها                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| مسیریابی combo      | `combo.ts` (۱۷ استراتژی)، `comboConfig.ts`، `comboMetrics.ts`، `comboManifestMetrics.ts`، `comboAgentMiddleware.ts`                                                                                                                             |
| موتور Auto Combo    | `autoCombo/` — `engine.ts`, `scoring.ts`, `taskFitness.ts`, `virtualFactory.ts`, `modePacks.ts`, `autoPrefix.ts`, `persistence.ts`, `providerDiversity.ts`, `providerRegistryAccessor.ts`, `routerStrategy.ts`, `selfHealing.ts`, `index.ts`      |
| تاب‌آوری            | `accountFallback.ts` (cooldown + lockout)، `errorClassifier.ts`، `emergencyFallback.ts`، `rateLimitManager.ts`، `rateLimitSemaphore.ts`، `accountSemaphore.ts`، `accountSelector.ts`                                                              |
| سهمیه‌ها            | `quotaMonitor.ts`, `quotaPreflight.ts`, `bailianQuotaFetcher.ts`, `codexQuotaFetcher.ts`, `deepseekQuotaFetcher.ts`, `crofUsageFetcher.ts`, `antigravityCredits.ts`                                                                               |
| کش                  | `reasoningCache.ts`, `searchCache.ts`, `signatureCache.ts`, `requestDedup.ts`                                                                                                                                                                     |
| هوش مسیریابی        | `intentClassifier.ts`, `taskAwareRouter.ts`, `backgroundTaskDetector.ts`, `volumeDetector.ts`, `wildcardRouter.ts`, `workflowFSM.ts`, `specificityDetector.ts`, `specificityRules.ts`, `specificityTypes.ts`                                      |
| مدیریت مدل          | `modelCapabilities.ts`, `modelDeprecation.ts`, `modelFamilyFallback.ts`, `modelStrip.ts`, `model.ts`, `provider.ts`, `providerRequestDefaults.ts`, `providerCostData.ts`, `payloadRules.ts`                                                       |
| فشرده‌سازی          | `compression/` — سیم‌کشی کامل موتور فشرده‌سازی                                                                                                                                                                                                   |
| Token + نشست        | `tokenRefresh.ts`, `sessionManager.ts`, `apiKeyRotator.ts`, `contextManager.ts`, `contextHandoff.ts`, `systemPrompt.ts`, `roleNormalizer.ts`, `responsesInputSanitizer.ts`, `toolSchemaSanitizer.ts`, `toolLimitDetector.ts`, `thinkingBudget.ts` |
| Tier / manifest     | `tierResolver.ts`, `tierConfig.ts`, `tierDefaults.json`, `tierTypes.ts`, `manifestAdapter.ts`                                                                                                                                                     |
| IP / شبکه           | `ipFilter.ts`, `webSearchFallback.ts`                                                                                                                                                                                                             |
| Batch               | `batchProcessor.ts`                                                                                                                                                                                                                               |
| استفاده             | `usage.ts`                                                                                                                                                                                                                                        |

### 4.6 `open-sse/mcp-server/`

- **۳۱ ابزار ثبت‌شده** سیم‌کشی‌شده در `server.ts` (۱۲ تا تحت scope در `schemas/tools.ts`،
  ۵ ابزار فشرده‌سازی، ۳ ابزار حافظه، ۴ ابزار skill، به اضافه ابزارهای پیشرفته اضافه‌شده
  از طریق `advancedTools.ts`).
- **۳ transport**: stdio, HTTP Streamable, SSE.
- **۱۳ scope** اعلان‌شده در `src/shared/constants/mcpScopes.ts`.
- جدول audit: `mcp_tool_audit` (توسط `audit.ts` پر می‌شود).
- فایل‌ها: `server.ts`, `index.ts`, `httpTransport.ts`, `audit.ts`, `scopeEnforcement.ts`,
  `runtimeHeartbeat.ts`, `descriptionCompressor.ts`, `schemas/{tools, a2a, audit, index}.ts`,
  `tools/{advancedTools, compressionTools, memoryTools, skillTools}.ts`,
  به اضافه آزمون‌ها زیر `__tests__/`.
- به [MCP-SERVER.md](../frameworks/MCP-SERVER.md) برای کاتالوگ کامل ابزار مراجعه کنید.

### 4.7 `open-sse/config/`

رجیستری‌های provider (`providerRegistry.ts`, `providerModels.ts`,
`providerHeaderProfiles.ts`)، رجیستری‌های مدل به‌فرمت (`audioRegistry.ts`,
`embeddingRegistry.ts`, `imageRegistry.ts`, `moderationRegistry.ts`,
`musicRegistry.ts`, `rerankRegistry.ts`, `searchRegistry.ts`, `videoRegistry.ts`),
helper‌های هویت (`codexIdentity.ts`, `codexInstructions.ts`,
`anthropicHeaders.ts`, `antigravityUpstream.ts`, `antigravityModelAliases.ts`,
`cliFingerprints.ts`, `toolCloaking.ts`, `defaultThinkingSignature.ts`),
helper‌های credential (`credentialLoader.ts`, `codexClient.ts`) و آداپتورهای
cloud (`azureAi.ts`, `bedrock.ts`, `datarobot.ts`, `glmProvider.ts`,
`maritalk.ts`, `oci.ts`, `petals.ts`, `runway.ts`, `sap.ts`, `watsonx.ts`,
`ollamaModels.ts`, `errorConfig.ts`, `constants.ts`, `registryUtils.ts`).

### 4.8 `open-sse/utils/`

پرimitive‌های streaming و helper‌های provider: `stream.ts`, `streamHandler.ts`,
`streamHelpers.ts`, `streamPayloadCollector.ts`, `streamReadiness.ts`,
`sseHeartbeat.ts`, `proxyFetch.ts`, `proxyDispatcher.ts`, `tlsClient.ts`,
`networkProxy.ts`, `awsSigV4.ts`, `cacheControlPolicy.ts`,
`cursorChecksum.ts`, `cursorAgentProtobuf.ts`, `cursorVersionDetector.ts`,
`comfyuiClient.ts`, `kieTask.ts`, `bypassHandler.ts`, `aiSdkCompat.ts`,
`thinkTagParser.ts`, `urlSanitize.ts`, `usageTracking.ts`, `requestLogger.ts`,
`progressTracker.ts`, `cors.ts`, `error.ts`, `logger.ts`, `sleep.ts`,
`ollamaTransform.ts`.

---

## ۵. `electron/` — wrapper دسکتاپ

```
electron/
├── main.js                  Electron main process
├── preload.js               Preload bridge (contextIsolation enabled)
├── types.d.ts
├── package.json             electron-builder config, version 3.8.0
├── README.md
├── assets/                  Build resources (icons, entitlements, …)
├── node_modules/            Dedicated node_modules (better-sqlite3, electron-updater)
└── dist-electron/           Build output (not committed)
```

پنج اسکریپت npm در ریشه workspace: `electron:dev`, `electron:build`,
`electron:build:{win,mac,linux}`, `electron:smoke:packaged`. auto-update از طریق
`electron-updater` به feed انتشار GitHub اشاره می‌کند.

---

## ۶. `bin/` — CLI

```
bin/
├── omniroute.mjs           Main CLI entry (Node ESM)
├── reset-password.mjs      Reset the management password from CLI
├── mcp-server.mjs          MCP server launcher (stdio)
├── nodeRuntimeSupport.mjs  Node version guard
└── cli/
    ├── program.mjs         Commander program builder
    ├── runtime.mjs         withRuntime helper (server-first/db-fallback)
    ├── output.mjs          Output formatters (json/jsonl/table/csv)
    ├── i18n.mjs            t() helper with locales
    ├── api.mjs             API fetch helper
    ├── data-dir.mjs
    ├── encryption.mjs
    ├── sqlite.mjs
    └── commands/
        ├── registry.mjs    Command registration
        ├── setup.mjs
        ├── doctor.mjs
        ├── providers.mjs
        └── ...             (one file per command/group)
```

دو باینری در `package.json` ← `bin` نمایش داده می‌شوند:

- `omniroute` → `bin/omniroute.mjs`
- `omniroute-reset-password` → `bin/reset-password.mjs`

---

## ۷. `tests/`

| دایرکتوری                                                                      | نوع                                                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `tests/unit/`                                                                  | آزمون واحد از طریق Node native test runner (۱۸۲۱ فایل، به اضافه زیردایرکتوری‌های `api/`، `auth/`، `authz/`) |
| `tests/integration/`                                                           | آزمون‌های چندماژولی + DB-state                                                               |
| `tests/e2e/`                                                                   | آزمون UI Playwright                                                                         |
| `tests/protocols-e2e/`                                                         | e2e پروتکل MCP/A2A                                                                        |
| `tests/translator/`                                                            | آزمون‌های خاص translator                                                                   |
| `tests/security/`                                                              | regression‌های امنیتی                                                                        |
| `tests/load/`                                                                  | آزمون‌های بار / استرس                                                                       |
| `tests/golden-set/`                                                            | خروجی‌های مرجع برای regression‌های translator                                                |
| `tests/helpers/`, `tests/fixtures/`, `tests/manual/`, `tests/scratch_test.mjs` | پشتیبانی                                                                                     |

دستورات رایج:

| دستور                                                   | چه چیزی اجرا می‌کند                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run test:unit`                                     | همه `tests/unit/*.test.ts` از طریق Node test runner (همزمانی ۱۰) |
| `npm run test:vitest`                                   | suite Vitest (MCP, autoCombo, cache)                             |
| `npm run test:e2e`                                      | suite UI Playwright                                              |
| `npm run test:protocols:e2e`                            | e2e پروتکل MCP + A2A                                            |
| `npm run test:coverage`                                 | gate پوشش (≥۶۰٪ lines/statements/functions/branches)             |
| `node --import tsx/esm --test tests/unit/<file>.test.ts`| اجرای تک‌فایل                                                    |

---

## ۸. `scripts/`

بر اساس هدف به ۶ زیرپوششه سازماندهی شده است.

- **`scripts/build/`** — `build-next-isolated.mjs`, `prepublish.ts`,
  `prepare-electron-standalone.mjs`, `pack-artifact-policy.ts`,
  `validate-pack-artifact.ts`, `postinstall.mjs`, `postinstallSupport.mjs`,
  `uninstall.mjs`, `bootstrap-env.mjs`, `runtime-env.mjs`,
  `native-binary-compat.mjs`.
- **`scripts/dev/`** — `run-next.mjs`, `run-next-playwright.mjs`,
  `run-standalone.mjs`, `standalone-server-ws.mjs`, `responses-ws-proxy.mjs`,
  `v1-ws-bridge.mjs`, `smoke-electron-packaged.mjs`,
  `run-playwright-tests.mjs`, `run-ecosystem-tests.mjs`,
  `run-protocol-clients-tests.mjs`, `sync-env.mjs`, `healthcheck.mjs`,
  `system-info.mjs`.
- **`scripts/check/`** — `check-cycles.mjs`, `check-docs-sync.mjs`,
  `check-docs-counts-sync.mjs`, `check-env-doc-sync.mjs`,
  `check-deprecated-versions.mjs`, `check-route-validation.mjs`,
  `check-t11-any-budget.mjs`, `check-pr-test-policy.mjs`,
  `check-supported-node-runtime.ts`, `test-report-summary.mjs`.
- **`scripts/docs/`** — `generate-docs-index.mjs`, `gen-provider-reference.ts`.
- **`scripts/i18n/`** — `generate-multilang.mjs`, `run-visual-qa.mjs`,
  `generate-qa-checklist.mjs`, `apply-priority-overrides.mjs`,
  `validate_translation.py`, `check_translations.py`, `i18n_autotranslate.py`,
  `untranslatable-keys.json`.
- **`scripts/ad-hoc/`** — `cursor-tap.cjs`, `sync-cursor-models.mjs`,
  `migrate-env.mjs`, `dbsetup.js`.

---

## ۹. خط لوله درخواست (خلاصه)

![خط لوله درخواست (/v1/chat/completions)](../diagrams/exported/request-pipeline.svg)

> منبع: [diagrams/request-pipeline.mmd](../diagrams/request-pipeline.mmd)

```
Client request
  → /v1/chat/completions (route.ts)
     CORS preflight check
     Zod validation (chatCompletionsSchema in shared/validation/schemas.ts)
     Auth (extractApiKey + isValidApiKey OR requireManagementAuth)
     Policy engine (src/server/authz/pipeline.ts)
     Guardrails (PII masker, prompt injection, vision bridge)
  → handleChatCore() (open-sse/handlers/chatCore.ts)
     Cache check (semantic + read cache)
     Rate limit (rateLimitManager, accountSemaphore)
     Combo routing (if model resolves to a combo)
       comboResolver → loop per target → handleSingleModel()
     translateRequest()  (open-sse/translator/request/*)
     getExecutor(providerId).execute()  (open-sse/executors/*)
       fetch upstream → retry/backoff via accountFallback
     translateResponse() (open-sse/translator/response/*)
     SSE stream OR JSON response
     If Responses API: TransformStream via open-sse/transformer/responsesTransformer.ts
  → Compliance audit (src/lib/compliance/)
  → Response to client
```

### حالت runtime تاب‌آوری (سه مکانیسم)

| مکانیسم                 | دامنه                         | کجا                                                                                                        |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| مدارشکنی provider       | کل provider                | `src/shared/utils/circuitBreaker.ts`، در `domain_circuit_breakers` پایا                                  |
| cooldown اتصال          | یک حساب/کلید               | `markAccountUnavailable()` در `src/sse/services/auth.ts`؛ توسط `accountFallback.checkFallbackError()` مصرف می‌شود |
| قفل مدل            | Provider + connection + model | `open-sse/services/accountFallback.ts`، در `domain_lockout_state` پایا                                  |

به [RESILIENCE_GUIDE.md](./RESILIENCE_GUIDE.md) و بخش اختصاصی در
[CLAUDE.md](../../CLAUDE.md) مراجعه کنید.

---

## ۱۰. نحوه مشارکت

### افزودن یک provider جدید

1. در `src/shared/constants/providers.ts` ثبت کنید (در زمان load با Zod اعتبارسنجی می‌شود).
2. یک executor در `open-sse/executors/` اضافه کنید اگر logic سفارشی لازم است
   (`BaseExecutor` را extend کنید).
3. یک translator در `open-sse/translator/` اضافه کنید اگر با فرمت OpenAI صحبت نمی‌کند.
4. اگر مبتنی‌بر OAuth است، پیکربندی زیر `src/lib/oauth/providers/` و
   `src/lib/oauth/services/` اضافه کنید.
5. مدل‌ها در `open-sse/config/providerRegistry.ts` (یا رجیستری خاص-فرمت زیر
   `open-sse/config/`) ثبت کنید.
6. آزمون‌ها زیر `tests/unit/` بنویسید.

### افزودن یک مسیر API جدید

1. `src/app/api/your-route/route.ts` بسازید.
2. الگو را دنبال کنید: CORS ← اعتبارسنجی بدنه Zod ← auth ← تفویض handler.
3. اگر شکل درخواست جدید است: schema Zod را در `src/shared/validation/schemas.ts` اضافه کنید.
4. اگر فقط management است: مسیر را به `src/shared/constants/publicApiRoutes.ts` اضافه کنید
   (denylist برای سطح API عمومی).
5. آزمون‌ها زیر `tests/unit/` اضافه کنید.
6. `docs/reference/API_REFERENCE.md` و `docs/openapi.yaml` را به‌روزرسانی کنید.

### افزودن یک ماژول DB جدید

1. `src/lib/db/yourModule.ts` بسازید و `getDbInstance()` را از `./core.ts` import کنید.
2. توابع CRUD برای domain خود را export کنید.
3. اگر جدول‌های جدید است: یک مهاجرت زیر `src/lib/db/migrations/` اضافه کنید، به‌طور متوالی
   شماره‌گذاری شده، idempotent، transactional.
4. از `src/lib/localDb.ts` re-export کنید (فقط re-export — **بدون logic**).
5. آزمون‌ها زیر `tests/unit/` اضافه کنید.

### افزودن یک ابزار MCP جدید

1. تعریف ابزار را زیر `open-sse/mcp-server/tools/` اضافه کنید (یا
   `open-sse/mcp-server/schemas/tools.ts` را extend کنید).
2. scope‌(های) مناسب را در `src/shared/constants/mcpScopes.ts` اختصاص دهید.
3. ابزار را در `open-sse/mcp-server/server.ts` ثبت کنید.
4. آزمون‌ها زیر `open-sse/mcp-server/__tests__/` اضافه کنید.
5. [MCP-SERVER.md](../frameworks/MCP-SERVER.md) را به‌روزرسانی کنید.

### افزودن یک skill A2A جدید

به [A2A-SERVER.md § افزودن یک Skill جدید](../frameworks/A2A-SERVER.md) مراجعه کنید. skill‌ها در
`src/lib/a2a/skills/` قرار دارند و از طریق task manager A2A ثبت می‌شوند.

---

## ۱۱. قراردادها

- **سبک کد**: تورفتگی ۲-فضا، کوتیشن دوتایی، عرض ۱۰۰ کاراکتر، سemicolon،
  کاماهای انتهایی `es5` — توسط Prettier از طریق `lint-staged` اعمال می‌شود.
- **Import‌ها**: external ← internal (`@/`, `@omniroute/open-sse`) ← relative.
- **نام‌گذاری**: فایل‌ها `camelCase` یا `kebab-case`، مؤلفه‌ها `PascalCase`،
  ثابت‌ها `UPPER_SNAKE`.
- **ESLint**: `no-eval`, `no-implied-eval`, `no-new-func` = `error` در همه جا؛
  `no-explicit-any` = `warn` در `open-sse/` و `tests/`، در غیر این صورت error.
- **TypeScript**: `strict: false` (وضعیت legacy). بر explicit types به inference
  برای مرزهای بین-ماژولی ترجیح دهید.
- **پایگاه داده**: هرگز SQL raw در مسیرها یا handler‌ها ننویسید — همیشه از
  ماژول‌های `src/lib/db/` عبور کنید. هرگز logic به `src/lib/localDb.ts` اضافه نکنید.
- **تایپ DB-entity (#3512)**: تابعی که شکل ردیف یک جدول DB را می‌نویسد یا می‌خواند
  باید یک interface TS نام‌گذاری‌شده بگیرد/برگرداند که ستون‌های آن جدول را ۱:۱ منعکس می‌کند،
  نه `any` یا یک نوع anonymous inline در call site. interface را کنار تابع
  قرار دهید (مثلاً `export interface UsageEntry` در
  `src/lib/usage/usageHistory.ts` بالای `saveRequestUsage`)، فیلدهای فردی را
  وقتی writer‌های مختلف ردیف را به‌طور افزایشی پر می‌کنند اختیاری/nullable نگه دارید،
  و `unknown` را به `any` برای فیلدی که شکل آن بین فراخوان‌ها متفاوت است ترجیح دهید
  (روی فیلد مستند شده، مثلاً `UsageEntry.tokens`
  هم usage شکل‌دار provider و هم شکل نرمال‌شده را می‌پذیرد). وقتی تعداد `any` یک فایل
  به این ترتیب به صفر برسد، آن را به
  allowlist `check:any-budget:t11` (`scripts/check/check-t11-any-budget.mjs`،
  `maxAny: 0`) اضافه کنید تا نتواند regress کند. این یک قرارداد اولیه است — پاکسازی
  گسترده‌تر «بدون `any` anonymous» به‌صورت iterativa در بقیه codebase انجام می‌شود.
- **خطاها**: try/catch با انواع خطای خاص، ثبت با context pino. هرگز
  خطاها را در استریم‌های SSE به‌صورت بی‌صدا بلع نکنید؛ از abort signal برای پاکسازی استفاده کنید.
- **امنیت**: هرگز از `eval()` / `new Function()` / implied eval استفاده نکنید. همه
  ورودی‌ها را با Zod اعتبارسنجی کنید. credential‌ها را در حال ساکن (AES-256-GCM) رمزنگاری کنید.
  denylist `src/shared/constants/upstreamHeaders.ts` را با
  لایه sanitize/اعتبارسنجی هم‌رنگ نگه دارید.
- **Commit‌ها**: Conventional Commits — `feat(scope): subject`. scope‌های مجاز:
  `db`, `sse`, `oauth`, `dashboard`, `api`, `cli`, `docker`, `ci`, `mcp`,
  `a2a`, `memory`, `skills`.
- **شاخه‌ها**: پیشوندها `feat/`, `fix/`, `refactor/`, `docs/`, `test/`,
  `chore/`. هرگز مستقیماً به `main` commit نکنید.
- **Husky**: pre-commit اجرا می‌کند `lint-staged` + `check:docs-sync` +
  `check:any-budget:t11`; pre-push اجرا می‌کند `check:any-budget:t11` + `check:tracked-artifacts` (gate‌های سریع؛ شامل `test:unit` نمی‌شود).

---

## ۱۲. قواعد سخت (از CLAUDE.md)

1. هرگز secret یا credential را commit نکنید.
2. هرگز logic به `src/lib/localDb.ts` اضافه نکنید.
3. هرگز از `eval()` / `new Function()` / implied eval استفاده نکنید.
4. هرگز مستقیماً به `main` commit نکنید.
5. هرگز SQL raw در مسیرها ننویسید — همیشه از ماژول‌های `src/lib/db/` عبور کنید.
6. هرگز خطاها را در استریم‌های SSE به‌صورت بی‌صدا بلع نکنید.
7. همیشه ورودی‌ها را با schema‌های Zod اعتبارسنجی کنید.
8. همیشه هنگام تغییر کد تولید، آزمون شامل کنید.
9. پوشش باید ≥ ۶۰٪ باقی بماند (statements, lines, functions, branches).

---

## ۱۳. مراجع دیگر

- [ARCHITECTURE.md](./ARCHITECTURE.md) — معماری سطح‌بالا و مسئولیت‌های ماژول.
- [API_REFERENCE.md](../reference/API_REFERENCE.md) — مرجع API عمومی + مدیریت.
- [FEATURES.md](../guides/FEATURES.md) — ماتریس ویژگی و نکات برجسته نسخه.
- [RESILIENCE_GUIDE.md](./RESILIENCE_GUIDE.md) — مدارشکنی، cooldown،
  بررسی عمیق lockout.
- [AUTO-COMBO.md](../routing/AUTO-COMBO.md) — امتیازدهی و استراتژی‌های Auto Combo.
- [MCP-SERVER.md](../frameworks/MCP-SERVER.md) — کاتالوگ کامل ابزار MCP + transport‌ها.
- [A2A-SERVER.md](../frameworks/A2A-SERVER.md) — skill‌های پروتکل A2A و کشف.
- [COMPRESSION_GUIDE.md](../compression/COMPRESSION_GUIDE.md) — فشرده‌سازی RTK + Caveman.
- [CLI-TOOLS.md](../reference/CLI-TOOLS.md) — ادغام‌های CLI.
- [ELECTRON_GUIDE.md](../guides/ELECTRON_GUIDE.md) (در صورت وجود)، [DOCKER_GUIDE.md](../guides/DOCKER_GUIDE.md)، [FLY_IO_DEPLOYMENT_GUIDE.md](../ops/FLY_IO_DEPLOYMENT_GUIDE.md)، [VM_DEPLOYMENT_GUIDE.md](../ops/VM_DEPLOYMENT_GUIDE.md)، [TERMUX_GUIDE.md](../guides/TERMUX_GUIDE.md)، [PWA_GUIDE.md](../guides/PWA_GUIDE.md) — اهداف استقرار.
- [TROUBLESHOOTING.md](../guides/TROUBLESHOOTING.md) — مسائل عملیاتی رایج.
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — جریان کاری مشارکت‌کننده.
- [CLAUDE.md](../../CLAUDE.md) — قواعد مخزن برای Claude Code (منبع حقیقت
  برای بسیاری از قراردادهای بالا).
- [AGENTS.md](../../AGENTS.md) — مرجع معماری عمیق‌تر استفاده‌شده توسط agent‌ها.
