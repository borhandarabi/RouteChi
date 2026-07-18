---
title: "سطح‌های رایگان و بودجه توکن رایگان"
version: 3.8.40
lastUpdated: 2026-06-28
---

# سطح‌های رایگان و بودجه توکن رایگان

> **برای کاربران**: به دنبال یک راهنمای ساده هستید؟ به [راهنمای سطح‌های رایگان](../getting-started/FREE-TIERS-GUIDE.md) مراجعه کنید برای دستورالعمل گام‌به‌گام گرفتن هوش مصنوعی رایگان.

> **آخرین تحقیق:** 2026-06-17 — تحقیق وب به‌ازای هر ارائه‌دهنده (مستندات رسمی + اخبار ۷ روز اخیر، با ۵۰ agent و تأیید تخاصمی) که هر سهمیه سطح رایگان و ToS را بازخوانی می‌کند.
> **منبع حقیقت (catalog):** `open-sse/config/freeModelCatalog.ts` (بودجه‌های به‌ازای MODEL، pool-dedup شده). اعداد بودجه توکن زیر از تحقیق زنده وب آمده و یک **تقریب** هستند — به [روش‌شناسی و احتیاط‌ها](#methodology--caveats) مراجعه کنید.

## خلاصه — RouteChi در واقع چقدر inference رایگان تجمیع می‌کند؟

| Metric                                      | Tokens / month    | Meaning                                                                                                                                                                                                                                                |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **اعطای مستند دوره‌ای (پایدار)**     | **~1.54B**        | **poolهای** سطح رایگان (catalog به‌ازای مدل)، هر pool مشترک **یک بار** شمرده شده است. منبع زنده پشت `/api/free-tier/summary` و صفحه بودجه سطح رایگان داشبورد. **از این عدد استفاده کنید.**                                                            |
| **+ ماه اول با اعتبار ثبت‌نام**       | **~2.15B**        | پایدار + اعتبار ثبت‌نام یک‌باره (Together $25، Z.AI 20M، DeepSeek 5M، …)، به‌ازای حساب dedup شده. **فقط ماه اول** — دوره‌ای نیست.                                                                                                                 |
| **+ رایگان دائمی، بدون سقف منتشرشده**    | _غیر‌قابل‌کمیت‌سازی_ | `siliconflow`، `glm-cn` (GLM-4-Flash)، `tencent`، `baidu`، `kilo-gateway`، `opencode-zen` — دسترسی دوره‌ای واقعی، با محدودیت نرخ/همزمانی، **بدون سقف توکن برای شمارش**. فهرست شده، هرگز جمع نمی‌شوند (شمارش آن‌ها در `RPM×24/7` همان تورم است که رد می‌کنیم). |
| **+ افزایش باز کردن قفل با واریز**                  | **+~24M**         | یک واریز یک‌باره **$10** در OpenRouter، pool رایگان آن را از ۵۰ → ۱۰۰۰ req/day افزایش می‌دهد. جداگانه گزارش شده تا هرگز عدد پایدار را متورم نکند.                                                                                                          |
| سقف نظری (همه محدودیت‌های نرخ، ۲۴/۷) | ~10B              | مجموع هر محدودیت نرخ ارائه‌دهنده که به استفاده بی‌وقفه تعمیم داده شده. **تضمینی نیست** — این را تیتر نکنید.                                                                                                                                             |

**تیتر صادقانه:** _RouteChi حدود **۱.۶ میلیارد توکن رایگان مستند در ماه** تجمیع می‌کند (تا ۲.۱ میلیارد در ماه اول شما با اعتبار ثبت‌نام) در بیش از ۴۰ pool سطح رایگان — به‌علاوه یک دم دراز از ارائه‌دهندگان رایگان دائمی بدون سقف — و RTK + فشرده‌سازی Caveman (۱۵–۹۵٪ صرفه‌جویی توکن) آن را بیشتر می‌کشد._

> **چرا این از ~1.94B قبلی کاهش یافت.** بازخوانی 2026-06-17 یک اصلاح صداقت است، نه یک ضرر: `gemini` اکنون pool-dedup شده (توسط شمارش جداگانه هر نوع Flash متورم شده بود، 462M → 60M)، `cloudflare-ai` به ۱۰k-Neurons/day واقعی‌اش اصلاح شد (122M → 30M)، `doubao` به‌عنوان اعتبار ثبت‌نام یک‌باره طبقه‌بندی مجدد شد (دوره‌ای نیست)، و سطح‌های تعطیل‌شده حذف شدند (`github-models` برای ثبت‌نام‌های جدید بسته شد، `chutes`/`phind`/`kluster` متوقف شدند). تا حدی با `llm7` (اصلاح شده 5M/day → 150M) و ارائه‌دهندگان رایگان جدید (Kilo، OpenCode Zen، Z.AI GLM-Flash) جبران شد.

بزرگترین مشارکت‌کننده‌های **مستند**: `mistral` 1.00B، `llm7` 150M، `groq` 117M، `gemini` 60M، `cerebras` 30M، `cloudflare-ai` 30M، `sambanova` 30M. (`longcat` مستثنی است — اعطای 10M LongCat-2.0 آن یک اعتبار ثبت‌نام یک‌باره KYC-gated است، نه یک بودجه ماهانه دوره‌ای.)

> ⚠️ سقف نظری (~10B) توسط ارائه‌دهندگان فقط-محدودیت‌نرخ با **بدون سقف توکن منتشرشده** (`tencent`، `siliconflow`، `nvidia`، `baidu`، `glm-cn`، `sparkdesk`) متورم شده است که اعدادشان `RPM/TPM × 24/7 × 30d` خواهد بود — یک سقف نظری که هیچ حساب منفردی آن را پایدار نخواهد کرد. آن‌ها از عدد قابل‌دفاع **مستثنی** هستند (به‌جای آن در ردیف «رایگان دائمی، بدون سقف» نشان داده شده‌اند). این همان تورمی است که ادعاهای چند میلیاردی رقبا را غیرقابل‌اعتماد می‌کند.

---

## بازخوانی 2026-06-17 — چه چیزی از 2026-06-05 تغییر کرد

یک پاس تحقیق وب ۵۰ عاملی (مستندات رسمی + اخبار ۷ روز اخیر، با تأیید تخاصمی) کل catalog را بازخوانی کرد. نکات برجسته:

- **حذف شده / بدون سطح رایگان (2026):** `chutes` (سطح رایگان در 2026-03 پایان یافت)، `phind` (شرکت در 2026-01 تعطیل شد)، `kluster` (sunset 2026-06-09 → MITO)، `gitlawb` + `gitlawb-gmi` (MiMo رایگان در 2026-05-24 باطل شد، Nemotron promo در 2026-06 پایان یافت — دوباره تأیید شد 2026-06-18)، `aimlapi` (سطح رایگان متوقف شد — دوباره تأیید شد 2026-06-18)، `yi` (Yi-Light بازنشسته شد، pay-as-you-go — دوباره تأیید شد 2026-06-18)، `theoldllm` / `featherless-ai` (هیچ سطح رایگان فعلی). `iflytek` / `sparkdesk` در فهرست باقی می‌مانند اما یک یادداشت احتیاط ToS حمل می‌کنند (Spark Lite رایگان است؛ ToS استفاده از پروکسی/relay را محدود می‌کند).
- **GitHub Models** — در 2026-06-16 برای مشتریان **جدید** بسته شد؛ حساب‌های موجود به API/playground دسترسی نگه می‌دارند، بنابراین با یک یادداشت در catalog باقی می‌ماند (حذف نشد).
- **Gemini** — `2.0 Flash` / `2.0 Flash-Lite` در 2026-06-01 تعطیل شد و `2.5 Pro` در 2026-04 از سطح رایگان خارج شد؛ سطح رایگان اکنون **فقط خانواده Flash** است (2.5/3/3.1/3.5 Flash + Gemma). catalog اکنون خانواده Flash را **pool** می‌کند (توسط شمارش جداگانه هر نوع متورم شده بود: 462M → 60M).
- **اعداد اصلاح‌شده:** `cloudflare-ai` 122M → **30M** (10k-Neurons/day واقعی)، `doubao` به‌عنوان اعتبار ثبت‌نام یک‌باره طبقه‌بندی مجدد شد (دوره‌ای نیست)، `llm7` 4M → **150M** (5M tokens/day مستند)، `together` endpointهای "-Free" متوقف شدند → فقط اعتبار ثبت‌نام **$25** باقی ماند، `longcat` Preview پایان یافت + مدل‌های Flash بازنشسته شدند → فقط **LongCat-2.0**، به‌عنوان اعتبار ثبت‌نام یک‌باره **10M**-token (KYC-gated، دوره‌ای نیست) طبقه‌بندی مجدد شد.
- **ارائه‌دهندگان رایگان جدید کشف شدند:** ⭐ **Kilo Code** (`kilo-gateway` — مجموعه "Auto Free" چرخشی: خانواده NVIDIA Nemotron 3، StepFun، Poolside، Nex-N2-Pro)، ⭐ **OpenCode Zen** (`opencode-zen` — ۶ مدل کدنویسی رایگان چرخشی)، ⭐ **Z.AI / Zhipu** (`glm-cn` — GLM-4-Flash / 4.5-Flash / 4.7-Flash رایگان دائمی + ۲۰M اعتبار ثبت‌نام)، و `arcee-ai` Trinity Large Preview.
- **سطح‌های صادقانه جدید** (به روش‌شناسی مراجعه کنید): یک دسته _رایگان دائمی-اما-بدون سقف_ (دسترسی دوره‌ای واقعی، بدون سقف توکن برای شمارش) و یک _افزایش باز کردن قفل با واریز_ (OpenRouter $10 → +24M/mo)، هر دو **جداگانه** نمایش داده شده‌اند تا هرگز تیتر را متورم نکنند.

> جدول تفصیلی به‌ازای ارائه‌دهنده در پایین‌تر، **snapshot 2026-06-05** است؛ deltaهای بالا آن را جایگزین می‌کنند. منبع زنده و canonical، catalog به‌ازای مدل `open-sse/config/freeModelCatalog.ts` است.

---

## روش‌شناسی و احتیاط‌ها

- اعداد **برآوردهای کران بالا** از محدودیت‌های سطح رایگان مستند هر ارائه‌دهنده به تاریخ **2026-06-17** هستند، با تحقیق وب جمع‌آوری شده (اطمینان به‌ازای ردیف برچسب شده). سطح‌های رایگان دائماً تغییر می‌کنند — پیش از تکیه بر یک عدد، دوباره تأیید کنید.
- `estMonthlyFreeTokens` = فقط توکن‌های ماهانه دوره‌ای. **اعتبار ثبت‌نام یک‌باره دوره‌ای نیست** و به‌عنوان ۰ شمرده می‌شود. سطح‌های متوقف‌شده نیز ۰ هستند.
- سقف توکن روزانه → `monthly = daily × 30`. فقط RPD مستند → `RPD × ~800 output tokens × 30`. فقط RPM/TPM (بدون سقف روزانه) → **بدون سقف** (به زیر مراجعه کنید).
- **رایگان دائمی، اما بدون سقف توکن منتشرشده** (`siliconflow`، `glm-cn`، `tencent`، `baidu`، `kilo-gateway`، `opencode-zen`): این‌ها دسترسی رایگان دوره‌ای واقعی، با محدودیت نرخ/همزمانی هستند. ما آن‌ها را `recurring-uncapped` طبقه‌بندی می‌کنیم و **هرگز جمع نمی‌زنیم** — ضرب `RPM × 24/7 × 30d` یک سقف خیالی تولید می‌کند (همان تورم که رد می‌کنیم). آن‌ها فهرست شده‌اند تا بدانید وجود دارند.
- **افزایش باز کردن قفل با واریز:** یک واریز کوچک یک‌باره که یک سهمیه رایگان را به‌طور دائمی افزایش می‌دهد (OpenRouter: $10 → 1000 req/day ≈ +24M/mo). به‌عنوان یک عدد جداگانه گزارش شده، از تیتر پایدار جدا نگه داشته شده.

---

## جدول توجه ToS

> یک خوانش سریع از شرایط هر ارائه‌دهنده برای یک پروکسی شخصی تک‌کاربره خود‌میزبان. `caution` = یک بند استفاده شخصی یا پروکسی ارزش بررسی دارد؛ `ambiguous` = نامشخص؛ `ok` = صریحاً مجاز. اطلاعاتی، نه مشاوره حقوقی — خودتان تصمیم بگیرید.

### ⚠️ احتیاط — بندهای استفاده شخصی/پروکسی که ارزش بررسی دارند (۱۹)

> دسترسی رایگان آن‌ها واقعی است و RouteChi می‌تواند به آن‌ها مسیریابی کند؛ بندهای زیر فقط ارزش دانستن دارند. موارد OAuth/keyless قابل‌کمیت‌سازی توکن نیستند، بنابراین در عدد تیتر نیستند (نه به این دلیل که غیرقابل‌استفاده باشند).

| Provider         | Note                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agy`            | ToS Google Antigravity صریحاً استفاده از نرم‌افزار، ابزار یا سرویس شخص ثالث (از جمله پروکسی) برای دسترسی به سرویس از طریق OAuth را ممنوع می‌کند؛ انجام… |
| `ai21`           | ToS §4.2/§8.2 sublicensing یا توزیع دسترسی API به اشخاص ثالث را ممنوع می‌کند؛ §3.3 محصولات trial/evaluation را به "ارزیابی داخلی روی… محدود می‌کند |
| `amazon-q`       | محصول برای ثبت‌نام‌های جدید متوقف شده است؛ کاربران موجود مشمول AWS Customer Agreement هستند که بر استفاده از سرویس‌های مدیریت‌شده حاکم است — پروکسی خود‌میزبان… |
| `blackbox`       | ToS صریحاً sublicensing، reselling، در دسترس قرار دادن سرویس به اشخاص ثالث و ساخت سرویس‌های مشتق را ممنوع می‌کند — یک پروکسی شخصی خود‌میزبان… |
| `coze`           | ToS Coze صریحاً استفاده را به "استفاده شخصی و غیرتجاری" محدود می‌کند و اجاره، توزیع، sublicensing یا reselling سرویس را ممنوع می‌کند؛… |
| `duckduckgo-web` | ToS Duck.ai (duckduckgo.com/duckai/privacy-terms) صریحاً "automated querying و توسعه یا ارائه سرویس‌های AI" و دور زدن… را ممنوع می‌کند |
| `featherless-ai` | طرح‌های Individual صریحاً به "استفاده تعاملی یا نمونه‌سازی و آزمایش توسط خریدار" محدود شده‌اند — فروش مجدد inference و استفاده از پروکسی نیازمند… |
| `fireworks`      | ToS صریحاً استفاده از پروکسی/واسطه، انتقال API key و sublicensing را ممنوع می‌کند (بخش‌های 2.1 و 2.2(i)(j))؛ پروکسی‌های شخصی خود‌میزبان… |
| `friendliai`     | ToS Section 8(e) و 8(f) صریحاً استفاده از FriendliAI به‌عنوان پروکسی یا اجازه دسترسی شخص ثالث به‌صورت standalone را ممنوع می‌کند و reselling/… را قدغن می‌کند |
| `iflytek`        | Section 2.4(3) از iFlytek Spark LLM Service Agreement صریحاً "استفاده از هر روش خودکار یا برنامه‌ای برای استخراج داده یا خروجی… را ممنوع می‌کند |
| `kiro`           | FAQ Kiro صریحاً استفاده با "OpenClaw و ابزارهای مشابه که از harnessهای شخص ثالث استفاده می‌کنند" را ممنوع می‌کند — یک پروکسی AI خود‌میزبان (مثل RouteChi) معمولاً… |
| `modal`          | ToS Section 1.3 صریحاً "اجاره، resell یا به هر نحو اجازه دسترسی مستقیم یا استفاده شخص ثالث از سرویس" را ممنوع می‌کند — ساخت یک پروکسی خود‌میزبان… |
| `muse-spark-web` | ToS Meta صریحاً دسترسی خودکار بدون اجازه قبلی، مهندسی معکوس بدون اجازه کتبی و دور زدن فناوری‌های… را ممنوع می‌کند |
| `nlpcloud`       | ToS صریحاً "راه‌اندازی یک پروکسی یا دستگاه دیگر که به دیگران اجازه از طریق آن به سرویس دسترسی پیدا کنند" را ممنوع می‌کند و فقط یک لایسنس غیرقابل‌انتقال… اعطا می‌کند |
| `opencode`       | ToS (Anomaly Innovations, Inc.) صریحاً استفاده را به "استفاده داخلی خودتان، و نه از طرف یا به نفع هیچ شخص ثالث" محدود می‌کند —… |
| `qwen-web`       | سطح رایگان OAuth متوقف شده است؛ هیچ ToS اجازه پروکسی خود‌میزبان با session tokenها در برابر chat.qwen.ai نمی‌دهد. حتی پیش از تعطیلی، دسترسی خودکار/برنامه‌ای… |
| `t3-web`         | ToS صریحاً حساب‌ها را فقط به استفاده شخصی محدود می‌کند، اشتراک‌گذاری اعتبار با اشخاص ثالث را ممنوع می‌کند و دسترسی خودکار/bot/scraping را قدغن می‌کند — یک پروکسی خود‌میزبان… |

### ✅ عموماً permisive — احتیاط / مبهم / ok (بقیه)

| Provider         | ToS       | Note                                                                                                                     |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `aimlapi`        | ambiguous | ToS یک لایسنس استفاده غیرانحصاری اعطا می‌کند اما صریحاً پروکسی خود‌میزبان یا reselling را مجاز یا ممنوع نمی‌کند؛ بدون "pers… |
| `baichuan`       | ambiguous | هیچ ممنوعیت صریح برای پروکسی‌های شخصی خود‌میزبان در مستندات قابل‌دسترسی عمومی یافت نشد؛ با این حال، طرح رایگان M3 Plus… |
| `bluesminds`     | ambiguous | هیچ بند صریح ToS درباره پروکسی‌گذاری خود‌میزبان یا reselling یافت نشد؛ صفحه قیمت‌گذاری روی ویژگی/محدودیت نرخ تمرکز دارد… |
| `bytez`          | ambiguous | صفحه ToS قابل‌دسترسی نبود (404)؛ هیچ بند فقط-ارزیابی یا بدون-پروکسی در مستندات یافت نشد، اما پلتفرم… |
| `doubao`         | ambiguous | هیچ ممنوعیت صریح پروکسی/reselling در مستندات نمایه‌شده عمومی یافت نشد؛ Volcengine یک ابر توسعه‌گر-محور است… |
| `gitlawb-gmi`    | ambiguous | هیچ بند صریح ToS که استفاده از پروکسی شخصی خود‌میزبان را ممنوع کند یافت نشد؛ مدل رایگان Nemotron یک disclaimer NVIDIA حمل می‌کند… |
| `monsterapi`     | ambiguous | صفحه ToS MonsterAPI (monsterapi.ai/terms-of-service) در طول تحقیق غیرقابل‌دسترس بود؛ هیچ بند خاص پروکسی/resale/person… |
| `nous-research`  | ambiguous | Nous Portal خود یک سرویس aggregator/proxy است؛ استفاده از آن به‌عنوان backend برای یک پروکسی خود‌میزبان دیگر، یک proxy-… ایجاد می‌کند |
| `ollama-cloud`   | ambiguous | ToS استفاده از سرویس "برای توسعه محصولات رقابتی" را ممنوع می‌کند اما ممنوعیت صریح برای پروکسی‌های شخصی خود‌میزبان ندارد… |
| `stepfun`        | ambiguous | هیچ ممنوعیت صریح برای پروکسی شخصی خود‌میزبان یافت نشد، اما ToS Step Plan توسعه‌گرانی را هدف قرار می‌دهد که از coهای خاص استفاده می‌کنند… |
| `api-airforce`   | caution   | ToS صریحاً "ساخت سرویس‌های رقابتی بدون اجازه" و "اشتراک‌گذاری اعتبار" را ممنوع می‌کند — یک پروکسی شخصی خود‌میزبان… |
| `arcee-ai`       | caution   | دسترسی رایگان از طریق لایه routing :free OpenRouter است (نه شرایط API مستقیم Arcee)؛ ToS OpenRouter توسعه شخصی را مجاز می‌داند… |
| `baidu`          | caution   | ToS صریحاً برای بندهای پروکسی/reselling بررسی نشده، اما پلتفرم به احراز هویت نام واقعی نیاز دارد (شناسه چینی معمولاً… |
| `baseten`        | caution   | ToS استفاده را به "اهداف تجاری داخلی Customer" محدود می‌کند و صریحاً sublicensing، reselling یا اجازه… را ممنوع می‌کند |
| `bazaarlink`     | caution   | ToS صریحاً reselling یا sublicensing کلیدهای API به اشخاص ثالث را ممنوع می‌کند؛ یک پروکسی شخصی خود‌میزبان برای استفاده شخصی… |
| `brave-search`   | caution   | ToS توزیع مجدد، resale و sublicensing نتایج جستجو را ممنوع می‌کند؛ استفاده از API برای "replicate یا تلاش برای repl… |
| `byteplus`       | caution   | توکن‌ها غیرقابل‌انتقال و فقط تک‌حسابی هستند؛ هیچ ممنوعیت صریح پروکسی وجود ندارد، اما BytePlus حق … را برای خود محفوظ می‌دارد |
| `cerebras`       | caution   | ToS یک حق غیرانحصاری، غیرقابل‌انتقال، غیرقابل‌sublicense برای استفاده شخصی یا تجاری اعطا می‌کند؛ resale، s… را ممنوع می‌کند |
| `cloudflare-ai`  | caution   | Cloudflare Self-Serve ToS §2.2.1(j) استفاده از Services برای "ارائه یک شبکه خصوصی مجازی یا سایر proهای مشابه…" را ممنوع می‌کند |
| `cohere`         | caution   | Cohere صریحاً کلیدهای trial را برای "اهداف production یا تجاری" ممنوع می‌کند؛ یک پروکسی شخصی خود‌میزبان که re… را مسیریابی می‌کند |
| `deepinfra`      | caution   | ToS استفاده تجاری قانونی را به‌طور گسترده مجاز می‌داند، اما استفاده "مستقیماً یا غیرمستقیم رقابتی با هر کسب‌وکار از…" را ممنوع می‌کند |
| `deepseek`       | caution   | ToS Open Platform (effective 2026-04-29) استفاده گسترده از جمله "توسعه محصول مشتق" و شخصی/comm… را مجاز می‌داند |
| `dify`           | caution   | پروکسی شخصی تک‌کاربره خود‌میزبان تحت لایسنس اصلاح‌شده Apache 2.0 مجاز است؛ با این حال، استقرار multi-tenant… |
| `exa-search`     | caution   | هیچ بند صریح "بدون پروکسی" یا "فقط ارزیابی" یافت نشد؛ Exa به‌طور فعال یک برنامه شرکا reseller ارائه می‌دهد که API… |
| `firecrawl`      | caution   | Cloud API ToS هیچ ممنوعیت صریح پروکسی شخصی یافت نشده، اما نسخه خود‌میزبان متن‌باز AGPL-3.0 است (re… |
| `gemini`         | caution   | ToS صریحاً بیان می‌کند سطح رایگان برای "توسعه‌گرانی که با مدل‌های Google AI برای اهداف حرفه‌ای یا تجاری می‌سازند pur…" |
| `github-models`  | caution   | GitHub's Acceptable Use Policy reselling/proxying سرویس را ممنوع می‌کند؛ ToS GitHub Models به هر host مدل… واگذار می‌کند |
| `groq`           | caution   | Services Agreement §6.3 reselling، sublicensing یا توزیع دسترسی API را ممنوع می‌کند؛ §3.2 reselling/leasing acco… را قدغن می‌کند |
| `hackclub`       | caution   | سرویس صریحاً به اعضای نوجوان Hack Club که پروژه می‌سازند/یاد می‌گیرند محدود شده است؛ هیچ ToS عمومی یافت نشد که صریحاً permi… |
| `huggingchat`    | caution   | ToS Hugging Face پروکسی‌های شخصی خود‌میزبان را صریحاً ممنوع نمی‌کند، اما شرایط تکمیلی (ارجاع شده اما به‌طور کامل… |
| `huggingface`    | caution   | ToS یک لایسنس محدود برای دسترسی/استفاده از سرویس اعطا می‌کند؛ سند صریحاً یک تک‌کاربر… را مجاز یا ممنوع نمی‌کند |
| `hyperbolic`     | caution   | ToS دسترسی API را "منحصراً برای اهداف شخصی یا تجاری داخلی خودتان" اعطا می‌کند و صریحاً licensing، … را ممنوع می‌کند |
| `inference-net`  | caution   | ToS صریحاً "sublicense، resell، distribute" و انتقال کلیدهای API بدون رضایت کتبی را ممنوع می‌کند؛ یک تک‌u… |
| `jina-ai`        | caution   | ۱۰M توکن رایگان صریحاً غیرتجاری است (لایسنس مدل CC-BY-NC 4.0)؛ یک پروکسی شخصی تک‌کاربره برای LL شخصی… |
| `jina-reader`    | caution   | ToS استفاده از خروجی‌ها برای ساخت سرویس‌های رقابتی را ممنوع می‌کند و "روش‌های خودکار برای استخراج اطلاعات از طریق scraping…" را قدغن می‌کند |
| `llm7`           | caution   | ToS سرویس را برای "آزمایش، توسعه و تحقیق" موقعیت‌دهی می‌کند؛ هیچ ممنوعیت صریح برای پروکسی شخصی خود‌میزبان… |
| `longcat`        | caution   | API Platform Service Agreement (longcat.chat/platform/private/) یکپارچه‌سازی تجاری و apps خود‌میزبان را مجاز می‌داند… |
| `mistral`        | caution   | ToS Consumer صریحاً بیان می‌کند APIها فقط ممکن است برای "نیازهای شخصی" استفاده شوند و در دسترس قرار دادن کلیدهای API به… را ممنوع می‌کند |
| `morph`          | caution   | ToS به‌طور کلی استفاده تجاری را مجاز می‌داند؛ استقرارهای پروکسی خود‌میزبان نیازمند ترتیب صریح با sales هستند. Section 18.… |
| `nebius`         | caution   | ToS (Section 5f) صریحاً resale، redistribution یا ارائه سرویس "به‌صورت standalone" را ممنوع می‌کند — یک خود-… |
| `nomic`          | caution   | ToS یک لایسنس API غیرانحصاری، غیرقابل‌انتقال اعطا می‌کند؛ Section 6.b ساخت یک سرویس رقابتی را ممنوع می‌کند. استفاده از t… |
| `novita`         | caution   | ToS resale و سرویس‌های رقابتی را ممنوع می‌کند اما صریحاً به پروکسی‌های شخصی خود‌میزبان نمی‌پردازد؛ استفاده شخصی… |
| `nscale`         | caution   | AUP "copy، modify، duplicate... frame، mirror، republish... distribute همه یا هر بخشی از Nscale Platform…" را ممنوع می‌کند |
| `nvidia`         | caution   | سطح رایگان صریحاً فقط برای prototyping/dev/research/evaluation است — استفاده production (سرویس‌دهی به کاربران نهایی واقعی) نیازمند… |
| `openrouter`     | caution   | ToS صریحاً reselling دسترسی API یا توسعه یک سرویس رقابتی را ممنوع می‌کند؛ پروکسی شخصی خود‌میزبان تک‌کاربره… |
| `pollinations`   | caution   | لایسنس MIT ذکر شده در مستندات API نشان‌دهنده استفاده مجدد لیبرال است؛ هیچ ممنوعیت صریح برای پروکسی‌گذاری خود‌میزبان یافت نشد. با این حال، u… |
| `predibase`      | caution   | Predibase به‌عنوان یک پلتفرم enterprise fine-tuning/serving موقعیت‌دهی شده است؛ trial رایگان صریحاً برای exploration و… |
| `publicai`       | caution   | ToS (publicai.co/tc) سرویس‌ها را به‌عنوان "عمدتاً برای تحقیق و استفاده آموزشی" تعیین می‌کند؛ هیچ p صریح پروکسی یا resale… |
| `puter`          | caution   | ToS Puter استفاده از سرویس‌ها برای "هدف تجاری" بدون رضایت کتبی را ممنوع می‌کند؛ یک پروکسی شخصی خود‌میزبان که consumi… |
| `qoder`          | caution   | صفحه ToS محتوای قابل‌خواندن برگرداند؛ Qoder یک کلاینت IDE کدنویسی است (نه API عمومی)، و wrapperهای پروکسی شخص ثالث… |
| `reka`           | caution   | Business Terms sublicensing یا توزیع دسترسی به اشخاص ثالث را ممنوع می‌کند؛ یک پروکسی شخصی تک‌کاربره احتمالاً fi… |
| `sambanova`      | caution   | ToS Section 1.5(c) صریحاً reselling، sublicensing یا در دسترس قرار دادن سرویس به اشخاص ثالث را ممنوع می‌کند؛ یک se… |
| `sensenova`      | caution   | هیچ ممنوعیت صریح پروکسی یا resale در ToS بازبینی‌شده یافت نشد، اما سطح رایگان یک beta تبلیغاتی بدون SLA است، Sen… |
| `serper-search`  | caution   | ToS صریحاً "آینه کردن materials روی هر سرور دیگر به‌صورت as-is بدون ارزش‌افزوده" را ممنوع می‌کند — یک پروکسی pass-through ساده… |
| `siliconflow`    | caution   | ToS (Clause 3.4(e)(f)(p)) صریحاً در دسترس قرار دادن سرویس به هر شخص ثالث، reselling/sublicensing،… را ممنوع می‌کند |
| `sparkdesk`      | caution   | SparkDesk User Agreement فقط حقوق استفاده شخصی، غیرتجاری اعطا می‌کند؛ API Interface Policy داده‌های خودکار را ممنوع می‌کند… |
| `tavily-search`  | caution   | ToS صریحاً بیان می‌کند API "نمی‌تواند منتقل، انتساب، اشتراک‌گذاری یا به هر نحو به هر شخص ثالث در دسترس قرار گیرد… |
| `tencent`        | caution   | ToS Tencent Cloud صریحاً sublicensing یا reselling دسترسی API را ممنوع می‌کند؛ یک پروکسی شخصی خود‌میزبان برای شخصی… |
| `together`       | caution   | ToS Section 4.3(d) صریحاً انتقال، توزیع، reselling، leasing یا ارائه Services به‌صورت s… را ممنوع می‌کند |
| `uncloseai`      | caution   | استفاده از پروکسی شخصی محتمل است اما صریحاً مجاز نیست؛ ToS ساخت "سرویس‌های یادگیری ماشین رقابتی wi…" را ممنوع می‌کند |
| `veoaifree-web`  | caution   | ToS صریحاً botها یا اسکریپت‌های خودکار با "سرعت غیرانسانی" را ممنوع می‌کند و کپی کردن پلتفرم برای ایجاد… را قدغن می‌کند |
| `vertex`         | caution   | Google Cloud Service Terms resale را فقط به resellerهای مجاز محدود می‌کند (Section 14 نیازمند یک Reseller Agreement است)؛ یک s… |
| `voyage-ai`      | caution   | ToS "استفاده شخصی، غیرتجاری" برای محتوای سایت اعطا می‌کند و اشتراک‌گذاری credential/account با اشخاص ثالث را ممنوع می‌کند؛… |
| `360ai`          | unknown   | ToS برای API توسعه‌دهنده بدون ثبت‌نام قابل‌دسترسی عمومی نیست؛ دسترسی نیازمند تأیید درخواست است که implies می‌کند… |
| `chutes`         | unknown   | صفحه ToS در chutes.ai/terms وجود دارد اما محتوا از طریق fetch قابل‌دسترسی نبود؛ هیچ بند صریح پروکسی/resale در… یافت نشد |
| `freemodel-dev`  | unknown   | صفحه Terms of Service (freemodel.dev/terms) فقط یک هدر با هیچ محتوای قابل‌خواندن از طریق WebFetch برگرداند؛ هیچ clause… |
| `gitlawb`        | unknown   | هیچ ToS یا acceptable-use policy یافت نشد؛ محدودیت‌های پروکسی/resale نامشخص — برای استفاده پروکسی خود‌میزبان احتیاط فرض کنید.     |
| `liquid`         | unknown   | هیچ API میزبانی‌شده‌ای برای پروکسی وجود ندارد؛ استفاده تجاری مدل متن‌باز برای orgهایی با درآمد سالانه کمتر از $10M رایگان است. هیچ self-hos… |
| `theoldllm`      | unknown   | هیچ سند terms of service در سایت یافت نشد؛ خط‌مشی پروکسی‌گذاری، resale یا استفاده خود‌میزبان به‌طور کامل undocumente… است |
| `yi`             | unknown   | ToS بدون login قابل‌دسترسی عمومی نیست؛ هیچ بند پروکسی/resale قابل بازبینی نبود. استفاده از پروکسی شخصی خود‌میزبان st… |
| `comfyui`        | ok        | لایسنس متن‌باز GPL-3.0 صریحاً استفاده از پروکسی شخصی خود‌میزبان را مجاز می‌داند؛ ToS Comfy Org استفاده تجاری از… را تأیید می‌کند |
| `scaleway`       | ok        | General Terms of Services Scaleway یک قرارداد ابر تجاری استاندارد بدون ممنوعیت صریح برای self-hos… است |
| `sdwebui`        | ok        | لایسنس AGPL-3.0: رایگان برای خود‌میزبانی با استفاده شخصی بدون محدودیت حجم استفاده؛ یک پروکسی شخصی با استفاده از این… |
| `searxng-search` | ok        | لایسنس متن‌باز AGPL-3.0 صریحاً استفاده از پروکسی شخصی خود‌میزبان را بدون محدودیت نوع استفاده، resal… مجاز می‌داند |

---

## سطح رایگان به‌ازای ارائه‌دهنده (بازخوانی 2026-06-17)

> از catalog به‌ازای مدل (`open-sse/config/freeModelCatalog.ts`) بازتولید شده، pool-dedup شده. مرتب‌شده بر اساس توکن پایدار دوره‌ای/mo. `uncapped*` = رایگان دائمی اما بدون سقف توکن منتشرشده (با محدودیت نرخ/همزمانی) — دسترسی واقعی، **در تیتر جمع نمی‌شود**. `—` = فقط اعتبار / keyless / غیرقابل‌کمیت‌سازی توکن.

| Provider         | Free type     | Steady tokens/mo | First-month credit | ToS       | Models |
| ---------------- | ------------- | ---------------- | ------------------ | --------- | ------ |
| `mistral`        | recurring     | ~1.00B           | —                  | caution   | 5      |
| `llm7`           | recurring     | ~150M            | —                  | caution   | 4      |
| `longcat`        | one-time      | —                | 10M                | caution   | 1      |
| `gemini`         | recurring     | ~60M             | —                  | caution   | 6      |
| `cerebras`       | recurring     | ~30M             | —                  | caution   | 2      |
| `cloudflare-ai`  | recurring     | ~30M             | —                  | caution   | 6      |
| `api-airforce`   | recurring     | ~24M             | —                  | caution   | 7      |
| `ollama-cloud`   | recurring     | ~20M             | —                  | ambiguous | 8      |
| `github-models`  | recurring     | ~18M             | —                  | caution   | 14     |
| `groq`           | recurring     | ~15M             | —                  | caution   | 5      |
| `bluesminds`     | recurring     | ~7M              | —                  | ambiguous | 22     |
| `sambanova`      | recurring     | ~6M              | —                  | caution   | 5      |
| `arcee-ai`       | recurring     | ~5M              | —                  | caution   | 1      |
| `bazaarlink`     | recurring     | ~4M              | —                  | caution   | 32     |
| `openrouter`     | recurring     | ~1M              | —                  | caution   | 1      |
| `cohere`         | recurring     | ~800K            | —                  | caution   | 6      |
| `huggingchat`    | recurring     | ~500K            | —                  | caution   | 4      |
| `morph`          | recurring     | ~400K            | —                  | ok        | 2      |
| `huggingface`    | recurring     | ~200K            | —                  | caution   | 6      |
| `kiro`           | recurring     | ~25K             | —                  | avoid     | 12     |
| `glm-cn`         | uncapped      | uncapped\*       | ~20M               | ok        | 4      |
| `baidu`          | uncapped      | uncapped\*       | —                  | caution   | 1      |
| `kilo-gateway`   | uncapped      | uncapped\*       | —                  | caution   | 7      |
| `opencode-zen`   | uncapped      | uncapped\*       | —                  | caution   | 6      |
| `siliconflow`    | uncapped      | uncapped\*       | —                  | caution   | 10     |
| `tencent`        | uncapped      | uncapped\*       | —                  | caution   | 1      |
| `vertex`         | signup credit | —                | ~300M              | caution   | 10     |
| `agentrouter`    | signup credit | —                | ~200M              | caution   | 4      |
| `predibase`      | signup credit | —                | ~25M               | caution   | 1      |
| `together`       | signup credit | —                | ~25M               | caution   | 1      |
| `doubao`         | signup credit | —                | ~15M               | ambiguous | 1      |
| `ai21`           | signup credit | —                | ~10M               | avoid     | 2      |
| `deepseek`       | signup credit | —                | ~5M                | ok        | 2      |
| `hyperbolic`     | signup credit | —                | ~5M                | ok        | 8      |
| `nscale`         | signup credit | —                | ~5M                | caution   | 6      |
| `bytez`          | signup credit | —                | ~1M                | ambiguous | 3      |
| `deepinfra`      | signup credit | —                | ~1M                | caution   | 22     |
| `fireworks`      | signup credit | —                | ~1M                | avoid     | 10     |
| `nebius`         | signup credit | —                | ~1M                | caution   | 1      |
| `qoder`          | signup credit | —                | ~1M                | caution   | 14     |
| `scaleway`       | signup credit | —                | ~1M                | ok        | 6      |
| `novita`         | signup credit | —                | ~500K              | caution   | 1      |
| `agy`            | keyless       | —                | —                  | avoid     | 16     |
| `baichuan`       | keyless       | —                | —                  | ambiguous | 1      |
| `blackbox`       | keyless       | —                | —                  | avoid     | 6      |
| `coze`           | keyless       | —                | —                  | avoid     | 1      |
| `duckduckgo-web` | keyless       | —                | —                  | avoid     | 6      |
| `freemodel-dev`  | keyless       | —                | —                  | unknown   | 4      |
| `friendliai`     | keyless       | —                | —                  | avoid     | 2      |
| `hackclub`       | keyless       | —                | —                  | caution   | 3      |
| `iflytek`        | keyless       | —                | —                  | avoid     | 1      |
| `inference-net`  | keyless       | —                | —                  | caution   | 3      |
| `liquid`         | keyless       | —                | —                  | unknown   | 1      |
| `monsterapi`     | keyless       | —                | —                  | ambiguous | 1      |
| `muse-spark-web` | keyless       | —                | —                  | avoid     | 3      |
| `nlpcloud`       | keyless       | —                | —                  | avoid     | 1      |
| `nous-research`  | keyless       | —                | —                  | ambiguous | 2      |
| `nvidia`         | keyless       | —                | —                  | caution   | 13     |
| `opencode`       | keyless       | —                | —                  | avoid     | 7      |
| `pollinations`   | keyless       | —                | —                  | caution   | 31     |
| `publicai`       | keyless       | —                | —                  | caution   | 3      |
| `puter`          | keyless       | —                | —                  | caution   | 33     |
| `qwen-web`       | keyless       | —                | —                  | avoid     | 3      |
| `reka`           | keyless       | —                | —                  | caution   | 2      |
| `sensenova`      | keyless       | —                | —                  | caution   | 1      |
| `sparkdesk`      | keyless       | —                | —                  | caution   | 1      |
| `stepfun`        | keyless       | —                | —                  | ok        | 1      |
| `t3-web`         | keyless       | —                | —                  | avoid     | 23     |
| `uncloseai`      | keyless       | —                | —                  | caution   | 3      |

---

## چه چیزی از catalog ارسال‌شده تغییر کرد (`freeNote`)

> رشته‌های `freeNote` از دوره v3.8.0 قدیمی هستند. اصلاحات یافت‌شده توسط این تحقیق (این‌ها به‌روزرسانی catalog را در `_tasks/features-v3.8.12` هدایت می‌کنند):

- **`360ai`** — freeNote ارسال‌شده "Free 360 AI Brain models" به‌نظر می‌رسد قدیمی باشد. دسترسی فعلی application-gated و پولی است. توکن‌های تبلیغاتی دوران راه‌اندازی 2023 (100M–250M یک‌باره) ممکن است basis برای… بوده باشند
- **`agentrouter`** — freeNote ارسال‌شده ما می‌گوید "$200 free credits on signup." واقعیت فعلی نشان می‌دهد ثبت‌نام‌های استاندارد (غیر ارجاعی) فقط $100 دریافت می‌کنند؛ ثبت‌نام‌های ارجاعی ممکن است $200 بگیرند اما یک کامنت انجمن از آوریل 2026…
- **`agy`** — freeNote ارسال‌شده ما می‌گوید "(none)" که عدم وجود سطح رایگان را imply می‌کند، اما Antigravity یک سطح رایگان OAuth-gated دارد. با این حال، ToS صریحاً استفاده از این سطح رایگان از طریق یک پروکسی مثل RouteChi… را ممنوع می‌کند
- **`ai21`** — سخت‌تر شد: پنجره trial از "۳ ماه" به ۷ روز کوچک شد. مقدار اعتبار $10 همان می‌ماند، اما اعتبار از ~۹۰ روز به ۷ روز به‌شدت کاهش یافت.
- **`aimlapi`** — به‌طور قابل‌توجهی تغییر کرد. freeNote ارسال‌شده "$0.025/day free credits — 200+ models" را تبلیغ می‌کرد اما سطح رایگان اکنون متوقف/Discontinued شده است. تخصیص اعتبار $0.025/day (50,000 credits/day، 10 req/d…
- **`amazon-q`** — freeNote ارسال‌شده ما می‌گوید "(none)" — واقعیت بدتر است: محصول اکنون برای ثبت‌نام‌های جدید متوقف شده است (May 15, 2026). قبلاً سطح رایگان ۵۰ agentic requests/month + unlimited inlin… ارائه می‌داد
- **`api-airforce`** — Catalog freeNote "(none)" را ارسال می‌کند اما یک سطح رایگان مستند وجود دارد: ۱ RPM / ۱,۰۰۰ RPD دوره‌ای، ثبت‌نام حساب لازم، محدود به مدل‌های basic.
- **`arcee-ai`** — freeNote ارسال‌شده ("Free Trinity Large Thinking model (262K context)") تا حدی دقیق است — Trinity Large Thinking واقعاً از طریق OpenRouter با 262K context رایگان است — اما note حذف می‌کند که این…
- **`baichuan`** — freeNote ارسال‌شده ما می‌گوید "Free Baichuan models" که دسترسی رایگان مستمر را imply می‌کند، اما واقعیت فعلی فقط یک اعتبار trial 80 CNY یک‌باره برای کاربران جدید است (معتبر ۳ ماه). هیچ permanently… وجود ندارد
- **`baidu`** — Catalog می‌گوید "Free ERNIE Speed/Lite models" که به‌طور کلی دقیق است، اما دامنه را کم‌رو می‌کند: ERNIE-Tiny و چندین variant context-window (8K و 128K) نیز رایگان هستند. به‌نظر می‌رسد سطح رایگان…
- **`bazaarlink`** — به‌طور کلی مطابقت دارد — freeNote ارسال‌شده به‌طور دقیق routing auto:free را برای inference بدون هزینه توصیف می‌کند. با این حال، واقعیت فعلی شامل محدودیت‌های نرخ صریح (10-20 RPM، ~150 RPD) است که در i ذکر نشده…
- **`blackbox`** — freeNote ارسال‌شده ما ادعا می‌کند "unlimited basic chat plus Minimax-M2.5." در واقع، درخواست‌های agent نامحدود Minimax-M2.5 یک ویژگی طرح پولی (Pro+) است، نه بخشی از سطح رایگان. سطح رایگان li… دارد
- **`bluesminds`** — freeNote ارسال‌شده ما "(none)" بود — اما BluesMinds یک سطح رایگان مستند دارد: 500 pi credits، 20 RPM، 300 RPD، طرح رایگان دائمی. Catalog به‌طور قابل‌توجهی عرضه را کم‌رو می‌کند.
- **`brave-search`** — Catalog "(none)" را یادداشت می‌کند که نشان می‌دهد هیچ سطح رایگانی ردیابی نشده بود، اما در واقع یک سطح رایگان ۵,۰۰۰ queries/month (بدون کارت) تا February 12, 2026 وجود داشت، که از آن زمان با یک $5/month… جایگزین شده است
- **`byteplus`** — Catalog ما "(none)" ارسال کرد اما BytePlus ModelArk یک سطح رایگان دارد: یک اعتبار trial یک‌باره 500k tokens به‌ازای هر مدل LLM برای حساب‌های جدید. Catalog این را کم‌گزارش می‌کند.
- **`cerebras`** — به‌نظر می‌رسد TPM از 60K به 30K در مدل‌های مستند فعلی (gpt-oss-120b، zai-glm-4.7) سخت‌تر شده باشد. RPM از ۵ اکنون صریحاً مستند شده است (در note ارسال‌شده ما نبود). سقف توکن روزانه 1M/day بدون تغییر است…
- **`chutes`** — freeNote ارسال‌شده می‌گوید "Free tier available" اما از March 15, 2026، سطح رایگان به‌طور رسمی discontinued شده است. note Catalog قدیمی است و باید به‌روزرسانی شود تا بازتاب دهد که هیچ r… وجود ندارد
- **`coze`** — note ارسال‌شده "Free ByteDance agent platform" از نظر جهتی دقیق است اما حذف می‌کند که سطح رایگان اکنون به‌شدت credit-capped شده است (10 credits/day ≈ 5–100 پیام بسته به مدل)، یک constraint…
- **`deepinfra`** — freeNote ارسال‌شده ما می‌گوید "Free signup credits for API testing" — این به‌نظر می‌رسد قدیمی باشد. صفحه قیمت‌گذاری رسمی اکنون نیازمند کارت/پیش‌پرداخت بدون credit ثبت‌نام عمومی مستند است. سطح رایگان ti…
- **`deepseek`** — note ارسال‌شده ما می‌گوید "5M free tokens on signup - no credit card required" — این هنوز برای اعطای یک‌باره دقیق است، اما مهم این است که اعتبارها پس از ۳۰ روز منقضی می‌شوند (در ship… ذکر نشده)
- **`dify`** — freeNote ارسال‌شده ("Free open-source AI app builder + RAG") از نظر جهتی دقیق اما ناقص است. سطح رایگان ابری محدودتر از imply شده است: ۲۰۰ message credit به‌نظر می‌رسد یک one-t… باشد
- **`doubao`** — freeNote ارسال‌شده "Free Doubao models (ByteDance)" از نظر جهتی درست اما underspecified است. واقعیت فعلی ساختاریافته‌تر است: یک سطح رایگان روزانه دوره‌ای کمیت‌سازی‌شده وجود دارد (2M tokens/day v…
- **`duckduckgo-web`** — توصیف اصلی "free anonymous access" همچنان برقرار است، اما سرویس به‌طور قابل‌توجهی بالغ شده است: اکنون دارای طبقات پولی صریح (Plus/Pro) با محدودیت‌های بالاتر است که implies می‌کند سطح رایگان rate-constr… است
- **`exa-search`** — Catalog freeNote "(none)" را ارسال می‌کند اما Exa یک سطح رایگان دوره‌ای مستند ۱,۰۰۰ requests/month دارد. این یک شکاف قابل‌توجه است — سطح رایگان وجود دارد و دائمی است.
- **`featherless-ai`** — freeNote ارسال‌شده ما می‌گوید "Free tier available" اما هیچ سطح رایگان عمومی وجود ندارد. تنها دسترسی رایگان از طریق یک برنامه Builder Series مبتنی بر دعوت/درخواست است، که یک standard free… نیست
- **`firecrawl`** — Catalog ما freeNote "(none)" ارسال کرد، که imply می‌کند هیچ سطح رایگان وجود ندارد. در واقع Firecrawl یک طرح رایگان دوره‌ای مستند با ۱,۰۰۰ credits/month دارد — مدخل catalog نادرست است.
- **`freemodel-dev`** — freeNote ارسال‌شده ما "(none)" است — این احتمالاً یک placeholder به معنای آن بود که ارائه‌دهنده هنوز catalog نشده بود. در واقع ارائه‌دهنده یک پیشنهاد اعتبار trial یک‌باره $300 دارد. با این حال، این یک o… است
- **`friendliai`** — freeNote ارسال‌شده ("Free tier for serverless inference") تا حدی دقیق اما گمراه‌کننده است. دسترسی رایگان از طریق Tier 0 و مدل‌های free-designated وجود دارد، اما محدودیت‌های نرخ تعریف‌نشده هستند و ada…
- **`gemini`** — freeNote ارسال‌شده می‌گوید "1,500 req/day for Gemini 2.5 Flash" — این قبل از December 2025 دقیق بود. Google محدودیت‌های سطح رایگان را در December 2025 به ۵۰-۸۰٪ کاهش داد، که Gemini 2.5 Flash را از 1,500 R… کم کرد
- **`github-models`** — note Catalog "Free GPT-5, o-series, DeepSeek-R1, Llama 4, Grok 3" از نظر جهتی درباره دسترسی مدل درست است اما محدودیت‌های نرخ روزانه (50 RPD برای مدل‌های high-tier، 150 RPD برای low-tier) را حذف می‌کند…
- **`gitlawb`** — freeNote ارسال‌شده "Free tier available" به‌طور مؤثری قدیمی است. دسترسی رایگان MiMo اصلی در May 2026 حذف شد؛ تنها گزینه "رایگان" باقی‌مانده یک مدل تبلیغاتی موقت (Nemotron 3 U… است
- **`gitlawb-gmi`** — تا حدی هنوز دقیق — سطح رایگان وجود دارد اما اکنون پس از revoke شدن دسترسی رایگان MiMo در اواخر May 2026 به یک مدل منفرد (Nemotron 3 Ultra) محدود شده است. note ارسال‌شده "Free tier available" کم… است
- **`groq`** — freeNote ارسال‌شده "30 RPM / 14.4K RPD" فقط برای llama-3.1-8b-instant دقیق است. بیشتر مدل‌های دیگر (از جمله llama-3.3-70b-versatile) یک سقف بسیار پایین‌تر 1K RPD دارند. note model-specific… را حذف می‌کند
- **`hackclub`** — شمارش "30+ models" به‌نظر می‌رسد دقیق باشد و همچنان مطابقت دارد. عرضه اصلی برای اعضای Hack Club رایگان می‌ماند. هیچ شواهدی از سخت‌تر شدن — همچنان "$0 ALWAYS FREE" طبق homepage. freeNote حذف می‌کند…
- **`huggingchat`** — freeNote ارسال‌شده ("Free LLM chat — no subscription required. Rate limits apply.") تا حدی دقیق اما به‌طور قابل‌توجهی محدودیت‌ها را کم‌رو می‌کند. سطح رایگان اکنون روی یک $0.10/ سخت کار می‌کند…
- **`huggingface`** — به‌طور قابل‌توجهی سخت‌تر شد. freeNote ارسال‌شده ("Free Inference API for thousands of models") دسترسی رایگان نامحدود/سخاوتمندانه را imply می‌کرد، اما از اواسط 2025 سطح رایگان به $0.10/month در recur… محدود شده است…
- **`hyperbolic`** — freeNote ارسال‌شده ما می‌گوید "$1-5 trial credits on signup" — بخش اعتبار trial $1 دقیق است، اما عدد "$5" به حداقل واریز لازم برای باز کردن قفل اجاره GPU اشاره دارد (نه اعتبار رایگان g…
- **`iflytek`** — Catalog می‌گوید "Free Spark Lite models" — این به‌طور کلی دقیق است. با این حال واقعیت فعلی دقیق‌تر است: فقط Spark Lite رایگان است (عرضه 100M token Max یک promo یک‌باره بود، نه دوره‌ای)؛ …
- **`inference-net`** — freeNote ارسال‌شده بیان می‌کند "$25 free credits on signup plus research grants." صفحه قیمت‌گذاری فعلی فقط $1 recurring monthly credits را نشان می‌دهد بدون ذکر $25 signup bonus یا research grant…
- **`jina-reader`** — freeNote ارسال‌شده ما "(none)" بود، که نادرست است. Jina Reader از launch یک سطح رایگان مستند به‌صورت عمومی داشته است: دسترسی keyless با 20 RPM به‌علاوه یک اعتبار یک‌باره 10M token با یک API key رایگان. …
- **`kiro`** — Catalog freeNote "(none)" ارسال کرد — اما Kiro یک سطح رایگان مستند، دائمی ۵۰ credits/month دارد. سطح رایگان از launch عمومی Kiro وجود داشت (قیمت‌گذاری ~October 2025 رسمی شد). این یک … است
- **`llm7`** — محدودیت‌های نرخ از freeNote ارسال‌شده (20 RPM / 100 req/hr → 40 RPM / 200 req/hr) افزایش یافته است. ادعای "no signup required" اکنون قدیمی است — یک token رایگان از token.llm7.io اکنون لازم است (tho…
- **`longcat`** — public preview/beta پایان یافت و مدل‌های Flash بازنشسته شدند؛ فقط GA `LongCat-2.0` باقی ماند. سطح رایگان یک **اعطای یک‌باره 10M-token** است که پس از ثبت‌نام حساب + **تأیید KYC** باز می‌شود — **بازنشانی روزانه یا ماهانه نمی‌شود**. پس از اعطا، pay-as-you-go است.
- **`mistral`** — freeNote ارسال‌شده ("Free Experiment tier: rate-limited access to all models") از نظر جهتی درست اما کم‌رو شده است. واقعیت فعلی محدودیت‌های مستند خاصی اضافه می‌کند: ۲ RPM، 500K TPM، 1B tokens/…
- **`monsterapi`** — freeNote ارسال‌شده می‌گوید "Free credits for decentralized GPU inference" که تا حدی دقیق است — اعتبارهای trial یک‌باره هنگام ثبت‌نام وجود دارد. با این حال، سطح رایگان دوره‌ای ۰ credits/month دارد…
- **`morph`** — freeNote ارسال‌شده "250K credits/month" را ذکر می‌کند که با تخصیص اعتبار فعلی مطابقت دارد؛ با این حال، محدودیت قابل‌توجه‌تر ۲۰۰ requests/month است که در c اصلی… ثبت نشده بود
- **`muse-spark-web`** — freeNote ارسال‌شده ("Free with login — Meta AI platform with Llama models") درباره نیاز به login و دسترسی مدل Llama به‌طور کلی دقیق است. هیچ سخت‌تر شدن سطح رایگان شناسایی نشد؛ r…
- **`nlpcloud`** — freeNote ارسال‌شده می‌گوید "Trial credits for new accounts," که یک trial یک‌باره را imply می‌کند. در واقع، سطح رایگان NLP Cloud یک طرح رایگان ماهانه دوره‌ای است (10,000 requests/month)، نه trial credi…
- **`nomic`** — freeNote ارسال‌شده ما می‌گوید "Free Nomic Embed API" بدون قید و شرط، که دسترسی رایگان مستمر را imply می‌کند. واقعیت یک اعتبار trial یک‌باره 1M-token فقط است — پس از آن بودجه توکن مصرف شده، paid subs…
- **`nous-research`** — freeNote ارسال‌شده ("Free tier: 50 RPM, 500,000 TPM") با محصول Nous Portal فعلی مطابقت ندارد. portal در April 27, 2026 راه‌اندازی شد و سطح رایگان خود را به‌صورت $0.10/month در recurring cre… ساختاربندی می‌کند…
- **`nvidia`** — عنصر محدودیت نرخ "40 RPM، 70+ models" با catalog مطابقت دارد، اما قاب‌بندی freeNote به‌عنوان یک سطح ساده dev-access کم‌فروش می‌کند که pool اعتبار یک‌باره قدیمی حذف شده — دسترسی اکنون tru… است
- **`ollama-cloud`** — freeNote ارسال‌شده ما "(none)" است — این قدیمی است. Ollama Cloud یک محصول inference ابری با یک سطح رایگان واقعی راه‌اندازی کرد که دسترسی مبتنی بر زمان GPU هفتگی سبک به مدل‌های open میزبانی‌شده ارائه می‌دهد.
- **`openrouter`** — RPD از ۲۰۰ به ۵۰ برای حساب‌های بدون اعتبار سخت‌تر شد (RPM بدون تغییر در 20). note catalog روی RPM دقیق بود اما RPD را به ۴ برابر برای طبقه baseline بدون-اعتبار بیش از حد بیان کرد.
- **`phind`** — Phind در January 16, 2026 تعطیل شد. ارائه‌دهنده اکنون به‌طور **کامل** از catalog حذف شده است (registry، executor و هر دو مدخل catalog web-cookie و API-key) — مطابق با سابقه dead-service-removal (#5246 Gemini CLI).
- **`pollinations`** — تا حدی مطابقت دارد — ادعای "no API key required" هنوز برای دسترسی ناشناس درست است، اما freeNote catalog حذف می‌کند که: (۱) محدودیت‌های نرخ اعمال می‌شود (interval throttle ~1 req/6-15s برای anonymous…
- **`predibase`** — freeNote ارسال‌شده ($25 free trial credits، اعتبار 30 روزه) همچنان با مستندات فعلی مطابقت دارد. با این حال، catalog محدودیت نرخ serverless 20,000 tokens/day همزمان را که duri اعمال می‌شود حذف می‌کند…
- **`publicai`** — freeNote ارسال‌شده ("Free community inference tier") به‌طور کلی دقیق اما ویژگی را کم‌رو می‌کند: محدودیت نرخ 20 RPM اکنون مستند شده است. هیچ سخت‌تر شدن عمده‌ای یافت نشد؛ سرویس همچنان fre… است
- **`puter`** — تا حدی مطابقت دارد: شمارش "500+ models" هنوز دقیق است. با این حال "users pay via Puter account" واقعیت را کم‌رو می‌کند — حساب‌های رایگان یک اعتبار شروعی مستند نشده دریافت می‌کنند که ممکن است exhaust… شود
- **`qoder`** — Catalog ما freeNote "(none)" ارسال می‌کند، اما Qoder یک سطح رایگان دارد: یک Community Edition با تکمیل‌های مدل basic نامحدود (daily-capped، محدودیت نامشخص) به‌علاوه یک Pr 14 روزه/300-credit یک‌باره…
- **`qwen-web`** — freeNote ارسال‌شده ("Free — Qwen models via chat.qwen.ai with login token") اکنون قدیمی است. مسیر API رایگان login-token/OAuth در 2026-04-15 پایان یافت. executor qwen-web خطای 401 دریافت خواهد کرد…
- **`sambanova`** — note ارسال‌شده ما فقط اعتبار یک‌باره $5 (اعتبار 30 روزه) را توصیف می‌کرد. واقعیت فعلی شامل یک سطح رایگان دوره‌ای دائمی با محدودیت‌های نرخ مستند (20 RPM، 20 RPD، 200k TPD) است که pers…
- **`sensenova`** — freeNote ارسال‌شده ما می‌گوید "Free SenseTime models" که مبهم اما از نظر جهتی درست است — دسترسی رایگان واقعاً وجود دارد. با این حال، واقعیت دقیق‌تر است: دسترسی رایگان یک beta عمومی time-limited است (Token…
- **`serper-search`** — freeNote ارسال‌شده می‌گوید "(none)" که تا حدی دقیق است — هیچ طرح رایگان دوره‌ای وجود ندارد — اما Serper ۲,۵۰۰ اعتبار trial یک‌باره هنگام ثبت‌نام ارائه می‌دهد. note catalog می‌تواند دقیق‌تر باشد…
- **`siliconflow`** — تا حدی مطابقت دارد اما دقیق‌تر: اعتبارهای رایگان $1 یک trial یک‌باره است (دوره‌ای نیست)، در حالی که جزء "permanently free models" همچنان برقرار است — مدل‌های رایگان $0 به وجود خود ادامه می‌دهند (Qwen3-8B، D…
- **`sparkdesk`** — تا حدی مطابقت دارد — freeNote ارسال‌شده "Free iFlytek Spark models" در این که Spark Lite به‌طور دائمی رایگان است دقیق است، اما محدودیت (2 QPS per App ID) را کم‌رو می‌کند و دامنه را بیش از حد بیان می‌کند (فقط S…
- **`stepfun`** — freeNote ارسال‌شده "Free Step-2 models" قدیمی است. دسترسی رایگان Step-2 LLM دیگر ارائه نمی‌شود؛ پلتفرم به مدل‌های Step 3.x روی یک پایه paid-per-token بدون سطح LLM رایگان منتقل شده است. فقط…
- **`t3-web`** — freeNote ارسال‌شده به‌طور کلی دقیق است (دسترسی مدل محدود، Pro ۵۰+ مدل را با $8/month باز می‌کند)، اما دو به‌روزرسانی کلیدی را از دست می‌دهد: (۱) سطح رایگان اکنون به‌جای ماهانه به‌صورت روزانه بازنشانی می‌شود (تغییر حدود…
- **`tavily-search`** — Catalog freeNote "(none)" ارسال می‌کند که imply می‌کند هیچ سطح رایگان وجود ندارد، اما Tavily در واقع یک سطح رایگان دوره‌ای مستند ۱,۰۰۰ credits/month بدون نیاز به کارت اعتباری ارائه می‌دهد. این یک discre قابل‌توجه است…
- **`tencent`** — تا حد زیادی مطابقت دارد — freeNote ارسال‌شده ("Free Hunyuan Lite models") دقیق است. Hunyuan-lite از May 2024 به‌طور دائمی رایگان بوده و تا 2026 همین‌طور باقی می‌ماند. note catalog detai را کم‌فروش می‌کند…
- **`theoldllm`** — freeNote ارسال‌شده ما "(none)" بود — این هنوز به این معنا مطابقت دارد که هیچ API/sطح رایگان ساختاریافته وجود ندارد؛ سرویس همچنان یک wrapper chat فقط-UI بدون طبقه API catalogable است.
- **`together`** — note ارسال‌شده می‌گوید "$25 signup credits + 3 permanently free models" اما واقعیت نشان می‌دهد مدل‌های رایگان دائمی بسیار بیشتری وجود دارد (~80، نه 3). عدد اعتبار trial $25 مورد مناقشه است — billing رسمی doc…
- **`uncloseai`** — تا حد زیادی مطابقت دارد — همچنان برای همیشه رایگان بدون ثبت‌نام. با این حال، ToS (terms-of-use.html) روشن می‌کند که throttle مبتنی بر IP برای استفاده افراطی وجود دارد و ساخت سرویس‌های ML رقابتی را بدون… ممنوع می‌کند
- **`veoaifree-web`** — freeNote ارسال‌شده بیان می‌کند "6 requests/hour" اما چنین محدودیت صریحی در حال حاضر در هیچ‌جا روی veoaifree.com مستند نشده است. سایت ادعای تولید نامحدود رایگان بدون login را دارد. مدل‌های لیست‌شده…
- **`voyage-ai`** — freeNote ارسال‌شده "200M free tokens for embeddings and reranking" از نظر جهتی روی شمارش توکن درست اما گمراه‌کننده است — حذف می‌کند که این یک تخصیص به‌ازای حساب یک‌باره است، نه یک recurr…
- **`yi`** — freeNote ارسال‌شده "Free Yi-Light models" به یک نام مدل ("Yi-Light") اشاره می‌کند که در هیچ مستند یا catalog مدل فعلی 01.AI ظاهر نمی‌شود — چنین مدلی روی platform.01.ai لیست نشده است،…

---

## واژه‌نامه

| Term                    | Meaning                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| **RPM / RPD / RPH**     | درخواست به ازای دقیقه / روز / ساعت                                           |
| **TPM / TPD**           | توکن به ازای دقیقه / روز                                                    |
| **اعطای مستند**    | ارائه‌دهنده یک سقف توکن روزانه/ماهانه صریح منتشر می‌کند (بودجه قابل‌دفاع) |
| **سقف نظری** | `rate-limit × 24/7 × 30d` — یک حداکثر، نه یک بودجه اعطا‌شده                |
| **Neuron**              | واحد محاسبه Cloudflare (~۱ توکن خروجی)                                  |

> تولیدشده از تحقیق به‌ازای ارائه‌دهنده در 2026-06-05. برای بازخوانی، workflow تحقیق را دوباره اجرا کنید (به `_tasks/features-v3.8.12` مراجعه کنید).
