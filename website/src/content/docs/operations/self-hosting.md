---
title: Self-Hosting
description: Self-hosting behavior and environment assumptions for the Keyper app.
---

This page covers the different ways to self-host Keyper and the runtime model that applies to each.

## Runtime assumptions in app code

- Supabase URL/key or Neon connection strings are supplied by the user at runtime and stored in local storage.
- On Supabase, identity comes from the signed-in Supabase Auth session, and row access is scoped by the database to `owner_id = auth.uid()`. Client queries filter on the same column, but the database is what enforces it.
- On SQLite and Neon, the vault is selected by a local username (`keyper-username`) typed on the unlock screen, since those modes have no server-side account.
- Enable the Email provider in your Supabase project before first use, or nobody will be able to sign in.

:::note
Upgrading an existing Supabase install from before 1.3.0? See
[Upgrading to 1.3.0](/getting-started/upgrading-to-1-3/) for the one-time
database update.
:::

## Deployment options

### Docker (recommended for servers)

The Docker image serves the compiled Vite/React SPA from nginx. No Node.js runtime is required in production.

**Quick start with Docker Compose:**

```bash
git clone https://github.com/pinkpixel-dev/keyper.git
cd keyper

# Start on http://localhost:8080
docker compose up -d

# Use a different host port
HOST_PORT=3030 docker compose up -d

# Rebuild after source changes
docker compose up -d --build

# Stop
docker compose down

# View logs
docker compose logs -f
```

**Check container health:**

```bash
curl http://localhost:8080/healthz
# returns: ok
```

**Run without Compose:**

```bash
docker build -t keyper .
docker run -d -p 8080:80 --name keyper --restart unless-stopped keyper
```

No environment variables or volumes are required. Configuration (Supabase credentials, Neon connection strings, provider selection, username context, optional SQLite path/name) is entered in-app. In browser-hosted usage, config is stored in browser `localStorage` and SQLite data persists in browser storage. In Electron, SQLite can also use a file on disk.

Multi-user onboarding is self-service. On Supabase each person signs up with their own email, and the database keeps accounts to their own rows. On SQLite and Neon, each username on the unlock screen gets its own vault and passphrase. No admin account is required or available in either case.

### HTTPS in production

For HTTPS, place a reverse proxy (Caddy, nginx, Traefik) in front of the container. Example Caddy snippet:

```
keyper.example.com {
    reverse_proxy keyper:80
}
```

The container itself does not terminate TLS.

### npm / Node.js server

For Node.js environments, the CLI `bin/keyper.js` starts a Vite preview server on port 4173 (configurable via `--port`):

```bash
npm install -g @pinkpixel/keyper
keyper --port 4173
```

### Electron desktop app

See [Install and Run](/getting-started/install-and-run/) for the currently published Windows and Linux desktop download links, plus local build options for additional Electron targets.

## Operational recommendations

- Run Keyper over HTTPS in production.
- Keep Supabase credentials, Neon connection strings, and Postgres policies tightly controlled.
- Be explicit about SQLite storage mode in user-facing docs: browser/PWA uses browser-local persistence, while Electron can also use a disk-backed database file.
- Validate that the SQL setup script matches the current app release before onboarding users.
- For existing databases, apply release migrations (for example `migration-add-document-misc-types.sql`) before enabling new credential features in production.
- Periodically audit docs against implementation to avoid security misunderstandings.
- Row Level Security is enabled on all Supabase and Neon Postgres tables — do not disable it.
