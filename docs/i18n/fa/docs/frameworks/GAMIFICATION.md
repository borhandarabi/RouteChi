---
title: "سیستم گیمیفیکیشن و تابلوی امتیازات"
version: 3.8.40
lastUpdated: 2026-06-28
---

# سیستم گیمیفیکیشن و تابلوی امتیازات

> **منبع اصلی:** `src/lib/gamification/`, `src/lib/db/gamification.ts`, `src/app/api/gamification/`
> **آخرین به‌روزرسانی:** 2026-06-28 — v3.8.40

RouteChi شامل یک لایه‌ی گیمیفیکیشن local-first است که کاربران را به‌خاطر مشارکت با
پلتفرم پاداش می‌دهد — درخواست‌ دادن، تغییر provider، ایجاد comboها، اشتراک توکن،
و کمک به جامعه. همه‌ی وضعیت‌ها در SQLite ذخیره می‌شوند؛ فدراسیون با سرورهای جامعه
اختیاری و از نوع push-based است.

این سیستم طوری طراحی شده که **روی مسیر داغ بدون تأخیر** باشد — رویدادهای گیمیفیکیشن
به‌صورت fire-and-forget از pipeline درخواست ارسال می‌شوند و هرگز یک پاسخ LLM را
مسدود نمی‌کنند.

---

## نمای کلی

### هدف

افزایش مشارکت و نگه‌داشت کاربر با ارائه‌ی پیشرفت قابل‌مشاهده (XP، سطوح، نشان‌ها)،
اثبات اجتماعی (تابلوی امتیازات) و مشوق‌های اقتصادی (اشتراک توکن، پاداش‌های دعوت).

### محدوده

| قابلیت            | توضیحات                                                       |
| ----------------- | ------------------------------------------------------------- |
| XP و سطوح         | کسب XP به ازای هر اقدام؛ ارتقا سطح در امتداد یک منحنی چندجمله‌ای |
| نشان‌ها           | بیش از ۲۰ دستاورد در ۵ دسته با ۴ سطح کمیابی                  |
| Streakها          | پیگیری استفاده‌ی فعال روزانه با streak فعلی/طولانی‌ترین        |
| تابلوهای امتیازات  | حوزه‌های جهانی، هفتگی، ماهانه، اشتراک توکن و مشارکت            |
| اشتراک توکن       | انتقال اعتبار بین کاربران از طریق دفتر ثبت دوطرفه             |
| دعوت و بازخرید     | کدهای ارجاع با ذخیره‌سازی هش‌شده‌ی SHA-256                     |
| سرورهای جامعه     | فدراسیون با instanceهای خارجی RouteChi                        |
| ضدتقلب            | امتیازدهی سمت سرور، محدودسازی نرخ، تشخیص ناهنجاری z-score      |

### اصول طراحی

1. **Local-first** — همه‌ی وضعیت‌ها در SQLite، بدون نیاز به سرویس‌های خارجی.
2. **غیرمسدودکننده** — رویدادها fire-and-forget هستند؛ مسیر پاسخ LLM هرگز
   توسط منطق گیمیفیکیشن به تأخیر نمی‌افتد.
3. **سرور-مقتدر** — XP فقط سمت سرور محاسبه می‌شود؛ کلاینت‌ها نمی‌توانند
   امتیازات را افزایش دهند.
4. **احترام به حریم خصوصی** — شرکت در تابلوی امتیازات اختیاری است؛ کاربران
   می‌توانند پروفایل خود را مخفی کنند.
5. **آماده‌ی فدراسیون** — سرورهای جامعه می‌توانند امتیازات را از طریق API امضاشده
   ارسال کنند؛ همگام‌سازی از نوع overwrite است، نه افزودنی.

---

## معماری

### جریان کلی

```
Client Request
  → /v1/chat/completions
    → handleChatCore()                      [open-sse/handlers/chatCore.ts]
      → ... (existing pipeline) ...
      → upstream response sent to client
      → setImmediate (fire-and-forget):
        → emitGamificationEvent()           [src/lib/gamification/events.ts]
          → awardXp()                       [src/lib/gamification/xp.ts]
          → updateStreak()                  [src/lib/gamification/streaks.ts]
          → evaluateBadges()                [src/lib/gamification/badges.ts]
          → updateLeaderboard()             [src/lib/gamification/leaderboard.ts]
          → checkAnomalies()                [src/lib/gamification/antiCheat.ts]
```

منتشرکننده‌ی رویداد تنها نقطه‌ی یکپارچه‌سازی است. `chatCore.ts` پس از ارسال پاسخ،
`emitGamificationEvent()` را فراخوانی می‌کند؛ ماژول رویداد به زیرسیستم‌های XP،
streak، نشان، تابلوی امتیازات و ضدتقلب فن‌اوت می‌شود.

### نمودار وابستگی ماژول‌ها

```
src/lib/gamification/
  events.ts          ← entry point (called from chatCore.ts)
    ├── xp.ts        ← XP calculation & level resolution
    ├── streaks.ts   ← daily active streak tracking
    ├── badges.ts    ← badge criteria evaluation
    ├── leaderboard.ts ← rank computation & SSE broadcasting
    ├── antiCheat.ts ← rate limiting & anomaly detection
    ├── sharing.ts   ← token transfer ledger
    ├── invites.ts   ← invite/redeem code management
    ├── servers.ts   ← community server federation
    └── notifications.ts ← SSE notification stream

src/lib/db/
  gamification.ts    ← all CRUD operations (8 tables)

src/app/api/gamification/
  leaderboard/       ← GET rankings, POST manual refresh
  leaderboard/stream ← SSE real-time updates
  transfer/          ← GET history, POST send tokens
  invite/            ← GET/POST codes, DELETE revoke
  invite/redeem/     ← POST redeem a code
  servers/           ← GET/POST/DELETE community servers
  federation/score/  ← POST push score to server
  federation/leaderboard/ ← GET pull leaderboard from server
  notifications/     ← SSE badge/level-up notifications
  anomalies/         ← GET anomaly reports (admin)
  rotate/            ← POST rotate invite token secrets
```

---

## لایه‌ی داده

### جداول پایگاه داده

همه‌ی جداول در پایگاه داده‌ی اصلی SQLite مربوط به RouteChi قرار دارند و توسط
migration `060_create_gamification.sql` ایجاد می‌شوند. WAL journaling از singleton
`getDbInstance()` در `src/lib/db/core.ts` به ارث می‌رسد.

```
┌─────────────────────────┐     ┌──────────────────────────┐
│      leaderboard        │     │      user_levels          │
├─────────────────────────┤     ├──────────────────────────┤
│ id            TEXT PK   │     │ api_key_id    TEXT PK    │
│ api_key_id    TEXT      │     │ xp            INTEGER    │
│ scope         TEXT      │     │ level         INTEGER    │
│ score         INTEGER   │     │ title         TEXT       │
│ period        TEXT      │     │ updated_at    TEXT       │
│ updated_at    TEXT      │     └──────────────────────────┘
└─────────────────────────┘
                │
                │ 1:N
                ▼
┌─────────────────────────┐     ┌──────────────────────────┐
│     user_badges         │     │    badge_definitions      │
├─────────────────────────┤     ├──────────────────────────┤
│ id            TEXT PK   │     │ id            TEXT PK    │
│ api_key_id    TEXT      │     │ name          TEXT       │
│ badge_id      TEXT FK   │     │ category      TEXT       │
│ earned_at     TEXT      │     │ rarity        TEXT       │
│ notified      INTEGER   │     │ criteria_type TEXT       │
└─────────────────────────┘     │ criteria      TEXT(JSON) │
                                │ description   TEXT       │
                                │ icon          TEXT       │
                                │ hidden        INTEGER    │
                                └──────────────────────────┘

┌─────────────────────────┐     ┌──────────────────────────┐
│     xp_audit_log        │     │     token_ledger         │
├─────────────────────────┤     ├──────────────────────────┤
│ id            TEXT PK   │     │ id            TEXT PK    │
│ api_key_id    TEXT      │     │ from_key_id   TEXT       │
│ action        TEXT      │     │ to_key_id     TEXT       │
│ xp_awarded    INTEGER   │     │ amount        INTEGER    │
│ metadata      TEXT(JSON)│     │ idempotency_key TEXT UQ  │
│ created_at    TEXT      │     │ created_at    TEXT       │
└─────────────────────────┘     └──────────────────────────┘

┌─────────────────────────┐     ┌──────────────────────────┐
│    invite_tokens        │     │   community_servers      │
├─────────────────────────┤     ├──────────────────────────┤
│ id            TEXT PK   │     │ id            TEXT PK    │
│ api_key_id    TEXT      │     │ name          TEXT       │
│ code          TEXT UQ   │     │ url           TEXT       │
│ token_hash    TEXT      │     │ token_hash    TEXT       │
│ uses          INTEGER   │     │ status        TEXT       │
│ max_uses      INTEGER   │     │ last_sync     TEXT       │
│ created_at    TEXT      │     │ created_at    TEXT       │
│ expires_at    TEXT      │     └──────────────────────────┘
└─────────────────────────┘
```

### ماژول دامنه: `src/lib/db/gamification.ts`

از الگوی استاندارد RouteChi پیروی می‌کند — `getDbInstance()` را از
`core.ts` وارد کرده و توابع CRUD تایپ‌شده را صادر می‌کند. هیچ SQL خامی در
route handlerها وجود ندارد.

توابع کلیدی:

| تابع                       | توضیحات                                                |
| -------------------------- | ------------------------------------------------------ |
| `upsertLeaderboardEntry()` | درج یا به‌روزرسانی امتیاز برای (api_key_id, scope, period) |
| `getLeaderboard()`         | رتبه‌بندی صفحه‌بندی‌شده برای یک scope/period داده‌شده    |
| `getUserLevel()`           | دریافت یا ایجاد رکورد سطح کاربر                        |
| `updateUserLevel()`        | تنظیم XP، سطح و عنوان به‌صورت اتمیک                    |
| `getBadgeDefinitions()`    | همه‌ی تعاریف نشان‌ها (اختیاری فیلتر‌شده)                |
| `getUserBadges()`          | نشان‌های کسب‌شده توسط یک کاربر                         |
| `awardBadge()`             | درج کسب نشان (idempotent روی badge_id)                |
| `logXpAction()`            | اضافه‌کردن به xp_audit_log                             |
| `getXpAuditLog()`          | تاریخچه‌ی ممیزی صفحه‌بندی‌شده برای یک کاربر            |
| `insertLedgerEntry()`      | انتقال دوطرفه (داخل تراکنش)                            |
| `getBalance()`             | جمع دریافتی منهای ارسالی برای یک کاربر                 |
| `getTransferHistory()`     | ثبت انتقال صفحه‌بندی‌شده                               |
| `createInviteToken()`      | درج کد دعوت + توکن هش‌شده                              |
| `redeemInviteToken()`      | جستجو بر اساس کد، اعتبارسنجی، افزایش استفاده‌ها       |
| `upsertCommunityServer()`  | ثبت یا به‌روزرسانی سرور فدراسیون                       |
| `getCommunityServers()`    | فهرست سرورها برای یک کاربر                             |
| `deleteCommunityServer()`  | حذف ثبت یک سرور                                        |

---

## سیستم XP / سطح

**فایل:** `src/lib/gamification/xp.ts`

### منحنی سطح

XP مورد نیاز برای رسیدن به سطح `n` از یک منحنی چندجمله‌ای پیروی می‌کند:

```
xp_for_level(n) = floor(100 * n^1.5)
```

| سطح | XP تا بعدی | XP تجمعی  | عنوان    |
| --- | ---------- | --------- | -------- |
| 1   | 100        | 100       | Beginner |
| 5   | 1,118      | 2,415     | Beginner |
| 10  | 3,162      | 10,523    | Explorer |
| 25  | 12,500     | 86,024    | Explorer |
| 50  | 35,355     | 345,529   | Expert   |
| 75  | 64,952     | 948,683   | Master   |
| 100 | 100,000    | 2,050,000 | Legend   |

### عناوین

| بازه‌ی سطح | عنوان    |
| ---------- | -------- |
| 1 – 9      | Beginner |
| 10 – 24    | Explorer |
| 25 – 49    | Expert   |
| 50 – 74    | Master   |
| 75 – 100   | Legend   |

### پاداش‌های XP

| اقدام             | XP  | توضیحات                                                |
| ----------------- | --- | ------------------------------------------------------ |
| `request`         | 1   | به ازای هر درخواست موفق LLM                            |
| `provider_switch` | 5   | تغییر به یک provider متفاوت                            |
| `combo_create`    | 10  | ایجاد یک پیکربندی combo جدید                          |
| `combo_use`       | 2   | استفاده از یک combo (به ازای هر هدف برخورد‌شده)        |
| `badge_earned`    | 25  | کسب هر نشان                                            |
| `streak_milestone`| 15  | رسیدن به یک نقطه‌ی عطف streak (۷، ۱۴، ۳۰، ۶۰، ۹۰، ۱۸۰، ۳۶۵) |
| `referral`        | 50  | ارجاع موفق یک کاربر جدید                               |
| `token_share`     | 5   | اشتراک توکن با کاربر دیگر                              |
| `daily_login`     | 3   | اولین درخواست روز                                      |
| `model_diversity` | 3   | استفاده از مدلی که در ۷ روز گذشته استفاده نشده        |
| `compression_use` | 2   | استفاده از فشرده‌سازی prompt                           |
| `skill_use`       | 2   | اجرای یک مهارت از طریق MCP                             |

### جریان اعطای XP

```typescript
export async function awardXp(
  apiKeyId: string,
  action: XpAction,
  metadata?: Record<string, unknown>
): Promise<{ xp: number; level: number; title: string; levelUp: boolean }>;
```

1. جستجوی `XP_REWARDS[action]` برای دریافت مقدار XP.
2. عبور از `checkRateLimit()` (ضدتقلب: حداکثر ۱۰۰۰ XP/دقیقه به ازای هر کلید).
3. باز کردن یک تراکنش:
   - خواندن ردیف `user_levels` فعلی.
   - افزودن XP؛ محاسبه‌ی مجدد سطح از طریق `levelFromXp(totalXp)`.
   - اگر سطح تغییر کرد، تنظیم `levelUp = true`.
   - به‌روزرسانی ردیف `user_levels`.
   - درج در `xp_audit_log`.
4. بازگرداندن نتیجه. فراخوانی‌کننده اعلان‌ها را مدیریت می‌کند.

### کمکی: `levelFromXp(totalXp)`

سطوح ۱ تا ۱۰۰ را پیمایش کرده و `xp_for_level(n)` را جمع می‌زند تا XP تجمعی از
`totalXp` بیشتر شود. بالاترین سطحی که آستانه‌ی آن برآورده شده را برمی‌گرداند.
این O(100) است — قابل‌قبول چون سطوح به ۱۰۰ محدود می‌شوند.

---

## سیستم نشان‌ها

**فایل:** `src/lib/gamification/badges.ts`

### دسته‌ها

| دسته          | توضیحات                       | نمونه نشان‌ها                       |
| ------------- | ----------------------------- | ----------------------------------- |
| `usage`       | نقاط عطف مبتنی بر حجم         | First Request، 1K Requests، 100K    |
| `sharing`     | اشتراک توکن و ارجاع‌ها        | First Share، Generous (10 shares)   |
| `contribution`| مشارکت جامعه                  | Combo Creator، Provider Explorer    |
| `streak`      | استمرار در طول زمان           | Week Warrior، Monthly Devoted       |
| `rare`        | دستاوردهای سخت یا مخفی        | Early Adopter، Bug Reporter         |

### کمیابی‌ها

| کمیابی     | رنگ  | اشاره‌ی احتمال |
| ---------- | ----- | -------------- |
| `common`   | خاکستری | اکثر کاربران    |
| `uncommon` | سبز   | کاربران فعال    |
| `rare`     | آبی   | کاربران تعهددار |
| `legendary`| طلایی | ۱٪ برتر         |

### انواع معیارها

| نوع            | فیلد        | توضیحات                                              |
| -------------- | ----------- | ---------------------------------------------------- |
| `action_count` | `count`     | انجام اقدام N بار (مثلاً ۱۰۰۰ درخواست)              |
| `streak`       | `days`      | حفظ streak به مدت N روز متوالی                       |
| `unique_count` | `field`, `n`| استفاده از N مقدار یکتا (مثلاً ۱۰ مدل متفاوت)        |
| `rank`         | `scope`, `n`| رسیدن به رتبه‌ی N در یک scope تابلوی امتیازات        |
| `first`        | —           | اولین کسی بودن که یک اقدام را انجام می‌دهد           |
| `hidden`       | (متغیر)     | معیارها تا زمان کسب نمایش داده نمی‌شوند              |

تعاریف نشان‌ها در `badge_definitions` به‌صورت JSON `criteria` ذخیره می‌شوند:

```json
{
  "type": "action_count",
  "action": "request",
  "count": 1000
}
```

### جریان ارزیابی

```
emitGamificationEvent(event)
  → evaluateBadges(apiKeyId, event)
    → getBadgeDefinitions()           # all definitions
    → getUserBadges(apiKeyId)         # already earned (skip)
    → for each unearned badge:
       → matchesCriteria(badge, event, userState)
       → if match: awardBadge(apiKeyId, badgeId)
         → return notification payload
```

ارزیابی **event-driven** است — پس از هر رویداد گیمیفیکیشن اجرا می‌شود، اما
فقط نشان‌هایی را بررسی می‌کند که `criteria.type` آن‌ها با اقدام رویداد همسو است.
این کار ارزیابی را سریع نگه می‌دارد (کمتر از ۵ms برای اکثر رویدادها).

### `matchesCriteria(badge, event, userState)`

| نوع معیار       | بررسی                                              |
| --------------- | -------------------------------------------------- |
| `action_count`  | `getActionCount(apiKeyId, action) >= count`        |
| `streak`        | `getCurrentStreak(apiKeyId) >= days`               |
| `unique_count`  | `getUniqueCount(apiKeyId, field) >= n`             |
| `rank`          | `getRank(apiKeyId, scope) <= n`                    |
| `first`         | هیچ ورودی قبلی `xp_audit_log` برای این نوع اقدام    |
| `hidden`        | به زیر‌بررسی مناسب تفویض می‌کند                     |

### نشان‌های داخلی (بیش از ۲۰)

<details>
<summary>فهرست کامل نشان‌ها</summary>

| نشان                | دسته        | کمیابی    | معیار                          |
| ------------------- | ----------- | --------- | ------------------------------ |
| First Steps         | usage       | common    | 1 request                      |
| Getting Warmed Up   | usage       | common    | 100 requests                   |
| Power User          | usage       | uncommon  | 1,000 requests                 |
| Centurion           | usage       | rare      | 10,000 requests                |
| OmniPower           | usage       | legendary | 100,000 requests               |
| Provider Hopper     | contribution| common    | Use 5 different providers      |
| Provider Master     | contribution| uncommon  | Use 20 different providers     |
| Combo Architect     | contribution| uncommon  | Create 5 combos                |
| Combo Grandmaster   | contribution| rare      | Create 25 combos               |
| First Share         | sharing     | common    | 1 token transfer               |
| Generous            | sharing     | uncommon  | 10 token transfers             |
| Philanthropist      | sharing     | rare      | Transfer 10,000 tokens total   |
| Referrer            | sharing     | common    | 1 successful referral          |
| Network Builder     | sharing     | uncommon  | 10 successful referrals        |
| Week Warrior        | streak      | uncommon  | 7-day streak                   |
| Monthly Devoted     | streak      | rare      | 30-day streak                  |
| Unstoppable         | streak      | legendary | 365-day streak                 |
| Early Adopter       | rare        | legendary | Join during beta period        |
| Compression Pioneer | rare        | uncommon  | Use compression 100 times      |
| Skill Collector     | rare        | rare      | Use 10 different skills        |
| Model Explorer      | contribution| uncommon  | Use 15 different models        |

</details>

---

## ردیاب Streak

**فایل:** `src/lib/gamification/streaks.ts`

### مدل داده

Streakها در جدول `key_value` (جدول کمکی مشترک) تحت کلیدهای
namespaced ذخیره می‌شوند:

| کلید                          | مقدار                            | توضیحات            |
| ----------------------------- | -------------------------------- | ------------------ |
| `gamification:streak:{keyId}` | `{current},{longest},{lastDate}` | داده‌ی streak فعال |

### منطق

```typescript
export async function updateStreak(
  apiKeyId: string
): Promise<{ current: number; longest: number; milestone: boolean }>;
```

1. خواندن رکورد streak از `key_value`.
2. parse کردن `{current}`، `{longest}`، `{lastDate}` (رشته‌ی تاریخ ISO).
3. اگر `lastDate === today` — بدون تغییر (امروز قبلاً شمارش شده).
4. اگر `lastDate === yesterday` — افزایش `current`؛ به‌روزرسانی `longest` در صورت نیاز.
5. اگر `lastDate < yesterday` — بازنشانی `current = 1` (streak شکسته شد).
6. نوشتن رکورد به‌روزرسانی‌شده.
7. بررسی نقاط عطف: ۷، ۱۴، ۳۰، ۶۰، ۹۰، ۱۸۰، ۳۶۵ روز. در صورت عبور، تنظیم
   `milestone = true` (فراخوانی‌کننده XP اهدا کرده و نشان‌ها را بررسی می‌کند).

### موارد لبه‌ای

- **منطقه‌ی زمانی**: streakها از تاریخ‌های UTC استفاده می‌کنند
  (`new Date().toISOString().slice(0, 10)`). این عمدی است — یک منطقه‌ی زمانی
  یکپارچه از تقلب با جابجایی منطقه‌ی زمانی جلوگیری می‌کند.
- **کاربران جدید**: هیچ رکورد streakی وجود ندارد؛ اولین درخواست آن را با
  `current=1, longest=1, lastDate=today` ایجاد می‌کند.
- **چندین درخواست در روز**: فقط اولین درخواست روز UTC، streak را افزایش می‌دهد.

---

## تابلوی امتیازات

**فایل:** `src/lib/gamification/leaderboard.ts`

### حوزه‌ها

| حوزه            | دوره    | توضیحات                                       |
| --------------- | ------- | --------------------------------------------- |
| `global`        | `all`   | XP تجمعی در کل زمان                            |
| `weekly`        | `week`  | XP کسب‌شده در هفته‌ی UTC جاری (دوشنبه-یکشنبه) |
| `monthly`       | `month` | XP کسب‌شده در ماه UTC جاری                    |
| `tokens_shared` | `all`   | کل توکن‌های منتقل‌شده به دیگران                |
| `contributions` | `all`   | comboهای ایجاد‌شده + providerهای استفاده‌شده + مهارت‌های استفاده‌شده |

### محاسبه‌ی رتبه

رتبه‌ها **در زمان خواندن محاسبه می‌شوند**، نه ذخیره. این کار از داده‌ی رتبه‌ی کهنه
جلوگیری کرده و نیاز به jobهای دوره‌ای محاسبه‌ی مجدد رتبه را حذف می‌کند.

```typescript
export async function getLeaderboard(
  scope: LeaderboardScope,
  period: string,
  limit: number,
  offset: number
): Promise<{ entries: LeaderboardEntry[]; total: number }>;
```

الگوی کوئری:

```sql
SELECT api_key_id, score,
       RANK() OVER (ORDER BY score DESC) as rank
FROM leaderboard
WHERE scope = ? AND period = ?
ORDER BY score DESC
LIMIT ? OFFSET ?
```

### چرخش دوره‌ای

تابلوی امتیازات هفتگی و ماهانه به‌طور خودکار چرخش می‌کنند:

1. **بایگانی**: در مرز دوره، ورودی‌های فعلی را در
   `leaderboard_archive` با برچسب دوره کپی کنید.
2. **بازنشانی**: ورودی‌های دوره‌ی منقضی را حذف کنید.
3. **ماشه**: در هر فراخوانی `updateLeaderboard()` بررسی می‌شود؛ اولین درخواست
   یک دوره‌ی جدید، چرخش را راه می‌اندازد.

این تضمین می‌کند که تابلوهای هفتگی هر دوشنبه ساعت ۰۰:۰۰ UTC و تابلوهای ماهانه
در اول هر ماه بازنشانی می‌شوند.

### به‌روزرسانی‌های بلادرنگ SSE

**Endpoint:** `GET /api/gamification/stream`

```
Client → GET /api/gamification/stream
  → SSE connection established
  → Server sends top-10 leaderboard snapshot immediately
  → Every 5 seconds: push updated top-10 if changed
  → Every 15 seconds: heartbeat comment (": heartbeat\n\n")
  → Client disconnects → cleanup (remove listener)
```

فرمت رویداد:

```
event: leaderboard
data: {"scope":"global","entries":[...]}

event: leaderboard
data: {"scope":"weekly","entries":[...]}

: heartbeat
```

مدیریت‌کننده‌ی SSE کلاینت‌های متصل را به ازای هر scope پیگیری می‌کند و فقط وقتی
داده‌ی تابلوی امتیازات از آخرین push واقعاً تغییر کرده باشد، به‌روزرسانی می‌فرستد.

---

## اشتراک توکن

**فایل:** `src/lib/gamification/sharing.ts`

### دفتر ثبت دوطرفه

هر انتقال دو ردیف در `token_ledger` ایجاد می‌کند:

| ردیف   | `from_key_id` | `to_key_id` | `amount` |
| ------ | ------------- | ----------- | -------- |
| Debit  | sender        | receiver    | +amount  |
| Credit | receiver      | sender      | -amount  |

صبر کنید — قرارداد به این شکل است:

| ردیف    | `from_key_id` | `to_key_id` | `amount` | معنی               |
| ------- | ------------- | ----------- | -------- | ------------------ |
| Send    | sender        | receiver    | +amount  | خروجی از sender     |
| Receive | receiver      | sender      | +amount  | ورودی به receiver   |

موجودی به این شکل محاسبه می‌شود:

```sql
SELECT
  COALESCE(SUM(CASE WHEN to_key_id = ? THEN amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN from_key_id = ? THEN amount ELSE 0 END), 0)
  AS balance
FROM token_ledger
WHERE from_key_id = ? OR to_key_id = ?
```

### جریان انتقال

```typescript
export async function transferTokens(
  fromKeyId: string,
  toKeyId: string,
  amount: number,
  idempotencyKey: string
): Promise<{ success: boolean; balance: number }>;
```

1. **اعتبارسنجی**: `amount > 0`، `fromKeyId !== toKeyId`.
2. **Idempotency**: بررسی اینکه آیا `idempotency_key` قبلاً در ledger وجود دارد.
   اگر بله، بازگرداندن نتیجه‌ی کش‌شده.
3. **تراکنش** (یک تراکنش SQLite):
   a. محاسبه‌ی موجودی sender.
   b. اگر `balance < amount`، سقط (موجودی ناکافی).
   c. درج ردیف send (`from=sender, to=receiver, amount`).
   d. درج ردیف receive (`from=receiver, to=sender, amount`).
4. **محدودسازی نرخ**: بررسی نرخ انتقال برای sender (حداکثر ۱۰ انتقال/دقیقه).
5. **رویداد**: انتشار رویداد گیمیفیکیشن `token_share` برای ارزیابی XP + نشان.
6. بازگرداندن `{ success: true, balance: newBalance }`.

### محدودسازی نرخ

- حداکثر ۱۰ انتقال در دقیقه به ازای هر API key.
- حداکثر ۱۰,۰۰۰ توکن در یک انتقال واحد.
- حداکثر ۱۰۰,۰۰۰ توکن منتقل‌شده در روز به ازای هر API key.

---

## توکن‌های دعوت و بازخرید

**فایل:** `src/lib/gamification/invites.ts`

### فرمت کد

- **کد**: ۸ کاراکتر الفبایی-عددی (مثلاً `A3K9-X7M2`)، قابل‌خواندن توسط انسان،
  به کاربر نمایش داده می‌شود.
- **توکن**: ۳۲ بایت توکن تصادفی، به‌صورت هش SHA-256 ذخیره می‌شود. برای
  بازخرید برنامه‌نویسی‌شده (مثلاً لینک‌های URL) استفاده می‌شود.

### ذخیره‌سازی

| ستون       | مقدار                        |
| ---------- | ---------------------------- |
| `code`     | `A3K9X7M2` (یکتا، ایندکس‌شده) |
| `token_hash`| SHA-256(raw_token)           |

توکن خام دقیقاً یک بار در زمان ایجاد به کاربر بازگردانده می‌شود. RouteChi
هرگز دوباره آن را ذخیره یا نمایش نمی‌دهد — فقط هش باقی می‌ماند.

### جلوگیری از خودارجاعی

وقتی کاربر کدی را بازخرید می‌کند، سیستم بررسی می‌کند:

1. کد متعلق به `api_key_id` دیگری است.
2. کاربرِ بازخریدکننده قبلاً هیچ کدی از همان
   ارجاع‌دهنده بازخرید نکرده است (join روی `invite_tokens` + ثبت بازخرید).

اگر هر بررسی شکست بخورد، بازخرید با یک پیام خطای واضح رد می‌شود.

### انقضا و محدودیت‌ها

- `max_uses` پیش‌فرض: ۱۰ (قابل پیکربندی در زمان ایجاد).
- `expires_at` پیش‌فرض: ۳۰ روز پس از ایجاد.
- کدهای منقضی‌شده یا تمام‌شده HTTP 410 Gone برمی‌گردانند.

---

## فدراسیون سرور جامعه

**فایل:** `src/lib/gamification/servers.ts`

### اتصال

یک سرور جامعه از طریق یک توکن دعوت صادرشده توسط سرور ریموت ثبت می‌شود.
instance محلی:

1. دریافت توکن دعوت (مثلاً در داشبورد paste می‌شود).
2. فراخوانی `POST /api/gamification/federation/leaderboard` روی سرور ریموت
   برای اعتبارسنجی توکن و دریافت تابلوی امتیازات فعلی.
3. ذخیره‌ی رکورد سرور با `status: connected`.

### مدل همگام‌سازی

فدراسیون از **همگام‌سازی overwrite** استفاده می‌کند، نه افزودنی:

```
Local Instance                Community Server
     │                              │
     ├── push score ───────────────►│  POST /federation/score
     │   { api_key_id, score }      │  (server validates token hash)
     │                              │
     ├── pull leaderboard ─────────►│  GET /federation/leaderboard
     │◄── top-N entries ────────────┤  (overwrites local cache)
     │                              │
     └── health check ─────────────►│  GET /federation/health
         (every 60s, timeout 5s)    │
```

### احراز هویت

درخواست‌های فدراسیون شامل موارد زیر است:

```
Authorization: Bearer <raw_token>
X-Federation-Version: 1
```

سرور ریموت توکن را هش کرده و ردیف `community_servers` منطبق را جستجو می‌کند.
این کار از ارسال هش ذخیره‌شده جلوگیری می‌کند.

### پایش سلامت

هر رکورد سرور پیگیری می‌کند:

| فیلد       | توضیحات                            |
| ---------- | ---------------------------------- |
| `status`   | `connected`، `degraded`، `unreachable` |
| `last_sync`| timestamp ISO آخرین همگام‌سازی موفق |
| `failures` | شکست‌های متوالی بررسی سلامت         |

پس از ۵ شکست متوالی، وضعیت به `unreachable` تغییر کرده و همگام‌سازی تا زمانی
که یک بررسی سلامت دستی موفق شود، متوقف می‌گردد.

---

## ضدتقلب

**فایل:** `src/lib/gamification/antiCheat.ts`

### امتیازدهی سمت سرور

همه‌ی محاسبات XP در `src/lib/gamification/xp.ts` انجام می‌شود. کلاینت‌ها هرگز
امتیازی ارسال نمی‌کنند — آن‌ها اقدامات را ارسال می‌کنند و سرور XP را محاسبه
می‌کند. ستون `leaderboard.score` فقط توسط کد سمت سرور قابل‌نوشتن است.

### محدودسازی نرخ

| محدودیت                  | مقدار  | محدوده        |
| ------------------------ | ------ | ------------- |
| حداکثر XP در دقیقه       | 1,000  | به ازای هر API key |
| حداکثر انتقال در دقیقه   | 10     | به ازای هر API key |
| حداکثر مبلغ انتقال       | 10,000 | به ازای هر انتقال |
| حداکثر انتقال روزانه      | 100,000| به ازای هر API key |

محدودیت‌های نرخ از یک پنجره‌ی لغزنده در حافظه استفاده می‌کنند (همان الگوی
`RateLimitManager` در `open-sse/services/`). در صورت راه‌اندازی مجدد فرآیند،
به شمارنده‌های مبتنی بر SQLite بازمی‌گردد.

### تشخیص ناهنجاری Z-Score

به ازای هر API key، سیستم یک پنجره‌ی چرخشی ۷ روزه از XP کسب‌شده به ازای
ساعت را نگه می‌دارد. در هر اعطای XP:

1. محاسبه‌ی نرخ XP ساعتی فعلی کاربر.
2. محاسبه‌ی میانگین و انحراف معیار جمعیت.
3. محاسبه‌ی `z = (user_rate - mean) / stddev`.
4. اگر `z > 3.0` (۳ انحراف معیار)، به‌عنوان ناهنجاری علامت‌گذاری شود.

ناهنجاری‌ها در `xp_audit_log` با `action = 'anomaly_detected'` ثبت شده و
در داشبورد مدیریت نمایش داده می‌شوند.

### رد ممیزی

هر اعطای XP، انتقال، کسب نشان و تشخیص ناهنجاری در
`xp_audit_log` با موارد زیر ثبت می‌شود:

| فیلد        | توضیحات                                    |
| ----------- | ------------------------------------------ |
| `api_key_id`| چه کسی                                      |
| `action`    | چه اتفاقی افتاد (xp_award، transfer، anomaly، …) |
| `xp_awarded`| مبلغ (۰ برای رویدادهای غیر-XP)              |
| `metadata`  | JSON با context (نوع اقدام، هدف، …)         |
| `created_at`| چه زمانی (ISO 8601)                         |

مدیران می‌توانند کل رد ممیزی را از طریق `GET /api/gamification/anomalies` کوئری کنند.

---

## مسیرهای API

همه‌ی مسیرها از الگوی استاندارد RouteChi پیروی می‌کنند:

```
Route → CORS preflight → Body validation (Zod) → Auth (extractApiKey)
  → Handler
```

### Endpointها

| Method | Path                                       | توضیحات                                    | احراز هویت |
| ------ | ------------------------------------------ | ------------------------------------------ | ---------- |
| GET    | `/api/gamification/leaderboard`            | دریافت تابلوی امتیازات (scope، period، صفحه‌بندی) | اختیاری    |
| POST   | `/api/gamification/leaderboard`            | بازنشانی اجباری کش تابلوی امتیازات          | ضروری      |
| GET    | `/api/gamification/stream`                 | به‌روزرسانی‌های بلادرنگ SSE تابلوی امتیازات | اختیاری    |
| GET    | `/api/gamification/transfer`               | دریافت تاریخچه‌ی انتقال (صفحه‌بندی)         | ضروری      |
| POST   | `/api/gamification/transfer`               | ارسال توکن به کاربر دیگر                    | ضروری      |
| GET    | `/api/gamification/invite`                 | فهرست کدهای دعوت من                         | ضروری      |
| POST   | `/api/gamification/invite`                 | ایجاد یک کد دعوت جدید                       | ضروری      |
| DELETE | `/api/gamification/invite`                 | ابطال یک کد دعوت                            | ضروری      |
| POST   | `/api/gamification/invite/redeem`          | بازخرید یک کد دعوت                          | ضروری      |
| GET    | `/api/gamification/servers`                | فهرست سرورهای جامعه                         | ضروری      |
| POST   | `/api/gamification/servers`                | اتصال به یک سرور جامعه                      | ضروری      |
| DELETE | `/api/gamification/servers`                | قطع اتصال از یک سرور جامعه                  | ضروری      |
| POST   | `/api/gamification/federation/score`       | ارسال امتیاز به سرور ریموت                  | فدراسیون   |
| GET    | `/api/gamification/federation/leaderboard` | دریافت تابلوی امتیازات از ریموت             | فدراسیون   |
| GET    | `/api/gamification/notifications`          | اعلان‌های SSE کسب نشان/ارتقا سطح            | ضروری      |
| GET    | `/api/gamification/anomalies`              | مشاهده‌ی گزارش‌های ناهنجاری (مدیر)         | مدیر       |
| POST   | `/api/gamification/rotate`                 | چرخش secretهای توکن دعوت                    | ضروری      |

### نمونه‌های درخواست/پاسخ

**POST /api/gamification/transfer**

```json
// Request
{
  "to": "recipient-api-key-id",
  "amount": 500,
  "idempotencyKey": "uuid-v4"
}

// Response 200
{
  "success": true,
  "transfer": {
    "id": "txn-uuid",
    "from": "sender-api-key-id",
    "to": "recipient-api-key-id",
    "amount": 500,
    "createdAt": "2026-05-19T12:00:00.000Z"
  },
  "balance": 2500
}

// Response 400 (insufficient funds)
{
  "error": "Insufficient balance",
  "balance": 200,
  "requested": 500
}
```

**GET /api/gamification/leaderboard?scope=weekly&limit=10**

```json
{
  "scope": "weekly",
  "period": "2026-W20",
  "entries": [
    {
      "rank": 1,
      "apiKeyId": "key-uuid",
      "displayName": "User***1234",
      "score": 15230,
      "level": 42,
      "title": "Expert"
    }
  ],
  "total": 847,
  "updatedAt": "2026-05-19T12:00:00.000Z"
}
```

---

## ابزارهای MCP (8)

در `open-sse/mcp-server/` در کنار ابزارهای موجود ثبت می‌شوند. تحت
محدوده‌ی دسترسی `gamification` قرار دارند.

| ابزار                     | توضیحات                              | Input Schema                 |
| ------------------------- | ------------------------------------- | ---------------------------- |
| `gamification_leaderboard`| دریافت تابلوی امتیازات برای یک scope/period | `{ scope, period?, limit? }` |
| `gamification_rank`       | دریافت رتبه‌ی فراخوان‌کننده و همسایه‌ها | `{ scope }`                  |
| `gamification_profile`    | دریافت خلاصه‌ی XP، سطح، عنوان، streak | `{}`                         |
| `gamification_badges`     | فهرست نشان‌های کسب‌شده یا همه‌ی تعاریف | `{ earned?: boolean }`       |
| `gamification_transfer`   | ارسال توکن به کاربر دیگر              | `{ to, amount }`             |
| `gamification_invite`     | ایجاد یا فهرست کدهای دعوت             | `{ action: "create"          | "list" }` |
| `gamification_servers`    | فهرست یا اتصال سرورهای جامعه          | `{ action, token? }`         |
| `gamification_anomalies`  | مشاهده‌ی گزارش‌های ناهنجاری (محدوده‌ی مدیر) | `{ limit?, since? }`         |

---

## صفحات داشبورد

### `/dashboard/leaderboard`

- نمایش سکو (۳ نفر برتر با آواتار و XP).
- انتخاب‌گر scope: جهانی / هفتگی / ماهانه / توکن‌های اشتراک‌گذاشته‌شده / مشارکت‌ها.
- جدول صفحه‌بندی‌شده (۲۵ در هر صفحه) با رتبه، نام، امتیاز، سطح، عنوان.
- به‌روزرسانی‌های بلادرنگ SSE — تغییرات رتبه متحرک می‌شوند.
- کاربر فعلی در جدول با یک ردیف چسبان "رتبه‌ی شما" برجسته می‌شود.

### `/dashboard/profile`

- نوار پیشرفت XP با سطح فعلی و آستانه‌ی سطح بعدی.
- نشان عنوان به‌طور برجسته نمایش داده می‌شود.
- گالری نشان‌ها — نشان‌های کسب‌شده با تاریخ کسب، نشان‌های کسب‌نشده خاکستری شده
  (نشان‌های مخفی تا زمان کسب "???" نمایش می‌دهند).
- شمارنده‌ی streak با آیکون شعله؛ تقویم streak (۳۰ روز گذشته).
- نمودار تاریخچه‌ی XP (XP روزانه در ۳۰ روز گذشته).

### `/dashboard/tokens`

- موجودی توکن (برجسته، بالای صفحه).
- فرم انتقال: گیرنده، مبلغ، دیالوگ تأیید.
- جدول تاریخچه‌ی انتقال با فیلترها (ارسالی/دریافتی/همه).
- بخش دعوت: کدهای فعال، ایجاد جدید، لینک اشتراک.
- سرورهای جامعه: فهرست با وضعیت سلامت، اتصال/قطع اتصال.

### `/dashboard/gamification/admin`

- فهرست ناهنجاری با شدت، کاربر، timestamp، z-score.
- نمایشگر رد ممیزی با فیلترها (نوع اقدام، کاربر، بازه‌ی تاریخ).
- آمار سیستم: کل XP اهدا‌شده، کاربران فعال، نرخ‌های کسب نشان.
- نمای کلی سلامت سرور فدراسیون.

---

## یکپارچه‌سازی Pipeline

### نقطه‌ی یکپارچه‌سازی

گیمیفیکیشن در یک نقطه‌ی واحد در pipeline درخواست در
`open-sse/handlers/chatCore.ts` متصل می‌شود:

```typescript
// After response is sent to client:
setImmediate(() => {
  emitGamificationEvent({
    type: "request.completed",
    apiKeyId,
    metadata: {
      provider: selectedProvider,
      model: selectedModel,
      comboId: resolvedCombo?.id,
      compressionUsed: compressionStats?.applied,
      skillUsed: skillExecution?.name,
    },
  }).catch(() => {
    // Fire-and-forget: log but never propagate to client
  });
});
```

### انواع رویداد

| نوع رویداد          | زمان انتشار                             |
| ------------------- | --------------------------------------- |
| `request.completed` | پاسخ موفق LLM ارسال شد                  |
| `provider.switch`   | provider تغییر کرد (fallback combo محسوب می‌شود) |
| `combo.created`     | پیکربندی combo جدید ذخیره شد           |
| `combo.used`        | هدف combo با موفقیت برخورد شد          |
| `badge.earned`      | ارزیابی نشان تطبیقی پیدا کرد           |
| `streak.milestone`  | آستانه‌ی streak عبور شد                 |
| `transfer.sent`     | انتقال توکن کامل شد                     |
| `referral.redeemed` | کد دعوت با موفقیت بازخرید شد            |
| `compression.used`  | فشرده‌سازی prompt اعمال شد              |
| `skill.executed`    | اجرای مهارت کامل شد                     |
| `model.first_use`   | مدل در ۷ روز گذشته استفاده نشده        |

### تضمین غیرمسدودکننده

الگوی `setImmediate` + `.catch(() => {})` تضمین می‌کند:

1. پاسخ پیش از اجرای گیمیفیکیشن به‌طور کامل ارسال می‌شود.
2. خطاهای گیمیفیکیشن هرگز به کلاینت منتقل نمی‌شوند.
3. پردازش رویداد در microtask بعدی اجرا می‌شود، نه به‌صورت inline.

---

## امنیت

### مدل تهدید

| تهدید                   | کاهش                                                           |
| ----------------------- | -------------------------------------------------------------- |
| تورم امتیاز             | فقط محاسبه‌ی XP سمت سرور؛ کلاینت‌ها اقدامات را ارسال می‌کنند، نه امتیازات |
| حملات replay            | کلیدهای idempotency روی انتقال‌ها؛ حذف تکراری رد ممیزی        |
| تقلب در انتقال          | دفتر ثبت دوطرفه؛ تراکنش‌های اتمیک؛ محدودیت‌های نرخ             |
| خودارجاعی               | بررسی متقاطع `api_key_id` در بازخرید                           |
| دستکاری تابلوی امتیازات | تشخیص ناهنجاری z-score؛ داشبورد ناهنجاری مدیر                  |
| سرقت توکن فدراسیون      | ذخیره‌سازی هش‌شده‌ی SHA-256؛ توکن خام فقط یک بار نمایش داده می‌شود |
| brute force کدهای دعوت  | محدودسازی نرخ روی endpoint بازخرید؛ آنتروپی ۸ کاراکتری         |
| XSS در نام‌های نمایشی   | نام‌های نمایشی پاک‌سازی می‌شوند؛ ورودی‌های تابلوی امتیازات escape می‌شوند |
| حملات timing روی هش‌ها  | `crypto.timingSafeEqual` برای مقایسه‌ی هش توکن                |

### الزامات احراز هویت

- **عمومی** (بدون احراز هویت): `GET /leaderboard`، `GET /stream` (تابلوی امتیازات
  فقط‌خواندنی).
- **نیازمند API key**: همه‌ی عملیات نوشتن، پروفایل، انتقال‌ها، دعوت‌ها.
- **فقط مدیر**: داشبورد ناهنجاری، نمایشگر رد ممیزی.
- **فدراسیون**: مسیر احراز هویت جداگانه با استفاده از توکن خام در هدر
  `Authorization`، در برابر هش SHA-256 ذخیره‌شده اعتبارسنجی می‌شود.

---

## آزمون

### فایل‌های آزمون

همه‌ی آزمون‌ها از test runner بومی Node.js استفاده می‌کنند (`node --import tsx/esm --test`).

| فایل آزمون                                    | پوشش                                     | آزمون‌ها |
| --------------------------------------------- | ---------------------------------------- | -------- |
| `tests/unit/gamification/xp.test.ts`          | محاسبه‌ی XP، منحنی سطح، عناوین           | 8        |
| `tests/unit/gamification/badges.test.ts`      | تطبیق معیار نشان، اعطا                   | 10       |
| `tests/unit/gamification/streaks.test.ts`     | منطق streak، نقاط عطف، موارد لبه‌ای       | 7        |
| `tests/unit/gamification/leaderboard.test.ts` | محاسبه‌ی رتبه، صفحه‌بندی، چرخش           | 8        |
| `tests/unit/gamification/sharing.test.ts`     | انتقال‌ها، موجودی، idempotency            | 9        |
| `tests/unit/gamification/invites.test.ts`     | ایجاد، بازخرید، انقضا، خودارجاعی         | 7        |
| `tests/unit/gamification/antiCheat.test.ts`   | محدودیت‌های نرخ، z-score، ثبت ممیزی      | 6        |
| `tests/unit/gamification/events.test.ts`      | انتشار رویداد، fan-out، مدیریت خطا       | 5        |

### اجرای آزمون‌ها

```bash
# All gamification tests
node --import tsx/esm --test tests/unit/gamification/*.test.ts

# Single test file
node --import tsx/esm --test tests/unit/gamification/xp.test.ts
```

### الزامات پوشش

طبق `CONTRIBUTING.md` — همه‌ی ماژول‌های جدید باید دارای موارد زیر باشند:

- پوشش branch >= 80%.
- هر تابع عمومی حداقل یک بار آزمون شود.
- مسیرهای خطا آزمون شوند (موجودی ناکافی، کدهای منقضی‌شده، محدودیت‌های نرخ).

---

## ساختار فایل

```
src/
  lib/
    db/
      migrations/
        060_create_gamification.sql    # All 8 tables + indexes
      gamification.ts                  # Domain CRUD module
    gamification/
      xp.ts                           # XP calculation, level curve, titles
      badges.ts                       # Badge definitions, criteria, evaluation
      streaks.ts                      # Daily streak tracking
      leaderboard.ts                  # Rank computation, SSE, rotation
      antiCheat.ts                    # Rate limiting, z-score, audit
      sharing.ts                      # Token transfer ledger
      invites.ts                      # Invite/redeem codes
      servers.ts                      # Community server federation
      events.ts                       # Event emitter (integration point)
      notifications.ts                # SSE notification stream
  app/
    api/
      gamification/
        leaderboard/route.ts          # GET/POST leaderboard
        leaderboard/stream/route.ts   # SSE real-time updates
        transfer/route.ts             # GET/POST transfers
        invite/route.ts               # GET/POST/DELETE invite codes
        invite/redeem/route.ts        # POST redeem code
        servers/route.ts              # GET/POST/DELETE servers
        federation/score/route.ts     # POST push score
        federation/leaderboard/route.ts # GET pull leaderboard
        notifications/route.ts        # SSE notifications
        anomalies/route.ts            # GET anomaly reports
        rotate/route.ts               # POST rotate secrets
    (dashboard)/
      dashboard/
        leaderboard/page.tsx           # Rankings page
        profile/page.tsx               # XP/badges/streaks page
        tokens/page.tsx                # Balance/transfers/invites page
        gamification/admin/page.tsx    # Admin anomaly monitoring
  shared/
    constants/
      gamification.ts                  # XP_REWARDS, TITLES, BADGE_DEFS, LIMITS

tests/
  unit/
    gamification/
      xp.test.ts
      badges.test.ts
      streaks.test.ts
      leaderboard.test.ts
      sharing.test.ts
      invites.test.ts
      antiCheat.test.ts
      events.test.ts

docs/
  frameworks/
    GAMIFICATION.md                    # This document
```

---

## استراتژی migration

### فاز 1: هسته‌ی Backend (PR 1)

- Migration `060_create_gamification.sql` (8 جدول).
- `src/lib/db/gamification.ts` (ماژول دامنه).
- `src/lib/gamification/xp.ts`، `streaks.ts`، `events.ts`.
- نقطه‌ی یکپارچه‌سازی در `chatCore.ts`.
- آزمون‌های واحد برای XP، streakها، رویدادها.

### فاز 2: نشان‌ها و تابلوی امتیازات (PR 2)

- `src/lib/gamification/badges.ts`، `leaderboard.ts`.
- تعاریف نشان‌ها در constants.
- مسیرهای API تابلوی امتیازات + SSE stream.
- آزمون‌های واحد برای نشان‌ها، تابلوی امتیازات.

### فاز 3: اشتراک و دعوت‌ها (PR 3)

- `src/lib/gamification/sharing.ts`، `invites.ts`، `antiCheat.ts`.
- مسیرهای API انتقال + دعوت.
- آزمون‌های واحد برای اشتراک، دعوت‌ها، ضدتقلب.

### فاز 4: فدراسیون و داشبورد (PR 4)

- `src/lib/gamification/servers.ts`، `notifications.ts`.
- مسیرهای API فدراسیون.
- صفحات داشبورد (تابلوی امتیازات، پروفایل، توکن‌ها، مدیریت).
- ثبت ابزارهای MCP.

---

## ملاحظات آینده

- **رویدادهای فصلی**: مجموعه‌های نشان محدود به زمان و فصل‌های تابلوی امتیازات.
- **تابلوی امتیازات تیمی**: گروه‌بندی کاربران بر اساس سازمان یا combo.
- **ضریب‌های XP**: افزایش XP در دوره‌های ترویجی.
- **اشتراک دستاورد**: تولید کارت‌های نشان قابل‌اشتراک (تصاویر OpenGraph).
- **Push موبایل**: اعلان‌های مبتنی بر وب‌هوک برای رویدادهای نشان/سطح.
- **API تابلوی امتیازات**: API عمومی برای یکپارچه‌سازی‌های شخص ثالث.
