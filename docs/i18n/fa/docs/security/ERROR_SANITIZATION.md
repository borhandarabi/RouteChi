---
title: "Error Message Sanitization"
version: 3.8.40
lastUpdated: 2026-06-28
---

# پاک‌سازی پیام خطا

> **منبع حقیقت:** `open-sse/utils/error.ts` — `sanitizeErrorMessage`, `buildErrorBody`, `createErrorResult`
> **آزمون‌ها:** `tests/unit/error-message-sanitization.test.ts`
> **آخرین به‌روزرسانی:** ۲۸-۰۶-۲۰۲۶ — v3.8.40
> **مخاطب:** هر مهندسی که با پاسخ‌های خطا سروکار دارد (مسیرهای HTTP، جریان‌های SSE، اجراکننده‌ها، هندلرهای MCP).
> **وضعیت:** **الزامی** برای هر مسیر کد که یک پیام خطا به کلاینت برمی‌گرداند.

## چرا این وجود دارد

قاعده CodeQL `js/stack-trace-exposure` (CWE-209) هر مسیر کد را که در آن یک پیام خطا ناشی از یک استثنای زمان اجرا بدون پاک‌سازی به یک پاسخ HTTP / SSE می‌رسد، پرچم می‌زند. ردپای پشته و مسیرهای فایل مطلق در پاسخ‌های production به مهاجمان می‌دهند:

- چیدمان دایرکتوری داخلی (`/srv/app/src/lib/...`) → اکتشاف برای حملات بیشتر.
- نسخه‌های کتابخانه / فریم‌ورک استنتاج‌شده از فریم‌های پشته → انتخاب اکسپلویت هدف‌دار.
- مقادیر حساس زمان اجرا که ممکن است به‌صورت رشته‌ای در خطاها درج شوند (کوئری‌های DB، مقادیر پیکربندی).

کمک‌کننده `sanitizeErrorMessage` در `open-sse/utils/error.ts` هر دو کلاس نشت را حذف می‌کند:

1. ردپای پشته چندخطی — تنها خط اول (پیام خطای واقعی) نگه داشته می‌شود.
2. مسیرهای مطلق (`/...*.{ts,js,tsx,jsx,mjs,cjs}[:line[:col]]` و `C:\...`) — با `<path>` جایگزین می‌شوند.

## الگوی الزامی

### ۱. ساخت یک پاسخ خطا (مسیرهای HTTP / API)

از `buildErrorBody()` استفاده کنید — پاک‌سازی درون‌ساخت است:

```ts
import { buildErrorBody } from "@omniroute/open-sse/utils/error.ts";

export async function POST(req: Request) {
  try {
    // ... handler logic ...
  } catch (err) {
    return new Response(JSON.stringify(buildErrorBody(500, String(err))), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

یا برای wrapperهای راحتی در همان ماژول:

```ts
import {
  errorResponse, // one-shot Response object
  writeStreamError, // SSE writer
  createErrorResult, // { success: false, status, response, ... } shape
  unavailableResponse, // adds Retry-After
  providerCircuitOpenResponse,
  modelCooldownResponse,
} from "@omniroute/open-sse/utils/error.ts";
```

همه این‌ها از طریق `buildErrorBody` و در نتیجه از طریق `sanitizeErrorMessage` عبور می‌کنند. **هیچ‌گاه نیازی به فراخوانی دستی `sanitizeErrorMessage` نیست** وقتی از این کمک‌کننده‌ها استفاده می‌کنید.

### ۲. پاکت‌های خطای سفارشی (نادر)

وقتی نمی‌توانید از کمک‌کننده‌های بالا استفاده کنید (مثلاً شکل پاسخ توسط یک پروتکل آپ‌استریم مثل Connect-RPC دیکته شده)، `sanitizeErrorMessage` را مستقیماً import کنید:

```ts
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error.ts";

const body = JSON.stringify({
  error: {
    message: sanitizeErrorMessage(rawMessage),
    type: "invalid_request_error",
    code: "",
  },
});
```

این تنها روش تأییدشده برای مونتاژ یک بدنه خطای سفارشی است. برای پیاده‌سازی مرجع به `open-sse/executors/cursor.ts::buildErrorResponse` مراجعه کنید.

### ۳. لاگ‌کردن در برابر پاسخ‌دادن

`sanitizeErrorMessage` باید **فقط** مقداری که از مرز شبکه عبور می‌کند را بپوشاند. لاگ‌های داخلی (`pino`, `console`) باید پیام کامل از جمله پشته را نگه دارند تا اپراتورها بتوانند دیباگ کنند. الگو:

```ts
try {
  // ...
} catch (err) {
  log.error({ err }, "handler failed"); // full err with stack — internal log
  return errorResponse(500, getErrorMessage(err)); // sanitized — sent to client
}
```

### ۴. الگوهای ممنوع

❌ **هرگز** خروجی خام استثنا را در بدنه Response نگذارید:

```ts
// BAD: stack trace + file paths reach the client
return new Response(JSON.stringify({ error: { message: err.stack || err.message } }), {
  status: 500,
});
```

❌ **هرگز** جداکننده خط اول خودتان را نسازید:

```ts
// BAD: forgets to strip absolute paths, may drift from the canonical helper
const safe = String(err).split("\n")[0];
```

❌ **هرگز** در مسیر پاک‌سازی نکنید و مسیر SSE را فراموش کنید. هر چیزی که به یک جریان می‌نویسد از `writeStreamError` عبور می‌کند (یا `buildErrorBody` زیرین آن).

❌ **هرگز** `process.cwd()`, `__filename`, `__dirname`، مسیرهای مشتق‌شده از env را در پیام‌های خطا قرار ندهید — آن‌ها از regex مسیر عبور می‌کنند و توپولوژی استقرار را افشا می‌کنند.

## پوشش در CI

`tests/unit/error-message-sanitization.test.ts` اعمال می‌کند:

- هر مسیر تحت `/api/model-combo-mappings/*` بدنه‌های پاک‌سازی‌شده روی 4xx/5xx برمی‌گرداند.
- `sanitizeErrorMessage` ردپای پشته چندخطی را حذف می‌کند.
- `sanitizeErrorMessage` مسیرهای مطلق POSIX و Windows را با `<path>` جایگزین می‌کند.
- `sanitizeErrorMessage` ورودی‌های `null`/`undefined`/`Error` instance را به‌طور امن مدیریت می‌کند.
- `buildErrorBody` هرگز ردپای پشته را در فیلد `message` خود افشا نمی‌کند.

هنگام افزودن یک مسیر یا اجراکننده جدید، الگوی ادعا را از این فایل کپی کنید. گیت پوشش (`npm run test:coverage`) ≥۶۰٪ statements/lines/functions/branches را اعمال می‌کند — مسیرهای خطا باید پوشش داده شوند.

## کنترل‌های مرتبط

- هشدارهای CodeQL `js/stack-trace-exposure` در `.github/security` همیشه باید **یا** از طریق این کمک‌کننده‌ها اصلاح شوند **یا** با یک کامنت ارجاع‌دهنده به این مستند رد شوند.
- پیکربندی redaction مربوط به `pino` (`src/shared/utils/logRedaction.ts`) redaction ساختاریافته لاگ را جداگانه مدیریت می‌کند. این مستند تنها سطح پیام پاسخ را پوشش می‌دهد.
- فهرست سیاه هدر آپ‌استریم (`src/shared/constants/upstreamHeaders.ts`) نشت هدر را پوشش می‌دهد — هنگام افزودن یک نگرانی جدید افشا، هر دو فایل را هم‌راستا نگه دارید.

## عبور جزئیات آپ‌استریم

`buildErrorBody` یک آرگومان سوم اختیاری `upstreamDetails` (بدنه خام parse‌شده از ارائه‌دهنده آپ‌استریم) را می‌پذیرد. وقتی فراهم شود، پیش از گنجاندن در پاسخ به‌عنوان `upstream_details` توسط `sanitizeUpstreamDetails` پاک‌سازی می‌شود.

قواعد پاک‌سازی اعمال‌شده بر `upstreamDetails`:

1. برگ‌های رشته‌ای: از `sanitizeErrorMessage` عبور می‌کنند (پشته‌ها + مسیرهای مطلق را حذف می‌کند).
2. فهرست سیاه کلیدها: کلیدهایی که با `/stack|trace|path|file|cwd|dir|password|secret|token|key/i` تطابق دارند
   حذف می‌شوند.
3. سقف عمق: تودرتو بودن بیش از ۴ سطح با رشته `"[truncated]"` جایگزین می‌شود.
4. آرایه‌ها در ۳۲ عنصر سقف می‌خورند.

تنها هفت callsite `createErrorResult` خطای آپ‌استریم در `chatCore.ts`
`upstreamErrorBody` را ارسال می‌کنند. خطاهای داخلی RouteChi (شکست‌های parse SSE، محتوای خالی،
مسدودی‌های گاردریل) شامل `upstream_details` نیستند.

`err.stack`, `err.message` خام یا هر رشته‌ای از یک استثنای زمان اجرا را به
`upstreamDetails` ارسال نکنید. آن‌ها همچنان باید از طریق `errorResponse` / `buildErrorBody(code, msg)`
بدون یک بدنه آپ‌استریم عبور کنند.

## محدودیت شناخته‌شده CodeQL: پاک‌کننده‌های سفارشی شناخته نمی‌شوند

کوئری CodeQL [`js/stack-trace-exposure`](https://codeql.github.com/codeql-query-help/javascript/js-stack-trace-exposure/) از یک فهرست مجاز ثابت از الگوهای پاک‌کننده استفاده می‌کند (مثلاً `.split("\n")[0]` درون‌خطی، `String#replace` با شکل‌های regex مشخص، دسترسی به `.message` روی `Error`). این کوئری **به** غیرمستقیم‌سازی از طریق یک کمک‌کننده سفارشی مانند `sanitizeErrorMessage()` ما اشراف ندارد.

این یعنی callsiteهایی که به‌طور روشن از طریق این ماژول پاک‌سازی می‌کنند — برای مثال `open-sse/utils/error.ts::errorResponse` و `open-sse/executors/cursor.ts::buildErrorResponse` — ممکن است همچنان هشدار را raise کنند حتی اگر کد از نظر عملکردی امن باشد. ردّهای پیش‌سابقه: `#224`, `#231` (می ۲۰۲۶)، هر دو با علامت `false positive` با توجیه فنی.

**نحوه برخورد با یک مورد جدید:**

1. تأیید کنید callsite واقعاً پیام را از طریق `sanitizeErrorMessage` / `buildErrorBody` / یکی از wrapperهای مستندشده بالا عبور می‌دهد (زنجیره فراخوانی را انتها‌به‌انتها بخوانید — به یک کامنت اعتماد نکنید).
2. تأیید کنید `tests/unit/error-message-sanitization.test.ts` مسیر را اجرا می‌کند (یا پوشش اضافه کنید).
3. هشدار را از طریق `gh api ... -X PATCH state=dismissed -f 'dismissed_reason=false positive'` رد کنید که به این مستند ارجاع می‌دهد.
4. با درون‌خطی‌کردن `.split("\n")[0]` در همه‌جا «تعمیر» نکنید — کمک‌کننده منبع واحد حقیقت است؛ تکرار الگو، پاک‌کننده را تضعیف می‌کند (حذف مسیر، سقف طول، تبدیل نوع را از دست می‌دهد) برای ظاهر آرام‌کردن اسکنر.

به‌کارگیری ویژگی‌های opt-in مانند [پیکربندی پاک‌کننده سفارشی `@codeql/javascript-models`](https://codeql.github.com/docs/codeql-language-guides/customizing-library-models-for-javascript/) CodeQL اصلاح بلندمدت است؛ این خارج از این مستند قرار دارد.

## مراجع

- [CWE-209: Information Exposure Through an Error Message](https://cwe.mitre.org/data/definitions/209.html)
- [CodeQL `js/stack-trace-exposure`](https://codeql.github.com/codeql-query-help/javascript/js-stack-trace-exposure/)
- [OWASP: Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- کامیتی که کمک‌کننده را متمرکز می‌کند: `1a39c31f` — _fix(security): mask public upstream creds + centralize error sanitization_
