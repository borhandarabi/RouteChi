---
title: "حل زمان‌اجرا در SQLite"
---

# حل زمان‌اجرا در SQLite

RouteChi درایور SQLite خود را هنگام راه‌اندازی ازطریق یک زنجیرهٔ fallback ۵مرحله‌ای حل می‌کند:

۱. **`better-sqlite3` همراه بسته** (ازطریق `dependencies` در `package.json`)
   — سریع‌ترین، باینری بومی، توسط `npm install` هنگام وجود ابزارهای build نصب می‌شود.

۲. **`better-sqlite3` نصب‌شده در زمان‌اجرا** (در `~/.omniroute/runtime/`)
   — به‌صورت تنبل در اولین اجرا نصب می‌شود **یا** توسط `scripts/build/postinstall.mjs → scripts/postinstall.mjs`.
   پیش از بارگذاری، بایت‌های جادویی `.node` بومی (ELF / Mach-O / PE) را راستی‌آزمایی می‌کند
   تا در برابر باینری‌های خراب یا پلتفرم‌اشتباه محافظت کند.

۳. **`node:sqlite`** (Node ≥22.5 stdlib) — بدون نیاز به build بومی؛ زمانی استفاده می‌شود که
   هر دو مسیر better-sqlite3 شکست بخورند. مجموعه قابلیت محدود.

۴. **`sql.js`** (WASM) — fallback نهایی. همه‌جا کار می‌کند اما کندتر است
   و داده‌ها را به‌صورت دوره‌ای می‌نویسد نه به‌صورت همگام.

## چرا این پیچیدگی؟

- **EBUSY در ویندوز**: `npm install -g routechi@latest` می‌تواند شکست بخورد اگر
  `better_sqlite3.node` نسخهٔ قبلی توسط یک فرایند در حال اجرا قفل شده باشد. نصب در زمان‌اجرا
  در `~/.omniroute/runtime/` از کش سراسری npm عبور می‌کند.
- **بدون ابزار build**: برخی محیط‌ها (ویندوز شرکتی بدون VS Build
  Tools، imageهای Docker حداقلی) نمی‌توانند `better-sqlite3` را کامپایل کنند. نصب‌کنندهٔ زمان‌اجرا
  یک باینری از پیش ساخته‌شده از رجیستری npm حل می‌کند؛ درایورهای fallback
  تضمین می‌کنند که RouteChi حتی در صورت شکست آن، راه‌اندازی شود.
- **سیستم‌های air-gapped**: اگر رجیستری npm در دسترس نباشد، `node:sqlite`
  یا `sql.js` کارکرد پایه را تضمین می‌کنند.

## راستی‌آزمایی بایت جادویی

پیش از بارگذاری یک فایل `.node` نصب‌شده در زمان‌اجرا، RouteChi ۸ بایت اول را می‌خواند
و با جادویی‌های پلتفرن شناخته‌شده تطبیق می‌دهد:

| پلتفرم               | بایت‌ها (hex) | برچسب       |
| -------------------- | -------------- | ----------- |
| Linux                | `7F 45 4C 46`  | `elf`       |
| macOS 64-bit BE      | `FE ED FA CF`  | `macho`     |
| macOS 64-bit LE      | `CF FA ED FE`  | `macho-le`  |
| macOS fat (universal)| `CA FE BA BE`  | `macho-fat` |
| Windows              | `4D 5A` (MZ)   | `pe`        |

جادویی نامطباق → فایل نادیده گرفته می‌شود، fallback به مرحلهٔ بعد ادامه می‌یابد.

## بررسی درایور فعال

```typescript
import { getDriverInfo } from "@/lib/db/core";

const info = getDriverInfo();
// { source: "bundled" | "runtime" | "runtime-installed-now" | "node-sqlite" | "sql-js",
//   kind: "better-sqlite3" | "node-sqlite" | "sql-js" }
```

## کنترل دستی

```bash
# Skip postinstall warm-up (for fast CI installs)
OMNIROUTE_SKIP_POSTINSTALL=1 npm install -g routechi

# Force-reinstall runtime better-sqlite3
rm -rf ~/.omniroute/runtime
routechi  # will reinstall on next start

# Check what driver is active
routechi config db-info  # (if CLI command exists)
```

## مرجع

پیاده‌سازی:

- `bin/cli/runtime/magicBytes.mjs` — توابع کمکی راستی‌آزمایی بایت جادویی باینری
- `bin/cli/runtime/sqliteRuntime.mjs` — حل‌کنندهٔ زمان‌اجرا ۵مرحله‌ای + نصب‌کنندهٔ تنبل
- `bin/cli/runtime/index.mjs` — هماهنگ‌کنندهٔ راه‌اندازی (`warmUpRuntimes()`)
- `scripts/postinstall.mjs` — hook پس از نصب npm (گرم‌کردن غیربحرانی)
- `src/lib/db/core.ts` — صادرات `ensureDbInitialized()` / `getDriverInfo()`
