---
title: "Egress IP Family Policy (IPv4/IPv6)"
version: 3.8.40
lastUpdated: 2026-06-28
---

# سیاست خانواده IP خروجی (IPv4/IPv6)

> **ترافیک خروجی را به یک خانواده IP واحد — `auto`, `ipv4` یا `ipv6` — به ازای هر پراکسی پین کنید، تا یک خروجی فقط‌IPv6 هرگز به‌صورت خاموش به IPv4 نشت نکند.**

> **منبع حقیقت:** `open-sse/utils/proxyFamily.ts`, `open-sse/utils/proxyDispatcher.ts`, `open-sse/utils/proxyFetch.ts`, `open-sse/utils/socksConnectorWithFamily.ts`, `open-sse/utils/proxyFamilyResolve.ts`, `src/shared/validation/schemas.ts`, `src/lib/db/proxies.ts`, `src/lib/db/upstreamProxy.ts`, `src/lib/db/migrations/099_proxy_family.sql`

RouteChi به هر پراکسی اجازه می‌دهد یک **دستورالعمل خروجی خانواده آدرس** داشته باشد. به‌طور پیش‌فرض، سیستم‌عامل IPv4 یا IPv6 را انتخاب می‌کند (دوگانه، «Happy Eyeballs»). وقتی دستورالعمل را روی `ipv4` یا `ipv6` تنظیم می‌کنید، RouteChi هر اتصال از طریق آن پراکسی را به خانواده انتخاب‌شده پین می‌کند و به جای بازگشت به خانواده دیگر، **fail-closed** می‌شود.

این صفحه مستند می‌کند که دستورالعمل چیست، چرا وجود دارد، کجا آن را پیکربندی می‌کنید و چگونه زمان اجرا آن را حل می‌کند.

---

## فهرست مطالب

- [چیستی](#what-it-is)
- [چرا وجود دارد](#why-it-exists)
- [سه مقدار](#the-three-values)
- [نحوه پیکربندی](#how-to-configure-it)
- [نحوه حل `auto`](#how-auto-resolves)
- [نحوه اعمال `ipv4` / `ipv6`](#how-ipv4--ipv6-are-enforced)
- [سازگاری SOCKS5](#socks5-compatibility)
- [رفتار Fail-Closed](#fail-closed-behavior)
- [مدل داده](#data-model)
- [مستندات مرتبط](#related-documentation)

---

## چیستی

هر پراکسی در رجیستر یک فیلد `family` با سه مقدار ممکن دارد که با یک enum از Zod راستی‌آزمایی می‌شود:

```ts
// src/shared/validation/schemas.ts
family: z.enum(["auto", "ipv4", "ipv6"]).optional().default("auto"),
```

این فیلد به‌طور پیش‌فرض `"auto"` است که رفتار دوگانه پیشین را حفظ می‌کند. تنظیم آن روی `ipv4` یا `ipv6`، خانواده اتصال برای آن پراکسی را پین می‌کند.

دستورالعمل همه‌جا از طریق یک کمک‌کننده واحد نرمالایز می‌شود تا هر مقدار ناشناخته به `auto` فرو بریزد:

```ts
// open-sse/utils/proxyFamily.ts
export type ProxyFamily = "auto" | "ipv4" | "ipv6";

export function parseProxyFamily(value: unknown): ProxyFamily {
  return value === "ipv4" || value === "ipv6" ? value : "auto";
}
```

---

## چرا وجود دارد

معرفی‌شده در PR [#3777](https://github.com/borhandarabi/routechi/pull/3777). مشکلات انگیزه:

| مشکل                                          | آنچه دستورالعمل اصلاح می‌کند                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **نشست خروجی فقط‌IPv6 به IPv4**               | وقتی یک میزبان پراکسی هم رکوردهای A و هم AAAA دارد (یا سیستم‌عامل IPv4 را ترجیح می‌دهد)، Happy Eyeballs می‌تواند حتی وقتی قصد یک مسیر فقط‌IPv6 دارید، از طریق IPv4 شماره بگیرد. پین کردن `ipv6` آن نشست را حذف می‌کند.                                                                                                              |
| **ابطال ناهنجاری خروجی مشترک**                | ارائه‌دهندگان چرخان (codex/openai) توکن‌ها را وقتی حساب‌های زیادی از طریق **همان** IP با حجم بالا خروجی می‌دهند، ابطال می‌کنند. کنترل خانواده خروجی بخشی از نگه‌داشتن حساب‌ها روی مسیرهای خروجی متمایز و قابل‌پیش‌بینی است (به [`src/lib/proxyEgress.ts`](../../src/lib/proxyEgress.ts) برای تشخیص IP خروجی که با این جفت می‌شود مراجعه کنید). |
| **خروجی قطعی برای انطباق/آزمون**              | وقتی باید تضمین کنید ترافیک از یک خانواده مشخص خارج می‌شود، `auto` کافی نیست.                                                                                                                                                                                                                                                       |

دستورالعمل عمداً **به‌ازای هر پراکسی** است، نه سراسری — پراکسی‌های مختلف در استخر شما می‌توانند سیاست‌های متفاوتی داشته باشند.

---

## سه مقدار

| مقدار  | برچسب UI           | رفتار                                                                                                                                                       |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto` | `Auto (dual-stack)` | سیستم‌عامل خانواده را انتخاب می‌کند. برای یک میزبان پراکسی با IP-literal، خانواده ذاتی literal است؛ برای یک hostname، هر دو خانواده واجد شرایط هستند. این پیش‌فرض است. |
| `ipv4` | `IPv4 only`        | اتصال را به IPv4 پین می‌کند. اگر میزبان پراکسی رکورد IPv4 (A) نداشته باشد fail-closed می‌شود.                                                                |
| `ipv6` | `IPv6 only`        | اتصال را به IPv6 پین می‌کند. اگر میزبان پراکسی رکورد IPv6 (AAAA) نداشته باشد fail-closed می‌شود.                                                            |

رشته‌های UI در `src/i18n/messages/en.json` (`labelFamily`, `familyAuto`, `familyIpv4`, `familyIpv6`, `familyHint`) قرار دارند.

---

## نحوه پیکربندی

### داشبورد

انتخاب‌گر در فرم پراکسی تب **Proxy Pool** قرار دارد:

1. باز کنید **Dashboard → Settings → Proxy → Proxy Pool**
2. یک پراکسی بیفزایید یا ویرایش کنید
3. dropdown **IP family** را روی `Auto (dual-stack)`, `IPv4 only` یا `IPv6 only` تنظیم کنید
4. ذخیره کنید

این کنترل توسط `ProxyRegistryManager.tsx` (نصب‌شده در `proxy/ProxyPoolTab.tsx`) رندر می‌شود.

### API

فیلد `family` بخشی از payloadهای create/update رجیستر پراکسی است، با `createProxyRegistrySchema` / `updateProxyRegistrySchema` (`src/shared/validation/schemas.ts`) راستی‌آزمایی می‌شود و توسط `POST` / `PATCH /api/v1/management/proxies` مدیریت می‌شود:

```bash
# Create an IPv6-only proxy
curl -X POST http://localhost:20128/api/v1/management/proxies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IPv6 egress",
    "type": "socks5",
    "host": "proxy.example.com",
    "port": 1080,
    "family": "ipv6"
  }'

# Change an existing proxy to IPv4-only
curl -X PATCH http://localhost:20128/api/v1/management/proxies \
  -H "Content-Type: application/json" \
  -d '{ "id": "proxy-uuid-here", "family": "ipv4" }'
```

همین فیلد همچنین توسط شیء پیکربندی پراکسی درون‌خطی که برای مدخل‌های upstream-proxy استفاده می‌شود پذیرفته می‌شود (`upstream_proxy_config.family`، به [مدل داده](#data-model) مراجعه کنید).

برای بقیه API CRUD/تخصیص پراکسی، به [PROXY_GUIDE.md](../ops/PROXY_GUIDE.md) مراجعه کنید.

---

## نحوه حل `auto`

وقتی `family` برابر `auto` است، RouteChi **هیچ** دستورالعملی اضافه نمی‌کند — URL پراکسی همان‌طور که هست استفاده می‌شود و خانواده اتصال به‌صورت ذاتی تعیین می‌شود.

در زمان ساخت URL (`proxyConfigToUrl` / `normalizeProxyUrl` در `open-sse/utils/proxyDispatcher.ts`)، یک پراکسی `auto` یک URL ساده بدون نشانگر تولید می‌کند:

```ts
// open-sse/utils/proxyDispatcher.ts
const fam = parseProxyFamily(config.family);
const normalized = normalizeProxyUrl(proxyUrlStr, "context proxy", { allowSocks5 });
return fam === "auto" ? normalized : `${normalized}?family=${fam}`;
```

در زمان دیسپچ (`resolveDispatcherFamily`)، `auto` به خانواده ذاتی یک میزبان IP-literal، یا `null` (بگذار سیستم‌عامل تصمیم بگیرد) برای یک hostname حل می‌شود:

```ts
// open-sse/utils/proxyDispatcher.ts
function resolveDispatcherFamily(parsed: URL): 4 | 6 | null {
  const directive = parseProxyFamily(parsed.searchParams.get("family") ?? undefined);
  const literal = detectIpLiteralFamily(parsed.hostname);
  if (directive === "auto") return literal; // null for a hostname → OS picks
  // ...
}
```

بنابراین:

- `auto` + میزبان IP-literal (`192.0.2.1` / `[2001:db8::1]`) → خانواده آن literal.
- `auto` + hostname → `null` → رزولوشن دوگانه استاندارد سیستم‌عامل.

---

## نحوه اعمال `ipv4` / `ipv6`

یک دستورالعمل غیر از `auto` به‌صورت یک نشانگر query سنتتیک واحد سفر می‌کند — `?family=ipv4` یا `?family=ipv6` — که یک‌بار به URL پراکسی نرمالایز‌شده اضافه می‌شود. `normalizeProxyUrl` مراقب است که این نشانگر را دقیقاً یک‌بار حذف و دوباره اضافه کند تا هرگز parse پورت را خراب نکند.

وقتی دیسپچر ساخته می‌شود، نشانگر خوانده شده و به یک خانواده اتصال ملموس تبدیل می‌شود. اگر میزبان یک IP literal از خانواده **مخالف** باشد، RouteChi استثنا پرتاب می‌کند (تناقض fail-closed است):

```ts
// open-sse/utils/proxyDispatcher.ts
const want = directive === "ipv6" ? 6 : 4;
if (literal !== null && literal !== want) {
  throw new Error(
    `[ProxyDispatcher] Proxy family directive ${directive} contradicts ${literal === 6 ? "IPv6" : "IPv4"} literal host`
  );
}
```

سپس خانواده ملموس روی کانکتور پین می‌شود:

- **پراکسی‌های HTTP/HTTPS** (`ProxyAgent`): `proxyTls: { family, autoSelectFamily: false }` — Happy Eyeballs را غیرفعال می‌کند تا تنها خانواده انتخاب‌شده شماره‌گیری شود.
- **پراکسی‌های SOCKS5**: یک کانکتور سفارشی `socket_options: { family, autoSelectFamily: false }` را به کلاینت SOCKS می‌راند (به [سازگاری SOCKS5](#socks5-compatibility) مراجعه کنید).

---

## سازگاری SOCKS5

پین خانواده با پراکسی‌های SOCKS5 کار می‌کند، اما `fetch-socks` استاندارد گزینه‌های سوکت مورد نیاز برای پین‌کردن خانواده hop پراکسی را افشا نمی‌کند. RouteChi کانکتور خودش را برای این کار ارسال می‌کند:

```ts
// open-sse/utils/socksConnectorWithFamily.ts
export function buildSocksFamilySocketOptions(family: 4 | 6 | null): Record<string, unknown> {
  if (family === 6) return { family: 6, autoSelectFamily: false };
  if (family === 4) return { family: 4, autoSelectFamily: false };
  return {};
}
```

`createProxyDispatcher` بر اساس اینکه آیا یک خانواده پین شده یا نه، کانکتور را انتخاب می‌کند:

- `family === null` (یعنی `auto` روی یک hostname) → `socksDispatcher` استاندارد از `fetch-socks`.
- `family === 4 | 6` → `createSocksDispatcherWithFamily`، که `socket_options` را به `SocksClient.createConnection` می‌راند تا Happy Eyeballs نتواند IPv4 را برای یک سیاست خروجی فقط‌IPv6 انتخاب کند.

پشتیبانی SOCKS5 به‌طور خودکار روشن است (خروج با `ENABLE_SOCKS5_PROXY=false`)؛ به [PROXY_GUIDE.md → Environment Variables](../ops/PROXY_GUIDE.md#environment-variables) مراجعه کنید.

---

## رفتار Fail-Closed

تمام نکته دستورالعمل **امتناع** به جای بازگشت خاموش به خانواده اشتباه است. دو محافظ این را اعمال می‌کنند:

1. **تناقض literal** — یک دستورالعمل که با یک میزبان IP-literal متناقض باشد، هنگام ساخت دیسپچر استثنا پرتاب می‌کند (`resolveDispatcherFamily`، در بالا نشان داده شد).

2. **بررسی DNS پیش‌پرواز hostname** — برای یک پراکسی hostname با خانواده پین‌شده، `proxyFetch.ts` **پیش از** خروجی تأیید می‌کند که hostname واقعاً یک رکورد در خانواده مورد نیاز دارد، از طریق `assertHostnameSupportsFamily`:

   ```ts
   // open-sse/utils/proxyFamilyResolve.ts
   const hasFamily = records.some((r) => r.family === family);
   if (!hasFamily) {
     throw new Error(
       `[ProxyFamily] Proxy host ${host} has no ${family === 6 ? "IPv6 (AAAA)" : "IPv4 (A)"} record; ` +
         `refusing ${family === 6 ? "IPv6" : "IPv4"}-only egress (fail-closed)`
     );
   }
   ```

   هنگام شکست، `proxyFetch.ts` خطا را با `code = "PROXY_FAMILY_UNAVAILABLE"` و `statusCode = 503` برچسب می‌زند. یک شکست رزولوشن DNS نیز به‌طور مشابه fail-closed در نظر گرفته می‌شود (امتناع از خروجی).

میزبان‌های IP-literal برای پیش‌پرواز DNS یک no-op هستند — خانواده آن‌ها ذاتی است و نیاز به جستجو ندارد.

---

## مدل داده

ستون `family` توسط مهاجرت `099_proxy_family.sql` به **دو** جدول اضافه شد:

```sql
-- src/lib/db/migrations/099_proxy_family.sql
ALTER TABLE proxy_registry ADD COLUMN family TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE upstream_proxy_config ADD COLUMN family TEXT NOT NULL DEFAULT 'auto';
```

- `proxy_registry.family` — دستورالعمل به‌ازای هر پراکسی برای مدخل‌های رجیستر (`src/lib/db/proxies.ts`). کوئری‌های رزولوشن `family` را در کنار سایر ستون‌های پراکسی انتخاب می‌کنند و یک مقدار مفقود/غیررشته‌ای به `"auto"` تبدیل می‌شود.
- `upstream_proxy_config.family` — دستورالعمل برای مدخل‌های upstream-proxy (`src/lib/db/upstreamProxy.ts`)، با همان پیش‌فرض `"auto"`.

وقتی یک شیء پراکسی رزولوشل‌شده `family` غیر از `auto` دارد، `proxyConfigToUrl` نشانگر `?family=` را اضافه می‌کند تا پین تا دیسپچر دوام بیاورد.

---

## مستندات مرتبط

> 📖 **مستندات مرتبط:**
>
> - [راهنمای پراکسی](../ops/PROXY_GUIDE.md) — سیستم کامل پراکسی: CRUD رجیستر، رزولوشن ۴ سطحی، چرخش، بررسی سلامت، مرجع API
> - [راهنمای مخفی‌کاری](./STEALTH_GUIDE.md) — لایه‌های اثر انگشتی TLS و اثر انگشتی CLI که روی پراکسی سوار می‌شوند
> - [لایه‌های حفاظت مسیر](./ROUTE_GUARD_TIERS.md) — اعمال loopback برای مسیرهای فقط‌محلی
