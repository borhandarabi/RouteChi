---
title: "مستندات سرور MCP OmniRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# مستندات سرور MCP OmniRoute

> سرور Model Context Protocol با ۹۴ ابزار در حوزه‌های routing، cache، فشرده‌سازی، memory، مهارت‌ها، proxy، pool و عملیات منبع context.
>
> منبع اصلی: `open-sse/mcp-server/schemas/tools.ts` (34 پایه) + `memoryTools.ts` (3) + `skillTools.ts` (4) + `agentSkillTools.ts` (3) + `poolTools.ts` (6) + `gamificationTools.ts` (8) + `pluginTools.ts` (8) + `notionTools.ts` (6) + `obsidianTools.ts` (22) = **94** (`TOTAL_MCP_TOOL_COUNT`). ثبت ابزار و اتصال scope در `open-sse/mcp-server/server.ts` قرار دارد.

![موجودی ابزارهای MCP (94 ابزار بر اساس دسته)](../diagrams/exported/mcp-tools-94.svg)

> منبع: [diagrams/mcp-tools-94.mmd](../diagrams/mcp-tools-94.mmd) (با `npm run docs:render-diagrams` بازتولید کنید).

## نصب

MCP OmniRoute به‌صورت داخلی ارائه می‌شود. آن را با این دستور راه‌اندازی کنید:

```bash
routechi --mcp
```

یا از طریق ترنسپورت open-sse:

```bash
# HTTP streamable transport (port 20130)
routechi --dev  # MCP auto-starts on /mcp endpoint
```

## ترنسپورت‌ها

سرور MCP سه ترنسپورت را ارائه می‌دهد، همگی پشتیبان‌شده توسط همان factory `createMcpServer()`:

| ترنسپورت       | مکان                                       | زمان استفاده                                          |
| :------------- | :----------------------------------------- | :----------------------------------------------------- |
| `stdio`        | `open-sse/mcp-server/server.ts`            | یکپارچه‌سازی‌های IDE (Claude Desktop، Cursor و غیره)    |
| `sse`          | `POST/GET /api/mcp/sse` از طریق `httpTransport` | کلاینت‌های browser/agent که نیاز به event stream دارند |
| `streamable-http` | `POST/GET/DELETE /api/mcp/stream`        | کلاینت‌های HTTP چند-نشسته (هدر `mcp-session-id`)        |

ترنسپورت HTTP فعال (`sse` یا `streamable-http`) توسط تنظیم `mcpTransport` انتخاب می‌شود. تعویض ترنسپورت‌ها، نشست‌های موجود روی ترنسپورت دیگر را می‌بندد.

### دسترسی ریموت (دور زدن manage-scope)

`/api/mcp/*` در لایه‌ی LOCAL_ONLY قرار دارد (`src/server/authz/routeGuard.ts`) — به‌طور پیش‌فرض فقط میزبان‌های loopback (`localhost`، `127.0.0.1`، `::1`) می‌توانند به آن دسترسی داشته باشند. از نسخه‌ی v3.8.2، کلاینت‌های غیر-loopback می‌توانند در صورتی متصل شوند که یک `Authorization: Bearer <api-key>` ارائه کنند که کلید آن دارای scope `manage` باشد. این تنها راه برای دسترسی به سرور MCP ریموت از طریق یک tunnel، reverse proxy یا hostname عمومی است.

```bash
# Grant manage scope: open the dashboard API Keys page and toggle
# "Management Access" on the key, or POST scopes:["manage"] when creating.

# Then connect from a remote MCP client:
curl -i \
  -H "Host: your-public-host.example" \
  -H "Authorization: Bearer sk-…" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"my-client","version":"0"}}}' \
  https://your-public-host.example/api/mcp/stream
```

یک کلید غیر-manage (یا بدون Bearer) `403 LOCAL_ONLY` برمی‌گرداند. پیشوند هم‌خانواده `/api/cli-tools/runtime/*` عمداً قابل دور زدن نیست — به [Route Guard Tiers — Manage-scope carve-out](../security/ROUTE_GUARD_TIERS.md#manage-scope-carve-out) مراجعه کنید.

## پیکربندی IDE

برای راه‌اندازی Claude Desktop، Cursor، Cline و کلاینت‌های MCP سازگار به
[MCP Client Configuration](../guides/SETUP_GUIDE.md#mcp-client-configuration) مراجعه کنید.

---

## ابزارهای اساسی (8) — فاز 1

| ابزار                           | Scopeها              | توضیحات                                                      |
| :------------------------------ | :------------------- | :----------------------------------------------------------- |
| `omniroute_get_health`          | `read:health`        | Uptime، memory، circuit breakerها، محدودیت‌های نرخ، آمار cache |
| `omniroute_list_combos`         | `read:combos`        | همه‌ی comboهای پیکربندی‌شده با استراتژی‌ها (اختیاری metrics) |
| `omniroute_get_combo_metrics`   | `read:combos`        | معیارهای عملکرد برای یک combo خاص                            |
| `omniroute_switch_combo`        | `write:combos`       | فعال یا غیرفعال کردن یک combo                                |
| `omniroute_check_quota`         | `read:quota`         | سهمیه‌ی استفاده‌شده/کل، درصد باقیمانده، زمان بازنشانی، سلامت توکن |
| `omniroute_route_request`       | `execute:completions`| ارسال یک chat completion از طریق routing مربوط به OmniRoute    |
| `omniroute_cost_report`         | `read:usage`         | گزارش هزینه بر اساس دوره (نشست/روز/هفته/ماه)                |
| `omniroute_list_models_catalog` | `read:models`        | کاتالوگ کامل مدل‌ها با قابلیت‌ها، وضعیت، قیمت‌گذاری         |

## فاز 1 — جستجو

| ابزار                  | Scopeها          | توضیحات                                                                                                                        |
| :--------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `omniroute_web_search` | `execute:search` | جستجوی وب از طریق search gateway مربوط به OmniRoute (Serper/Brave/Perplexity/Exa/Tavily/Google PSE/Linkup/SearchAPI/SearXNG) با failover |

## ابزارهای پیشرفته (11) — فاز 2

| ابزار                              | Scopeها                              | توضیحات                                                                              |
| :--------------------------------- | :----------------------------------- | :------------------------------------------------------------------------------------ |
| `omniroute_simulate_route`         | `read:health`, `read:combos`         | شبیه‌سازی dry-run routing با درخت fallback                                           |
| `omniroute_set_budget_guard`       | `write:budget`                       | بودجه‌ی نشست با اقدام degrade/block/alert                                            |
| `omniroute_set_routing_strategy`   | `write:combos`                       | به‌روزرسانی استراتژی combo در زمان اجرا (priority/weighted/auto/غیره)                 |
| `omniroute_set_resilience_profile` | `write:resilience`                   | اعمال preset رزیلیانس `aggressive` / `balanced` / `conservative`                     |
| `omniroute_test_combo`             | `execute:completions`, `read:combos` | آزمون زنده‌ی هر provider در یک combo با یک فراخوانی واقعی upstream                    |
| `omniroute_get_provider_metrics`   | `read:health`                        | معیارهای هر provider با تأخیر p50/p95/p99 و وضعیت circuit breaker                    |
| `omniroute_best_combo_for_task`    | `read:combos`, `read:health`         | پیشنهاد combo بر اساس نوع کار با محدودیت‌های بودجه/تأخیر                              |
| `omniroute_explain_route`          | `read:health`, `read:usage`          | توضیح چرا یک درخواست به یک provider هدایت شد (عوامل امتیازدهی + fallbackها)         |
| `omniroute_get_session_snapshot`   | `read:usage`                         | snapshot کامل نشست: هزینه، توکن‌ها، مدل‌های/providerهای برتر، خطاها، budget guard    |
| `omniroute_db_health_check`        | `read:health`, `write:resilience`    | تشخیص (و اختیاری تعمیر خودکار) انحراف پایگاه داده مانند combo refs شکسته / ردیف‌های orphan |
| `omniroute_sync_pricing`           | `pricing:write`                      | همگام‌سازی داده‌های قیمت‌گذاری از منابع خارجی (LiteLLM)؛ از `dryRun` پشتیبانی می‌کند  |

## ابزارهای Cache (2)

| ابزار                   | Scopeها       | توضیحات                                            |
| :---------------------- | :------------ | :------------------------------------------------- |
| `omniroute_cache_stats` | `read:cache`  | آمار cache معنایی، prompt-cache و idempotency      |
| `omniroute_cache_flush` | `write:cache` | flush cache به‌صورت جهانی یا بر اساس signature/model |

## ابزارهای فشرده‌سازی (5)

| ابزار                               | Scopeها            | توضیحات                                                                                                                |
| :---------------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `omniroute_compression_status`      | `read:compression` | تنظیمات فشرده‌سازی، خلاصه‌ی تحلیلی و آمار cache-aware (شامل متادیتای `analytics.mcpDescriptionCompression`)             |
| `omniroute_compression_configure`   | `write:compression`| پیکربندی حالت فشرده‌سازی، آستانه، نسبت هدف، حفظ system-prompt، toggle فشرده‌سازی توضیحات MCP                            |
| `omniroute_set_compression_engine`  | `write:compression`| انتخاب موتور فعال (off/caveman/rtk/stacked) و شدت Caveman/RTK                                                          |
| `omniroute_list_compression_combos` | `read:compression` | فهرست comboهای فشرده‌سازی نام‌گذاری‌شده و pipelineهای موتور آن‌ها                                                       |
| `omniroute_compression_combo_stats` | `read:compression` | تحلیل‌ها گروه‌بندی‌شده بر اساس combo و موتور فشرده‌سازی                                                                  |

`omniroute_compression_status` فشرده‌سازی توضیحات MCP را به‌طور جداگانه تحت
`analytics.mcpDescriptionCompression` گزارش می‌دهد. این مقادیر برآوردهای اندازه‌ی متادیتا برای توضیحات listable مربوط به MCP
(`tools`، `prompts`، `resources` و `resourceTemplates`) هستند؛ این مقادیر receiptهای مصرف provider نیستند و با
`source: "mcp_metadata_estimate"` علامت‌گذاری شده‌اند.

### فیلتر درخت دسترس‌پذیری MCP (v3.8.0)

جدای از ۵ ابزار فشرده‌سازی بالا، OmniRoute شامل یک فیلتر پس از اجرا است که
**نتایج ابزار** ابزارهای browser/accessibility مربوط به MCP را قبل از بازگرداندن به
عامل فشرده می‌کند. این فیلتر خود یک ابزار نیست — به‌طور شفاف روی هر نتیجه‌ی ابزاری که حاوی
متن verbose accessibility-tree یا browser-snapshot (≥2000 کاراکتر) باشد اجرا می‌شود.

رفتارهای کلیدی:

- ≥30 خط خواهری مکرر متوالی را به خلاصه‌ی head + tail فرومی‌کاهد
- لنگرهای `[ref=eXX]` مورد نیاز Playwright/computer-use را حفظ می‌کند
- متن بیش‌ازحد (>50,000 کاراکتر) را با یک راهنمای ناوبری hard-truncate می‌کند
- صرفه‌جویی مورد انتظار: **60–80%** روی payloadهای snapshot مرورگر

پیکربندی: `compression.mcpAccessibility` در تنظیمات سراسری (migration 056).
پیاده‌سازی: `open-sse/services/compression/engines/mcpAccessibility/`.
مستندات کامل: [Compression Engines — MCP Accessibility Tree Filter](../compression/COMPRESSION_ENGINES.md#mcp-accessibility-tree-filter).

برای مدل فشرده‌سازی runtime پشت این ابزارها به
[Compression Engines](../compression/COMPRESSION_ENGINES.md) و [RTK Compression](../compression/RTK_COMPRESSION.md) مراجعه کنید.

## ابزارهای 1Proxy (3)

| ابزار                       | Scopeها        | توضیحات                                                                            |
| :-------------------------- | :------------- | :---------------------------------------------------------------------------------- |
| `omniroute_oneproxy_fetch`  | `read:proxies` | دریافت پروکسی‌های رایگان از marketplace 1proxy (فیلترهای protocol/country/quality/limit) |
| `omniroute_oneproxy_rotate` | `read:proxies` | دریافت پروکسی بعدی موجود بر اساس استراتژی (`random` / `quality` / `sequential`)      |
| `omniroute_oneproxy_stats`  | `read:proxies` | آمار pool، وضعیت همگام‌سازی، توزیع بر اساس پروتکل و کشور                              |

## ابزارهای Memory (3)

در `open-sse/mcp-server/tools/memoryTools.ts` تعریف شده‌اند. احراز هویت/scope از طریق pipeline استاندارد scope مربوط به MCP اعمال می‌شود.

| ابزار                     | Scopeها        | توضیحات                                                                          |
| :------------------------ | :------------- | :------------------------------------------------------------------------------- |
| `omniroute_memory_search` | `read:memory`  | جستجوی memoryها بر اساس query / type / API key با اعمال token-budget            |
| `omniroute_memory_add`    | `write:memory` | افزودن یک ورودی memory جدید (`factual` / `episodic` / `procedural` / `semantic`) |
| `omniroute_memory_clear`  | `write:memory` | پاک کردن memoryها برای یک API key، اختیاری فیلتر‌شده بر اساس type یا timestamp `olderThan` |

## ابزارهای Skill (4)

در `open-sse/mcp-server/tools/skillTools.ts` تعریف شده‌اند. پشتیبان `src/lib/skills/registry` + `src/lib/skills/executor`.

| ابزار                         | Scopeها          | توضیحات                                                                      |
| :---------------------------- | :--------------- | :--------------------------------------------------------------------------- |
| `omniroute_skills_list`       | `read:skills`    | فهرست مهارت‌های ثبت‌شده با فیلتر اختیاری بر اساس API key، نام یا وضعیت فعال |
| `omniroute_skills_enable`     | `write:skills`   | فعال یا غیرفعال کردن یک مهارت خاص بر اساس ID                                |
| `omniroute_skills_execute`    | `execute:skills` | اجرای یک مهارت با ورودی ارائه‌شده و بازگرداندن رکورد اجرا                   |
| `omniroute_skills_executions` | `read:skills`    | فهرست تاریخچه‌ی اجرای مهارت‌های اخیر                                         |

## منبع Context مربوط به Notion (6)

در `open-sse/mcp-server/tools/notionTools.ts` تعریف شده‌اند. توکن در جدول `key_value` از طریق `src/lib/db/notion.ts` ذخیره می‌شود. کلاینت REST در `src/lib/notion/api.ts`. API تنظیمات در `src/app/api/settings/notion/route.ts`. رابط کاربری داشبورد در `src/app/(dashboard)/dashboard/endpoint/components/NotionSourceCard.tsx`.

توکن یکپارچه‌سازی Notion خود را از تب **Context Sources** در داشبورد Endpoint یا از طریق REST API پیکربندی کنید:

```bash
# Set token
curl -X POST http://localhost:20128/api/settings/notion \
  -H "Content-Type: application/json" \
  -d '{"token": "ntn_..."}'

# Check status
curl http://localhost:20128/api/settings/notion

# Disconnect
curl -X DELETE http://localhost:20128/api/settings/notion
```

| ابول                         | Scopeها        | توضیحات                                                       |
| :--------------------------- | :------------- | :------------------------------------------------------------ |
| `notion_search`              | `read:notion`  | جستجوی full-text در همه‌ی صفحات و دیتابیس‌ها                  |
| `notion_get_page`            | `read:notion`  | دریافت یک صفحه بر اساس ID با ویژگی‌های آن                     |
| `notion_list_block_children` | `read:notion`  | فهرست بلوک‌های فرزند یک صفحه یا بلوک                          |
| `notion_query_database`      | `read:notion`  | کوئری یک دیتابیس با فیلترها، sortها و صفحه‌بندی              |
| `notion_get_database`        | `read:notion`  | دریافت schema دیتابیس بر اساس ID                              |
| `notion_append_blocks`       | `write:notion` | اضافه‌کردن بلوک‌های فرزند به یک بلوک والد (حداکثر ۱۰۰ در هر درخواست) |

## ابزارهای کاتالوگ Agent Skill (3)

در `open-sse/mcp-server/tools/agentSkillTools.ts` تعریف شده‌اند. پشتیبان `src/lib/agentSkills/catalog`. این ابزارها کاتالوگ مستندات Agent Skills با ۴۲ ورودی را به کلاینت‌های MCP و عامل‌های خارجی در معرض قرار می‌دهند. Scope: `read:catalog`.

| ابزار                              | Scopeها         | توضیحات                                                                                                      |
| :--------------------------------- | :-------------- | :----------------------------------------------------------------------------------------------------------- |
| `omniroute_agent_skills_list`     | `read:catalog`  | فهرست همه‌ی ۴۲ مهارت عامل با فیلترهای اختیاری `category` (api\|cli) و `area`؛ متادیتا + پوشش را برمی‌گرداند  |
| `omniroute_agent_skills_get`      | `read:catalog`  | دریافت متادیتای کامل + محتوای SKILL.md برای یک مهارت بر اساس `id` کانونیک                                     |
| `omniroute_agent_skills_coverage` | `read:catalog`  | آمار پوشش: چه تعداد از ۲۲ مهارت API و ۲۰ مهارت CLI دارای فایل SKILL.md روی filesystem در مقایسه با مجموع کاتالوگ هستند |

برای کاتالوگ کامل و نحوه‌ی مصرف آن توسط عامل‌های خارجی به [AGENT-SKILLS.md](./AGENT-SKILLS.md) مراجعه کنید.

## فریم‌ورک‌های مرتبط (v3.8.0)

موجودی ابزار MCP در بالا (۹۴ ابزار = ۳۴ هسته + ۳ memory + ۴ skills + ۳ agent-skills + ۶ pool + ۸ gamification + ۸ plugins + ۶ notion + ۲۲ obsidian) عمداً
به عملیات runtime routing/cache/compression/memory/skills/proxy/context-source محدود شده است. دو فریم‌ورک
مجاور در v3.8.0 در کنار سرور MCP ارائه می‌شوند و جداگانه مستند شده‌اند:

### Cloud Agents

Cloud Agents عامل‌های کدنویسی AI خارج از فرآیند (codex-cloud، devin، jules) هستند که از طریق
همان مدل اتصال استفاده‌شده برای providerهای LLM به OmniRoute متصل می‌شوند. آن‌ها از طریق
سطح REST خود (`/api/v1/agents/*`) ارائه می‌شوند و **بخشی از کاتالوگ ابزار MCP نیستند**
— فراخوانی یک Cloud Agent یک scope MCP را مصرف نمی‌کند.

- پیاده‌سازی: `src/lib/cloudAgent/` (`registry.ts`، `agents/codex-cloud.ts`، `agents/devin.ts`، `agents/jules.ts`).
- چرخه‌حیات: `createTask`، `getStatus`، `approvePlan`، `sendMessage`، `listSources`.
- مستندات: [docs/frameworks/CLOUD_AGENT.md](./CLOUD_AGENT.md).

### Guardrails

Guardrails فیلترهای pre/post-execution (vision-bridge، pii-masker، prompt-injection)
هستند که در داخل pipeline چت اعمال می‌شوند. آن‌ها پیش از رسیدن به لایه‌ی ابزار/route مربوط به MCP اجرا می‌شوند
و نقض‌های ساختاریافته را به pipeline ممیزی منتشر می‌کنند؛ به‌عنوان ابزارهای MCP فراخوانی نمی‌شوند.

- پیاده‌سازی: `src/lib/guardrails/`.
- مستندات: [docs/security/GUARDRAILS.md](../security/GUARDRAILS.md).

هنگام دیباگ یک فراخوانی MCP که به‌نظر مسدود شده، هم log ممیزی MCP
(ورودی‌های `scope_denied:*`) و هم رد ممیزی guardrails را بررسی کنید — ممکن است یک درخواست توسط
یک guardrail **پیش از** رسیدن به لایه‌ی اعمال scope MCP رد شود.

---

## Endpointهای REST API

| Endpoint               | Method                | توضیحات                                                                                         | احراز هویت                |
| :--------------------- | :-------------------- | :---------------------------------------------------------------------------------------------- | :------------------------ |
| `/api/mcp/status`      | `GET`                 | وضعیت سرور: heartbeat، وضعیت ترنسپورت HTTP، خلاصه‌ی فعالیت ممیزی                              | مدیریت (نشست/مدیر)        |
| `/api/mcp/tools`       | `GET`                 | کاتالوگ ابزار (نام، توضیحات، scopeها، فاز، endpointهای منبع)                                    | مدیریت                    |
| `/api/mcp/sse`         | `GET` / `POST`        | endpoint ترنسپورت SSE (گیت‌شده توسط `mcpEnabled` + `mcpTransport === "sse"`)                   | API key + scopeها         |
| `/api/mcp/stream`      | `POST`/`GET`/`DELETE` | ترنسپورت HTTP قابل‌جریان (از هدر `mcp-session-id` استفاده می‌کند؛ `DELETE` نشست را پایان می‌دهد) | API key + scopeها         |
| `/api/mcp/audit`       | `GET`                 | ورودی‌های log ممیزی از `mcp_tool_audit` (فیلترها: `limit`، `offset`، `tool`، `success`، `apiKeyId`) | مدیریت                    |
| `/api/mcp/audit/stats` | `GET`                 | آمار ممیزی تجمیعی (`totalCalls`، `successRate`، `avgDurationMs`، ابزارهای برتر)                 | مدیریت                    |

فایل‌های منبع: `src/app/api/mcp/{status,tools,sse,stream,audit,audit/stats}/route.ts`.

هر دو ترنسپورت SSE و Streamable HTTP تا زمانی که سرور MCP در تنظیمات فعال نشود (`mcpEnabled`) و `mcpTransport` مناسب انتخاب نشود، مسدود هستند. اگر ترنسپورت اشتباهی پیکربندی شده باشد، مسیر HTTP 400 با یک راهنما برای تغییر تنظیمات برمی‌گرداند.

---

## احراز هویت و Scopeها

ابزارهای MCP از طریق scopeهای API key احراز هویت می‌شوند. اعمال scope در
`open-sse/mcp-server/scopeEnforcement.ts` متمرکز است. هر ابزار به scopeهای خاصی نیاز دارد:

| Scope                | ابزارها                                                                                                            |
| :------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `read:health`        | `get_health`، `get_provider_metrics`، `simulate_route`، `explain_route`، `best_combo_for_task`، `db_health_check` |
| `read:combos`        | `list_combos`، `get_combo_metrics`، `simulate_route`، `best_combo_for_task`، `test_combo`                          |
| `write:combos`       | `switch_combo`، `set_routing_strategy`                                                                             |
| `read:quota`         | `check_quota`                                                                                                      |
| `read:usage`         | `cost_report`، `get_session_snapshot`، `explain_route`                                                             |
| `read:models`        | `list_models_catalog`                                                                                              |
| `execute:completions`| `route_request`، `test_combo`                                                                                      |
| `execute:search`     | `web_search`                                                                                                       |
| `write:budget`       | `set_budget_guard`                                                                                                 |
| `write:resilience`   | `set_resilience_profile`، `db_health_check`                                                                        |
| `pricing:write`      | `sync_pricing`                                                                                                     |
| `read:cache`         | `cache_stats`                                                                                                      |
| `write:cache`        | `cache_flush`                                                                                                      |
| `read:compression`   | `compression_status`، `list_compression_combos`، `compression_combo_stats`                                         |
| `write:compression`  | `compression_configure`، `set_compression_engine`                                                                  |
| `read:proxies`       | `oneproxy_fetch`، `oneproxy_rotate`، `oneproxy_stats`                                                              |
| `read:notion`        | `notion_search`، `notion_list_databases`، `notion_get_database`، `notion_query_database`، `notion_read`            |
| `write:notion`       | `notion_append_blocks`                                                                                             |
| `read:memory`        | `memory_search`                                                                                                    |
| `write:memory`       | `memory_add`، `memory_clear`                                                                                       |
| `read:skills`        | `skills_list`، `skills_executions`                                                                                 |
| `write:skills`       | `skills_enable`                                                                                                    |
| `execute:skills`     | `skills_execute`                                                                                                   |
| `read:catalog`       | `agent_skills_list`، `agent_skills_get`، `agent_skills_coverage`                                                   |

Scopeهای wildcard پشتیبانی می‌شوند: `read:*` همه‌ی scopeهای خواندن را اعطا می‌کند، `*` دسترسی کامل می‌دهد.

---

## متغیرهای محیطی

| متغیر                                  | پیش‌فرض                            | هدف                                                                                                                  |
| :------------------------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `OMNIROUTE_BASE_URL`                   | `http://localhost:20128`           | URL پایه که سرور MCP هنگام فراخوانی APIهای داخلی OmniRoute از آن استفاده می‌کند                                       |
| `OMNIROUTE_API_KEY`                    | (خالی)                             | API key به‌عنوان `Authorization: Bearer` به فراخوانی‌های API داخلی ارسال می‌شود                                       |
| `OMNIROUTE_MCP_ENFORCE_SCOPES`         | `false` (فقط `"true"` آن را فعال می‌کند) | هنگام فعال بودن، scopeهای مفقود فراخوانی‌های ابزار را رد کرده و `scope_denied:<reason>` را در log ممیزی ثبت می‌کند   |
| `OMNIROUTE_MCP_SCOPES`                 | (خالی)                             | فهرست مجاز scopeهای جدا‌شده با کاما که به‌طور پیش‌فرض "موجود" در نظر گرفته می‌شوند (هنگامی که فراخوان‌کننده scopeهای خودش را ارائه نمی‌دهد استفاده می‌شود) |
| `OMNIROUTE_MCP_COMPRESS_DESCRIPTIONS`  | (تنظیم‌نشده = روشن)                | هنگامی که روی `0/false/off/no` تنظیم شود، فشرده‌سازی توضیحات MCP را در زمان ثبت غیرفعال می‌کند                        |
| `OMNIROUTE_MCP_DESCRIPTION_COMPRESSION`| (تنظیم‌نشده = روشن)                | نام مستعار جایگزین برای همان toggle بالا                                                                              |
| `MCP_TOOL_DENY`                        | (تنظیم‌نشده = بدون فیلتر)          | نام ابزارهای جدا‌شده با کاما برای حذف از `tools/list` (کاهش تعداد ابزار — زیر را ببینید)                              |
| `MCP_TOOL_ALLOW`                       | (تنظیم‌نشده = بدون فیلتر)          | نام ابزارهای جدا‌شده با کاما برای نگه‌داشتن به‌طور انحصاری (حالت allow-list — زیر را ببینید)                         |
| `DATA_DIR`                             | `~/.omniroute`                     | فایل heartbeat در `${DATA_DIR}/runtime/mcp-heartbeat.json` نوشته می‌شود                                              |

---

## فشرده‌سازی توضیحات

رجیستری‌های ابزار، prompt و منبع MCP می‌توانند توضیحات را در زمان ثبت/لیست فشرده کنند تا ردپای متادیتای در معرض کلاینت‌ها (و در نتیجه هزینه‌ی context مربوط به prompt) کاهش یابد. پیاده‌سازی در `open-sse/mcp-server/descriptionCompressor.ts` قرار دارد و از طریق `compressMcpRegistryMetadata` در داخل `createMcpServer()` به سرور MCP متصل می‌شود.

- فشرده‌سازی روی متن توضیحات با استفاده از قوانین Caveman (`getRulesForContext("all", "full")`) با استخراج preserved-block (code spanها، fenced blockها و غیره) اجرا می‌شود تا محتوای ساختاری تغییر نکند.
- toggle به ازای deployment از طریق مقدار `compression.mcpDescriptionCompressionEnabled` در جدول تنظیمات `key_value` (پیش‌فرض: فعال) — در رابط کاربری به‌صورت **Analytics → MCP description compression** نمایش داده می‌شود.
- toggle در سطح فرآیند از طریق `OMNIROUTE_MCP_COMPRESS_DESCRIPTIONS=false` یا `OMNIROUTE_MCP_DESCRIPTION_COMPRESSION=false`.
- آمار بلادرنگ از طریق `omniroute_compression_status` تحت `analytics.mcpDescriptionCompression` نمایش داده می‌شود و با `source: "mcp_metadata_estimate"` علامت‌گذاری شده تا از receiptهای مصرف واقعی provider متمایز شود.

---

## کاهش تعداد ابزار (F4.3)

فشرده‌سازی توضیحات، متادیتای هر ابزار را کوچک می‌کند؛ **کاهش تعداد ابزار** یک گام جلوتر می‌رود و _تعداد_ ابزارهای اعلام‌شده را کاهش می‌دهد. تبلیغ ابزارهای کمتر در manifest `tools/list` هزینه‌ی توکن به ازای درخواستی که مدل کلاینت برای کاتالوگ ابزار می‌پردازد را کاهش می‌دهد (فشرده‌سازی "layer 5"). پیاده‌سازی یک فیلتر خالص و بدون حالت در `open-sse/mcp-server/toolCardinality.ts` (`reduceToolManifest`) است که به حلقه‌ی ثبت در `createMcpServer()` (`open-sse/mcp-server/server.ts`) متصل شده است.

**اختیاری، به‌طور پیش‌فرض خاموش.** فیلتر فقط هنگامی اجرا می‌شود که حداقل یکی از دو متغیر محیطی تنظیم شده باشد؛ بدون تنظیم هیچ‌کدام، همه‌ی ۹۴ ابزار بدون تغییر اعلام می‌شوند.

| متغیر         | حالت                                                                                    |
| :------------- | :-------------------------------------------------------------------------------------- |
| `MCP_TOOL_DENY`| Blacklist — نام ابزارهای جدا‌شده با کاما که همیشه از `tools/list` حذف می‌شوند            |
| `MCP_TOOL_ALLOW`| Allow-list — نام ابزارهای جدا‌شده با کاما؛ فقط این‌ها باقی می‌مانند، بقیه حذف می‌شوند    |

`deny` نسبت به `allow` اولویت دارد. نام‌ها با کاما جدا شده، trim می‌شوند و ورودی‌های خالی نادیده گرفته می‌شوند. مثال‌ها:

```bash
# Drop two tools from the catalog
MCP_TOOL_DENY="omniroute_get_health,omniroute_list_combos" omniroute --mcp

# Announce only the routing + quota tools (allow-list mode)
MCP_TOOL_ALLOW="omniroute_route_request,omniroute_check_quota" omniroute --mcp
```

**نحوه‌ی حذف ابزارهای فیلترشده:** ثبت همیشه موفق است؛ ابزاری که profile رد می‌کند سپس روی handle مربوط به SDK MCP با `.disable()` غیرفعال می‌شود، تا هرگز در `tools/list` ظاهر نشود اما اتصال دست‌نخورده باقی بماند (فعال/غیرفعال‌سازی تمیز، بدون ثبت مجدد). parser مربوط به profile، `readMcpToolProfileFromEnv(process.env)` است که وقتی هر دو متغیر خالی باشند `null` برمی‌گرداند (بدون فیلتر).

شکل غنی‌تر `ToolProfile` پشت `reduceToolManifest` همچنین از فیلترing تقاطع scope (`allowScopes`، با تطبیق wildcard به سبک `read:*`) و یک سقف قطعی `maxTools` پشتیبانی می‌کند، اما این دو تنظیم به manifest کامل در زمان ثبت نیاز دارند و **امروزه** از طریق متغیرهای محیطی در دسترس نیستند (یک hook در سطح `tools/list` یک پیگیری ثبت‌شده است). `estimateManifestTokens()` برای مقایسه‌ی هزینه‌ی توکن manifest قبل و بعد از کاهش در دسترس است.

---

## Heartbeat زمان اجرا

ترنسپورت stdio هر ۵ ثانیه وضعیت زنده بودن را در `${DATA_DIR}/runtime/mcp-heartbeat.json` ذخیره می‌کند. داشبورد (`/api/mcp/status`) این فایل به‌علاوه‌ی زنده بودن PID را می‌خواند تا `online` را استخراج کند. ترنسپورت‌های HTTP وضعیت را از `getMcpHttpStatus()` درون فرآیند گزارش می‌دهند (بدون نوشتن فایل).

snapshot heartbeat شامل:

```json
{
  "pid": 12345,
  "startedAt": "2026-05-13T12:34:56.000Z",
  "lastHeartbeatAt": "2026-05-13T12:35:01.000Z",
  "version": "1.8.1",
  "transport": "stdio",
  "scopesEnforced": false,
  "allowedScopes": [],
  "toolCount": 43
}
```

---

## ثبت ممیزی

هر فراخوانی ابزار توسط `open-sse/mcp-server/audit.ts` در جدول SQLite `mcp_tool_audit` ثبت می‌شود:

- نام ابزار، آرگومان‌ها (هش‌شده/کوتاه‌شده بر اساس `auditLevel` هر ابزار)، نتیجه
- مدت به ms، فلگ موفق/شکست، پیام خطا (در صورت وجود)
- هش API key، timestamp
- رد scopeها به‌صورت `scope_denied:<reason>` با فهرست scopeهای مفقود ثبت می‌شوند

برای بازبینی فراخوانی‌های اخیر از داشبورد یا endpointهای REST `/api/mcp/audit` و `/api/mcp/audit/stats` استفاده کنید.

---

## فایل‌ها

| فایل                                                                     | هدف                                                          |
| :----------------------------------------------------------------------- | :----------------------------------------------------------- |
| `open-sse/mcp-server/server.ts`                                          | factory سرور MCP، نقطه‌ی ورود stdio، ثبت ابزارهای scoped     |
| `open-sse/mcp-server/httpTransport.ts`                                   | ترنسپورت SSE + Streamable HTTP (مدیریت نشست)                 |
| `open-sse/mcp-server/scopeEnforcement.ts`                                | ارزیابی scope ابزار و تعیین فراخوان‌کننده                     |
| `open-sse/mcp-server/audit.ts`                                           | ثبت ممیزی فراخوانی ابزار (`mcp_tool_audit`)                  |
| `open-sse/mcp-server/runtimeHeartbeat.ts`                                | نویسنده‌ی heartbeat مربوط به stdio (`mcp-heartbeat.json`)     |
| `open-sse/mcp-server/descriptionCompressor.ts`                           | فشرده‌سازی توضیحات برای رجیستری‌های tool / prompt / resource |
| `open-sse/mcp-server/schemas/tools.ts`                                   | schemaهای Zod + رجیستری ابزار (`MCP_TOOLS`، ۳۴ ورودی)       |
| `open-sse/mcp-server/tools/advancedTools.ts`                             | handlerهای ابزار فاز ۲ + cache + 1proxy                      |
| `open-sse/mcp-server/tools/compressionTools.ts`                          | handlerهای ابزار فشرده‌سازی                                  |
| `open-sse/mcp-server/tools/memoryTools.ts`                               | تعاریف ابزار memory (۳ ابزار)                                |
| `open-sse/mcp-server/tools/skillTools.ts`                                | تعاریف ابزار skill (۴ ابزار)                                 |
| `open-sse/mcp-server/tools/notionTools.ts`                               | تعاریف ابزار منبع context مربوط به Notion (۶ ابزار)         |
| `open-sse/mcp-server/tools/gamificationTools.ts`                         | تعاریف ابزار گیمیفیکیشن (۸ ابزار)                            |
| `open-sse/mcp-server/tools/pluginTools.ts`                               | ابزارهای ثبت و مدیریت پلاگین (۸ ابزار)                       |
| `src/app/api/mcp/status/route.ts`                                        | endpoint `/api/mcp/status`                                   |
| `src/app/api/mcp/tools/route.ts`                                         | endpoint `/api/mcp/tools`                                    |
| `src/app/api/mcp/sse/route.ts`                                           | مسیر ترنسپورت SSE `/api/mcp/sse`                             |
| `src/app/api/mcp/stream/route.ts`                                        | مسیر ترنسپورت Streamable HTTP `/api/mcp/stream`             |
| `src/app/api/mcp/audit/route.ts`                                         | کوئری log ممیزی `/api/mcp/audit`                             |
| `src/app/api/mcp/audit/stats/route.ts`                                   | معیارهای ممیزی تجمیعی `/api/mcp/audit/stats`                 |
| `src/lib/notion/api.ts`                                                  | کلاینت REST API مربوط به Notion (retry، timeout، دسته‌بندی خطا) |
| `src/lib/db/notion.ts`                                                   | ماندگاری توکن Notion (جدول `key_value`)                      |
| `src/app/api/settings/notion/route.ts`                                   | API تنظیمات Notion (GET/POST/DELETE)                         |
| `src/app/(dashboard)/dashboard/endpoint/components/NotionSourceCard.tsx` | رابط کاربری مدیریت توکن Notion                                |
| `tests/unit/notion-api.test.ts`                                          | آزمون‌های کلاینت API Notion (۷)                              |
| `tests/unit/notion-tools.test.ts`                                        | آزمون‌های اعمال scope ابزارهای Notion (۱۰)                   |
| `tests/unit/db/notion.test.mjs`                                          | آزمون‌های ماژول DB Notion (۳)                                |
