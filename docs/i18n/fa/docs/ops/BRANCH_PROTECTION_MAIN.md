---
title: "محافظت از شاخه — main"
---

# محافظت از شاخه — `main` (OpenSSF Scorecard: Branch-Protection)

اقدام مالک مخزن. از مسیر Settings → Branches → Add rule اعمال کنید، یا:

```bash
gh api -X PUT repos/borhandarabi/routechi/branches/main/protection \
  --input - <<'JSON'
{ "required_status_checks": { "strict": true, "contexts": ["Quality Ratchet", "Quality Gates (Extended)", "Fast Quality Gates"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": true },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false }
JSON
```

این تنظیم نمرهٔ Branch-Protection در Scorecard را از 0 بالا می‌برد. مقدار `enforce_admins:false` جریان forward-merge فعلی را قابل‌اجرا نگه می‌دارد؛ پس از تثبیت وضعیت، آن را به `true` سخت‌گیرانه‌تر کنید.
