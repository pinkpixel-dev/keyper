---
title: Source Map
description: File-level map of the active Keyper implementation.
---

This page is a practical index of where behavior lives in the repository today.

## App shell and routing

- `src/main.tsx`: bootstrap, security initialization, root render.
- `src/App.tsx`: providers, custom `next-themes` theme list, and router wiring.
- `src/lib/theme-options.ts`: appearance theme labels, class names, descriptions, and swatch classes.
- `src/components/SelfHostedDashboard.tsx`: main runtime shell and view switching.
- `website/src/content/docs/getting-started/appearance-settings.md`: user-facing website docs for theme and font preferences.

## Configuration and Supabase integration

- `src/integrations/supabase/client.ts`: local storage keys, provider routing, credential persistence, client creation/refresh.
- `src/integrations/database/neon-client.ts`: Neon serverless query adapter for the Supabase-style compatibility surface.
- `src/components/Settings.tsx`: Supabase, Neon, and SQLite configuration forms, validation, and connection test UX.
- `src/components/dashboard/DashboardSettings.tsx`: user management UI, appearance theme selector, SQL scripts, and reset/system tools.
- `sql/supabase-setup.sql`, `sql/neon-setup.sql`: Postgres schemas, policies, triggers, helper functions.

## Vault and cryptography

- `src/services/VaultManager.ts`: high-level vault orchestration and format detection.
- `src/services/SecureVault.ts`: in-memory DEK management, encrypt/decrypt, auto-lock.
- `src/services/VaultStorage.ts`: `vault_config` CRUD and format guards.
- `src/crypto/crypto.ts`: Argon2/PBKDF2 helpers and generic AES-GCM string encryption primitives.
- `src/crypto/bcrypt.ts`: passphrase hash + verify utilities.
- `src/crypto/types.ts`: `SecretBlobV1`, crypto errors, vault status types.

## Credential CRUD and UI flow

- `src/components/dashboard/AddCredentialModal.tsx`: create form + encryption path.
- `src/components/dashboard/EditCredentialModal.tsx`: update form + decrypt/re-encrypt path.
- `src/components/dashboard/CredentialDetailModal.tsx`: detail view with secret reveal/copy (via `secret_blob` decryption), edit, and delete actions.
- `src/components/dashboard/CredentialsGrid.tsx`: list/grid rendering and item selection.
- `src/components/PassphraseGate.tsx`: unlock UX + create-new-user entrypoint.
- `src/components/UserRegistration.tsx`: self-service registration UX with username uniqueness and passphrase checks.
- `src/components/UserSwitcher.tsx`: registered-user listing and secure account switching.
- `src/hooks/useVault.ts`: vault state hook and encryption helper methods.

## Security and policy helpers

- `src/security/ContentSecurityPolicy.ts`: CSP generation and runtime application hooks.
- `src/security/SecurityAuditLogger.ts`: security event logging APIs.
- `src/security/PassphraseValidator.ts`: passphrase strength and validation analysis.
- `_headers`, `_redirects`, `_routes.json`: Cloudflare Pages security and routing headers.

## Build, test, and deploy

- `vite.config.ts`: build configuration, PWA setup, argon2-related bundling workarounds.
- `vitest.config.ts`, `src/test-setup.ts`: test runner and test environment mocks.
- `package.json`: scripts and dependency inventory.
- `deploy.sh`, `deploy.ps1`: deployment helper scripts for Keyper app.
- `wrangler.toml`: app-level Cloudflare Pages configuration.

## Docs site implementation

- `website/astro.config.mjs`: Starlight site config and sidebar.
- `website/src/styles/keyper-theme.css`: dark-theme variables and typography.
- `website/src/content/docs/**`: documentation content.
- `website/wrangler.toml`: docs-site Cloudflare Pages deployment config.
