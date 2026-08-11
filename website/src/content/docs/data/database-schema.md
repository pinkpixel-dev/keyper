---
title: Database Schema
description: Core tables and policies used by Keyper.
---

## Tables

### `credentials`

Stores metadata and encrypted credential payload:

- identity and metadata fields (`title`, `credential_type`, `priority`, `tags`, etc.)
- encrypted payload field: `secret_blob` (JSONB)
- encryption timestamp: `encrypted_at`
- supported `credential_type` values:
  - `api_key`, `login`, `secret`, `token`, `certificate`, `document`, `misc`

`secret_blob` is the canonical sensitive-data container and now includes document/misc payload keys for active UI flows:

- document keys: `document_name`, `document_mime_type`, `document_content_base64`, `document_size_bytes`
- misc key: `misc_value`

### `vault_config`

Stores the vault key for an account:

- `wrapped_dek`: the data encryption key, encrypted under a key derived from the
  master passphrase. This is the only stored form of the key.
- unique per `owner_id`

Removed in 1.3.0: `raw_dek`, which held the key in directly usable form, and
`bcrypt_hash`, a passphrase verifier that the unwrap step now replaces.

### `categories`

Stores category metadata used by dashboard filtering. Each account gets its own
default set when its vault is created.

## Ownership columns

Supabase tables carry two ownership columns, and only one of them is a security
boundary:

- **`owner_id`** (uuid, references `auth.users`): the account that owns the row.
  Every RLS policy scopes on this. Defaults to `auth.uid()`.
- **`user_id`** (text): a display label, kept for compatibility. It is
  user-supplied and unverified, and is never used for access control.

SQLite and Neon have no `auth.users` to reference, so they continue to use
`user_id` as the separator. Those modes run on your own machine or your own
database, where the boundary is the file or the connection string.

## RLS behavior

The Supabase setup script enables RLS on all three tables and scopes every policy
to the signed-in owner:

```sql
CREATE POLICY "credentials_select_policy" ON credentials
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
```

`TO authenticated` means an unauthenticated request matches no policy and reads
nothing. The anon role additionally has its table privileges revoked.

The Neon script does not create policies. A Neon connection string carries full
database access and the role owns the tables, so policies there would not narrow
anything down. The script says so rather than implying otherwise.

Behaviour is verified against a real Postgres with `npm run test:rls`.

## Functions and triggers

- `update_updated_at_column()` trigger for timestamp maintenance.
- `get_credential_stats()` and `check_rls_status()` helper functions.
- Functions are created with `SECURITY DEFINER` and constrained `search_path`.

## Source of truth

See `sql/supabase-setup.sql` and `sql/neon-setup.sql` for canonical Postgres schema definitions shipped with current releases.

For existing deployments, apply `migration-add-document-misc-types.sql` to upgrade the `credential_type` CHECK constraint without recreating tables or losing data.
