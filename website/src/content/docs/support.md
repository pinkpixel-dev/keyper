---
title: Support
description: Where to get help with Keyper, and what to include when you ask.
---

## Start here

**Upgrading from a version before 1.3.0?**
Read [Upgrading to 1.3.0](/getting-started/upgrading-to-1-3/) first. Most
questions right now are about that migration, and the guide covers every error
the scripts can produce.

**Something not working?**
[Troubleshooting](/operations/troubleshooting/) covers the common cases.

**Wondering what is and is not protected?**
The [Security model](/security/security-model/) page is specific about what each
layer covers.

## Report a bug or request a feature

**[github.com/pinkpixel-dev/keyper/issues](https://github.com/pinkpixel-dev/keyper/issues)**

GitHub is the best place for these, because other people can see the answer and
follow along.

Helpful things to include:

- What you expected, and what happened instead
- Your database provider (Supabase, Neon or SQLite)
- Your Keyper version, from **Settings → About**
- Any errors from the browser console (F12 → Console)
- If it is migration related, the output of `01-check.sql`

## Email

**[support@keyper.icu](mailto:support@keyper.icu)**

For anything that does not belong in a public issue.

:::danger[Never send us these]
No matter who is asking, and no matter how a request is worded:

- Your **master passphrase**
- Your **account password**
- Your database **connection string** or **service role key**
- The contents of your **`vault_config`** table, including `wrapped_dek`,
  `raw_dek` or `bcrypt_hash`
- Screenshots showing decrypted credentials

Nobody at Pink Pixel will ever ask for any of these. We cannot decrypt your vault
and we do not want to be able to. `01-check.sql` deliberately does not print any
key material, which makes it safe to paste into an issue.
:::

## A note on lost passphrases

There is no recovery path for a forgotten master passphrase, and support cannot
create one. Your vault key is stored only in a form that passphrase unlocks, and
nothing on the server can open it. That is what stops a copy of the database from
decrypting your credentials.

If you know your current passphrase and want a different one, use
**Settings → Reset → Change Master Passphrase**. That keeps all your credentials.

## Project links

| | |
|---|---|
| Website | [keyper.icu](https://keyper.icu) |
| Web app | [app.keyper.icu](https://app.keyper.icu) |
| Source | [github.com/pinkpixel-dev/keyper](https://github.com/pinkpixel-dev/keyper) |
| Releases | [GitHub releases](https://github.com/pinkpixel-dev/keyper/releases) |
| Changelog | [CHANGELOG.md](https://github.com/pinkpixel-dev/keyper/blob/main/CHANGELOG.md) |
| Licence | Apache-2.0 |
| Maker | [Pink Pixel](https://pinkpixel.dev) |

## Reporting a security issue

If you have found a security problem, please email
**[support@keyper.icu](mailto:support@keyper.icu)** rather than opening a public
issue, so it can be fixed before it is widely known.

Include enough detail to reproduce it. You do not need to include any of your own
credentials or key material to make a report useful.

Keyper's 1.3.0 access-control fix came from exactly that kind of report, and it
is credited in the [changelog](https://github.com/pinkpixel-dev/keyper/blob/main/CHANGELOG.md).
