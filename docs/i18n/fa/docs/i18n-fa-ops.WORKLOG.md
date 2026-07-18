# Worklog — i18n-fa-ops

**Task ID:** `i18n-fa-ops`
**Locale:** Persian (fa)
**Date:** 2026-06-28
**Source version:** v3.8.40

## Summary

Translated 9 operational/ops documentation files from English to Persian (Farsi) under
`docs/i18n/fa/docs/ops/`, covering branch protection, database, maturity re-evaluation,
monitoring, proxy, quality-gate playbook, release-green flow, SQLite runtime, and tunnels.

## Files Translated

| # | Source | Target | Lines |
| - | ------ | ------ | ----- |
| 1 | `docs/ops/BRANCH_PROTECTION_MAIN.md`  | `docs/i18n/fa/docs/ops/BRANCH_PROTECTION_MAIN.md`  | 24  |
| 2 | `docs/ops/DATABASE_GUIDE.md`          | `docs/i18n/fa/docs/ops/DATABASE_GUIDE.md`          | 627 |
| 3 | `docs/ops/MATURITY_REEVAL.md`         | `docs/i18n/fa/docs/ops/MATURITY_REEVAL.md`         | 116 |
| 4 | `docs/ops/MONITORING_GUIDE.md`        | `docs/i18n/fa/docs/ops/MONITORING_GUIDE.md`        | 477 |
| 5 | `docs/ops/PROXY_GUIDE.md`             | `docs/i18n/fa/docs/ops/PROXY_GUIDE.md`             | 824 |
| 6 | `docs/ops/QUALITY_GATE_PLAYBOOK.md`   | `docs/i18n/fa/docs/ops/QUALITY_GATE_PLAYBOOK.md`   | 311 |
| 7 | `docs/ops/RELEASE_GREEN.md`           | `docs/i18n/fa/docs/ops/RELEASE_GREEN.md`           | 89  |
| 8 | `docs/ops/SQLITE_RUNTIME.md`          | `docs/i18n/fa/docs/ops/SQLITE_RUNTIME.md`          | 83  |
| 9 | `docs/ops/TUNNELS_GUIDE.md`           | `docs/i18n/fa/docs/ops/TUNNELS_GUIDE.md`           | 292 |
|   | **Total**                             |                                                    | **2843** |

## Conventions Applied

1. **Brand name**: All prose occurrences of "OmniRoute" → "RouteChi". The source
   files already used "RouteChi" in prose in most places; verified by spot-check.
2. **Code blocks**: Preserved verbatim — bash, json, sql, typescript, plain text,
   ASCII architecture diagrams, and inline code blocks left untouched including
   comments inside them.
3. **Markdown structure**: Headings, tables, blockquotes, lists, and horizontal
   rules preserved one-to-one.
4. **Technical identifiers preserved**:
   - Environment variables: `STORAGE_ENCRYPTION_KEY`, `ENABLE_SOCKS5_PROXY`,
     `PROXY_FAST_FAIL_TIMEOUT_MS`, `NEXT_PUBLIC_BASE_URL`, `OMNIROUTE_SKIP_POSTINSTALL`, …
   - HTTP headers: `Authorization`, `Cookie: auth_token=...`, `Content-Type`, …
   - CLI commands: `omniroute`, `routechi`, `sqlite3 …`, `npm run …`, `gh api …`
   - File paths: `~/.omniroute/storage.sqlite`, `src/lib/db/core.ts`,
     `DATA_DIR/cloudflared/`, `~/.omniroute/runtime/`, …
   - Table/column names: `provider_connections`, `proxy_registry`, `usage_history`, …
   - MCP tool names: `observability_snapshot`, `omniroute_get_health`, …
   - Branch names / GitHub refs: `main`, `release/**`, PR numbers like `#4034`
5. **Persian typography**: Used نیم‌فاصله (ZWNJ) consistently for prefixes,
   suffixes, and compound words (مثلاً «پایگاه‌داده»، «به‌صورت»، «هم‌زمان»، «می‌شود»).
   Persian digits used for cardinal numbers in prose and table numbers (e.g.,
   ۱۷ جدول، ۹۴ ماژول، ۵٪).
6. **YAML frontmatter**: `version` and `lastUpdated` kept verbatim; `title`
   translated to Persian.
7. **Relative links**: Preserved source-relative paths (e.g.,
   `./DATABASE_GUIDE.md#disaster-recovery`, `../guides/USER_GUIDE.md`,
   `../architecture/RESILIENCE_GUIDE.md`) so the translated docs mirror the
   English docs directory structure.
8. **Table of Contents anchors**: Preserved English anchor slugs (e.g.,
   `#why-use-proxies`, `#troubleshooting`) in PROXY_GUIDE.md so the internal
   anchor links still resolve within the translated file.

## Translation Notes

- **BRANCH_PROTECTION_MAIN.md**: Kept the JSON payload for `gh api` untouched
  (rule-name contexts, JSON keys). Translated the prose around OpenSSF Scorecard
  and the `enforce_admins` rationale.
- **DATABASE_GUIDE.md**: Preserved all SQL DDL, `PRAGMA` statements, TypeScript
  snippets, and the `~/.omniroute/storage.sqlite` path (technical identifier).
  Translated schema tables, runbook steps, and troubleshooting prose. Persian
  numerals used throughout the 17-table and 94-module descriptions.
- **MATURITY_REEVAL.md**: Kept all framework acronyms (DSOMM, SLSA, OpenSSF,
  SonarQube, DORA, OWASP LLM) and grade codes (L2→L3, A−→A, P0/P1/P2) verbatim.
  Preserved PR/issue references and file paths.
- **MONITORING_GUIDE.md**: Preserved the ASCII 3-layer architecture diagram,
  all JSON response shapes, TypeScript interfaces, and curl examples verbatim.
  Translated dashboard column descriptions, issue-type tables, and alerting
  recipes.
- **PROXY_GUIDE.md**: Largest file (824 lines). Preserved all curl commands,
  JSON payloads, SQL schemas, the 4-level proxy priority diagram, the rotation
  decision-tree ASCII diagram, and the architecture diagram. Translated prose,
  table headers/cells, and troubleshooting steps. Kept `unsupported_country_region_territory`
  error string verbatim.
- **QUALITY_GATE_PLAYBOOK.md**: Preserved all ratchet metric names, file paths
  (e.g., `quality-baseline.json`, `check-ratchet.<ext>`), GitHub issue/PR
  references (#4034, #3988), and SLSA/Scorecard terminology. Translated the
  critical-assessment tables, 12-category catalog, and replication plan.
- **RELEASE_GREEN.md**: Kept CLI commands (`/green-prs`, `/babysit <PR#>`,
  `npm run check:release-green`, `node scripts/quality/validate-release-green.mjs`)
  verbatim. Translated the family-overview table and the cadence guidance.
- **SQLITE_RUNTIME.md**: Preserved magic-byte hex values, the 5-step fallback
  chain identifiers (`bundled`, `runtime`, `node-sqlite`, `sql-js`), file paths
  in `~/.omniroute/runtime/`, and the TypeScript driver-info interface.
- **TUNNELS_GUIDE.md**: Preserved all curl examples, the endpoint summary table
  with method/body/auth columns, env-var tables, and the three backend
  architecture file references. Translated the OAuth callback considerations,
  troubleshooting steps, and dashboard descriptions.

## Verification

- ✅ Target directory created: `mkdir -p docs/i18n/fa/docs/ops`.
- ✅ All 9 target files created with non-zero content (~2843 total lines).
- ✅ No remaining "OmniRoute" tokens in prose (spot-checked across all 9 files).
- ✅ Remaining lowercase `omniroute` references are all inside code blocks /
    backticks / file paths / CLI commands / env var names (legitimate technical
    identifiers per rule 4).
- ✅ Markdown structure (tables, code fences, headings, blockquotes) preserved
    one-to-one against the source.

## Next Actions

1. Optional: Run a markdown linter / link-checker across the translated files
   to catch any broken relative links. Some linked sibling files referenced
   from these ops docs (e.g., `../guides/USAGE_QUOTA_GUIDE.md`,
   `../architecture/ARCHITECTURE.md`, `./FLY_IO_DEPLOYMENT_GUIDE.md`,
   `./RELEASE_CHECKLIST.md`, `../reference/API_REFERENCE.md`,
   `../reference/ENVIRONMENT.md`) may not yet exist in the `fa` subtree and
   will resolve once those sibling translations are produced.
2. Optional: Add a language-switcher banner at the top of each file matching
   the convention used in `docs/i18n/fa/docs/routing/AUTO-COMBO.md` (not done
   here because the source English files did not include one).
3. Optional: Translate the remaining ops sibling files
   (`COVERAGE_PLAN.md`, `FLY_IO_DEPLOYMENT_GUIDE.md`, `RELEASE_CHECKLIST.md`,
   `VM_DEPLOYMENT_GUIDE.md`, `meta.json`) so the `ops/` directory is fully
   covered in Persian.
