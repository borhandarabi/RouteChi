---
title: "راهنمای راه‌اندازی AgentRouter"
version: 3.8.40
lastUpdated: 2026-06-28
---

# راهنمای راه‌اندازی AgentRouter

[AgentRouter](https://agentrouter.org) یک رلهٔ سازگار با Anthropic است که Claude و سایر مدل‌ها را، اغلب با قیمتی پایین‌تر از API مستقیم Anthropic، باز‌فروش می‌کند. این سرویس به‌عنوان جایگزین مستقیم `ANTHROPIC_BASE_URL` برای کلاینت رسمی Claude Code طراحی شده است؛ بنابراین فقط ترافیکی را می‌پذیرد که با الگوی پیادگی Claude Code مطابقت داشته باشد (User-Agent خاص، پرچم‌های `anthropic-beta`، هدرهای Stainless SDK و غیره).

## شروع سریع — استفاده از پروایدر بومی `agentrouter` (پیشنهادی)

برای بیشتر کاربران، **هیچ راه‌اندازی خاصی لازم نیست**. RouteChi یک پروایدر داخلی `agentrouter` به‌همراه کامل‌ترین الگوی پیادگی Claude Code به‌صورت پیش‌فرض ارائه می‌دهد (به `open-sse/config/providerRegistry.ts` → `agentrouter` مراجعه کنید). برای استفاده:

1. **Dashboard → Providers → Add Provider** را باز کنید.
2. از فهرست، **AgentRouter** را انتخاب کنید.
3. کلید API `sk-...` خود را جای‌گذاری کرده و ذخیره کنید.

همین — نه متغیر محیطی لازم است و نه نوع پروایدر سفارشی. مدل‌های داخلی شامل `claude-opus-4-6`، `claude-haiku-4-5-20251001`، `glm-5.1` و `deepseek-v3.2` هستند.

باقی این راهنما به **مسیر پیشرفته** می‌پردازد: استفاده از نوع پروایدر `anthropic-compatible-cc-*`. این مسیر را زمانی به‌کار بگیرید که کنترل بیشتری روی الگوی پیادگی لازم دارید — برای نمونه، هنگام اتصال به رله‌های مشابه AgentRouter که هنوز در رجیستری پروایدر بومی نیستند، یا هنگام بازنویسی base URL، chat path یا مجموعهٔ هدرها.

---

## پیشرفته: اتصال از طریق نوع پروایدر سازگار با Claude Code

RouteChi همچنین از AgentRouter (و رله‌های مشابه) از طریق نوع پروایدر **Claude Code Compatible** (`anthropic-compatible-cc-*`) پشتیبانی می‌کند که API پیام‌های Anthropic را با الگوی پیادگی درست صحبت می‌کند. یک پروایدر عمومی `openai-compatible-chat` که به `https://agentrouter.org` اشاره کند **کار نخواهد کرد** — WAF بالادست درخواست‌هایی که شبیه Claude Code نباشند را رد می‌کند.

---

## پیش‌نیازها

- یک حساب و کلید API در AgentRouter. حساب‌های جدید از طریق لینک وابسته در [README](../README.md) پروژه اعتبار رایگان دریافت می‌کنند.
- RouteChi در حال اجرا با پرچم ویژگی `ENABLE_CC_COMPATIBLE_PROVIDER` فعال (به پایین مراجعه کنید).

## ۱. فعال‌سازی نوع پروایدر سازگار با CC

نوع پروایدر سازگار با Claude Code پشت یک feature flag قرار دارد؛ چرا که ترافیکی نزدیک به کلاینت رسمی Claude Code می‌فرستد. آن را با تنظیم یک متغیر محیطی پیش از راه‌اندازی RouteChi فعال کنید:

```bash
ENABLE_CC_COMPATIBLE_PROVIDER=true
```

نمونهٔ Docker:

```bash
docker run -d --name omniroute \
  --restart unless-stopped \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  -e ENABLE_CC_COMPATIBLE_PROVIDER=true \
  borhandarabi/routechi:latest
```

پس از راه‌اندازی مجدد، داشبورد علاوه بر جریان‌های موجود OpenAI-compatible و Anthropic-compatible، گزینهٔ **Add Claude Code Compatible** را نیز نمایش می‌دهد.

## ۲. ایجاد پروایدر در داشبورد

1. **Dashboard → Providers → Add Provider** را باز کنید.
2. **Add Claude Code Compatible** را انتخاب کنید (فقط هنگام تنظیم بودن پرچم بالا قابل مشاهده است).
3. فیلدها را پر کنید:

| فیلد      | مقدار                                                          |
| --------- | -------------------------------------------------------------- |
| Name      | `AgentRouter` (یا هر برچسبی)                                   |
| Prefix    | `agentrouter` (نام مستعار دوستانه در لاگ‌ها و داشبورد)            |
| Base URL  | `https://agentrouter.org`                                      |
| Chat path | `/v1/messages?beta=true` (پیش‌فرض — دست‌نخورده بگذارید)         |

> شناسهٔ کانونیکال مدل همچنان از شناسهٔ کامل نود پروایدر استفاده می‌کند
> (`anthropic-compatible-cc-{uuid}/{model}`). **Prefix** صرفاً یک نام مستعار
> نمایشی است که توسط `src/lib/usage/callLogs.ts` برای خروجی لاگ دوستانه‌تر تحلیل می‌شود.

4. (اختیاری) کلید API خود را در فیلد **Validate** جای‌گذاری کرده و روی **Check** بزنید تا پیش از ذخیره، اتصال تأیید شود.
5. روی **Add** بزنید.

پس از ایجاد، پروایدر را باز کرده و یک **Connection** با کلید API AgentRouter (`sk-...`) اضافه کنید. مقدار `test_status` اتصال باید `active` شود.

## ۳. استفاده از طریق combo یا مستقیم

مدل را با استفاده از پیشوند پروایدر به‌عنوان namespace ارجاع دهید:

```bash
curl -X POST http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agentrouter/claude-opus-4-6",
    "messages": [{"role": "user", "content": "hello"}],
    "max_tokens": 100
  }'
```

شناسهٔ کانونیکال مدل `anthropic-compatible-cc-{uuid}/claude-opus-4-6` نیز کار می‌کند و همان چیزی است که در پایگاه‌داده و پیکربندی combo نمایش داده می‌شود.

یا آن را برای مسیریابی، fallback و مدیریت سهمیه مانند هر پروایدر دیگر به یک combo اضافه کنید.

---

## جزئیات الگوی پیادگی

برای ارجاع، پل cc-compatible در هر درخواست بالادست موارد زیر را ارسال می‌کند (به `open-sse/services/claudeCodeCompatible.ts` مراجعه کنید):

| Header                                      | Value                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Authorization`                             | `Bearer <api-key>`                                                                                      |
| `User-Agent`                                | `claude-cli/2.1.207 (external, sdk-cli)`                                                                |
| `anthropic-version`                         | `2023-06-01`                                                                                            |
| `anthropic-beta`                            | `claude-code-20250219,interleaved-thinking-2025-05-14,effort-2025-11-24`                                |
| Toggle احیای تفکر برای هر اتصال              | `redact-thinking-2026-02-12` را برای بالادست‌هایی اضافه می‌کند که به‌طور خاص به جریان تفکر احیاشده نیاز دارند |
| Toggle تفکر خلاصه‌شده برای هر اتصال          | `display: "summarized"` را به درخواست‌های تفکر CC Compatible اضافه می‌کند که از پیش حالت display تنظیم نکرده‌اند |
| `anthropic-dangerous-direct-browser-access` | `true`                                                                                                  |
| `x-app`                                     | `cli`                                                                                                   |
| `X-Stainless-*`                             | هدرهای متنوع Stainless SDK (زبان، نسخهٔ پکیج، سیستم‌عامل، معماری و غیره)                                  |

این همان چیزی است که اجازه می‌دهد درخواست‌ها از WAF بالادست / فهرست سفید کلاینت عبور کنند.

---

## رفع اشکال

**`{"error":{"message":"unauthorized client detected, ..."}}`** — درخواست شما با الگوی پیادگی Claude Code مطابقت نداشت. این هنگامی رخ می‌دهد که پروایدر به‌جای `anthropic-compatible-cc` به‌عنوان `openai-compatible-chat` پیکربندی شده باشد، یا پرچم `ENABLE_CC_COMPATIBLE_PROVIDER=true` هنگام راه‌اندازی تنظیم نشده باشد.

**`{"error":{"message":"无效的令牌","type":"new_api_error"}}` (HTTP 401)** —
«Invalid token». الگوی پیادگی درست است اما کلید API رد شده است. یک کلید جدید در داشبورد AgentRouter تولید کرده و اتصال را به‌روز کنید.

**`{"error":{"code":"content-blocked","type":"agent_router_api_error"}}`
(HTTP 400)** — هوک نظارتی AgentRouter محتوای درخواست را رد کرده، یا طرح کلید اجازهٔ مدل درخواست‌شده را نمی‌دهد. یک پرامپت یا مدل متفاوت امتحان کنید؛ اگر یک پرامپت بی‌خطر به‌طور مداوم مسدود می‌شود، با پشتیبانی AgentRouter تماس بگیرید.

**`[400]: content-blocked` تنها روی مدل‌های خاص** — بیشتر طرح‌های AgentRouter فقط زیرمجموعه‌ای از مدل‌ها را اجازه می‌دهند (مثلاً `claude-opus-4-6`). سایر شناسه‌های مدل حتی با معتبر بودن کلید، `unauthorized_client_error` برمی‌گردانند. در داشبورد AgentRouter بررسی کنید که طرح شما کدام مدل‌ها را پوشش می‌دهد.

**`Invalid JSON response from provider (reset after Ns)` از لاگ‌های RouteChi** —
بالادست یک بدنهٔ غیر JSON (معمولاً یک صفحهٔ خطای HTML از WAF) برگردانده است. این اغلب به این معناست که درخواست هرگز به بک‌اند AgentRouter نرسیده است — دوباره بررسی کنید که شناسهٔ پروایدر با `anthropic-compatible-cc-` شروع شود (به خط تیرهٔ انتهایی توجه کنید — به `CLAUDE_CODE_COMPATIBLE_PREFIX` در `open-sse/services/claudeCodeCompatible.ts` مراجعه کنید) و پرچم ویژگی فعال باشد.

---

## همچنین ببینید

- [`docs/providers/CLAUDE_WEB.md`](./CLAUDE_WEB.md) — یادداشت‌های یکپارچه‌سازی پروایدر Claude Web
- [`docs/reference/FREE_TIERS.md`](../reference/FREE_TIERS.md) — کاتالوگ پروایدرهای رایگان‌لایه
- [`open-sse/services/claudeCodeCompatible.ts`](../../open-sse/services/claudeCodeCompatible.ts)
  — پیاده‌سازی الگوی پیادگی
