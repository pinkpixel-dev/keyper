---
title: Upgrading to 1.3.0
description: One-time database update for existing Keyper installs on Supabase.
---

Keyper 1.3.0 changes how you sign in and how your vault key is stored. If you
already use Keyper with Supabase, there is a one-time database update to run
before the new version will open your vault.

It takes a few minutes. Keyper detects an older database on startup and walks you
through the same steps in the app, so you can follow along there or here.

:::note
This applies to **Supabase** installs. SQLite and Neon do not need it. If this is
a brand new install, run `supabase-setup.sql` as usual and skip this page.
:::

## What changed

**You sign in to an account now.** Keyper used to identify you by a username you
typed on the unlock screen. It now uses a real account with an email and
password, and the database checks that account on every request rather than
trusting the app to ask for the right rows.

**Each account only sees its own data,** enforced by Postgres rather than by the
app filtering results.

**Your vault key is stored differently.** It used to be kept in a form the server
could read directly. It is now encrypted under a key derived from your master
passphrase with Argon2id, which means a copy of the database is not enough to
decrypt anything on its own.

Your credentials themselves are unchanged, and none of them are re-encrypted.

## Before you start

You will need access to your Supabase dashboard and your existing master
passphrase.

Take a backup: **Supabase → Database → Backups**. Good practice before any schema
change.

## Step 1: Enable email sign-in

**Supabase → Authentication → Providers → Email**, and turn it on.

Do this before anything else. Without it, nobody can create an account or sign
in.

## Step 2: Create your account

**Supabase → Authentication → Users → Add user.** Use a real email address and a
strong password.

Then copy that account's **UUID** from the users list. You will paste it into the
migration in the next step.

:::caution
This account password is not your master passphrase. They are two separate
secrets doing two different jobs. The account password decides whether the
database returns your rows; the master passphrase decrypts them.
:::

## Step 3: Run the migration

Open **Supabase → SQL Editor** and work through `migration-auth-rls.sql` from the
Keyper repository, in order. Keyper also offers a copy button for it on the
upgrade screen.

The script runs in stages, and the order matters:

| Stage | What it does | Where |
|---|---|---|
| 1a–1b | Adds the ownership column | SQL editor |
| 1c | Assigns your existing rows to your account | SQL editor, paste your UUID here |
| 1d | Checks nothing was missed | SQL editor |
| 1e–1f | Swaps in the new access rules | SQL editor |
| 2 | Moves your vault key to the new format | Automatic, in the app |
| 3 | Removes the old key columns | SQL editor, last |

Stop when Stage 1 finishes. Stage 2 happens in the app.

:::caution
Stage 3 is commented out on purpose. It removes the old vault key, so it needs to
run **after** Keyper has moved the key across in Stage 2. The script includes a
query to confirm that has happened.
:::

If Stage 1d reports rows without an owner, that means some rows were not matched
by the username in Stage 1c. Run Stage 1c again with the right username before
continuing.

## Step 4: Sign in and unlock

Update Keyper, sign in with the account you created, then unlock with your
**existing master passphrase**.

Keyper notices the old key format and moves it across automatically. Nothing is
re-encrypted, so this is quick even with a large vault.

## Step 5: Finish the migration

Back in the SQL editor, run the tracking query near the end of the migration. It
should report `✅ migrated` for every row.

Once it does, uncomment and run Stage 3 to remove the old columns.

## After upgrading

**Signing in comes before your passphrase.** Two steps, two different secrets.

**The master passphrase can no longer be reset.** You can change it any time you
know the current one, from Settings. But there is no longer a stored value that
could recover it, so keep a copy somewhere safe.

**Switching accounts means signing out and back in.** The old in-app user list
worked by reading other users' rows, which the new rules correctly prevent.

**If you ran Keyper on a publicly reachable URL,** the previous database rules
allowed access to vault rows using the public anon key. Once you have migrated,
it is worth refreshing any credentials you stored during that period. If you only
ever ran Keyper locally, there is nothing extra to do.

## Troubleshooting

**Keyper still shows the upgrade screen after running the migration.**
Stage 1 did not complete. Check the SQL editor output for an error. The most
common cause is an unclaimed row blocking the `SET NOT NULL` step in Stage 1d.

**"Sign-ups are disabled on this Supabase project."**
Email sign-in is not enabled yet. Go back to Step 1.

**I ran `supabase-setup.sql` instead of the migration.**
That script now stops by itself when it finds existing data, so most likely
nothing happened. Run `migration-auth-rls.sql` instead.

**I cannot remember my master passphrase.**
There is no recovery path. The vault key is only stored encrypted under that
passphrase. If it is genuinely lost, the vault has to be recreated.

## Credits

Reported privately by [Cenk Kurtoglu](https://github.com/cekuu35), who reviewed
the setup SQL Keyper ships and got in touch rather than opening a public issue.
