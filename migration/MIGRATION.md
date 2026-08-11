# 🔄 Keyper 1.3.0 Migration Guide

**Please read this whole page before you start.** It takes about five minutes to
read and about five minutes to do. Reading first is what makes the difference.

---

## ⚠️ The three rules

> **1. Run the five scripts one at a time, in order.**
> Do not paste them all in together. Do not skip ahead.
>
> **2. Back up your database first.**
> Supabase → Database → Backups. Takes ten seconds.
>
> **3. Do not run `sql/supabase-setup.sql`.**
> That one is for brand new installs. It will refuse to run on your database, but
> do not try it.

Every script checks its own preconditions before it changes anything. If you run
one out of order, it stops and tells you which step to go back to. **Nothing
half-applies.** So if you make a mistake, you have not broken anything.

---

## Do I need this?

| You use | Do you need this guide? |
|---|---|
| **Supabase** | **Yes**, if your vault existed before 1.3.0 |
| **SQLite** (local) | No |
| **Neon** | No |
| Brand new install | No, run `sql/supabase-setup.sql` instead |

Keyper also detects this for you. If you open 1.3.0 and see a screen saying
"Your database needs a one-time update", you are in the right place.

---

## What is changing, in plain terms

**Before:** you typed a username on the unlock screen, and Keyper trusted it.
The database handed over rows to anyone who asked.

**After:** you sign in with an email and password, and the database checks who
you are on every single request.

**Also changing:** your vault key used to be stored in a form the server could
read directly. Now it is stored encrypted under your master passphrase, so a copy
of the database on its own cannot decrypt anything.

### What this does NOT do

- ❌ It does not delete any credentials
- ❌ It does not re-encrypt anything (so it is fast, even with a big vault)
- ❌ It does not change your master passphrase
- ❌ It does not touch your categories or tags

Your credentials are along for the ride. The migration adds an ownership column
and swaps the access rules over.

---

## Before you start: two things to know

### 1. You will have two secrets, not one

This trips people up, so let us be clear about it up front.

| | Account password | Master passphrase |
|---|---|---|
| **Created** | During this migration | You already have it |
| **What it does** | Gets you your rows | Decrypts them |
| **Can be reset?** | Yes, by email | **No, never** |

They are different. You will create a **new account password** during this
migration. Your **existing master passphrase does not change** and you will still
need it.

### 2. Your master passphrase becomes unrecoverable

Older Keyper let you reset a forgotten passphrase by editing the database. That
only worked because the vault key was stored separately in usable form, which is
the thing being fixed.

After this migration, your passphrase is the only way into your vault.

> 🔴 **Write your master passphrase down and put it somewhere safe before you
> start.** If you lose it after migrating, the vault cannot be recovered by
> anyone, including us.

---

## The steps

You will move between the Supabase dashboard and Keyper. Here is the whole shape
before we get into detail:

```
1. Back up                        Supabase dashboard
2. Turn on email sign-in          Supabase dashboard
3. Create your account            Supabase dashboard
4. Run 01-check.sql               SQL Editor       (reads only)
5. Run 02-claim-your-data.sql     SQL Editor       ← the only edit
6. Run 03-apply-security.sql      SQL Editor
7. Sign in and unlock             Keyper
8. Run 04-check-key.sql           SQL Editor       (reads only)
9. Run 05-remove-old-key.sql      SQL Editor
```

The scripts live in the [`migration/`](migration/) folder. Keyper also gives you
a copy button for each one on the upgrade screen.

---

### Step 1 — Back up your database

**Supabase dashboard → Database → Backups.**

Do this even though the migration is careful. It costs nothing and means a
mistake is never permanent.

---

### Step 2 — Turn on email sign-in

**Supabase dashboard → Authentication → Providers → Email → enable.**

Keyper signs you in to a real account now. Without this, nobody can create one.

> If you skip this, later steps will fail with *"Sign-ups are disabled on this
> Supabase project."* That is what it means.

---

### Step 3 — Create your account

**Supabase dashboard → Authentication → Users → Add user.**

Use a real email address and a strong password.

> 🔴 **This password is NOT your master passphrase.** Do not reuse your master
> passphrase here. They do different jobs, and you will need both.

---

### Step 4 — Run `01-check.sql`

**Supabase dashboard → SQL Editor → New query.** Paste the whole file. Run.

**This only reads. It changes nothing.** It is safe to run as many times as you
like.

You will get something like:

```
Accounts you can migrate to | you@example.com  ->  a1b2c3d4-e5f6-7890-abcd-ef1234567890
Migration started?          | NO — nothing applied yet, start at step 2
Your data                   | credentials=25  vault_config=1  categories=8
Usernames in use            | sizzlebop
Vault key state             | original format — step 4 not done yet
Access rules                | original rules still active (12 policies)
```

**Copy the UUID after your email address.** In the example above that is
`a1b2c3d4-e5f6-7890-abcd-ef1234567890`. You need it in the next step.

> 🔴 **This is not the same as the `id` column in your credentials or
> vault_config tables.** Those are row IDs, one per row, and there are lots of
> them. The one you want is the one this script prints next to your email.

If "Accounts you can migrate to" says **NONE**, go back to steps 2 and 3.

---

### Step 5 — Run `02-claim-your-data.sql`

**This is the only script that needs an edit.**

Open the file and find this line near the middle:

```sql
target_owner  UUID := '00000000-0000-0000-0000-000000000000';
```

Replace the zeros with your UUID from step 4:

```sql
target_owner  UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

**Keep the quotes.** Change nothing else. Leave `only_username` as `NULL` unless
several people share this database (see [Sharing a database](#sharing-a-database-with-other-people)).

Paste the whole file into the SQL Editor and run it.

**Expected output:**

```
NOTICE:  Assigned to you@example.com:
  25 credential(s)
  1 vault config(s)
  8 category/ies
```

> ✅ **Check those numbers match what you actually have.** They should match the
> "Your data" line from step 4. If credentials says 0, stop and see
> [Troubleshooting](#troubleshooting).

The query at the bottom should return **no rows**. If it lists anything, run this
script again with `only_username` set to `NULL`.

---

### Step 6 — Run `03-apply-security.sql`

**No edits.** Paste the whole file and run it.

This swaps over the database access rules.

**Expected output:**

```
NOTICE:  Done. Access rules replaced on all three tables.
```

Then a table where **every row says `SCOPED`**, and a final query returning **no
rows**.

> If it says *"STOPPED: N row(s) do not have an owner yet"*, step 5 did not
> finish. Go back and run it again with `only_username` as `NULL`. Nothing has
> been changed, and your vault still works in the meantime.

---

### Step 7 — Sign in to Keyper and unlock

Open Keyper. If you are on the upgrade screen, click **Re-check database**.

1. **Sign in** with the account you created in step 3
2. **Unlock** with your **existing master passphrase** (not the account password)

Your credentials should all be there.

Behind the scenes, Keyper moves your vault key to the new format the moment you
unlock. Nothing is re-encrypted, so it is instant.

> 🔴 **If Keyper offers to create a new vault instead of asking for your existing
> passphrase, stop.** Do not create one. That means step 5 did not claim your
> `vault_config` row. See [Troubleshooting](#troubleshooting).

---

### Step 8 — Run `04-check-key.sql`

**Reads only. Changes nothing.**

**Expected output:**

```
vault      | status
sizzlebop  | DONE — ready for step 5
```

If it says **NOT YET**, go back to step 7 and unlock in the app first.

> 🔴 **Do not continue to step 9 until every row says DONE.**

---

### Step 9 — Run `05-remove-old-key.sql`

**No edits.** Paste the whole file and run it.

This removes the old copy of your vault key, which is no longer needed.

It checks first. If any vault has not moved to the new format, it stops and
changes nothing, so you cannot run it too early by accident.

**Expected output:**

```
NOTICE:  Done. Old key columns removed.
         Your migration is complete.
```

**You are finished.** 🎉

---

## Troubleshooting

Every one of these is recoverable. None of them lose data.

### "The account UUID has not been filled in yet"

You ran `02-claim-your-data.sql` without doing the edit. Go back to step 5.

### "No account exists with id ..."

The UUID is wrong, or no account exists yet. Re-run `01-check.sql` and copy the
UUID exactly as printed. If it lists no accounts, do steps 2 and 3.

### "this database has not had step 2 applied yet"

You ran `03-apply-security.sql` before `02-claim-your-data.sql`. Run them in
order. Nothing was changed.

### "STOPPED: N row(s) do not have an owner yet"

`02-claim-your-data.sql` did not match all your rows, usually because
`only_username` was set. Run it again with `only_username` as `NULL`.

### Step 5 says "0 credential(s)"

Your rows were already claimed by a previous run, or `only_username` does not
match your actual username. Run `01-check.sql` and look at "Usernames in use".

### Keyper offers to create a new vault instead of asking for my passphrase

Your `vault_config` row was not claimed. **Do not create a new vault.** Run
`01-check.sql`: if "Your data" shows `vault_config=1` but Keyper cannot see it,
run `02-claim-your-data.sql` again with `only_username` as `NULL`.

### "This database holds N separate vaults"

You have more than one legacy username, each with its own vault and its own
encryption key. They cannot merge into a single account, because their
credentials are encrypted with different keys.

Create one Supabase account per username, then run `02-claim-your-data.sql` once
per person, each time setting:

```sql
target_owner  UUID := 'that-person-uuid';
only_username TEXT := 'that-username';
```

Every username needs an owner before `03-apply-security.sql` will run.

### Keyper still shows the upgrade screen

Scripts 2 and 3 both need to have run. Run `01-check.sql`: "Migration started?"
should say YES, and "Access rules" should say the new rules are active.

### I ran `sql/supabase-setup.sql` by mistake

It stops by itself when it finds existing data, so almost certainly nothing
happened. Run `01-check.sql` to confirm, then carry on from step 4.

### I have lost my master passphrase

There is no recovery path, and this was true before the migration too. The vault
key is only stored encrypted under that passphrase. If it is genuinely gone, the
vault has to be recreated from scratch.

---

## Sharing a database with other people

If several people use the same Supabase project, each has their own username and
their own vault.

1. Create **one Supabase account per person** (step 3, repeated)
2. Run `02-claim-your-data.sql` **once per person**, setting both:
   ```sql
   target_owner  UUID := 'their-account-uuid';
   only_username TEXT := 'their-username';
   ```
3. Only once **every** username has an owner, run `03-apply-security.sql`
4. Each person then signs in and unlocks with **their own** master passphrase

`03-apply-security.sql` will refuse to run while anyone is unclaimed, so you
cannot accidentally lock someone out.

---

## After you finish

**Signing in comes first, then your passphrase.** Two steps, two secrets.

**Switching accounts means signing out and back in.** The old in-app user list
worked by reading everyone's rows, which the new rules correctly prevent.

**Your master passphrase cannot be reset.** You can change it from Settings any
time you know the current one. Keep a copy somewhere safe.

**If you ran Keyper on a publicly reachable URL:** the previous database rules
allowed access to vault rows using the public anon key. Now that you have
migrated, it is worth refreshing any credentials you stored during that period.
If you only ever ran Keyper on localhost, there is nothing extra to do.

---

## Still stuck?

Open an issue at
[github.com/pinkpixel-dev/keyper/issues](https://github.com/pinkpixel-dev/keyper/issues)
with the output of `01-check.sql`. That one query tells us exactly where you are.

Do not paste your `wrapped_dek`, `raw_dek` or `bcrypt_hash` values into an issue.
`01-check.sql` deliberately does not print them.

---

Made with 💖 by Pink Pixel
