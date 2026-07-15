---
title: "نمودارها"
version: 3.8.40
lastUpdated: 2026-06-28
---

# نمودارها

منابع Mermaid (`.mmd`) و فایل‌های SVG صادرشده برای جریان‌های معماری RouteChi نسخه ۳.۸.۰.

## نمودارهای مرجع

| منبع                                               | صادرشده                                  | استفاده در                                                                        |
| ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| [request-pipeline.mmd](./request-pipeline.mmd)       | [SVG](./exported/request-pipeline.svg)    | docs/architecture/ARCHITECTURE.md, docs/architecture/CODEBASE_DOCUMENTATION.md |
| [auto-combo-12factor.mmd](./auto-combo-12factor.mmd) | [SVG](./exported/auto-combo-12factor.svg) | docs/routing/AUTO-COMBO.md                                                     |
| [resilience-3layers.mmd](./resilience-3layers.mmd)   | [SVG](./exported/resilience-3layers.svg)  | docs/architecture/RESILIENCE_GUIDE.md, CLAUDE.md                               |
| [i18n-flow.mmd](./i18n-flow.mmd)                     | [SVG](./exported/i18n-flow.svg)           | docs/guides/I18N.md                                                            |
| [mcp-tools-94.mmd](./mcp-tools-94.mmd)               | [SVG](./exported/mcp-tools-94.svg)        | docs/frameworks/MCP-SERVER.md                                                  |
| [cloud-agent-flow.mmd](./cloud-agent-flow.mmd)       | [SVG](./exported/cloud-agent-flow.svg)    | docs/frameworks/CLOUD_AGENT.md                                                 |
| [authz-pipeline.mmd](./authz-pipeline.mmd)           | [SVG](./exported/authz-pipeline.svg)      | docs/architecture/AUTHZ_GUIDE.md                                               |
| [db-schema-overview.mmd](./db-schema-overview.mmd)   | [SVG](./exported/db-schema-overview.svg)  | docs/architecture/CODEBASE_DOCUMENTATION.md                                    |

## نحوه به‌روزرسانی

1. فایل `*.mmd` را ویرایش کنید.
2. دوباره رندر کنید: `npm run docs:render-diagrams` (از `@mermaid-js/mermaid-cli` استفاده می‌کند).
3. هم `.mmd` و هم `.svg` را commit کنید.

اگر `@mermaid-js/mermaid-cli` به‌صورت محلی در دسترس نیست، یک‌بار نصبش کنید:

```bash
npm install -g @mermaid-js/mermaid-cli
```

این اسکریپت هر فایل `.mmd` در `docs/diagrams/` را به `docs/diagrams/exported/*.svg`
با پس‌زمینه سفید رندر می‌کند که برای هر دو تم تیره و روشن مناسب است.

## لینک دادن از یک سند

از سندی در `docs/<subfolder>/`، مسیر نسبی `../diagrams/...` خواهد بود:

```markdown
![Request pipeline](../diagrams/exported/request-pipeline.svg)

> منبع: [../diagrams/request-pipeline.mmd](../diagrams/request-pipeline.mmd)
```

از ریشه مخزن (مثلاً `CLAUDE.md`):

```markdown
![Resilience layers](./exported/resilience-3layers.svg)
```

## قراردادها

- یک مفهوم در هر نمودار. سعی نکنید کل پلتفرم را در یک نمودار جا دهید.
- برچسب‌های گره را کوتاه نگه دارید (۳-۶ کلمه). برای شکست خط داخل گره‌ها از `<br/>` استفاده کنید.
- برای خطوط لوله `flowchart LR` و برای مدل‌های لایه‌ای `flowchart TB` را ترجیح دهید.
- برای جریان‌های تعاملی (درخواست/پاسخ) از `sequenceDiagram` استفاده کنید.
- برای مرور کلی شمای پایگاه داده از `erDiagram` استفاده کنید.
- هم `.mmd` و هم `.svg` را در همان commit به‌روزرسانی کنید. آن‌ها را هماهنگ نگه دارید.
