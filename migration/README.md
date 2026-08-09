# Keyper 1.3.0 migration

One-time database update for existing Keyper installs on **Supabase**.

SQLite and Neon do not need this. Brand new installs should run
`supabase-setup.sql` instead and skip this folder entirely.

## Run these in order

Paste each file whole into the Supabase SQL Editor. Do them one at a time.

| # | File | Edit needed? | Changes data? |
|---|---|---|---|
| 1 | `01-check.sql` | no | no, reads only |
| 2 | `02-claim-your-data.sql` | **yes, one line** | adds a column, marks your rows |
| 3 | `03-apply-security.sql` | no | swaps the access rules |
| — | *open Keyper, sign in, unlock* | — | moves your vault key |
| 4 | `04-check-key.sql` | no | no, reads only |
| 5 | `05-remove-old-key.sql` | no | removes the old key columns |

Back up first: **Supabase → Database → Backups**.

## The one edit

In `02-claim-your-data.sql`, replace the zeros on this line with the UUID that
`01-check.sql` printed next to your email address:

```sql
target_owner  UUID := '00000000-0000-0000-0000-000000000000';
```

That UUID belongs to your **login account**. It is not any of the `id` values in
the `credentials` or `vault_config` tables, which are row ids.

## If a script stops

That is the design, not a failure. Every script checks its own preconditions
first and changes nothing if they are not met. The message tells you which step
to go back to. Common ones:

- **"The account UUID has not been filled in yet"** — do the edit above.
- **"No account exists with id ..."** — the UUID is wrong, or no account exists.
  Enable Email under Authentication → Providers, then add a user.
- **"this database has not had step 2 applied yet"** — run `02` before `03`.
- **"N row(s) do not have an owner yet"** — run `02` again with `only_username`
  left as `NULL` so it claims everything.
- **"N vault(s) have not moved to the new key format yet"** — open Keyper and
  unlock before running `05`.
- **"This database holds N separate vaults"** — you have more than one legacy
  username, each with its own encryption key. They cannot merge into one
  account. Create an account per username and run `02` once for each, setting
  `only_username`.

All five are safe to re-run.

## What this changes

- You sign in to an account, then unlock with your master passphrase. Two
  separate secrets: the first decides whether the database returns your rows,
  the second decrypts them.
- Each account reaches only its own rows, enforced by Postgres.
- Your vault key is stored encrypted under your master passphrase, so a copy of
  the database cannot decrypt anything on its own.

Your credentials are never re-encrypted, so the whole thing is quick regardless
of vault size.

One consequence worth knowing: the master passphrase can no longer be reset. You
can change it whenever you know the current one, but nothing stored can recover
it. Keep a copy somewhere safe.

Full walkthrough: [keyper.icu/getting-started/upgrading-to-1-3](https://keyper.icu/getting-started/upgrading-to-1-3/)
