# 🔐 Keyper - Self-Hosted Credential Management

<div align="center">

<img src="./public/logo.png" alt="Keyper Logo" width="300" />

**✨ Your Credentials. Your Security. Your Rules. ✨**

[![Version](https://img.shields.io/npm/v/@pinkpixel/keyper?style=for-the-badge&color=06B6D4)](https://www.npmjs.com/package/@pinkpixel/keyper)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Ready-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Neon](https://img.shields.io/badge/Neon-Postgres-00E699?style=for-the-badge)](https://neon.tech/)
[![SQLite](https://img.shields.io/badge/SQLite-Local--First-003B57?style=for-the-badge&logo=sqlite)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://hub.docker.com/)
[![Electron](https://img.shields.io/badge/Electron-v41-47848F?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![PWA](https://img.shields.io/badge/PWA-Enabled-5A0FC8?style=for-the-badge)](https://web.dev/progressive-web-apps/)

_A secure, self-hosted credential management application for storing and organizing your digital credentials with complete privacy and control._

![The Keyper dashboard with an unlocked vault, showing credential cards with their type, category, tags, and priority](./screenshots/demo-dashboard.png)

[🚀 Quick Start](#-quick-start) • [🖼️ Screenshots](#️-screenshots) • [📦 Installation](#-installation) • [🗄️ Setup](#️-database-setup) • [📱 PWA](#-progressive-web-app) • [🔧 Troubleshooting](#-troubleshooting)

</div>

---

> ## ⚠️ Upgrading from an earlier version?
>
> **1.3.0 needs a one-time database update if you use Supabase.**
> Please read **[MIGRATION.md](MIGRATION.md)** before you update. It takes five
> minutes and covers every step with expected output and troubleshooting.
>
> SQLite and Neon users, and anyone installing fresh, can skip it.

---

## 📥 Download

Desktop installers are available on the **[Keyper website](https://keyper.icu/getting-started/install-and-run/)** or on the [GitHub releases page](https://github.com/pinkpixel-dev/keyper/releases).

Scroll down to see other installation options.

---

## 🖼️ Screenshots

![Keyper Screenshot 1](./screenshots/screenshot1.png)

![Keyper Screenshot 2](./screenshots/screenshot2.png)

![Keyper Screenshot 3](./screenshots/screenshot3.png)

![Keyper Screenshot 4](./screenshots/screenshot4.png)

![Keyper Screenshot 5](./screenshots/screenshot5.png)

![The same vault in list view, showing one row per credential with its category, tags, and last-updated date](./screenshots/demo-dashboard-list.png)

---

## 🌟 Features

### 🔒 **Secure Credential Storage**

- 🔑 **API Keys** - Store and organize your API credentials
- 🔐 **Login Credentials** - Username/password combinations
- 🤫 **Secrets** - Sensitive configuration values
- 🎫 **Tokens** - Authentication and access tokens
- 📜 **Certificates** - SSL certificates and keys
- 📄 **Documents** - Secure file uploads for `.pdf`, `.doc`, `.docx`, `.odt`, `.txt`, `.md`
- 🧩 **Miscellaneous** - Large multiline secure notes/commands/scripts that don’t fit fixed types

### 🏷️ **Smart Organization**

- 📂 **Categories** - Group credentials by service or type
- 🔖 **Tags** - Flexible labeling system
- ⚡ **Priority Levels** - Low, Medium, High, Critical
- 📅 **Expiration Tracking** - Never miss renewal dates
- 🔍 **Real-time Search** - Find credentials instantly
- 👁️ **Quick Reveal & Copy** - Reveal and copy sensitive values directly from the credential detail view
- 👁️ **Inline Text Document Preview** - Text-like document credentials (`.txt`, `.md`, `text/*`) can be previewed inline in credential detail view
- ⬇️ **Secure Document Download** - All document credentials can be downloaded from detail view

### 🎨 **Personalized Workspace**

- 🖥️ **Theme Choices** - Light, Dark, System, Charcoal, Medium Gray, Light Gray, Warm Light, Blue, Midnight Blue, and Deep Purple appearance modes
- 🎛️ **Persistent Preferences** - Theme and font choices are saved locally and restored across sessions
- 🧭 **Adaptive UI Accents** - Core dashboard controls, tags, and backgrounds follow the selected palette
- 📚 **Appearance Docs** - The website docs include an [Appearance Settings](https://keyper.icu/getting-started/appearance-settings/) guide covering all built-in themes and fonts

### 🛡️ **Enterprise-Grade Security**

- 🔒 **Row Level Security (RLS)** - Every policy is scoped to `TO authenticated` and `owner_id = auth.uid()`, so the anon key on its own reads nothing
- 🔐 **End-to-End Encryption** - AES-256-GCM under a key that only your master passphrase can unwrap
- 👤 **Multi-User Support** - Real accounts via Supabase Auth, with per-account vault isolation enforced by the database
- 🌐 **Secure Connections** - HTTPS/TLS encryption
- 🏠 **Self-Hosted** - Complete control over your data

> **Good to know:** encryption covers the secret values themselves. Titles,
> usernames, URLs, notes, tags and categories are stored as regular text so
> Keyper can search and sort them. See [Security model](#security-model) for what
> each layer covers.

### 🔐 **Advanced Encryption Features**

- **Passphrase-Wrapped Vault Key** - The key that decrypts your secrets is stored only encrypted under your master passphrase, so a full database dump does not decrypt anything
- **AES-256-GCM Encryption** - Industry-standard authenticated encryption
- **Argon2id Key Derivation** - Memory-hard, ASIC-resistant (with PBKDF2 fallback)
- **Auto-Lock Protection** - 15-minute inactivity timeout with activity detection
- **Authenticated Row Access** - Supabase Auth session required before the database returns any row
- **Legacy Vault Migration** - Vaults created before v1.3.0 are re-wrapped automatically on first unlock
- **No Passphrase Recovery** - There is no stored value that can reset your passphrase, by design

---

## 🚀 Quick Start

Get Keyper running on your own infrastructure in under 5 minutes!

### Prerequisites

- **Node.js 18+** installed on your system
- **Database (choose one)**:
  - 🗄️ **SQLite (local mode)** — no account or server required, zero configuration, works in browser and Electron desktop
  - ☁️ **Supabase** — free tier works perfectly for hosted/remote/multi-device usage
  - 🐘 **Neon Postgres** — Neon Cloud or Neon Local Docker using a Postgres connection string
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### ⚡ 1-Minute Installation

```bash
# Install Keyper globally
npm install -g @pinkpixel/keyper

# Start the server (default port 4173)
keyper

# Or start with custom port
keyper --port 3000

# Open in your browser
# 🌐 http://localhost:4173 (or your custom port)
```

**That's it!** 🎉 Follow the in-app setup wizard to configure your database (choose **SQLite** for zero-config local storage, **Supabase** for hosted cloud storage, or **Neon** for cloud/local Postgres).

### 🌐 Try the Demo

**Want to try Keyper before installing?** Visit our hosted demo:

**🔗** [**app.keyper.icu**](https://app.keyper.icu)

Just enter your own Supabase credentials and start managing your encrypted credentials instantly! Your data stays completely private since all encryption happens in your browser.

**Demo Usage:**

- ✅ **Your Keys Stay Yours** - Your master passphrase never leaves your browser, and the vault key is stored only in wrapped form
- ✅ **Real Functionality** - Full Keyper experience with your own Supabase instance
- ✅ **No External Signup Required** - Just bring your Supabase URL and anon/publishable key
- ✅ **In-App User Registration Available** - Create multiple isolated user vaults directly inside Keyper
- ⚠️ **Demo Limitations** - Recommended for testing and light usage only
- 🏠 **Self-Host for Production** - Install locally for best performance and full control

_Note: The demo uses the same secure architecture as self-hosted Keyper. Your Supabase credentials are stored only in your browser's localStorage and never transmitted to our servers._

---

## 📦 Installation

### Method 1: Global NPM Installation (Recommended)

```bash
npm install -g @pinkpixel/keyper
```

**Available Commands:**

- `keyper` - Start Keyper server
- `keyper --port 3000` - Start on custom port
- `keyper --help` - Show help and usage
- `credential-manager` - Alternative command
- `keyper-dashboard` - Another alternative

### Method 2: NPX (No Installation Required)

```bash
npx @pinkpixel/keyper
```

### Method 3: Local Development

```bash
git clone https://github.com/pinkpixel-dev/keyper.git
cd keyper
npm install
npm run build
npm start
```

### Method 4: 🐳 Docker

Run Keyper as a containerised web app — no Node.js required on the host!

**Quick Start (Docker Hub)**
```bash
docker run -d -p 8080:80 --name keyper --restart unless-stopped pinkpixeldev/keyper:latest
```

**Build Locally (Docker Compose)**
```bash
# Clone the repo
git clone https://github.com/pinkpixel-dev/keyper.git
cd keyper

# Build & start (serves on http://localhost:8080)
docker compose up -d

# Or on a custom port
HOST_PORT=3030 docker compose up -d

# Force rebuild after source changes
docker compose up -d --build

# Stop
docker compose down

# Follow logs
docker compose logs -f
```

> **Note:** Keyper stores all configuration (Supabase credentials, Neon connection strings, or SQLite provider selection) in browser `localStorage` — no environment variables or volumes are required.

### Method 5: ⚡ Electron Desktop App

Run Keyper as a native desktop app on **Windows or Linux**!

#### Published desktop downloads

| Platform              | Package              | Download                                                                                             |
| --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Windows               | NSIS installer       | [Keyper.Setup.v1.3.3-win-x64.exe](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/Keyper.Setup.v1.3.3-win-x64.exe) |
| Linux                 | AppImage (ARM64)     | [Keyper-1.3.3-arm64.AppImage](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/Keyper-1.3.3-arm64.AppImage)   |
| Linux                 | AppImage (AMD64)     | [Keyper-1.3.3-x86_64.AppImage](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/Keyper-1.3.3-x86_64.AppImage)   |
| Linux (Debian/Ubuntu) | `.deb` (x86_64)      | [keyper_1.3.3_amd64.deb](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/keyper_1.3.3_amd64.deb) |
| Linux (Debian/Ubuntu) | `.deb` (ARM64)       | [keyper_1.3.3_arm64.deb](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/keyper_1.3.3_arm64.deb) |

Older versions are on the [GitHub releases page](https://github.com/pinkpixel-dev/keyper/releases).

#### Preview (no packaging)

```bash
git clone https://github.com/pinkpixel-dev/keyper.git
cd keyper
npm install
npm run electron:preview
```

#### Build a distributable installer

```bash
# desktop packaging from source
npm run electron:build:linux   # AppImage + deb
npm run electron:build:win     # NSIS installer
```

Installers are output to `dist-electron/`.

---

## 🔄 Upgrading to 1.3.0

> ### 📖 **[→ Read the full Migration Guide](MIGRATION.md)**
>
> **If you already use Keyper with Supabase, please read
> [MIGRATION.md](MIGRATION.md) in full before you start.** It is a five-minute
> read and it walks through every step with expected output and troubleshooting.
> Keyper also guides you through the same steps in the app.

1.3.0 needs a one-time database update before it will open an existing vault.

### The three rules

1. **Run the five scripts one at a time, in order.** Do not paste them all in together.
2. **Back up first.** Supabase → Database → Backups.
3. **Do not run `sql/supabase-setup.sql`.** That is for new installs only.

Every script checks itself before changing anything, so running one out of order
stops safely and tells you where to go back to. Nothing half-applies.

### What changed

Keyper now signs you in to an account before opening your vault, and stores your
vault key in a stronger form.

- **You sign in with an email and password.** Previously Keyper identified you by
  a username you typed. Now it uses a real account, and the database checks it.
- **Each account only sees its own data,** enforced by the database rather than
  by the app filtering results.
- **Your vault key is now stored encrypted under your master passphrase.** It used
  to be stored in a form the server could read directly. This means a copy of the
  database is no longer enough to decrypt anything.

Your credentials are not changed and not re-encrypted.

### The short version

| # | Where | What |
|---|---|---|
| 1 | Supabase | Back up your database |
| 2 | Supabase | Authentication → Providers → enable Email |
| 3 | Supabase | Authentication → Users → Add user |
| 4 | SQL Editor | Run [`migration/01-check.sql`](migration/01-check.sql), copy your account UUID |
| 5 | SQL Editor | Run [`migration/02-claim-your-data.sql`](migration/02-claim-your-data.sql) — **paste your UUID into the one marked line** |
| 6 | SQL Editor | Run [`migration/03-apply-security.sql`](migration/03-apply-security.sql) |
| 7 | Keyper | Sign in, then unlock with your **existing** master passphrase |
| 8 | SQL Editor | Run [`migration/04-check-key.sql`](migration/04-check-key.sql) to confirm |
| 9 | SQL Editor | Run [`migration/05-remove-old-key.sql`](migration/05-remove-old-key.sql) |

Only step 5 needs an edit. Everything else is paste-and-run.

### Two things to know before you start

**You will have two secrets, not one.** The account password you create in step 3
gets you your rows. Your existing master passphrase decrypts them. They are
different, and you need both.

**Your master passphrase can no longer be reset.** You can change it whenever you
know the current one, but nothing stored can recover it. Older versions allowed a
reset only because the vault key sat separately in usable form, which is the
thing being fixed. **Write your passphrase down somewhere safe before you start.**

Full detail, expected output at each step, and troubleshooting:
**[MIGRATION.md](MIGRATION.md)**

---

## 🗄️ Database Setup

Keyper supports three database backends — choose the one that fits your workflow:

| Feature                   | SQLite (Local)                                                         | Supabase (Cloud)              | Neon Postgres (Cloud/Local)           |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| Setup required            | None — auto-configured                                                 | Project creation + SQL script | Connection string + Neon setup script |
| Internet connection       | ❌ Not required                                                        | ✅ Required                   | ✅ Cloud / local proxy for Neon Local |
| Multi-device sync         | ❌ Not supported                                                       | ✅ Supported                  | ✅ Supported                          |
| Works in browser/PWA      | ✅ Yes                                                                 | ✅ Yes                        | ✅ Yes                                |
| Works in Electron desktop | ✅ Yes                                                                 | ✅ Yes                        | ✅ Yes                                |
| Data location             | Your device (IndexedDB in browser/PWA, optional file path in Electron) | Your Supabase project         | Neon Cloud or Neon Local branch       |

### Option A: SQLite (Local — Zero Config)

1. Start Keyper and open the app in your browser, PWA, or Electron desktop build
2. In the setup wizard, select **"SQLite (Local)"** as your database provider
3. **Master Passphrase**: Create your encryption passphrase
4. **Start Managing**: Add your first encrypted credential! 🎉

> SQLite mode stores your encrypted vault locally with no external service required. In browser/PWA mode it uses **IndexedDB** automatically; in Electron you can also point Keyper at a SQLite file on disk.

### Option B: Supabase (Hosted Cloud)

#### Step 1: Create Your Supabase Project

1. Visit [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Configure your project:
   - **Name**: `keyper-db` (or your preference)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your location

4. Wait 1-2 minutes for setup completion

#### Step 2: Get Your Credentials

1. In Supabase dashboard: **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://your-project.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

⚠️ **Important**: Use the **anon/public** key, NOT the service_role key!

#### Step 3: Configure Keyper

1. Start Keyper: `keyper`
2. Open [http://localhost:4173](http://localhost:4173)
3. **Database Setup**: Configure your Supabase connection
   - Enter your Supabase URL and anon/publishable key
   - Copy and run the complete SQL setup script in Supabase SQL Editor
   - If you already have an existing Keyper database, run the update script too (`migration-add-document-misc-types.sql`) so `document` and `misc` credential types work
   - The script creates tables with the latest security features:
     - `raw_dek` and `bcrypt_hash` columns for the new simplified security model
     - Backwards compatibility for existing users with legacy `wrapped_dek` system
     - Latest credential type support (`api_key`, `login`, `secret`, `token`, `certificate`, `document`, `misc`)
   - Test the connection

4. **Master Passphrase**: Create your encryption passphrase
   - Choose a strong passphrase (8+ characters recommended)
   - New users get the simplified bcrypt-only authentication system
   - This encrypts all your credentials client-side with secure emergency reset capabilities

5. **Start Managing**: Add your first encrypted credential! 🎉

### Option C: Neon Postgres (Cloud or Local)

#### Step 1: Prepare Neon

- **Neon Cloud**: Create or open a project at [neon.tech](https://neon.tech), then copy a pooled or direct Postgres connection string from the Neon dashboard.
- **Neon Local**: Start the official Neon Local Docker container, then use its local Postgres connection string, for example `postgres://neon:npg@localhost:5432/neondb`.

#### Step 2: Configure Keyper

1. Start Keyper and open the setup wizard.
2. Select **Neon Postgres** as the database provider.
3. Choose **Neon Cloud** or **Neon Local Docker**.
4. Paste the connection string.
5. Copy and run `sql/neon-setup.sql` in the Neon SQL Editor or any Postgres client connected to Neon.
6. Test the connection, save, and continue into the vault.

⚠️ **Important:** Neon connection strings include a database role password. Keyper stores the string locally in your browser or Electron profile. Sensitive credential values are still encrypted client-side before they are written to Neon.

---

## 📱 Progressive Web App

Keyper works as a Progressive Web App for a native app experience!

### 🖥️ Desktop Installation

1. Open Keyper in Chrome/Edge/Firefox
2. Look for the install icon in the address bar
3. Click to install as a desktop app
4. Access from your applications menu

### 📱 Mobile Installation

1. Open Keyper in your mobile browser
2. Tap the browser menu (⋮)
3. Select **"Add to Home Screen"** or **"Install App"**
4. Access from your home screen

### ✨ PWA Benefits

- 📱 Native app experience
- 🚀 Faster loading times
- 🌐 Offline functionality
- 🔄 Background updates
- 📲 Push notifications (coming soon)

---

## 🔧 Troubleshooting

### Common Issues

**❌ "Connection failed: Database connection failed"**

- Verify URL format - now supports any valid HTTP/HTTPS URL (v1.0.6+)
  - ✅ Cloud: `https://your-project.supabase.co`
  - ✅ Local: `http://localhost:54321`, `http://192.168.1.100:8000`
  - ✅ Custom: `https://supabase.mydomain.com`
- Use **anon/public** key, not service_role
- Check that your Supabase project is active
- For Neon, verify the connection string is copied exactly and that `sql/neon-setup.sql` has completed successfully
- For Neon Local, make sure the Docker container is running and reachable from the browser or Electron app

**❌ "relation 'credentials' does not exist"**

- Run the complete SQL setup script in Supabase SQL Editor or the Neon setup script in Neon SQL Editor
- Ensure the script completed without errors

**❌ New `document` or `misc` credentials fail to save**

- Run the existing-database update script: `migration-add-document-misc-types.sql`
- Confirm `credentials_credential_type_check` includes `document` and `misc`

**❌ Dashboard shows "No credentials found"**

- Click **"Refresh App"** button
- Clear browser cache and reload
- For PWA: Uninstall and reinstall the app

**❌ Can't enter new credentials after clearing configuration**

- Refresh the page after clearing configuration
- Ensure you're using a valid HTTP/HTTPS URL (any format supported in v1.0.6+)
- Try clearing browser cache if form inputs appear stuck

**❌ Categories dropdown is empty when using custom username**

- This issue has been resolved in the latest version
- Categories should now appear for all usernames (both default and custom)
- If still experiencing issues, try refreshing the page after setting your username

**❌ App doesn't show setup wizard after clearing database**

- Clear browser cache and cookies for the site
- For Chrome/Edge: Settings → Privacy → Clear browsing data → Cookies and cached files
- For Firefox: Settings → Privacy → Clear Data → Cookies and Site Data + Cached Web Content
- Refresh the page to see the initial setup screen

**❌ Stuck in configuration loops or can't access settings**

- Clear browser cache and localStorage completely
- Refresh the page and reconfigure your database connection
- Ensure your Supabase credentials are correct
- Use the built-in database health checks to verify table integrity

**❌ Multi-user vault conflicts**

- Each user has their own isolated encrypted vault
- Use **Dashboard Settings → User Management** to switch users
- Use **Create New User** from the lock screen or **Add New User** in user management
- Refresh after user-switch actions if prompted for the cleanest vault context handoff
- Each user's data is completely separate and encrypted individually

### 🔑 Master Passphrase: change it, you cannot reset it

You can **change** your master passphrase from Settings if you know the current
one. You cannot **reset** it if you have forgotten it. Nobody can, including us,
and that is the point.

**Changing it** re-wraps the same vault key under a key derived from your new
passphrase. Nothing gets re-encrypted, so it is quick and every existing
credential keeps working.

**If you forget it**, the vault is gone. There is no recovery path and no
support request that helps. Your only option is to delete the vault and start
over. Write your passphrase down and put it somewhere safe.

> **This changed in v1.3.0, and the change was deliberate.** Older versions let
> you regain access by overwriting the `bcrypt_hash` column in the database.
> That worked because the vault key was stored separately, in usable form, in
> `raw_dek`. Which also meant anyone who could write to your database could
> reset the hash, read the key and decrypt everything. The reset was not a
> feature sitting next to the encryption; it was a hole straight through it.
>
> The vault key is now stored only wrapped under your passphrase, so there is
> no value in the database that a reset could unlock. Losing the passphrase
> genuinely loses the data. That is the trade, and it is the right one for a
> credential manager.

**Account password vs master passphrase** — two different secrets:

| | Account password | Master passphrase |
|---|---|---|
| What it does | Proves who you are so the database returns your rows | Decrypts those rows |
| Where it lives | Supabase Auth | Only in your head |
| Can it be reset? | Yes, by email | No, never |
| If leaked | Attacker gets ciphertext and metadata | Attacker needs your rows too |

### Getting Help

1. **Upgrading to 1.3.0?** Start with [MIGRATION.md](MIGRATION.md)
2. Check the [documentation](https://keyper.icu) or the [Self-Hosting Guide](SELF-HOSTING.md)
3. Review the browser console for errors (F12 → Console)
4. Check your database provider logs (Supabase dashboard → Logs, or DevTools → Console for SQLite)
5. Report bugs and request features on [GitHub](https://github.com/pinkpixel-dev/keyper/issues)
6. For anything else, email **[support@keyper.icu](mailto:support@keyper.icu)**

> When asking for help, never include your master passphrase, your database
> connection string, or the contents of your `vault_config` table.

---

---

## 🛡️ Security & Privacy

### Your Data, Your Control

- ✅ **Self-Hosted** - Run on your own infrastructure
- ✅ **Private Database** - Your Supabase instance, Neon database, or local SQLite storage
- ✅ **No Tracking in App** - Zero telemetry or analytics inside the Keyper application. (The public documentation website uses basic analytics to track downloads and pages view counts)
- ✅ **Open Source** - Fully auditable code

### Security Features

- 🔒 **Row Level Security** - Owner-scoped policies that require an authenticated session
- 🔐 **Encryption** - Secret values encrypted client-side; metadata stored in plaintext
- 👤 **User Isolation** - Enforced by the database, not by client-side filtering
- 🛡️ **Offline-First Option** - SQLite mode requires no internet and stores data entirely on-device

### Multi-User Notes

- **Registration**: Users self-register with an email and password through Supabase Auth. No admin account is required. Enable the Email provider in your Supabase project first.
- **Isolation**: Every account has its own `vault_config`, wrapped vault key, credentials and categories, and the database enforces the separation through owner-scoped RLS policies. It is not client-side filtering that you could bypass by editing a query.
- **Switching accounts**: Sign out and sign in as the other account. There is no in-app account switcher any more, because listing other users required a database read that is now correctly refused.
- **No Backdoors**: There is no admin override and no recovery path. Signing in gets you your own encrypted rows; the master passphrase is still required to read them.

### Security model

Keyper protects your data in layers. They are easy to mix up, so here is what
each one actually does:

| Layer | What it covers |
|---|---|
| Supabase Auth session | Decides whether the database returns your rows at all |
| Owner-scoped RLS policies | Keeps each account to its own rows, checked by the database |
| Passphrase-wrapped vault key | Means a copy of the database cannot decrypt anything on its own |
| AES-256-GCM on `secret_blob` | Encrypts the secret values themselves |

**Scope, so you know what you are working with:**

- Encryption covers the secret values. `title`, `username`, `url`, `notes`, `tags`, `category` and `priority` are stored as regular text, which is what makes search and sorting work. Encrypting them is on the roadmap.
- Your master passphrase is the only thing that unlocks the vault key, and it is never sent anywhere. That also means nobody can recover it for you, so keep a copy somewhere safe.
- The anon/publishable key is designed to be public and is safe to expose. On its own it does not open anything.
- **Neon mode works differently.** It connects to Postgres directly from the browser using a connection string, which carries full database access, so database-side rules cannot narrow it down. It suits a single operator who keeps that string private. For separate accounts use Supabase; for a private local vault use SQLite.

---

## 🚀 Tech Stack

- **Frontend**: React 19.1 + TypeScript
- **Build Tool**: Vite 7.0
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL + Auth), Neon Postgres, or SQLite (sql.js / IndexedDB)
- **State Management**: TanStack Query
- **Forms**: React Hook Form + Zod
- **PWA**: Vite PWA Plugin + Workbox

---

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

## Made with 💖

**Created by Pink Pixel** ✨
_Dream it, Pixel it_

- 🌐 **Website**: [pinkpixel.dev](https://pinkpixel.dev)
- 📧 **Email**: [admin@pinkpixel.dev](mailto:admin@pinkpixel.dev)
- 💬 **Discord**: @sizzlebop
- ☕ **Support**: [Buy me a coffee](https://www.buymeacoffee.com/pinkpixel)

---

<div align="center">

**⭐ Star this repo if Keyper helps secure your digital life! ⭐**

</div>
