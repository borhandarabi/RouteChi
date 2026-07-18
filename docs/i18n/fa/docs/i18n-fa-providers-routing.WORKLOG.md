# Worklog — i18n-fa-providers-routing

**Task ID:** `i18n-fa-providers-routing`
**Locale:** Persian (fa)
**Date:** 2026-06-28
**Source version:** v3.8.40

## Summary

Translated 6 technical documentation files from English to Persian (Farsi) under
`docs/i18n/fa/docs/`, covering providers, routing, and combo context-requirements.

## Files Translated

| # | Source | Target | Lines |
| - | ------ | ------ | ----- |
| 1 | `docs/providers/AGENTROUTER.md`             | `docs/i18n/fa/docs/providers/AGENTROUTER.md`             | 141 |
| 2 | `docs/providers/CLAUDE_WEB.md`              | `docs/i18n/fa/docs/providers/CLAUDE_WEB.md`              | 112 |
| 3 | `docs/providers/ZED-DOCKER.md`              | `docs/i18n/fa/docs/providers/ZED-DOCKER.md`              | 112 |
| 4 | `docs/routing/QUOTA_SHARE.md`               | `docs/i18n/fa/docs/routing/QUOTA_SHARE.md`               | 348 |
| 5 | `docs/routing/REASONING_REPLAY.md`          | `docs/i18n/fa/docs/routing/REASONING_REPLAY.md`          | 167 |
| 6 | `docs/combo-context-requirements.md`        | `docs/i18n/fa/docs/combo-context-requirements.md`        | 262 |
|   | **Total**                                  |                                                          | **1142** |

## Conventions Applied

1. **Brand name**: All prose occurrences of "OmniRoute" → "RouteChi". (Verified
   none of the source files actually contained the literal string "OmniRoute" —
   they already used "RouteChi".)
2. **Code blocks**: Preserved verbatim — bash, json, sql, typescript, yaml, and
   plain text blocks left untouched including comments inside them.
3. **Markdown structure**: Headings, tables, blockquotes, lists, and horizontal
   rules preserved one-to-one.
4. **Technical identifiers preserved**:
   - Environment variables: `ENABLE_CC_COMPATIBLE_PROVIDER`, `QUOTA_STORE_DRIVER`, …
   - HTTP headers: `Authorization`, `User-Agent`, `anthropic-beta`, …
   - CLI commands: `omniroute`, `npm test …`, `docker run …`
   - File paths: `open-sse/services/claudeCodeCompatible.ts`, `src/lib/quota/fairShare.ts`, …
   - Container/volume names: `omniroute`, `omniroute-data`, `host-zed-config`
   - localStorage keys: `omniroute:quota-share:pools`
5. **Persian typography**: Used نیم‌فاصله (ZWNJ) consistently for prefixes,
   suffixes, and compound words. Persian digits used for cardinal numbers in
   prose (e.g., ۱۲۸۰۰۰، ۲۰۰۰، ۹۹٪).
6. **YAML frontmatter**: `version` and `lastUpdated` kept verbatim; `title`
   translated to Persian.
7. **Relative links**: Preserved source-relative paths (e.g., `../README.md`,
   `./CLAUDE_WEB.md`, `../reference/FREE_TIERS.md`) so the translated docs
   mirror the English docs directory structure.

## Translation Notes

- **AGENTROUTER.md**: Translated the cc-compatible bridge header table
  descriptions while keeping all header names and values in English (technical
  identifiers). The Chinese error string `"无效的令牌"` was preserved verbatim
  and its English meaning "Invalid token" was translated to Persian.
- **CLAUDE_WEB.md**: Kept the ASCII architecture diagram block untouched.
  Translated the cookie table purpose/source columns only.
- **ZED-DOCKER.md**: Kept all docker-compose.yml snippet content verbatim,
  including the `# Future:` comment.
- **QUOTA_SHARE.md**: Preserved all pseudocode blocks, ts/json snippets, and
  env-var tables verbatim. Translated prose explanations of the fair-share
  algorithm, sliding window, drivers, and UI walkthrough.
- **REASONING_REPLAY.md**: Preserved the SQL schema, JSON response shape,
  provider/model lists, and regex patterns verbatim. Translated prose around
  architecture, storage, API, and operational notes.
- **combo-context-requirements.md**: Preserved all config JSON, TypeScript
  schema, and `[COMBO]` log output blocks verbatim. Translated field
  descriptions, behavior explanations, use cases, and troubleshooting.

## Verification

- ✅ All target directories pre-created:
  `docs/i18n/fa/docs/providers/`, `docs/i18n/fa/docs/routing/`.
- ✅ No remaining "OmniRoute" tokens in prose (grep-clean across all 6 files).
- ✅ Remaining lowercase `omniroute` references are all inside code blocks /
    backticks / localStorage keys (legitimate technical identifiers per rule 4).
- ✅ All 6 target files created with non-zero content (1142 total lines).

## Next Actions

1. Optional: Run a markdown linter / link-checker across the translated files
   to catch any broken relative links (some translated README/reference targets
   such as `docs/i18n/fa/docs/README.md` and
   `docs/i18n/fa/docs/reference/FREE_TIERS.md` do not yet exist — they will
   resolve once those sibling translations are produced).
2. Optional: Add a language-switcher banner at the top of each file matching
   the convention used in `docs/i18n/fa/docs/routing/AUTO-COMBO.md` (not done
   here because the source English files did not include one and the banner
   layout would require cross-referencing 40+ sibling locales).
3. Optional: Translate the linked sibling files referenced from these docs
   (e.g., `CLAUDE_WEB.md`, `FREE_TIERS.md`, `RESILIENCE_GUIDE.md`,
   `TROUBLESHOOTING.md`, `AUTO-COMBO.md`) so internal links resolve fully
   within the `fa` subtree. Note that `RESILIENCE_GUIDE.md` and
   `TROUBLESHOOTING.md` already exist in `docs/i18n/fa/docs/`.
