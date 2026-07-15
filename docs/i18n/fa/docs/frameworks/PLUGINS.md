---
title: "سامانه افزونه‌های CLI ی OmniRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# سامانه افزونه‌های CLI ی OmniRoute

CLI ی `omniroute` را بدون تغییر هسته‌ی آن گسترش دهید. افزونه‌ها از قرارداد نام‌گذاری `omniroute-cmd-*` پیروی می‌کنند، مشابه `gh extension` یا `kubectl plugin`.

## شروع سریع

```bash
# Install a plugin from npm
omniroute plugin install stripe

# Install a local plugin in development
omniroute plugin install ./my-plugin

# List installed plugins
omniroute plugin list

# Scaffold a new plugin
omniroute plugin scaffold myplugin
cd omniroute-cmd-myplugin
omniroute plugin install .
```

## ساختار افزونه

یک افزونه یک پکیج npm با نام `omniroute-cmd-<name>` (یا `@scope/omniroute-cmd-<name>`) است.

```
omniroute-cmd-myplugin/
├── package.json     # must have "type": "module" and "main": "index.mjs"
├── index.mjs        # exports register(program, ctx) + optional meta
└── README.md
```

### `package.json`

```json
{
  "name": "omniroute-cmd-myplugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.mjs",
  "engines": { "omniroute": ">=4.0.0" },
  "keywords": ["omniroute-plugin", "omniroute-cmd"]
}
```

### `index.mjs`

```js
export const meta = {
  name: "myplugin",
  version: "0.1.0",
  description: "My plugin for OmniRoute",
  omnirouteApi: ">=4.0.0",
};

export function register(program, ctx) {
  program
    .command("myplugin")
    .description(meta.description)
    .option("-n, --name <name>")
    .action(async (opts, cmd) => {
      const gOpts = cmd.optsWithGlobals();
      const res = await ctx.apiFetch("/api/combos", {
        baseUrl: gOpts.baseUrl,
        apiKey: gOpts.apiKey,
      });
      const data = await res.json();
      ctx.emit(data, gOpts);
    });
}
```

## API ی زمینه‌ی افزونه

شیء `ctx` که به `register(program, ctx)` ارسال می‌شود:

| Property                     | Type             | Description                                        |
| ---------------------------- | ---------------- | -------------------------------------------------- |
| `ctx.apiFetch(path, opts)`   | `async function` | Authenticated fetch to the OmniRoute server        |
| `ctx.emit(data, opts)`       | `function`       | Output in table/json/jsonl/csv per `--output` flag |
| `ctx.t(key)`                 | `async function` | i18n translation lookup                            |
| `ctx.withSpinner(label, fn)` | `async function` | Wraps async fn with ora spinner                    |
| `ctx.baseUrl`                | `string`         | Resolved base URL                                  |
| `ctx.apiKey`                 | `string \| null` | API key if provided                                |

## کشف (Discovery)

افزونه‌ها از این مسیرها کشف می‌شوند:

1. `~/.omniroute/plugins/<name>/` — نصب‌های محلی کاربر
2. متغیر محیطی `OMNIROUTE_PLUGIN_PATH` — دایرکتوری سفارشی

خطاهای بارگذاری گرفته می‌شوند و به‌صورت هشدار چاپ می‌گردند — یک افزونه‌ی معیوب هرگز CLI را کرش نمی‌کند.

## امنیت

افزونه‌ها با همان امتیازات فرآیند Node.js به‌عنوان `omniroute` اجرا می‌شوند. تنها از منابعی که به آن‌ها اعتماد دارید افزونه نصب کنید. `omniroute plugin install` یک هشدار صریح نمایش می‌دهد و نیازمند `--yes` یا تأیید تعاملی است.

## انتشار

1. مطمئن شوید `package.json` شامل `"keywords": ["omniroute-plugin"]` است
2. `npm publish` را به‌صورت معمول اجرا کنید
3. کاربران از طریق `omniroute plugin search <query>` (در رجیستری npm جستجو می‌کند) افزونه را کشف می‌کنند

## افزونه‌ی نمونه

به [`examples/omniroute-cmd-hello/`](../../examples/omniroute-cmd-hello/index.mjs) برای یک نمونه‌ی مینیمال کاری با `meta` + `register()` مراجعه کنید.
