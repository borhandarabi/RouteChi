---
title: "سیستم طراحی و هویت بصری"
lastUpdated: 2026-07-11
---

# OmniRoute — سیستم طراحی و هویت بصری

> **وضعیت:** مرجع — استانداردسازی توصیف‌شده در اینجا **پیاده‌سازی‌شده** است (فاز ۱-۶: کاغذ دیواری گرید، primitive‌ها، تمرکز status-color، token mono، مهاجرت token DataTable، focus-ring ← accent، primitive‌های Checkbox/Textarea، `cn()` ← tailwind-merge، گرید روی هر صفحه standalone، shell محتوای 4K سیال، سطح‌های data-table کدر). این سند توصیف کانونی token‌های طراحی داشبورد، مؤلفه‌ها، و قراردادهاست؛ قاب‌بندی فاز زیر به‌عنوان استدلال برای هر تصمیم نگه داشته شده است.
> **دامنه:** داشبورد OmniRoute (`src/`) و سایت بازاریابی (`_mono_repo/omnirouteSite/`) **یک هویت بصری** را به اشتراک می‌گذارند — همان پس‌زمینه گراف-کاغذی گرید (32px)، همان token‌های رنگ، مؤلفه‌های استانداردشده.
>
> یادداشت‌های عملی برای نگهدارندگان:
>
> - چندین مقدار hex hardcoded باقی‌مانده **عمدی** هستند (کنسول ترمینال همیشه-تیره، strokeهای SVG در ReactFlow) و نباید در token‌ها جارو شوند.
> - یک گرید «بزرگ‌تر» روی یک نمونه در حال اجرا، یک build stale است نه کد — اندازه گرید ۳۲px است، یکسان با سایت.
> - مقادیر `--table-*` در تم تیره با rgba hardcoded پیش از مهاجرت به‌طور بایت-یکسان هستند؛ تم روشن اصلاح شد (این به‌صورت باگی همیشه-تیره از طریق fallbackهای `var()` مرده بود).

---

## ۱. هدف

سایت بازاریابی (`viral.omniroute.online`, `why.omniroute.online`, `omniroute.online`) و داشبورد محصول باید مانند **یک محصول** به نظر برسند. سایت از قبل پالت خود را از داشبورد قرض گرفته بود — `css/tokens.css` آن حتی می‌گوید _«پالت آینه‌ی داشبورد OmniRoute است (src/app/globals.css)»_. بنابراین این دو در سطح رنگ از قبل حدود ۸۰٪ هم‌راستا هستند. آنچه در داشبورد غایب است:

1. **کاغذ دیواری گراف-کاغذی گرید** که سایت روی هر صفحه استفاده می‌کند.
2. چند **token طراحی مشترک** که سایت دارد اما داشبورد فاقد آن است (مقیاس radius، گرادیانت برند، `surface-2`، فونت mono).
3. **سازگاری سطح مؤلفه** — تعدادی از مؤلفه‌های داشبورد با hex/rgba hardcoded از token‌های تم عبور می‌کنند.

این سند تحلیل و plan است.

---

## ۲. اصول

- **منبع واحد حقیقت = `src/app/globals.css`.** سایت داشبورد را آینه می‌کند، هرگز برعکس. token‌های جدید ابتدا در `globals.css` قرار می‌گیرند.
- **token‌ها، هرگز literal.** مؤلفه‌ها token‌های معنایی مصرف می‌کنند (`bg-surface`, `text-primary`, `border-border`)، هرگز `#hex` خام.
- **ظریف، نه پر سر و صدا.** گرید یک کاغذ دیواری محو است که پشت محتوا قرار می‌گیرد — هرگز نباید کنتراست متن را کاهش دهد یا با UI بجنگد.
- **آگاه-از-تم.** همه چیز هم در `.dark` (ظاهر امضایی محصول) و هم در روشن کار می‌کند.
- **استقرار جراحی.** ابتدا گرید + token‌ها را عرضه کنید (ریسک کم، دیدپذیری بالا)، سپس پاکسازی‌های مؤلفه را در موج‌ها.

---

## ۳. وضعیت فعلی — چه چیزی هم‌راستا شده در مقابل چه چیزی نشده

### ۳.۱ رنگ‌ها — هم از قبل یکپارچه ✅

هر رنگ برند و سطح از قبل به‌صورت **با مقدار** با سایت مطابقت دارد (فقط نام‌ها متفاوت هستند — داشبورد با `--color-` پیشوند می‌گیرد). راستی‌آزمایی‌شده در `src/app/globals.css:30-128`:

| مفهوم                    | token سایت (`tokens.css`)                   | token داشبورد (`globals.css`) | تطبیق        |
| ------------------------ | ------------------------------------------- | ----------------------------- | ------------ |
| primary                  | `--primary #e54d5e`                         | `--color-primary #e54d5e`     | ✅           |
| primary-hover            | `--primary-hover #c93d4e`                   | `--color-primary-hover #c93d4e` | ✅           |
| accent                   | `--accent #6366f1`                          | `--color-accent #6366f1`      | ✅           |
| accent-2                 | `--accent-2 #8b5cf6`                        | `--color-accent-hover #8b5cf6`  | ✅ (تغییرنام‌یافته) |
| accent-3                 | `--accent-3 #a855f7`                        | `--color-accent-light #a855f7`  | ✅ (تغییرنام‌یافته) |
| success / warning / error  | `#22c55e / #f59e0b / #ef4444`               | یکسان                       | ✅           |
| traffic lights           | `#ff5f56 / #ffbd2e / #27c93f`               | یکسان                       | ✅           |
| dark bg / surface / border | `#0b0e14 / #161b22 / rgba(255,255,255,.08)` | یکسان                       | ✅           |
| light bg / surface / text  | `#f9f9fb / #fff / #1a1a2e`                  | یکسان                       | ✅           |

**نتیجه‌گیری:** هیچ مهاجرت رنگی برای انجام وجود ندارد. هویت از به اشتراک گذاشته شده است؛ ما در حال _اتمام_ آن هستیم، نه بازسازی آن.

### ۳.۲ شکاف‌ها — آنچه داشبورد غایب است

| شکاف                     | سایت دارد                                                                       | داشبورد                                                | اقدام                 |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------- |
| **کاغذ دیواری گرید**      | `body::before` graph-paper، `--grid-line`، `--grid-size 32px`، `--section-alt` | **✅ اضافه‌شده (فاز ۱)**                                   | **بخش A**             |
| **مقیاس radius**        | `--radius 14px`، `--radius-sm 9px`                                             | `--radius 14px` اضافه‌شده؛ `-sm` + repoint مؤلفه در انتظار | **بخش B / فاز ۲**   |
| **گرادیانت برند**      | `--grad-brand 135deg primary→accent-3`                                         | **✅ token اضافه‌شده (فاز ۱)**؛ مصرف در فاز ۲        | **بخش B**             |
| **سطح nested**      | `--surface-2 #1c2230`                                                          | **✅ اضافه‌شده (فاز ۱)**                                   | **بخش B**             |
| **فونت Mono**           | `--font-mono` (ui-monospace stack)                                             | در انتظار (فاز ۴، با مصرف‌کنندگان)                        | **بخش B**             |
| **`text-muted` (تیره)** | `#8b8b9e`                                                                      | `#a1a1aa` (zinc-400)                                     | آشتی — **بخش B** |

### ۳.۳ مکانیک‌های تم‌بندی (تا چیزی را نشکنیم)

- **Tailwind v4، CSS-first** (بدون `tailwind.config.*`). token‌ها در `:root`/`.dark` تعریف می‌شوند و از طریق `@theme inline` به utility‌ها نمایش داده می‌شوند (`globals.css:130-179`).
- **تم تیره از طریق کلاس `.dark`** روی `<html>` (`@custom-variant dark` در `globals.css:22`)، توسط یک store سفارشی Zustand (`src/store/themeStore.ts`) toggle می‌شود، تم پیش‌فرض = `system` (`src/shared/constants/appConfig.ts:11`). سایت به جای آن از `html[data-theme="light"]` استفاده می‌کند — **مکانیک‌ها متفاوت‌اند اما هرگز ملاقات نمی‌کنند** (مبدأ جداگانه)، بنابراین هیچ تداخلی وجود ندارد. مکانیک `.dark` داشبورد را نگه می‌داریم.
- **override primary در runtime** وجود دارد (`themeStore.ts:85-97`، presetها در `COLOR_THEMES`) — کاربران می‌توانند `--color-primary` را تعویض کنند. هر token جدید (گرادیانت، و غیره) که به `--color-primary` ارجاع می‌دهد، آن override‌ها را به‌صورت رایگان به ارث می‌برد. ✅
- **نام‌های radius رزروشده Tailwind v4:** `--radius-sm/md/lg/...` پشتیبان utility‌های `rounded-*` هستند. تعریف مجدد آن‌ها به‌صورت retroactive هر `rounded-*` موجود را تغییر می‌دهد (مثلاً `rounded-sm` در ۱۲ فایل استفاده شده است). بنابراین مقدار radius کوچک و repoint مؤلفه عمداً به فاز ۲ به تعویق افتاده‌اند، جایی که مصرف‌کنندگان با هم تغییر می‌کنند.

---

## ۴. بخش A — پس‌زمینه گراف-کاغذی گرید (درخواست اصلی) — پیاده‌سازی‌شده (فاز ۱)

### ۴.۱ این چیست

دستور پخت دقیق از سایت (`_mono_repo/omnirouteSite/css/base.css`): یک **pseudo-element ثابت، full-viewport** که دو گرادیانت خط ۱px را نقاشی می‌کند، در `z-index:-1` پشت همه محتوا قرار می‌گیرد.

```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
}
```

**چرا این کار می‌کند با وجود اینکه `body` یک `background-color` کدر دارد:** یک `::before` با `z-index:-1` _بالای_ background خود عنصر اما _پایین_ محتوای in-flow آن نقاشی می‌کند. بنابراین `--color-bg` fill پایه است، گرید روی آن لایه‌بندی می‌شود، و اپ بالای گرید render می‌شود.

### ۴.۲ سابقه از قبل در codebase

`src/app/landing/page.tsx:16-26` **از قبل همین گرید را به‌ازای-صفحه پیاده‌سازی می‌کند** — اما با خطوط **قرمز** (`#E54D5E`، opacity `0.06`) در **۵۰px**، به اضافه orbهای متحرک. بنابراین الگو در محصول اثبات‌شده است؛ این کار آن را به یک کاغذ دیواری **سراسری، آگاه-از-تم** ارتقا می‌دهد.

### ۴.۳ token‌های اضافه‌شده (در `globals.css`)

```css
:root {
  /* light — grid opacity tuned up from the site's 0.045 so the wallpaper is
     actually visible on the dense dashboard (cards/chrome cover most of the viewport) */
  --grid-line: rgba(0, 0, 0, 0.07);
  --grid-size: 32px;
  --section-alt: rgba(0, 0, 0, 0.022);
}
.dark {
  /* dark — tuned up from 0.035 for the same reason */
  --grid-line: rgba(255, 255, 255, 0.06);
  --section-alt: rgba(255, 255, 255, 0.018);
}
```

### ۴.۴ بلوکر منفرد — حذف‌شده

گرید به‌طور ساختاری سراسری است (panel، `auth`/`login`، صفحات خطا — هر مسیر — را همزمان پوشش می‌دهد). دقیقاً **یک** عنصر آن را درون پنهان کرد:

- `src/shared/components/layouts/DashboardLayout.tsx` — wrapper بیرونی یک `bg-bg` کدر نقاشی می‌کرد. همه چیز زیر آن از قبل شفاف است (`<main>`، scroll container، `max-w-7xl` داخلی)، بنابراین **حذف `bg-bg`** اجازه می‌دهد گرید body از طریق ناحیه محتوا نمایش یابد (متغیر `--color-bg` body همچنان fill پایه می‌ماند).

  ```diff
  - <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-bg">
  + <div className="flex h-dvh min-h-0 w-full overflow-hidden">
  ```

### ۴.۵ تعامل chrome (sidebar / header)

- `Header` (`Header.tsx:207`, `bg-bg`) و `Sidebar` (`Sidebar.tsx:430`, `bg-sidebar`) **کدر** باقی می‌مانند ← گرید فقط در **ناحیه محتوا** نمایش می‌یابد، با chrome جامد آن را قاب می‌کند. پیش‌فرض آرام، با نحوه جداسازی chrome از canvas توسط سایت مطابقت دارد (تصمیم D3 = جامد).

### ۴.۶ صفحات login / auth / خطا

این‌ها مستقیماً زیر `<body>` render می‌شوند (بدون chrome پنل)، بنابراین گرید سراسری باید به‌طور خودکار پشت آن‌ها ظاهر شود. **فاز ۵ — انجام شد:** wrapper‌های full-screen standalone در واقع کدر بودند (`min-h-screen … bg-bg`، که در آن `bg-bg` همان fill جامد `<body>` است)، که گرید را روی هر صفحه غیر-داشبورد پنهان می‌کرد — نه فقط login. همه آن‌ها اکنون شفاف هستند تا کاغذ دیواری مشترک نمایش یابد: `login`, `forgot-password`, `callback`, `maintenance`, `offline`, `status`, `terms`, `privacy`, `onboarding`, و `ErrorPageScaffold` (پوشش‌دهنده `400`/`401`). این **D4** را می‌بندد (گسترش‌یافته از فقط-login به هر صفحه standalone). توسط `tests/unit/design-grid-background.test.ts` حفاظت می‌شود.

### ۴.۷ صفحه فرود

`landing/page.tsx` پس‌زمینه متحرک غنی‌تر خود را نگه می‌دارد (orbها + vignette) — splash بازاریابی مختص به خود (تصمیم D5 = دست‌نخورده بگذار).

---

## ۵. بخش B — یکپارچه‌سازی token

فاز ۱ token‌های هویتی inert، بدون برخورد را اضافه می‌کند (`--surface-2`/`--color-surface-2`, `--grad-brand`, `--radius`). فاز ۲ مقیاس radius را به Tailwind سیم‌کشی می‌کند و مؤلفه‌ها را repoint می‌کند؛ فاز ۴ `--font-mono` را با مصرف‌کنندگانش اضافه می‌کند.

| token                      | چرا                                                             | فاز                          |
| -------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `--radius` / `--radius-sm` | یک مقیاس radius (۱۴/۹) به جای ۶/۸/۱۲ ad-hoc                | ۱ (مقدار) / ۲ (سیم‌کشی + repoint) |
| `--grad-brand`             | گرادیانت برند برای CTAهای اصلی (قرمز←بنفش)، مطابقت با سایت | ۱ (token) / ۲ (Button)         |
| `--surface-2`              | پنل‌های nested / هدر جدول / ردیفهای inset                      | ۱                              |
| `--font-mono`              | بلوک‌های کد، ترمینال، IDها، endpointها                           | ۴                              |
| `--text-muted` آشتی   | یک مقدار را انتخاب کنید site↔panel (`#a1a1aa` توصیه‌شده)               | ۲                              |

**D2 (text-muted):** سایت `#8b8b9e` در مقابل داشبورد `#a1a1aa`. توصیه می‌شود **`#a1a1aa` داشبورد** نگه داشته شود و _سایت_ برای تطابق به‌روزرسانی شود. ظاهری.

---

## ۶. بخش C — استانداردسازی مؤلفه (فاز ۲-۴)

مؤلفه‌های سفارشی (بدون shadcn/Radix)، Tailwind v4، token‌های معنایی **عمدتاً** پذیرفته‌شده‌اند (۱۹۵ فایل barrel مشترک را import می‌کنند). کار حذف **عبورها** است. خانه: `src/shared/components/`.

| #   | مورد                                   | فایل(ها)                                                                                                                  | مشکل ← هدف                                                                                                    | فاز |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----- |
| C1  | **همراستایی radius**                   | `Button.tsx:14-18`, `Card.tsx:39`, `Modal.tsx`, `Input.tsx`, `Select.tsx`                                                | ترکیبی ۶/۸/۱۲px ← `--radius`/`--radius-sm` (۱۴/۹)                                                                    | ۲     |
| C2  | **گرادیانت Button + variant `accent`** | `Button.tsx:5-12`                                                                                                        | primary تخت قرمز←قرمز است؛ به `--grad-brand` همراست کنید؛ variant `accent` گمشده را اضافه کنید. ~۱۹۵ importer — بالاترین دیدپذیری | ۲     |
| C3  | **جدول‌ها**                             | `DataTable.tsx:122-176`, `logTableStyles.ts`, `globals.css:405-414`                                                      | ۱۰۰٪ rgba hardcoded inline + varهای غیرموجود؛ به token‌ها مهاجرت دهید، استایل‌های متفاوت را بازنشانی کنید                          | ۳     |
| C4  | **تمرکز رنگ‌های status**           | `flow/edgeStyles.ts`, `TokenHealthBadge.tsx`, `DegradationBadge.tsx`, `ProviderCascadeNode.tsx`, `Badge.tsx` + ۵ helper | ۶+ کپی از همان hex ← یک ماژول از `--color-success/warning/error`                                          | ۳     |
| C5  | **border Card**                        | `Card.tsx:39`                                                                                                            | `border-white/5` ← `/8` برند                                                                                       | ۲     |
| C6  | **آشتی focus ring** ✅ انجام شد       | `globals.css` `--focus-ring` (accent) در مقابل `ring-primary/30` کنترل‌های فرم                                                | روی **accent (بنفش)** یکپارچه شد تا با ring سراسری مطابقت کند + از ring خطای قرمز متمایز شود؛ خطا قرمز باقی می‌ماند     | ۴     |
| C7  | **افزودن `Checkbox` + `Textarea`**        | `<input>`/`<textarea>` خام با `accentColor:#6366f1` inline                                                               | primitive‌های مبتنی‌بر-token                                                                                             | ۴     |
| C8  | **جارو hex-hardcoded**                | `ConsoleLogViewer.tsx:240`, `ComboLiveStudio.tsx:306`, نقاط Modal، ~۱۴ فایل نمودار                                       | literal ← token                                                                                                   | ۴     |
| C9  | **`cn()` ← clsx + tailwind-merge**     | `src/shared/utils/cn.ts`                                                                                                 | کلاس‌های متضاد stack می‌شوند؛ برای override‌های C1 لازم است                                                                  | ۲     |

**از قبل on-brand (مبتنی‌بر-token، فقط radius لازم است):** `Badge`, `Toggle`, `SegmentedControl`, `Input`, `Select`.

---

## ۷. plan استقرار

- **فاز ۱ — گرید + token‌های هویت (این PR).** گرید `globals.css` + token‌های `--surface-2`/`--grad-brand`/`--radius`؛ کاغذ دیواری `body::before`؛ بلوکر `bg-bg` را حذف کنید؛ آزمون حفاظ static. ریسک کم، در یک commit قابل‌بازگشت.
- **فاز ۲ — primitive‌ها (C1, C2, C5) — در این PR انجام شد.** utility‌های radius معنایی `rounded-card` (۱۴px) / `rounded-control` (۹px) از طریق `@theme` اضافه شد (نام‌های سفارشی، بنابراین `rounded-sm/md/lg/xl` پیش‌فرض دست‌نخورده باقی می‌مانند — بدون انفجار ۴۰۰-فایلی)؛ Card/Modal ← ۱۴px، Button/Input/Select ← ۹px؛ Button primary ← `--grad-brand` (قرمز←بنفش) + variant `accent` جدید؛ borderهای Card ← token `border-border` (0.08). **به تعویق افتاده:** `cn()`←tailwind-merge (C9) به وابستگی‌های جدید نیاز دارد؛ جاروی ad-hoc `rounded-lg` (۳۲۶ فایل) همانطور که هست رها شده زیرا primitive‌ها بخش عمده سطح را حمل می‌کنند.
- **فاز ۳ — رنگ‌های status + جدول‌ها (C3, C4) — در این PR انجام شد.** ✅ **C4** (`src/shared/constants/statusColors.ts` — `STATUS_HEX` منبع واحد؛ `flow/edgeStyles.ts` + `TokenHealthBadge` repoint شد، وفادار/همان hex). ✅ **`--font-mono`** token. ✅ **C3 (DataTable)** — هر rgba inline و fallbackهای `var(--bg-table-header)` / `var(--text-secondary)` مرده را با یک مجموعه token `--table-*` (`--table-header-bg/-row-zebra/-row-hover/-cell-border/-row-selected`) جایگزین کرد که **مقدارهای تیره آن دقیقاً برابر با rgba hardcoded قدیمی است** (تیره بایت-یکسان) و مقدارهای روشن آن تم روشن همیشه-تیره پیشین را اصلاح می‌کند. border هدر ← `--color-border`، متن ثانویه ← `--color-text-muted`. **قبل از merge نیاز به بازبینی بصری دارد.** (دست‌نخورده: `logTableStyles.ts` و قواعد legacy Ant `.ant-table` — جداگانه، اولویت کمتر.)
- **فاز ۴ — پاکسازی (C6, C7, C9 انجام شد؛ C8 در انتظار).** ✅ **C9** `cn()` ← `twMerge(clsx(...))` (clsx + tailwind-merge به‌عنوان وابستگی اضافه شد) — اکنون `className` یک فراخوان به‌درستی کلاس متضاد یک primitive را _جایگزین_ می‌کند به جای stack کردن. ✅ **C7** primitive‌های جدید `Checkbox` + `Textarea` (مبتنی‌بر-token، از barrel صادر شده؛ افزودنی — adoption از ۳۲ checkbox خام / ۴۱ textarea خام می‌تواند به‌طور افزایشی پیگیری کند). ✅ **C6** آشتی focus-ring — کنترل‌های فرم (`Input`/`Select`/`Textarea`/`Toggle`/`Checkbox`) اکنون روی ring **accent (بنفش)** متمرکز می‌شوند تا با `--focus-ring` سراسری مطابقت کند و برای توقف برخورد با ring خطای قرمز؛ حالت خطای قرمز بدون تغییر است. ⏳ **C8 جاروی hex یک find/replace کور نیست** — متخلفان تأیید‌شده که _عمدی_ هستند و باید بمانند: `ConsoleLogViewer.tsx:240` (ترمینال همیشه-تیره)، popover `TokenHealthBadge`، strokeهای SVG در ReactFlow. فقط hex‌ای را مهاجرت دهید که واقعاً قرار است آگاه-از-تم باشد.

هر فاز: `npm run lint` + `npm run typecheck:core` + یک بازبینی بصری.

---

## ۸. تصمیمات باز (توصیه‌ها)

- **D1 — Button primary:** قرمز←قرمز نگه داشته شود یا به **قرمز←بنفش `--grad-brand`** تغییر کند؟ توصیه: **قرمز←بنفش** (فاز ۲).
- **D2 — رنگ خط گرید:** **خنثی** (سبک سایت) — انتخاب شده — در مقابل قرمز-برند. اندازه **۳۲px** (حدود ۳۰٪ از ۴۶px اصلی به بازخورد مالک کوچک شد — خانه‌های ۴۶px روی چیدمان داشبورد خیلی بزرگ خوانده می‌شوند).
- **D3 — زنده‌بودن chrome:** sidebar/header **جامد** — انتخاب شده.
- **D4 — گرید Auth/login:** ✅ **انجام شد (فاز ۵)** — `bg-bg` کدر از هر wrapper full-screen standalone حذف شد (نه فقط login)، بنابراین گرید روی همه صفحات نمایش می‌یابد. به §4.6 مراجعه کنید.
- **D5 — صفحه فرود:** splash متحرک را همانطور که هست رها کنید. انتخاب شده.
- **D6 — radius ۱۴/۹ در سراسر محصول:** توصیه: بله (فاز ۲).
- **D7 — فاز ۱ ابتدا عرضه می‌شود:** انتخاب شده.
- **D8 — عرض چیدمان (فاز ۵):** shell محتوای داشبورد به `max-w-7xl` (۱۲۸۰px) محدود بود، که روی مانیتورهای بزرگ با gutters کناری پهن خالی center می‌شد. ✅ **انجام شد** — به یک `max-w-[3840px]` سیال (۴K واقعی) ارتقا یافت: محتوا اکنون تا حدود ۴K از viewport پیروی می‌کند و فقط فراتر از آن center می‌شود (`DashboardLayout.tsx`). صفحات عمداً-باریک بر اساس طراحی باریک می‌مانند (`ProviderOnboardingWizard` max-w-5xl، `Rtk`/`CavemanContextPageClient` max-w-6xl).
- **D9 — جدول‌های داده کدر (فاز ۶):** با ناحیه محتوای داشبورد اکنون شفاف (تا کاغذ دیواری گرید نمایش یابد، فاز ۵)، جدول‌های داده که container آن‌ها یک سطح کدر _نبود_ اجازه می‌دادند گرید از ردیف‌های even شفاف / zebra alpha-پایین آنها نشت کند. ✅ **انجام شد** — هر جدول بدون-card اکنون `bg-surface` را نقاشی می‌کند (یا، برای primitive `<DataTable>`، `background: var(--color-surface)` روی scroll container آن). اصلاح شد: `DataTable` (primitive)، `ProxyLogger`/`RequestLoggerV2` (تنت `<Card>` `bg-black/5 dark:bg-black/20` آنها از طریق tailwind-merge بر `bg-surface` Card پیروز می‌شد ← حدود ۹۵٪ شفاف)، `BatchListTab`/`FilesListTab`/`CacheEntriesTab`/`ReasoningCacheTab`/`cache page`/`FreePoolTab`/`ModelMappingTable`/`HeaderTable`، به اضافه دو جدول "CSS-grid" در نمایه‌های cache (`bg-surface/35` ← `bg-surface`). جدول‌های از قبل درون `<Card>`/Modal را کدر راستی‌آزمایی شد و عمداً دست‌نخورده رها شد (bg-surface در آنجا یک no-op افزون است). خود گرید به **هیچ تغییری** نیاز نداشت — `body::before` داشبورد با سایت بایت-یکسان است (`--grid-size: 32px`)؛ هر «گرید بزرگ‌تر» دیده‌شده روی یک نمونه در حال اجرا، یک build stale pre-`#4143` است، نه کد. توسط `tests/unit/design-grid-background.test.ts` حفاظت می‌شود (بلاک فاز ۶).

---

## ۹. خارج از دامنه / ریسک‌ها

- **هیچ تغییر پالت** — رنگ‌ها از قبل مطابقت دارند؛ ما فقط token‌های گمشده را اضافه می‌کنیم. ریسک صفر رنگ‌آمیزی مجدد محصول.
- **هیچ تغییر موتور تم** — `.dark` + store Zustand را نگه دارید.
- **جابجایی radius (فاز ۲) گسترده است** — هر card/button/input را لمس می‌کند؛ صفحات شلوغ (جدول‌ها، modalها) را قبل از merge بررسی کنید.
- **جدول‌ها (C3)** بیشترین استایل hardcoded و بالاترین سطح regression را حمل می‌کنند — در PR مختص به خود ایزوله کنید.

---

## ۱۰. فهرست مرجع

| ناحیه                              | مسیر                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| token‌های داشبورد                  | `src/app/globals.css` (`:root`, `.dark`, `@theme inline`, `body`, `body::before`)                                    |
| store تم                       | `src/store/themeStore.ts`, `src/shared/components/ThemeProvider.tsx`, `src/shared/constants/appConfig.ts:9-11`       |
| shell پنل (گرید در اینجا unblock شد) | `src/shared/components/layouts/DashboardLayout.tsx`                                                                  |
| Chrome                            | `src/shared/components/Header.tsx:207`, `src/shared/components/Sidebar.tsx:430`                                      |
| سابقه گرید                    | `src/app/landing/page.tsx:16-26`                                                                                     |
| Primitive‌ها                        | `src/shared/components/{Button,Card,Input,Select,Badge,Modal,Toggle,SegmentedControl,Loading,Tooltip,DataTable}.tsx` |
| منابع رنگ status              | `flow/edgeStyles.ts`, `TokenHealthBadge.tsx`, `DegradationBadge.tsx`, `logTableStyles.ts`                            |
| util `cn`                         | `src/shared/utils/cn.ts`                                                                                             |
| آزمون حفاظ فاز ۱                | `tests/unit/design-grid-background.test.ts`                                                                          |
| مرجع سایت                    | `_mono_repo/omnirouteSite/css/tokens.css`, `css/base.css`                                                            |
