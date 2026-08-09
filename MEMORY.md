# MEMORY.md

## 2026-08-09: Authenticated RLS + Passphrase-Wrapped Vault Key (v1.3.0)

Prompted by a private report from Cenk Kurtoglu (github.com/cekuu35), sent by
email rather than filed as a public issue. Every technical claim in it was
verified against the repo before any code changed.

### What was decided

- **Supabase Auth is now required.** All twelve RLS policies are scoped
  `TO authenticated` with `owner_id = (SELECT auth.uid())`. Ownership moved to a
  new `owner_id UUID` column referencing `auth.users`; the old `user_id TEXT`
  stays as a display label with no authority.
- **The DEK is stored only wrapped** under an Argon2id key derived from the
  master passphrase. `raw_dek` and `bcrypt_hash` are gone.
- **Ownership is resolved per provider.** `ownerColumn()` returns `owner_id` for
  Supabase and `user_id` for SQLite/Neon, so the local providers keep working
  without a pointless login prompt.
- **Neon mode is documented, not "fixed".** Its setup script no longer creates
  policies at all, and carries a warning instead.
- **Settings imports `supabase-setup.sql` via `?raw`** rather than holding a copy.

### Why

- RLS was enabled but every policy was `USING (true)` with no `TO` clause, so it
  applied to `PUBLIC` including `anon`. The anon key of any deployed instance
  could read, overwrite and delete every row.
- `raw_dek` put the decryption key in the same unrestricted path as the
  ciphertext it protects, which is what made the exposure critical rather than
  merely embarrassing.
- The bcrypt reset was not a feature beside the encryption, it was a hole
  through it: overwrite `bcrypt_hash`, then read `raw_dek`, and the vault opens.
  Removing `raw_dek` removes the reset as a side effect, which is correct.
- Multi-user isolation was client-side filtering on a localStorage string while
  the README promised database-level isolation. That gap is the actual bug the
  report found; the researcher assumed single-user and understated it.
- The Settings copy of the SQL had already drifted, so users pasting from the app
  installed the old policies even after the file was fixed. One source removes
  that whole class of failure.

### What was rejected and why

- **Locking down `vault_config` only** (Edge Function for DEK handling):
  rejected. It closes the worst hole but leaves credential rows readable and
  deletable by anyone with the anon key, so the advertised per-user isolation
  would still be fiction.
- **Docs-only fix** (keep the schema, correct the README): rejected. It is
  honest but means walking back RLS, zero-knowledge and per-user isolation as
  features rather than delivering them.
- **Keeping `bcrypt_hash` alongside the wrapped DEK**: rejected. With a wrapped
  DEK the unwrap *is* the passphrase check, so the hash verifies nothing and is
  just an offline-crackable artifact sitting in the database.
- **Making the live DEK extractable** to simplify passphrase change: rejected.
  `changePassphrase` re-unwraps from the stored wrapped DEK using the current
  passphrase instead, so the in-memory key stays non-extractable and XSS cannot
  read it back out of the `CryptoKey`.
- **`maybeSingle()` in VaultStorage**: rejected. The SQLite and Neon builders
  only implement `single()`, and all three providers report no-rows as
  `PGRST116`.
- **Deprecating browser-side Neon**: not done for this release. Documented
  clearly instead, since removing it breaks existing users. Still worth
  revisiting.
- **Defaulting `isFirstTimeUser` to true on error**: removed. Guessing "new user"
  when the vault merely failed to load invites the user to create a fresh vault
  over one that already exists.

### Verification

`tests/rls/` applies the real shipped `supabase-setup.sql` to a throwaway
Postgres behind a Supabase auth shim and asserts the actual behaviour. It was
counter-tested: reintroducing `USING (true)` makes it exit non-zero, and the
original configuration was reproduced to confirm anon really could read the DEK.
Run with `npm run test:rls`. Unit tests went 97 -> 123.


## 2026-06-14: PostHog Docs Site Analytics Setup

### What was decided
- Set up PostHog tracking on the Astro Starlight documentation site using a custom component override (`src/components/Head.astro`).
- Pass build-time environment variables (`VITE_POSTHOG_PROJECT_TOKEN` and `VITE_POSTHOG_HOST`) from the Astro frontmatter (Node context) to the bundled browser script using data attributes on a hidden `#posthog-config` element.
- Implement event listeners inside the bundled script to capture installer downloads (EXE, AppImage, DEB), code block clipboard copies, and Pagefind search input queries (debounced).

### Why
- In Astro, client-side script tags are bundled by Vite and only have access to `PUBLIC_` prefixed variables (non-prefixed variables evaluate to `undefined` for safety). Since the user set up `VITE_POSTHOG_PROJECT_TOKEN` and `VITE_POSTHOG_HOST` in Cloudflare and local environment variables, the standard client-side `import.meta.env` check evaluated to `undefined` and was tree-shaken by the compiler.
- Passing the variables through the frontmatter allows reading `VITE_` prefixed variables at build time and injecting them dynamically into the HTML output.
- Intercepting events globally via standard event delegation avoids having to write custom HTML inside MDX files.

### What was rejected and why
- **Inline script snippet in `astro.config.mjs`**: Rejected because it clutters the configuration and bypasses Vite's native bundler.
- **Renaming env variables to `PUBLIC_`**: Rejected because the user already set up their Cloudflare Pages environment variables, and adapting the codebase to existing variables is cleaner and more seamless.
- **Injecting manual React click handlers**: Rejected because Astro Starlight pages are built as static HTML and do not hydrate React context for basic content blocks.

## 2026-06-24: Website Dependency Security Resolution (esbuild)

### What was decided
- Use npm dependency `overrides` in the documentation website's `package.json` to lock `esbuild` to version `0.28.1`.

### Why
- The `esbuild` development server had a path traversal vulnerability (GHSA-g7r4-m6w7-qqqr) on Windows affecting versions `0.27.3 - 0.28.0`.
- Running `npm audit fix --force` proposed upgrading Astro to `v7.0.2`, which is a major version bump and a breaking change for the website.
- Overriding `esbuild` to `0.28.1` directly resolves the security vulnerability while preserving the stability of the Astro `v6.x` documentation site without config/routing breaking changes.

### What was rejected and why
- **Upgrading Astro to v7.0.2**: Rejected due to high risk of build breakage and major version upgrade overhead.

## 2026-06-24: Grid/List View Toggle Implementation

### What was decided
- Implement a view mode toggle ('grid' | 'list') for the main credentials display on the self-hosted dashboard.
- Persist user preference in `localStorage` under `keyper-view-mode`.
- Design a compact list item component inside `CredentialsGrid.tsx` using flexbox and responsive utilities (hiding tags on smaller screens, using badges, showing actions on hover).

### Why
- Card views are visually rich but consume significant vertical space, making it harder to scan a long list of credentials.
- List views offer a structured, data-dense alternative that allows users to quickly locate and copy credentials.
- Persisting state ensures a consistent preference across browser sessions.

### What was rejected and why
- **Traditional HTML tables (`<table>`)**: Rejected because table rendering on mobile requires heavy responsive restructuring (e.g. converting `display: table` to `display: block`). Flexbox layouts are more natively fluid and responsive.
