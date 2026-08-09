---
title: Runtime Flow
description: Step-by-step application behavior from load to credential operations.
---

## Startup flow

1. `initializeSecurity()` runs from `main.tsx`.
2. Providers are created in `App.tsx`.
3. Router renders `SelfHostedDashboard` for `/`.

## Configuration flow

1. `getDatabaseProvider()` reads the selected provider (`supabase`, `neon`, or `sqlite`) from local storage.
2. If no provider is configured, the database configuration UI is shown.
3. For **Supabase**: credentials are tested and then persisted to local storage; the Supabase client is refreshed with new credentials.
4. For **Neon**: the connection string and Cloud/Local mode are tested through the Neon serverless driver, then persisted to local storage.
5. For **SQLite**: no credentials are needed; the sql.js engine initialises the schema automatically on first open.

## Sign-in flow (Supabase)

1. `AuthGate` checks the database schema first. An older schema routes to the
   upgrade screen instead of the sign-in form.
2. With a current schema, `AuthGate` subscribes to Supabase auth state and shows
   `SignInForm` or `UserRegistration` until a session exists.
3. `signUp` creates a Supabase Auth account. The master passphrase is set
   separately, on the next screen.
4. Sign-out clears the vault key from memory.

SQLite and Neon skip this entirely; there is no server-side account to check.

## Vault flow

1. `PassphraseGate` loads the vault for the current owner: the signed-in account
   on Supabase, or the username typed on the unlock screen for SQLite and Neon.
2. Existing vault: the passphrase derives a KEK which unwraps the stored DEK.
   A wrong passphrase fails AES-GCM authentication, which is the check.
3. New vault: `createVault(...)` generates a DEK, wraps it under the passphrase,
   stores the wrapped form, and seeds default categories.
4. Pre-1.3.0 vault: the legacy `raw_dek` is wrapped under the passphrase and the
   old column cleared, on first unlock. Nothing is re-encrypted.
5. On unlock, dashboard interactions can encrypt/decrypt secrets.

## Account switching flow

On **Supabase**, sign out and sign in as the other account. `UserSwitcher` shows
the current account and handles sign-out. There is no cross-account list, since
building one would require reading rows the policies correctly withhold.

On **SQLite** and **Neon**, change the username on the unlock screen. Switching
clears any key held in memory, and the target vault still needs its own
passphrase before anything is readable.

## Credential flow

1. Add/edit modal captures metadata and secret fields.
2. Secret fields are encrypted via `useEncryption().encryptCredential()`.
3. Row is inserted/updated in `credentials` with `secret_blob` and `encrypted_at`.
4. Edit flow can decrypt `secret_blob` via `useEncryption().decryptCredential()` to prefill fields.
5. Detail flow (`CredentialDetailModal`) also decrypts `secret_blob` when vault is unlocked, allowing secure reveal/copy actions without entering edit mode.

## Auto-lock behavior

- Vault auto-lock timeout defaults to 15 minutes.
- Timer resets on vault activity.
- Lock clears in-memory key references and returns app to locked state.
