---
title: Configuration
description: Build/runtime config points and where they live.
---

## Key application configs

- Database provider router + Supabase client: `src/integrations/supabase/client.ts`
- Neon serverless adapter: `src/integrations/database/neon-client.ts`
- SQLite local engine (sql.js / IndexedDB): `src/integrations/database/sqlite-client.ts`
- CSP runtime policy: `src/security/ContentSecurityPolicy.ts`
- Build and chunk strategy: `vite.config.ts`
- PWA manifest and caching: `vite.config.ts` (`VitePWA` section)
- In-app setup SQL script surface: `src/components/Settings.tsx`
- In-app operational SQL tab (setup + migration scripts): `src/components/dashboard/DashboardSettings.tsx`
- In-app appearance preferences: `src/components/dashboard/DashboardSettings.tsx`, `src/lib/theme-options.ts`, and `src/App.tsx`

## Appearance preference storage

Appearance settings are local UI preferences:

- Theme: `theme`
- Font: `keyper-font-preference`

These values are stored in the browser or Electron profile. They do not affect credential encryption or database schema.

## SQL script sources

> **Note:** SQL scripts are required for Postgres providers (**Supabase** and **Neon**). SQLite schema is created and seeded automatically on first launch.

- Supabase setup script: `sql/supabase-setup.sql`
- Neon setup script: `sql/neon-setup.sql`
- Existing DB upgrade script: `migration-add-document-misc-types.sql`

## Docs site configs

- Starlight navigation/theme: `website/astro.config.mjs`
- Theme overrides: `website/src/styles/keyper-theme.css`
- Cloudflare Pages config: `website/wrangler.toml`

## Versioning notes

Current package version in app repo is `1.2.1`. Keep app docs, website docs, and distribution artifact references in sync at release time.
