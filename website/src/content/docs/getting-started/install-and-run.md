---
title: Install and Run
description: Install Keyper locally and start the app.
---

## Install options

### Option 1: Download a desktop app (no Node required)

Current published installer links are available for Windows and Linux.

| Platform              | Package              | Download                                                                                             |
| --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Windows               | NSIS installer       | [Keyper.Setup.v1.3.1-win-x64.exe](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/Keyper%20Setup%20v1.3.1-win-x64.exe) |
| Linux                 | AppImage (ARM64)     | [Keyper-1.3.1-arm64.AppImage](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/Keyper-1.3.1-arm64.AppImage)   |
| Linux                 | AppImage (AMD64)     | [Keyper-1.3.1-x86_64.AppImage](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/Keyper-1.3.1-x86_64.AppImage)   |
| Linux (Debian/Ubuntu) | `.deb` (x86_64)      | [keyper_1.3.1_amd64.deb](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/keyper_1.3.1_amd64.deb) |
| Linux (Debian/Ubuntu) | `.deb` (ARM64)       | [keyper_1.3.1_arm64.deb](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/keyper_1.3.1_arm64.deb) |

**Windows quick start:**

1. Download [Keyper.Setup.v1.3.1-win-x64.exe](https://pub-da847cd0fc1045b3a5a7fcc39a3be134.r2.dev/Keyper.Setup.v1.3.1-win-x64.exe).
2. Run the installer and follow the setup wizard.
3. Launch Keyper from the Start menu or desktop shortcut.

**Linux AppImage quick start:**

```bash
chmod +x Keyper-1.3.1-x86_64.AppImage
./Keyper-1.3.1-x86_64.AppImage
```

**Linux .deb quick start:**

```bash
sudo dpkg -i keyper_1.3.1_amd64.deb
keyper   # or launch from your applications menu
```

### Option 2: Docker (no Node required)

Prerequisites: Docker.

**Quick Start with Docker Hub (Pre-built Image):**

```bash
# Run the latest version on port 8080
docker run -d -p 8080:80 --name keyper --restart unless-stopped pinkpixeldev/keyper:latest
```
Access at `http://localhost:8080`. The container exposes the compiled SPA on port 80 internally. No volumes or environment variables are needed — all configuration (Supabase credentials, Neon connection strings, or SQLite provider selection) is entered in-app and stored in browser `localStorage`.

**With Docker Compose (Local Build):**

```bash
git clone https://github.com/pinkpixel-dev/keyper.git
cd keyper

# Build and start on http://localhost:8080
docker compose up -d

# Custom port
HOST_PORT=3030 docker compose up -d
```

### Option 3: Global npm install

Prerequisites: Node.js 18+.

```bash
npm install -g @pinkpixel/keyper
keyper
```

### Option 4: NPX (no install)

```bash
npx @pinkpixel/keyper
```

### Option 5: Local repo / development

```bash
git clone https://github.com/pinkpixel-dev/keyper.git
cd keyper
npm install
npm run dev      # Vite dev server
# or
npm run build && npm start   # production preview
```

### Option 6: Build Electron installers from source

```bash
git clone https://github.com/pinkpixel-dev/keyper.git
cd keyper
npm install

npm run electron:build:linux   # AppImage + deb
npm run electron:build:win     # NSIS installer
```

## First run

1. Open the app URL (default `http://localhost:4173` for npm/npx, `http://localhost:8080` for Docker, or the Electron window).
2. In the setup wizard, **choose your database provider**:
   - **SQLite (Local)** — zero-config, no account required; schema is created automatically. In browser/PWA mode it persists locally in IndexedDB. In Electron it can also target a file on disk.
   - **Supabase** — enter your Supabase URL and anon/publishable key, then run the SQL setup script to create required tables/policies. Existing users should also run `migration-add-document-misc-types.sql` to enable `document` and `misc` credential types.
   - **Neon Postgres** — enter your Neon Cloud or Neon Local Docker connection string, then run `sql/neon-setup.sql` to create required tables/policies.
3. Return to the app, test connection, and save.
4. Unlock or initialize your vault using your master passphrase.
5. For additional users:
   - **Supabase** — each person signs up with their own email from the sign-in screen.
   - **SQLite / Neon** — enter a different username on the unlock screen; each one gets its own vault and passphrase.
6. To switch later: on Supabase, sign out and sign in as that account. On SQLite and Neon, change the username on the unlock screen, then unlock with that vault's passphrase.

## Verify health

```bash
npm run test:run
npm run build
```

Both commands currently pass on the audited codebase.
