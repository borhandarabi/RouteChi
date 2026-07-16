---
title: "OmniRoute — گالری ویژگی‌های داشبورد"
version: 3.8.40
lastUpdated: 2026-06-28
---

# OmniRoute — گالری ویژگی‌های داشبورد

🌐 **ترجمه‌های README اصلی:** 🇺🇸 [English](../README.md) | 🇧🇷 [Português (Brasil)](../i18n/pt-BR/README.md) | 🇪🇸 [Español](../i18n/es/README.md) | 🇫🇷 [Français](../i18n/fr/README.md) | 🇮🇹 [Italiano](../i18n/it/README.md) | 🇷🇺 [Русский](../i18n/ru/README.md) | 🇨🇳 [中文 (简体)](../i18n/zh-CN/README.md) | 🇩🇪 [Deutsch](../i18n/de/README.md) | 🇮🇳 [हिन्दी](../i18n/in/README.md) | 🇹🇭 [ไทย](../i18n/th/README.md) | 🇺🇦 [Українська](../i18n/uk-UA/README.md) | 🇸🇦 [العربية](../i18n/ar/README.md) | 🇯🇵 [日本語](../i18n/ja/README.md) | 🇻🇳 [Tiếng Việt](../i18n/vi/README.md) | 🇧🇬 [Български](../i18n/bg/README.md) | 🇩🇰 [Dansk](../i18n/da/README.md) | 🇫🇮 [Suomi](../i18n/fi/README.md) | 🇮🇱 [עברית](../i18n/he/README.md) | 🇭🇺 [Magyar](../i18n/hu/README.md) | 🇮🇩 [Bahasa Indonesia](../i18n/id/README.md) | 🇰🇷 [한국어](../i18n/ko/README.md) | 🇲🇾 [Bahasa Melayu](../i18n/ms/README.md) | 🇳🇱 [Nederlands](../i18n/nl/README.md) | 🇳🇴 [Norsk](../i18n/no/README.md) | 🇵🇹 [Português (Portugal)](../i18n/pt/README.md) | 🇷🇴 [Română](../i18n/ro/README.md) | 🇵🇱 [Polski](../i18n/pl/README.md) | 🇸🇰 [Slovenčina](../i18n/sk/README.md) | 🇸🇪 [Svenska](../i18n/sv/README.md) | 🇵🇭 [Filipino](../i18n/phi/README.md) | 🇨🇿 [Čeština](../i18n/cs/README.md)

راهنمای تصویری برای هر بخش از داشبورد OmniRoute.

> 📅 **آخرین به‌روزرسانی:** 2026-06-28 — **v3.8.40**

---

## ✨ نکات برجستهٔ v3.8.0

چرخهٔ v3.7.x → v3.8.0 مسیریابی خودکار بدون پیکربندی، ارائه‌دهنده‌های جدید، جریان‌های OAuth،
تاب‌آوری عمیق‌تر و تجربهٔ CLI بسیار غنی‌تر را اضافه کرد. ویژگی‌های اصلی زیر — جزئیات کامل
در ادامهٔ سند و در مشخصات پیوندشده آمده است.

- 🤖 **Auto Combo / مسیریابی خودکار بدون پیکربندی** — از پیشوندهای `auto/coding`، `auto/fast`،
  `auto/cheap`، `auto/offline`، `auto/smart`، `auto/lkgp` استفاده کنید. پشتیبانی‌شده توسط یک
  موتور امتیازدهی ۹ عاملی و ۴ **mode pack** تنتخب‌شده (ship-fast، cost-saver، quality-first، offline-friendly)
- 🆕 **ارائه‌دهندهٔ Command Code** (#2199) — ثبت first-class با کاتالوگ مدل و پیگیری سهمیه
- 🆕 **ارائه‌دهندهٔ Z.AI** — ارائه‌دهندهٔ جدید با سطح رایگان و برچسب‌های سهمیه
- 🎬 **گسترش رسانه‌ای KIE** — کاتالوگ گسترده شامل مدل‌های تولید ویدیو
- 🔐 **جریان‌های OAuth مربوط به Windsurf + Devin CLI** (#2168) — ورود کامل مبتنی بر مرورگر
- 🆓 **۸ ارائه‌دهندهٔ رایگان جدید** — LLM7، Lepton، UncloseAI، BazaarLink، Completions، Enally، FreeTheAi، Command Code
- 🎯 **مسیریابی tier آگاه از manifest، W1–W4** — manifestهای ارائه‌دهنده انتخاب وزن‌دار tier را هدایت می‌کنند
- 🎨 **پاریتی کامل Cursor با OpenAI** — tool callها، streaming، مدیریت نشست end-to-end
- 📊 **استفاده از پلن Cursor Pro** — دادهٔ سهمیه و چرخه در داشبورد provider-limits نمایان می‌شود
- ⚡ **تفکیک service tier / تحلیل‌های Codex fast tier** — دیدگاه مصرف به ازای هر tier
- 📌 **مسیریابی sticky به ازای نشست** — نشست‌های Codex بین نوبت‌ها به همان حساب متصل می‌شوند
- 🔊 **بهبودهای Inworld TTS** — کاتالوگ صدا، streaming و بهبود latency
- 🔑 **احراز هویت headless مربوط به Kiro** — ورود از طریق فروشگاه محلی SQLite مربوط به `kiro-cli`، بدون نیاز به مرورگر
- 📉 **پایش سهمیه و محدودیت DeepSeek** — استفادهٔ روزانه/ماهانه از طریق داشبورد در دسترس
- 🔄 **استراتژی مسیریابی آگاه از reset** — کامبوها اکنون حساب‌هایی را ترجیح می‌دهند که پنجرهٔ سهمیهٔ آن‌ها زودتر بازنشانی می‌شود
- ⏱️ **`fallbackDelayMs`** و **شناسایی پویای محدودیت tool** — زمان‌بندی fallback دقیق‌تر + محدودیت تعداد tool به ازای ارائه‌دهنده
- 🔧 **تنزل حالت پس‌زمینه (Responses API)** — در صورت نبود polling پس‌زمینه در بالادست، با هشدار ساختاریافته به حالت هم‌زمان fallback می‌کند
- 🚦 **تفکیب 429 به ازای ارائه‌دهنده** + toggle `useUpstream429BreakerHints` — رفتار breaker دقیق‌تر با استفاده از hintهای rate-limit بالادست
- 🩺 **داشبورد cooldown مدل‌ها** — مشاهدهٔ lockoutهای به‌ازای مدل و فعال‌سازی دستی مجدد از رابط کاربری
- 🔒 **شناسایی پویای گواهی MITM لینوکس** — در Debian/Ubuntu، Fedora/RHEL، Arch و سایر توزیع‌ها کار می‌کند
- 💻 **مجموعهٔ بهبود CLI** — ۲۰+ دستور شامل `routechi providers`، `routechi combos`، `routechi doctor`، `routechi setup`
- 🔍 **کشف مدل embedding مربوط به Qdrant** — probe خودکار مدل vector-store
- 🔑 **کلیدهای API / Bearer keys با scope `manage`** — انجام عملیات مدیریتی به‌صورت برنامه‌نویسی از طریق API
- 🏥 **تحلیل سلامت target کامبو** + **سازندهٔ کامبو ساختاریافته** — سلامت به‌ازای target و سازندهٔ رابط کاربری برای مونتاژ گام‌های `(provider, model, connection)`
- 🤝 **ارائه‌دهندهٔ OAuth مربوط به GitLab Duo** — ورود با credentialهای GitLab
- 🧠 **Reasoning Replay Cache** — ماندگاری ترکیبی درون‌حافظه‌ای + SQLite از رد reasoning

📚 **مستندات مرتبط:** [Skills Framework](../frameworks/SKILLS.md) · [Memory System](../frameworks/MEMORY.md) · [Cloud Agents](../frameworks/CLOUD_AGENT.md) · [Webhooks](../frameworks/WEBHOOKS.md) · [Reasoning Replay Cache](../routing/REASONING_REPLAY.md)

---

## 🔌 ارائه‌دهنده‌ها

مدیریت اتصالات ارائه‌دهندهٔ AI: ارائه‌دهنده‌های OAuth (Claude Code، Codex)، ارائه‌دهنده‌های کلید API (Groq، DeepSeek، OpenRouter) و ارائه‌دهنده‌های رایگان (Qoder، Qwen، Kiro). حساب‌های Kiro شامل پیگیری ماندهٔ اعتبار هستند — اعتبار باقی‌مانده، کل allowance و تاریخ تجدید در Dashboard → Usage قابل مشاهده است.

اتصالات OpenRouter می‌توانند یک `preset` به ازای اتصال در Advanced Settings ذخیره کنند. هنگام تنظیم، OmniRoute آن را به‌عنوان فیلد درخواست top-level مربوط به OpenRouter ارسال می‌کند، مثلاً `"preset": "email-copywriter"`، مگر اینکه درخواست کاربر از قبل `preset` خود را ارائه کرده باشد.

![Providers Dashboard](../screenshots/01-providers.png)

---

## 🎨 کامبوها

ایجاد کامبوهای مسیریابی مدل با ۱۷ استراتژی: priority، weighted، fill-first، round-robin، p2c (power-of-two-choices)، random، least-used، cost-optimized، reset-aware، reset-window، headroom، strict-random، auto، lkgp (last-known-good-provider)، context-optimized، context-relay و **fusion** (fan out به پنلی از مدل‌ها به‌صورت موازی، سپس سنتز یک پاسخ از طریق یک judge). هر کامبو چندین مدل را با fallback خودکار زنجیره می‌کند و شامل قالب‌های سریع و بررسی‌های آمادگی است.

بهبودهای اخیر کامبو:

- **سازندهٔ کامبو ساختاریافته** — ایجاد هر گام با انتخاب ارائه‌دهنده، مدل و حساب/اتصال دقیق
- **پشتیبانی از ارائه‌دهندهٔ تکراری** — استفادهٔ مکرر از همان ارائه‌دهنده در یک کامبو تا زمانی که tuple `(provider, model, connection)` یکتا باشد
- **سلامت target کامبو** — تحلیل‌ها و سطوح سلامت اکنون targetها/گام‌های جداگانه کامبو را متمایز می‌کنند به‌جای فروپاشی همه‌چیز در رشته‌های مدل
- **ترتیب‌بندی tier مرکب** — `defaultTier -> fallbackTier` اکنون بر ترتیب اجرا/fallback زمان اجرا برای گام‌های top-level کامبو تأثیر می‌گذارد

![Combos Dashboard](../screenshots/02-combos.png)

---

## 📊 تحلیل‌ها

تحلیل‌های جامع استفاده با مصرف توکن، تخمین هزینه، نقشه‌های حرارتی فعالیت، نمودارهای توزیع هفتگی و تفکیک به ازای ارائه‌دهنده.

![Analytics Dashboard](../screenshots/03-analytics.png)

---

## 🏥 سلامت سامانه

پایش بلادرنگ: uptime، حافظه، نسخه، صدک‌های latency (p50/p95/p99)، آمار کش، وضعیت‌های circuit breaker ارائه‌دهنده، نشست‌های پایش‌شدهٔ سهمیهٔ فعال و سلامت target کامبو.

![Health Dashboard](../screenshots/04-health.png)

---

## 🔧 Translator Playground

چهار حالت برای اشکال‌زدایی ترجمه‌های API: **Playground** (مبدل قالب)، **Chat Tester** (درخواست‌های زنده)، **Test Bench** (آزمون‌های دسته‌ای) و **Live Monitor** (جریان بلادرنگ).

![Translator Playground](../screenshots/05-translator.png)

---

## 🎮 Model Playground _(v2.0.9+)_

آزمایش هر مستقیماً از داشبورد. انتخاب ارائه‌دهنده، مدل و نقطهٔ پایانی، نوشتن prompt با Monaco Editor، streaming پاسخ‌ها به‌صورت بلادرنگ، قطع میان‌جریان و مشاهدهٔ معیارهای زمان‌بندی.

---

## 🎨 تم‌ها _(v2.0.5+)_

تم‌های رنگ قابل تنظیم برای کل داشبورد. انتخاب از میان ۷ رنگ preset (Coral، Blue، Red، Green، Violet، Orange، Cyan) یا ایجاد تم سفارشی با انتخاب هر رنگ hex. پشتیبانی از حالت روشن، تیره و سامانه.

---

## ⚙️ تنظیمات

پنل تنظیمات جامع با **۷ تب**:

- **General** — ذخیره‌سازی سامانه، مدیریت پشتیبان (صادرات/واردات پایگاه داده)
- **Appearance** — انتخابگر تم (تیره/روشن/سامانه)، presetهای تم رنگی و رنگ‌های سفارشی، نمایان‌سازی لاگ سلامت، کنترل نمایان‌سازی آیتم‌های نوار کناری و جداکنندهٔ گروه، کنترل نمایان‌سازی تونل نقطهٔ پایانی
- **AI** — ویژگی‌های دستیار AI، presetهای مسیریابی پیش‌فرض (Auto Combo `auto/coding`، `auto/fast`، `auto/cheap`، `auto/smart`)، cache reasoning replay و toggleهای skill/memory
- **Security** — حفاظت نقطهٔ پایانی API، مسدودسازی سفارشی ارائه‌دهنده، فیلتر IP، اطلاعات نشست
- **Routing** — نام‌های مستعار مدل، تنزل وظیفهٔ پس‌زمینه، مسیریابی tier آگاه از manifest (W1–W4)، `fallbackDelayMs`، مسیریابی sticky به‌ازای نشست
- **Resilience** — ماندگاری rate limit، تنظیم circuit breaker، غیرفعال‌سازی خودکار حساب‌های banned، پایش انقضای ارائه‌دهنده، آستانهٔ انتقال **Context Relay** و پیکربندی مدل خلاصه، تفکیک 429 به‌ازای ارائه‌دهنده و toggle `useUpstream429BreakerHints`، cooldown مدل‌ها
- **Advanced** — بازنویسی‌های پیکربندی، سابقهٔ ممیزی پیکربندی، حالت تنزل fallback، تنزل حالت پس‌زمینه برای Responses API

![Settings Dashboard](../screenshots/06-settings.png)

---

## 🔧 ابزارهای CLI

پیکربندی یک‌کلیکی برای ابزارهای کدنویسی AI: Claude Code، Codex CLI، OpenClaw، Kilo Code، Antigravity، Cline، Continue، Cursor و Factory Droid. ویژگی‌ها شامل اعمال/بازنشانی پیکربندی خودکار، پروفایل‌های اتصال و نگاشت مدل است.

![CLI Tools Dashboard](../screenshots/07-cli-tools.png)

---

## 🤖 CLI Agents _(v2.0.11+)_

داشبورد برای کشف و مدیریت agentهای CLI. نمایش یک شبکه از ۱۷ agent داخلی (Codex، Claude، Goose، OpenClaw، Aider، OpenCode، Cline، Qwen Code، ForgeCode، Amazon Q، Open Interpreter، Cursor CLI، Warp، **Windsurf**، **Devin CLI**، **Kimi Coding**، **Command Code**) با:

- **وضعیت نصب** — نصب‌شده / یافت‌نشد با شناسایی نسخه
- **نشان‌های پروتکل** — stdio، HTTP و...
- **agentهای سفارشی** — ثبت هر ابزار CLI از طریق فرم (نام، باینری، دستور نسخه، args اجرا)
- **تطبیق اثرانگشت CLI** — toggle به‌ازای ارائه‌دهنده برای تطبیق امضاهای درخواست CLI بومی، کاهش ریسک ban با حفظ IP پروکسی
- **agentهای پشتیبان‌شده با OAuth** — Windsurf و Devin CLI اکنون از جریان‌های OAuth مرورگر برای احراز هویت استفاده می‌کنند (v3.8.0+)

---

## 🔗 Context Relay _(v3.5.5+)_

یک استراتژی کامبو که تداوم نشست را هنگام چرخش حساب در میان گفت‌وگو حفظ می‌کند. پیش از آنکه حساب فعال تمام شود، OmniRoute یک خلاصهٔ انتقال ساختاریافته در پس‌زمینه تولید می‌کند. پس از آنکه درخواست بعدی به حساب متفاوتی هدایت می‌شود، خلاصه به‌عنوان یک پیام سیستمی تزریق می‌شود تا حساب جدید با context کامل ادامه دهد.

قابل پیکربندی از طریق تنظیمات کامبو یا سراسری:

- **آستانهٔ انتقال** — درصد استفادهٔ سهمیه که تولید خلاصه را راه‌اندازی می‌کند (پیش‌فرض ۸۵٪)
- **حداکثر پیام‌ها برای خلاصه** — میزان تاریخچهٔ اخیر برای فشرده‌سازی
- **مدل خلاصه** — بازنویسی اختیاری مدل برای تولید خلاصهٔ انتقال

در حال حاضر چرخش حساب Codex را پشتیبانی می‌کند. به [مستندات Context Relay](../architecture/ARCHITECTURE.md) مراجعه کنید.

---

## 🗜️ فشرده‌سازی Prompt _(v3.7.9+)_

Context & Cache اکنون صفحات اختصاصی برای Caveman، RTK و Compression Combos ارائه می‌دهد:

- **Caveman** — بسته‌های قاعده آگاه از زبان، پیش‌نمایش، کنترل‌های حالت خروجی و تحلیل
- **RTK** — فشرده‌سازی آگاه از دستور برای shell، git، test، build، package، Docker، infra، JSON و خروجی stack-trace
- **Compression Combos** — خطوط لولهٔ نام‌گذاری‌شده مانند `rtk -> caveman` اختصاص یافته به کامبوهای مسیریابی؛ میانگین ریاضی انباشته‌شدهٔ پیش‌فرض به `~89%` و صرفه‌جویی‌های eligible-context ۷۸-۹۵٪ می‌رسد هنگامی که هر دو موتور اعمال می‌شوند
- **بازیابی خروجی خام** — pointerهای اختیاری RTK خام redactشده برای اشکال‌زدایی شکست‌های فشرده‌شده

به [راهنمای فشرده‌سازی](../compression/COMPRESSION_GUIDE.md)، [RTK Compression](../compression/RTK_COMPRESSION.md) و
[موتورهای فشرده‌سازی](../compression/COMPRESSION_ENGINES.md) مراجعه کنید.

---

## 🛡️ سخت‌سازی پروکسی _(v3.5.5+)_

اعمال جامع پیکربندی پروکسی در کل خط لولهٔ درخواست:

- **بررسی سلامت توکن** — بازنشانی OAuth پس‌زمینه اکنون پیکربندی پروکسی را به ازای اتصال تحلیل می‌کند و از شکست در محیط‌های نیازمند پروکسی جلوگیری می‌کند
- **اعتبارسنجی کلید API** — اعتبارسنجی کلید ارائه‌دهنده (`POST /api/providers/validate`) از طریق `runWithProxyContext` مسیریابی می‌شود و تنظیمات پروکسی سراسری و به‌ازای ارائه‌دهنده را رعایت می‌کند
- **رفع Dispatcher مربوط به undici** — dispatcherهای پروکسی به‌جای fetch داخلی Node از پیاده‌سازی fetch خود undici استفاده می‌کنند و خطاهای `invalid onRequestStart method` در Node.js 22 را حل می‌کنند
- **شناسایی نسخهٔ Node.js** — صفحهٔ ورود به‌طور پیش‌دستانه نسخه‌های ناسازگار Node.js (24+) را شناسایی و یک بنر هشدار با دستورالعمل استفاده از Node 22 LTS نمایش می‌دهد

---

## 📧 ماسک کردن حریم خصوصی ایمیل _(v3.5.6+)_

ایمیل‌های حساب OAuth به‌طور پیش‌فرض ماسک می‌شوند (مثلاً `di*****@g****.com`) تا از افشای تصادفی هنگام به اشتراک‌گذاری screenshot یا ضبط demo جلوگیری شود. از Settings → Appearance → Account email visibility برای آشکار یا ماسک کردن کامل ایمیل‌های حساب به‌صورت سراسری در ارائه‌دهنده‌ها، کامبوها، لاگ‌ها، سهمیه و صفحه‌های playground استفاده کنید.

---

## 👁️ toggle نمایان‌سازی مدل _(v3.5.6+)_

فهرست مدل صفحهٔ ارائه‌دهنده اکنون شامل موارد زیر است:

- **نوار جستجو/فیلتر بلادرنگ** — یافتن سریع مدل‌های خاص
- **toggle نمایان‌سازی به‌ازای مدل** (آیکن 👁) — مدل‌های پنهان خاکستری شده و از کاتالوگ `/v1/models` حذف می‌شوند
- **نشان شمارش فعال** (`N/M active`) — نشان می‌دهد چند مدل فعال در مقابل کل است

---

## 🔧 تعمیر env مربوط به OAuth _(v3.6.1+)_

اکشن یک‌کلیکی "Repair env" برای ارائه‌دهنده‌های OAuth که متغیرهای محیطی گمشده را بازیابی و وضعیت احراز هویت شکسته را تعمیر می‌کند. قابل دسترسی از `Dashboard → Providers → [OAuth Provider] → Repair env`. به‌طور خودکار موارد زیر را شناسایی و تعمیر می‌کند:

- credentialهای گمشدهٔ OAuth client
- ورودی‌های فایل env خراب
- پاک‌سازی مسیر پشتیبان

---

## 🗑️ حذف نصب / حذف نصب کامل _(v3.6.2+)_

اسکریپت‌های حذف تمیز برای همهٔ روش‌های نصب:

| دستور                     | اقدام                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `npm run uninstall`       | برنامهٔ سامانه را حذف می‌کند اما **DB و پیکربندی‌های شما را در `~/.omniroute` نگه می‌دارد**. |
| `npm run uninstall:full`  | برنامه را حذف می‌کند و دائمی **تمام پیکربندی‌ها، کلیدها و پایگاه‌های داده را پاک می‌کند**.        |

---

## 🖼️ رسانه _(v2.0.3+)_

تولید تصویر، ویدیو و موسیقی از داشبورد. پشتیبانی از OpenAI، xAI، Together، Hyperbolic، SD WebUI، ComfyUI، AnimateDiff، Stable Audio Open و MusicGen.

---

## 📝 لاگ‌های درخواست

ثبت بلادرنگ درخواست با فیلتر بر اساس ارائه‌دهنده، مدل، حساب و کلید API. نمایش کد وضعیت، استفادهٔ توکن، latency و جزئیات پاسخ.

![Usage Logs](../screenshots/08-usage.png)

---

## 🌐 نقطهٔ پایانی API

نقطهٔ پایانی API یکپارچهٔ شما با تفکیک قابلیت‌ها: Chat Completions، Responses API، Embeddings، Image Generation، Reranking، Audio Transcription، Text-to-Speech، Moderations و کلیدهای API ثبت‌شده. Cloudflare Quick Tunnel، Tailscale Funnel، ngrok Tunnel و پشتیبانی پروکسی ابری برای دسترسی راهور در دسترس است.

![Endpoint Dashboard](../screenshots/09-endpoint.png)

---

## 🔑 مدیریت کلید API

ایجاد، scopeدهی و ابطال کلیدهای API. هر کلید می‌تواند با دسترسی کامل یا فقط‌خواندنی به مدل‌های/ارائه‌دهنده‌های خاص محدود شود. مدیریت بصری کلید با پیگیری استفاده.

---

## 📋 لاگ ممیزی

پیگیری اقدامات مدیریتی با فیلتر بر اساس نوع اقدام، actor، target، آدرس IP و مهر زمانی. تاریخچهٔ کامل رویدادهای امنیتی.

---

## 🖥️ برنامهٔ دسکتاپ

برنامهٔ دسکتاپ بومی Electron برای ویندوز، macOS و لینوکس. اجرای OmniRoute به‌عنوان یک برنامهٔ مستقل با یکپارچه‌سازی system tray، پشتیبانی آفلاین، به‌روزرسانی خودکار و نصب یک‌کلیکی.

ویژگی‌های کلیدی:

- poll آمادگی سرور (بدون صفحهٔ خالی هنگام شروع سرد)
- system tray با مدیریت پورت
- Content Security Policy
- قفل single-instance
- به‌روزرسانی خودکار هنگام راه‌اندازی مجدد
- رابط کاربری مشروط به پلتفرم (چراغ‌های ترافیکی macOS، نوار عنوان پیش‌فرض ویندوز/لینوکس)
- بسته‌بندی hardened الکترون — `node_modules` symlinkشده در بستهٔ standalone شناسایی و پیش از بسته‌بندی رد می‌شود تا از وابستگی زمان اجرا به ماشین ساخت جلوگیری شود (v2.5.5+)
- **خاموش‌کردن آرام** — `before-quit` الکترون Next.js را به‌تمیزی خاموش می‌کند و از lockهای پایگاه دادهٔ WAL SQLite جلوگیری می‌کند (v3.6.2+)

📖 برای مستندات کامل به [`electron/README.md`](../../electron/README.md) مراجعه کنید.

---

## 🌐 پل WebSocket V1 _(v3.6.6+)_

OmniRoute اکنون از **کلاینت‌های WebSocket سازگار با OpenAI** از طریق نقطهٔ پایانی ارتقای `/v1/ws` پشتیبانی می‌کند. سرور `scripts/dev/v1-ws-bridge.mjs` سفارشی Next.js را wrap می‌کند و اتصالات WS را به نشست‌های streaming دوطرفهٔ کامل ارتقا می‌دهد. احراز هویت از همان کلید API یا cookie نشست به‌عنوان درخواست‌های HTTP استفاده می‌کند.

رفتارهای کلیدی:

- ارتقای WS توسط `src/lib/ws/handshake.ts` پیش از برقراری اتصال اعتبارسنجی می‌شود
- جریان‌ها هنگام بسته شدن نشست یا خطای بالادست به‌تمیزی خاتمه می‌یابند
- در کنار مسیر streaming موجود HTTP+SSE به‌طور هم‌زمان کار می‌کند

---

## 🔑 Sync Tokens & Config Bundle _(v3.6.6+)_

دسترسی چند‌دستگاهی و اپراتور خارجی اکنون از طریق **sync tokens با scope** ممکن است:

- **`POST /api/sync/tokens`** — صدور یک sync token جدید (با scope، با انقضای اختیاری)
- **`DELETE /api/sync/tokens/:id`** — ابطال یک token
- **`GET /api/sync/bundle`** — دانلود یک snapshot JSON نسخه‌بندی‌شده و ETag-keyed از تمام تنظیمات غیرحساس (گذرواژه‌ها redact می‌شوند)

config bundle توسط `src/lib/sync/bundle.ts` ساخته می‌شود. مصرف‌کنندگان هدر پاسخ `ETag` را برای شناسایی تغییرات بدون دانلود مجدد payload کامل مقایسه می‌کنند.

---

## 🧠 Preset تفکر GLM _(v3.6.6+)_

**GLM Thinking (`glmt`)** اکنون یک ارائه‌دهندهٔ first-class ثبت‌شده است: ۶۵ ۵۳۶ max output token، ۲۴ ۵۷۶ thinking budget، ۹۰۰ s timeout پیش‌فرض، قالب API سازگار با Claude و همگام‌سازی استفادهٔ مشترک با خانوادهٔ GLM.

**شمارش توکن ترکیبی** نیز در v3.6.6 وارد می‌شود: هنگامی که یک ارائه‌دهندهٔ سازگار با Claude، `/messages/count_tokens` را عرضه می‌کند، OmniRoute قبل از درخواست‌های بزرگ آن را فراخوانی می‌کند با fallback تخمین آرام.

---

## 🛡️ Safe Outbound Fetch & SSRF Guard _(v3.6.6+)_

تمام فراخوانی‌های اعتبارسنجی ارائه‌دهنده و کشف مدل اکنون از یک guard خروجی دو لایه‌ای عبور می‌کنند:

1. **URL guard** (`src/shared/network/outboundUrlGuard.ts`) — مسدودسازی بازه‌های IP خصوصی/loopback/link-local پیش از باز شدن سوکت.
2. **Safe fetch wrapper** (`src/shared/network/safeOutboundFetch.ts`) — اعمال URL guard، نرمال‌سازی timeoutها و تلاش مجدد خطاهای گذرا با backoff نمایی.

نقض guard به‌صورت HTTP 422 (`URL_GUARD_BLOCKED`) ظاهر می‌شود و در لاگ ممیزی انطباق از طریق `providerAudit.ts` نوشته می‌شود.

---

## 🔄 Retry آگاه از Cooldown _(v3.6.6+)_

درخواست‌های چت اکنون **به‌طور خودکار retry** می‌شوند هنگامی که یک ارائه‌دهندهٔ بالادست یک cooldown با scope مدل بازمی‌گرداند. قابل پیکربندی از طریق `REQUEST_RETRY` (پیش‌فرض: ۲) و `MAX_RETRY_INTERVAL_SEC` (پیش‌فرض: ۳۰ s). یادگیری هدر rate-limit در `x-ratelimit-reset-requests`، `x-ratelimit-reset-tokens` و `Retry-After` بهبود یافته است — وضعیت cooldown به‌ازای مدل در داشبورد Resilience قابل مشاهده است.

---

## 📋 ممیزی انطباق v2 _(v3.6.6+)_

لاگ ممیزی با صفحه‌بندی مبتنی بر cursor، غنی‌سازی context درخواست (request ID، user agent، IP)، رویدادهای احراز هویت ساختاریافته، رویدادهای CRUD ارائه‌دهنده با context diff و ثبت validation مسدودشدهٔ SSRF گسترش یافته است. رویدادهای جدید توسط `src/lib/compliance/providerAudit.ts` منتشر می‌شوند.
