---
title: "مرجع ارائه‌دهنده"
version: 3.8.47
lastUpdated: 2026-07-13
---

# مرجع ارائه‌دهنده

> **تولید خودکار** از `src/shared/constants/providers.ts` — دستی ویرایش نکنید.
> بازتولید با: `npm run gen:provider-reference`
> **آخرین تولید:** 2026-07-13

مجموع ارائه‌دهندگان: **۲۵۰**. تفکیک دسته‌ها را در ادامه ببینید.

## دسته‌ها

- **Free** — سطح رایگان با API key (پیکربندی از طریق داشبورد)
- **OAuth** — جریان ورود توسط RouteChi انجام می‌شود، بدون نیاز به API key
- **Web cookie** — اپ وب ارائه‌دهنده را از طریق احراز هویت cookie wrap می‌کند
- **API key** — ارائه‌دهنده پولی پیکربندی‌شده با API key (ممکن است اعتبار رایگان اعمال شود)
- **Local** — روی ماشین کاربر اجرا می‌شود (Ollama، LM Studio، vLLM و غیره)
- **Search** — ارائه‌دهندگان جستجوی وب
- **Audio** — ارائه‌دهندگان فقط-صوتی (TTS/STT)
- **Upstream proxy** — ارائه‌دهندگانی که به ارائه‌دهندگان دیگر پروکسی می‌زنند
- **Cloud agent** — agentهای کدنویسی طولانی‌مدت (Codex Cloud، Devin، Jules)
- **System** — ارائه‌دهندگان داخلی RouteChi (loopback و غیره)

برچسب‌های اضافی: `image`، `video`، `aggregator`، `enterprise`، `embed/rerank`، `self-hosted`.

از داشبورد در `/dashboard/providers` برای فعال‌سازی، پیکربندی و تست هر ارائه‌دهنده استفاده کنید.

---

## ارائه‌دهندگان OAuth (۲۲)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `agy` | `agy` | Antigravity CLI | OAuth | [link](https://antigravity.google) | ورود Antigravity CLI (`agy`) خود را import کنید (token file آن را paste/upload کنید)، یک ورود CLI محلی را به‌صورت خودکار تشخیص دهید، یا با Google وارد شوید. backend Antigravity را به اشتراک می‌گذارد (شامل مدل‌های Claude). |
| `amazon-q` | `aq` | Amazon Q | OAuth | [link](https://aws.amazon.com/q/developer/) | از همان جریان AWS Builder ID یا refresh-token import‌شده به‌عنوان Kiro استفاده می‌کند، اما اتصال‌های Amazon Q را جدا نگه می‌دارد. |
| `antigravity` | — | Antigravity | OAuth | — | — |
| `claude` | `cc` | Claude Code | OAuth | — | — |
| `cline` | `cl` | Cline | OAuth | — | — |
| `clinepass` | `cp` | ClinePass | OAuth | [link](https://cline.bot/clinepass) | ClinePass یک اشتراک $9.99/mo است که ۱۰ مدل کدنویسی باز را bundle می‌کند. با حساب Cline خود وارد شوید (همان ورود به‌عنوان CLI/IDE Cline)، یا یک API key مستقیم ClinePass را paste کنید (app.cline.bot → Settings → API Keys). یک اشتراک ClinePass مدل‌های cline-pass/* را باز می‌کند. از جریان OAuth WorkOS Cline استفاده مجدد می‌کند. |
| `codebuddy-cn` | `cbcn` | CodeBuddy CN | OAuth | [link](https://copilot.tencent.com) | Tencent CodeBuddy CN (copilot.tencent.com). از طریق جریان device-code رسمی CLI وارد شوید، یا یک API key مستقیم paste کنید (به‌صورت Authorization: Bearer ارسال می‌شود). Catalog: GLM / Kimi / MiniMax / DeepSeek / Hunyuan. |
| `codex` | `cx` | OpenAI Codex | OAuth | — | — |
| `cursor` | `cu` | Cursor IDE | OAuth | — | — |
| `devin-cli` | `dv` | Devin CLI (Official) | OAuth | [link](https://cli.devin.ai) | نیازمند binary Devin CLI است. برای احراز هویت `devin auth login` را اجرا کنید، یا WINDSURF_API_KEY خود را ارائه دهید. نصب: https://cli.devin.ai |
| `github` | `gh` | GitHub Copilot | OAuth | — | — |
| `gitlab-duo` | `gitlab-duo` | GitLab Duo | OAuth | [link](https://docs.gitlab.com/user/duo_agent_platform/code_suggestions/) | OAuth application با scopeهای ai_features + read_user. GITLAB_DUO_OAUTH_CLIENT_ID و به‌صورت اختیاری GITLAB_DUO_OAUTH_CLIENT_SECRET را روی این نمونه RouteChi پیکربندی کنید. |
| `grok-cli` | `gc` | Grok Build | OAuth | — | ~/.grok/auth.json خود را (یا JWT access token) از Grok Build CLI paste کنید؛ refresh_token به‌صورت خودکار چرخش می‌یابد. |
| `kilocode` | `kc` | Kilo Code | OAuth | — | — |
| `kimi-coding` | `kmc` | Kimi Coding | OAuth | — | — |
| `kiro` | `kr` | Kiro AI | OAuth | — | سطح رایگان: ۵۰ credits/month (~۲۵K–۱۰۰K tokens). ⚠️ ToS Kiro استفاده از پروکسی/harness شخص ثالث را ممنوع می‌کند. |
| `qoder` | `if` | Qoder | OAuth | — | — |
| `qwen` | `qw` | Qwen Code | OAuth | — | ⚠️ **DEPRECATED.** سطح رایگان OAuth Qwen در 2026-04-15 متوقف شد. به‌جای آن از ارائه‌دهنده 'bailian-coding-plan'، 'alibaba'، 'alibaba-cn' یا 'openrouter' با API key استفاده کنید. |
| `trae` | `tr` | Trae | OAuth | [link](https://trae.ai) | Trae یک IDE AI-native توسط ByteDance است (SOLO remote agent). در popup از طریق trae.ai مجوز دهید، یا در solo.trae.ai وارد شوید و Cloud-IDE-JWT را (به‌صورت 'Authorization: Cloud-IDE-JWT <token>' ارسال می‌شود، ~۱۴ روز طول عمر) به‌عنوان access token paste کنید؛ web_id/biz_user_id/user_unique_id/scope/tenant/region از طریق providerSpecificData منتقل می‌شوند. بدون refresh headless برای tokenهای paste‌شده — هنگام انقضا دوباره paste کنید. |
| `windsurf` | `ws` | Windsurf (Devin CLI) | OAuth | [link](https://windsurf.com) | در Windsurf / VS Code IDE، command palette را باز کرده و `Windsurf: Provide Auth Token` را اجرا کنید (یا روی دکمه Jupyter "Get Windsurf Authentication Token" کلیک کنید)، سپس token نمایش‌داده‌شده را کپی و اینجا paste کنید. نکته: باز کردن windsurf.com/show-auth-token مستقیماً فقط یک صفحه "Redirecting" رندر می‌کند — IDE باید جریان را آغاز کند (یک پارامتر `?state=...` اضافه می‌کند) تا token ظاهر شود. |
| `zed` | `zd` | Zed IDE | OAuth | [link](https://zed.dev) | Zed اعتبارنامه‌های ارائه‌دهنده LLM (OpenAI، Anthropic، Google، Mistral، xAI) را در keychain OS ذخیره می‌کند. از دکمه Import زیر استفاده کنید تا آن‌ها را به‌صورت خودکار کشف و import کنید. |
| `zed-hosted` | — | Zed Hosted Models | OAuth | [link](https://zed.dev) | با حساب Zed خود وارد شوید (ورود native-app). RouteChi یک keypair RSA یک‌باره تولید می‌کند و zed.dev را باز می‌کند تا آن را مجاز کند — روی یک نصب remote/headless، URL callback 127.0.0.1 حاصل را از نوار آدرس مرورگر خود کپی و اینجا paste کنید. متمایز از مدخل import اعتبارنامه 'Zed IDE' در بالا: این تکمیل‌های chat را از طریق aggregator مدل میزبانی‌شده خود Zed (cloud.zed.dev) پروکسی می‌کند، که مدل‌های Anthropic/OpenAI/Google/xAI را زیر طرح Zed شما جلوه‌گری می‌کند. |

## ارائه‌دهندگان Web Cookie (۲۵)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `adapta-web` | `adp-web` | Adapta.org (Adapta One Web) | Web cookie | [link](https://agent.adapta.one) | مقدار cookie __client خود را از .clerk.agent.adapta.one paste کنید (DevTools → Application → Cookies) |
| `blackbox-web` | `bb-web` | Blackbox Web (Subscription) | Web cookie | [link](https://app.blackbox.ai) | مقدار __Secure-authjs.session-token یا کل header cookie را از app.blackbox.ai paste کنید |
| `chatgpt-web` | `cgpt-web` | ChatGPT Web (Plus/Pro) | Web cookie | [link](https://chatgpt.com) | مقدار cookie __Secure-next-auth.session-token خود را از chatgpt.com paste کنید |
| `claude-web` | `cw` | Claude Web | Web cookie | [link](https://claude.ai) | session cookie خود را از claude.ai paste کنید |
| `copilot-m365-web` | `m365copilot` | Microsoft 365 Copilot (BizChat) | Web cookie | [link](https://m365.cloud.microsoft/chat) | در m365.cloud.microsoft/chat وارد شوید، سپس DevTools → Network → فیلتر 'WS' → اتصال WebSocket Chathub را کلیک کنید. هم پارامتر query access_token و هم بخش مسیر Chathub اختصاصی حساب را از URL درخواست آن کپی کنید (wss://…/Chathub/<path>?…&access_token=…). این یک header Authorization: Bearer روی یک درخواست XHR/Fetch نیست. token کوتاه‌مدت است؛ این یک یکپارچه‌سازی غیررسمی است. |
| `copilot-web` | `copilot` | Microsoft Copilot Web | Web cookie | [link](https://copilot.microsoft.com) | access_token خود را از copilot.microsoft.com paste کنید (یا یک فایل .har از DevTools هنگام ورود export کنید) |
| `deepseek-web` | `ds-web` | DeepSeek Web | Web cookie | [link](https://chat.deepseek.com) | userToken خود را از chat.deepseek.com paste کنید — DevTools → Application → Local Storage → userToken |
| `doubao-web` | `db` | Dola Web (ByteDance) | Web cookie | [link](https://www.dola.com) | کل header Cookie را از www.dola.com paste کنید. باید شامل sessionid، ttwid و s_v_web_id باشد. اگر s_v_web_id در دسترس نیست، fp=verify_... از یک URL درخواست chat/completion می‌تواند به‌عنوان fallback استفاده شود. |
| `gemini-business` | `gembiz` | Gemini Business (Enterprise) | Web cookie | [link](https://business.gemini.google) | از حساب enterprise خود: business.gemini.google/home/cid/{your-cid} را باز کنید، سپس cookieهای __Secure-1PSID و __Secure-1PSIDTS را از DevTools → Application → Cookies کپی کنید. به‌عنوان یک header cookie در زیر paste کنید. |
| `gemini-web` | `gweb` | Gemini Web (Free) | Web cookie | [link](https://gemini.google.com) | مقدار cookie __Secure-1PSID خود را از gemini.google.com paste کنید. به‌صورت اختیاری __Secure-1PSIDTS را با جداکننده نقطه-ویرگول اضافه کنید. |
| `grok-web` | `gw` | Grok Web (Subscription) | Web cookie | [link](https://grok.com) | کل خط cookie grok.com را از DevTools → Application → Cookies paste کنید. هم `sso` و هم `sso-rw` را شامل کنید (مثلاً `sso=...; sso-rw=...`) — anti-bot Grok `sso` را به‌تنهایی رد می‌کند. |
| `huggingchat` | `huggingchat` | HuggingChat (Free) | Web cookie | [link](https://huggingface.co/chat) | کل header Cookie را از huggingface.co/chat paste کنید (DevTools → Network → /chat/conversation → Request Headers → Cookie). باید شامل hf-chat باشد و ممکن است token / aws-waf-token را نیز شامل شود. |
| `inner-ai` | `in-ai` | Inner.ai (Subscription) | Web cookie | [link](https://app.innerai.com) | token cookie و ایمیل خود را با یک فاصله جدا شده paste کنید: DevTools → Application → Cookies → .innerai.com را باز کنید، مقدار token را کپی کنید، سپس یک فاصله و ایمیل ورود Inner.ai خود را اضافه کنید. مثال: eyJhbG... user@example.com |
| `kimi-web` | `kimi-web` | Kimi Web (Moonshot AI) | Web cookie | [link](https://www.kimi.com) | header Cookie خود را از www.kimi.com paste کنید (باید شامل kimi-auth=... باشد). آن را از طریق DevTools → Network → request → Cookie پیدا کنید. |
| `lmarena` | `lma` | Arena (Free) | Web cookie | [link](https://arena.ai) | کل header Cookie را از arena.ai paste کنید (DevTools → Network → request → Cookie). arena-auth-prod-v1.0/.1… و cf_clearance/__cf_bm را هنگام وجود شامل کنید. RouteChi از جعل TLS Chrome استفاده می‌کند؛ اگر Arena همچنان 403 داد، providerSpecificData.recaptchaV3Token را از یک session مرورگر زنده تنظیم کنید. |
| `muse-spark-web` | `ms-web` | Muse Spark Web (Meta AI) | Web cookie | [link](https://www.meta.ai) | مقدار ecto_1_sess یا کل header cookie خود را از meta.ai paste کنید |
| `perplexity-web` | `pplx-web` | Perplexity Web (Pro/Max) | Web cookie | [link](https://www.perplexity.ai) | مقدار cookie __Secure-next-auth.session-token خود را از perplexity.ai paste کنید |
| `poe-web` | `poe` | Poe Web (Subscription) | Web cookie | [link](https://poe.com) | مقدار cookie p-b خود را از poe.com paste کنید (DevTools → Application → Cookies → p-b) |
| `qwen-web` | `qwen-web` | Qwen Web (Free) | Web cookie | [link](https://chat.qwen.ai) | chat.qwen.ai را باز کنید، وارد شوید، سپس DevTools → Application → Local Storage → مقدار "token" را کپی کنید (یا از tongyi_sso_ticket cookie به‌عنوان Bearer token استفاده کنید). |
| `t3-web` | `t3chat` | t3.chat (Pro/Free) | Web cookie | [link](https://t3.chat) | t3.chat را در مرورگر باز کنید، وارد شوید، سپس DevTools → Application → Local Storage → https://t3.chat را باز کنید. مقدار 'convex-session-id' را کپی کنید. همچنین DevTools → Network را باز کنید، header Cookie را از هر درخواست کپی کنید. هر دو مقدار را اینجا paste کنید. برای راهنمای گام‌به‌گام به مستندات راه‌اندازی ارائه‌دهنده مراجعه کنید. |
| `v0-vercel-web` | `v0-vercel-web` | v0 Vercel Web (Code Gen) | Web cookie | [link](https://v0.dev) | session cookie خود را از v0.dev paste کنید (DevTools → Application → Cookies) |
| `venice-web` | `ven` | Venice Web (Privacy) | Web cookie | [link](https://venice.ai) | session cookie خود را از venice.ai paste کنید (DevTools → Application → Cookies) |
| `yuanbao-web` | `ybw` | Tencent Yuanbao (Free) | Web cookie | [link](https://yuanbao.tencent.com) | وارد yuanbao.tencent.com شوید، سپس کل header Cookie را paste کنید (DevTools → Network → هر درخواست /api → Request Headers → Cookie). باید شامل hy_user و hy_token باشد. |
| `zai-web` | `zw` | Z.ai Web (Free) | Web cookie | [link](https://chat.z.ai) | کل header Cookie را از chat.z.ai paste کنید (باید شامل cookie token=<JWT> باشد) |
| `zenmux-free` | `zmf` | ZenMux Free (Web) | Web cookie | [link](https://zenmux.ai) | در zenmux.ai وارد شوید، سپس همه cookieها را با استفاده از EditThisCookie یا Cookie-Editor export کنید و کل رشته header Cookie را اینجا paste کنید. هر ~۳۰ روز refresh کنید. |

## ارائه‌دهندگان API Key (پولی / پولی-با-اعتبار-رایگان) (۱۶۷)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `360ai` | `360ai` | 360 AI | API key | [link](https://ai.360.cn) | API key را در ai.360.cn بگیرید |
| `agentrouter` | `agentrouter` | AgentRouter | API key, aggregator | [link](https://agentrouter.org) | $200 اعتبار رایگان هنگام ثبت‌نام - gateway مسیریابی چندمدلی |
| `ai21` | `ai21` | AI21 Labs | API key | [link](https://www.ai21.com) | $10 اعتبار trial هنگام ثبت‌نام (معتبر ۳ ماه)، بدون کارت اعتباری |
| `aimlapi` | `aiml` | AI/ML API | API key, aggregator | [link](https://aimlapi.com) | سطح رایگان متوقف شد (2026) — AI/ML API اکنون فقط pay-as-you-go است (حداقل $20 top-up)؛ بدون اعتبار رایگان دوره‌ای. |
| `alibaba` | `ali` | Alibaba | API key | [link](https://bailian.console.alibabacloud.com/) | — |
| `alibaba-cn` | `ali-cn` | Alibaba (China) | API key | [link](https://dashscope.console.aliyun.com/) | — |
| `anthropic` | `anthropic` | Anthropic | API key | [link](https://platform.claude.com) | — |
| `api-airforce` | `af` | Api.airforce | API key | [link](https://api.airforce) | ۵۵ مدل سطح رایگان از جمله Grok-3، Claude 3.7، Qwen3، Kimi-K2، Gemini 2.5 Flash، DeepSeek-V3 |
| `arcee-ai` | `arcee` | Arcee AI | API key | [link](https://arcee.ai) | API key را در arcee.ai بگیرید |
| `azure-ai` | `azure-ai` | Azure AI Foundry | API key, enterprise | [link](https://learn.microsoft.com/azure/ai-foundry) | از Azure AI Foundry key خود استفاده کنید. Base URL می‌تواند https://<resource>.services.ai.azure.com/openai/v1/ یا https://<resource>.openai.azure.com/openai/v1/ باشد. |
| `azure-openai` | `azure` | Azure OpenAI | API key, enterprise | [link](https://azure.microsoft.com/products/ai-services/openai-service) | از Azure OpenAI API key خود استفاده کنید. Base URL باید endpoint resource شما باشد، مثلاً https://my-resource.openai.azure.com. |
| `bai` | `bai` | b.ai | API key | [link](https://b.ai) | Bearer API key برای gateway LLM سازگار با OpenAI در b.ai (متمایز از TheB.AI). یک key در https://docs.b.ai بسازید، سپس https://api.b.ai/v1 را به‌عنوان base URL سازگار با OpenAI استفاده کنید. |
| `baichuan` | `baichuan` | Baichuan | API key | [link](https://baichuan.com) | API key را در platform.baichuan-ai.com بگیرید |
| `baidu` | `baidu` | Baidu (ERNIE) | API key | [link](https://yiyan.baidu.com) | API key را در console.bce.baidu.com بگیرید |
| `bailian-coding-plan` | `bcp` | Alibaba Coding Plan | API key | [link](https://www.alibabacloud.com/help/en/model-studio/coding-plan) | — |
| `baseten` | `baseten` | Baseten | API key | [link](https://baseten.co) | $30 اعتبار trial رایگان برای GPU inference |
| `bazaarlink` | `bzl` | BazaarLink | API key | [link](https://bazaarlink.ai) | از BazaarLink API key خود (با sk-bl- شروع می‌شود) در Authorization: Bearer <key> استفاده کنید. OpenAI SDK با base URL https://bazaarlink.ai/api/v1 کار می‌کند. مدل‌ها از فرمت provider/model-name استفاده می‌کنند. |
| `bedrock` | `bedrock` | Amazon Bedrock | API key, enterprise | [link](https://aws.amazon.com/bedrock) | از Amazon Bedrock API key خود استفاده کنید و AWS region که مدل‌هایتان فعال هستند را پیکربندی کنید (مثلاً eu-west-2). RouteChi مستقیماً Converse API بومی Bedrock را صدا می‌زند. |
| `black-forest-labs` | `bfl` | Black Forest Labs | API key, image | [link](https://blackforestlabs.ai) | — |
| `blackbox` | `bb` | Blackbox AI | API key | [link](https://blackbox.ai) | سطح رایگان: chat basic نامحدود به‌علاوه Minimax-M2.5، بدون کارت اعتباری |
| `bluesminds` | `bm` | BluesMinds | API key | [link](https://www.bluesminds.com) | اعتبار pi روزانه رایگان — از ۲۰۰+ مدل از جمله GPT-4o، GPT-4.1، Claude Sonnet 4.5، Gemini 2.0 Flash، DeepSeek V4، Qwen، Kimi K2 پشتیبانی می‌کند |
| `byteplus` | `bpm` | BytePlus ModelArk | API key | [link](https://console.byteplus.com/ark) | — |
| `bytez` | `bytez` | Bytez | API key | [link](https://bytez.com) | $1 اعتبار رایگان، هر ۴ هفته refresh می‌شود |
| `cerebras` | `cerebras` | Cerebras | API key | [link](https://inference.cerebras.ai) | Free Trial: 1M tokens/day، 30K TPM، 5 RPM — بدون کارت اعتباری. |
| `charm-hyper` | `charm-hyper` | Charm Hyper | API key | [link](https://hyper.charm.land) | ۱۰۰ Hypercredit ماهانه رایگان هنگام ثبت‌نام |
| `chutes` | `chutes` | Chutes.ai | API key, aggregator | [link](https://chutes.ai) | Bearer API key برای gateway سازگار با OpenAI در Chutes. |
| `clarifai` | `clarifai` | Clarifai | API key, enterprise | [link](https://docs.clarifai.com) | از Clarifai PAT یا API key اختصاصی اپ خود استفاده کنید. RouteChi endpoint سازگار با OpenAI در https://api.clarifai.com/v2/ext/openai/v1 را هدف می‌گیرد و با Authorization: Key <token> احراز هویت می‌کند. |
| `cloudflare-ai` | `cf` | Cloudflare Workers AI | API key | [link](https://developers.cloudflare.com/workers-ai) | نیازمند API Token و Account ID (در dash.cloudflare.com یافت می‌شود) |
| `codestral` | `codestral` | Codestral | API key | [link](https://mistral.ai) | — |
| `cohere` | `cohere` | Cohere | API key | [link](https://cohere.com) | Free Trial: ۱,۰۰۰ API calls/month برای تست، بدون کارت اعتباری |
| `command-code` | `cmd` | Command Code | API key | [link](https://commandcode.ai/) | از یک Command Code API key استفاده کنید. درخواست‌ها به endpoint /alpha/generate در Command Code ارسال می‌شوند. |
| `coze` | `coze` | Coze | API key | [link](https://coze.com) | API key را در coze.com/open/api بگیرید |
| `crof` | `crof` | CrofAI | API key | [link](https://crof.ai) | — |
| `databricks` | `databricks` | Databricks | API key, enterprise | [link](https://www.databricks.com) | — |
| `datarobot` | `datarobot` | DataRobot | API key, enterprise | [link](https://docs.datarobot.com) | از API token DataRobot خود استفاده کنید. Base URL اختیاری می‌تواند root حساب (برای LLM Gateway) یا یک URL استقرار تحت /api/v2/deployments/<id> باشد. |
| `deepinfra` | `deepinfra` | DeepInfra | API key | [link](https://deepinfra.com) | اعتبار ثبت‌نام رایگان برای تست API و کاوش مدل |
| `deepseek` | `ds` | DeepSeek | API key | [link](https://platform.deepseek.com) | 5M توکن رایگان هنگام ثبت‌نام - بدون کارت اعتباری |
| `dgrid` | `dgrid` | DGrid | API key | [link](https://dgrid.ai) | DGrid Free Models Router: ۱۰ requests/minute و ۱۰۰ requests/day. یک top-up مادام‌العمر $5 تا ۲۰ requests/minute و ۱,۰۰۰ requests/day را باز می‌کند. |
| `dify` | `dify` | Dify | API key | [link](https://dify.ai) | API key را از نمونه Dify خود بگیرید. |
| `digitalocean` | `digitalocean` | DigitalOcean | API key | [link](https://docs.digitalocean.com/products/ai-platform/) | — |
| `dit` | `dai` | DIT.ai | API key | [link](https://dit.ai) | از dit.ai API key خود در Authorization: Bearer <key> استفاده کنید. کاملاً سازگار با OpenAI — یک جایگزین drop-in، فقط base URL را به https://api.dit.ai/v1 تغییر دهید. |
| `doubao` | `doubao` | Doubao | API key | [link](https://doubao.com) | API key را در console.volcengine.com بگیرید |
| `empower` | `empower` | Empower | API key, aggregator | [link](https://docs.empower.dev) | Bearer API key برای endpoint سازگار با OpenAI در Empower. |
| `factory` | `factory` | Factory | API key | [link](https://factory.ai) | Bearer API key برای gateway سازگار با OpenAI در Factory. |
| `fal-ai` | `fal` | Fal.ai | API key, image | [link](https://fal.ai) | — |
| `featherless-ai` | `featherless` | Featherless AI | API key | [link](https://featherless.ai) | سطح رایگان موجود — بدون کارت اعتباری |
| `fenayai` | `fenayai` | FenayAI | API key, aggregator | [link](https://fenayai.com) | Bearer API key برای gateway سازگار با OpenAI در FenayAI. |
| `firecrawl` | `fc` | Firecrawl | API key | [link](https://firecrawl.dev) | — |
| `fireworks` | `fireworks` | Fireworks AI | API key | [link](https://fireworks.ai) | $1 اعطار starter رایگان هنگام ثبت‌نام برای تست API |
| `freeaiapikey` | `faik` | FreeAIAPIKey | API key | [link](https://freeaiapikey.com) | — |
| `freemodel-dev` | `fmd` | FreeModel.dev | API key | [link](https://freemodel.dev) | $300 اعتبار رایگان هنگام ثبت‌نام — بدون کارت اعتباری. دسترسی به GPT-5.4 و GPT-5.5 (جدیدترین مدل‌های پرچمدار OpenAI) از طریق یک API سازگار با OpenAI. |
| `friendliai` | `friendli` | FriendliAI | API key | [link](https://friendli.ai) | سطح رایگان برای serverless inference — بدون کارت اعتباری |
| `galadriel` | `galadriel` | Galadriel | API key | [link](https://galadriel.com) | ⚠️ **DEPRECATED.** api.galadriel.ai دیگر resolve نمی‌شود (sweep 2026-06-19)؛ به‌نظر می‌رسد API inference متوقف شده است. |
| `gemini` | `gemini` | Gemini (Google AI Studio) | API key | [link](https://aistudio.google.com) | Free forever: ۱,۵۰۰ req/day برای Gemini 2.5 Flash — بدون کارت اعتباری، کلید را در aistudio.google.com بگیرید |
| `getgoapi` | `ggo` | GoAPI | API key, aggregator | [link](https://api.getgoapi.com) | — |
| `gigachat` | `gigachat` | GigaChat (Sber) | API key | [link](https://developers.sber.ru) | — |
| `github-models` | `ghm` | GitHub Models | API key | [link](https://github.com/marketplace/models) | یک GitHub PAT با scope 'models: read' در github.com/settings/tokens بسازید |
| `gitlab` | `gitlab` | GitLab Duo PAT | API key | [link](https://docs.gitlab.com/user/duo_agent_platform/code_suggestions/) | GitLab personal access token برای Code Suggestions API عمومی. هنگام عدم استفاده از gitlab.com یک base URL خود‌میزبان پیکربندی کنید. |
| `gitlawb` | `glb` | Gitlawb Opengateway (MiMo) | API key | [link](https://opengateway.gitlawb.com) | MiMo رایگان (xiaomi/mimo-v2.5) در 2026-05 باطل شد — Opengateway اکنون یک gateway اعتباری pay-as-you-go است؛ هیچ مدل رایگان دوره‌ای ندارد. |
| `gitlawb-gmi` | `glb-gmi` | Gitlawb Opengateway (GMI Cloud) | API key | [link](https://opengateway.gitlawb.com) | promo Nemotron رایگان در 2026-06 پایان یافت — مسیر GMI Cloud اکنون فقط اعتبار pay-as-you-go است. |
| `glm` | `glm` | GLM Coding | API key | [link](https://z.ai/subscribe) | — |
| `glm-cn` | `glmcn` | GLM Coding (China) | API key | [link](https://open.bigmodel.cn) | — |
| `glmt` | `glmt` | GLM Thinking | API key | [link](https://open.bigmodel.cn) | — |
| `groq` | `groq` | Groq | API key | [link](https://groq.com) | سطح رایگان: ۳۰ RPM / 14.4K RPD — بدون کارت اعتباری |
| `hackclub` | `hc` | Hackclub AI | API key, aggregator | [link](https://ai.hackclub.com) | با حساب Hack Club خود در ai.hackclub.com وارد شوید. |
| `haiper` | `hp` | Haiper | API key, video | [link](https://haiper.ai) | API key را در haiper.ai/haiper-api بگیرید |
| `hcnsec` | `hcnsec` | Huancheng Public API | API key | [link](https://api.hcnsec.cn) | API key را در api.hcnsec.cn بگیرید |
| `heroku` | `heroku` | Heroku AI | API key, enterprise | [link](https://www.heroku.com) | — |
| `huggingface` | `hf` | HuggingFace | API key | [link](https://huggingface.co) | Free Inference API برای هزاران مدل (Whisper، VITS، SDXL…) |
| `hyperbolic` | `hyp` | Hyperbolic | API key | [link](https://hyperbolic.xyz) | $1-5 اعتبار trial هنگام ثبت‌نام برای serverless inference |
| `ideogram` | `ideo` | Ideogram | API key | [link](https://ideogram.ai) | API key را در ideogram.ai/docs/api بگیرید |
| `iflytek` | `iflytek` | iFlytek Spark | API key | [link](https://xinghuo.xfyun.cn) | API key را در console.xfyun.cn بگیرید |
| `inference-net` | `inet` | Inference.net | API key | [link](https://inference.net) | $25 اعتبار رایگان هنگام ثبت‌نام به‌علاوه research grant موجود |
| `jina-ai` | `jina` | Jina AI | API key, embed/rerank | [link](https://jina.ai) | Bearer API key برای Jina AI rerank API. |
| `jina-reader` | `jr` | Jina Reader | API key | [link](https://jina.ai/reader) | — |
| `kenari` | `kenari` | Kenari | API key | [link](https://kenari.id) | از Kenari API key خود (kn-...) در Authorization: Bearer <key> استفاده کنید. کاملاً سازگار با OpenAI. API base URL: https://kenari.id/v1. |
| `kie` | `kie` | KIE.AI | API key | [link](https://kie.ai) | — |
| `kilo-gateway` | `kg` | Kilo Gateway | API key, aggregator | [link](https://kilo.ai) | — |
| `kimi` | `kimi` | Kimi | API key | [link](https://platform.moonshot.ai) | — |
| `kimi-coding-apikey` | `kmca` | Kimi Coding (API Key) | API key | [link](https://www.kimi.com/code) | — |
| `lambda-ai` | `lambda` | Lambda AI | API key | [link](https://lambda.ai) | — |
| `laozhang` | `lz` | LaoZhang AI | API key, aggregator | [link](https://api.laozhang.ai) | — |
| `leonardo` | `leo` | Leonardo AI | API key, video | [link](https://leonardo.ai) | API key را در leonardo.ai/developer بگیرید |
| `liquid` | `liquid` | Liquid AI | API key | [link](https://liquid.ai) | API key را در liquid.ai بگیرید |
| `llamagate` | `llamagate` | LlamaGate | API key | [link](https://llamagate.ai) | — |
| `llm7` | `llm7` | LLM7.io | API key | [link](https://llm7.io) | بدون ثبت‌نام - ۲ req/s، ۲۰ RPM، ۱۰۰ req/hr سطح رایگان |
| `longcat` | `lc` | LongCat AI | API key | [link](https://longcat.chat/platform/docs) | رایگان: اعطای یک‌باره 10M-token پس از ثبت‌نام حساب + تأیید KYC (LongCat-2.0). فقط یک‌باره — نه یک allowance روزانه/ماهانه دوره‌ای. |
| `maritalk` | `maritalk` | Maritalk | API key | [link](https://www.maritaca.ai) | — |
| `meta-llama` | `meta` | Meta Llama API | API key | [link](https://llama.developer.meta.com) | — |
| `minimax` | `minimax` | Minimax Coding | API key, video | [link](https://www.minimax.io) | — |
| `minimax-cn` | `minimax-cn` | Minimax (China) | API key | [link](https://www.minimaxi.com) | — |
| `mistral` | `mistral` | Mistral | API key | [link](https://mistral.ai) | Free Experiment tier: دسترسی محدود‌نرخ به همه مدل‌ها، بدون کارت اعتباری |
| `modal` | `mdl` | Modal | API key, enterprise | [link](https://modal.com/docs) | از bearer token که استقرار Modal شما را محافظت می‌کند استفاده کنید، در صورت فعال بودن. Base URL باید به اپ سازگار با OpenAI Modal شما اشاره کند، مثلاً https://<workspace>--<app>.modal.run/v1. |
| `modelscope` | `ms` | ModelScope | API key | [link](https://modelscope.cn) | سطح رایگان از طریق ModelScope API-Inference — نیازمند حساب Alibaba. |
| `monsterapi` | `monster` | MonsterAPI | API key | [link](https://monsterapi.ai) | API key را در monsterapi.ai بگیرید |
| `moonshot` | `moonshot` | Moonshot AI | API key | [link](https://platform.moonshot.ai) | — |
| `morph` | `morph` | Morph | API key | [link](https://morphllm.com) | سطح رایگان: 250K credits/month، $0 |
| `nanogpt` | `nanogpt` | NanoGPT | API key | [link](https://nano-gpt.com) | — |
| `nebius` | `nebius` | Nebius AI | API key | [link](https://nebius.com) | ~$1 اعتبار trial هنگام ثبت‌نام برای تست API |
| `nlpcloud` | `nlpc` | NLP Cloud | API key | [link](https://docs.nlpcloud.com) | از NLP Cloud API key خود در Authorization: Token <key> استفاده کنید. RouteChi به‌طور پیش‌فرض endpoint chatbot روی https://api.nlpcloud.io/v1/gpu/<model>/chatbot را هدف می‌گیرد. |
| `nomic` | `nomic` | Nomic | API key | [link](https://nomic.ai) | API key را در atlas.nomic.ai بگیرید |
| `nous-research` | `nous` | Nous Research | API key | [link](https://portal.nousresearch.com/help) | از Nous Portal API key خود استفاده کنید. RouteChi endpoint رسمی inference سازگار با OpenAI در https://inference-api.nousresearch.com/v1 را هدف می‌گیرد. |
| `novita` | `novita` | Novita AI | API key, aggregator | [link](https://novita.ai) | $0.50 اعتبار trial هنگام ثبت‌نام (معتبر حدود ۱ سال) |
| `nscale` | `nscale` | nScale | API key | [link](https://nscale.com) | $5 اعتبار رایگان هنگام ثبت‌نام برای تست inference |
| `nube` | `nube` | Nube.sh | API key | [link](https://nube.sh) | — |
| `nvidia` | `nvidia` | NVIDIA NIM | API key | [link](https://build.nvidia.com) | دسترسی dev رایگان: ~40 RPM، 70+ مدل (Kimi K2.5، GLM 4.7، DeepSeek V3.2...) |
| `oci` | `oci` | OCI Generative AI | API key, enterprise | [link](https://www.oracle.com/artificial-intelligence/generative-ai) | از OCI Generative AI API key یا IAM bearer token خود استفاده کنید. Base URL می‌تواند https://inference.generativeai.<region>.oci.oraclecloud.com/openai/v1/ باشد. |
| `ollama-cloud` | `ollamacloud` | Ollama Cloud | API key | [link](https://ollama.com/settings/keys) | — |
| `openadapter` | `oad` | OpenAdapter | API key | [link](https://openadapter.dev) | از OpenAdapter API key خود در Authorization: Bearer sk-cv-<key> استفاده کنید. کاملاً سازگار با OpenAI. API base URL: https://api.openadapter.in/v1. |
| `openai` | `openai` | OpenAI | API key | [link](https://platform.openai.com) | — |
| `opencode-go` | `opencode-go` | OpenCode Go | API key | [link](https://opencode.ai/go) | — |
| `opencode-zen` | `opencode-zen` | OpenCode Zen | API key | [link](https://opencode.ai/zen) | — |
| `openrouter` | `openrouter` | OpenRouter | API key, aggregator | [link](https://openrouter.ai) | مدل‌های رایگان با $0/token با پسوند :free - ۲۰ RPM / ۲۰۰ RPD |
| `openvecta` | `openvecta` | OpenVecta | API key | [link](https://openvecta.com) | اعتبار رایگان هنگام ثبت‌نام برای inference سازگار با OpenAI در LLMها، embeddingها و مدل‌های reasoning |
| `orcarouter` | `orcarouter` | OrcaRouter | API key | [link](https://www.orcarouter.ai) | — |
| `ovhcloud` | `ovh` | OVHcloud AI | API key | [link](https://www.ovhcloud.com) | — |
| `perplexity` | `pplx` | Perplexity | API key | [link](https://www.perplexity.ai) | — |
| `piapi` | `pi` | PiAPI | API key, aggregator | [link](https://piapi.ai) | — |
| `pioneer` | `pn` | Pioneer AI | API key | [link](https://pioneer.ai) | $75 اعتبار استفاده رایگان — بدون کارت اعتباری |
| `poe` | `poe` | Poe | API key, aggregator | [link](https://creator.poe.com/api-reference) | Bearer API key برای API سازگار با OpenAI در Poe. |
| `pollinations` | `pol` | Pollinations AI | API key, video | [link](https://pollinations.ai) | سطح keyless رایگان: openai، openai-fast، openai-large، qwen-coder، mistral، deepseek، grok، gemini-flash-lite-3.1، perplexity-fast، perplexity-reasoning. مدل‌های Premium (claude، gemini، midijourney) نیازمند یک Pollinations API key از enter.pollinations.ai هستند. |
| `predibase` | `predibase` | Predibase | API key | [link](https://predibase.com) | ⚠️ **DEPRECATED.** serving.app.predibase.com دیگر resolve نمی‌شود (sweep 2026-06-19)؛ به‌نظر می‌رسد managed serving API متوقف شده است. |
| `publicai` | `publicai` | PublicAI | API key | [link](https://publicai.co) | نیازمند API key — اعتبار ثبت‌نام یک‌باره، سپس پولی |
| `puter` | `pu` | Puter AI | API key | [link](https://puter.com) | token را در puter.com/dashboard → Copy Auth Token بگیرید |
| `qianfan` | `qianfan` | Baidu Qianfan | API key | [link](https://cloud.baidu.com/product/wenxinworkshop) | — |
| `qiniu` | `qiniu` | Qiniu | API key | [link](https://www.qiniu.com) | — |
| `recraft` | `recraft` | Recraft | API key, image | [link](https://recraft.ai) | — |
| `reka` | `reka` | Reka | API key | [link](https://docs.reka.ai/chat/overview) | از Reka API key خود استفاده کنید. RouteChi از base URL سازگار با OpenAI https://api.reka.ai/v1 پشتیبانی می‌کند و هم headerهای Authorization و هم X-Api-Key را برای سازگاری ارسال می‌کند. |
| `requesty` | `requesty` | Requesty | API key | [link](https://requesty.ai) | سطح رایگان ~۲۰۰ requests/day - gateway مسیریابی چندمدلی (۳۰۰+ مدل) |
| `runwayml` | `runway` | Runway | API key, video | [link](https://docs.dev.runwayml.com) | از Runway API key خود در Authorization: Bearer <key> استفاده کنید. RouteChi API فعلی Runway را در https://api.dev.runwayml.com/v1 هدف می‌گیرد و header مورد نیاز X-Runway-Version را به‌صورت خودکار ارسال می‌کند. |
| `sambanova` | `samba` | SambaNova | API key | [link](https://sambanova.ai) | $5 اعتبار رایگان هنگام ثبت‌نام (اعتبار ۳۰ روزه)، بدون کارت اعتباری |
| `sap` | `sap` | SAP Generative AI Hub | API key, enterprise | [link](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/generative-ai-hub-in-sap-ai-core) | از SAP AI Core bearer token خود استفاده کنید. Base URL می‌تواند root AI_API_URL شما یا یک deploymentUrl از Generative AI Hub باشد. |
| `scaleway` | `scw` | Scaleway AI | API key | [link](https://www.scaleway.com/en/docs/ai-data/generative-apis/) | 1M توکن رایگان برای حساب‌های جدید — سازگار با EU/GDPR (پاریس)، Qwen3 235B & Llama 70B |
| `sensenova` | `sensenova` | SenseNova | API key | [link](https://platform.sensenova.cn) | API key را در platform.sensenova.cn بگیرید |
| `siliconflow` | `siliconflow` | SiliconFlow | API key | [link](https://cloud.siliconflow.com) | $1 اعتبار رایگان به‌علاوه مدل‌های رایگان دائمی پس از تأیید هویت |
| `snowflake` | `snowflake` | Snowflake Cortex | API key, enterprise | [link](https://www.snowflake.com) | — |
| `sparkdesk` | `sparkdesk` | SparkDesk | API key | [link](https://xinghuo.xfyun.cn) | API key را در console.xfyun.cn بگیرید |
| `stability-ai` | `stability` | Stability AI | API key, image | [link](https://stability.ai) | — |
| `stepfun` | `stepfun` | StepFun | API key | [link](https://stepfun.com) | API key را در platform.stepfun.com بگیرید |
| `sumopod` | `sumopod` | SumoPod | API key | [link](https://ai.sumopod.com) | از SumoPod API key خود (sk-...) در Authorization: Bearer <key> استفاده کنید. کاملاً سازگار با OpenAI. API base URL: https://ai.sumopod.com/v1. |
| `suno` | `suno` | Suno | API key | [link](https://suno.ai) | session cookie را از suno.ai paste کنید (Clerk auth) |
| `synthetic` | `synthetic` | Synthetic | API key, aggregator | [link](https://synthetic.new) | — |
| `tencent` | `tencent` | Tencent Hunyuan | API key | [link](https://hunyuan.tencent.com) | API key را در console.cloud.tencent.com بگیرید |
| `thebai` | `thebai` | TheB.AI | API key, aggregator | [link](https://theb.ai) | Bearer API key برای gateway سازگار با OpenAI در TheB.AI. |
| `tinyfish` | `tf` | TinyFish Fetch | API key | [link](https://docs.tinyfish.ai/fetch-api) | X-API-Key از agent.tinyfish.ai/api-keys |
| `together` | `together` | Together AI | API key, video | [link](https://www.together.ai) | — |
| `tokenrouter` | `trk` | TokenRouter | API key | [link](https://tokenrouter.com) | از TokenRouter API key خود در Authorization: Bearer <key> استفاده کنید. کاملاً سازگار با OpenAI. API base URL: https://api.tokenrouter.com/v1. |
| `topaz` | `topaz` | Topaz | API key, image | [link](https://topazlabs.com) | — |
| `udio` | `udio` | Udio | API key | [link](https://udio.com) | session cookie را از udio.com paste کنید (Supabase auth) |
| `uncloseai` | `unc` | UncloseAI | API key | [link](https://uncloseai.com) | بدون نیاز به auth. API هر رشته غیرخالی را به‌عنوان key برای شناسایی می‌پذیرد. |
| `upstage` | `upstage` | Upstage | API key | [link](https://www.upstage.ai) | — |
| `v0-vercel` | `v0` | v0 (Vercel) | API key | [link](https://v0.dev) | — |
| `venice` | `venice` | Venice.ai | API key | [link](https://venice.ai) | — |
| `vercel-ai-gateway` | `vag` | Vercel AI Gateway | API key, aggregator | [link](https://vercel.com/docs/ai-gateway) | — |
| `vertex` | `vertex` | Vertex AI | API key, enterprise | [link](https://cloud.google.com/vertex-ai) | Service Account JSON یا OAuth access_token ارائه دهید |
| `vertex-partner` | `vp` | Vertex AI Partners | API key, enterprise | [link](https://cloud.google.com/vertex-ai) | همان Service Account JSON استفاده‌شده برای مدل‌های partner Vertex AI را ارائه دهید. |
| `volcengine` | `volcengine` | Volcengine | API key | [link](https://www.volcengine.com) | — |
| `voyage-ai` | `voyage` | Voyage AI | API key, embed/rerank | [link](https://www.voyageai.com) | Bearer API key برای APIهای embeddings و rerank Voyage AI. |
| `wafer` | `wafer` | Wafer AI | API key | [link](https://wafer.ai) | — |
| `wandb` | `wandb` | Weights & Biases Inference | API key | [link](https://wandb.ai) | — |
| `watsonx` | `watsonx` | IBM watsonx.ai Gateway | API key, enterprise | [link](https://www.ibm.com/products/watsonx-ai) | از watsonx bearer token خود استفاده کنید. Base URL می‌تواند https://<region>.ml.cloud.ibm.com/ml/gateway/v1/ یا یک endpoint self-managed /ml/gateway/v1 باشد. |
| `x5lab` | `x5lab` | X5Lab | API key | [link](https://x5lab.dev) | از X5Lab API key خود (x5-...) در Authorization: Bearer <key> استفاده کنید. کاملاً سازگار با OpenAI. API base URL: https://api.x5lab.dev/v1. |
| `xai` | `xai` | xAI (Grok) | API key | [link](https://x.ai) | — |
| `xiaomi-mimo` | `mimo` | Xiaomi MiMo | API key | [link](https://mimo.mi.com) | — |
| `yi` | `yi` | Yi (01.AI) | API key | [link](https://01.ai) | API key را در platform.lingyiwanwu.com بگیرید |
| `zai` | `zai` | Z.AI | API key | [link](https://open.bigmodel.cn) | — |
| `zenmux` | `zm` | ZenMux | API key | [link](https://zenmux.ai) | از ZenMux API key خود در Authorization: Bearer <key> استفاده کنید. ZenMux کاملاً سازگار با OpenAI است. Base URL: https://zenmux.ai/api/v1. |

## ارائه‌دهندگان محلی (۱۲)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `comfyui` | `comfyui` | ComfyUI | Local | [link](https://github.com/comfyanonymous/ComfyUI) | بدون نیاز به API key. base URL محلی ComfyUI را پیکربندی کنید (پیش‌فرض: http://localhost:8188). |
| `docker-model-runner` | `dmr` | Docker Model Runner | Local, self-hosted | [link](https://docs.docker.com/ai/model-runner/) | API key اختیاری. base URL محلی Docker Model Runner سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://localhost:12434/v1). |
| `lemonade` | `lemonade` | Lemonade Server | Local, self-hosted | [link](https://lemonade-server.ai) | API key اختیاری. base URL محلی Lemonade سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://localhost:13305/api/v1). |
| `llama-cpp` | `llamacpp` | llama.cpp | Local, self-hosted | [link](https://github.com/ggml-org/llama.cpp) | API key اختیاری (هر مقداری استفاده کنید، مثلاً sk-no-key-required). base URL llama-server سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://127.0.0.1:8080/v1). نکته: اگر Llamafile نیز نصب است، هر دو به‌طور پیش‌فرض روی پورت ۸۰۸۰ هستند — فقط یکی را در هر زمان اجرا کنید یا پورت را override کنید. |
| `llamafile` | `llamafile` | Llamafile | Local, self-hosted | [link](https://github.com/Mozilla-Ocho/llamafile) | API key اختیاری. base URL محلی Llamafile سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://127.0.0.1:8080/v1). |
| `lm-studio` | `lmstudio` | LM Studio | Local, self-hosted | [link](https://lmstudio.ai) | API key اختیاری. base URL محلی LM Studio سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://localhost:1234/v1). |
| `ollama-local` | `ollama` | Ollama | Local, self-hosted | [link](https://ollama.com) | بدون نیاز به API key. Ollama به‌صورت محلی اجرا می‌شود — base URL سازگار با OpenAI آن را پیکربندی کنید (پیش‌فرض: http://localhost:11434/v1) و مطمئن شوید Ollama پیش از اتصال در حال اجرا است. |
| `oobabooga` | `ooba` | oobabooga | Local, self-hosted | [link](https://github.com/oobabooga/text-generation-webui) | API key اختیاری. base URL محلی oobabooga سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://localhost:5000/v1). |
| `sdwebui` | `sdwebui` | SD WebUI | Local | [link](https://github.com/AUTOMATIC1111/stable-diffusion-webui) | بدون نیاز به API key. base URL محلی WebUI را پیکربندی کنید (پیش‌فرض: http://localhost:7860). |
| `triton` | `triton` | NVIDIA Triton | Local, self-hosted | [link](https://developer.nvidia.com/triton-inference-server) | API key اختیاری. base URL Triton سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://localhost:8000/v1). |
| `vllm` | `vllm` | vLLM | Local, self-hosted | [link](https://github.com/vllm-project/vllm) | API key اختیاری. base URL محلی vLLM سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://localhost:8000/v1). |
| `xinference` | `xinference` | XInference | Local, self-hosted | [link](https://inference.readthedocs.io) | API key اختیاری. base URL محلی XInference سازگار با OpenAI را پیکربندی کنید (پیش‌فرض: http://localhost:9997/v1). |

## ارائه‌دهندگان جستجو (۱۱)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `brave-search` | `brave-search` | Brave Search | Search | [link](https://brave.com/search/api) | token اشتراک از داشبورد Brave Search API |
| `exa-search` | `exa-search` | Exa Search | Search | [link](https://exa.ai) | API key از dashboard.exa.ai |
| `google-pse-search` | `google-pse` | Google Programmable Search | Search | [link](https://developers.google.com/custom-search/v1/overview) | نیازمند یک Google API key و Programmable Search Engine ID شما (cx) |
| `linkup-search` | `linkup` | Linkup Search | Search | [link](https://docs.linkup.so) | Bearer API key از داشبورد Linkup |
| `ollama-search` | `ollama-search` | Ollama Search | Search | [link](https://ollama.com/settings/keys) | همان API key به‌عنوان Ollama Cloud (از ollama.com/settings/keys) |
| `perplexity-search` | `pplx-search` | Perplexity Search | Search | [link](https://docs.perplexity.ai/guides/search-quickstart) | همان API key به‌عنوان Perplexity (pplx-...) |
| `searchapi-search` | `searchapi` | SearchAPI | Search | [link](https://www.searchapi.io/docs/google) | API key از SearchAPI (query param یا Bearer auth) |
| `searxng-search` | `searxng` | SearXNG Search | Search | [link](https://docs.searxng.org) | API key اختیاری است. base URL SearXNG خود را تنظیم کنید. برخی نمونه‌ها ممکن است نیازمند bearer token برای دسترسی باشند. |
| `serper-search` | `serper-search` | Serper Search | Search | [link](https://serper.dev) | API key از داشبورد serper.dev |
| `tavily-search` | `tavily-search` | Tavily Search | Search | [link](https://tavily.com) | API key از app.tavily.com (فرمت: tvly-...) |
| `youcom-search` | `youcom-search` | You.com Search | Search | [link](https://you.com/business/api/) | X-API-Key از داشبورد پلتفرم You.com |

## ارائه‌دهندگان فقط-صوتی (۷)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `assemblyai` | `aai` | AssemblyAI | Audio | [link](https://assemblyai.com) | — |
| `aws-polly` | `polly` | AWS Polly | Audio | [link](https://aws.amazon.com/polly/) | از AWS Secret Access Key به‌عنوان API key استفاده کنید؛ providerSpecificData.accessKeyId و region اختیاری را تنظیم کنید. |
| `cartesia` | `cartesia` | Cartesia | Audio | [link](https://cartesia.ai) | — |
| `deepgram` | `dg` | Deepgram | Audio | [link](https://deepgram.com) | — |
| `elevenlabs` | `el` | ElevenLabs | Audio | [link](https://elevenlabs.io) | — |
| `inworld` | `inworld` | Inworld | Audio | [link](https://inworld.ai) | — |
| `playht` | `playht` | PlayHT | Audio | [link](https://play.ht) | — |

## ارائه‌دهندگان Upstream Proxy (۲)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `9router` | `nr` | 9router | Upstream proxy | [link](https://www.npmjs.com/package/9router) | — |
| `cliproxyapi` | `cpa` | CLIProxyAPI | Upstream proxy | [link](https://github.com/router-for-me/CLIProxyAPI) | — |

## ارائه‌دهندگان Cloud Agent (۳)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `codex-cloud` | `codex-cloud` | Codex Cloud | Cloud agent | [link](https://openai.com/codex) | OpenAI API key با دسترسی task Codex Cloud. |
| `devin` | `devin` | Devin | Cloud agent | [link](https://devin.ai) | Devin API key برای sessionهای cloud agent. |
| `jules` | `jules` | Google Jules | Cloud agent | [link](https://jules.google) | Jules API key برای ایجاد و مدیریت taskهای کدنویسی cloud. |

## ارائه‌دهندگان سیستم (۱)

| ID | Alias | Name | Tags | Website | Notes |
|----|-------|------|------|---------|-------|
| `auto` | `auto` | Auto (Zero-Config) | System | — | — |

## منابع حقیقت

- Catalog: [`src/shared/constants/providers.ts`](../../src/shared/constants/providers.ts)
- Registry (جزئیات به‌ازای مدل): [`open-sse/config/providerRegistry.ts`](../../open-sse/config/providerRegistry.ts)
- Executorها: [`open-sse/executors/`](../../open-sse/executors/) (۳۱ فایل)
- Translatorها: [`open-sse/translator/`](../../open-sse/translator/)

## همچنین ببینید

- [FREE_TIERS.md](./FREE_TIERS.md) — راهنمای curated سطح رایگان
- [USER_GUIDE.md](../guides/USER_GUIDE.md) — راهنمای گام‌به‌گام راه‌اندازی ارائه‌دهنده
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — معماری کلی
