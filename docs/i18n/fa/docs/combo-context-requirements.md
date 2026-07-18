# قابلیت الزامات زمینهٔ Combo

## مرور کلی

قابلیت الزامات زمینه (Context Requirements) به پیکربندی‌های combo اجازه می‌دهد هدف‌ها را بر اساس اندازهٔ پنجرهٔ زمینهشان فیلتر و مرتب کنند. این قابلیت برای موارد استفاده‌ای که به پنجره‌های زمینهٔ بزرگ نیاز دارند مفید است، مانند:

- پردازش اسناد بلند (بیش از ۱۰۰ هزار توکن)
- تحلیل کدبیس بزرگ
- تاریخچه‌های مکالمهٔ گسترده
- بازبینی کد چند‌فایلی

## پیکربندی

### شما

`contextRequirements` را به runtime config کامبوی خود اضافه کنید:

```json
{
  "contextRequirements": {
    "minContextWindow": 128000,
    "preferLargeContext": true,
    "contextFilterMode": "strict"
  }
}
```

### فیلدها

#### `minContextWindow` (اختیاری)

- **Type**: `number` (0 تا 10,000,000)
- **Default**: `undefined` (بدون فیلتر)
- **Description**: مدل‌هایی با پنجرهٔ زمینه زیر این آستانه را فیلتر می‌کند

**نمونه‌ها**:

- `32000` - فیلتر مدل‌های با زمینهٔ کمتر از 32K
- `128000` - نیاز به زمینهٔ 128K+ (GPT-4 Turbo، Claude 3)
- `200000` - نیاز به زمینهٔ 200K+ (Claude 3 Opus)
- `1000000` - نیاز به زمینهٔ 1M+ (Gemini 1.5 Pro)

#### `preferLargeContext` (اختیاری)

- **Type**: `boolean`
- **Default**: `false`
- **Description**: هنگام `true`، هدف‌های باقی‌مانده را بر اساس اندازهٔ زمینه (نزولی) مرتب می‌کند. مدل‌های با زمینهٔ بزرگ ابتدا امتحان می‌شوند.

#### `contextFilterMode` (اختیاری)

- **Type**: `"strict"` | `"lenient"`
- **Default**: `"lenient"`
- **Description**: نحوهٔ برخورد با مدل‌هایی که حد پنجرهٔ زمینهٔ ناشناخته دارند
  - `"strict"`: مدل‌های با حد زمینهٔ ناشناخته را مستثنی می‌کند
  - `"lenient"`: مدل‌های با حد زمینهٔ ناشناخته را شامل می‌شود

## رفتار

### خط‌لولهٔ فیلتر

الزامات زمینه پس از `filterTargetsByRequestCompatibility()` اعمال می‌شوند:

1. **فیلتر سازگاری درخواست** - مدل‌های ناسازگ با درخواست (ابزارها، بینایی، structured output) را حذف می‌کند
2. **فیلتر الزامات زمینه** - `minContextWindow` و `contextFilterMode` را اعمال می‌کند
3. **مرتب‌سازی مبتنی بر زمینه** - اگر `preferLargeContext` درست باشد، بر اساس اندازهٔ زمینه به‌صورت نزولی مرتب می‌کند

### منطق حالت فیلتر

هنگام تنظیم `minContextWindow`:

**حالت Lenient** (پیش‌فرض):

- ✅ شامل مدل‌های با زمینهٔ `>= minContextWindow`
- ✅ شامل مدل‌های با حد زمینهٔ ناشناخته
- ❌ مستثنی کردن مدل‌های با زمینهٔ `< minContextWindow`

**حالت Strict**:

- ✅ شامل مدل‌های با زمینهٔ `>= minContextWindow`
- ❌ مستثنی کردن مدل‌های با حد زمینهٔ ناشناخته
- ❌ مستثنی کردن مدل‌های با زمینهٔ `< minContextWindow`

### منطق مرتب‌سازی

هنگامی که `preferLargeContext` درست باشد:

- مدل‌ها بر اساس اندازهٔ پنجرهٔ زمینه (نزولی) مرتب می‌شوند
- مدل‌های با زمینهٔ ناشناخته در انتها مرتب می‌شوند
- ترتیب استراتژی اصلی به‌عنوان tiebreaker استفاده می‌شود

## موارد استفاده

### نمونهٔ ۱: پردازش اسناد بلند

```json
{
  "name": "Document Analysis",
  "strategy": "fusion",
  "config": {
    "contextRequirements": {
      "minContextWindow": 128000,
      "preferLargeContext": true,
      "contextFilterMode": "strict"
    }
  }
}
```

این پیکربندی:

- نیاز به پنجرهٔ زمینهٔ 128K+
- ترجیح مدل‌های با زمینهٔ بزرگ‌تر (Gemini 1.5 Pro > Claude 3 Opus > GPT-4 Turbo)
- مستثنی کردن مدل‌های با حد زمینهٔ ناشناخته

### نمونهٔ ۲: تحلیل کدبیس بزرگ

```json
{
  "name": "Code Review",
  "strategy": "auto",
  "config": {
    "contextRequirements": {
      "minContextWindow": 200000,
      "preferLargeContext": true,
      "contextFilterMode": "lenient"
    }
  }
}
```

این پیکربندی:

- نیاز به پنجرهٔ زمینهٔ 200K+
- ترجیح مدل‌های با زمینهٔ بزرگ‌تر
- شامل مدل‌های با حد ناشناخته (lenient)

### نمونهٔ ۳: ترجیح زمینهٔ بزرگ بدون الزامات سخت‌گیرانه

```json
{
  "name": "Flexible Chat",
  "strategy": "weighted",
  "config": {
    "contextRequirements": {
      "preferLargeContext": true
    }
  }
}
```

این پیکربندی:

- بدون حداقل الزام (همهٔ مدل‌ها واجد شرایط)
- مرتب بر اساس اندازهٔ زمینه (بزرگ‌ترین اول)
- مفید هنگامی که زمینهٔ بزرگ ترجیح داده می‌شود اما الزامی نیست

## پاسخ API

هنگامی که الزامات زمینه هدف‌ها را فیلتر می‌کنند، لاگر combo خروجی می‌دهد:

```
[COMBO] Context requirements: filtered 10 → 3 targets (minContextWindow: 128000, mode: strict)
[COMBO] Context requirements: kept models gemini-1.5-pro, claude-3-opus-20240229, gpt-4-turbo
[COMBO] Context requirements: sorted by context size (descending): gemini-1.5-pro(1000000), claude-3-opus-20240229(200000), gpt-4-turbo(128000)
```

## جزئیات پیاده‌سازی

### ماژول بک‌اند

`open-sse/services/combo/contextRequirements.ts`:

- `applyContextRequirements()` - تابع اصلی فیلتر
- `getTargetContextWindow()` - کمک‌کنندهٔ جست‌وجوی زمینه
- از `getModelContextLimit()` در `modelCapabilities.ts` استفاده می‌کند

### نقطهٔ یکپارچه‌سازی

`open-sse/services/combo.ts` خط 1187:

```typescript
orderedTargets = filterTargetsByRequestCompatibility(orderedTargets, body, log);
orderedTargets = applyContextRequirements(orderedTargets, config.contextRequirements, log);
```

### تعریف شما

`src/shared/validation/schemas/combo.ts`:

```typescript
contextRequirements: z
  .object({
    minContextWindow: z.coerce.number().int().min(0).max(10_000_000).optional(),
    preferLargeContext: z.boolean().optional(),
    contextFilterMode: z.enum(["strict", "lenient"]).optional(),
  })
  .strict()
  .optional(),
```

## تست

### اجرای تست‌ها

```bash
# Unit tests (schema + logic)
npm test tests/unit/combo-context-requirements.test.ts

# Integration tests (end-to-end)
npm test tests/unit/combo/context-requirements-integration.test.ts
```

### پوشش تست

- اعتبارسنجی شمای: 6 تست
- منطق فیلتر: 6 تست
- یکپارچه‌سازی: 5 تست
- **مجموع**: 17/17 پاس ✅

## رفع اشکال

### همهٔ هدف‌ها فیلتر شدند

**Problem**: همهٔ هدف‌ها حذف شدند، combo «no compatible models» برمی‌گرداند

**Solutions**:

1. آستانهٔ `minContextWindow` را کاهش دهید
2. به حالت `"lenient"` تغییر دهید تا مدل‌های با زمینهٔ ناشناخته شامل شوند
3. `minContextWindow` را حذف کرده و فقط از `preferLargeContext` استفاده کنید

### مدل‌های با زمینهٔ ناشناخته مستثنی شدند

**Problem**: مدل‌های سفارشی/جدید با وجود داشتن زمینهٔ بزرگ مستثنی شدند

**Solutions**:

1. به حالت `"lenient"` (پیش‌فرض) تغییر دهید
2. حد زمینهٔ مدل را به `modelCapabilities.ts` اضافه کنید
3. فیلتر زمینه را حذف کرده و به ترتیب استراتژی تکیه کنید

### مرتب‌سازی اعمال نشد

**Problem**: `preferLargeContext` ترتیب را تغییر نمی‌دهد

**Check**:

1. `preferLargeContext: true` را در پیکربندی تأیید کنید
2. بررسی کنید آیا همهٔ هدف‌ها زمینهٔ ناشناخته دارند (همه برابر مرتب می‌شوند)
3. تأیید کنید چندین هدف پس از فیلتر باقی مانده‌اند

## مرتبط

- [استراتژی‌های مسیریابی Auto-Combo](./routing/AUTO-COMBO.md)
- [راهنمای تاب‌آوری](./architecture/RESILIENCE_GUIDE.md)

## تاریخچهٔ نسخه

- **v3.8.47**: پیاده‌سازی اولیه
  - اضافه‌شدن پیکربندی `contextRequirements`
  - ایجاد ماژول فیلتر بک‌اند
  - پوشش تست کامل (هنوز رابط کاربری داشبورد اختصاصی وجود ندارد — از طریق JSON combo پیکربندی کنید)
