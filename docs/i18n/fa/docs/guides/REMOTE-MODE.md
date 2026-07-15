---
title: "حالت راهور — هدایت یک OmniRoute راهور از لپ‌تاپ خود"
version: 3.8.40
lastUpdated: 2026-06-28
---

# حالت راهور

CLI مربوط به `omniroute` را روی لپ‌تاپ خود اجرا کنید در حالی که OmniRoute خود در جای دیگری
(VPS، سرور خانگی، ماشین دیگری روی Tailnet شما) اجرا می‌شود. شما یک‌بار با
`omniroute connect` وارد می‌شوید و از آن پس **هر** دستور CLI به آن سرور راهور هدف می‌گیرد —
همان دستورات، همان خروجی، فقط در برابر راهور اجرا می‌شود.

هیچ ابزار دومی برای نصب وجود ندارد: حالت راهور همان CLI معمول `omniroute` به‌علاوهٔ
**access tokenهای با scope** است.

```bash
npm install -g omniroute                 # the normal CLI
omniroute connect 192.168.0.15           # log in (password → scoped token)
omniroute models list                    # ← now lists the REMOTE server's models
omniroute configure codex                # ← writes a local Codex profile from the remote catalog
```

---

## نحوهٔ کار

```
your laptop                              remote OmniRoute (VPS)
┌────────────────────┐                   ┌───────────────────────────────┐
│ omniroute CLI      │  POST /api/cli/connect  (password → token)         │
│  context: vps      │ ───────────────►  │ mints a scoped access token    │
│  baseUrl, token    │  Authorization: Bearer oma_live_…                  │
│                    │ ───────────────►  │ every management route, scope- │
│ writes configs     │ ◄───────────────  │ checked per the token's scope  │
│ LOCALLY            │                   └───────────────────────────────┘
└────────────────────┘
```

- **Contextها** هر کدام یک سرور را ذخیره می‌کنند (`~/.omniroute/config.json`، `chmod 600`).
  `omniroute contexts use <name>` سرور فعال را تعویض می‌کند؛ `default` محلی است.
- **Access tokenها** (`oma_live_…`) دستورات مدیریتی را authorize می‌کنند. آنها
  متمایز از کلیدهای API inference (`sk-…`، استفاده‌شده برای `/v1/chat/completions`) هستند.
- تنها هش SHA-256 یک توکن سمت سرور ذخیره می‌شود. plaintext **یک‌بار**، هنگام ایجاد نمایش
  داده می‌شود.

---

## اتصال

### با گذرواژهٔ مدیریتی (bootstrap)

```bash
omniroute connect 192.168.0.15
# Management password for http://192.168.0.15:20128: ********
# ✔ Connected to http://192.168.0.15:20128 — context '192.168.0.15' (scope: admin)
```

جریان گذرواژه به‌طور پیش‌فرض یک توکن **admin** تولید می‌کند (شما گذرواژه را دارید، بنابراین
از قبل کنترل کامل دارید). با `--scope` کاهش scope دهید:

```bash
omniroute connect 192.168.0.15 --scope write
```

گزینه‌ها: `--port <p>` (هنگامی که host پورتی ندارد)، `--name <ctx>` (نام context),
`--scope read|write|admin`. یک URL کامل به‌عنوان-is پذیرفته می‌شود:
`omniroute connect https://omni.example.com`.

### با یک توکن از پیش تولید‌شده

یک توکن با scope در داشبورد تولید کنید (یا با `omniroute tokens create`) و آن را جای‌گذاری
کنید — نیازی به گذرواژه نیست:

```bash
omniroute connect 192.168.0.15 --key oma_live_xxxxxxxx
```

CLI آن را از طریق `GET /api/cli/whoami` اعتبارسنجی و به‌عنوان context فعال ذخیره می‌کند.

---

## Scopeها

سه سطح، سلسله‌مراتبی (`admin ⊃ write ⊃ read`):

| Scope   | می‌تواند چه کار کند                                                                  |
| ------- | ------------------------------------------------------------------------------------ |
| `read`  | فهرست/بازرسی — `models list`، `providers status`، `logs`، `usage`، `cost`            |
| `write` | read **+** پیکربندی/اعمال — `setup-codex`، `keys add`، `config set`، کامبوها         |
| `admin` | write **+** مدیریت — CRUD `tokens`، افزودن ارائه‌دهنده، services، policy، oauth      |

سرور scope مورد نیاز هر مسیر را از متد HTTP (`GET`→read، mutationها→write) به‌علاوهٔ یک
allowlist ادمین برای سطوح حساس (`/api/cli/tokens`، mutationهای `/api/providers`،
`/api/oauth`، `/api/services`، …) استنتاج می‌کند. یک توکن با scope ناکافی `403` با یک
پیام واضح دریافت می‌کند.

> مسیرهایی که فرایند spawn می‌کنند (`/api/services/*`، `/api/mcp/*`، …) **فقط loopback**
> باقی می‌مانند — یک توکن راهور هرگز نمی‌تواند به آنها برسد، فارغ از scope.

---

## اتصال Antigravity روی یک نصب راهور

Antigravity از صفحهٔ consent firstparty/nativeapp مربوط به Google استفاده می‌کند. Google
تنها هنگامی کد مجوز را آزاد می‌کند که **loopback redirect**
(`http://127.0.0.1:<port>/callback`) از **مرورگری که ورود را تأیید می‌کند قابل دسترس باشد**.
روی یک نصب VPS راهور آن loopback روی سرور قرار دارد، نه روی ماشین شما، بنابراین صفحهٔ
consent **برای همیشه hang می‌شود و هرگز کدی آزاد نمی‌کند** — fallback عادی "URL callback
را جای‌گذاری کنید" چیزی برای جای‌گذاری ندارد. (این یک محدودیت سمت Google است: همین
hang در هر پروکسی که از کلاینت دسکتاپ همراه Antigravity استفاده می‌کند رخ می‌دهد، نه فقط
OmniRoute.)

دو راه پشتیبانی‌شده برای اتصال Antigravity به یک OmniRoute راهور وجود دارد.

### گزینهٔ الف — helper ورود محلی (توصیه‌شده)

OAuth را روی **کامپیوتر خودتان** اجرا کنید، جایی که `127.0.0.1` قابل دسترس است، و نتیجه را
در داشبورد راهور جای‌گذاری کنید. helper تنها با Google صحبت می‌کند — نیازی به دسترسی شبکه
به VPS شما **ندارد**، بنابراین حتی پشت فایروال‌ها کار می‌کند.

```bash
# On your LOCAL machine (needs Node.js + a browser):
npx omniroute login antigravity
#   ↳ opens the Google consent in your browser, captures the callback on a local
#     loopback port, exchanges it, and prints a one-line credential blob:
#
#   omniroute-cred-v1.eyJ2IjoxLCJ...
```

سپس، در داشبورد **راهور**: **Providers → Antigravity → Connect**، و blob
`omniroute-cred-v1.…` را در فیلد **Step 2** جای‌گذاری کنید (این هم URL callback و هم
credential blob را می‌پذیرد). OmniRoute آن را decode می‌کند، onboarding مربوط به Cloud Code را
سمت سرور اجرا و اتصال را ماندگار می‌کند.

> blob شامل یک refresh token است — با آن مانند گذرواژه رفتار کنید. این یک‌بار از طریق
> اتصال داشبورد شما ارسال و در حالت رمزنگاری‌شده ذخیره می‌شود.

flagها: `--no-browser` (چاپ URL به‌جای باز کردن خودکار)، `--port <n>` (تثبیت پورت loopback)،
`--timeout <ms>`.

### گزینهٔ ب — تونل SSH local-forward

اگر به VPS دسترسی SSH دارید، پورت داشبورد را forward کنید تا callback loopback از طریق
تونل به سرور بازگردد:

```bash
# On your LOCAL machine:
ssh -L 20128:localhost:20128 user@your-vps
# then open http://localhost:20128 in your LOCAL browser and connect Antigravity
# normally — the 127.0.0.1:20128/callback redirect now reaches the VPS via SSH.
```

چون شما به‌صورت `localhost:20128` به داشبورد می‌رسید، consent مربوط به Google تکمیل و
callback از طریق همان تونل به سرور تحویل داده می‌شود — نیازی به blob نیست. تونل را تا
زمانی که اتصال فعال نشان داده می‌شود باز نگه دارید.

> یک جایگزین کاملاً headless (بدون helper، بدون تونل) پیکربندی credentialهای web مربوط به
> OAuth Google **خودتان** + یک URL پایهٔ عمومی است؛ به متغیرهای محیطی OAuth ارائه‌دهنده
> مراجعه کنید. دو گزینهٔ بالا نیازی به راه‌اندازی اضافی Google ندارند.

---

## مدیریت توکن‌ها

```bash
omniroute tokens create --name "laptop" --scope write [--expires 30]
#   ↳ prints the secret ONCE — copy it now
omniroute tokens list                 # masked: id, name, scope, prefix, status, expiry
omniroute tokens revoke <id|prefix>   # revoke immediately
omniroute tokens scopes               # explain the three scopes
```

دستورات `tokens` نیازمند یک credential **admin** هستند. همچنین می‌توانید توکن‌ها را در
داشبورد تحت **Settings → Access Tokens** مدیریت کنید (ایجاد، ابطال، کپی یک‌باره).

---

## پیکربندی یک CLI کدنویسی از کاتالوگ راهور

`omniroute configure` کاتالوگ مدل زندهٔ **سرور فعال** را می‌خواند و یک پیکربندی روی
**ماشین شما** می‌نویسد.

```bash
omniroute configure codex
#   Providers: glm, kmc, ollamacloud, opencode-go, …
#   Provider: glm
#   Model id: glm/glm-5.2
#   ✔ Wrote ~/.codex/glm52.config.toml
#   Use it:  codex --profile glm52

# non-interactive
omniroute configure codex --provider glm --model glm/glm-5.2 --name glm52
```

profile نوشته‌شده کلید inference را با متغیر env (`OMNIROUTE_API_KEY`) ارجاع می‌دهد — راز
هرگز روی دیسک نوشته نمی‌شود. برای راه‌اندازی پایه یک‌بارهٔ Codex (بلوک
`[model_providers.omniroute]`)، به [CODEX-CLI-CONFIGURATION.md](./CODEX-CLI-CONFIGURATION.md)
مراجعه کنید.

### دستورات setup به‌ازای CLI

هر CLI پشتیبانی‌شده یک دستور setup آگاه از راهور دارد (همگی context فعال یا
`--remote <url> --api-key <key>` را رعایت می‌کنند):

| CLI          | دستور | چه چیزی می‌نویسد |
|--------------|-------|------------------|
| Codex        | `omniroute setup-codex` | profileهای `~/.codex/<name>.config.toml` (به ازای مدل) |
| Claude Code  | `omniroute setup-claude` | `~/.claude/profiles/<name>/settings.json` (به ازای مدل) |
| OpenCode     | `omniroute setup-opencode` | `~/.config/opencode/opencode.json` — ارائه‌دهندهٔ openai-compatible با نام `omniroute` با هر مدل کاتالوگ (اجرای `opencode -m omniroute/<model>`) |
| Cline        | `omniroute setup-cline` | `~/.cline/data/{globalState,secrets}.json` (حالت CLI) + چاپ تنظیمات افزونهٔ VS Code برای جای‌گذاری (سازگار با OpenAI، Base URL **بدون** `/v1`) |
| Kilo Code    | `omniroute setup-kilo` | `~/.local/share/kilo/auth.json` (CLI) + تنظیمات `kilocode.*` در VS Code — سازگار با OpenAI، Base URL **با** `/v1` |
| Continue     | `omniroute setup-continue` | `~/.continue/config.yaml` (VS Code/JetBrains + CLI مربوط به `cn`) — `provider: openai`، `apiBase` **با** `/v1`، کلید از طریق `${{ secrets.OMNIROUTE_API_KEY }}` |
| Cursor       | `omniroute setup-cursor` | مراحل درون‌برنامه‌ای را چاپ می‌کند (Settings → Models → Override OpenAI Base URL **با** `/v1` + کلید + مدل). config مربوط به Cursor SQLite opaque است — فقط پنل چت |
| Roo Code     | `omniroute setup-roo` | یک JSON import مربوط به Roo می‌نویسد (`~/.omniroute/roo-settings.json`) + تنظیم `roo-cline.autoImportSettingsPath` + چاپ مراحل رابط کاربری (سازگار با OpenAI، Base URL **با** `/v1`) |
| Crush        | `omniroute setup-crush` | `~/.config/crush/crush.json` — ارائه‌دهندهٔ `openai-compat`، `base_url` **با** `/v1`، کلید از طریق `$OMNIROUTE_API_KEY` |
| Goose        | `omniroute setup-goose` | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER=openai` + `OPENAI_HOST` **بدون** `/v1` + `GOOSE_MODEL`) + دستورالعمل env |
| Qwen Code    | `omniroute setup-qwen` | `~/.qwen/settings.json` — `modelProvider` با openai، `baseUrl` **با** `/v1`، کلید از طریق `envKey` (OMNIROUTE_API_KEY) |
| Aider        | `omniroute setup-aider` | `~/.aider.conf.yml` (`openai-api-base` **بدون** `/v1` + `model: openai/<id>`) + دستورالعمل env (`aider --message --yes`) |

```bash
# OpenCode (openai-compatible provider, all catalog models, remote VPS)
omniroute setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx
omniroute setup-opencode --only glm,kimi        # keep only matching models
opencode -m omniroute/glm/glm-5.2 "..."          # export OMNIROUTE_API_KEY first
```

> OpenCode همچنین یک یکپارچه‌سازی **افزونه‌ای** غنی‌تر دارد: `omniroute setup opencode`
> (اکنون آگاه از راهور از طریق `--remote`) `@omniroute/opencode-plugin` را نصب می‌کند.
> `setup-opencode` جایگزین سبک‌وزن openai-compatible است. کلید API از طریق
> `{env:OMNIROUTE_API_KEY}` ارجاع می‌شود — هرگز روی دیسک نوشته نمی‌شود.

---

## مدیریت contextها (تعویض میان سرورها)

یک **context** یک سرور ذخیره‌شده است (baseUrl + credential + scope). `omniroute connect`
یکی ایجاد و آن را فعال می‌کند؛ از آن پس هر دستور به آن هدف می‌گیرد. با `omniroute contexts`
مدیریت و میان آنها تعویض کنید:

```bash
omniroute contexts list            # all contexts; the active one is marked ●
omniroute contexts current         # the active server, auth status, scope
```

```text
  | Name    | Base URL                  | Auth  | Scope | Description
● | vps     | http://100.67.86.91:20128 | token | admin | Remote OmniRoute (…)
  | default | http://localhost:20128    | ✗     |       |
```

**تعویض سرورها** — هر دستور متوالی از context فعال پیروی می‌کند:

```bash
omniroute contexts use vps         # → all commands now hit the remote VPS
omniroute tokens list              #   (runs against the VPS)

omniroute contexts use default     # → back to localhost
omniroute tokens list              #   (runs against the local server)
```

**افزودن دستی یک context** (به‌جای `connect`)، بازرسی یا تغییر نام:

```bash
omniroute contexts add staging --url https://staging.example.com:20128 \
  --access-token oma_live_xxxx --scope write --description "staging box"
omniroute contexts show staging    # full details for one context
omniroute contexts rename staging stg
```

**حذف یک context** — برای تأیید prompt می‌کند؛ `--yes` را برای skip آن پاس دهید
(برای اسکریپت‌ها / shellهای غیرتعاملی الزامی است، که در غیر این صورت ایمنانه رد می‌شوند):

```bash
omniroute contexts remove stg --yes
```

> `default` (localhost) نمی‌تواند حذف شود. حذف context فعال به `default` fallback می‌کند.
> نکته: حذف یک context تنها credential ذخیره‌شدهٔ **محلی** را drop می‌کند — برای از بین
> بردن واقعی دسترسی، توکن را روی سرور با `omniroute tokens revoke <id>` ابطال کنید.

**صادرات / واردات** contextها (مثلاً برای جابجایی میان ماشین‌ها — رازها included هستند،
بنابراین با فایل به‌دقت رفتار کنید):

```bash
omniroute contexts export --out contexts.json     # default: stdout
omniroute contexts import contexts.json            # overwrite; --merge to keep existing
```

---

## بررسی سریع end-to-end

یک چرخهٔ حیات copy-paste برای تأیید یک راه‌اندازی راهور از صفر — اتصال، تولید یک توکن
با scope، مسیریابی یک دستور، تعویض برگشت و teardown. `192.168.0.15` را با host/IP سرور
خود (Tailscale، LAN یا یک URL عمومی `https://…`) جایگزین کنید.

```bash
# 1. Connect (password → admin token, saved as a context that becomes active)
omniroute connect 192.168.0.15                 # or: --key oma_live_xxxx  (no password)
omniroute contexts current                     # shows the remote server + scope

# 2. Use it — management commands now run against the remote
omniroute tokens create --name laptop --scope read   # mint a narrower token
omniroute tokens list                                 # masked list, from the remote

# 3. Switch back and forth
omniroute contexts use default                 # → local
omniroute contexts use 192-168-0-15            # → remote again (name from `contexts list`)

# 4. Tear down. NOTE: `contexts remove` only deletes the LOCAL credential —
#    it does NOT revoke the token on the server. Revoke server-side first if you
#    want to actually kill access.
omniroute tokens revoke <id|prefix>            # kills access on the server
omniroute contexts remove 192-168-0-15 --yes   # drop the local context (even if active → falls back to default), no prompt
```

> `--yes` باعث می‌شود `contexts remove` غیرتعاملی شود (در اسکریپت/CI الزامی است؛ بدون آن،
> یک shell غیرتعاملی ایمنانه به‌جای hang کردن رد می‌شود). حذف context **فعال** به‌طور
> خودکار به `default` fallback می‌کند.

---

## یادداشت‌های امنیتی

- plaintext توکن یک‌بار نمایش داده می‌شود؛ تنها هش SHA-256 ماندگار است (مانند کلیدهای API).
- `omniroute connect` از قفل brute-force ورود و ثبت لاگ ممیزی مجدد استفاده می‌کند.
- برای انتقال HTTPS یا Tailnet را ترجیح دهید؛ یک host خالی به‌صورت پیش‌فرض برای راحتی LAN/Tailscale
  به `http://` پیش‌فرض می‌شود — برای TLS یک URL کامل `https://…` پاس دهید.
- فایل context محلی `~/.omniroute/config.json` (`chmod 600`) است؛ توکن‌ها هرگز در لاگ‌ها
  چاپ نمی‌شوند (ماسک‌شده به یک پیشوند).

---

## نقاط پایانی API (مرجع)

| متد    | مسیر                  | احراز هویت          | Scope                      |
| ------ | --------------------- | ------------------- | -------------------------- |
| POST   | `/api/cli/connect`    | گذرواژه مدیریتی     | — (عمومی، password-gated)  |
| GET    | `/api/cli/whoami`     | access token        | read                       |
| GET    | `/api/cli/tokens`     | access token        | admin                      |
| POST   | `/api/cli/tokens`     | access token        | admin                      |
| DELETE | `/api/cli/tokens/:id` | access token        | admin                      |

برای schemaهای کامل به [openapi.yaml](../openapi.yaml) مراجعه کنید.
