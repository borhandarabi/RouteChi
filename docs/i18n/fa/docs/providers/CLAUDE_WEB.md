---
title: "پروایدرها — Claude Web"
version: 3.8.40
lastUpdated: 2026-06-28
---

# پروایدرها — Claude Web

## claude-web

پروایدر مبتنی بر کوکی وب برای **Claude AI** (`claude.ai`) با استفاده از احراز هویت session cookie.

### نحوهٔ کار

1. کاربر کوکی‌های نشست `claude.ai` خود را در داشبورد RouteChi جای‌گذاری می‌کند
2. `ClaudeWebExecutor` درخواست‌های با فرمت OpenAI را به فرمت Claude Web API تبدیل می‌کند
3. درخواست‌ها از طریق **`tls-client-node`** با **اثرانگشت TLS کروم ۱۲۴** ارسال می‌شوند تا از Cloudflare Turnstile عبور کنند
4. پاسخ‌ها به‌صورت SSE (`text/event-stream`) استریم باز می‌گردند

### کوکی‌های مورد نیاز

| Cookie         | Purpose                        | Source                                 |
| -------------- | ------------------------------ | -------------------------------------- |
| `sessionKey`   | احراز هویت اصلی                | نشست مرورگر `claude.ai`                |
| `routingHint`  | مسیریابی Anthropic             | نشست مرورگر `claude.ai`                |
| `cf_clearance` | عبور از Cloudflare Turnstile   | توسط Cloudflare پس از چالش تنظیم می‌شود |
| `__cf_bm`      | مدیریت ربات Cloudflare         | توسط Cloudflare تنظیم می‌شود           |
| `_cfuvid`      | شناسهٔ بازدیدکنندهٔ Cloudflare | توسط Cloudflare تنظیم می‌شود           |

> **نکته:** `cf_clearance` به اثرانگشت TLS مرورگری که چالش Turnstile کلودفلر را حل کرده بسته است. کتابخانهٔ `tls-client-node` (از طریق `claudeTlsClient.ts`) یک handshake جعلی کروم ۱۲۴ ارائه می‌دهد تا توکن عبور از سرور RouteChi کار کند.

### مرجع API

**Endpoint**: `POST /api/organizations/{orgId}/chat_conversations/{convId}/completion`

**هدرهای مورد نیاز**:

```
accept: text/event-stream
anthropic-client-platform: web_claude_ai
anthropic-device-id: <uuid>
content-type: application/json
Referer: https://claude.ai/chat/{convId}
```

**بدنهٔ درخواست**:

```json
{
  "prompt": "user message",
  "model": "claude-sonnet-4-6",
  "timezone": "Asia/Jakarta",
  "locale": "en-US",
  "personalized_styles": [...],
  "tools": [...],
  "rendering_mode": "messages",
  "create_conversation_params": {
    "name": "",
    "model": "claude-sonnet-4-6",
    "is_temporary": false
  }
}
```

### معماری

```
User Cookies (claude.ai)
    ↓
RouteChi Dashboard
    ↓
ClaudeWebExecutor (open-sse/executors/claude-web.ts)
    ↓ Request transformation (OpenAI → Claude Web format)
    ↓
tlsFetchClaude() (open-sse/services/claudeTlsClient.ts)
    ↓ Chrome 124 TLS fingerprint spoofing
    ↓
tls-client-node (Go native binding, koffi)
    ↓
claude.ai API
    ↓ SSE stream
```

### فایل‌ها

| File                                                  | Purpose                                              |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `src/shared/constants/providers.ts`                   | ثبت پروایدر (WEB_COOKIE_PROVIDERS)                   |
| `src/lib/providers/webCookieAuth.ts`                  | ابزارهای کوکی (نرمال‌سازی/استخراج کوکی‌های نشست)     |
| `open-sse/executors/claude-web.ts`                    | پیاده‌سازی executor                                  |
| `open-sse/executors/index.ts`                         | ثبت executor                                         |
| `open-sse/services/claudeTlsClient.ts`                | جعل اثرانگشت TLS از طریق tls-client-node             |
| `open-sse/services/__tests__/claudeTlsClient.test.ts` | تست‌های کلاینت TLS                                   |
| `tests/unit/claude-web.test.ts`                       | تست‌های executor                                     |

### تست

```bash
# Unit tests
node --import tsx/esm --test tests/unit/claude-web.test.ts

# TLS client tests
npx vitest run open-sse/services/__tests__/claudeTlsClient.test.ts
```

### راه‌اندازی

1. RouteChi را اجرا کنید: `omniroute`
2. به Dashboard → Providers → Add Provider بروید
3. دستهٔ «Web Cookie» را انتخاب کنید
4. «Claude Web» را انتخاب کنید
5. کل header کوکی خود را از DevTools مرورگر `claude.ai` جای‌گذاری کنید (Network tab → Copy as fetch → Cookie header)
