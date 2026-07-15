---
title: "Claude Code CLI — پیکربندی با OmniRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Claude Code CLI — پیکربندی با OmniRoute

CLI کلاود کد (**Claude Code**) (`claude`) را به OmniRoute — محلی یا VPS راه دور — هدایت کنید، با پروفایل‌های جداگانه برای هر مدل، به‌صورتی مشابه راه‌اندازی Codex.

---

## راه‌اندازی سریع

```bash
# اجرای Claude Code روی یک OmniRoute محلی (context فعال را به‌صورت خودکار تشخیص می‌دهد)
omniroute launch

# روی یک OmniRoute راه دور (پس از `omniroute connect <host>`، این کار خودکار است)
omniroute launch --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# ساخت پروفایل برای هر مدل، سپس اجرای یکی از آن‌ها
omniroute setup-claude            # نوشته می‌شود در ~/.claude/profiles/<name>/settings.json
omniroute launch --profile glm52  # Claude Code با استفاده از glm/glm-5.2 از طریق OmniRoute
```

---

## نحوه اتصال Claude Code به یک gateway

Claude Code از **Anthropic Messages API** استفاده می‌کند و با متغیرهای محیطی به یک endpoint سفارشی هدایت می‌شود (هیچ پرچم `--base-url` ندارد):

| متغیر                                        | هدف                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ANTHROPIC_BASE_URL`                         | URL ریشه gateway (Claude Code مسیر `/v1/messages` را اضافه می‌کند). **بدون پسوند `/v1`.**            |
| `ANTHROPIC_AUTH_TOKEN`                       | به‌صورت `Authorization: Bearer …` ارسال می‌شود — از توکن دسترسی / کلید API OmniRoute خود استفاده کنید          |
| `ANTHROPIC_API_KEY`                          | جایگزین: به‌صورت `x-api-key` ارسال می‌شود. اگر هر دو تنظیم شده باشند، `ANTHROPIC_AUTH_TOKEN` برنده است             |
| `ANTHROPIC_MODEL`                            | اجبار به یک مدل مشخص (پیش‌فرض انتخابگر `/model` را نادیده می‌گیرد)                         |
| `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` | `1` → انتخابگر بومی `/model` مدل‌های `claude*`/`anthropic*` را از `/v1/models` فهرست می‌کند |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS`              | محدود کردن tokenهای خروجی برای هر پاسخ (مثلاً `65536`)                                          |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW`            | آستانه token برای فشرده‌سازی خودکار                                                    |

> متغیرهای محیطی **یک‌بار در زمان راه‌اندازی** خوانده می‌شوند — پس از تغییر آن‌ها، Claude Code را راه‌اندازی مجدد کنید.

`omniroute launch` همه این‌ها را برای شما تنظیم می‌کند: URL پایه + توکن را از context فعال تشخیص می‌دهد (بنابراین `omniroute connect <vps>` و سپس `omniroute launch` به‌سادگی کار می‌کند)، وضعیت سلامت سرور را بررسی می‌کند و `claude` را اجرا می‌کند.

---

## پروفایل‌ها (`CLAUDE_CONFIG_DIR`)

Claude Code **هیچ فایل پروفایل بومی ندارد** (برخلاف `~/.codex/<name>.config.toml` در Codex). سازوکار رایج، `CLAUDE_CONFIG_DIR` است — یک پوشه پیکربندی جداگانه برای هر پروفایل، که هر کدام `settings.json`، اعتبارنامه‌ها، تاریخچه و کش اختصاصی خود را دارند.

`omniroute setup-claude` فهرست زنده `/v1/models` را دریافت می‌کند و یک پروفایل برای هر مدل در `~/.claude/profiles/<name>/settings.json` می‌نویسد، با استفاده از **همان نام‌های `setup-codex`** (`glm52`، `kimi-k27`، `deepseek-pro`، …):

```jsonc
// ~/.claude/profiles/glm52/settings.json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "glm/glm-5.2",
  "effortLevel": "xhigh",
  "env": {
    "ANTHROPIC_BASE_URL": "http://192.168.0.15:20128",
    "ANTHROPIC_MODEL": "glm/glm-5.2",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "190000",
  },
}
```

> **توکن احراز هویت هرگز در پروفایل نوشته نمی‌شود.** با `omniroute launch --profile <name>` اجرا کنید (که `ANTHROPIC_AUTH_TOKEN` را از context فعال تزریق می‌کند)، یا خودتان `ANTHROPIC_AUTH_TOKEN` را export کنید و `CLAUDE_CONFIG_DIR=~/.claude/profiles/<name> claude` را اجرا کنید.

**همگام‌سازی خودکار پس از کشف مدل (اختیاری).** OmniRoute می‌تواند همین فایل‌های `~/.claude/profiles/<name>/settings.json` را به‌صورت خودکار هر بار که همگام‌سازی مدل یک ارائه‌دهنده، فهرست زنده را تغییر می‌دهد، بازتولید کند — تا مدل‌های جدید/تغییرنام‌یافته بدون اجرای مجدد فرمان، پروفایل دریافت کنند. این قابلیت **به‌طور پیش‌فرض خاموش است**: آن را از داشبورد **CLI Code** («CLI profile auto-sync» → Claude Code) تغییر دهید، یا `OMNIROUTE_AUTO_SYNC_CLAUDE_PROFILES=true` را تنظیم کنید (همچنین `CLI_ALLOW_CONFIG_WRITES` را که به‌طور پیش‌فرض روشن است رعایت می‌کند). هنگام فعال بودن، تنها فایل‌های پروفایل را می‌نویسد؛ هرگز پیکربندی فعال/پیش‌فرض Claude، احراز هویت یا `~/.claude/settings.json` را تغییر نمی‌دهد.

### ساخت و استفاده از پروفایل‌ها

```bash
# OmniRoute محلی
omniroute setup-claude

# VPS راه دور (URL VPS را در هر پروفایل قرار می‌دهد)
omniroute setup-claude --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# فقط برخی ارائه‌دهنده‌ها
omniroute setup-claude --only glm,kimi

# پیش‌نمایش بدون نوشتن
omniroute setup-claude --dry-run

# اجرای یک پروفایل
omniroute launch --profile kimi-k27
```

---

## سطوح مدل (اختیاری)

Claude Code به سطوح قابلیت هدایت می‌شود. هر کدام را از طریق env / settings به یک مدل OmniRoute نگاشت کنید تا ارائه‌دهنده‌های متفاوتی برای هر سطح داشته باشید:

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL="glm/glm-5.2"
export ANTHROPIC_DEFAULT_SONNET_MODEL="kmc/kimi-k2.6"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="glm/glm-4.7-flash"
```

در غیر این صورت، یک `ANTHROPIC_MODEL` واحد (که پروفایل‌ها تنظیم می‌کنند) برای همه چیز استفاده می‌شود.

---

## حالت راه دور

پس از اجرای `omniroute connect <host>` (به [Remote Mode](./REMOTE-MODE.md) مراجعه کنید)، `omniroute launch` و `omniroute setup-claude` به‌طور خودکار آن سرور راه دور را هدف قرار می‌دهند و از توکن دسترسی محدوده‌شده آن استفاده می‌کنند — بدون نیاز به پرچم اضافی. برای هر بار فراخوانی با `--remote` / `--api-key` لغو کنید.

---

## رفع اشکال

**Claude Code به gateway توجهی نمی‌کند** — تأیید کنید `ANTHROPIC_BASE_URL` **`/v1` ندارد** و `claude` را راه‌اندازی مجدد کنید (env یک‌بار در زمان راه‌اندازی خوانده می‌شود). `omniroute launch` این کار را برای شما انجام می‌دهد.

**انتخابگر `/model` خالی است / مدل‌های gateway وجود ندارند** — به Claude Code نسخه v2.1.129+ و `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` نیاز دارد. تنها شناسه‌های مدل `claude*` / `anthropic*` در انتخابگر ظاهر می‌شوند؛ هر مدل دیگری را با `ANTHROPIC_MODEL=<id>` اجبار کنید (این همان کاری است که پروفایل‌ها انجام می‌دهند).

**خطاهای احراز هویت** — پروفایل هیچ توکنی نگه نمی‌دارد. از `omniroute launch --profile` استفاده کنید (آن را تزریق می‌کند) یا `ANTHROPIC_AUTH_TOKEN` را export کنید.

**پروفایل‌ها ایزوله نیستند** — هر پروفایل یک `CLAUDE_CONFIG_DIR` مجزا است؛ با `echo $CLAUDE_CONFIG_DIR` داخل نشست تأیید کنید که به `~/.claude/profiles/<name>` اشاره می‌کند.
