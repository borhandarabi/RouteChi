---
title: "یکپارچه‌سازی‌های CLI — نشانه‌گیری هر CLI کدنویسی روی RouteChi"
version: 3.8.40
lastUpdated: 2026-06-28
---

# یکپارچه‌سازی‌های CLI

RouteChi مجموعه‌ای از دستورات `setup-*` را عرضه می‌کند که یک CLI کدنویسی
(Codex، Claude Code، OpenCode، Cline، …) را پیکربندی می‌کنند تا از RouteChi به‌عنوان
backend خود استفاده کند — در نتیجه ابزار با **یک** endpoint صحبت می‌کند و RouteChi
آن را با سقوط خودکار (auto-fallback) به ارائه‌دهندهٔ درست هدایت می‌کند. هر دستور
**کاتالوگ زندهٔ** مدل‌ها را از یک RouteChi در حال اجرا (محلی یا راهور) می‌خواند و
فایل پیکربندی خود ابزار را روی ماشین **شما** می‌نویسد. کلید API هرجا که ابزار پشتیبانی
کند از طریق env var ارجاع داده می‌شود، بنابراین راز هرگز روی دیسک نوشته نمی‌شود
(استثناها در ادامه ذکر شده‌اند).

دو لانچر نیز وجود دارد — `omniroute launch` (Claude Code) و
`omniroute launch-codex` (Codex) — که CLI را با env درست تزریق‌شده اجرا می‌کنند،
بدون اینکه هیچ پیکربندی‌ای بنویسند.

برای راه‌اندازی پایهٔ یک‌باره و دست‌نویسِ دو یکپارچه‌سازی غنی‌تر، به شرح‌های عمیق
مربوط به هر ابزار مراجعه کنید:

- [پیکربندی Claude Code](./CLAUDE-CODE-CONFIGURATION.md)
- [پیکربندی Codex CLI](./CODEX-CLI-CONFIGURATION.md)
- [حالت راهور](./REMOTE-MODE.md) — هدایت یک RouteChi راهور (VPS / Tailnet) از لپ‌تاپ خود

---

## جدول اصلی

هر دستور از **context فعال** (تنظیم‌شده با `omniroute connect`، به
[حالت راهور](./REMOTE-MODE.md) مراجعه کنید) یا پرچم‌های صریح `--remote <url> --api-key <key>`
پیروی می‌کند. «محلی در برابر راهور» در ادامه به این معناست: بدون پرچم، `http://localhost:20128`
را هدف می‌گیرد؛ با `--remote` (یا یک context راهور فعال) کاتالوگ را از آن سرور
می‌گیرد و پیکربندی را به‌صورت محلی می‌نویسد.

| دستور | ابزار | آنچه می‌نویسد | پرچم‌های کلیدی | محلی در برابر راهور |
|---------|------|----------------|-----------|-----------------|
| `omniroute setup-codex` | OpenAI Codex CLI | `~/.codex/<name>.config.toml` — یک پروفایل به ازای هر مدل متنی سازگار (`codex --profile <name>`) | `--remote` `--api-key` `--only` `--dry-run` `--port` `--codex-home` | هر دو |
| `omniroute setup-claude` | Claude Code | `~/.claude/profiles/<name>/settings.json` — یک پروفایل به ازای هر مدل تطبیق‌خورده (`CLAUDE_CONFIG_DIR`) | `--remote` `--api-key` `--only` `--dry-run` `--port` `--claude-home` | هر دو |
| `omniroute setup-opencode` | OpenCode (سازگار با openai) | `~/.config/opencode/opencode.json` — ارائه‌دهندهٔ `omniroute` با هر مدل کاتالوگ (`opencode -m omniroute/<model>`) | `--remote` `--api-key` `--only` `--model` `--dry-run` `--port` | هر دو |
| `omniroute setup-cline` | Cline | `~/.cline/data/{globalState,secrets}.json` (حالت CLI) + تنظیمات افزونهٔ VS Code را چاپ می‌کند | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--cline-dir` | هر دو |
| `omniroute setup-kilo` | Kilo Code | `~/.local/share/kilo/auth.json` (CLI) + `kilocode.*` را با `settings.json` ادغام می‌کند در صورت وجود VS Code | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--auth-path` `--vscode-settings` | هر دو |
| `omniroute setup-continue` | Continue / `cn` CLI | `~/.continue/config.yaml` — مدل‌های `provider: openai`، کلید از طریق `${{ secrets.OMNIROUTE_API_KEY }}` | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path` | هر دو |
| `omniroute setup-cursor` | Cursor | چیزی نه — مراحل درون‌اپلیکیشنی را چاپ می‌کند (پیکربندی Cursor یک SQLite مات است) | `--remote` `--api-key` `--only` `--port` | هر دو |
| `omniroute setup-roo` | Roo Code | `~/.omniroute/roo-settings.json` (سند import) + `roo-cline.autoImportSettingsPath` را در صورت وجود یک `settings.json` در VS Code تنظیم می‌کند | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--import-path` `--vscode-settings` | هر دو |
| `omniroute setup-crush` | Crush | `~/.config/crush/crush.json` — ارائه‌دهندهٔ `openai-compat`، کلید از طریق `$OMNIROUTE_API_KEY` | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path` | هر دو |
| `omniroute setup-goose` | Goose | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER`/`OPENAI_HOST`/`GOOSE_MODEL`) + دستور العمل env را چاپ می‌کند | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` | هر دو |
| `omniroute setup-qwen` | Qwen Code | `~/.qwen/settings.json` — `modelProvider` از نوع openai، کلید از طریق `envKey` (`OMNIROUTE_API_KEY`) | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` | هر دو |
| `omniroute setup-aider` | Aider | `~/.aider.conf.yml` (`openai-api-base` + `model: openai/<id>`) + دستور العمل env را چاپ می‌کند | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` | هر دو |
| `omniroute launch` | Claude Code | چیزی نه — `claude` را با `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` تزریق‌شده اجرا می‌کند | `--remote` `--api-key` `--token` `--profile` `--port` | هر دو |
| `omniroute launch-codex` | OpenAI Codex CLI | چیزی نه — `codex` را با ارائه‌دهندهٔ `omniroute` تزریق‌شده از طریق پرچم‌های `-c` اجرا می‌کند | `--remote` `--api-key` `--profile` (`-p`) `--port` | هر دو |

یادداشت‌هایی دربارهٔ پرچم‌ها (تأییدشده در منبع دستور):

- `--remote <url>` — کاتالوگ را از یک RouteChi راهور می‌گیرد (`--port` و context فعال
  را بازنویسی می‌کند). `--api-key <key>` اعتبارنامه را برای آن سرور فراهم می‌کند
  (پیش‌فرض env var `OMNIROUTE_API_KEY`، یا توکن context فعال).
- `--only <patterns>` — زیررشته‌های جدا‌شده با ویرگول؛ فقط شناسه‌های مدلی را نگه می‌دارد
  که تطبیق بخورند (مثلاً `--only glm,kimi`). در `setup-codex`، `setup-claude`،
  `setup-opencode`، `setup-continue`، `setup-cursor`، `setup-crush` موجود است.
- `--dry-run` — دقیقاً آنچه نوشته خواهد شد را بدون دست‌زدن به filesystem چاپ می‌کند.
  در همهٔ دستورات `setup-*` به‌جز `setup-cursor` موجود است (که هرگز فایلی نمی‌نویسد).
- `--model <id>` — برای ابزارهایی که کشف خودکار مدل ندارند الزامی است (یا به‌صورت
  تعاملی انتخاب می‌شود): Cline، Kilo، Roo، Goose، Qwen، Aider. این ابزارها
  همچنین `--yes` را برای اجراهای غیرتعاملی می‌پذیرند (که در این صورت `--model` الزامی است).
  `setup-opencode` از `--model` برای تنظیم مدل پیش‌فرض top-level استفاده می‌کند.
- `--port <port>` — پورت RouteChi محلی (پیش‌فرض `20128`، زمانی که `--remote` تنظیم شده باشد
  نادیده گرفته می‌شود). روی همهٔ `setup-*` و هر دو لانچر وجود دارد.
- دو لانچر (`launch`، `launch-codex`) پرچم `--profile <name>` را برای انتخاب
  پروفایلی که توسط `setup-claude` / `setup-codex` نوشته شده می‌پذیرند، به‌علاوهٔ
  argهای pass-through برای باینری `claude` / `codex` زیرین.

> `setup-opencode` یکپارچه‌سازی **سبک و سازگار با openai** برای OpenCode است.
> همچنین یک یکپارچه‌سازی افزونه‌ای غنی‌تر نیز وجود دارد — `omniroute setup opencode` — که
> `@omniroute/opencode-plugin` را نصب می‌کند. این‌ها دستورات متفاوتی هستند؛ جدول
> بالا `setup-opencode` را مستند می‌کند.

---

## استفادهٔ محلی

با RouteChi در حال اجرا روی `localhost:20128`، کافی است دستور setup را برای ابزار
خود اجرا کنید. کاتالوگ از سرور محلی گرفته می‌شود.

```bash
# Codex: write a profile per matched model into ~/.codex/
omniroute setup-codex
codex --profile glm52            # use a generated profile

# Claude Code: write per-model profiles, then launch one
omniroute setup-claude
omniroute launch --profile glm52

# OpenCode: write the openai-compatible provider with all catalog models
omniroute setup-opencode
export OMNIROUTE_API_KEY=sk-...  # referenced via {env:OMNIROUTE_API_KEY}, never on disk
opencode -m omniroute/glm/glm-5.2 "..."

# Tools without auto-discovery need an explicit model:
omniroute setup-aider --model glm/glm-5.2
omniroute setup-qwen  --model kmc/kimi-k2.7

# Preview without writing anything:
omniroute setup-continue --dry-run
```

اجرای بدون نوشتن هیچ پیکربندی (فقط تزریق env):

```bash
omniroute launch                 # Claude Code → local OmniRoute
omniroute launch-codex           # Codex CLI → local OmniRoute
omniroute launch-codex --profile glm52
```

---

## استفادهٔ راهور

هر دستور setup را با `--remote` + `--api-key` به یک RouteChi راهور نشانه بگیرید.
کاتالوگ از راهور گرفته می‌شود؛ پیکربندی روی ماشین محلی شما نوشته می‌شود.

```bash
# OpenCode against a remote VPS, keep only glm/kimi models
omniroute setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx \
  --only glm,kimi
opencode -m omniroute/glm/glm-5.2 "..."   # export OMNIROUTE_API_KEY first

# Codex profiles from a remote catalog
omniroute setup-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# Launch a CLI straight against the remote
omniroute launch       --remote http://192.168.0.15:20128 --api-key oma_live_xxx
omniroute launch-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx
```

به‌جای پاس‌کردن `--remote`/`--api-key` در هر بار، یک‌بار وارد شوید و اجازه دهید
**context فعال** آن‌ها را به‌طور خودکار تأمین کند:

```bash
omniroute connect 192.168.0.15        # mints a scoped token, stores the context
omniroute setup-codex                 # ← now uses the remote catalog
omniroute setup-opencode              # ← same
omniroute launch                      # ← Claude Code against the remote
```

برای contextها، scopeها و مدیریت توکن به [حالت راهور](./REMOTE-MODE.md) مراجعه کنید.

---

## قراردادهای Base URL (کدام ابزارها `/v1` می‌خواهند)

RouteChi رابط OpenAI را در `/v1`، رابط Anthropic را در root، و یک رابط بومی Gemini را
در `/v1beta` عرضه می‌کند. هر یکپارچه‌سازی به شکلی که ابزارش انتظار دارد متصل شده است
(تأییدشده در منبع دستور):

| یکپارچه‌سازی | Base URL نوشته‌شده | `/v1`؟ |
|-------------|------------------|--------|
| `setup-cline` (`openAiBaseUrl`) | root | خیر — Cline مسیر `/v1/chat/completions` را اضافه می‌کند |
| `setup-goose` (`OPENAI_HOST`) | root | خیر — Goose مسیر را اضافه می‌کند |
| `setup-aider` (`OPENAI_API_BASE`) | root | خیر — LiteLLM مسیر `/v1/chat/completions` را اضافه می‌کند |
| `setup-kilo`, `setup-roo`, `setup-continue`, `setup-crush`, `setup-qwen`, `setup-cursor` | با `/v1` | بله |
| `setup-claude` (`ANTHROPIC_BASE_URL`), `launch` | root | خیر — Claude Code مسیر `/v1/messages` را اضافه می‌کند |
| `setup-codex`, `launch-codex` (`model_providers.omniroute.base_url`) | با `/v1` | بله |

---

## نگه‌داشتن وابستگی‌های بومی هنگام به‌روزرسانی: `--include=optional`

وقتی با `omniroute update` به‌روزرسانی می‌کنید (پس از تأیید، یا با `--apply`)،
RouteChi نصب را با `--include=optional` پخته‌شده درون آن اجرا می‌کند:

```bash
npm install -g omniroute@latest --include=optional
```

این پرچمی نیست که شما به `omniroute update` بدهید — همیشه توسط
updater اعمال می‌شود. این تضمین می‌کند که `optionalDependencies`ها
(`better-sqlite3`، `keytar`، `tls-client`، استک SLM مربوط به LLMLingua) از
به‌روزرسانی جان سالم به‌در ببرند، حتی اگر پیکربندی npm شما
`omit=optional` تنظیم شده باشد، که در غیر این صورت به‌صورت بی‌صدا درایور
بومی SQLite و اتصال OS-keyring را حذف می‌کند. برای پیش‌نمایش دقیق دستور
بدون اعمال:

```bash
omniroute update --dry-run
# [DRY RUN] Would run: npm install -g omniroute@latest --include=optional
```

سایر پرچم‌های `omniroute update` (تأییدشده در منبع): `--check` (در صورت
قدیمی‌بودن با exit 1 خارج می‌شود)، `--apply` (نصب بدون پرسش)، `--changelog`،
`--no-backup`، `--yes`.

---

## همچنین ببینید

- [پیکربندی Claude Code](./CLAUDE-CODE-CONFIGURATION.md) — راهنمای عمیق‌تر Claude Code
- [پیکربندی Codex CLI](./CODEX-CLI-CONFIGURATION.md) — راه‌اندازی پایهٔ یک‌بارهٔ `[model_providers.omniroute]`
- [حالت راهور](./REMOTE-MODE.md) — contextها، توکن‌های دسترسی با scope، هدایت یک سرور راهور
- [مرجع CLI Tools](../reference/CLI-TOOLS.md) — کاتالوگ کامل ابزارهای پشتیبانی‌شده + صفحات داشبورد
- [راهنمای نصب](./SETUP_GUIDE.md) — روش‌های نصب و آغاز اولیه
