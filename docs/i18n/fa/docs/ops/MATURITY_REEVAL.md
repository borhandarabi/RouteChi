---
title: "ارزیابی مجدد بلوغ گیت‌های کیفیت (فاز ۹)"
---

# ارزیابی مجدد بلوغ — پس از موج‌های ۰ تا ۳ (Quality-Gate v2)

> **این سند چیست.** یک اندازه‌گیری دوبارهٔ بلوغ سیستم گیت‌های کیفیت
> **پس از** موج‌های ۰ تا ۳ برنامهٔ Quality-Gate v2، در مقایسه با خط‌مبنای ثبت‌شده در
> [`QUALITY_GATE_PLAYBOOK.md`](./QUALITY_GATE_PLAYBOOK.md) (2026-06-16). نشان می‌دهد چه چیزی تغییر کرده،
> در برابر DSOMM L5 / OpenSSF Scorecard 9 / SLSA L3، با تفکیک آنچه **توسط CI قابل‌اندازه‌گیری** است
> (از قبل تحویل‌شده/قابل‌تحویل با کد) از آنچه **فرایندی/مالکانه** است (تنظیمات سازمان).
>
> **تاریخ:** 2026-06-30. تولیدشده از وضعیت واقعی مخزن، نه از حافظه.
> **بنچ‌مارک‌ها:** OWASP DSOMM · OpenSSF Scorecard · SLSA · SonarQube "Clean as You Code".

---

## ۱. رأی به‌روزشده

**نمرهٔ کلی: A− → A («پیشرفته»، ۵٪ برتر).** دو ضعف ساختاری بزرگ
خط‌مبنای 06-16 — _شکاف fast-gates_ و _mutation-score-not-a-ratchet_ — **بسته شده‌اند**.
شکاف‌های باقی‌مانده برای «بیشینهٔ مطلق» تقریباً همگی **وابسته به مالک/زیرساخت** هستند (محافظت از شاخه،
SLSA L3، CodeQL پیشرفته)؛ سمت کد برنامه اساساً کامل شده است.

| چارچوب مرجع                    | خط‌مبنای 06-16                | اکنون 06-30                                                            | حرکت     | شاهد                                                                  |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| **OWASP DSOMM** (۵ سطح)        | L3→L4                         | **L4** در _Test Intensity_ و _Static Depth_؛ L3 محکم در بقیه            | ▲        | mutation-ratchet مسدودکننده + سوئیت قطعی در گیت merge                 |
| **OpenSSF Scorecard**          | ~۷–۸/۱۰                       | ~۷–۸/۱۰ (بدون تغییر — گیت **مالک** است)                                 | =        | نبود Branch-Protection روی `main` (تنظیم مالک) + pin کردن actions     |
| **SLSA**                       | L2→L3                         | **L2** (نزدیک به L3)                                                   | =        | نبود builder hermetic/reproducible (زیرساخت/مالک)                     |
| **SonarQube "Clean as You Code"** | منطبق با هشدار               | منطبق با هشدار                                                         | =        | هشدار _sprawl_ (۴۶+ گیت) باقی است — بررسی ROI در انتظار               |
| **الگوی Quality-Ratchet**      | نمونه                          | **نمونه+**                                                             | ▲        | `dedicatedGate` جدید برای `mutationScore` (جهت رو به بالا)            |
| **تست جهش (Mutation testing)** | «تقریباً رسید» (ratchet نبود) | **ratchet فعال**                                                       | ▲▲       | `check-mutation-ratchet.mjs` + خط‌مبنای seeded + کار شبانه مسدودکننده |

---

## ۲. دلتاها از 2026-06-16 (آنچه موج‌های ۰ تا ۳ تحویل دادند)

### ۲.۱ 🔴→✅ شکاف fast-gates بسته شد (ضعف ساختاری شماره ۱ بود)

خط‌مبنا هشدار داده بود: `quality.yml` (PR→`release/**`) **فقط گیت‌های filesystem** را اجرا می‌کرد — بدون
typecheck، تست یا build — بنابراین پس‌رفت‌های قطعی فقط روی PR→`main` منفجر می‌شدند.
**امروز** `.github/workflows/quality.yml` در کار _Fast Quality Gates_ اجرا می‌شود: `typecheck:core`،
**تست‌های واحد آسیب‌دیده به‌صورت مسدودکننده (TIA) با fail-safe به سوئیت کامل**،
fast-path مربوط به vitest، و shardهای واحد. گیت اکنون **آن‌جا که merge اتفاق می‌افتد** اجرا می‌شود (shift-left)،
دقیقاً همان اصل cross-cutting که playbook تجویز می‌کند.

### ۲.۲ 🟠→✅ نمرهٔ جهش به ratchet تبدیل شد (ضعف شماره ۳ / P0 شماره ۱ بود)

قوی‌ترین پادزهر علیه coverage-gaming **توصیه‌ای** بود. **امروز**:

- `scripts/check/check-mutation-ratchet.mjs` (به‌طور پیش‌فرض توصیه‌ای، `--ratchet` مسدودکننده، skip با ظرافت)؛
- `config/quality/quality-baseline.json` دارای ورودی‌های `mutationScore.<module>` seeded است (`direction: up`، `dedicatedGate`)؛
- `.github/workflows/nightly-mutation.yml` شامل کار **"Mutation score ratchet (blocking)"** است که گزارش‌های دسته‌ای را یکپارچه کرده و نمرات ادغام‌شدهٔ هر ماژول را ratchet می‌کند.

نتیجه: نمرهٔ جهش هر ماژول **نمی‌تواند پس‌رفت کند** — coverage دیگر یک معیار خودنمایی نیست.

### ۲.۳ ✅ گیت‌های quick-win (فاز 6A/7) تحویل شدند

- **اصلاح «fake-green» در a11y axe-core:** `@axe-core/playwright` در devDeps؛ `a11y.spec.ts` با skip شرطی `REQUIRE_AXE`؛ کار در `nightly-resilience.yml`.
- **اسکن پیچیدگی `bin/`+`electron`:** `check-complexity.mjs` این دایرکتوری‌ها را در `ESLINT_ARGS` شامل می‌شود.
- **مصنوعات tracked در pre-commit + pre-push:** `.husky/pre-commit` و `pre-push` مصنوعات به‌اشتباه tracked را مسدود می‌کنند.

---

## ۳. ۱۲ دسته — وضعیت (با تمرکز بر دلتا)

| #   | دسته                            | وضعیت 06-30                                                                              |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| ۱   | سبک و قالب‌بندی                 | ✅ بدون تغییر (Prettier+ESLint lint-staged)                                              |
| ۲   | تایپ‌ها                          | ✅ **تقویت‌شده** — `typecheck:core` اکنون در گیت PR→release نیز هست                       |
| ۳   | تست‌ها (شدت)                    | ✅ **تقویت‌شده** — تست جهش به ratchet تبدیل شد؛ سوئیت قطعی در گیت merge                   |
| ۴   | سیاست تست (ضد gaming)           | ✅ بدون تغییر (pr-test-policy/test-masking/pr-evidence)                                  |
| ۵   | پیچیدگی و سلامت                 | ✅ **تقویت‌شده** — اسکن پیچیدگی bin/electron                                              |
| ۶   | امنیت ایستا (SAST+secrets)      | 🟡 CodeQL default-setup (پیشرفته = مالک)؛ semgrep ابری نسخه‌گذاری نشده                   |
| ۷   | زنجیرهٔ تأمین (وابستگی‌ها)        | ✅ بدون تغییر (osv/audit/Trivy/Dependabot + allowlist)                                   |
| ۸   | زنجیرهٔ تأمین (build/release)    | 🟡 SLSA L2 (L3 = builder hermetic، مالک/زیرساخت)                                         |
| ۹   | قراردادها و API                 | 🟡 oasdiff/osv توصیه‌ای (کاندیداهای blocking-with-scope، P1)                             |
| ۱۰  | مستندات و i18n (ضد rot)         | ✅ **تقویت‌شده** — `fabricated-docs --strict` مسدودکننده (exit 0 تأیید شد)               |
| ۱۱  | ضد توهم / یکپارچگی              | ✅ بدون تغییر (known-symbols/fetch-targets/docs-symbols/db-rules)                        |
| ۱۲  | تاب‌آوری و دامنه                 | ✅ بدون تغییر (chaos/heap/k6/promptfoo/garak شبانه)                                       |

---

## ۴. شکاف‌های باقی‌مانده برای «بیشینهٔ مطلق»

### ۴.۱ قابل‌اندازه‌گیری با CI / قابل‌تحویل با کد (backlog این برنامه)

- **P1 — osv/oasdiff → blocking با اسکوپ درست:** osv فقط `CRITICAL`+قابل‌رفع (دو‌مرحله‌ای مثل Trivy)؛ oasdiff تغییرات breaker قرارداد را مسدود می‌کند.
- **P1 — `require-tighten` مسدودکننده (پایان چرخه):** دستاوردهای معیار را قفل می‌کند (از شل‌کردن خط‌مبنا بدون ثبت جلوگیری می‌کند).
- **P1/P2 — بررسی ROI / gate sprawl:** یکپارچه‌سازی میکرو‌گیت‌های doc-sync؛ اندازه‌گیری زمان هر گیت در `ci-summary` (با خستگی مقابله می‌کند — هشدار SonarQube/DORA). ادغام‌های ROI به‌تعویق‌افتاده (پیچیدگی یکپارچه؛ ضد توهم یکپارچهٔ `/api`) این‌جا قرار می‌گیرند.
- **P2 — commit کردن پیکربندی CodeQL + نسخه‌گذاری semgrep:** کنترل/تکرارپذیری بیشتر.

### ۴.۲ فرایند / مالک (CI نمی‌تواند جابجا کند — تنظیمات سازمان)

- **Branch-protection روی `main`** (Scorecard را بالا می‌برد، شکاف DSOMM را می‌بندد). ر.ک. [`BRANCH_PROTECTION_MAIN.md`](./BRANCH_PROTECTION_MAIN.md).
- **CodeQL Default → Advanced setup.**
- **SLSA L3** — builder hermetic/reproducible (مولد SLSA گیت‌هاب). هدف توسعه (بازدهی نزولی).

### ۴.۳ صراحتاً خارج از اسکوپ

- **DSOMM L5** عمدتاً **در سطح سازمان/فرایند** است (قابل‌کدنویسی در CI نیست).
- **SLSA L4** (تکرارپذیری بیت‌به‌بیت) یک هدف توسعه‌ای اعلام‌شده است.

---

## ۵. موارد به‌تعویق‌افتاده/حذف‌شده (مرتب‌سازی دم)

- **`semcheck.yaml` (لایهٔ LLM برای انحراف معنایی docs↔code) — حذف شد.** این فایل
  **یتیم بود** (هیچ workflow/scriptی آن را فراخوانی نمی‌کرد) و شمارش‌های کهنه‌ای در قواعد داشت. پوشش قطعی
  از قبل وجود دارد (`check:fabricated-docs --strict` + `check:docs-counts-sync` + `check:docs-symbols`)،
  و هشدار _gate sprawl_ افزودن یک گیت توصیه‌ای LLM با هزینهٔ مستمر را منصرف می‌کند.
  ممکن است در آینده به‌عنوان یک کار شبانهٔ opt-in دوباره معرفی شود اگر انحراف معنایی به یک مشکل واقعی تبدیل شود.
- **اسکفلد `agent-lsp` — به‌تعویق‌افتاده / opt-in فعال نشده.** به‌عنوان یک اشاره در مستندات
  (`docs/architecture/QUALITY_GATES.md`، CHANGELOG) وجود دارد اما **بدون سیم‌کشی** و بدون `.mcp.json.example`
  در مخزن. به‌عنوان یک اسکفلد opt-in مستند باقی می‌ماند؛ یک گیت فعال یا شکاف بلوغ نیست.
