---
title: "کتابچهٔ راهنمای گیت کیفیت"
---

# سیستم گیت کیفیت — ارزیابی انتقادی، فهرست و کتابچهٔ راهنمای تکرار

> **این سند چیست.** یک ارزیابی انتقادی از سیستم گیت کیفیت RouteChi،
> در مقایسه با بهترین رویکرهای صنعت، **به‌علاوهٔ** یک فهرست جامع از همهٔ نقاط
> بررسی کیفیت و یک **برنامهٔ تکرار مستقل از ابزار** برای اعمال همان سیستم روی
> هر پروژه. تولیدشده در 2026-06-16 از وضعیت واقعی مخزن (نه از حافظه).
>
> بنچ‌مارک‌ها: OWASP DSOMM · OpenSSF Scorecard · SLSA · SonarQube "Clean as You Code" ·
> الگوی Quality-Ratchet · DORA 2024 · OWASP LLM Top 10 (2025) · بهترین رویه‌های تست جهش.

---

## بخش ۱ — رأی و طبقه‌بندی بلوغ

**نمرهٔ کلی: A− / «پیشرفته». ۵ تا ۱۰٪ پروژه‌های برتر.** این سیستم به‌صورت مستقل
چندین الگو را پیاده‌سازی می‌کند که صنعت به‌صراحت نام‌گذاری کرده — که قوی‌ترین سیگنال
هم‌راستایی است (ما یک چک‌لیست را کپی نکردیم؛ به رویه‌های درست همگرا شدیم).

| چارچوب مرجع                              | جایگاه ما                                                                                                                                                                                                                  | نمره                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **OWASP DSOMM** (۵ سطح، ۵ بُعد)         | L3 محکم، در حال رسیدن به ۴ در _Test Intensity_ و _Static Depth_. اکثر سازمان‌ها در ۱–۲ هستند.                                                                                                                                  | **L3→L4**                |
| **OpenSSF Scorecard** (۱۸ بررسی)        | در CI-Tests، Code-Review، Dependency-Update-Tool، Fuzzing، SAST، Signed-Releases (provenance)، Token-Permissions، Vulnerabilities، Dangerous-Workflow قبول می‌شویم. **شکاف‌ها:** Branch-Protection روی `main` خاموش؛ برخی actions پین نشده. | **~۷–۸/۱۰**              |
| **SLSA** (۴ سطح)                        | `npm publish --provenance` + `id-token: write` + build گیت‌هابی = **L2**، نزدیک به L3. نبود builder hardened/hermetic برای L3+.                                                                                                  | **L2→L3**                |
| **SonarQube "Clean as You Code"**        | فلسفهٔ یکسان: ratchet _non-regression_ را گیت می‌کند (کد جدید معیار را بدتر نمی‌کند). **اختلاف:** Sonar تعداد **کمی** شرط توصیه می‌کند؛ ما ~۴۶ گیت داریم (خطر خستگی).                                                                  | **منطبق، با هشدار**       |
| **الگوی Quality-Ratchet**                | پیاده‌سازی مرجع: ratchet + `dedicatedGate` + `tightenSlack` + `--require-tighten` + graceful-skip. پیچیده‌تر از اکثر نمونه‌های عمومی.                                                                                          | **نمونه‌شاخص**           |
| **DORA 2024**                            | روی محور _ثبات_ بسیار قوی. خطر: گیت‌های سنگین می‌توانند _lead time_ را هزینه کنند — با تقسیم fast-gates تعدیل شده، اما شکاف پوشش وجود دارد (ر.ک. بخش ۲).                                                                                  | **قوی (ثبات)**           |
| **OWASP LLM Top 10 (2025)**              | خطر #۱ (prompt-injection) را با guard زمان‌اجرا + promptfoo (eval) + garak (red-team) پوشش می‌دهیم. ابزارهای استاندارد صنعت.                                                                                                          | **پوشش‌داده‌شده**         |
| **تست جهش**                              | Stryker شبانه، آستانه‌های ۷۰/۵۰، ۸ ماژول بحرانی. اجماع صنعت (۶۰٪ موجود / ۸۰٪ جدید، شبانه) — **ما فراتر می‌رویم**. **شکاف:** نمره هنوز ratchet نیست.                                                                                          | **تقریباً رسید**          |

---

## بخش ۲ — ارزیابی انتقادی (نقاط قوت + ضعف‌های صادقانه)

### نقاط قوت (آنچه بالاتر از میانگین است)

۱. **موتور ratchet چندمعیاره.** قلب سیستم. ۲۴ معیار در `quality-baseline.json`
   - ۴ خط‌مبنای اختصاصی، هرکدام با جهت (`up`/`down`)، تلورانس (`eps`)، slack
     (`tightenSlack`) و پرچم `dedicatedGate`. چیزهایی که اصلاح می‌شوند **اصلاح‌شده می‌مانند** — این
     پادزهر آنتروپی codebase است.
۲. **دفاع در عمق برای زنجیرهٔ تأمین.** SAST (CodeQL/Sonar) + secretها (gitleaks با
   `useDefault`) + SCA (osv/npm-audit/Trivy/Dependabot) + لایسنس‌ها + lockfile + SBOM + SLSA
   provenance + Scorecard + سخت‌سازی workflow (zizmor). تعداد کمی codebase این پشتهٔ کامل را دارند.
۳. **پادزهرهایی در برابر قانون گودهارت.** پوشش به‌عنوان هدف یک anti-pattern کلاسیک است
   («وقتی معیار به هدف تبدیل می‌شود، دیگر معیار خوبی نیست»). ما poids تعادل‌کننده داریم: **تست جهش**
   (می‌سنجد آیا تست باگ را شکار می‌کند یا فقط خط را اجرا می‌کند)، **`check-test-masking`** (تضعیف assertها
   برای عبور را مسدود می‌کند)، **کف پوشش هر ماژول** (آزمایش کد پرخطر را اجبار می‌کند، نه فقط بخش‌های آسان)
   و **`check-pr-evidence`** (قانون سخت #۱۸).
۴. **گیت‌های ضد توهم / یکپارچگی.** دسته‌ای کمیاب و ارزشمند: `check-known-symbols`،
   `check-fetch-targets`، `check-openapi-routes`، `check-docs-symbols` تضمین می‌کنند که مستندات،
   specs و دیسپچ‌های رشته‌ای به نمادهای زنده اشاره می‌کنند. «rot»ای که lint/test نمی‌گیرند را شکار می‌کند.
۵. **چرخهٔ عمر advisory→blocking.** گیت‌های جدید به‌صورت advisory وارد می‌شوند (هنگام بلوغ
   mergeها را مسدود نمی‌کنند)، سپس در پایان چرخه blocking می‌شوند. اصطکاک را بدون از دست دادن سقف کاهش می‌دهد.
۶. **skip با ظرافت هنگام نبود زیرساخت.** اسکنرها (`--ratchet`) در صورت شکست باینری/شبکه `exit 0` می‌دهند —
   نبود زیرساخت هرگز یک PR قانونی را مسدود نمی‌کند. مهندسی بالغ.
۷. **فرهنگ رمزگذاری‌شده.** Hard Rules + `trust-but-verify` + stale-allowlist + evidence-gate
   انضباط را به تأیید خودکار تبدیل می‌کند.

### ضعف‌های صادقانه (شکاف‌های واقعی)

۱. **🔴 تقسیم fast-gates یک شکاف ساختاری است.** `quality.yml` (PR→`release/**`) **فقط
   گیت‌های filesystem** را اجرا می‌کند — بدون typecheck، بدون تست، بدون build، بدون پوشش. یک پس‌رفت
   typecheck/test در یک PR انتشار عبور می‌کند و فقط در forward-merge به `main` منفجر می‌شود. انگیزه
   (سرعت) معتبر است، اما گیت باید آن‌جا باشد که merge اتفاق می‌افتد (shift-left). **بزرگترین
   اصلاح ساختاری در انتظار.**
۲. **🟠 خطر gate-sprawl/خستگی.** ~۴۶ گیت + ۲۵ کار زیاد است. خود Sonar هشدار می‌دهد:
   شرایط زیاد باعث «خستگی گیت» و بحث‌های اولویت می‌شود و خطر نادیده‌گرفته‌شدن یک گیت وجود دارد. DORA
   هشدار می‌دهد که گیت‌های سنگین lead time را هزینه می‌کنند. ما با سطوح advisory و ratchet غیرمطلق
   تعدیل می‌کنیم، اما یک **بازبینی دوره‌ای ROI برای هر گیت** غایب است (برخی میکرو‌گیت‌های
   doc-sync قابل یکپارچه‌سازی‌اند).
۳. **🟠 نمرهٔ جهش هنوز ratchet نیست.** قوی‌ترین پادزهر علیه coverage-gaming **advisory** است.
   این بالاترین‌ارزش‌ترین مورد در انتظار است (و ۹۰٪ ساخته شده).
۴. **🟡 advisoryهایی که باید مسدود کنند (با اسکوپ درست).** `osv` (vulnCount) و `oasdiff`
   با وجود خط‌مبناهای ثابت advisory هستند. osv-advisory منطقی است (یک CVE جدید روی یک وابستگی قدیمی،
   یک PR نامرتبط را مسدود می‌کند) — اما یک حد واسط وجود دارد (فقط CRITICAL+fixable را مسدود کن،
   مثل Trivy). advisory بودن oasdiff یعنی یک تغییر breaker قرارداد می‌تواند عبور کند.
۵. **🟡 امنیت زمان‌اجرا فقط شبانه است.** schemathesis/garak/promptfoo/chaos/k6 شب اجرا می‌شوند.
   تصمیم درست (کند، نیازمند سرور زنده)، اما یک PR می‌تواند یک پس‌رفت injection-guard وارد کند
   که فقط شب بعد شکار می‌شود.
۶. **🟡 Branch-protection روی `main` خاموش است.** `BRANCH_LOCK_TOKEN` شاخه‌های _release_ را
   قفل می‌کند، اما خود `main` محافظت نشده است. جریمهٔ Scorecard/DSOMM. اقدام مالک لازم است.
۷. **🟡 CodeQL default-setup؛ semgrep رمزگذاری نشده.** default-setup کار می‌کند (۰ هشدار)، اما
   یک `codeql.yml` commit‌شده کنترل بیشتری می‌دهد؛ semgrep ازطریق یک پلتفرم ابری خارجی اجرا می‌شود، نه
   نسخه‌گذاری‌شده در مخزن.

---

## بخش ۳ — فهرست کامل نقاط بررسی کیفیت (قابل‌انتقال)

۱۲ دستهٔ زیر «سیستم کیفیت» در فرم قابل استفادهٔ مجدد هستند. هرکدام
**هدف** (چه چیزی محافظت می‌شود)، **ابزارهایی که استفاده می‌کنیم** و **معادل مستقل از ابزار**
برای تکرار روی هر پشته را فهرست می‌کند.

### ۱. سبک و قالب‌بندی (قطعی، سریع)

- **RouteChi:** Prettier + ESLint ازطریق lint-staged (pre-commit)، ۲-فاصله/دو‌کوتیشن/۱۰۰ستون.
- **عمومی:** یک قالب‌بند auto-fixable + یک linter، در pre-commit روی فایل‌های staged.

### ۲. تایپ‌ها

- **RouteChi:** `typecheck:core` (مسدودکننده) + `typecheck:noimplicit:core` (advisory) + ratchet `type-coverage` 92.17% + بودجهٔ any هر‌فایل.
- **عمومی:** typecheck سخت‌گیرانه در CI + معیار type-coverage با ratchet + بودجهٔ `any`/escape-hatch هر‌فایل.

### ۳. تست‌ها (شدت)

- **RouteChi:** ۲ runner غیرهمپوشان (Node native + vitest)، ۸ shard، پوشش سراسری ۶۰/۶۰/۶۰/۶۰ + ratchet ~۷۶٪ + **۸ کف هر‌ماژول برای ماژول‌های بحرانی** + تست‌های property شبانه + **تست جهش** شبانه.
- **عمومی:** runner(های) تست + کف پوشش **مطلق** (ضد صفر) + **ratchet** پوشش (ضد پس‌رفت) + **کف هر‌ماژول برای کد پرخطر** (ضد گودهارت) + property-based برای منطق خالص + **تست جهش** شبانه به‌عنوان معیار واقعی کیفیت تست.

### ۴. سیاست تست (ضد gaming)

- **RouteChi:** `pr-test-policy` (کد محصول نیازمند تست)، `check-test-masking` (assertهای تضعیف‌شده را مسدود می‌کند)، `pr-evidence` (ادعای موفقیت نیازمند بلوک evidence)، `test-discovery` (هر تست توسط یک runner جمع‌آوری می‌شود).
- **عمومی:** گیت «کد جدید ⇒ تست جدید» + تشخیص assert حذف‌شده/توتولوژی + الزام evidence (TDD یا تست زنده) + تضمین اینکه هیچ تستی بی‌خانمان بیرون از globها نیست.

### ۵. پیچیدگی و سلامت کد (ratchetها)

- **RouteChi:** هشدارهای ESLint (3769↓)، تکثیر jscpd (5.72%↓)، پیچیدگی cyclomatic+max-lines (1800↓)، پیچیدگی شناختی sonarjs (753↓)، dead-code/unused-exports knip (339↓)، اندازهٔ فایل هر‌فایل (ثابت‌شده، فقط کوچک‌شونده)، circular-deps (Tarjan سفارشی، مسدودکننده).
- **عمومی:** هر معیار سلامت را ratchet کنید (هشدارها، تکثیر، پیچیدگی cyclomatic **و** شناختی، dead code، اندازهٔ فایل، چرخه‌های import). جهت همیشه «پس‌رفت نده».

### ۶. امنیت ایستا (SAST + secretها)

- **RouteChi:** CodeQL (ratchet هشدارها = ۰)، gitleaks (`[extend] useDefault=true` — حیاتی!)، SonarQube، قواعد امنیتی سفارشی (public-creds، error-helper، route-guard-membership، route-validation).
- **عمومی:** SAST (CodeQL/Sonar/semgrep) با ratchet هشدار + اسکنر secret با **ruleset پیش‌فرض به ارث برده** (پیکربندی سفارشی که پیش‌فرض را بازنویسی می‌کند = کور) + گیت‌های امنیتی Hard Rule مخصوص پروژه.

### ۷. زنجیرهٔ تأمین (وابستگی‌ها)

- **RouteChi:** osv-scanner + npm-audit + Trivy + Dependabot (SCA)، license-checker (allowlist SPDX)، lockfile-lint (HTTPS+sha512+registry)، `check-deps` ضد slopsquatting (allowlist + عمر ≥۷۲h).
- **عمومی:** SCA چندمنبعی + allowlist لایسنس + بررسی یکپارچگی lockfile + allowlist وابستگی با بررسی عمر/typosquatting + ربات به‌روزرسانی گروهی.

### ۸. زنجیرهٔ تأمین (build و انتشار)

- **RouteChi:** SBOM (CycloneDX + syft)، SLSA provenance (`--provenance`)، OpenSSF Scorecard (هفتگی)، سخت‌سازی workflow (zizmor: artipacked→`persist-credentials:false`، cache-poisoning، token-permissions).
- **عمومی:** تولید SBOM هنگام انتشار + provenance امضا‌شده (SLSA L2+) + Scorecard زمان‌بندی‌شده + سخت‌سازی همهٔ workflowها (توکن‌های حداقل‌امتیاز، بدون اعتبارنامهٔ ماندگار در checkout غیر pusher، actions پین‌شده با SHA).

### ۹. قراردادها و API

- **RouteChi:** oasdiff (تغییر breaker OpenAPI)، schemathesis (contract fuzz شبانه)، openapi-coverage (درصد مسیرهای مستند‌شده، ratchet 38.3%)، openapi-security-tiers (spec در برابر route-guard).
- **عمومی:** diff قرارداد breaker (oasdiff/buf) + fuzz مبتنی بر property در برابر spec (schemathesis) + پوشش مستندات ratchet‌شده + یکپارچگی spec↔code.

### ۱۰. مستندات و i18n (ضد rot)

- **RouteChi:** docs-sync (نسخه‌های آینه)، docs-counts-sync (اعداد در مستندات در برابر کد)، env-doc-sync، doc-links، fabricated-docs، cli-i18n، i18n-ui-coverage (`--threshold=65` + ratchet 80.1%).
- **عمومی:** همگام‌سازی نسخه‌ها/شمارش‌ها/env-vars بین مستندات و کد (گیت، نه اعتماد) + تأیید لینک‌های داخلی + پوشش i18n ratchet‌شده.

### ۱۱. ضد توهم / یکپارچگی (دستهٔ کمیاب)

- **RouteChi:** known-symbols (دیسپچ رشته‌ای ⇒ نماد زنده)، provider-consistency، fetch-targets (fetch کلاینت ⇒ مسیر واقعی)، docs-symbols، db-rules (Hard Rules #2/#5)، migration-numbering.
- **عمومی:** برای هر «منبع حقیقت تکثیر‌شده» (رجیستری، دیسپچ رشته‌ای، ارجاعات cross-layer)، یک گیت که ثابت می‌کند دو طرف تطابق دارند. rotای که typecheck/test نمی‌گیرند را شکار می‌کند.

### ۱۲. تاب‌آوری و دامنه (مخصوص محصول)

- **RouteChi:** chaos (تزریق خطا)، heap-growth (نشت)، k6 (soak)، promptfoo+garak (red-team LLM بر اساس OWASP LLM Top 10)، ۳ قانون تاب‌آوری (circuit-breaker/cooldown/lockout).
- **عمومی:** حالت‌های شکست **دامنهٔ خود** را شناسایی کنید و برای هرکدام یک گیت (حتی شبانه) داشته باشید. برای اپ‌های هوش مصنوعی: red-team تزریق. برای سیستم‌های توزیع‌شده: chaos + نشت + soak.

---

## بخش ۴ — برنامهٔ تکرار برای هر پروژه

به‌صورت **فازی** بسازید، هر فاز به‌تنهایی ارزش می‌آفریند. همهٔ ۱۲ دسته را یک‌باره امتحان نکنید —
این دقیقاً خستگی گیت را که بخش ۲ هشدار می‌دهد، ایجاد می‌کند. هر گیت جدید به‌صورت **advisory** وارد
می‌شود و هنگام ثبات **blocking** می‌شود.

### قطعهٔ مرکزی قابل استفادهٔ مجدد: «آناتومی یک گیت ratchet»

کل سیستم حول این الگوی ۳-فایلی می‌چرخد. ابتدا آن را کپی کنید:

۱. **`baseline.json`** — مقدار معیار ثابت‌شده + `direction` (`up`/`down`) + `eps` (ضد flake) + `tightenSlack` + `dedicatedGate`.
۲. **`collect-metrics.<ext>`** — ابزار را اجرا می‌کند، عدد را استخراج می‌کند، `metrics.json` را می‌نویسد.
۳. **`check-ratchet.<ext>`** — `metrics.json` را با `baseline.json` مقایسه می‌کند؛ `exit 1` **فقط** در صورت پس‌رفت فراتر از `eps`؛ `exit 0` (skip با ظرافت) اگر ابزار/زیرساخت غایب بود؛ با `--require-tighten`، `exit 1` اگر **بهبود** یافت بدون به‌روزرسانی خط‌مبنا (دستاورد را قفل می‌کند).

با این، **هر** معیار جدید (پوشش، پیچیدگی، هشدارها، هشدارهای SAST، اندازهٔ bundle، نمرهٔ جهش…) فقط یک خط در خط‌مبنا است.

### فاز ۰ — بنیاد (هفته ۱)

CI وجود دارد؛ قالب‌بند + linter + typecheck + ۱ runner تست + کف پوشش **مطلق**
(مثلاً ۶۰٪). pre-commit بررسی‌های سریع auto-fixable را اجرا می‌کند. _خروجی: هیچ PR پایه‌ها را نشکن._

### فاز ۱ — موتور ratchet (هفته ۲) — **بنیاد همه‌چیز**

۳ فایل بالا را پیاده‌سازی کنید. خط‌مبناها را ثابت کنید برای: هشدارها، پوشش، پیچیدگی، تکثیر،
dead code، اندازهٔ فایل. _خروجی: codebase از این به بعد فقط می‌تواند بهبود یابد._

### فاز ۲ — عمق ایستا (هفته ۳)

SAST (CodeQL/Sonar/semgrep) با ratchet هشدار؛ اسکنر secret (**ruleset پیش‌فرض را به ارث ببر**)؛
SCA (osv/Dependabot) + allowlist لایسنس + lockfile-lint. _خروجی: آسیب‌پذیری‌های شناخته‌شده و
secretهای نشت‌کرده عبور نمی‌کنند._

### فاز ۳ — ساخت زنجیرهٔ تأمین (هفته ۴)

SBOM هنگام انتشار + provenance امضا‌شده (SLSA L2) + Scorecard زمان‌بندی‌شده + سخت‌سازی workflow
(zizmor: حداقل توکن، بدون اعتبارنامهٔ ماندگار، actions پین‌شده). _خروجی: انتشارهای قابل‌ردیابی و
تغییرناپذیر._

### فاز ۴ — شدت تست (هفته ۵–۶)

۲امین runner در صورت مفید بودن؛ **کف پوشش هر‌ماژول برای ماژول‌های بحرانی** (ضد گودهارت)؛
property-based برای منطق خالص؛ **تست جهش شبانه** → وقتی اولین نمره رسید،
`mutationScore` را به ratchet تبدیل کنید. _خروجی: پوشش دیگر معیار خودنمایی نیست؛ تست‌ها اثباتاً باگ می‌گیرند._

### فاز ۵ — قرارداد و پویا (هفته ۷)

اگر API عمومی وجود دارد: oasdiff (تغییر breaker، **blocking**) + schemathesis (fuzz شبانه).
DAST/red-team شبانه متناسب با دامنه. _خروجی: قراردادها بی‌صدا نمی‌شکنند._

### فاز ۶ — ضد توهم و دامنه (هفته ۸)

یک گیت یکپارچگی برای هر «حقیقت تکثیر‌شده» در پروژه. گیت‌های حالت شکست مخصوص دامنه
(برای هوش مصنوعی: red-team تزریق). _خروجی: rot ساختاری و شکست‌های دامنه تور ایمنی دارند._

### فاز ۷ — حاکمیت (مستمر)

- چرخهٔ advisory→blocking برای هر گیت جدید.
- `stale-allowlist`: هر سرکوب یک توجیه + issue دارد؛ سرکوب منسوخ شکار می‌شود.
- `evidence-gate`: ادعای موفقیت در یک PR نیازمند اثبات (تست یا تست زنده).
- **بازبینی فصلی ROI برای هر گیت** (سرکوب/تعطیل کسانی که بازدهی ندارند — با خستگی مقابله می‌کند).
- Hard Ruleهای پروژهٔ خود را به گیت‌های قابل‌اجرا ارتقا دهید.

### اصول cross-cutting (غیرقابل‌مذاکره)

- **ratchet، نه مطلق.** _non-regression_ را گیت کنید، نه عدد ثابت (به‌جز کف‌های ضد صفر).
- **کف مطلق + ratchet با هم.** کف از فروپاشی جلوگیری می‌کند؛ ratchet از فرسایش آرام.
- **ضد گودهارت در طراحی.** هر معیار هدف نیازمند وزنهٔ تعادل است (پوشش ⇒ جهش + ضد masking؛ کف هر‌ماژول برای اجبار آزمایش کد سخت).
- **skip با ظرافت.** نبود زیرساخت هرگز مسدود نمی‌کند؛ فقط پس‌رفت واقعی مسدود می‌کند.
- **`dedicatedGate` برای معیارهای پرهزینه.** معیارهایی که به باینری خارجی نیاز دارند، اسکریپت اختصاصی خود (با skip) دارند، خارج از ratchet مرکزی همگام.
- **گیت آن‌جا که merge اتفاق می‌افتد.** بین گیت سریع و merge واقعی شکاف نگذارید (درس تقسیم fast-gates).
- **چند گیت blocking، به‌خوبی انتخاب‌شده.** Sonar/DORA: شرایط زیاد = خستگی. advisory + ratchet را به دیوار گیت‌های blocking ترجیح دهید.

---

## بخش ۵ — بهبودهای توصیه‌شده (اولویت‌بندی‌شده، سازگار)

**P0 — بالاترین ROI، تقریباً آماده**

۱. **ratchet نمرهٔ جهش** (پس از اینکه اولین Stryker شبانه مقادیر تولید کرد). پادزهر کلیدی علیه coverage-Goodhart؛ ~۹۰٪ انجام شده.
۲. **بستن شکاف fast-gates** — افزودن typecheck + تست‌های آسیب‌دیده به `quality.yml` (PR→release).
۳. **Branch-protection روی `main`** (تنظیم مالک) — Scorecard را بالا می‌برد، شکاف DSOMM را می‌بندد.

**P1 — ارزشمند** ۴. **osv/oasdiff → blocking با اسکوپ درست** — osv فقط CRITICAL+fixable (دو‌مرحله‌ای مثل Trivy)؛ oasdiff تغییرات breaker را مسدود می‌کند. ۵. **`require-tighten` → blocking** (پایان چرخه) — دستاوردهای معیار را قفل می‌کند. ۶. **بازبینی ROI/زمان‌بندی هر گیت** در `ci-summary` — گیت‌های کند/کم‌ارزش را پیدا و هرس کنید.

**P2 — بازدهی نزولی** ۷. **SLSA L3** — builder hermetic/reproducible (مولد SLSA گیت‌هاب) اگر می‌خواهید از L2 بالا بروید. ۸. **پیکربندی CodeQL commit‌شده + semgrep نسخه‌گذاری‌شده** — کنترل/تکرارپذیری بیشتر. ۹. **DAST smoke هر PR** — زیرمجموعهٔ سریع schemathesis/promptfoo روی endpointهای پرخطر (فقط شبانه نباش). ۱۰. **داشبورد flakiness + معیارهای DORA** — مطمئن شوید گیت‌ها سرعت را فرسوده نمی‌کنند.

---

## بخش ۶ — درس‌های انتشار ملموس (گیت‌هایی برای افزودن در فاز ۹)

> این بخش حوادث واقعی از بستن‌های انتشار را ثبت می‌کند که در آن‌ها یک گیت **غایب بود**،
> با شواهد ملموس و گیت پیشنهادی. هر مورد کاندیدای بخش ۵ است.

### درس v3.8.27 (2026-06-17) — «شکاف fast-gates» اجازه می‌دهد پس‌رفت‌های قطعی به روز انتشار برسند

**چه اتفاقی افتاد.** در طول `/generate-release` برای v3.8.27، PR انتشار (`release/v3.8.27` → `main`)
**اولین** اجرای ماتریس کامل `ci.yml` در چرخهٔ یکپارچه بود. نتیجه: ۱۲ شکست
به‌یکباره — **۳ تست قطعی** + ~۹ flake/محیطی. هیچ‌کدام پس‌رفت زندهٔ محصول نبودند، اما
همه unnoticed ماندند چون PRهای چرخه وارد `release/**` می‌شوند ازطریق **Fast QG
(`quality.yml`)**، که سوئیت کامل واحد را اجرا نمی‌کند، نه `pr-test-policy` (test-masking)، نه
سوئیت کامل یکپارچه‌سازی، نه بررسی parity شِما. ۳ مورد قطعی:

۱. **تست کهنه‌شده توسط تغییر UI** — `permissions modal switch buttons declare button type`:
   #4034 یک سوئیچ چهارم اضافه کرد (a11y `type="button"` نگهداری‌شده)؛ شمارش `=== 3` تست
   کهنه شد. تحلیل ایستا باید در PR #4034 این را می‌گرفت.
۲. **تست کهنه‌شده توسط تغییر بسته‌بندی** — `findMissingArtifactPaths ... root runtime files`:
   `dist/http-method-guard.cjs` به یک مسیر لازم مشروع تبدیل شد؛ لیست مورد انتظار تست
   کهنه شد.
۳. **واگرایی modularization زیان‌بار (جدی‌ترین)** — `settings schemas accept ... unprefixed
   toggle`: `updateSettingsSchema` **ماژولارشده** (`schemas/settings.ts`، ساخته‌شده توسط #3988) از
   نسخهٔ متعارف (`settingsSchemas.ts`) واگرا شد: **۴۵ فیلد در برابر ۸۵ — ۴۰ حذف‌شده + ۶ واگرا (qdrant\*)**. این
   **dead-code** بود (زمان‌اجرا از نسخهٔ متعارف استفاده می‌کند)، پس تأثیر زنده‌ای نداشت، اما فقط یک تست parity دست‌نویس
   آن را گرفت. #4030 ۱۶ حذف مشابه از #3988/#3993 را بازگرداند، اما این یکی عبور کرد.

**گیت‌های پیشنهادی (فاز ۹):**

- **G1 — واقعاً بستن شکاف fast-gates (تعمیم P0 #2).** در `quality.yml` (PR→`release/**`)،
  فراتر از typecheck + تست‌های آسیب‌دیده، **`pr-test-policy` (test-masking) + سوئیت کامل قطعی
  واحد** (یا حداقل فایل‌های static/parity، که سریع و غیرflaky هستند) را اجرا کنید.
  به این ترتیب، تست‌های کهنه و حذف assert در همان PRی که آن‌ها را وارد می‌کند شکار می‌شوند — نه در
  روز انتشار. integration/e2e را کنار بگذارید (کند/flaky)، اما لایهٔ قطعی نمی‌تواند فقط
  در PR→main بماند.
- **G2 — گیت parity modularization (جدید، امروز پوشش داده نشده).** بررسی‌ای که برای هر نماد
  باز‌صادر‌شده توسط یک barrel ماژولارشده (`src/shared/validation/schemas/*`، ماژول‌های
  `providerRegistry` و غیره)، **شکل** (`z.object` keys، ورودی‌های رجیستری) را با منبع متعارف
  مقایسه می‌کند و **در صورت واگرایی شکست می‌خورد** (فیلد حذف‌شده/اضافی). حذف ۴۰‌فیلدی از
  #3988 را در همان PR می‌گرفت. تست‌های parity دست‌نویس (که فقط آن‌جا نوشته می‌شد که کسی
  یادش بود) را تعمیم می‌بخشد. ارزان: هر دو را import و `Object.keys(shape)` را diff می‌کند.
- **G3 — triage قطعی flake (پشتیبانی).** LiveWS-startup و تست‌های integration-combo/breaker
  به‌دلیل timeout/cascade سرور در CI (محیطی) شکست می‌خورند، نه منطق. این‌ها را به‌عنوان
  `known-flaky` (قرنطینه‌شده با issue) علامت‌گذاری کنید تا قرمزی PR انتشار **فقط سیگنال‌های واقعی** باشد، نه نویز
  که پس‌رفت‌های قطعی را در میانه پنهان می‌کند.

**اصل:** _گیت باید آن‌جا اجرا شود که merge اتفاق می‌افتد_ (هم‌اکنون در «اصول cross-cutting»). حادثهٔ
v3.8.27 نشان می‌دهد این برای **لایهٔ تست قطعی** هم صدق می‌کند، نه فقط lint/typecheck —
در غیر این صورت بدهی تست‌های کهنه + modularization زیان‌بار فقط در PR→main، به‌صورت دسته‌ای، در
بدترین لحظه ظاهر می‌شود.

---

## منابع (بهترین رویه‌های صنعت)

- OWASP DevSecOps Maturity Model (DSOMM) — https://dsomm.owasp.org/about
- OpenSSF Scorecard / SLSA — https://openssf.org · https://slsa.dev
- SonarQube "Clean as You Code" — https://docs.sonarsource.com/sonarqube-server/latest/user-guide/clean-as-you-code
- Quality Ratchets (LeadDev) — https://leaddev.com/software-quality/introducing-quality-ratchets-tool-managing-complex-systems
- Continuous Code Improvement Using Ratcheting (Greiner) — https://robertgreiner.com/continuous-code-improvement-using-ratcheting/
- DORA 2024 State of DevOps — https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report
- Mutation testing best practices (Stryker) — https://stryker-mutator.io
- Coverage as anti-pattern (Goodhart) — https://www.industriallogic.com/blog/code-coverage-complications/
- OWASP Top 10 for LLM Applications (2025) — https://owasp.org/www-project-top-10-for-large-language-model-applications/
- Contract testing (oasdiff/schemathesis) — https://www.oasdiff.com · https://schemathesis.readthedocs.io
