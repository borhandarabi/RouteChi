---
title: "نقشه مخزن"
version: 3.8.40
lastUpdated: 2026-06-28
---

# نقشه مخزن

> **توضیح یک‌خطی برای هر دایرکتوری و فایل ریشه.**
> آخرین به‌روزرسانی: 2026-06-28 — RouteChi v3.8.40
>
> از این نقشه برای پیمایش سریع codebase استفاده کنید. برای بررسی عمیق، لینک‌های مستندات اختصاصی را دنبال کنید.

## درخت سطح‌بالا

```
OmniRoute/
├── src/                  # Next.js 16 application (UI + API routes + libs + domain + server)
├── open-sse/             # Streaming engine workspace (handlers, executors, translator, MCP server)
├── electron/             # Desktop wrapper (Electron 41 + electron-builder 26.10)
├── bin/                  # CLI entry point and command handlers
├── scripts/              # Build, check, sync, and one-off scripts
├── docs/                 # Public documentation (you are here)
├── tests/                # All test suites (unit, integration, e2e, protocols-e2e)
├── public/               # Next.js static assets, PWA manifest, service worker, icons
├── config/               # Static config + quality-gate state (i18n, payloadRules, quality/)
├── images/               # Marketing / README image assets
├── @omniroute/           # Publishable companion packages (opencode-plugin, opencode-provider)
├── skills/               # CLI/agent skill packs (cli-* + omni-* + config-codex-cli)
├── examples/             # Sample plugins + omniroute-cmd-hello starter
├── contrib/              # Community contributions (podman/)
├── .source/              # Fumadocs source config (source.config.mjs + server/browser/dynamic)
├── .github/              # GitHub Actions workflows + issue templates + PR template
├── .husky/               # Git hooks (pre-commit, pre-push)
├── .claude/              # Claude Code slash commands (project-scoped)
├── .agents/              # Codex / generic agent workflows + skills (mirror of .claude/)
├── .vscode/              # VS Code workspace settings
├── _ideia/               # Planning notes (informal; not shipped)
├── _mono_repo/           # Historic subprojects (cloud, site, vscode-extension)
├── _references/          # Read-only reference clones from related OSS projects
├── _tasks/               # Per-release task tracking files (informal)
├── .build/ .worktrees/ dist/   # local build / git-worktree / build-output scratch (gitignored)
├── .issues/              # Local issue cache (gitignored)
├── .playwright-mcp/      # Playwright MCP test artifacts
├── coverage/             # c8 coverage output (gitignored)
├── logs/                 # Runtime logs (gitignored)
├── node_modules/         # Dependencies (gitignored)
├── package/              # npm pack staging area (build artifact)
├── .next/                # Next.js build output (gitignored)
└── (root files — see below)
```

---

## فایل‌های ریشه

| فایل                                        | هدف                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| **README.md**                               | صفحه فرود بازاریابی + شروع سریع + ماتریس ویژگی (همچنین به `llm.txt` مراجعه کنید)               |
| **CHANGELOG.md**                            | changelog به‌ازای-انتشار (تولید خودکار توسط skill `/version-bump-cc`)                       |
| **LICENSE**                                 | متن لایسنس MIT                                                                         |
| **CLAUDE.md**                               | قواعد پروژه برای agent‌های Claude Code (قواعد سخت، قراردادها، سناریوها)                |
| **AGENTS.md**                               | مانند CLAUDE.md اما برای agent‌های AI غیر-Claude (Codex، Cursor، و غیره)                     |
| **GEMINI.md**                               | قواعد مختصر برای agent‌های مبتنی‌بر Gemini (زیرمجموعه‌ای از CLAUDE.md)                              |
| **CONTRIBUTING.md**                         | راهنمای مشارکت‌کننده: راه‌اندازی، commit‌های متعارف، آزمون، جریان PR                         |
| **SECURITY.md**                             | سیاست گزارش آسیب‌پذیری، نسخه‌های پشتیبانی‌شده، مدل تهدید                         |
| **CODE_OF_CONDUCT.md**                      | Contributor Covenant — انتظارات رفتار جامعه                                  |
| **llm.txt**                                 | صفحه فرود متن-ساده برای خزشگرهای LLM بهینه‌شده (SEO برای دستیاران AI)                    |
| **package.json**                            | manifest npm، اسکریپت‌ها، وابستگی‌ها، engines، gate پوشش c8                           |
| **package-lock.json**                       | درخت وابستگی قفل‌شده                                                                   |
| **tsconfig.json**                           | پیکربندی TypeScript ریشه                                                                   |
| **tsconfig.typecheck-core.json**            | پیکربندی typecheck برای core `src/`                                                        |
| **tsconfig.typecheck-noimplicit-core.json** | typecheck سخت (`noImplicitAny`)                                                       |
| **tsconfig.tsbuildinfo**                    | cache ساخت افزایشی TS (gitignored)                                                  |
| **next.config.mjs**                         | پیکربندی ساخت Next.js 16 (خروجی standalone)                                       |
| **next-env.d.ts**                           | انواع env تولیدشده خودکار Next.js                                                         |
| **eslint.config.mjs**                       | ESLint flat config (قواعد به‌ازای-ناحیه پروژه)                                              |
| **prettier.config.mjs**                     | قواعد قالب‌بندی Prettier                                                                |
| **postcss.config.mjs**                      | پیکربندی PostCSS برای خط لوله Tailwind/CSS                                                 |
| **playwright.config.ts**                    | پیکربندی آزمون E2E Playwright                                                               |
| **vitest.config.ts**                        | پیکربندی Vitest (suite پیش‌فرض)                                                            |
| **vitest.mcp.config.ts**                    | پیکربندی Vitest برای suite‌های MCP server / autoCombo / cache                                  |
| **sonar-project.properties**                | پیکربندی SonarQube/SonarCloud (کیفیت کد)                                               |
| **Dockerfile**                              | ساخت Docker چندمرحله‌ای (builder → runner-base → runner-cli)                            |
| **docker-compose.yml**                      | compose توسعه با ۴ پروفایل (base، cli، host، cliproxyapi) + سایدکار redis               |
| **docker-compose.prod.yml**                 | compose تولید (پورت 20130، redis، volume‌های نام‌گذاری‌شده)                                    |
| **.dockerignore**                           | فایل‌های مستثنی از context Docker                                                       |
| **fly.toml**                                | پیکربندی استقرار Fly.io (منطقه `sin`، پورت 20128، volume /data)                        |
| **.env.example**                            | فایل env قالب (در اولین نصب به‌طور خودکار به `.env` کپی می‌شود)                               |
| **.gitignore**                              | الگوهای ignore گیت                                                                      |
| **.npmignore**                              | فهرست مستثنی انتشار npm                                                               |
| **.npmrc**                                  | پیکربندی npm (رجیستری، سیاست lockfile)                                                   |
| **.node-version**                           | پین نسخه Node (توسط ابزارهای سازگار با nvm استفاده می‌شود)                                          |
| **.nvmrc**                                  | پین نسخه Node برای nvm                                                                 |
| **eslint.complexity.config.mjs**            | پیکربندی ESLint برای ratchet پیچیدگی (`scripts/check/check-complexity.mjs --config`) |
| **eslint.sonarjs.config.mjs**               | پیکربندی ESLint برای قواعد SonarJS (پیچیدگی شناختی / تکرار)                     |
| **source.config.ts**                        | پیکربندی منبع `defineDocs` Fumadocs (feeds `.source/`)                                   |
| **knip.json**                               | پیکربندی Knip — فایل‌های/export‌های/وابستگی‌های استفاده‌نشده (feeds dead-code gate)                     |
| **stryker.conf.json**                       | پیکربندی mutation-testing Stryker                                                          |
| **.size-limit.json**                        | پیکربندی بودجه bundle size-limit                                                          |
| **promptfooconfig.yaml**                    | پیکربندی ارزیابی promptfoo                                                                    |
| **.gitleaks.toml**                          | مجموعه‌قواعد اسکن secret گitleaks                                                             |
| **.zizmor.yml**                             | پیکربندی security-lint GitHub-Actions زizmor                                               |
| **socket.yml**                              | پیکربندی زنجیره تأمین Socket.dev                                                           |
| **news.json**                               | فید release-notes درون‌برنامه‌ای (خوانده‌شده توسط `src/shared/utils/releaseNotes.ts`)                   |
| **flake.nix** / **flake.lock**              | تعریف + قفل Nix dev-shell                                                              |
| **.env**                                    | secret‌های محلی (gitignored — تولیدشده از `.env.example`)                               |

> **در v3.8.26 از ریشه منتقل‌شده (مرتب‌سازی):**
>
> - **→ `config/quality/`:** `quality-baseline.json`، `complexity-baseline.json`، `duplication-baseline.json`، `file-size-baseline.json`، `test-discovery-baseline.json`، `dependency-allowlist.json`، `.license-allowlist.json` و `quality-metrics.json` تولیدشده (gitignored). به [`## config/`](#config--static-configs--quality-gate-state) مراجعه کنید.

---

## `src/` — اپلیکیشن Next.js

```
src/
├── app/                 # App Router (pages + API routes + status pages + landing)
├── lib/                 # Core libraries / domain modules (~50 subdirs + ~30 top-level files)
├── domain/              # Pure domain logic (policy engine, fallback, cost, lockout, comboResolver, assessment)
├── server/              # Server-only modules (authz pipeline, cors, auth middleware) — cannot import from client
├── shared/              # Shared between server and client where safe (constants, types, validation, contracts, utils)
├── i18n/                # next-intl config + per-locale message JSON (30+ locales)
├── middleware/          # Next.js middleware (request enrichment, locale detection)
├── mitm/                # MITM proxy core: cert gen/install, handlers, targets, inspector, masks, passthrough
│   ├── handlers/        # 9 IDE-agent handler classes extending MitmHandlerBase (antigravity, kiro, copilot, codex, cursor, zed, claudeCode, openCode, trae)
│   └── inspector/       # Traffic capture layer: buffer (in-memory ring), sseMerger, conversationNormalizer, kindDetector, contextKey, httpProxyServer, systemProxyConfig
├── models/              # Model adapter glue (legacy shim)
├── scripts/             # In-tree maintenance scripts (e.g., backfillAggregation)
├── sse/                 # Legacy SSE handlers/services (chat.ts, chatHelpers.ts, services/auth.ts)
├── store/               # Legacy in-memory store (being phased out for src/lib/db)
├── types/               # Shared TS type files
├── instrumentation.ts   # Next.js telemetry hook (browser + edge)
├── instrumentation-node.ts  # Node-only instrumentation
├── server-init.ts       # Server bootstrap (DB migrations, jobs, cleanup)
└── proxy.ts             # HTTP-proxy entry shim
```

### `src/app/` — App Router (Next.js 16)

| مسیر                                                                         | هدف                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/v1/`                                                                | API عمومی سازگار با OpenAI (~۲۵ sub-route: chat، completions، embeddings، files، batches، audio، images، videos، music، rerank، moderations، search، ws، agents، accounts، providers، و غیره)                                                                                                                         |
| `app/api/v1beta/`                                                            | endpoint‌های API سبک Gemini                                                                                                                                                                                                                                                                                         |
| `app/api/playground/`                                                        | مسیرهای Playground Studio: `improve-prompt/` (POST — بازنویس prompt LLM)، `presets/` (GET list / POST create)، `presets/[id]/` (GET / PUT / DELETE) — به `docs/frameworks/PLAYGROUND_STUDIO.md` مراجعه کنید                                                                                                                   |
| `app/api/` (non-v1)                                                          | مسیرهای management/admin (~۶۰ دایرکتوری: providers، combos، settings، mcp، a2a، evals، memory، skills، webhooks، compliance، resilience، monitoring، tunnels، cli-tools، و غیره)                                                                                                                                    |
| `app/api/tools/agent-bridge/`                                                | REST API AgentBridge — ۱۲ مسیر (کنترل سرور، حالت agent/DNS/mapping‌ها، bypass، cert، upstream-CA). LOCAL_ONLY + SPAWN_CAPABLE. به `docs/frameworks/AGENTBRIDGE.md §7` مراجعه کنید.                                                                                                                                       |
| `app/api/tools/traffic-inspector/`                                           | REST + WS API Traffic Inspector — ۱۶+ مسیر (requests، sessions، hosts، capture-modes، export، ws). LOCAL_ONLY + SPAWN_CAPABLE. به `docs/frameworks/TRAFFIC_INSPECTOR.md §8` مراجعه کنید.                                                                                                                                    |
| `app/a2a/`                                                                   | نقطه ورود A2A JSON-RPC 2.0 (`POST /a2a`)                                                                                                                                                                                                                                                                         |
| `app/.well-known/agent.json/`                                                | A2A Agent Card (کشف)                                                                                                                                                                                                                                                                                         |
| `app/(dashboard)/dashboard/`                                                 | صفحات UI داشبورد (~۳۵ صفحه: providers، combos، settings، memory، skills، webhooks، evals، audit، batch، cache، costs، health، system، activity، و غیره)                                                                                                                                                           |
| `app/(dashboard)/dashboard/search-tools/`                                    | UI Search Tools Studio (۳ تب: Search/Scrape/Compare + SearchConceptCard + ProviderCatalog) — به `docs/frameworks/SEARCH_TOOLS_STUDIO.md` مراجعه کنید                                                                                                                                                                        |
| `app/(dashboard)/dashboard/memory/`                                          | Memory Studio (plan 21): `page.tsx` (shell ۳-تبی)، `components/` (MemoryConceptCard، MemoryEngineStatus، EmbeddingSourceSelector، EditMemoryModal، RetrievePreview، QdrantConfigCard، RerankConfigCard)، `components/tabs/` (MemoriesTab، PlaygroundTab، EngineTab)، `hooks/` (useEngineStatus، useMemorySettings) |
| `app/(dashboard)/dashboard/tools/agent-bridge/`                              | صفحه داشبورد AgentBridge — کارت سرور، ۹ کارت agent، wizard راه‌اندازی، mapping مدل، فهرست bypass. i18n PT-BR + EN. به `docs/frameworks/AGENTBRIDGE.md` مراجعه کنید.                                                                                                                                                          |
| `app/(dashboard)/dashboard/tools/traffic-inspector/`                         | صفحه داشبورد Traffic Inspector — DevTools split، ۷ تب جزئیات، ۴ toggle حالت capture، ضبط‌کننده نشست، colorization context. i18n PT-BR + EN. به `docs/frameworks/TRAFFIC_INSPECTOR.md` مراجعه کنید.                                                                                                                     |
| `app/(dashboard)/dashboard/activity/`                                        | صفحه فید Activity (Group B): `page.tsx` (سرور) + `ActivityFeedClient.tsx` + `components/{ActivityFeed,ActivityItem,DayHeader,EventTypeFilter}.tsx` — به `docs/architecture/MONITORING_SECTIONS.md` مراجعه کنید                                                                                                             |
| `app/(dashboard)/dashboard/costs/quota-share/`                               | صفحه Quota Sharing (Group B): `QuotaSharePageClient.tsx` + `components/{PoolCard,DimensionBar,AllocationTable,BurnRateChart,QuotaConceptCard,CreatePoolModal,EditAllocationsModal}.tsx` + `hooks/{usePools,usePoolUsage,useLocalStoragePoolMigration}.ts`                                                          |
| `app/(dashboard)/dashboard/costs/quota-share/plans/`                         | صفحه پیکربندی plan provider (Group B): `page.tsx` + `ProviderPlanConfigClient.tsx` — override ابعاد سهمیه به‌ازای اتصال                                                                                                                                                                                        |
| `app/docs/`                                                                  | نمایشگر مستندات تعبیه‌شده (renders `docs/*.md`)                                                                                                                                                                                                                                                                |
| `app/landing/`                                                               | صفحه فرود بازاریابی                                                                                                                                                                                                                                                                                             |
| `app/login/`, `forgot-password/`, `forbidden/`                               | صفحات مرتبط با احراز هویت                                                                                                                                                                                                                                                                                                 |
| `app/{400,401,403,408,429,500,502,503}/`                                     | صفحات خطای HTTP                                                                                                                                                                                                                                                                                                   |
| `app/maintenance/`, `offline/`, `status/`, `privacy/`, `terms/`, `callback/` | صفحات static/status                                                                                                                                                                                                                                                                                                |
| `app/layout.tsx`, `page.tsx`, `manifest.ts`, `globals.css`                   | Root layout، home، manifest PWA، CSS سراسری                                                                                                                                                                                                                                                                        |
| `app/error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`          | مرزهای خطا                                                                                                                                                                                                                                                                                                   |

### `src/lib/` — کتابخانه‌های اصلی (~۵۰ ماژول)

| ماژول                                   | هدف                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a2a/`                                   | task manager پروتکل A2A، skill‌ها (۵)، streaming                                                                                                                                                                                                                                                                        |
| `acp/`                                   | CLI Agent Registry (کشف CLI محلی — به `docs/frameworks/AGENT_PROTOCOLS_GUIDE.md` مراجعه کنید)                                                                                                                                                                                                                               |
| `api/`                                   | helper‌های API مشترک (`requireManagementAuth`، اعتبارسنجی)                                                                                                                                                                                                                                                                |
| `auth/`                                  | نشست، hashing رمز عبور، اعتبارسنجی token                                                                                                                                                                                                                                                                             |
| `batches/`                               | handler‌های OpenAI Batches API                                                                                                                                                                                                                                                                                             |
| `catalog/`                               | اعتبارسنجی Zod کاتالوگ provider + حل قابلیت                                                                                                                                                                                                                                                                 |
| `cloudAgent/`                            | Cloud Agents (Codex Cloud، Devin، Jules) — به `docs/frameworks/CLOUD_AGENT.md` مراجعه کنید                                                                                                                                                                                                                                         |
| `combos/`                                | حل combo + helper‌های ترتیب‌بندی مجدد                                                                                                                                                                                                                                                                                      |
| `audit/`                                 | helper‌های فید Activity: `highLevelActions.ts` (allowlist + `isHighLevelAction()`)، `activityIcons.ts` (نقشه action → icon/verb)، `timeline.ts` (groupByDay/relativeTime) — به `docs/architecture/MONITORING_SECTIONS.md` مراجعه کنید                                                                                                 |
| `compliance/`                            | گزارش ممیزی + provider audit — به `docs/security/COMPLIANCE.md` مراجعه کنید                                                                                                                                                                                                                                                          |
| `compression/`                           | چسب موتور فشرده‌سازی (موتورها در `open-sse/services/compression/`)                                                                                                                                                                                                                                              |
| `config/`                                | helper‌های پیکربندی runtime                                                                                                                                                                                                                                                                                                  |
| `db/`                                    | ۹۵+ ماژول DB domain + ۱۱۰+ مهاجرت (همیشه از اینجا برای SQLite عبور کنید)                                                                                                                                                                                                                                               |
| `quota/`                                 | Quota Sharing Engine: `dimensions.ts` (types/Zod)، `types.ts` (QuotaStore interface)، `sqliteQuotaStore.ts`، `redisQuotaStore.ts`، `storeFactory.ts`، `fairShare.ts`، `burnRate.ts`، `planResolver.ts`، `planRegistry.ts`، `saturationSignals.ts`، `enforce.ts`، `spendRecorder.ts` — به `docs/routing/QUOTA_SHARE.md` مراجعه کنید |
| `display/`                               | helper‌های قالب‌بندی UI (هزینه، تأخیر، و غیره)                                                                                                                                                                                                                                                                             |
| `embeddings/`                            | helper‌های سرویس embedding                                                                                                                                                                                                                                                                                              |
| `env/`                                   | تجزیه + اعتبارسنجی متغیر env                                                                                                                                                                                                                                                                                       |
| `evals/`                                 | چارچوب ارزیابی (suite‌ها، runner، runtime) — به `docs/frameworks/EVALS.md` مراجعه کنید                                                                                                                                                                                                                                               |
| `guardrails/`                            | PII masker، تزریق prompt، vision bridge — به `docs/security/GUARDRAILS.md` مراجعه کنید                                                                                                                                                                                                                                         |
| `jobs/`                                  | job‌های پس‌زمینه (شبیه cron)                                                                                                                                                                                                                                                                                             |
| `memory/`                                | حافظه مکالمه (SQLite FTS5 + sqlite-vec hybrid RRF + Qdrant tier 2) — به `docs/frameworks/MEMORY.md` مراجعه کنید                                                                                                                                                                                                           |
| `memory/embedding/`                      | لایه embedding چندمنبعی: `index.ts` (resolver)، `remote.ts`، `staticPotion.ts`، `transformersLocal.ts`، `cache.ts`، `types.ts` (plan 21)                                                                                                                                                                           |
| `memory/vectorStore.ts`                  | wrapper sqlite-vec v0.1.9 — KNN brute-force + hybrid RRF (FTS5 + vector، k=60). Lazy-init، وقتی sqlite-vec در دسترس نیست به‌طور نرم تنزل می‌یابد. (plan 21)                                                                                                                                                                   |
| `memory/reindex.ts`                      | `runReindexBatch()` — حافظه‌ها با `needs_reindex=1` را در پس‌زمینه پردازش می‌کند؛ توسط `POST /api/memory/reindex` و مسیر lazy-backfill فراخوانی می‌شود. (plan 21)                                                                                                                                                                   |
| `monitoring/`                            | بررسی‌های سلامت، انتشار معیار                                                                                                                                                                                                                                                                                         |
| `oauth/`                                 | جریان‌های OAuth برای ۱۴ provider (claude، codex، antigravity، cursor، github، gemini، kimi-coding، kilocode، cline، qwen، kiro، qoder، gitlab-duo، windsurf)                                                                                                                                                                |
| `plugins/`                               | رجیستری plugin                                                                                                                                                                                                                                                                                                         |
| `promptCache/`                           | breakpoint‌های prompt cache سبک Anthropic                                                                                                                                                                                                                                                                                |

### `src/db/` — پایگاه داده (۹۴ ماژول + ۱۰۶ مهاجرت)

| زیردایرکتوری                | هدف                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db/core.ts`              | singleton `getDbInstance()` با WAL journaling                                                                                                                            |
| `db/migrations/`          | فایل‌های SQL نسخه‌دار (idempotent، transactional). `073_memory_vec.sql` `memory_vec_meta` + ستون `needs_reindex` اضافه می‌کند (plan 21).                                           |
| `db/playgroundPresets.ts` | ماژول CRUD برای preset‌های Playground Studio (`listPlaygroundPresets`, `getPlaygroundPreset`, `createPlaygroundPreset`, `updatePlaygroundPreset`, `deletePlaygroundPreset`)   |
| `db/memoryVec.ts`         | CRUD برای `memory_vec_meta` (active_dim, embedding_signature, last_reset_at, vec_loaded) + `markMemoryNeedsReindex`, `getMemoryReindexQueue`, و غیره (plan 21)                |
| `db/<domain>.ts`          | یک ماژول به‌ازای domain: providers, combos, apiKeys, users, sessions, usage, audit*log, webhooks, skills, memory_entries, cloud_agent_tasks, evals*\*, reasoning_cache, و غیره. |

### `src/domain/`

| ماژول                 | هدف                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `policy.ts`            | موتور سیاست                                                           |
| `fallbackPolicy.ts`    | درخت تصمیم fallback                                                  |
| `costRules.ts`         | قواعد محاسبه هزینه                                                  |
| `lockoutPolicy.ts`     | سیاست قفل مدل/اتصال                                         |
| `tagRouter.ts`         | مسیریابی مبتنی‌بر-تگ                                                      |
| `comboResolver.ts`     | حل combo (توسط موتور combo استفاده می‌شود)                                 |
| `modelAvailability.ts` | بررسی دسترسی به‌ازای-مدل                                            |
| `assessment/`          | ارزیابی مدل (Phase 1 از RFC-AUTO-ASSESSMENT — به `docs/archive/` مراجعه کنید) |

### `src/server/`

| ماژول   | هدف                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------- |
| `authz/` | خط لوله احراز دسترسی: `classify` → `policies` → `enforce` — به `docs/architecture/AUTHZ_GUIDE.md` مراجعه کنید |
| `cors/`  | پیکربندی CORS                                                                                   |
| `auth/`  | میان‌افزار نشست                                                                                   |

### `src/shared/`

| ماژول                           | هدف                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `constants/providers.ts`         | **۲۳۶ provider** با اعتبارسنجی Zod (منبع حقیقت)                |
| `constants/cliTools.ts`          | رجیستری ابزار CLI خارجی                                             |
| `constants/routingStrategies.ts` | **۱۷ استراتژی مسیریابی** با اولویت‌ها                              |
| `constants/publicApiRoutes.ts`   | مسیرهایی که احراز هویت Bearer (در مقابل management) نیاز دارند                        |
| `constants/upstreamHeaders.ts`   | denylist هدر برای درخواست‌های upstream                                  |
| `validation/schemas.ts`          | حدود ۸۰ schema Zod (منبع واحد حقیقت برای قراردادهای API)             |
| `validation/helpers.ts`          | helper‌های اعتبارسنجی Zod (`validateBody`, و غیره)                          |
| `types/`                         | انواع TS مشترک                                                        |
| `contracts/`                     | قراردادهای API عمومی (مصرف‌شده توسط `files:` در `package.json`)          |
| `utils/circuitBreaker.ts`        | مدارشکنی provider (به `docs/architecture/RESILIENCE_GUIDE.md` مراجعه کنید) |
| `utils/apiAuth.ts`               | اعتبارسنجی API key، بررسی scope                                     |
| `utils/fetchTimeout.ts`          | wrapper‌های timeout/abort برای fetch upstream                              |

---

## `open-sse/` — workspace موتور streaming

workspace جداگانه npm (`@omniroute/open-sse`). پردازش درخواست + اجرای provider را مدیریت می‌کند.

```
open-sse/
├── handlers/            # 16 files (12 handlers + 4 helpers): chatCore, responsesHandler, embeddings, audio, image, video, music, rerank, moderations, search, etc.
├── executors/           # 67 provider-specific executors (extend BaseExecutor)
├── translator/          # Format converters (9 request, 9 response, 9 helpers)
├── transformer/         # Responses API ↔ Chat Completions (TransformStream)
├── services/            # ~80+ service modules (combo, accountFallback, autoCombo, reasoningCache, claude code/chatgpt stealth, modelDeprecation, taskAwareRouter, workflowFSM, etc.)
├── mcp-server/          # MCP server (94 tools, 3 transports, 30 scopes)
├── config/              # Provider/model registries, header config, model aliases
├── utils/               # TLS client, proxy fetch/dispatcher, network helpers
├── index.ts             # Workspace entry
├── package.json         # Workspace manifest
├── tsconfig.json        # Workspace TS config
└── types.d.ts           # Workspace type declarations
```

### `open-sse/mcp-server/`

| مسیر                        | هدف                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `server.ts`                 | چرخه حیات سرور MCP (transport‌های stdio + HTTP)                                 |
| `httpTransport.ts`          | transport‌های HTTP Streamable + SSE (`/api/mcp/sse`, `/api/mcp/stream`)           |
| `audit.ts`                  | ثبت ممیزی به جدول `mcp_tool_audit`                                        |
| `scopeEnforcement.ts`       | اعتبارسنجی scope به‌ازای-ابزار                                                      |
| `runtimeHeartbeat.ts`       | نبض سلامت به `DATA_DIR/runtime/mcp-heartbeat.json`                      |
| `descriptionCompressor.ts`  | فشرده‌سازی metadata توضیحات ابزار برای ذخیره context                             |
| `schemas/tools.ts`          | ۳۴ تعریف ابزار پایه + scope‌ها                                              |
| `tools/advancedTools.ts`    | پیاده‌سازی ابزارهای پیشرفته                                                  |
| `tools/memoryTools.ts`      | ۳ ابزار حافظه (search/add/clear)                                              |
| `tools/skillTools.ts`       | ۴ ابزار skill (list/enable/execute/executions)                                 |
| `tools/compressionTools.ts` | ۵ ابزار فشرده‌سازی                                                            |
| `README.md`                 | README داخلی سرور MCP (cross-link از `docs/frameworks/MCP-SERVER.md`) |

---

## `electron/` — wrapper دسکتاپ

| فایل             | هدف                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| `main.js`        | فرآیند اصلی Electron (BrowserWindow، سرور Next.js تعبیه‌شده، tray، auto-update) |
| `preload.js`     | پل IPC (contextBridge → `window.omniroute`)                                   |
| `package.json`   | پیکربندی electron-builder + Electron 41 + وابستگی‌های electron-builder 26.10               |
| `assets/`        | آیکون‌های اپ (Windows .ico, macOS .icns, Linux .png)                                 |
| `dist-electron/` | خروجی build (gitignored)                                                         |
| `types.d.ts`     | اعلان نوع برای renderer bridge                                             |
| `README.md`      | README داخلی Electron (همچنین به `docs/guides/ELECTRON_GUIDE.md` مراجعه کنید)               |

---

## `bin/` — CLI

| فایل                                                                                                        | هدف                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `omniroute.mjs`                                                                                             | ورودی اصلی CLI — `omniroute serve`, `omniroute setup`, `omniroute doctor`, `omniroute providers`, `omniroute combos`, و غیره. |
| `reset-password.mjs`                                                                                        | CLI مستقل بازنشانی رمز عبور                                                                                              |
| `cli/commands/setup.mjs`                                                                                    | wizard تعاملی + غیرتعاملی راه‌اندازی                                                                                 |
| `cli/commands/doctor.mjs`                                                                                   | تشخیص سلامت سیستم (۸+ بررسی)                                                                                      |
| `cli/commands/providers.mjs`                                                                                | فهرست/آزمایش/اعتبارسنجی provider                                                                                                |
| `cli/{args,data-dir,encryption,io,provider-catalog,provider-store,provider-test,settings-store,sqlite}.mjs` | ماژول‌های helper CLI                                                                                                         |
| `cli/tray/tray.ts`                                                                                          | ادغام system tray (cross-platform: NotifyIcon در Windows، systray2 در macOS/Linux)                                   |
| `cli/tray/tray.ps1`                                                                                         | backend PowerShell NotifyIcon (Windows، بدون باینری جدید)                                                                 |
| `cli/tray/autostart.ts`                                                                                     | autostart cross-platform (LaunchAgent / .desktop / registry)                                                               |
| `cli/runtime/sqliteRuntime.mjs`                                                                             | زنجیره حل driver SQLite ۵-مرحله‌ای (bundled → runtime → lazy-install → node:sqlite → sql.js)                            |
| `cli/runtime/magicBytes.mjs`                                                                                | اعتبارسنجی magic-byte باینری (ELF / Mach-O / Mach-O fat / PE)                                                              |
| `cli/runtime/index.mjs`                                                                                     | `warmUpRuntimes()` — pre-resolves driver‌ها در postinstall / اولین راه‌اندازی                                                   |
| `nodeRuntimeSupport.mjs`                                                                                    | اعتبارسنجی نسخه Node.js پشتیبانی‌شده هنگام نصب                                                                              |

---

## `skills/` — Skill‌های عمومی Agent

| فایل                         | هدف                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `skills/omniroute*/SKILL.md` | ۱۰ manifest skill برای agent‌های AI خارجی (Claude Desktop، ChatGPT، Cursor، Cline) |

---

## `scripts/` — اسکریپت‌های build و check

| اسکریپت                              | هدف                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `run-next.mjs`                      | runner dev/start با hydration env                                        |
| `build-next-isolated.mjs`           | build standalone (Next.js 16 standalone)                                   |
| `prepublish.ts`                     | آماده‌سازی بسته قبل از `npm pack`                                      |
| `postinstall.mjs`                   | ایجاد خودکار `.env` از `.env.example` در اولین نصب                    |
| `sync-env.mjs`                      | همگام‌سازی مجدد کلیدهای `.env` با `.env.example`                                    |
| `check-cycles.mjs`                  | شناسایی وابستگی‌های دوری                                               |
| `check-route-validation.mjs`        | اعتبارسنجی همه مسیرهای API داشتن اعتبارسنجی Zod                                |
| `check-t11-any-budget.mjs`          | اعمال بودجه `any` صریح به‌ازای فایل                                     |
| `check-docs-sync.mjs`               | اعتبارسنجی همگام‌سازی نسخه مستندات (pre-commit موجود)                           |
| **`check-env-doc-sync.mjs`**        | جدید: cross-check متغیرهای env در کد در مقابل `.env.example` در مقابل `ENVIRONMENT.md`    |
| **`check-docs-counts-sync.mjs`**    | جدید: اعتبارسنجی تعداد (executor‌ها، استراتژی‌ها، OAuth، skill‌های A2A) با مستندات |
| **`check-deprecated-versions.mjs`** | جدید: علامت‌گذاری نسخه‌ها/تاریخ‌های stale در مستندات                                     |
| `check-supported-node-runtime.ts`   | اعتبارسنجی نسخه Node فعلی پشتیبانی می‌شود                                 |
| `check-pr-test-policy.mjs`          | اعمال قاعده «آزمون مورد نیاز» روی تغییرات کد تولید                   |
| **`gen-provider-reference.ts`**     | جدید: تولید خودکار `docs/reference/PROVIDER_REFERENCE.md` از کاتالوگ     |
| `i18n/generate-multilang.mjs`       | ترجمه رشته‌های UI + مستندات از طریق Google Translate                           |
| `i18n_autotranslate.py`             | خط لوله ترجمه مستندات مبتنی‌بر LLM                                         |
| `validate_translation.py`           | اعتبارسنجی ترجمه به‌ازای هر locale                                          |
| `check_translations.py`             | بررسی کلید i18n سمت کد                                                   |
| `run-playwright-tests.mjs`          | runner E2E Playwright                                                      |
| `run-protocol-clients-tests.mjs`    | runner E2E MCP/A2A                                             |
| `run-ecosystem-tests.mjs`           | آزمون‌های اکوسیستم (ادغام provider)                                     |
| `test-report-summary.mjs`           | تولید خلاصه markdown پوشش                                         |
| `smoke-electron-packaged.mjs`       | smoke-test build Electron بسته‌بندی‌شده                                       |
| `native-binary-compat.mjs`          | اعتبارسنجی وابستگی‌های native (`better-sqlite3`) با Node Electron              |
| `validate-pack-artifact.ts`         | اعتبارسنجی خروجی npm pack                                                   |
| `responses-ws-proxy.mjs`            | پل WebSocket برای Codex Responses API                                   |
| `v1-ws-bridge.mjs`                  | پل WebSocket برای endpoint `/api/v1/ws`                                 |
| `standalone-server-ws.mjs`          | runner سرور WS standalone                                                |
| `system-info.mjs`                   | چاپ اطلاعات سیستم/runtime برای پشتیبانی                                      |
| `healthcheck.mjs`                   | بررسی سلامت یک‌شات (توسط Docker HEALTHCHECK استفاده می‌شود)                         |
| `uninstall.mjs`                     | اسکریپت uninstall تمیز                                                     |

---

## `docs/` — مستندات عمومی (۴۴ فایل + ۴ زیردایرکتوری)

### راهنماهای سطح‌بالا

| مستند                        | هدف                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md`           | معماری سطح‌بالا، نقشه زیرسیستم، سطح داشبورد                             |
| `CODEBASE_DOCUMENTATION.md` | مرجع مهندسی: دایرکتوری‌ها، ماژول‌ها، قراردادها                              |
| `FEATURES.md`               | ماتریس ویژگی با نکات برجسته v3.8                                                   |
| `USER_GUIDE.md`             | راهنمای کاربر نهایی (راه‌اندازی، مدل‌ها، combo‌ها، CLIها، صدا، و غیره)                            |
| `API_REFERENCE.md`          | مرجع endpoint API با مدل auth                                                |
| `openapi.yaml`              | spec OpenAPI 3.0 (۱۲۱ مسیر)                                                          |
| `SETUP_GUIDE.md`            | روش‌های نصب (npm، npx، Docker، Electron، Termux، سورس)                          |
| `ENVIRONMENT.md`            | همه متغیرهای env (حدود ۲۱۹ در کد استفاده شده، حدود ۸۱۰ خط `.env.example`)                           |
| `TROUBLESHOOTING.md`        | خطاهای رایج + مسائل شناخته‌شده v3.8.0                                                   |
| `RELEASE_CHECKLIST.md`      | جریان کامل انتشار (skill‌ها، husky، commit‌های متعارف، استقرار)                       |
| `COVERAGE_PLAN.md`          | اهداف پوشش و حالت فعلی                                                      |
| `FREE_TIERS.md`             | provider‌های free-tier گردآوری‌شده (۴۸+ رایگان + ۱۱ OAuth)                                     |
| `CLI-TOOLS.md`              | ادغام‌های CLI خارجی + CLI داخلی RouteChi                                    |
| `I18N.md`                   | معماری i18n، افزودن یک زبان، ۳۰ locale                                      |

### بررسی عمیق زیرسیستم

| مستند                        | هدف                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `MCP-SERVER.md`            | سرور MCP: ۹۴ ابزار، ۳ transport، ۳۰ scope، endpoint‌های REST       |
| `A2A-SERVER.md`            | A2A v0.3: JSON-RPC، ۵ skill، helper‌های REST، agent card              |
| `AGENT_PROTOCOLS_GUIDE.md` | راهنمای یکپارچه: A2A در مقابل ACP در مقابل Cloud Agents                           |
| `CLOUD_AGENT.md`           | هماهنگی Codex Cloud / Devin / Jules                           |
| `SKILLS.md`                | چارچوب Skills (built-in + marketplace + SkillsSH + sandbox)      |
| `MEMORY.md`                | سیستم حافظه (SQLite FTS5 + Qdrant)                                |
| `EVALS.md`                 | چارچوب ارزیابی (suite‌ها، run‌ها، rubric‌ها)                              |
| `GUARDRAILS.md`            | PII masker، تزریق prompt، vision bridge                         |
| `COMPLIANCE.md`            | گزارش ممیزی، retention، opt-out noLog                                 |
| `WEBHOOKS.md`              | تحویل webhook با امضای HMAC                                        |
| `REASONING_REPLAY.md`      | cache ترکیبی memory/SQLite برای `reasoning_content`                  |
| `AUTHZ_GUIDE.md`           | خط لوله احراز دسترسی (`classify` → `policies` → `enforce`)        |
| `RESILIENCE_GUIDE.md`      | مدارشکنی + cooldown + قفل مدل                          |
| `STEALTH_GUIDE.md`         | TLS fingerprinting (JA3/JA4)، Claude Code CCH، MITM cert            |
| `AUTO-COMBO.md`            | موتور Auto Combo (امتیازدهی ۹-عاملی، ۴ mode pack، virtual factory) |

### فشرده‌سازی

| مستند                             | هدف                                  |
| ------------------------------- | ---------------------------------------- |
| `COMPRESSION_GUIDE.md`          | نمای کلی حالت‌های فشرده‌سازی + نقشه راه  |
| `COMPRESSION_ENGINES.md`        | موتورهای Caveman + RTK، قرارداد رجیستری |
| `COMPRESSION_RULES_FORMAT.md`   | schema JSON بسته قواعد Caveman            |
| `COMPRESSION_LANGUAGE_PACKS.md` | فهرست بسته قواعد به‌ازای زبان         |
| `RTK_COMPRESSION.md`            | خط لوله اعلانی RTK (۴۹ فیلتر)    |

### استقرار

| مستند                          | هدف                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `DOCKER_GUIDE.md`            | build Docker، پروفایل‌ها (base/cli/host/cliproxyapi)، سایدکار Redis |
| `VM_DEPLOYMENT_GUIDE.md`     | استقرار عمومی VM/VPS (Ubuntu/Debian + nginx + systemd)       |
| `FLY_IO_DEPLOYMENT_GUIDE.md` | استقرار Fly.io (در حال حاضر فقط چینی)                        |
| `TERMUX_GUIDE.md`            | Android headless از طریق Termux                                       |
| `PWA_GUIDE.md`               | نصب Progressive Web App + service worker                      |
| `ELECTRON_GUIDE.md`          | build + sign + distribute اپ دسکتاپ                             |
| `TUNNELS_GUIDE.md`           | Cloudflared + ngrok + Tailscale Funnel                            |
| `PROXY_GUIDE.md`             | پروکسی خروجی ۴-سطحی + بازار 1proxy                       |

### زیردایرکتوری‌ها

| زیردایرکتوری                | هدف                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/archive/`       | مستندات آرشیو‌شده/تاریخی (مثلاً `RFC-AUTO-ASSESSMENT-DRAFT.md` — جایگزین‌شده با EVALS)                                                                                                          |
| `docs/i18n/`          | ترجمه‌های مستند محلی‌سازی‌شده (حدود ۴۲ locale)                                                                                                                                                       |
| `docs/screenshots/`   | asset‌های تصویر برای راهنما                                                                                                                                                                        |
| `_tasks/superpowers/` | plan/spec از superpowers (`writing-plans`/`brainstorming`) + research — مخزن ایزوله، جداگانه نسخه‌بندی‌شده، توسط درخت اصلی gitignored. به CLAUDE.md ← «Planning & Research Artifacts» مراجعه کنید. |

---

## `tests/` — suite‌های آزمون

| زیردایرکتوری                 | نوع                                    | runner                                  |
| ---------------------- | --------------------------------------- | --------------------------------------- |
| `tests/unit/`          | آزمون‌های واحد (حدود ۵۰۰ فایل، سریع‌ترین)        | Node native test runner                 |
| `tests/integration/`   | آزمون‌های integration چندماژولی + DB     | Node native test runner (همزمانی ۱) |
| `tests/e2e/`           | E2E UI + ورک‌فلو                       | Playwright                              |
| `tests/protocols-e2e/` | E2E کلاینت واقعی MCP + A2A               | کلاینت‌های پروتکل سفارشی                 |
| `tests/ecosystem/`     | integration provider (تماس شبکه‌ای) | Node native test runner                 |

---

## `public/` — asset‌های static

| مسیر                | هدف                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `public/` (root)    | faviconها، robots.txt، manifest، service worker، تصاویر بازاریابی |
| `public/providers/` | لوگو PNG/SVG provider (در داشبورد استفاده می‌شود)                        |

---

## `config/` — پیکربندی‌های static + حالت quality-gate

قالب‌های پیکربندی منتشر‌شده به اضافه baseline‌های quality-gate commit‌شده
(در v3.8.26 از ریشه مخزن به اینجا منتقل شد تا ریشه سبک بماند).

| مسیر                                          | هدف                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `config/i18n.json`                            | فهرست locale + metadata (منبع کانونی برای تعداد ۴۲-locale)                |
| `config/i18n-schema.json`                     | schema JSON که `i18n.json` را اعتبارسنجی می‌کند                                               |
| `config/payloadRules.json`                    | قواعد sanitize payload upstream                                              |
| `config/quality/quality-baseline.json`        | baseline ratchet چندمعیاری (`scripts/quality/check-quality-ratchet.mjs`)      |
| `config/quality/complexity-baseline.json`     | baseline frozen پیچیدگی ESLint (`check-complexity.mjs`)                       |
| `config/quality/duplication-baseline.json`    | baseline frozen تکرار jscpd (`check-duplication.mjs`)                      |
| `config/quality/file-size-baseline.json`      | baseline frozen اندازه به‌ازای‌فایل (`check-file-size.mjs`)                            |
| `config/quality/test-discovery-baseline.json` | baseline frozen آزمون یتیم (`check-test-discovery.mjs`)                         |
| `config/quality/dependency-allowlist.json`    | allowlist وابستگی‌های تأیید‌شده (`check-deps.mjs`)                               |
| `config/quality/.license-allowlist.json`      | allowlist لایسنس SPDX (`check-licenses.mjs`)                                    |
| `config/quality/quality-metrics.json`         | معیارهای جمع‌آوری‌شده گذرا (تولیدشده توسط `collect-metrics.mjs`; **gitignored**) |

---

## `.github/` — ادغام GitHub

| مسیر                               | هدف                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `.github/workflows/`               | ورک‌فلوهای CI/CD GitHub Actions (lint، test، coverage، release) |
| `.github/ISSUE_TEMPLATE/`          | قالب‌های issue bug/feature                                    |
| `.github/PULL_REQUEST_TEMPLATE.md` | قالب PR                                                    |
| `.github/dependabot.yml`           | پیکربندی به‌روزرسانی وابستگی                                       |

---

## `.husky/` — hook‌های گیت

| فایل         | هدف                                                           |
| ------------ | ----------------------------------------------------------------- |
| `pre-commit` | اجرا می‌کند `lint-staged + check-docs-sync + check:any-budget:t11`       |
| `pre-push`   | در حال حاضر غیرفعال (commented). `npm run test:unit` را دستی اجرا کنید. |
| `_/`         | internals Husky                                                   |

---

## `.claude/` — slash command‌های Claude Code

| فایل                                                | هدف                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| `commands/version-bump-cc.md`                       | `/version-bump-cc` — bump نسخه + auto-changelog |
| `commands/generate-release-cc.md`                   | `/generate-release-cc` — ورک‌فلو کامل انتشار     |
| `commands/deploy-vps-{local,akamai,both}-cc.md`     | استقرار به VPS                                      |
| `commands/capture-release-evidences-cc.md`          | ضبط مرورگر ویژگی‌های جدید به‌عنوان WebP                |
| `commands/review-{prs,discussions}-cc.md`           | triage GitHub PR/discussion‌ها                      |
| `commands/{review-issues,implement-features}-cc.md` | ورک‌فلوهای issue                                    |
| `settings.local.json`                               | تنظیمات Claude Code به‌ازای‌پروژه                   |

---

## `.agents/` — ورک‌فلوهای عمومی agent (Codex / Cursor / و غیره)

| مسیر                     | هدف                                                 |
| ------------------------ | ------------------------------------------------------- |
| `workflows/*-ag.md`      | ۱۱ تعریف ورک‌فلو (mirror از `.claude/commands/`) |
| `skills/<name>/SKILL.md` | ۹ تعریف skill با Codex Execution Notes          |

> **توجه:** ورک‌فلوها و command‌ها در حال حاضر byte-by-byte یکسان هستند. اگر `.agents/` قرار است یک runtime agent متفاوت (Codex) را هدف قرار دهد، variant‌ها باید به‌طور معناداری متفاوت شوند.

---

## `_ideia/`, `_mono_repo/`, `_references/`, `_tasks/` — خارج از درخت

این دایرکتوری‌های پیشوند‌دار با underscore محتوای غیر قابل‌انتشار را نگه می‌دارند:

- **`_ideia/`** — یادداشت‌های طراحی (دسته‌بندی defer / notfit / viable)
- **`_mono_repo/`** — زیرپروژه‌های تاریخی (omnirouteCloud، omnirouteSite، vscode-extension)
- **`_references/`** — clone‌های فقط‌خواندنی از پروژه‌های OSS مرتبط (LiteLLM، 9router، ClawRouter، CLIProxyAPI، modelrelay، new-api، و غیره) برای ارجاع متقابل در طول توسعه
- **`_tasks/`** — فایل‌های پیگیری وظایف به‌ازای-انتشار (غیررسمی)

در خروجی `npm pack` گنجانده نمی‌شوند. به `.npmignore` مراجعه کنید.

---

## تولیدشده / Gitignored

| مسیر                   | هدف                       |
| ---------------------- | ----------------------------- |
| `node_modules/`        | وابستگی‌های npm              |
| `.next/`               | خروجی build Next.js          |
| `coverage/`            | گزارش‌های پوشش c8           |
| `logs/`                | گزارش‌های runtime                  |
| `package/`             | مرحله‌بندی npm pack              |
| `.playwright-mcp/`     | artifact آزمون Playwright MCP |
| `.issues/`             | cache issue محلی             |
| `tsconfig.tsbuildinfo` | cache افزایشی TS          |

---

## نکات ناوبری

- **مشارکت‌کننده جدید؟** `CONTRIBUTING.md` → `CLAUDE.md` → `docs/architecture/ARCHITECTURE.md` → `docs/architecture/CODEBASE_DOCUMENTATION.md` را بخوانید.
- **افزودن provider؟** `docs/architecture/ARCHITECTURE.md § Adding a New Provider` را دنبال کنید + `docs/reference/PROVIDER_REFERENCE.md` را cross-check کنید.
- **افزودن مسیر؟** `docs/architecture/ARCHITECTURE.md § Adding a New API Route` + `src/shared/validation/schemas.ts`.
- **افزودن ابزار MCP؟** `docs/frameworks/MCP-SERVER.md § Adding a Tool`.
- **افزودن skill A2A؟** `docs/frameworks/A2A-SERVER.md § Adding a New Skill`.
- **اجرای محلی؟** `docs/guides/SETUP_GUIDE.md`.
- **استقرار؟** `docs/guides/DOCKER_GUIDE.md` / `docs/ops/VM_DEPLOYMENT_GUIDE.md` / `docs/ops/FLY_IO_DEPLOYMENT_GUIDE.md`.
- **انتشار؟** `docs/ops/RELEASE_CHECKLIST.md` (و skill Claude Code `/generate-release-cc`).
