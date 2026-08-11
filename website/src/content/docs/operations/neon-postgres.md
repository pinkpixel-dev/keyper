---
title: Neon Postgres
description: Configure Keyper with Neon Cloud or Neon Local Docker.
---

Keyper can use Neon Postgres through the official Neon serverless driver. Neon is a Postgres provider, so it uses a SQL setup script like Supabase, while SQLite remains the zero-config local option.

## Neon Cloud

1. Create or open a Neon project in the [Neon Console](https://console.neon.tech).
2. Copy a pooled or direct Postgres connection string from the project dashboard.
3. In Keyper, choose **Neon Postgres** as the database provider.
4. Set **Neon Mode** to **Neon Cloud**.
5. Paste the connection string.
6. Copy and run `sql/neon-setup.sql` in the Neon SQL Editor.
7. Return to Keyper, test the connection, save, and continue into the vault.

## Neon Local Docker

Neon Local is a Docker-based local interface to a Neon project or branch. Start the official Neon Local container first, then point Keyper at the local connection string.

Example connection string for Keyper:

```txt
postgres://neon:npg@localhost:5432/neondb
```

In Keyper:

1. Choose **Neon Postgres**.
2. Set **Neon Mode** to **Neon Local Docker**.
3. Paste the Neon Local connection string.
4. Run `sql/neon-setup.sql` against the Neon Local database.
5. Test and save.

Keyper derives the Neon serverless local HTTP endpoint from the host and port in the connection string.

## Security Note

Neon connection strings include a database role password. Keyper stores the string locally in the browser or Electron profile, following the same self-hosted configuration model used by the rest of the app.

Credential secrets are still encrypted client-side before storage. The Neon database receives encrypted payloads in `credentials.secret_blob`, plus metadata used for filtering and display.
