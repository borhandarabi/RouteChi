# Worklog — i18n-fa-reference

**Task ID:** `i18n-fa-reference`
**Locale:** Persian (fa)
**Date:** 2026-07-13
**Source version:** v3.8.40–3.8.47 (per-file)

## Summary

Translated 7 technical reference documentation files from English to Persian (Farsi)
under `docs/i18n/fa/docs/reference/`, covering feature flags, free proxies API, free
tiers, provider plugin manifest, provider reference, relay backend strategy, and
relay troubleshooting.

## Files Translated

| # | Source | Target | Lines |
| - | ------ | ------ | ----- |
| 1 | `docs/reference/FEATURE_FLAGS.md`              | `docs/i18n/fa/docs/reference/FEATURE_FLAGS.md`              | 238 |
| 2 | `docs/reference/FREE_PROXIES_API.md`           | `docs/i18n/fa/docs/reference/FREE_PROXIES_API.md`           |  77 |
| 3 | `docs/reference/FREE_TIERS.md`                 | `docs/i18n/fa/docs/reference/FREE_TIERS.md`                 | 338 |
| 4 | `docs/reference/PROVIDER_PLUGIN_MANIFEST.md`   | `docs/i18n/fa/docs/reference/PROVIDER_PLUGIN_MANIFEST.md`   |  81 |
| 5 | `docs/reference/PROVIDER_REFERENCE.md`         | `docs/i18n/fa/docs/reference/PROVIDER_REFERENCE.md`         | 340 |
| 6 | `docs/reference/RELAY_BACKEND_STRATEGY.md`     | `docs/i18n/fa/docs/reference/RELAY_BACKEND_STRATEGY.md`     |  84 |
| 7 | `docs/reference/RELAY_TROUBLESHOOTING.md`      | `docs/i18n/fa/docs/reference/RELAY_TROUBLESHOOTING.md`      |  93 |
|   | **Total**                                      |                                                              | **1251** |

## Conventions Applied

1. **Brand name**: All prose occurrences of "OmniRoute" → "RouteChi". Verified via
   ripgrep — zero remaining "OmniRoute" literals in prose across the 7 target files.
   (Env var names such as `OMNIROUTE_RELAY_BACKEND`, `OMNIROUTE_MCP_ENFORCE_SCOPES`,
   `OMNIROUTE_EMERGENCY_FALLBACK`, etc., are technical identifiers and were
   preserved verbatim per rule #4.)
2. **Code blocks**: Preserved verbatim — bash, json, jsonc blocks left untouched,
   including inline comments inside them (e.g., `// "db" | "env" | "default"`).
3. **Markdown structure**: Headings, tables, blockquotes (`> [!NOTE]` callouts),
   ordered/unordered lists, horizontal rules, and YAML frontmatter delimiters
   preserved one-to-one.
4. **Technical identifiers preserved**:
   - Environment variables: `OMNIROUTE_RELAY_BACKEND`, `STORAGE_ENCRYPTION_KEY`,
     `BIFROST_ENABLED`, `OMNIROUTE_PROVIDER_MANIFEST_URL`, …
   - HTTP headers: `Authorization`, `X-RouteChi-Provider-Manifest-Url`,
     `x-relay-url`, `x-relay-mode`, `x-relay-attempts`, `x-relay-fallback`, …
   - CLI commands: `npm run gen:provider-reference`, `devin auth login`,
     `Windsurf: Provide Auth Token`, …
   - File paths: `src/shared/constants/featureFlagDefinitions.ts`,
     `open-sse/config/providerPluginManifest.ts`,
     `open-sse/services/emergencyFallback.ts`, …
   - REST routes: `GET /api/settings/feature-flags`,
     `POST /api/settings/proxies/[id]/repair-relay`,
     `GET /api/v1/provider-plugin-manifest`, …
   - Provider IDs / aliases / model names: `mistral`, `gemini`, `glm-cn`,
     `kilo-gateway`, `kimi-coding`, `longcat`, etc. — kept as-is in tables.
   - Capability tags: `apikey`, `oauth`, `custom-executor`, `passthrough-models`,
     `responses`, `sidecar-candidate`.
5. **Persian typography**: Used نیم‌فاصله (ZWNJ) consistently for prefixes,
   suffixes, and compound words (e.g., «پاسخ‌ها»، «داشبورد»، «ارائه‌دهنده»،
   «راه‌اندازی»، «پیش‌فرض»). Persian digits used for cardinal counts in prose
   (e.g., ۲۵۰، ۳۸، ۷، ۱۹).
6. **YAML frontmatter**: `version` and `lastUpdated` kept verbatim; `title`
   translated to Persian (e.g., `title: "فلگ‌های ویژگی"`).
7. **Relative links**: Preserved source-relative paths (e.g., `./ENVIRONMENT.md`,
   `./PROVIDER_PLUGIN_MANIFEST.md`, `../getting-started/FREE-TIERS-GUIDE.md`,
   `../../src/shared/utils/featureFlags.ts`) so the translated docs mirror the
   English docs directory structure.
8. **Table layout**: Long table cells (notably the FREE_TIERS ToS attention table
   and the per-provider freeNote delta list) had prose translated while
   preserving the trailing `…` truncation markers from the source where present.

## Translation Notes

- **PROVIDER_REFERENCE.md**: The provider catalog tables (OAuth, Web Cookie, API
  Key, Local, Search, Audio, Upstream Proxy, Cloud Agent, System) are
  auto-generated from `src/shared/constants/providers.ts`. The `ID`, `Alias`,
  `Name`, `Tags`, and `Website` columns were preserved verbatim; only the
  `Notes` column (prose setup instructions per provider) was translated.
- **FREE_TIERS.md**: Many of the freeNote delta entries ended with `…` in the
  source (truncation of a longer note). That `…` was preserved in translation
  so the table renders identically.
- **FEATURE_FLAGS.md**: The note about "all 33 flags" inside the JSON response
  example was left as `33` (preserved inside a verbatim code block, not prose).
- **RELAY_BACKEND_STRATEGY.md**: The English technical term "semantics" was
  retained as a borrowed word (`semanticsهای fallback`) since there is no
  canonical Persian rendering that conveys the precise API-behavior meaning.
- **RELAY_TROUBLESHOOTING.md**: Mode strings in the API reference table
  (`"recovered"`, `"noop"`, `"redeploy"`) kept as quoted literals; only the
  prose descriptions of when each response fires were translated.

## Verification

- `rg OmniRoute docs/i18n/fa/docs/reference/` → 0 matches (brand fully replaced
  in prose; env var prefixes `OMNIROUTE_*` correctly preserved as identifiers).
- All 7 target files exist and match the source file count of lines (within
  expected variance for translation).
- Frontmatter `version` and `lastUpdated` fields preserved verbatim.
- All markdown tables, code fences, blockquote callouts, and relative links
  verified structurally intact.

## Next Actions

- The `docs/i18n/fa/docs/reference/meta.json` (not in scope for this task) may
  need updating to register the newly translated files in the Persian docs
  navigation — worth checking in a follow-up.
- Three reference files remain untranslated in `docs/reference/`:
  `API_REFERENCE.md`, `CLI-TOOLS.md`, `ENVIRONMENT.md` (pre-existing fa
  translations exist for those, so they were intentionally left untouched).
