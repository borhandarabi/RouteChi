---
title: "مرجع Quality Gates"
---

# مرجع Quality Gates

این سند مرجع معتبر برای همه quality gate‌های CI در OmniRoute است.
این سند هر gate، آنچه اعتبارسنجی می‌کند، در کدام job CI اجرا می‌شود، آیا از یک baseline ratchet یا سیاست pass/fail استفاده می‌کند، و آیا build را مسدود می‌کند یا صرفاً اطلاع‌رسانی است را توصیف می‌کند.

برای خلاصه کوتاه و سیاست allowlist، به بخش «Quality Gates & Ratchets» در
`CLAUDE.md` مراجعه کنید.

---

## فهرست gate‌ها (حدود ۵۰ اسکریپت)

اسکریپت‌ها در `scripts/check/` (gate‌های سیاست) و `scripts/quality/` (موتور ratchet) قرار دارند.
منبع حقیقت CI `.github/workflows/ci.yml` است.

### Job: `lint`

روی هر PR به `main` اجرا می‌شود. در صورت شکست، merge را مسدود می‌کند.

| اسکریپت (`npm run ...`)       | اعتبارسنجی                                                                                                                                                          | مسدودکننده                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `check:node-runtime`          | نسخه Node.js در محدوده پشتیبانی‌شده است                                                                                                                            | بله                                      |
| `check:cycles`                | import‌های دوری — همه ماژول‌های `src/` + `open-sse/`                                                                                                                | بله                                      |
| `check:route-validation:t06`  | schema‌های Zod روی همه مسیرها موجود است (سیاست Tier 6)                                                                                                              | بله                                      |
| `check:any-budget:t11`        | تعداد `@ts-expect-error // any` از بودجه تجاوز نمی‌کند (catraca Tier 11)                                                                                            | بله                                      |
| `check:provider-consistency`  | هر provider در `providers.ts` یک ورودی مطابق در `providerRegistry.ts` دارد (و برعکس، درون allowlist)                                                              | بله                                      |
| `check:fetch-targets`         | هر `fetch("/api/...")` در `src/` سمت کلاینت به یک `route.ts` واقعی resolve می‌شود                                                                                   | بله                                      |
| `check:deps`                  | همه وابستگی‌های قابل `npm install` در همه `package.json`های مخزن در `dependency-allowlist.json` هستند؛ بسته‌های جدید unpinned یا slopsquatted علامت‌گذاری می‌شوند      | بله                                      |
| `audit:deps`                  | `npm audit` (root + electron) — بدون advisoryهای high/critical (با `check:vuln-ratchet` از osv هم‌پوشانی دارد؛ به Rationalization Backlog مراجعه کنید)               | بله                                      |
| `check:lockfile`              | یکپارچگی `package-lock.json` — رجیستری https، hash‌های integrity، بدون override هاست                                                                               | بله                                      |
| `check:licenses`              | allowlist لایسنس SPDX برای وابستگی‌های تولید                                                                                                                        | بله                                      |
| `check:tracked-artifacts`     | بدون artifact build / symlink‌های `node_modules` commit‌شده (همچنین در husky pre-commit اجرا می‌شود؛ pre-push عمداً سبک است — #6716)                                 | بله                                      |
| `check:file-size`             | هیچ فایل منبعی از سقف به‌ازای-پسوند تجاوز نمی‌کند (ratchet: فایل‌های بزرگ frozen در فهرست `frozen`)                                                                  | بله                                      |
| `check:error-helper`          | پاسخ‌های خطا در executor‌ها/handler‌ها از `buildErrorBody()` / `sanitizeErrorMessage()` استفاده می‌کنند (Hard Rule #12)                                              | بله                                      |
| `check:migration-numbering`   | فایل‌های SQL مهاجرت به‌طور متوالی شماره‌گذاری شده‌اند، بدون فاصله یا تکرار                                                                                           | بله                                      |
| `check:public-creds`          | بدون `client_id`/`client_secret` OAuth تحت‌اللفظی یا کلیدهای Firebase Web خارج از `publicCreds.ts` (Hard Rule #11)                                                   | بله                                      |
| `check:db-rules`              | بدون SQL raw خارج از ماژول‌های `src/lib/db/`؛ بدون barrel-import از `localDb.ts` (Hard Rules #2/#5)                                                                | بله                                      |
| `check:known-symbols`         | executor‌های provider، استراتژی‌های مسیریابی و translator‌های ثبت‌شده در جدول‌های dispatch با فایل‌های روی دیسک مطابقت دارند — بدون symbol یتیم یا اعلان‌نشده          | بله                                      |
| `check:route-guard-membership`| هر مسیری که فرآیند فرزند spawn می‌کند توسط `isLocalOnlyPath()` طبقه‌بندی شده است (Hard Rules #15/#17)                                                               | بله                                      |
| `check:test-discovery`        | هر فایل `*.test.ts` / `*.spec.ts` در مخزن توسط حداقل یک test runner جمع‌آوری می‌شود (ratchet: فهرست یتیم در `test-discovery-baseline.json` فقط می‌تواند کوچک شود)   | بله                                      |
| `check:docs-sync`             | نسخه CHANGELOG، نسخه OpenAPI و `llm.txt` همگام هستند                                                                                                                | بله                                      |
| `typecheck:core`              | کامپایل TypeScript بدون خطا (فقط هشدارهای اطلاع‌رسانی)                                                                                                              | بله                                      |
| `typecheck:noimplicit:core`   | `noImplicitAny` سخت — آینده‌نگر؛ بسیاری از call site‌های موجود هنوز به annotation نیاز دارند                                                                         | **اطلاع‌رسانی** (`continue-on-error: true`) |

### Job: `quality-gate`

بعد از `test-coverage` اجرا می‌شود. در صورت شکست، merge را مسدود می‌کند.

| اسکریپت                       | اعتبارسنجی                                                                                                                      | مسدودکننده                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `quality:collect`             | `quality-metrics.json` را تولید می‌کند (تعداد هشدار ESLint، coverage از گزارش shard ادغام‌شده)                                  | بله (بالادست ratchet)                    |
| `quality:ratchet`             | هیچ معیار در `quality-baseline.json` regression پیدا نکرده (هشدارهای ESLint ≤ baseline؛ coverage ≥ baseline)                    | بله                                      |
| `check:duplication`            | تکرار کد (jscpd@4) از baseline در `quality-baseline.json` تجاوز نمی‌کند                                                         | بله                                      |
| `check:complexity`            | پیچیدگی سیکلوماتیک سطح-فایل از سقف تجاوز نمی‌کند (core ESLint `complexity` + `max-lines-per-function`)                          | بله                                      |
| `check:cognitive-complexity`  | ratchet پیچیدگی شناختی (`eslint-plugin-sonarjs`) — pass جداگانه ESLint؛ با `check:complexity` قابل ادغام (به Backlog مراجعه کنید) | بله                                      |
| `check:dead-code`             | ratchet export‌های / فایل‌های استفاده‌نشده (knip) در مقابل baseline regression نمی‌یابد                                          | بله                                      |
| `check:type-coverage`         | ratchet درصد-typed (`type-coverage`) regression نمی‌یابد؛ تا حد زیادی `typecheck:noimplicit:core` را شامل می‌شود                | بله                                      |
| `check:codeql-ratchet`        | تعداد هشدار CodeQL باز regression نمی‌یابد (از طریق `gh api` می‌خواند؛ graceful-skip بدون token)                                | بله                                      |

### Job: `quality-extended`

کل job اطلاع‌رسانی است (`continue-on-error: true`). ratchet‌های مبتنی بر npm واقعاً
اجرا می‌شوند؛ اسکنرهای خارجی از طریق `gh release download` نصب می‌شوند و خود-عبور می‌کنند (exit 0)
وقتی یک باینری هنوز غایب است.

| اسکریپت                | اعتبارسنجی                                                                                                                                                                | مسدودکننده     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `check:circular-deps`  | بدون وابستگی دوری (dpdm)                                                                                                                                                  | **اطلاع‌رسانی** |
| `check:bundle-size`    | اندازه bundle از سقف تجاوز نمی‌کند                                                                                                                                        | **اطلاع‌رسانی** |
| `check:secrets`        | اسکن secret (gitleaks) — اگر باینری غایب باشد عبور می‌کند                                                                                                                 | **اطلاع‌رسانی** |
| `check:vuln-ratchet`   | آسیب‌پذیری‌های وابستگی (osv-scanner) regression نمی‌یابند — اگر باینری غایب باشد عبور می‌کند                                                                              | **اطلاع‌رسانی** |
| `check:workflows`      | lint ورک‌فلو (actionlint + zizmor) — اگر باینری‌ها غایب باشند عبور می‌کند                                                                                                  | **اطلاع‌رسانی** |
| `check:openapi-breaking` | تغییرات شکستن‌نده قرارداد API عمومی (`openapi.yaml`) در مقابل شاخه پایه (oasdiff) — `openapiBreaking=N` تولید می‌کند؛ اگر oasdiff غایب یا spec پایه غیرقابل‌حل باشد عبور می‌کند | **اطلاع‌رسانی** |

### Job: `docs-sync-strict`

روی هر PR به `main` اجرا می‌شود. در صورت شکست، merge را مسدود می‌کند.

| اسکریپت                          | اعتبارسنجی                                                                                                                                         | مسدودکننده                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `check:docs-all`                 | meta-gate که ۶ زیر-gate زیر را به‌ترتیب اجرا می‌کند                                                                                                | بله                                      |
| ↳ `check:docs-sync`              | یکپارچگی نسخه CHANGELOG / OpenAPI / llm.txt                                                                                                       | بله                                      |
| ↳ `check:docs-counts`            | تعدادها در pros (تعداد provider، تعداد مهاجرت، و غیره) در پنجره ratchet تعداد واقعی هستند                                                          | بله                                      |
| ↳ `check:env-doc-sync`           | هر متغیر env در `.env.example` در یک جدول مستندات مستند شده، و برعکس                                                                                          | بله                                      |
| ↳ `check:deprecated-versions`    | بدون رشته‌های نسخه deprecated در مستندات                                                                                                          | بله                                      |
| ↳ `check:doc-links`              | لینک‌های markdown داخلی در مستندات به فایل‌های واقعی resolve می‌شوند (فرم `[text]`/`(path)`)                                                       | بله                                      |
| ↳ `check:fabricated-docs`        | مسیرها، متغیرهای env، دستورات CLI، نام‌های hook و مسیرهای فایل ذکرشده در مستندات در codebase وجود دارند. gate سخت از طریق `--strict`؛ بدون flag soft-fail. | بله (از طریق `--strict` در CI)           |
| `check:cli-i18n`                 | رشته‌های دستور CLI در همه فایل‌های locale i18n موجود هستند                                                                                         | بله                                      |
| `check:openapi-coverage`         | spec OpenAPI حداقل یک کف ratchet‌شده از مسیرهای واقعی را پوشش می‌دهد                                                                                | بله                                      |
| `check:openapi-security-tiers`   | annotation‌های سطح امنیتی در `openapi.yaml` با طبقه‌بندی‌های `routeGuard.ts` سازگار هستند                                                          | **اطلاع‌رسانی**                           |
| `check:openapi-routes`           | هر مسیر در `openapi.yaml` به یک `route.ts` واقعی resolve می‌شود (ضد توهم)                                                                          | بله                                      |
| `check:docs-symbols`             | هر ارجاع `/api/...` در `docs/**/*.md` به یک `route.ts` واقعی resolve می‌شود (ضد توهم)                                                              | بله                                      |
| `i18n translation drift`         | کلیدهای ترجمه‌نشده در فایل‌های locale i18n — فقط هشدار                                                                                              | **اطلاع‌رسانی**                           |

### Job: `i18n-ui-coverage`

| اسکریپت                          | اعتبارسنجی                       | مسدودکننده |
| -------------------------------- | --------------------------------- | ---------- |
| `check-ui-keys-coverage` (inline) | پوشش کلید i18n UI ≥ ۶۵٪ است      | بله        |

### Job: `i18n`

ماتریس کامل اعتبارسنجی i18n (یک job به‌ازای هر locale). کل job اطلاع‌رسانی است.

| اسکریپت                          | اعتبارسنجی                           | مسدودکننده                                              |
| -------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `validate_translation.py quick` | تکمیل ترجمه به‌ازای هر locale        | **اطلاع‌رسانی** (`continue-on-error: true` روی کل job) |

### Job: `pr-test-policy`

فقط روی pull request اجرا می‌شود.

| اسکریپت               | اعتبارسنجی                                                                                                                  | مسدودکننده |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `check:pr-test-policy`| PR‌هایی که کد تولید را در `src/`، `open-sse/`، `electron/` یا `bin/` تغییر می‌دهند باید آزمون شامل یا به‌روزرسانی کنند (Hard Rule #8) | بله        |
| `check:test-masking`  | فایل‌های آزمون تغییر‌یافته تعداد assert خالص را کاهش نمی‌دهند یا توتولوژی `assert.ok(true)` اضافه نمی‌کنند                     | بله        |
| `check:pr-evidence`   | بدنه PR شواهد آزمون/VPS برای تغییر را ذکر می‌کند (Hard Rule #18 را با grep کردن prose PR مکانیزه می‌کند — شکننده، به Backlog مراجعه کنید) | بله        |

### Job: `test-vitest`

بعد از `build` اجرا می‌شود. در صورت شکست، merge را مسدود می‌کند.

| Suite            | اعتبارسنجی                                               | مسدودکننده                                                              |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `test:vitest`    | MCP server (۹۴ ابزار)، autoCombo، cache — runner vitest | بله                                                                    |
| `test:vitest:ui` | آزمون‌های مؤلفه UI — runner vitest                      | **اطلاع‌رسانی** (`continue-on-error: true`) — تا زمان Fase 6A UI triage شکست‌خورده |

### ورک‌فلو‌های nightly (زمان‌بندی‌شده، اطلاع‌رسانی)

این‌ها روی یک زمان‌بندی cron (و `workflow_dispatch`) اجرا می‌شوند، هرگز روی PR. همه اطلاع‌رسانی هستند.

| ورک‌فلو                | اعتبارسنجی                                                                                                                                          | مسدودکننده     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `nightly-property`     | آزمون‌های property fast-check با seed تصادفی + run count بالا                                                                                        | **اطلاع‌رسانی** |
| `nightly-resilience`   | gate رشد heap، تزریق خطای chaos، load/soak با k6                                                                                                    | **اطلاع‌رسانی** |
| `nightly-llm-security` | حفاظ تزریق promptfoo (حالت block) + probe‌های garak (بدون یک secret provider عبور می‌شوند)                                                          | **اطلاع‌رسانی** |
| `nightly-schemathesis` | fuzzing قرارداد OpenAPI (schemathesis) علیه یک OmniRoute زنده با استفاده از `docs/openapi.yaml` — نقض spec / ۵۰۰‌های مدیریت‌نشده را آشکار می‌کند (Fase 8 B.4) | **اطلاع‌رسانی** |

---

## Baseline رatchet (`quality-baseline.json`)

موتور ratchet (`scripts/quality/check-quality-ratchet.mjs`) `quality-baseline.json` را می‌خواند
و در مقابل `quality-metrics.json` تازه جمع‌آوری‌شده مقایسه می‌کند. هر معیاری که از epsilon خود regress کند،
build را شکست می‌دهد.

معیارهای پیگیری‌شده فعلی:

| معیار                 | جهت  | معنی                               |
| --------------------- | ----- | ---------------------------------- |
| `eslintWarnings`      | `down`| تعداد هشدار ESLint نباید رشد کند   |
| `coverage.statements` | `up`  | پوشش statement نباید افت کند       |
| `coverage.lines`      | `up`  | پوشش line نباید افت کند            |
| `coverage.functions`  | `up`  | پوشش function نباید افت کند        |
| `coverage.branches`   | `up`  | پوشش branch نباید افت کند          |

برای به‌روزرسانی baseline پس از یک بهبود واقعی:

```bash
npm run quality:ratchet -- --update
git add quality-baseline.json
```

flag `--update` مقادیر اندازه‌گیری‌شده فعلی را در `quality-baseline.json` می‌نویسد.
این فایل را همراه با تغییری که معیار را بهبود بخشید commit کنید. PR‌ای که یک
معیار را بدون به‌روزرسانی baseline بهبود می‌بخشد، توسط `--require-tighten` گرفته می‌شود (Fase 6A.5،
در انتظار پیاده‌سازی).

---

## سیاست Allowlist

هر gate‌ای که نمی‌تواند روی نقض‌های موجود شکست بخورد، از یک allowlist frozen استفاده می‌کند
(مثلاً `KNOWN_STALE_DOC_REFS`، `KNOWN_MISSING`، `KNOWN_RAW_SQL`). سیاست این است:

**علت ریشه را اصلاح کنید؛ فقط وقتی نقض موجود است و در همان PR قابل اصلاح نیست از allowlist استفاده کنید.**

هنگام افزودن یک ورودی به allowlist:

1. یک کامنت با justification اضافه کنید.
2. به issue پیگیری ارجاع دهید (مثلاً `// #3498 — Phase 2 feature، هنوز پیاده‌سازی نشده`).
3. ورودی را در همان PR‌ای که نقض را اصلاح می‌کند حذف کنید — یک ورودی stale که دیگر
   یک نقض فعال را سرکوب نمی‌کند، خودش یک نقص است (stale-enforcement 6A.3 یک‌بار پیاده‌سازی شود
   gate را روی یک ورودی allowlist یتیم شکست می‌دهد).

برای اینکه آزمون‌ها سریع‌تر pass شوند ورودی‌های allowlist **اضافه نکنید**. یک gate سبز با یک allowlist
در حال رشد، حس کاذبی از کیفیت است.

### وقتی یک gate روی PR شما شکست می‌خورد

1. **خروجی gate را با دقت بخوانید** — دقیقاً به شما می‌گوید کدام فایل یا symbol قاعده را نقض کرده.
2. **نقض را اصلاح کنید** — اکثر gate‌ها بررسی‌های قطعی filesystem هستند که به‌محض
   درست بودن کد pass می‌شوند.
3. **اگر نقض موجود است** (یعنی شما آن را معرفی نکرده‌اید اما اکنون gate آن را پوشش می‌دهد): یک ورودی allowlist با کامنت justification و issue پیگیری اضافه کنید.
4. **اگر gate یک ratchet است** (coverage، هشدارهای ESLint، duplication، complexity):
   تغییر شما معیار را بدتر کرد. مسئله ریشه‌ای را اصلاح کنید، یا (به‌ندرت)
   `npm run quality:ratchet -- --update` را اجرا کنید اگر تغییر عمدی است و regression
   معیار قابل‌قبول است — اما چرا را در توضیحات PR مستند کنید.
5. **gate‌های اطلاع‌رسانی** (`continue-on-error: true`) اطلاعاتی هستند — merge را مسدود نمی‌کنند
   اما در خلاصه CI ظاهر می‌شوند. به هر حال آن‌ها را اصلاح کنید.

---

## افزودن یک gate جدید

1. `scripts/check/check-<name>.mjs` (یا `.ts`) بسازید. gate‌های سیاست 0/1 را exit می‌کنند.
   gate‌های سبک ratchet یک معیار به `quality-metrics.json` از طریق `collect-metrics.mjs` تولید می‌کنند.
2. `"check:<name>": "node scripts/check/check-<name>.mjs"` را به `package.json` اضافه کنید.
3. آن را در `.github/workflows/ci.yml` تحت job مناسب سیم‌کشی کنید
   (سیاست ← `lint` یا `docs-sync-strict`؛ ratchet ← `quality-gate`).
4. اگر allowlist دارد، `reportStaleEntries()` از
   `scripts/check/lib/allowlist.mjs` را اعمال کنید تا ورودی‌های stale به‌طور خودکار شناسایی شوند.
5. یک آزمون در `tests/unit/build/` بنویسید که منطق شناسایی gate را پوشش دهد.
6. این سند را به‌روزرسانی کنید (یک ردیف به جدول job مربوطه اضافه کنید).

---

## ابزار agent: LSP-in-the-loop (اختیاری)

علاوه بر gate‌های CI، OmniRoute یک داربست `agent-lsp` **اختیاری** ارائه می‌دهد
(یک `.mcp.json` سطح پروژه، Fase 7 Task 15). `.mcp.json` بسازید
تا یک زبان سرور TypeScript را به agent‌های کدنویسی暴露 کند، تا symbol‌ها / diagnostic‌ها را **قبل از** نوشتن کد حل کنند —
همراه compile-before-claim با `typecheck:core` که خطاهای «symbol جعلی» را در منبع کاهش می‌دهد. این عمداً
auto-load نمی‌شود (شما پل MCP↔LSP را انتخاب و راستی‌آزمایی می‌کنید)؛ یک ورودی خراب فقط یک
خطای اتصال ثبت می‌کند و هرگز session‌ها را خراب نمی‌کند.

---

## Rationalization Backlog (بررسی ROI — Fase 9 Onda 3)

این فهرست در 2026-06-17 در مقابل `ci.yml` تطبیق داده شد (نسخه قبلی `audit:deps`،
`check:tracked-artifacts`، `check:lockfile`، `check:licenses`،
`check:dead-code`، `check:cognitive-complexity`، `check:type-coverage`،
`check:codeql-ratchet`، `check:pr-evidence` را حذف کرده بود). بررسی ROI از مجموعه تطبیق‌یافته
کاندیداهای rationalization زیر را شناسایی کرد. **merge‌ها تغییرات مکانیکی CI هستند؛ flip/drop‌ها
تصمیمات سیاستی هستند که برای اپراتور محفوظ می‌مانند.** هیچ‌کدام از موارد زیر
هنوز اعمال نشده است.

**همچنین در بالا مستند نشده** (اطلاع‌رسانی، سیگنال کم): job `docs-lint`
(markdownlint + Vale، کل job `continue-on-error`) و ورک‌فلوهای اسکنر standalone
`semgrep.yml` / `codeql.yml` / `scorecard.yml`. `semgrepFindings: 0` در
`quality-baseline.json` است اما به یک ratchet مسدودکننده در `ci.yml` سیم‌کشی نشده — معیار در حال حاضر
یتیم است.

### ادغام / حذف تکرار (مکانیکی، ریسک کمتر)

هر کاندید در 2026-06-17 در مقابل state gate زنده راستی‌آزمایی شد (trust-but-verify)؛
چندین ادغام «بدیهی» نشان دادند که debt پنهان دارند و drop-in تمیز **نیستند**.

- **`check:docs-sync` دو بار اجرا می‌شود** — standalone در job `lint` و دوباره درون `check:docs-all` (`docs-sync-strict`) و hook pre-commit husky. ✅ **انجام شد** — فراخوانی standalone `lint` حذف شد.
- **اسکن CVE** — ❌ **ادغام تمیز نیست.** `audit:deps` روی هر CVE high/critical سخت-شکست می‌خورد؛ `check:vuln-ratchet` (osv) فقط روی _regression_ در مقابل baseline شکست می‌خورد (در حال حاضر ۱ MODERATE). معانی متفاوت — حذف `audit:deps` gate مطلق high/critical را از دست می‌دهد. هر دو را نگه دارید.
- **شناسایی چرخه** — ❌ **ادغام تمیز نیست.** `check:circular-deps` (dpdm) **۹۱ چرخه** گزارش می‌کند (به همین دلیل اطلاع‌رسانی است)؛ نمی‌تواند بدون حل اولیه آن‌ها به مسدودکننده ارتقا یابد، و scope گسترده‌تری از `check:cycles` سبز و درمان‌شده دارد. `check:cycles` مسدودکننده را نگه دارید؛ حل ۹۱ چرخه dpdm backlog مختص به خود است.
- **پیچیدگی** — ✅ **انجام شد** (`check:complexity-ratchets` / `eslint.complexity-ratchets.config.mjs`): یک walk ESLint، شمارش بر اساس ruleId تا baselines سیکلوماتیک+max-lines و شناختی مستقل بمانند؛ `check:complexity` / `check:cognitive-complexity` فردی برای `--update` محلی باقی می‌مانند.
- **ضدتوهم `/api`** — ✅ **انجام شد** (`check:api-docs-refs` + `scripts/check/lib/apiRoutes.mjs`): یک فهرست FS از `src/app/api`، openapi-routes + docs-symbols همچنان مستقل گزارش می‌دهند؛ فردی برای اجرای محلی باقی می‌ماند.
- **`check:node-runtime` در ۱۱ job اجرا می‌شود** — ⚠️ **ROI کم.** هر کدام یک runner جداگانه و بررسی <1s است؛ صرفه‌جویی کل ~10s، در مقابل از دست دادن یک حفاظ ارزان به‌ازای-job. ارزش چرخش ندارد.
- **`typecheck:noimplicit:core` روی CI lint** — ✅ **از job lint حذف شد** (اطلاع‌رسانی `continue-on-error` بود)؛ سطح تایپ مسدودکننده `typecheck:core` + `check:type-coverage` است. اسکریپت محلی حفظ شد.

### Flip / تصمیم (سیاست اپراتور)

- `check:openapi-security-tiers` (اطلاع‌رسانی) — ❌ **به‌طور تمیز قابل flip نیست.** exit 0 است اما هشدار می‌دهد که چندین مسیر `traffic-inspector` زیر `LOCAL_ONLY_API_PREFIXES` فاقد annotation `x-loopback-only: true` هستند. اعمال آن نیازمند افزودن اولیه آن annotation‌ها به `openapi.yaml` است.
- `typecheck:noimplicit:core` (اطلاع‌رسانی) — تا حد زیادی توسط ratchet مسدودکننده `check:type-coverage` شامل می‌شود. به یک ratchet flip کنید یا pass دوم `tsc` افزون را حذف کنید.
- `test:vitest:ui` (اطلاع‌رسانی، ۱۴ شکست parked) — اصلاح-و-مسدود یا حذف؛ فاسد را رها نکنید.
- `check:secrets` (gitleaks، ratchet مسدودکننده frozen در ۳ false-positive مستند) — ۳ مورد را به allowlist اضافه کنید تا به ۰ برسد، یا به اطلاع‌رسانی تنزل دهید. با اسکن secret بومی GitHub + `check:public-creds` هم‌پوشانی دارد.
- `check:pr-evidence` (مسدودکننده، prose بدنه PR را grep می‌کند) — ریسک false-positive بالا؛ اگر حذف شود اعمال Hard Rule #18 را تضعیف می‌کند، بنابراین این یک تصمیم سیاستی واقعی است.
- `semgrep` (اطلاع‌رسانی standalone) — با CodeQL برای خانواده‌های OWASP هم‌پوشانی دارد؛ baseline آن را به یک ratchet سیم‌کشی کنید یا حذف کنید.

---

## مستندات مرتبط

- زنجیره تأمین (provenance، SBOM، Trivy، Scorecard): [`docs/security/SUPPLY_CHAIN.md`](../security/SUPPLY_CHAIN.md)
