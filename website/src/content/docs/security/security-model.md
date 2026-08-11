---
title: Security Model
description: How Keyper protects your credentials, and what each layer covers.
---

Keyper protects your data in layers. They are easy to mix up, so this page sets
out what each one actually does.

## The two secrets

Keyper asks you for two different things, and they do different jobs.

| | Account password | Master passphrase |
|---|---|---|
| What it does | Proves who you are, so the database returns your rows | Decrypts those rows |
| Where it lives | Supabase Auth | Only in your head |
| Can it be reset? | Yes, by email | No |
| Used on | Supabase installs | All installs |

Neither substitutes for the other. Signing in gets you your encrypted data;
only the master passphrase turns it into readable credentials.

## Layers

| Layer | What it covers |
|---|---|
| Supabase Auth session | Decides whether the database returns your rows at all |
| Owner-scoped RLS policies | Keeps each account to its own rows, checked by Postgres |
| Passphrase-wrapped vault key | Means a copy of the database cannot decrypt anything on its own |
| AES-256-GCM on `secret_blob` | Encrypts the secret values themselves |

## Row access

Every policy on `credentials`, `vault_config` and `categories` is scoped two
ways:

```sql
CREATE POLICY "credentials_select_policy" ON credentials
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
```

- `TO authenticated` means a request with no session matches no policy, so it
  reads nothing. The public anon key on its own does not open a vault.
- `owner_id = auth.uid()` means a signed-in account reaches only its own rows.

The `WITH CHECK` clauses on insert and update stop a row being written under
another account's ownership, or moved to one.

The anon role also has its table privileges revoked outright, so it is refused
at the grant layer as well as by the policies.

## Vault key handling

The vault uses two keys:

- **DEK** (data encryption key): a random 256-bit AES-GCM key that encrypts your
  credentials.
- **KEK** (key encryption key): derived from your master passphrase with Argon2id,
  falling back to PBKDF2, and used only to wrap the DEK.

The server stores the wrapped DEK and nothing else about the key. There is no
stored verifier and no second copy, so nothing in the database can be turned into
the DEK without the passphrase.

Unlocking derives the KEK from your passphrase and unwraps the DEK. AES-GCM is
authenticated, so a wrong passphrase fails the integrity check rather than
returning unusable data. That failure is the passphrase check.

Once unwrapped, the DEK is held in memory as a non-extractable `CryptoKey`, so
page scripts cannot read it back out.

## Locking

- Manual and automatic locking are both supported.
- Auto-lock defaults to 15 minutes of inactivity.
- Locking drops the key from memory, as does signing out.

## Changing your passphrase

Changing the passphrase re-wraps the same DEK under a key derived from the new
one. Your credentials are not re-encrypted, so the change is quick and every
existing entry keeps working.

It requires your current passphrase. There is no reset path, because there is no
stored value that could provide one.

:::caution
Keep a copy of your master passphrase somewhere safe. If it is lost, the vault
cannot be recovered by anyone.
:::

## Multi-user

On **Supabase**, each person signs up with their own email and gets their own
vault. Separation is enforced by Postgres against the signed-in account, not by
the app choosing which rows to request.

On **SQLite** and **Neon**, vaults are separated by a username on the unlock
screen, and each has its own passphrase and key material. These modes run on your
own machine or your own database, so there is no server-side account to check.

## Scope

Being specific about what is and is not covered:

- **Encryption covers the secret values.** `title`, `username`, `url`, `notes`,
  `tags`, `category` and `priority` are stored as regular text, which is what
  makes search and sorting work. Encrypting these is on the roadmap and needs a
  design pass, since it changes how search works.
- **The anon/publishable key is designed to be public.** It is safe to expose and
  does not open anything by itself.
- **Neon mode works differently.** It connects to Postgres directly from the
  browser using a connection string, which carries full database access, so
  database-side rules cannot narrow it down. It suits a single operator keeping
  that string private. Use Supabase for separate accounts, or SQLite for a
  private local vault.
- **Browser integrity still matters.** Like any web app, Keyper depends on the
  browser and device being sound while the vault is unlocked.

## Verification

The access rules are tested against a real Postgres rather than reviewed by eye.
`npm run test:rls` applies the shipped `sql/supabase-setup.sql` to a throwaway
database and checks the actual behaviour: that an unauthenticated request reads
nothing, that one account cannot read or delete another's rows, and that an
unqualified `DELETE` only ever removes the caller's own data.
