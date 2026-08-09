# 📝 Changelog

All notable changes to Keyper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-08-09 - 🔐 **Accounts, Owner-Scoped Database Rules & Wrapped Vault Key**

Keyper now signs you in to a real account before opening your vault, and stores
the vault key encrypted under your master passphrase. Existing installs need a
one-time database update; see the upgrade notes below and back up first.

Thanks to **Cenk Kurtoglu** ([github.com/cekuu35](https://github.com/cekuu35))
for reviewing the shipped setup SQL and reporting this privately.

### 🔐 Security

- **Fixed** The Row Level Security policies were more permissive than intended. All twelve were written as `USING (true)` with no `TO` clause, so they applied to `PUBLIC` rather than to the signed-in owner, and the anon role was included. The database was therefore not enforcing the separation the app assumed. Policies are now scoped `TO authenticated` with `owner_id = (SELECT auth.uid())`.
- **Changed** `vault_config.raw_dek` stored the data encryption key in a form the server could use directly. The key is now stored only wrapped under an Argon2id key derived from the master passphrase, so a copy of the database cannot decrypt anything on its own.
- **Changed** The bcrypt passphrase reset depended on the key being stored separately from the passphrase, so it no longer applies. Both `raw_dek` and `bcrypt_hash` are removed, and the passphrase is no longer recoverable.
- **Fixed** `get_credential_stats()` ran as `SECURITY DEFINER` while reading the `credentials` table, which meant it did not inherit the caller's row rules. It is now `SECURITY INVOKER` and owner-scoped.
- **Changed** Per-user separation was previously applied by the app filtering on a `user_id` string from `localStorage`. It is now enforced by the database.
- **Fixed** The setup SQL shown in Settings was a second copy of `supabase-setup.sql` that had drifted out of date, so pasting it from the app installed the older rules. Settings now reads the shipped file directly at build time.
- **Added** `REVOKE ALL ... FROM anon` on all three tables, so the anon role holds no table privileges at all.

### 🔐 Authentication

- **Added** Supabase Auth. Keyper now requires a real session; the anon key alone opens nothing.
- **Added** `AuthGate`, which requires a session before the dashboard renders, and `SignInForm` with sign-in, sign-up and account password reset.
- **Changed** `UserRegistration` creates a real account instead of registering an unauthenticated username.
- **Changed** `UserSwitcher` is now an account panel showing who is signed in, with sign out. The old user list is gone because enumerating other users required exactly the unrestricted read this release removes.
- **Changed** The passphrase screen no longer asks for a username. Identity comes from the session.
- **Added** Sign-out and token expiry clear the decrypted key from memory.

### 🔑 Encryption

- **Added** `src/crypto/dek.ts` handling DEK generation, wrapping, unwrapping and re-wrapping, with the vault key imported as a non-extractable `CryptoKey`.
- **Added** Passphrase change, which re-wraps the same vault key so nothing needs re-encrypting and existing credentials keep working.
- **Changed** The wrong passphrase is now rejected by AES-GCM tag verification during unwrap. That failure is the check; there is no separate stored verifier.
- **Removed** `raw_dek` and `bcrypt_hash` from new installs, along with the `bcrypt` verification path.

### 🧪 Testing

- **Added** `tests/rls/` — a real Postgres suite that applies the shipped `supabase-setup.sql` against a Supabase auth shim and asserts anon is refused, one account cannot read another's vault key, `WITH CHECK` blocks cross-owner writes, and an unqualified `DELETE` cannot empty another account's vault. Run with `npm run test:rls`.
- **Added** DEK unit tests covering round-trip, wrong-passphrase rejection, tamper detection, key non-extractability, and that neither the DEK nor the passphrase appears in the wrapped output.
- **Added** A test running against real PBKDF2, since the shared setup mocks Argon2 and no other test exercised a genuine KDF.
- **Added** Schema guards that fail the build if unconditional policies or plaintext key columns reappear.
- **Changed** Test count went from 97 to 123, all passing.

### 📝 Documentation

- **Changed** README security claims now match what the code does, including a security model table and a plainly stated limitations section.
- **Added** An explicit note that only `secret_blob` is encrypted; titles, usernames, URLs, notes and tags are plaintext.
- **Added** A warning that Neon mode puts a full database credential in the browser, which RLS cannot constrain. `neon-setup.sql` no longer creates policies that imply otherwise.
- **Added** `migration/`, a five-step migration for existing deployments. Each script is complete on its own, checks its own preconditions, and refuses safely if run out of order, so pasting one early cannot half-apply the change.
- **Added** `RELEASE.md` with upgrade steps and the full breaking-change list.

### 🧭 Upgrade experience

- **Added** Detection for databases that predate this release. Keyper probes for the ownership column on startup and, if it is missing, shows a guided screen instead of a generic failure.
- **Added** The upgrade screen walks through all nine steps with a copy button per script, expected output for each, red call-outs on the points people actually get wrong, and tick-off progress that survives a reload, since the flow moves between Keyper and the Supabase dashboard.
- **Added** `MIGRATION.md`, a full walkthrough with expected output per step and a troubleshooting section covering every error the scripts can produce.
- **Added** A matching walkthrough on the docs site with per-script copy buttons, reading the same files at build time so the docs cannot drift from what ships.
- **Added** Prominent upgrade notices at the top of the README and in its upgrade section.
- **Added** The probe runs before sign-in, since the old permissive policies still allow it. Telling someone to create an account and then failing afterwards would waste their time.
- **Added** A pre-flight guard in `supabase-setup.sql` that aborts if the database already contains credentials or a vault config, so nobody destroys a live vault by running the fresh-install script instead of the migration.
- **Changed** The un-migrated case previously surfaced as "Could not reach your vault", which reads like data loss and invites exactly the wrong reaction.

### ⚙️ Settings

- **Removed** The "Reset Master Passphrase" instructions, which walked users through generating a bcrypt hash on a third-party website and pasting it into `vault_config.bcrypt_hash`. That flow only worked because the vault key was stored separately in usable form, so it was a way around the encryption rather than a feature beside it. It also meant typing a new passphrase into someone else's web page.
- **Added** A real **Change Master Passphrase** form in its place. It re-wraps the same vault key, so nothing is re-encrypted and every credential keeps working. Requires the current passphrase.
- **Added** A **Start over** panel that is honest about the alternative: a forgotten passphrase cannot be recovered, and the only option is deleting the vault. Requires typing a confirmation phrase.
- **Removed** The "Existing Database Update Script" section, which applied a credential-type change from several versions back and only added confusion next to the 1.3.0 migration.
- **Added** An **About** tab with the version, links to the website, docs, security model, GitHub, issues and changelog, plus the support email.
- **Fixed** The version in Settings was hardcoded as `0.1.0`. It now comes from `package.json` through the new `src/lib/app-info.ts`, so there is one place it is set.
- **Fixed** System Information described a bcrypt-only architecture with user-controlled reset, and linked to `docs/EMERGENCY_PASSPHRASE_RESET.md`, which does not exist. It now reports what the app is actually doing and links to the security model.
- **Fixed** User Management still said emergency resets work through each user's bcrypt hash.
- **Changed** `DashboardSettings.tsx` split into focused cards under `src/components/dashboard/settings/`, taking it from 569 lines to under 300.

### 📮 Support

- **Added** `support@keyper.icu` as the support address, surfaced in the app's About tab, the README, and a new Support page on the docs site.
- **Added** A Support page covering where to ask, what to include, and an explicit list of things never to send: master passphrase, account password, connection strings, service role keys, or `vault_config` contents.
- **Changed** The package description no longer advertises "emergency recovery", which no longer exists.

### ⚠️ Breaking Changes

- **Supabase users need to enable the Email auth provider** and create an account. The anon key alone no longer opens a vault.
- **Existing databases need the scripts in `migration/`.** Run them in order: check, claim your rows, apply the new rules, unlock once in the app so Keyper moves your vault key across, confirm, then remove the old columns. Take a backup first. Only the second script needs an edit.
- **The master passphrase can no longer be reset.** It can be changed whenever you know the current one, but nothing stored can recover it. Keep a copy somewhere safe.
- **Switching accounts on Supabase means signing out and back in.** The old in-app user list relied on reading other users' rows. SQLite and Neon keep their username switcher on the unlock screen.

## [1.2.2] - 2026-08-08 - 🔒 **Dependency Security**

### 🔒 Dependency Security
- **Updated** Updated dependencies to address vulnerabilities.

## [1.2.1] - 2026-06-24 - 🎨 **Grid/List Layout · 🔒 Dependency Security**

### 🎨 Dashboard UX & Layout
- **Added** PostHog integration to the Astro Starlight documentation website.
- **Added** Custom Starlight `Head.astro` override component to bundle `posthog-js` on the client.
- **Added** Automatic environment variable injection from server-side/build-time context to the client bundle via data-attributes.
- **Added** Event tracking for installer downloads, capturing the platform (Windows/Linux) and package type (EXE/AppImage/DEB).
- **Added** Event tracking for code snippet copies (e.g., terminal commands and database setup scripts).
- **Added** Event tracking for search queries in the Starlight Pagefind dialog, with debouncing to avoid event spam.

### 🎨 Dashboard UX & Layout
- **Added** Grid/List view toggle to the dashboard with state persistence in `localStorage`.
- **Added** Sleek, compact list view layout for credentials, complete with responsive fields and hover reveal action.
- **Added** Custom list-specific loading skeletons for the lazy-loaded credentials panel.

### 🔒 Dependency Security
- **Fixed** Path traversal security vulnerability in documentation website `esbuild` dependency (GHSA-g7r4-m6w7-qqqr) by configuring a dependency override to `0.28.1`.

## [1.2.0] - 2026-05-28 - 🎨 **Appearance Themes · 🗄️ Neon Provider · 🔒 Dependency Security**

### 🎨 **Appearance Themes & Custom Fonts**

- **Added** Comprehensive Light Mode theme across the entire application with cohesive styling
- **Added** Four additional appearance themes: Charcoal, Light Gray, Warm Light, and Blue
- **Added** Three more comfort themes: Medium Gray, Midnight Blue, and Deep Purple
- **Added** Custom Font selection (Inter, Roboto, Outfit, Playfair Display, Fira Code)
- **Added** New "Appearance" settings tab to manage Theme and Font preferences with swatch-based theme choices
- **Added** Website documentation page for appearance settings, covering all built-in themes and font choices beyond the dark/light screenshots
- **Updated** Dotted background pattern and core accent styles to adapt automatically to all configured themes
- **Protected** Keyper branding logo from being affected by global custom font selections

### 🗄️ **Neon Postgres Provider**

- **Added** Neon Postgres as a third database provider with Neon Cloud and Neon Local Docker modes.
- **Added** `@neondatabase/serverless` integration using the HTTP query path and Keyper's existing `supabase.from(...)` compatibility surface.
- **Added** `neon-setup.sql` for Neon Postgres schema, indexes, triggers, permissive self-hosted RLS policies, helper functions, and default categories.
- **Updated** first-run database setup, Dashboard Settings SQL tools, reset guidance, and system information to be provider-aware for Supabase, SQLite, and Neon.
- **Added** targeted Neon query-builder, provider-routing, and schema-alignment tests.

### 🔒 **Dependency Security**

- **Updated** root application dependency lockfile so the Electron packaging chain resolves `tmp@0.2.7`, fixing the high-severity `tmp` path traversal advisory.
- **Updated** docs site dependencies to `astro@6.4.2` and `@astrojs/starlight@0.39.2`.
- **Resolved** docs site audit findings across Astro, Vite, h3, defu, devalue, picomatch, PostCSS, smol-toml, and SVGO transitive dependencies.
- **Verified** both the root application dependency audit and website dependency audit report `0 vulnerabilities`.

## [1.1.4] - 2026-05-26 - 🔒 **Security Vulnerability Fix**

### 🔒 **Security Updates**

- **Resolved** High-severity security vulnerability in `electron <=39.8.4` by upgrading to `electron@39.8.10`.
- **Fixed** Compatibility constraint where newer Electron versions (e.g., `41.x` and `42.x`) drop V8 headers required by `better-sqlite3`, ensuring that the native SQLite drivers still successfully compile while keeping the app secure.


## [1.1.3] - 2026-05-26 - 🔧 **Build & Native Dependencies Fix**

### 🔧 **Build System & Dependencies**

- **Fixed** Native compilation failure during `node-gyp rebuild` for `better-sqlite3` by explicitly downgrading `electron` to `v33.4.11` as a dev dependency.
- **Resolved** Build breakage caused by `npm audit fix --force` that upgraded `electron` to `v42.3.0`, introducing V8 header changes incompatible with the current SQLite drivers.


## [1.1.2] - 2026-05-26 - 🔒 **Security & UI Enhancements**

### 🔒 **Security & Dependency Updates**

- **Updated** all NPM dependencies to their latest secure versions
- **Resolved** 20 security vulnerabilities (11 high, 9 moderate) across various packages including `electron`, `vite`, and `undici`
- **Updated** `electron` to `v33.4.11` to resolve critical IPC and renderer vulnerabilities while maintaining `better-sqlite3` compatibility (V8 13.x in Electron 42 removed APIs required by the SQLite native driver)

### 🎨 **UI Enhancements**

- **Updated** global app background colors to a sleek pure black and charcoal gray gradient
- **Fixed** dashboard header to seamlessly match the new dark aesthetics
- **Expanded** dashboard container max-width to allow better usage of wide screens
- **Updated** credentials grid layout to fit up to 5 cards across on extra-large screens
### 📚 **Documentation & URL Updates**

- **Updated** documentation site references to the new primary docs domain: `https://keyper.icu`
- **Updated** hosted web app references to the new app domain: `https://app.keyper.icu`
- **Updated** website docs splash actions to include the hosted web app entry next to source repository navigation
- **Updated** in-app dashboard Docs button target to `https://keyper.icu`

## [1.1.1] - 2026-03-12 - 🔍 **Credential Detail UX · 🗄️ SQLite Local Database Support**

### 🖥️ **Desktop Distribution**

- **Added** published Windows installer download for the current release (`KeyperSetup.v1.1.1.exe`)
- **Updated** documentation and docs site download tables to include the Windows installer alongside the published Linux desktop packages

### 🗄️ **SQLite Local Database Support**

- **Added** full SQLite provider as an alternative to Supabase for completely local, zero-network credential storage
  - Works in **both browser/PWA and Electron desktop** modes
  - Browser/PWA stores the database locally in IndexedDB (with localStorage fallback)
  - Electron desktop can additionally target a custom file path on disk
  - No account, server, or internet connection required — ideal for fully offline and air-gapped use
- **Added** `src/integrations/database/sqlite-client.ts` — browser-native SQL.js-backed SQLite engine
  - `SqliteQueryBuilder` — Supabase-compatible query builder so all existing `supabase.from(...)` callsites transparently route to SQLite with zero refactoring
  - In-memory database with IndexedDB persistence per named database key
  - Full CRUD support: `select`, `insert`, `update`, `upsert`, `delete` with chained `.eq()`, `.order()`, `.limit()`, `.single()`
  - Automatic schema creation (`ensureSqliteSchema`) on first open: `credentials`, `vault_config`, and `categories` tables with all indexes
  - Default categories seeded automatically on first-run: Development, Personal, Work, Social Media, Finance, Cloud Services, Security
- **Added** multi-provider routing in `src/integrations/supabase/client.ts`:
  - `getDatabaseProvider()` / `saveDatabaseProvider()` — persists provider choice in `localStorage`
  - `supabase` export now transparently delegates to the active provider (Supabase or SQLite)
  - `initializeSqliteProvider()` and `testSqliteProviderConnection()` helpers
- **Added** SQLite configuration UI in `Settings.tsx`:
  - Database Provider selector (Supabase / SQLite)
  - Optional SQLite path/name field (empty = default browser-local database)
  - Provider-aware connection test and status messages
  - Provider-aware setup instructions (SQLite auto-creates schema; Supabase requires SQL Editor run)
- **Updated** `DashboardSettings.tsx` passphrase reset instructions to show provider-specific steps:
  - SQLite users: guided to DB Browser for SQLite to edit `vault_config.bcrypt_hash` directly
  - Supabase users: existing Supabase Dashboard-based reset flow unchanged
- **Updated** reset-local-config message to be provider-agnostic ("database connection settings")

### 👥 **Multi-User Registration & User Management**

- **Added** self-service multi-user registration flow with no admin involvement:
  - `src/components/UserRegistration.tsx` provides username + passphrase registration with live username availability checks and passphrase confirmation
  - Username validation now enforces 3-50 characters with letters, numbers, hyphens, and underscores
  - Registration creates an isolated vault per user and seeds default categories for that user context
- **Added** registration entrypoint in `PassphraseGate.tsx`:
  - New **Create New User** action on the lock screen
  - Successful registration immediately initializes/unlocks the new user vault
- **Added** user management UI in dashboard settings:
  - New **User Management** area with registered-user listing (`vault_config.user_id`)
  - Current user indicator and one-click user switching workflow
  - **Add New User** action from user management that routes directly into registration flow
- **Added** `VaultManager.registerNewUser(username, passphrase)` for secure self-service onboarding:
  - Duplicate username protection
  - Per-user vault creation (`raw_dek` + `bcrypt_hash`) in existing zero-knowledge model
  - Per-user default category initialization
- **Updated** app security messaging to explicitly document:
  - No admin backdoors
  - Passphrase remains user-controlled
  - Switching user context does not bypass passphrase verification

### 🧪 **Multi-User Validation**

- **Added** SQLite-focused multi-user tests in `src/services/multi-user-sqlite.test.ts` covering:
  - Creating multiple users in the same instance
  - Per-user vault isolation and access boundaries
  - Switching between user contexts with independent passphrase checks

### 🐛 **SQLite Bug Fixes**

- **Fixed** critical bug where `SqliteQueryBuilder.select()` was overwriting the in-flight mutation action (`insert`, `update`, `upsert`, `delete`) with `select`, causing vault creation to silently fail
  - **Root cause**: chained `.upsert({...}).select().single()` — standard Supabase pattern for "write and return row" — was being treated as a plain SELECT; the query returned PGRST116 → "Failed to save vault configuration: Unknown error"
  - **Fix**: `select()` no longer changes the action when a mutation has already been set, correctly matching Supabase client semantics
  - All other mutation chains (e.g., `.insert().select()` in `EncryptedCredentialsApi`) are also fixed by this change
- **Fixed** empty categories dropdown when creating a new vault via SQLite
  - **Root cause**: `ensureSqliteSchema` created the `categories` table but never seeded default rows — so the first-time vault creation had no categories to display
  - **Fix**: default categories are now seeded on first database initialisation when the table is empty

### ✨ **Improved Credential Detail Experience**

- **Added** secure secret reveal in `CredentialDetailModal` by decrypting `secret_blob` when the vault is unlocked
  - Users can now inspect encrypted values directly from the detail view without entering edit mode
- **Improved** copy workflow in detail view for sensitive fields (password, API key, secret value, token, certificate)
  - Existing eye/copy controls now work with encrypted-only records
- **Added** vault-state guidance in detail view
  - Clear helper message when the vault is locked and encrypted values cannot be shown yet

### 🎨 **Layout & Readability Fixes**

- **Improved** detail modal width for better credential visibility on desktop
- **Fixed** horizontal overflow/cutoff in sensitive field rows
- **Added** robust wrapping for long revealed values (keys/secrets/certificates) so they stay within the modal instead of clipping

### 🆕 **New Credential Types & Data Capture**

- **Added** `document` credential type
  - Upload support in add/edit flows for common formats: `.pdf`, `.doc`, `.docx`, `.odt`, `.txt`, `.md`
  - Uploaded files are stored in encrypted `secret_blob` payload as base64 + metadata (`document_name`, `document_mime_type`, `document_size_bytes`)
- **Added** `misc` credential type
  - Dedicated large multiline secure field for scripts/commands and other non-standard sensitive text
- **Added** `certificate` upload parity in edit flow (file upload + paste experience now aligned with add flow)

### 🔐 **Security & Type Isolation Fixes**

- **Fixed** type-specific secret leakage issue where unrelated secret keys could appear in other credential types
  - Add/edit encryption paths now strictly encrypt only fields relevant to the selected `credential_type`
  - Detail view now renders sensitive blocks conditionally by `credential_type` to prevent incorrect fields (for example `API Key` showing on `document` records)
- **Fixed** document-save encryption reliability for new uploads by using type-scoped payload construction in add/edit submit flows

### 📄 **Document Detail UX**

- **Added** secure download action in credential detail view for `document` credentials
- **Added** inline preview toggle (eye button) for text-like documents (`text/*`, `.txt`, `.md`)
  - Binary formats (for example PDF/DOCX/ODT) intentionally remain download-only in current release

### 🗄️ **Database & Migration Updates**

- **Updated** setup schema to allow new credential types in `credentials_credential_type_check`:
  - `document`, `misc`
- **Added** migration script for existing installations:
  - `migration-add-document-misc-types.sql`
  - Safely updates the `credential_type` CHECK constraint without recreating tables/data
- **Updated** in-app SQL surfaces:
  - Setup screen now includes both full setup script and update script (copy + preview)
  - Dashboard settings now includes a dedicated **Database SQL** tab with both scripts and upgrade warnings

## [1.1.0] - 2026-03-01 - 🐳 **Docker Build & ⚡ Electron Desktop App**

### 🐳 **Docker Support**

- **Added** `Dockerfile` – optimised multi-stage build (Node 22 Alpine builder → nginx 1.27 Alpine server)
  - Stage 1 compiles the Vite/React app; Stage 2 serves only the static output → lean final image
  - WASM MIME type (`application/wasm`) patched so **argon2-browser** works inside the container
  - `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers added to satisfy **SharedArrayBuffer** requirements
- **Added** `nginx.conf` – production-hardened nginx server block
  - SPA fallback routing (`try_files ... /index.html`) for React Router
  - Gzip compression for JS/CSS/WASM/SVG/fonts
  - Long-lived cache headers (`Cache-Control: public, immutable`) for hashed assets
  - Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
  - `/healthz` endpoint for container health checks
- **Added** `docker-compose.yml` – single-command stack launch with configurable `HOST_PORT` (default `8080`)
  - Built-in `healthcheck` using the nginx `/healthz` endpoint
  - Optional Caddy reverse-proxy snippet (commented out) for automatic HTTPS
- **Added** `.dockerignore` – excludes `node_modules/`, `dist/`, `electron/`, VCS files, secrets, and tooling to keep the build context lean

### ⚡ **Electron Desktop App**

- **Added** `electron/main.ts` – Electron main process
  - Custom `app://` protocol serves the compiled `dist/` bundle with full SPA routing support
  - WASM `Content-Type` patched for argon2-browser inside the Electron sandbox
  - `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` injected via `session.webRequest` headers
  - External link interception: all `https://` links open in the system browser via `shell.openExternal`
  - Security hardening: `contextIsolation: true`, `nodeIntegration: false`
  - macOS traffic-light title bar; auto-hiding menu bar on Windows/Linux
- **Added** `electron/preload.ts` – minimal context-bridge exposing `window.keyperElectron` to the renderer
  - `isElectron: true` flag for UI feature detection
  - `platform` and `version` fields
- **Added** `electron/tsconfig.json` – TypeScript config targeting CommonJS (required for Electron main process)
- **Added** electron scripts to `package.json`:
  - `electron:compile` – compiles `electron/*.ts` → `electron-dist/*.js`
  - `electron:preview` – build + compile + launch locally
  - `electron:dev` – same but opens DevTools
  - `electron:build` – full cross-platform distributables via electron-builder
  - `electron:build:linux` / `electron:build:win` / `electron:build:mac` – platform-specific builds
- **Added** `electron-builder.yml` – electron-builder configuration
  - Linux: AppImage (x64/arm64), deb (x64/arm64)
  - macOS: DMG + zip (Universal / Intel + Apple Silicon)
- **Added** `electron` `^33.3.0` and `electron-builder` `^25.1.8` to devDependencies

### 🌐 **Website & Downloads**

- **Added** direct download links for Linux desktop installers (AppImage, deb x86_64, deb ARM64) hosted on Cloudflare R2 via the [Keyper docs site](https://keyper.icu/getting-started/install-and-run/)

### 🔧 **Housekeeping**

- **Updated** `.gitignore` – added `dist-electron/` and `electron-dist/` output directories

---

## [1.0.9] - 2026-03-01 - 🐛 **Bug Fixes: Multi-Session Credential Saving & Edit Modal**

### 🐛 **Bug Fixes**

- **Fixed** Critical error "can't access property 'trim', t.token_value is undefined" when adding a second credential in the same session
  - **Root Cause**: `resetForm()` in `AddCredentialModal` was missing `token_value` and `certificate_data` fields, leaving them as `undefined` after the first save
  - **Fix**: Added the two missing fields back to `resetForm()` so all state is properly cleared between submissions

- **Fixed** Critical error "could not find the 'api_key' column of 'credentials' in the schema cache" when editing a credential
  - **Root Cause**: `EditCredentialModal.handleSubmit()` was spreading the entire `formData` object directly into the Supabase `.update()` call, including legacy column names (`api_key`, `password`, `secret_value`, etc.) that do not exist in the current schema — all sensitive data lives in `secret_blob`
  - **Fix**: Rewrote the submit handler to build an explicit update object with only valid DB columns, and properly encrypt sensitive data into `secret_blob` using the vault

- **Improved** `EditCredentialModal` now correctly decrypts existing `secret_blob` data when the edit form opens, so current secret values are pre-populated and editable
- **Improved** `EditCredentialModal` now properly handles all five credential types with their correct sensitive field names: `password` (login), `api_key` (api_key), `secret_value` (secret), `token_value` (token), `certificate_data` (certificate) — previously `token` was incorrectly sharing the `secret_value` field and `certificate` type had no dedicated input

### ✨ **New Features**

- **Added** "No expiration" checkbox next to the **Expires At** date field in `AddCredentialModal`
  - Checking it clears any selected date and disables the date picker (visually greyed out)
  - Unchecking re-enables the date picker for normal use
  - Resets automatically when the form is cleared after a save

### 🏷️ **UX / Labels**

- **Updated** Supabase API key field label from `"Supabase Anon Key"` to `"Supabase Anon or Publishable Key"` to reflect Supabase's updated naming convention (both key types remain fully supported)
  - Updated in: Settings configuration screen, SQL setup script comment, and database setup wizard description

---

## [1.0.8] - 2025-08-28 - 🎨 **CLI Enhancement: Beautiful ASCII Banner & Deprecation Fix**

### 🎨 **CLI Visual Improvements**

- **Added** Stunning gradient KEYPER ASCII art banner for professional startup experience
  - **Beautiful Typography**: Large block-letter KEYPER logo in gradient cyan/blue colors
  - **Brand Colors**: Matching cyan/blue gradient that complements the app's glassmorphism UI theme
  - **Clean Layout**: Removed cluttered box borders for modern, minimal aesthetic
  - **Professional Branding**: Enhanced Pink Pixel branding with "Dream it, Pixel it" tagline

### 🔧 **Security & Compatibility Fixes**

- **Fixed** Node.js deprecation warning (DEP0190) for enhanced security
  - **Eliminated** Insecure `shell: true` + arguments array combination
  - **Implemented** Cross-platform spawn solution for Windows/Unix systems
  - **Enhanced** Security by preventing argument injection vulnerabilities
  - **Improved** Command execution reliability across all platforms

### 🚀 **Technical Enhancements**

- **Added** Platform detection for optimal command execution strategy:
  - **Windows**: Uses properly escaped command string with `shell: true`
  - **Unix/Linux/Mac**: Uses secure argument array with `shell: false`
- **Enhanced** Error handling and process management
- **Maintained** Full backward compatibility with existing CLI functionality
- **Improved** Developer experience with clean, warning-free startup

### 🌈 **User Experience**

- **Enhanced** Visual brand consistency between CLI and web application
- **Removed** Annoying deprecation warnings during server startup
- **Improved** Professional appearance for enterprise deployments
- **Maintained** All existing CLI functionality and features

### 🛡️ **Security Benefits**

- **Eliminated** Potential command injection attack vectors
- **Enhanced** Cross-platform security posture
- **Improved** Node.js compliance with latest security recommendations
- **Maintained** Zero-trust architecture principles

---

## [1.0.6] - 2025-08-28 - 🔧 **Critical Fix: Local Supabase Instance Support**

### 🚨 **Major: Local Database Connection Support**

- **Fixed** Critical issue preventing local Supabase instances from connecting
  - **Removed** Overly restrictive URL validation in `createTestSupabaseClient`
  - **Enhanced** Connection logic to accept any valid HTTP/HTTPS URL
  - **Added** Comprehensive support for localhost, IP addresses, and custom domains
  - **Improved** Error messages and debugging information for connection issues

### 🌐 **Universal Database Compatibility**

- **Added** Support for all local and self-hosted Supabase deployments:
  - ✅ **Localhost**: `http://localhost:54321`, `https://localhost:8443`
  - ✅ **IP Addresses**: `http://192.168.1.100:8000`, `http://127.0.0.1:54321`
  - ✅ **Private Networks**: `http://10.0.0.5:54321`, `http://172.17.0.1:8000`
  - ✅ **Docker Networks**: Complete support for all Docker IP ranges (172.16-31.\*)
  - ✅ **Custom Domains**: `https://supabase.mydomain.com`, `https://db.company.local`
  - ✅ **Supabase Cloud**: Existing `*.supabase.co` instances continue to work seamlessly

### 🛡️ **Smart Content Security Policy**

- **Enhanced** CSP configuration with intelligent environment detection:
  - **Development**: Fully permissive for maximum flexibility during development
  - **Self-hosted**: Balanced security with custom domain support for production
  - **Cloud**: Optimized security for Supabase Cloud deployments
- **Added** Dynamic CSP selection based on configured database credentials
- **Improved** Network support for all private IP ranges and custom domains

### 🔧 **Architecture Improvements**

- **Added** `hasCustomSupabaseCredentials()` helper function for clean configuration detection
- **Enhanced** Connection validation with informational logging instead of blocking
- **Improved** Error handling and debugging information throughout connection flow
- **Refactored** Hardcoded configuration checks to use proper helper functions

### 🏗️ **Technical Enhancements**

- **Modified** `src/integrations/supabase/client.ts`:
  - Removed restrictive hostname validation that blocked valid URLs
  - Added comprehensive IP range support for private networks
  - Enhanced logging for better debugging experience
- **Updated** `src/components/SelfHostedDashboard.tsx`:
  - Replaced hardcoded string comparisons with helper functions
  - Improved configuration state detection
- **Enhanced** `src/security/ContentSecurityPolicy.ts`:
  - Added three-tier CSP system (Development, Self-hosted, Production)
  - Comprehensive network range support for all deployment scenarios
  - Dynamic policy selection based on configuration

### ✅ **Connection Support Matrix**

| Instance Type                            | Before v1.0.6  | After v1.0.6 |
| ---------------------------------------- | -------------- | ------------ |
| Supabase Cloud (`*.supabase.co`)         | ✅ Working     | ✅ Working   |
| Localhost (`http://localhost:*`)         | ❌ **Blocked** | ✅ **FIXED** |
| Local IP (`http://192.168.1.100:*`)      | ❌ **Blocked** | ✅ **FIXED** |
| Custom Domain (`https://db.company.com`) | ❌ **Blocked** | ✅ **FIXED** |
| Docker Network (`http://172.17.*:*`)     | ❌ **Blocked** | ✅ **FIXED** |

### 🛡️ **Security & Compatibility**

- ✅ **Backward Compatible**: All existing Supabase Cloud setups continue working unchanged
- ✅ **Security Maintained**: Enhanced CSP policies maintain strong security posture
- ✅ **No Breaking Changes**: Seamless upgrade path with zero configuration changes required
- ✅ **Enhanced Debugging**: Better error messages and connection diagnostics

### 📚 **Documentation**

- **Added** `SUPABASE_FIXES.md` - Comprehensive documentation of all fixes applied
- **Updated** Connection troubleshooting guides with new supported formats
- **Enhanced** Self-hosting instructions with local instance setup examples

### 🎯 **User Impact**

- **Resolved** Connection failures for local Supabase instances
- **Eliminated** "URL does not appear to be a Supabase instance" errors
- **Enabled** Full self-hosting flexibility with any domain or IP configuration
- **Improved** Developer experience with better error messages and debugging

---

## [1.0.4] - 2025-08-23 - 🔐 **Major Security Overhaul: Simplified bcrypt-Only Passphrase System**

### 🚨 **Revolutionary Passphrase Reset System**

- **Added** Simplified bcrypt-only master passphrase authentication
  - **Eliminated** complex Argon2/AES key derivation for passphrase validation
  - **Implemented** direct bcrypt hash verification for instant authentication
  - **Removed** all backdoors, admin overrides, and security vulnerabilities
  - **Created** user-controlled passphrase reset via direct database access
  - **Enhanced** Security through elimination of attack vectors

### 🔓 **User-Controlled Emergency Reset**

- **Added** `docs/EMERGENCY_PASSPHRASE_RESET.md` - Comprehensive reset guide
  - **Instructions** for bcrypt hash generation using online tools
  - **Step-by-step** database update procedure via Supabase dashboard
  - **Security explanations** why this approach is safe and user-controlled
  - **Troubleshooting** section for common reset issues

### 🏗️ **Architecture Transformation**

- **Simplified** Vault encryption system:
  - **New Users**: `raw_dek` (base64) + `bcrypt_hash` storage
  - **Legacy Users**: Continue using existing `wrapped_dek` system (backwards compatible)
  - **Dual Support**: Automatic detection and handling of both vault formats
  - **Migration Path**: Optional upgrade path for existing users

### 🛡️ **Enhanced Security Model**

- **Removed** Emergency access systems and backdoors:
  - **Deleted** `src/security/HatchGate.ts` - Eliminated backdoor access
  - **Removed** `src/components/ResetKeyper.tsx` - No admin reset capability
  - **Cleaned** All references to emergency admin access
  - **Updated** Documentation to reflect new security-first approach

### 🔧 **Technical Improvements**

- **Created** `src/crypto/bcrypt.ts` - Secure bcrypt utility functions
- **Enhanced** `src/services/VaultStorage.ts` - Dual format support
- **Updated** `src/services/VaultManager.ts` - Smart vault type detection
- **Simplified** `src/services/SecureVault.ts` - Maintains legacy compatibility
- **Improved** Type definitions with legacy/new vault config types

### 🗄️ **Database Schema Evolution**

- **Updated** `supabase-setup.sql` and `src/components/Settings.tsx`:
  - **Added** `raw_dek TEXT` column (nullable for backwards compatibility)
  - **Enhanced** `bcrypt_hash TEXT` column for new passphrase system
  - **Maintained** `wrapped_dek JSONB` for existing users
  - **Secured** All PostgreSQL functions with proper `SECURITY DEFINER` settings

### 📋 **Migration Support**

- **Created** `migration-bcrypt.sql` - Database migration script
  - **Adds** new columns to existing vault_config table
  - **Provides** detailed migration instructions for existing users
  - **Maintains** full backwards compatibility
  - **Guides** users through optional upgrade process

### ✨ **User Experience**

- **New Users**: Automatic bcrypt-only system with instant reset capability
- **Existing Users**: No changes required, everything continues working
- **Reset Process**: Simple 4-step process using any bcrypt generator website
- **No Downtime**: Seamless deployment with zero breaking changes

### 🎯 **Security Benefits**

- **Eliminated** All potential backdoors and admin overrides
- **Simplified** Attack surface by removing complex key derivation chains
- **Enhanced** User control - only database owner can reset passphrases
- **Maintained** Strong AES-256-GCM encryption for actual credential data
- **Preserved** Zero-knowledge architecture principles

### 📚 **Documentation Updates**

- **Removed** All emergency access and backdoor documentation
- **Added** User-controlled passphrase reset instructions
- **Updated** Security model documentation throughout project
- **Enhanced** Setup instructions with new migration procedures

---

## [1.0.3] - 2025-08-23 - 🔒 **Security Enhancement: PostgreSQL Function Hardening**

### 🔒 **Security Improvements**

- **Fixed** PostgreSQL function search_path security warnings (function_search_path_mutable)
  - **update_updated_at_column**: Added `SET search_path = ''` security parameter
  - **get_credential_stats**: Added `SET search_path = ''` + fully qualified schema references
  - **check_rls_status**: Added `SET search_path = ''` + fully qualified schema references
  - **Protection**: Prevents search path injection attacks and ensures consistent behavior
  - **Compliance**: Meets PostgreSQL security best practices and OWASP guidelines

### 🛡️ **Enhanced Database Security**

- **Added** `rls-security-fixes.sql` - Standalone security patch for existing databases
- **Updated** `supabase-setup.sql` - Main setup script now includes secure function definitions
- **Improved** All functions now use `SECURITY DEFINER` with empty search_path
- **Qualified** All database object references use explicit `schema.table` notation
- **Documented** Comprehensive security implementation details in updated files

### 🔧 **Technical Details**

- **Search Path Security**: All PostgreSQL functions now set `search_path = ''` to prevent path manipulation
- **Schema Qualification**: Database objects referenced with explicit `public.tablename` format
- **Consistent Context**: Functions execute with predictable, secure environment
- **Best Practices**: Aligned with PostgreSQL security recommendations and industry standards

### 📚 **Documentation Updates**

- **Updated** `RLS_FIXES_NEEDED.md` - Now shows resolved status with implementation details
- **Added** Security fix implementation guide with verification queries
- **Enhanced** Database setup instructions with security considerations

---

## [1.0.1] - 2025-08-16 - 🚨 **Emergency Troubleshooting System**

### 🚨 **Major: Panic Hatch System**

- **Added** Emergency diagnostic and reset system for stuck configurations
  - **HatchGate.ts**: Session-based temporary access control with short-lived session TTL
  - **ResetKeyper.tsx**: Comprehensive diagnostic page for troubleshooting
  - **Hidden Route**: Secure diagnostic route only accessible when armed
  - **Health Checks**: Database table verification and connection testing
  - **Config Reset**: Selective clearing of Keyper configuration keys
  - **Origin Reset**: Complete site data clearing for extreme cases

### 🛡️ **Enhanced Security**

- **Added** Obscurity-based emergency access without compromising authentication
- **Added** Session storage with automatic expiration for temporary access
- **Added** Optional admin marker requirement for additional protection
- **Added** Professional ops procedures with encryption recommendations
- **Security Note**: Emergency system uses security-by-obscurity, not authentication bypass
