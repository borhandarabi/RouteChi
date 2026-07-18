---
title: "MITM TPROXY Transparent Decrypt"
version: 3.8.40
lastUpdated: 2026-06-28
---

# MITM TPROXY رمزگشایی شفاف

رمزگشایی شفاف TPROXY **۵مین حالت ضبط** RouteChi برای پشته
[Traffic Inspector](../frameworks/TRAFFIC_INSPECTOR.md) / [AgentBridge](../frameworks/AGENTBRIDGE.md)
MITM است. این حالت ترافیک HTTPS خروجی محلی را روی لینوکس رهگیری و
**رمزگشایی** می‌کند — با استفاده از TPROXY هسته + مسیریابی سیاست — **بدون** جعل
`/etc/hosts` و **بدون** تغییر تنظیمات system-proxy در سطح OS. این حالت با headless سازگار است
(هیچ ویرایش DNS‌ای برای پاکسازی وجود ندارد) و قواعد فایروال به‌طور خودکار هنگام
راه‌اندازی مجدد flush می‌شوند.

برخلاف سایر حالت‌های ضبط، TPROXY به راه‌اندازی به‌ازای هر میزبان نیاز ندارد: به‌طور شفاف
میزبان‌های مقصد **دلخواه** روی یک پورت هدف را رهگیری می‌کند، TLS را با یک گواهی برگ
که به‌صورت زنده به‌ازای هر hostname بر اساس SNI صادر می‌کند خاتمه می‌دهد، تبادل رمزگشایی‌شده را
ضبط می‌کند و درخواست را به مقصد اصلی دوباره رمزگذاری می‌کند.

> **فقط‌لینوکس، فقط‌root، opt-in.** این حالت به لینوکس، یک addon بومی
> ساخته‌شده با یک toolchain C و قابلیت **CAP_NET_ADMIN** (معمولاً root) نیاز دارد. این حالت
> پشت API فقط‌loopback مربوط به AgentBridge قرار دارد و به‌طور پیش‌فرض غیرفعال است. یک CA
> MITM مورد اعتماد که می‌تواند هر میزبانی را امضا کند یک قابلیت قدرتمند است — به [§6 امنیت](#6-security) مراجعه کنید.

**منبع:** `src/mitm/tproxy/`
**مسیر API:** `GET / POST / DELETE /api/tools/agent-bridge/tproxy`
**تگل داشبورد:** نوار ابزار capture-modes در Traffic Inspector → **"TPROXY Decrypt"** ⚠
**همچنین ببینید:** [`docs/frameworks/TRAFFIC_INSPECTOR.md`](../frameworks/TRAFFIC_INSPECTOR.md),
[`docs/frameworks/AGENTBRIDGE.md`](../frameworks/AGENTBRIDGE.md)

---

## §1 چیستی و زمان استفاده

چهار حالت ضبط دیگر هر کدام یک محدودیت دارند:

| حالت              | نحوه هدایت ترافیک                          | محدودیت                                |
| ----------------- | ------------------------------------------ | -------------------------------------- |
| AgentBridge       | جعل DNS `/etc/hosts` یک مجموعه میزبان ثابت | فقط میزبان‌های IDE-agent ثبت‌شده       |
| Custom Hosts      | جعل DNS `/etc/hosts` به‌ازای هر میزبان     | یک مدخل به‌ازای هر میزبان؛ sudo برای ویرایش hosts |
| HTTP_PROXY        | متغیر محیطی `HTTP_PROXY`/`HTTPS_PROXY`     | فقط برنامه‌هایی که متغیر محیطی را honor می‌کنند |
| System-wide proxy | تنظیمات پراکسی OS                          | وضعیت سراسری را تغییر می‌دهد؛ نیاز به revert |

رمزگشایی شفاف TPROXY ترافیک را در لایه **هسته** هدایت می‌کند. این حالت اتصال‌های خروجی
محلی جدید به یک پورت هدف (پیش‌فرض `443`) را در زنجیره `mangle OUTPUT` نشانه‌گذاری می‌کند، یک
`ip rule` بسته‌های نشانه‌گذاری‌شده را به تحویل محلی مسیریابی مجدد می‌کند،
و هنگام ورود مجدد، هدف `TPROXY` در `mangle PREROUTING` آن‌ها را به یک
شنونده **IP_TRANSPARENT** تحویل می‌دهد — که سپس TLS را خاتمه می‌دهد و plaintext را ضبط می‌کند.

از این حالت استفاده کنید وقتی می‌خواهید ترافیک یک فرآیند را که:

- با میزبانی صحبت می‌کند که AgentBridge ثبت نکرده، و
- `HTTP_PROXY` را honor نمی‌کند، و
- نمی‌خواهید با یک تغییر پراکسی سراسری سیستم آن را آشفته کنید.

از آنجا که رهگیری در هسته رخ می‌دهد، فرآیند مبدأ به **هیچ
تغییر پیکربندی** نیاز ندارد — اما فرآیند باید به CA پویا که RouteChi
نصب می‌کند اعتماد کند (به [§4](#4-the-per-sni-dynamic-ca-and-trust-store-installer) مراجعه کنید).

---

## §2 نیازمندی‌ها

| نیازمندی          | جزئیات                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OS**            | فقط لینوکس — **IP_TRANSPARENT** یک گزینه سوکت فقط‌لینوکس است. loader بر هر پلتفرم دیگر "unavailable" برمی‌گرداند.                                |
| **امتیاز**        | قابلیت **CAP_NET_ADMIN** برای ساخت سوکت شفاف و اعمال قواعد `iptables`/`ip` — در عمل، به‌عنوان root اجرا کنید.                                    |
| **addon بومی**    | یک addon کوچک N-API (`src/mitm/tproxy/native/transparent.c`) باید ساخته یا به‌عنوان prebuild ارسال شود. به [§3](#3-the-native-ip_transparent-addon) مراجعه کنید. |
| **ماژول‌های هسته** | `iptables` با پشتیبانی match از `TPROXY`, `mangle` و `mark` (تأیید‌شده در برابر هسته 6.8.0).                                                       |

**تنزل ظریف:** اگر هر نیازمندی مفقود باشد (غیر از لینوکس، نبود toolchain،
addon ساخته‌نشده)، loader addon (`src/mitm/tproxy/transparentSocket.ts::loadTransparentAddon`)
به‌جای پرتاب استثنا `null` برمی‌گرداند. وضعیت capture-mode سپس
`available: false` گزارش می‌کند، تگل داشبورد **غیرفعال** می‌شود با tooltip
"TPROXY decrypt requires Linux + root + the native addon" و بقیه
RouteChi به کار خود ادامه می‌دهد.

---

## §3 addon بومی IP_TRANSPARENT

ماژول `net` نود نمی‌تواند `setsockopt(IP_TRANSPARENT)` را _قبل از_ `bind()` انجام دهد، که
TPROXY به آن نیاز دارد (در غیر این صورت هسته بسته‌های هدایت‌شده را رها می‌کند). addon
(`src/mitm/tproxy/native/transparent.c`، ساخته‌شده از طریق `binding.gyp`) یک ماژول کوچک N-API
است که سه تابع را افشا می‌کند و از طریق `transparentSocket.ts` مصرف می‌شود:

| تابع addon                            | کار سوکت                                                                                       | استفاده برای                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `createTransparentListener(ip, port)` | `socket()` + **SO_REUSEADDR** + **IP_TRANSPARENT** + `bind()` + `listen()`، fd خام را برمی‌گرداند | شنونده ضبط شفاف (نود fd را از طریق `server.listen({ fd })` به فرزندی می‌پذیرد)        |
| `setSocketMark(fd, mark)`             | `setsockopt` **SO_MARK** روی fd موجود                                                           | ضدحلقه (نشانه‌گذاری سوکت‌های خود پراکسی)                                            |
| `connectMarked(ip, port, mark)`       | `socket()` + **SO_MARK** **قبل از** یک `connect()` non-blocking، fd را برمی‌گرداند             | فوروارد آپ‌استریم دوباره رمزگذاری‌شده (SYN حامل نشانه است)                            |

مقصد اصلی از `socket.localAddress`/`localPort` خوانده می‌شود — TPROXY
آن را حفظ می‌کند، بنابراین هیچ جستجوی **SO_ORIGINAL_DST**/NAT وجود ندارد.

### ساخت addon

```bash
npm run build:native:tproxy      # cd src/mitm/tproxy/native && node-gyp rebuild
                                 # -> native/build/Release/transparent.node
```

- در طول `npm run build`، `scripts/build/build-tproxy-native.mjs` اجرای `node-gyp
rebuild` را اجرا می‌کند. این **فقط‌لینوکس و غیرکشنده** است — یک toolchain مفقود فقط
حالت ضبط را غیرقابل دسترس می‌گذارد.
- `assembleStandalone.mjs` `build/Release/transparent.node` را در
باندل مستقل کپی می‌کند؛ `transparentSocket.ts` آن را هم به‌صورت relative-to-module و هم
relative-to-cwd (`<cwd>/src/mitm/tproxy/native/...`) حل می‌کند.
- `build/` و `prebuilds/` در git نادیده گرفته می‌شوند — باینری **ساخته می‌شود، هرگز
commit نمی‌شود**.

loader به ترتیب اولویت کاوش می‌کند:
`native/build/Release/transparent.node`، سپس `native/prebuilds/transparent.node`
(هم relative-to-module و هم تحت `<cwd>/src/mitm/tproxy/`).

---

## §4 CA پویا به‌ازای SNI و نصب‌کننده trust-store

گواهی MITM استاتیک AgentBridge فقط به این دلیل کار می‌کند که AgentBridge یک
مجموعه میزبان **ثابت** را DNS-spoof می‌کند. TPROXY میزبان‌های **دلخواه** را رهگیری می‌کند،
بنابراین شنونده باید یک برگ معتبر برای هر SNI که کلاینت درخواست می‌کند ارائه دهد.

### CA پویا (`src/mitm/tproxy/dynamicCert.ts`)

`DynamicCertStore` یک CA محلی اجرا می‌کند (ساخته‌شده روی وابستگی `selfsigned`) که:

- یک CA طولانی‌عمر از طریق `generateMitmCa()` تولید می‌کند (CN `"RouteChi MITM CA"`،
اعتبار ۱۰ساله، `basicConstraints CA=true` + `keyUsage keyCertSign,cRLSign`،
RSA 2048-bit / SHA-256).
- **به‌صورت به‌ازای هر hostname SNI به‌طور درخواستی** یک برگ از طریق `issueLeafCert()` صادر می‌کند (اعتبار
۱ساله، `subjectAltName` = میزبان SNI) و یک `tls.SecureContext`
به‌ازای هر hostname کش می‌کند.
- `createSNICallback()` را برای سرور خاتمه‌دهنده TLS افشا می‌کند (به [§5](#5-how-decrypt-and-capture-work) مراجعه کنید).
- می‌تواند با یک `existingCa` ساخته شود تا CA را در طول راه‌اندازی‌های مجدد پایدار نگه دارد
(تا trust-store نیاز به نصب مجدد نداشته باشد).

کلید خصوصی CA **هرگز ماشین را تراش نمی‌کند**.

### نصب‌کننده trust-store (`src/mitm/tproxy/caTrust.ts`)

کلاینت رهگیری‌شده باید به CA پویا اعتماد کند، بنابراین راه‌اندازی حالت ضبط
گواهی CA را در trust-store OS تحت یک **slot اختصاصی** نصب می‌کند —
`omniroute-tproxy-ca.crt` (ثابت `TPROXY_CA_CERT_NAME`) — که از
slot گواهی MITM استاتیک (`omniroute-mitm.crt`) جدا نگه داشته می‌شود تا این دو هرگز یکدیگر را clobber نکنند.

`installTproxyCa(caPem, sudoPassword?)` دایرکتوری anchor توزیع را تشخیص می‌دهد
(به ترتیب: ابتدا سبک Debian) و فرمان refresh متناظر را اجرا می‌کند:

| دایرکتوری anchor                            | فرمان refresh            |
| ------------------------------------------- | ------------------------ |
| `/usr/local/share/ca-certificates`          | `update-ca-certificates` |
| `/etc/ca-certificates/trust-source/anchors` | `update-ca-trust`        |
| `/etc/pki/ca-trust/source/anchors`          | `update-ca-trust`        |
| `/etc/pki/trust/anchors`                    | `update-ca-certificates` |

نصب PEM را در یک فایل temp stage می‌کند، سپس (با امتیاز) `mkdir -p` دایرکتوری anchor،
فایل stage‌شده را در آن `cp` می‌کند و فرمان refresh را اجرا می‌کند. `uninstallTproxyCa()`
فقط slot اختصاصی را حذف می‌کند (گواهی MITM استاتیک دست‌نخورده باقی می‌ماند) و
refresh می‌کند — یک no-op در غیر لینوکس.

همه فرمان‌های امتیاز‌دار از طریق `execFileWithPassword` (`src/mitm/systemCommands.ts`) اجرا می‌شوند
— `spawn` با **آرایه‌های arg، بدون shell، بدون درج رشته‌ای** (Hard Rule #13).
وقتی فرآیند root است (مثلاً VPS) هدف مستقیماً اجرا می‌شود و هیچ گذرواژه‌ای نیاز نیست؛
روی یک دسکتاپ غیر root، `sudoPassword` از طریق `sudo -S` روی stdin ارسال می‌شود.

> `sudoPassword` دسکتاپ در بدنه POST برای تأیید نصب
> trust-store تأمین می‌شود؛ وقتی فرآیند root است کاملاً نادیده گرفته می‌شود.

---

## §5 نحوه کار رمزگشایی و ضبط

خط لوله (همه تحت `src/mitm/tproxy/`):

```
local app  ──TCP/443──▶  mangle OUTPUT marks the conn (fwmark)
                          ip rule → local route table → lo
                          mangle PREROUTING TPROXY → IP_TRANSPARENT listener (port 8443)
                              │  captureMode.ts: reads orig dest from socket.localAddress
                              ▼
                          tlsCapture.ts:
                            1. TLS-terminate the CLIENT with a per-SNI leaf (dynamicCert)
                            2. internal http.Server parses the decrypted plaintext
                            3. capture → globalTrafficBuffer.push() with source: "tproxy"
                               (sanitizeHeaders + maskSecret applied)
                            4. forward RE-encrypted to the original destination
                               over a bypass-marked socket (connectMarked, anti-loop)
                              │
                              ▼
                          original upstream (api.example.com)
```

- **خاتمه TLS** (`createTlsCaptureServer`): سوکت خام رهگیری‌شده را
در یک `tls.TLSSocket` سمت سرور با استفاده از callback SNI مربوط به CA پویا می‌پیچد،
سپس جریان رمزگشایی‌شده را به یک `http.Server` داخلی تحویل می‌دهد (ترفعل خاتمه MITM
استاندارد). طول عمر سوکت‌ها توسط `MITM_IDLE_TIMEOUT_MS` محدود می‌شوند تا یک
تونل گیرکرده نتواند توصیف‌گرهای فایل را تخلیه کند.
- **ضبط** (`handleDecryptedRequest`): یک `InterceptedRequest` با
`source: "tproxy"`، وضعیت شروع `"in-flight"`، هدرها از طریق
`sanitizeHeaders()` و بدنه‌ها از طریق `maskSecret()` پیش از ورود به
بافر، push می‌کند. سپس مدخل با پاسخ، اندازه‌ها و تأخیر به‌روزرسانی می‌شود.
- **فوروارد دوباره رمزگذاری‌شده** (`createForward` / `realForward`): به
مقصد اصلی دوباره رمزگذاری می‌کند. `rejectUnauthorized` به‌طور پیش‌فرض **`true`** است (امن به‌طور
پیش‌فرض) — گواهی آپ‌استریم در برابر SNI/Hostی که کلاینت
درخواست کرده راستی‌آزمایی می‌شود، بنابراین پراکسی دقیقاً همان چیزی را رد می‌کند که کلاینت اصلی رد می‌کرد.

### ضدحلقه (SO_MARK)

چون قواعد اتصال‌های خروجی محلی جدید را نشانه‌گذاری می‌کنند، فوروارد **خود**
پراکسی دوباره رمزگذاری‌شده به‌طور معمول دوباره رهگیری می‌شود — یک حلقه بی‌نهایت. مسیر
فوروارد با یک نشانه سوکت bypass (**SO_MARK**) از این دفاع می‌کند:

- `realForward` سوکت آپ‌استریم خود را از طریق `connectMarked(ip, port, DEFAULT_BYPASS_MARK)`
  باز می‌کند — `DEFAULT_BYPASS_MARK = 0x539` — که **SO_MARK** را **پیش از** `connect()` تنظیم می‌کند،
  بنابراین SYN فوروارد حامل نشانه bypass است.
- قاعده `mangle OUTPUT` اتصال‌هایی که از قبل حامل نشانه bypass هستند را مستثنی می‌کند
  (`-m mark ! --mark <bypassMark>`)، بنابراین فوروارد پراکسی دوباره نشانه‌گذاری **نمی‌شود** و
  دوباره وارد TPROXY نمی‌شود.

> یادداشت پیاده‌سازی: سوکت bypass-marked باید روی `createConnection` مربوط به agent نصب شود
(`https.request({ createConnection })` وقتی یک agent حاضر است به‌صورت خاموش نادیده گرفته می‌شود)،
یا فوروارد یک سوکت بدون نشانه باز می‌کرد و
حلقه برمی‌گشت. این اصلاح ضدحلقه اعتبارسنجی‌شده e2e بود.

---

## §6 امنیت

| کنترل                                | جزئیات                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **API فقط‌loopback**                 | `/api/tools/agent-bridge/tproxy` توسط پیشوند `/api/tools/agent-bridge/` در `LOCAL_ONLY_API_PREFIXES` پوشش داده شده است (`src/server/authz/routeGuard.ts`). اعمال loopback **پیش از** احراز هویت اجرا می‌شود (Hard Rules #15 + #17) — یک JWT نشت‌شده روی یک تونل نمی‌تواند ضبط TPROXY را آغاز کند، که قواعد `iptables` اعمال می‌کند و یک CA trust-store را از طریق فرآیندهای فرزند نصب می‌کند. |
| **slot CA اختصاصی**                  | CA پویا به `omniroute-tproxy-ca.crt` نصب می‌شود، هرگز گواهی MITM استاتیک را clobber نمی‌کند.                                                                                                                                                                                                                                                                         |
| **کلید CA هرگز میزبان را تراش نمی‌کند** | `DynamicCertStore` کلید CA را در حافظه نگه می‌دارد؛ صادر نمی‌شود.                                                                                                                                                                                                                                                                                                  |
| **ماسک‌کردن secret**                  | `maskSecret()` روی بدنه‌های درخواست/پاسخ و `sanitizeHeaders()` روی هدرها **پیش از** `globalTrafficBuffer.push()` اجرا می‌شوند.                                                                                                                                                                                                                                      |
| **بدون درج shell**                    | همه فرمان‌های `iptables`/`ip`/trust-store از طریق `execFile`/`execFileWithPassword` با آرایه‌های arg اجرا می‌شوند (Hard Rule #13).                                                                                                                                                                                                                                |
| **راستی‌آزمایی گواهی آپ‌استریم**      | فوروارد دوباره رمزگذاری‌شده به‌طور پیش‌فرض گواهی آپ‌استریم را راستی‌آزمایی می‌کند (`rejectUnauthorized: true`).                                                                                                                                                                                                                                                          |
| **پاک‌سازی خطا**                      | پاسخ‌های خطای مسیر از طریق `sanitizeErrorMessage()` عبور می‌کنند (Hard Rule #12).                                                                                                                                                                                                                                                                                    |

**CA MITM یک قابلیت قدرتمند است.** یک CA مورد اعتماد توسط OS که می‌تواند هر
میزبان را امضا کند یعنی هر چیزی که RouteChi رهگیری کند قابل رمزگشایی است. این پشت
حالت ضبط TPROXY صریح و فقط‌محلی قرار دارد، به‌طور پیش‌فرض خاموش است و مدخل trust-store
هنگام توقف حالت حذف می‌شود.

---

## §7 اعمال / برگشت تراکنشی فایروال

یک فروپاشی هرگز نباید یک قاعده `mangle` یا مسیر کهنه پشت سر بگذارد. سازنده فرمان
(`src/mitm/tproxy/commands.ts`) و runner (`src/mitm/tproxy/setup.ts`) تضمین می‌کنند
**برگشت معکوس دقیق اعمال است، به ترتیب معکوس**.

`applyTproxy(cfg)` قوانین اعمال را به ترتیب اجرا می‌کند؛ هنگام **هر** شکست یک
`revertTproxy(cfg)` کامل best-effort اجرا می‌کند و دوباره پرتاب می‌کند — بنابراین فایروال یا
کاملاً اعمال شده یا کاملاً برگردانده شده، هرگز نصفه اعمال. `revertTproxy(cfg)` قوانین
معکوس را به ترتیب معکوس اجرا می‌کند و شکست‌ها را می‌بلعد (idempotent — امن برای فراخوانی
غیرشرطی، مثلاً از پاکسازی `repairMitm()` AgentBridge).

`validateTproxyConfig(cfg)` پیش از هر فرمان اجرا می‌شود: پورت‌ها باید `1–65535` باشند،
`mark`/`routeTable`/`bypassMark` باید اعداد صحیح مثبت باشند و `bypassMark` باید
با `mark` متفاوت باشد (ضدحلقه).

### قوانین اعمال (به ترتیب)

```bash
ip rule add fwmark <mark> lookup <routeTable>
ip route add local 0.0.0.0/0 dev lo table <routeTable>
iptables -t mangle -A OUTPUT -p tcp --dport <dport> -m mark ! --mark <bypassMark> -j MARK --set-mark <mark>
iptables -t mangle -A PREROUTING -p tcp --dport <dport> -m mark --mark <mark> -j TPROXY --on-port <onPort> --tproxy-mark <mark>
```

برگشت آن‌ها را به ترتیب معکوس حذف می‌کند: `PREROUTING -D`, `OUTPUT -D`, `ip route del`, `ip rule del`.

> این دستورالعمل **بر پایه OUTPUT** است چون مورد استفاده MITM ترافیک خروجی _محلی_
> است (برنامه‌ها روی همان میزبان)، که TPROXY به‌تنهایی در `PREROUTING` آن را نمی‌بیند —
> `PREROUTING` فقط ترافیک forward‌شده را می‌بیند. زنجیره `OUTPUT` اتصال‌های
> محلی جدید را نشانه‌گذاری می‌کند، `ip rule` آن‌ها را به تحویل محلی (`lo`) مسیریابی مجدد می‌کند، و
> سپس `PREROUTING` آن‌ها را به شنونده شفاف تخصیص می‌دهد.

---

## §8 پیکربندی

درخواست شروع (`POST /api/tools/agent-bridge/tproxy`) فیلدهای زیر را
می‌پذیرد که توسط `StartTproxyBodySchema` (`tproxy/route.ts`) راستی‌آزمایی می‌شوند. همه اختیاری
هستند و به پیش‌فرض‌های خود برمی‌گردند:

| فیلد            | نوع                | پیش‌فرض  | یادداشت                                                                                                           |
| --------------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| **dport**       | int (1–65535)      | `443`    | پورت TCP مقصد برای رهگیری شفاف                                                                                    |
| **mark**        | int (≥1)           | `0x2333` | نشانه فایروال تنظیم‌شده روی `OUTPUT`، تطبیق‌شده توسط `ip rule` + `PREROUTING`                                       |
| **onPort**      | int (1–65535)      | `8443`   | پورتی که شنونده شفاف (**IP_TRANSPARENT**) bind می‌کند                                                              |
| **routeTable**  | int (≥1)           | `233`    | شناسه جدول مسیریابی سیاست که مسیر `local 0.0.0.0/0` را نگه می‌دارد                                                  |
| **bypassMark**  | int (≥1, ≠ `mark`) | `0x539`  | نشانه سوکت bypass (**SO_MARK**) که پراکسی روی اتصال‌های آپ‌استریم خود تنظیم می‌کند؛ در `OUTPUT` مستثنی (ضدحلقه)        |
| **sudoPassword**| string             | —        | فقط دسکتاپ‌های غیر root: نصب trust-store را تأیید می‌کند؛ وقتی root است نادیده گرفته می‌شود                          |

هیچ **متغیر محیطی** برای TPROXY وجود ندارد — همه پیکربندی از طریق
بدنه POST یا پیش‌فرض‌های بالا است.

---

## §9 فعال‌سازی از Traffic Inspector

1. **Traffic Inspector** (`/dashboard/tools/traffic-inspector`) را باز کنید.
2. در نوار ابزار capture-modes، دکمه **"TPROXY Decrypt"** ⚠ را پیدا کنید
   (`src/app/(dashboard)/dashboard/tools/traffic-inspector/components/CaptureModesToolbar.tsx`).
   - اگر **غیرفعال** است با tooltip "TPROXY decrypt requires Linux + root +
     the native addon"، addon بومی روی این میزبان غیرقابل دسترس است (غیر لینوکس،
     نبود toolchain یا addon ساخته‌نشده). به [§2](#2-requirements) و [§3](#3-the-native-ip_transparent-addon) مراجعه کنید.
3. روی دکمه کلیک کنید. این `POST /api/tools/agent-bridge/tproxy` را از طریق
   `startTproxyCaptureMode()` (`src/lib/inspector/tproxyCaptureApi.ts`) فراخوانی می‌کند، که:
   CA پویا را می‌سازد، شنونده شفاف را باز می‌کند، قواعد فایروال را اعمال می‌کند و CA را در trust-store OS نصب می‌کند.
4. هنگام اجرا، تگل کهربایی می‌شود و شمارش رهگیری زنده را
   (`· <interceptCount>`) نشان می‌دهد. درخواست‌های رهگیری‌شده با
   `source: "tproxy"` در فهرست درخواست ظاهر می‌شوند.
5. برای توقف دوباره کلیک کنید — `DELETE /api/tools/agent-bridge/tproxy` از طریق
   `stopTproxyCaptureMode()` شنونده را می‌بندد، CA را حذف می‌کند و قواعد
   فایروال را برمی‌گرداند.

وضعیت capture-mode (در حال اجرا / قابل دسترس / شمارش رهگیری / پورت شنونده) از
`GET /api/tools/agent-bridge/tproxy` (`getCaptureStatus()` در
`src/mitm/tproxy/captureManager.ts`) می‌آید. فقط **یک** جلسه TPROXY در هر زمان اجرا می‌شود —
شروع دومی با "TPROXY capture mode is already running" رد می‌شود.

---

## §10 عیب‌یابی

### تگل غیرفعال است

addon بومی قابل بارگذاری نیست. تأیید کنید: روی لینوکس هستید، addon را ساخته‌اید
(`npm run build:native:tproxy`) و فرآیند می‌تواند `transparent.node` را بارگذاری کند.
`isTransparentSocketAvailable()` تگل را گیت می‌کند؛ `GET /api/tools/agent-bridge/tproxy`
وقتی addon مفقود است `available: false` برمی‌گرداند.

### چیزی ضبط نمی‌شود

- تأیید کنید فرآیند رهگیری‌شده واقعاً به `dport` پیکربندی‌شده
  (پیش‌فرض `443`) متصل می‌شود.
- تأیید کنید فرآیند به CA پویا اعتماد می‌کند. CA تحت
  `omniroute-tproxy-ca.crt` نصب می‌شود؛ برنامه‌هایی با trust-store خود (Firefox/Chrome NSS)
  ممکن است نیاز به افزودن گواهی به آنجا داشته باشند.
- خودآزمایی **Diagnose** AgentBridge را اجرا کنید (به
  [`AGENTBRIDGE.md`](../frameworks/AGENTBRIDGE.md) مراجعه کنید) برای بررسی‌های سلامت cert-trusted / server.

### قواعد فایروال کهنه پس از یک فروپاشی

`revertTproxy()` معکوس دقیق اعمال است و idempotent است. توقف
حالت قواعد را برمی‌گرداند؛ اگر RouteChi در وسط جلسه کشته شد، از عمل
**Repair** AgentBridge (`POST /api/tools/agent-bridge/repair`) برای بازگرداندن وضعیت سیستم
یتیم‌شده (spoof DNS، root CA، system proxy) استفاده کنید. قواعد `mangle` و مسیر TPROXY نیز
به‌طور خودکار هنگام راه‌اندازی مجدد flush می‌شوند.

### حلقه بی‌نهایت / پراکسی فوروارد خود را رهگیری می‌کند

این مورد ضدحلقه است. تأیید کنید `bypassMark` با `mark` متفاوت است (اعتبارسنجی
این را اعمال می‌کند) و اینکه فوروارد از `connectMarked` استفاده می‌کند (در `realForward` این‌گونه است).
به [§5 ضدحلقه](#anti-loop-so_mark) مراجعه کنید.

---

## §11 نقشه منبع

| فایل                                             | مسئولیت                                                                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/mitm/tproxy/commands.ts`                    | سازنده فرمان `iptables`/`ip` اعمال + برگشت خالص؛ `validateTproxyConfig`                                                                       |
| `src/mitm/tproxy/setup.ts`                       | runner تراکنشی `applyTproxy` / `revertTproxy` (rollback هنگام شکست)                                                                          |
| `src/mitm/tproxy/transparentSocket.ts`           | loader addon بومی (`loadTransparentAddon`)، `createTransparentListenerFd`, `connectMarked`, `setSocketMark`, `isTransparentSocketAvailable` |
| `src/mitm/tproxy/native/transparent.c`           | addon N-API: `createTransparentListener` (IP_TRANSPARENT)، `setSocketMark`، `connectMarked`                                                  |
| `src/mitm/tproxy/native/binding.gyp`             | مانیفست ساخت node-gyp                                                                                                                         |
| `src/mitm/tproxy/dynamicCert.ts`                 | `DynamicCertStore` — CA پویا به‌ازای SNI + کش برگ                                                                                            |
| `src/mitm/tproxy/caTrust.ts`                     | نصب/حذف trust-store OS (`installTproxyCa` / `uninstallTproxyCa`، slot اختصاصی)                                                                |
| `src/mitm/tproxy/tlsCapture.ts`                  | موتور رمزگشایی خاتمه‌دهنده TLS + فوروارد ضدحلقه دوباره رمزگذاری‌شده                                                                            |
| `src/mitm/tproxy/captureMode.ts`                 | ارکستراسیون شنونده شفاف؛ مقصد اصلی را از `socket.localAddress` می‌خواند                                                                       |
| `src/mitm/tproxy/captureManager.ts`              | چرخه‌حیات تک‌نمونه: `startCaptureMode` / `stopCaptureMode` / `getCaptureStatus`                                                                |
| `src/app/api/tools/agent-bridge/tproxy/route.ts` | مسیر `GET` / `POST` / `DELETE` (LOCAL_ONLY)                                                                                                  |
| `src/lib/inspector/tproxyCaptureApi.ts`          | کمک‌کننده‌های fetch کلاینت (`fetchTproxyStatus` / `startTproxyCaptureMode` / `stopTproxyCaptureMode`)                                        |
