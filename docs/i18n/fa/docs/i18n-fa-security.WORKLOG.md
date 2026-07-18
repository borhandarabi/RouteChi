# Worklog — i18n-fa-security

**Task ID:** `i18n-fa-security`
**Locale:** Persian (fa)
**Date:** 2026-06-28
**Source version:** v3.8.40

## Summary

Translated 13 security documentation files from English to Persian (Farsi) under
`docs/i18n/fa/docs/security/`, covering account-ban detection, CLI token auth,
compliance & audit, CORS, egress IP-family policy, error sanitization, guardrails,
MITM TPROXY decrypt, public-credentials handling, route-guard tiers, Socket.dev
finding attestation, stealth guide, and supply-chain gates.

## Files Translated

| # | Source | Target | Lines |
| - | ------ | ------ | ----- |
| 1  | `docs/security/BAN_DETECTION.md`        | `docs/i18n/fa/docs/security/BAN_DETECTION.md`        | 117 |
| 2  | `docs/security/CLI_TOKEN.md`            | `docs/i18n/fa/docs/security/CLI_TOKEN.md`            | 86  |
| 3  | `docs/security/COMPLIANCE.md`           | `docs/i18n/fa/docs/security/COMPLIANCE.md`           | 238 |
| 4  | `docs/security/CORS.md`                 | `docs/i18n/fa/docs/security/CORS.md`                 | 159 |
| 5  | `docs/security/EGRESS_POLICY.md`        | `docs/i18n/fa/docs/security/EGRESS_POLICY.md`        | 250 |
| 6  | `docs/security/ERROR_SANITIZATION.md`   | `docs/i18n/fa/docs/security/ERROR_SANITIZATION.md`   | 175 |
| 7  | `docs/security/GUARDRAILS.md`           | `docs/i18n/fa/docs/security/GUARDRAILS.md`           | 315 |
| 8  | `docs/security/MITM-TPROXY-DECRYPT.md`  | `docs/i18n/fa/docs/security/MITM-TPROXY-DECRYPT.md`  | 379 |
| 9  | `docs/security/PUBLIC_CREDS.md`         | `docs/i18n/fa/docs/security/PUBLIC_CREDS.md`         | 141 |
| 10 | `docs/security/ROUTE_GUARD_TIERS.md`    | `docs/i18n/fa/docs/security/ROUTE_GUARD_TIERS.md`    | 220 |
| 11 | `docs/security/SOCKET_DEV_FINDINGS.md`  | `docs/i18n/fa/docs/security/SOCKET_DEV_FINDINGS.md`  | 236 |
| 12 | `docs/security/STEALTH_GUIDE.md`        | `docs/i18n/fa/docs/security/STEALTH_GUIDE.md`        | 279 |
| 13 | `docs/security/SUPPLY_CHAIN.md`         | `docs/i18n/fa/docs/security/SUPPLY_CHAIN.md`         | 59  |
|    | **Total**                              |                                                      | **2654** |

## Conventions Applied

1. **Brand name**: All prose occurrences of "OmniRoute" → "RouteChi" in headings,
   paragraphs, list items, and table cells. Verified by `rg "OmniRoute"` across the
   target directory — no prose occurrences remain.
2. **Code blocks**: Preserved verbatim — bash, typescript, sql, nginx config,
   dotenv, ASCII pipeline diagrams, and inline code blocks left untouched including
   comments inside them.
3. **Markdown structure**: Headings, tables, blockquotes, lists, and horizontal
   rules preserved one-to-one.
4. **Technical identifiers preserved**:
   - Environment variables: `OMNIROUTE_CLI_SALT`, `OMNIROUTE_DISABLE_CLI_TOKEN`,
     `OMNIROUTE_TLS_PROXY_URL`, `OMNIROUTE_ZED_IMPORT_LEGACY_ONE_STEP`,
     `OMNIROUTE_BUILD_PROFILE`, `OMNIROUTE_CLOUD_SYNC_SECRET`,
     `OMNIROUTE_CLOUD_SYNC_SECRETS`, `CORS_ALLOW_ALL`, `CORS_ALLOWED_ORIGINS`,
     `APP_LOG_RETENTION_DAYS`, `CALL_LOG_RETENTION_DAYS`,
     `INPUT_SANITIZER_ENABLED`, `INJECTION_GUARD_MODE`, `PII_REDACTION_ENABLED`,
     `ANTIGRAVITY_CREDITS`, `ENABLE_SOCKS5_PROXY`, …
   - HTTP headers: `x-omniroute-cli-token`, `x-omniroute-disabled-guardrails`,
     `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`,
     `Authorization`, `Cookie: auth_token=...`, `Vary: Origin`, `X-Cloud-Sig`, …
   - CLI commands: `routechi status`, `npm run build:native:tproxy`,
     `node-gyp rebuild`, `sqlite3 dump`, `gh api ... -X PATCH`, …
   - File paths: `src/server/authz/routeGuard.ts`,
     `src/lib/compliance/index.ts`, `open-sse/utils/error.ts`,
     `src/mitm/tproxy/native/transparent.c`, `~/.omniroute/storage.sqlite`,
     `omniroute-mitm.crt`, `omniroute-tproxy-ca.crt`, `omniroute-secure`, …
   - Table/column names: `audit_log`, `mcp_tool_audit`, `usage_history`,
     `call_logs`, `proxy_logs`, `proxy_registry`, `upstream_proxy_config`, …
   - GitHub refs / advisory IDs: `GHSA-fhh6-4qxv-rpqj`, PR `#3777`, Discussion
     `#1183`, CodeQL alert IDs `#224` and `#231`, commit `1a39c31f`,
     CVE/CWE IDs (`CWE-209`, `SECURITY_001`).
5. **Persian typography**: Used نیم‌فاصله (ZWNJ) consistently for prefixes,
   suffixes, and compound words (مثلاً «پایگاه‌داده»، «به‌صورت»، «می‌شود»،
   «به‌صورت»، «تأیید‌شده»). Persian digits used for cardinal numbers in prose
   (۱۳ فایل، ۸ زیررشته، ۱۶ KB، ۲۵۰۰۰ ردیف).
6. **YAML frontmatter**: `version` and `lastUpdated` kept verbatim; `title` kept
   verbatim (English titles preserved as-is to match the heading tradition and
   English anchor slugs).
7. **Relative links**: Preserved source-relative paths (e.g.,
   `./ROUTE_GUARD_TIERS.md`, `../architecture/AUTHZ_GUIDE.md`,
   `../frameworks/MCP-SERVER.md`, `../architecture/RESILIENCE_GUIDE.md`,
   `../frameworks/TRAFFIC_INSPECTOR.md`) so the translated docs mirror the
   English docs directory structure.
8. **Table of Contents anchors**: Preserved English anchor slugs in
   `EGRESS_POLICY.md` (e.g., `#what-it-is`, `#how-ipv4--ipv6-are-enforced`,
   `#socks5-compatibility`, `#fail-closed-behavior`, `#data-model`,
   `#related-documentation`) and in `MITM-TPROXY-DECRYPT.md`
   (e.g., `#6-security`, `#2-requirements`, `#3-the-native-ip_transparent-addon`,
   `#anti-loop-so_mark`) so the internal anchor links still resolve within the
   translated file.

## Translation Notes

- **BAN_DETECTION.md**: Preserved the 8-row built-in keyword code block and the
  detection-flow ASCII diagram verbatim. Translated the substring-matching
  explanation, false-positive guidance, and recovery procedures. Kept
  `ACCOUNT_DEACTIVATED_SIGNALS`, `CREDITS_EXHAUSTED_SIGNALS`,
  `OAUTH_INVALID_TOKEN_SIGNALS` symbol names and terminal-status strings
  (`banned`, `deactivated`, `expired`) verbatim.
- **CLI_TOKEN.md**: Preserved the HMAC-SHA256 token derivation flow, the bash
  snippet for salt rotation, the legacy SHA-256 prefix format explanation, and
  the file-purpose table. Kept the `omniroute-cli-auth-v1` default salt verbatim.
- **COMPLIANCE.md**: Preserved the 14-row action/source audit-log table, the
  SQLite DDL, the retention env-var table, the `noLog` curl example, and the
  REST API table. Translated best-practices and audit-context guidance. Kept
  redaction keywords (`*token`/`*secret`/`*apikey`) verbatim.
- **CORS.md**: Preserved the threat-model table for the three surfaces
  (dashboard/management, client API, public read-only), the nginx config block,
  and the `applyCorsHeaders()` invariant quote. Translated the fail-closed
  explanation, the `/api/v1/agents/` exception analysis, and the production
  checklist.
- **EGRESS_POLICY.md**: Largest technical file (250 lines). Preserved the 4 TS
  snippets (`ProxyFamily`, `parseProxyFamily`, `resolveDispatcherFamily`, the
  fail-closed DNS preflight), the 2 SQL ALTER TABLE statements, the curl create/
  patch examples, the three-values table, and the Linux distro trust-dir table.
  Translated the why-it-exists rationale and the fail-closed explanation. Kept
  English ToC anchor slugs intact.
- **ERROR_SANITIZATION.md**: Preserved all 6 code snippets (buildErrorBody
  example, helper imports, custom envelope, logging-vs-responding pattern,
  forbidden patterns, sanitized path regex). Translated the CWE-209 / CodeQL
  rationale, the custom-sanitizer limitation, and the dismissal workflow.
- **GUARDRAILS.md**: Largest file (315 lines). Preserved the BaseGuardrail /
  GuardrailResult / GuardrailContext TypeScript interfaces, the BudgetGuardrail
  custom example, the route-coverage table, and the env-var config table.
  Translated the three built-in guardrail sections (Vision Bridge, PII Masker,
  Prompt Injection) and the execution-order list. Kept severity constants
  (`high`, `warn`, `block`, `log`, `redact`) verbatim.
- **MITM-TPROXY-DECRYPT.md**: Second-largest file (379 lines). Preserved the
  full ASCII pipeline diagram (local app → mangle OUTPUT → IP_TRANSPARENT
  listener → tlsCapture.ts → original upstream), all four bash snippets (build
  addon, apply commands, revert order), the two TS snippets
  (`buildSocksFamilySocketOptions`, the contradiction check), the distro anchor
  table, the §8 config field table, and the §11 source map. Translated §1
  rationale, §6 security controls table, §7 transactional firewall
  apply/revert. Kept all section anchor slugs (`#6-security`,
  `#anti-loop-so_mark`, etc.) intact.
- **PUBLIC_CREDS.md**: Preserved all 5 code snippets (mask generation bash
  command, single/multi env override TS, dotenv documentation block, 4 BAD
  patterns). Translated the obfuscation-vs-encryption explanation, the mandatory
  7-step checklist, and the when-not-to-use guidance. Kept raw-value prefixes
  (`AIza`, `GOCSPX-`, `<digits>-<32hex>.apps.googleusercontent.com`, `Iv1.<hex>`)
  and key blocklist regex verbatim.
- **ROUTE_GUARD_TIERS.md**: Preserved the LOCAL_ONLY prefix table (13 rows), the
  manage-scope carve-out 5-row table, the evaluation-order pseudo-code block,
  and the OpenAPI YAML annotation table. Translated the GHSA-fhh6-4qxv-rpqj
  attack-class explanation, operator guidance, and adding-a-new-route
  instructions. Kept `403 LOCAL_ONLY`, `401 Authentication required`,
  `requireLogin=false`, `x-loopback-only`, `x-always-protected`, `x-internal`
  verbatim.
- **SOCKET_DEV_FINDINGS.md**: Preserved the per-platform privileged-operations
  table, the 2-step Zed import confirmation flow, the 4-row webpack stub
  mapping table, and the `OMNIROUTE_BUILD_PROFILE=minimal npm run build` snippet.
  Translated the six attestation sections (§1 MITM CA install, §2 Zed import,
  §3 execFile/spawn, §4/§6 9router, §5 Cloud Sync write-back) and the build
  profile explanation.
- **STEALTH_GUIDE.md**: Preserved the SHA256 fingerprint formula code block,
  the zero-width-joiner sensitive-words list, the CLI fingerprint interface,
  the MITM endpoint table (5 rows), the Linux dynamic trust-store detection
  table, the User-Agent env var table (8 rows), and the CLI compatibility
  toggle table (11 rows). Translated the legal/ethical notice, the TLS
  fingerprinting layer description, the Claude Code stealth bundle, and the
  Antigravity `ANTIGRAVITY_CREDITS=always` risk guidance.
- **SUPPLY_CHAIN.md**: Smallest file (59 lines). Preserved the 7-row gate table
  and the `OMNIROUTE_BUILD_PROFILE=minimal npm run build` snippet. Translated
  the CVE variance explanation and the backlog section. Kept SLSA, SBOM,
  OpenSSF Scorecard, Trivy, osv-scanner, gitleaks, actionlint, zizmor tool
  names verbatim.

## Verification

- ✅ Target directory created: `mkdir -p docs/i18n/fa/docs/security`.
- ✅ All 13 target files created with non-zero content (~2654 total lines).
- ✅ No remaining "OmniRoute" tokens in prose (verified by `rg "OmniRoute"` —
    0 matches across the target directory).
- ✅ Remaining lowercase `omniroute` / `OMNIROUTE` references are all inside
    code blocks / backticks / file paths / CLI commands / env var names /
    cert filenames (legitimate technical identifiers per rule 4).
- ✅ Markdown structure (tables, code fences, headings, blockquotes, ordered
    lists) preserved one-to-one against the source.
- ✅ All code blocks preserved verbatim (no Persian substitution inside any
    fenced block).
- ✅ YAML frontmatter `version` / `lastUpdated` fields kept verbatim where
    present; `title` field kept verbatim in English.

## Next Actions

1. Optional: Run a markdown linter / link-checker across the translated files
   to catch any broken relative links. Several linked sibling files referenced
   from these security docs (e.g., `../architecture/AUTHZ_GUIDE.md`,
   `../architecture/RESILIENCE_GUIDE.md`, `../frameworks/MCP-SERVER.md`,
   `../frameworks/TRAFFIC_INSPECTOR.md`, `../frameworks/AGENTBRIDGE.md`,
   `../reference/ENVIRONMENT.md`, `../ops/PROXY_GUIDE.md`,
   `../guides/TROUBLESHOOTING.md`) may not yet exist in the `fa` subtree and
   will resolve once those sibling translations are produced.
2. Optional: Translate the related `meta.json` in the source `docs/security/`
   directory if it carries user-facing strings (currently a directory metadata
   file — not translated here per scope).
3. Optional: Add a language-switcher banner at the top of each file matching
   the convention used in other `docs/i18n/fa/docs/*` files (not done here
   because the source English files did not include one).
