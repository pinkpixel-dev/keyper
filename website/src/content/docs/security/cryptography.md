---
title: Cryptography
description: Algorithms, formats, and crypto responsibilities across modules.
---

## Credential secret encryption

- Cipher: AES-GCM (Web Crypto API).
- IV: random 96-bit value per encryption.
- Output: `SecretBlobV1` containing `v`, `kdf`, `salt`, `iv`, `ct` fields.

## Key derivation code paths

`src/crypto/crypto.ts` still implements Argon2id/PBKDF2 derivation helpers for legacy and compatibility use cases.

## Current vault strategy

`SecureVault` uses a two-key design, with the wrapping logic in `src/crypto/dek.ts`:

- **DEK** (data encryption key): a random 256-bit AES-GCM key that encrypts every
  credential. Generated once per vault.
- **KEK** (key encryption key): derived from the master passphrase with Argon2id
  (PBKDF2 fallback) and used only to wrap the DEK.

The server stores the wrapped DEK in `vault_config.wrapped_dek` and nothing else
about the key.

Unlock sequence:

1. Derive the KEK from the entered passphrase using the stored salt.
2. Unwrap the DEK with it.
3. Import the DEK as a non-extractable `CryptoKey` for encrypt/decrypt.

There is no separate passphrase verifier. AES-GCM is authenticated, so a wrong
passphrase fails the tag check during unwrap, and that failure is the check.

Changing the passphrase re-wraps the same DEK, so nothing is re-encrypted and
existing credentials keep working. It re-unwraps from the stored wrapped DEK
using the current passphrase rather than exporting the live key, which keeps that
key non-extractable.

## Legacy formats

- **`raw_dek`** (pre-1.3.0) stored the DEK in a form the server could use
  directly. Vaults in this state are migrated to the wrapped form on the next
  unlock, since that is the first moment the passphrase is available. Nothing is
  re-encrypted.
- **`bcrypt_hash`** (pre-1.3.0) was a passphrase verifier. It is no longer used or
  written; the unwrap serves that purpose.

See [Upgrading to 1.3.0](/getting-started/upgrading-to-1-3/) for the migration.

## Notes for contributors

- Avoid introducing plaintext secret persistence paths.
- Treat `secret_blob` as the single source for sensitive credential payloads.
- Keep algorithm and data-format docs synchronized with `src/crypto/types.ts` and `src/services/SecureVault.ts`.
