---
title: "SDK پلاگین OmniRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# SDK پلاگین OmniRoute

## شروع سریع

```ts
import { definePlugin } from "omniroute/plugins/sdk";

export default definePlugin({
  name: "my-plugin",
  priority: 50,
  onRequest: async (ctx) => {
    console.log(`Request ${ctx.requestId} for ${ctx.model}`);
  },
  onResponse: async (ctx, response) => {
    console.log(`Response for ${ctx.requestId}`);
    return response;
  },
  onError: async (ctx, error) => {
    console.error(`Error: ${error.message}`);
  },
});
```

## مرجع API

### `definePlugin(def: PluginDefinition): Plugin`

تابع Factory که یک شیء Plugin با مقادیر پیش‌فرض ایجاد می‌کند.

**پارامترها:**

- `name` (string، ضروری) — نام پلاگین به‌صورت kebab-case
- `priority` (number، اختیاری، پیش‌فرض: 100) — عدد کم‌تر زودتر اجرا می‌شود
- `enabled` (boolean، اختیاری، پیش‌فرض: true) — به‌صورت فعال شروع شود؟
- `onRequest` (function، اختیاری) — پیش از chat handler اجرا می‌شود
- `onResponse` (function، اختیاری) — پس از chat handler اجرا می‌شود
- `onError` (function، اختیاری) — هنگام خطای handler اجرا می‌شود

### `blockRequest(response?): BlockingHookResult`

درخواست را مسدود کرده و اختیاریاً یک پاسخ سفارشی برمی‌گرداند.

```ts
onRequest: (ctx) => {
  if (!ctx.headers["authorization"]) {
    return blockRequest({ error: "Unauthorized", status: 401 });
  }
};
```

### `modifyBody(body): PluginResult`

بدنه‌ی درخواست را پیش از رسیدن به provider تغییر می‌دهد.

```ts
onRequest: (ctx) => {
  return modifyBody({ ...ctx.body, temperature: 0.7 });
};
```

### `addMetadata(metadata): PluginResult`

متادیتا را به context درخواست متصل می‌کند.

```ts
onRequest: (ctx) => {
  return addMetadata({ source: "my-plugin", version: "1.0.0" });
};
```

## Context پلاگین (`PluginContext`)

| فیلد       | نوع                       | توضیحات                  |
| ---------- | ------------------------- | ------------------------ |
| `requestId`| `string`                  | شناسه یکتا درخواست       |
| `model`    | `string`                  | نام مدل درخواست‌شده      |
| `provider` | `string`                  | شناسه provider هدف       |
| `body`     | `Record<string, unknown>` | بدنه‌ی درخواست           |
| `headers`  | `Record<string, string>`  | هدرهای درخواست           |
| `metadata` | `Record<string, unknown>` | متادیتای قابل تغییر      |
| `timestamp`| `number`                  | timestamp درخواست        |

## Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A sample plugin",
  "author": "your-name",
  "main": "index.js",
  "hooks": {
    "onRequest": { "enabled": true, "priority": 50 },
    "onResponse": true,
    "onError": false
  },
  "requires": {
    "permissions": ["network", "file-read"]
  },
  "enabledByDefault": false,
  "configSchema": {
    "apiKey": { "type": "string", "description": "API key for external service" },
    "maxRetries": { "type": "number", "min": 1, "max": 10, "default": 3 },
    "debug": { "type": "boolean", "default": false },
    "mode": { "type": "string", "enum": ["fast", "slow"], "default": "fast" }
  }
}
```

### اولویت Hook

Hookها می‌توانند با اولویت پیکربندی شوند (عدد کم‌تر = زودتر اجرا می‌شود):

```json
{
  "hooks": {
    "onRequest": { "enabled": true, "priority": 10 },
    "onResponse": { "enabled": true, "priority": 100 }
  }
}
```

یا به‌صورت boolean ساده (اولویت پیش‌فرض ۱۰۰):

```json
{
  "hooks": {
    "onRequest": true,
    "onResponse": true
  }
}
```

## سیستم دسترسی

پلاگین‌ها در یک context از نوع sandboxed VM اجرا می‌شوند. دسترسی به منابع بیرونی نیازمند
دسترسی‌های صریح است:

| دسترسی     | اعطا می‌کند                                                  |
| ---------- | ------------------------------------------------------------ |
| `network`  | `fetch`، `AbortController`، `Headers`، `Request`، `Response` |
| `file-read`| `fs.readFile`، `fs.readdir`، `fs.stat`                       |
| `file-write`| `fs.writeFile`، `fs.mkdir`، `fs.rm`                         |
| `env`      | پروکسی فقط‌خواندنی `process.env`                              |
| `exec`     | `child_process.exec`، `child_process.execSync`               |

بدون یک دسترسی، globalهای مربوطه به‌سادگی در sandbox موجود نیستند.

## Config Schema

تنظیمات قابل پیکربندی را در `configSchema` تعریف کنید:

```json
{
  "configSchema": {
    "apiKey": { "type": "string", "description": "External API key" },
    "maxRetries": { "type": "number", "min": 1, "max": 10, "default": 3 },
    "debug": { "type": "boolean", "default": false },
    "mode": { "type": "string", "enum": ["fast", "slow"], "default": "fast" }
  }
}
```

انواع فیلد: `string`، `number`، `boolean`، `select`

گزینه‌های فیلد: `default`، `min`، `max`، `enum`، `description`

مقادیر config در پایگاه داده ذخیره شده و از طریق صفحه‌ی config داشبورد قابل دسترسی هستند.

## رویدادهای داخلی

| رویداد            | زمان                                          | Payload                       |
| ----------------- | --------------------------------------------- | ----------------------------- |
| `onRequest`       | پیش از chat handler                           | Request context               |
| `onResponse`      | پس از chat handler                            | Response data                 |
| `onError`         | هنگام خطای handler                            | Error object                  |
| `onModelSelect`   | مدل برای routing انتخاب شده                  | Model info                    |
| `onComboResolve`  | combo routing نهایی شد                       | Combo targets                 |
| `onRateLimit`     | Rate limit برخورد شد                         | Limit info                    |
| `onQuotaExhaust`  | سهمیه تمام شد                                | Quota info                    |
| `onProviderError` | provider خطا برگرداند                        | Error details                 |
| `onStreamStart`   | SSE stream شروع شد                           | Stream info                   |
| `onStreamEnd`     | SSE stream پایان یافت                        | Stream stats                  |
| `onInstall`       | پلاگین نصب شد                                | `{ name, version, manifest }` |
| `onActivate`      | پلاگین فعال شد                               | `{ name, version, manifest }` |
| `onDeactivate`    | پلاگین غیرفعال شد                            | `{ name, version, manifest }` |
| `onUninstall`     | پلاگین حذف شد (پیش از حذف فایل‌ها)            | `{ name, version, manifest }` |

## نمونه‌ها

### ثبت‌کننده‌ی درخواست

```ts
import { definePlugin } from "omniroute/plugins/sdk";

export default definePlugin({
  name: "request-logger",
  onRequest: async (ctx) => {
    console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.model} -> ${ctx.provider}`);
  },
});
```

### محدودکننده‌ی نرخ

```ts
import { definePlugin, blockRequest } from "omniroute/plugins/sdk";

const requests = new Map<string, number[]>();

export default definePlugin({
  name: "rate-limiter",
  priority: 10,
  onRequest: async (ctx) => {
    const key = ctx.headers["x-api-key"] || "anonymous";
    const now = Date.now();
    const window = 60000; // 1 minute
    const maxRequests = 100;

    const timestamps = (requests.get(key) || []).filter((t) => t > now - window);
    timestamps.push(now);
    requests.set(key, timestamps);

    if (timestamps.length > maxRequests) {
      return blockRequest({ error: "Rate limit exceeded", status: 429 });
    }
  },
});
```

### تبدیل‌کننده‌ی پاسخ

```ts
import { definePlugin } from "omniroute/plugins/sdk";

export default definePlugin({
  name: "response-transformer",
  onResponse: async (ctx, response) => {
    if (response.choices) {
      response.choices = response.choices.map((c: any) => ({
        ...c,
        message: { ...c.message, content: c.message.content.trim() },
      }));
    }
    return response;
  },
});
```
