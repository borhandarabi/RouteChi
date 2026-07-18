---
title: "Supply-Chain Gates"
---

# گیت‌های زنجیره تأمین (Phase 8 · Block A)

RouteChi artifactهای npm + Docker را منتشر می‌کند. این گیت‌ها مبدا،
فهرست‌نویسی (SBOM) و اسکن CVE را تأمین می‌کنند، همگی OSS، متصل به گردش‌کارهای release.
وضعیت **مشورتی‌اول** — اکنون گزارش می‌دهند، پس از اولین
release سبز به مسدودکننده ارتقا می‌یابند.

| گیت                   | ابزار                                          | کجا                           | مسدود می‌کند؟            | خروجی                                         |
| --------------------- | ---------------------------------------------- | ----------------------------- | ------------------------ | --------------------------------------------- |
| مبدا SLSA (npm)       | `npm --provenance` (OIDC)                      | `npm-publish.yml`             | فقط اگر publish شکست بخورد | badge npmjs / `npm audit signatures`          |
| SBOM npm              | `@cyclonedx/cyclonedx-npm`                     | `npm-publish.yml`             | فقط اگر تولید شکست بخورد  | Release asset + artifact                      |
| SBOM image            | `anchore/sbom-action` (syft)                   | `docker-publish.yml` (merge)  | مشورتی                   | CycloneDX artifact                            |
| Trivy CVE (SARIF)     | `aquasecurity/trivy-action`                    | `docker-publish.yml` (merge)  | مشورتی                   | SARIF (HIGH+CRITICAL) → Security tab          |
| گیت Trivy CRITICAL    | `aquasecurity/trivy-action`                    | `docker-publish.yml` (merge)  | **مسدودکننده**           | `exit-code: '1'` روی CRITICAL قابل‌تعمیر       |
| osv vulnCount         | `osv-scanner` (`check:vuln-ratchet --ratchet`) | `ci.yml` (`quality-extended`) | **مسدودکننده**           | ratchet می‌کند `metrics.vulnCount` (جهت: پایین) |
| OpenSSF Scorecard     | `ossf/scorecard-action`                        | `scorecard.yml` (cron)        | مشورتی                   | SARIF → Security + badge                      |

ratchet CVE image از **دو گام** در `docker-publish.yml` استفاده می‌کند: گام SARIF
(`HIGH,CRITICAL`, `exit-code: 0`) HIGH+CRITICAL را در Security tab بدون
مسدودکردن قابل مشاهده نگه می‌دارد؛ گام _CRITICAL gate_ (`severity: CRITICAL`, `ignore-unfixed: true`,
`exit-code: 1`) release را روی یک CVE CRITICAL **با تعمیر موجود** شکست می‌دهد. `ignore-unfixed`
مسدودکردن release برای یک CVE base-image بدون patch آپ‌استریم را متوقف می‌کند.

## ⚠️ واریانس CVE (گیت‌های مسدودکننده osv/Trivy)

osv و Trivy وابستگی‌ها را در برابر پایگاه‌داده‌های CVE مقایسه می‌کنند که **به‌طور پیوسته رشد می‌کنند**. یک PR
که **هیچ وابستگی‌ای را لمس نمی‌کند** ممکن است ناگهان قرمز شود چون یک CVE جدید
در یک dep موجود افشا شده (osv: `vulnCount` اندازه‌گیری‌شده > خط پایه؛ Trivy: یک CRITICAL
قابل‌تعمیر جدید در image). **این رفتار عملیاتی مورد انتظار یک گیت CVE مسدودکننده
است، نه یک رگرسیون محصول.**

وقتی osv یا Trivy به دلیل یک CVE تازه افشا‌شده قرمز می‌شوند، راه‌کار این است:

1. **dep آسیب‌دیده را bump کنید** (ترجیحی) — به نسخه patch‌شده از طریق `package.json`
   `overrides` (deps انتقالی) ارتقا دهید یا image را روی یک base patch‌شده بازسازید.
2. **اگر patch آپ‌استریمی وجود ندارد:**
   - **osv:** `metrics.vulnCount` را در `config/quality/quality-baseline.json` دوباره خط‌پایه کنید
     (`npm run quality:ratchet -- --update` گیت‌های اختصاصی را پوشش نمی‌دهد — مقدار را دستی
     ویرایش کنید، `direction:down`) با یک یادداشت توجیه + issue پیگیری.
   - **Trivy:** یک مدخل در `.trivyignore` (CVE-ID در هر خط) با یک یادداشت توجیه
     + issue پیگیری بیفزایید. `ignore-unfixed: true` از قبل CVEهای بدون
     patch را به‌طور خودکار پوشش می‌دهد.

هر دو گیت به‌طور **ظریف SKIP می‌شوند** (exit 0) وقتی ابزار غایب است یا اندازه‌گیری
شکست می‌خورد (osv-scanner در PATH نیست، osv.dev/شبکه غیرقابل دسترس، JSON نامعتبر) — یک شکست
**اندازه‌گیری** هرگز مسدود نمی‌کند، تنها یک رگرسیون **اندازه‌گیری‌شده** مسدود می‌کند.

## Backlog: Scorecard مشورتی → مسدودکننده

پس از اولین release سبز با Scorecard گزارش‌دهنده:

- Scorecard: ratchet امتیاز (امتیاز اندازه‌گیری‌شده را freeze می‌کند؛ نمی‌تواند کاهش یابد).

مکمل گیت‌های Phase 7 (osv-scanner, gitleaks, actionlint+zizmor) است: zizmor
خود گردش‌کارها را ممیزی می‌کند؛ Scorecard وضعیت repo را به‌صورت تجمیعی اندازه‌گیری می‌کند.
