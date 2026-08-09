-- =====================================================
-- 🔐 KEYPER MIGRATION: unconditional RLS -> authenticated, owner-scoped RLS
-- =====================================================
--
-- Run this ONLY if you already have a Keyper database created by an older
-- version of supabase-setup.sql. Fresh installs should run supabase-setup.sql
-- instead, which already contains everything below.
--
-- WHAT THIS FIXES
--
-- Older setups enabled Row Level Security and then wrote every policy as
-- USING (true) with no TO clause. That applies to PUBLIC, which includes anon,
-- so RLS was on but enforcing nothing: anyone holding the anon key could read,
-- overwrite and delete every row, including vault_config.raw_dek, which is the
-- key that decrypts your secrets.
--
-- READ THIS BEFORE YOU START
--
-- This migration is staged on purpose and you must not skip to the end.
--
--   STAGE 1 (this file)  Adds ownership, claims your rows, locks down policies.
--                        raw_dek is deliberately left in place.
--   STAGE 2 (the app)    Each user unlocks their vault once. Keyper re-wraps
--                        the DEK under the master passphrase and clears raw_dek.
--   STAGE 3 (this file)  Drops raw_dek and bcrypt_hash. Only after Stage 2.
--
-- Dropping raw_dek before Stage 2 completes will permanently destroy your
-- ability to decrypt your credentials. There is no recovery path. Take a
-- database backup before you begin.
--
-- Made with ❤️ by Pink Pixel ✨
-- =====================================================


-- ============================================================================
-- STAGE 0: PRE-FLIGHT
-- ============================================================================

-- Confirm what you are about to change. Expect to see twelve policies, all
-- with roles {public} and a qual of "true". That is the bug being fixed.
SELECT tablename, policyname, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('credentials', 'vault_config', 'categories')
ORDER BY tablename, policyname;

-- See which legacy usernames exist. You will map these to real accounts below.
SELECT user_id, COUNT(*) AS credential_count
FROM credentials
GROUP BY user_id
ORDER BY credential_count DESC;


-- ============================================================================
-- STAGE 1a: CREATE YOUR ACCOUNT FIRST
-- ============================================================================
--
-- Before running anything else, go to your Supabase dashboard:
--   Authentication > Providers > enable Email
--   Authentication > Users    > Add user (use a real email + strong password)
--
-- Then grab the account's UUID:
--
--   SELECT id, email FROM auth.users ORDER BY created_at;
--
-- You will paste that UUID into the backfill below. Do this for each person
-- who currently has data in this database.


-- ============================================================================
-- STAGE 1b: ADD OWNERSHIP COLUMNS
-- ============================================================================

-- Added nullable first so existing rows survive; tightened to NOT NULL once
-- every row is claimed.
ALTER TABLE credentials  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE vault_config ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE categories   ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================================
-- STAGE 1c: CLAIM YOUR EXISTING ROWS
-- ============================================================================
--
-- Replace BOTH placeholders, then run. Repeat once per legacy username.
--
--   '00000000-0000-0000-0000-000000000000' -> the UUID from auth.users
--   'self-hosted-user'                     -> the legacy user_id value
--
-- Rows left unclaimed become invisible to everyone once Stage 1e applies. That
-- is intentional: this migration fails closed rather than guessing an owner.

UPDATE credentials
SET owner_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE user_id = 'self-hosted-user' AND owner_id IS NULL;

UPDATE vault_config
SET owner_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE user_id = 'self-hosted-user' AND owner_id IS NULL;

UPDATE categories
SET owner_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE user_id = 'self-hosted-user' AND owner_id IS NULL;


-- ============================================================================
-- STAGE 1d: VERIFY NOTHING WAS LEFT BEHIND
-- ============================================================================
--
-- Every count here must be 0 before you continue. A non-zero count means those
-- rows have no owner and will be unreachable after the next step.

SELECT 'credentials'  AS table_name, COUNT(*) AS unclaimed FROM credentials  WHERE owner_id IS NULL
UNION ALL
SELECT 'vault_config' AS table_name, COUNT(*) AS unclaimed FROM vault_config WHERE owner_id IS NULL
UNION ALL
SELECT 'categories'   AS table_name, COUNT(*) AS unclaimed FROM categories   WHERE owner_id IS NULL;

-- Once all three read 0, lock the columns down.
ALTER TABLE credentials  ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE vault_config ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE categories   ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE credentials  ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE vault_config ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE categories   ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- One vault per account, replacing the old per-username constraint.
ALTER TABLE vault_config DROP CONSTRAINT IF EXISTS vault_config_user_id_key;
ALTER TABLE vault_config ADD  CONSTRAINT vault_config_owner_id_key UNIQUE (owner_id);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_name_key;
ALTER TABLE categories ADD  CONSTRAINT categories_owner_id_name_key UNIQUE (owner_id, name);

CREATE INDEX IF NOT EXISTS idx_credentials_owner_id  ON credentials(owner_id);
CREATE INDEX IF NOT EXISTS idx_vault_config_owner_id ON vault_config(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_owner_id   ON categories(owner_id);


-- ============================================================================
-- STAGE 1e: REPLACE THE POLICIES
-- ============================================================================

ALTER TABLE credentials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;

-- Drop everything currently attached, by name, whatever it is called.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('credentials', 'vault_config', 'categories')
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- TO authenticated means the anon key on its own matches no policy at all.
-- owner_id = auth.uid() means an authenticated user reaches only their own rows.
-- The WITH CHECK clauses stop anyone writing or re-assigning a row to another
-- owner. auth.uid() is wrapped in a subquery so it is evaluated once per
-- statement rather than once per row.

CREATE POLICY "credentials_select_policy" ON credentials
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "credentials_insert_policy" ON credentials
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "credentials_update_policy" ON credentials
  FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "credentials_delete_policy" ON credentials
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "vault_config_select_policy" ON vault_config
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "vault_config_insert_policy" ON vault_config
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "vault_config_update_policy" ON vault_config
  FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "vault_config_delete_policy" ON vault_config
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "categories_select_policy" ON categories
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "categories_insert_policy" ON categories
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "categories_update_policy" ON categories
  FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY "categories_delete_policy" ON categories
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

-- Strip anon at the grant layer too, so a future policy mistake cannot quietly
-- reopen the table.
REVOKE ALL ON credentials, vault_config, categories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON credentials, vault_config, categories TO authenticated;

-- get_credential_stats read the credentials table as SECURITY DEFINER, which
-- bypassed RLS entirely and returned another user's numbers to any caller.
DROP FUNCTION IF EXISTS public.get_credential_stats();


-- ============================================================================
-- STAGE 1f: CONFIRM THE HOLE IS CLOSED
-- ============================================================================
--
-- Every row must read '✅ SCOPED'. Anything else means stop and re-check.

SELECT
  tablename,
  policyname,
  roles,
  CASE
    WHEN 'anon' = ANY(roles) OR 'public' = ANY(roles) THEN '❌ REACHABLE BY ANON'
    WHEN COALESCE(qual, 'true') = 'true' AND COALESCE(with_check, 'true') = 'true' THEN '❌ UNCONDITIONAL'
    ELSE '✅ SCOPED'
  END AS verdict
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('credentials', 'vault_config', 'categories')
ORDER BY tablename, policyname;

-- This should return no rows at all.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name IN ('credentials', 'vault_config', 'categories');


-- ============================================================================
-- STAGE 2: RE-WRAP YOUR DEK (done in the Keyper app, not here)
-- ============================================================================
--
-- Sign in to Keyper with the account you created in Stage 1a and unlock your
-- vault with your existing master passphrase. Keyper detects the legacy raw_dek,
-- re-wraps the key under a passphrase-derived Argon2id key, writes wrapped_dek
-- and clears raw_dek. Nothing is re-encrypted, so it is quick.
--
-- Repeat for every account. Track progress with this query:

SELECT
  user_id,
  owner_id,
  CASE
    WHEN wrapped_dek IS NOT NULL AND raw_dek IS NULL THEN '✅ migrated'
    WHEN wrapped_dek IS NOT NULL AND raw_dek IS NOT NULL THEN '⏳ wrapped, pending cleanup'
    ELSE '❌ still raw - do not run Stage 3'
  END AS dek_status
FROM vault_config
ORDER BY user_id;


-- ============================================================================
-- STAGE 3: DROP THE PLAINTEXT KEY MATERIAL
-- ============================================================================
--
-- ⚠️  DESTRUCTIVE AND IRREVERSIBLE. Run only when the Stage 2 query shows
--     '✅ migrated' for every single row. If any row still says '❌ still raw',
--     running this destroys that vault's contents permanently.
--
-- Uncomment to run:
--
-- ALTER TABLE vault_config DROP COLUMN IF EXISTS raw_dek;
-- ALTER TABLE vault_config DROP COLUMN IF EXISTS bcrypt_hash;
--
-- bcrypt_hash goes too. With a wrapped DEK the passphrase check IS the unwrap,
-- so the hash is redundant, and an offline-crackable hash of your master
-- passphrase is not worth keeping around for nothing.


-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
--
-- What changed for you as an operator:
--
-- - Keyper now requires signing in. The anon key is no longer enough to read
--   anything, which is the entire point of the change.
-- - Your master passphrase is now genuinely unrecoverable. It is the only way
--   to unwrap your DEK, and no hash of it is stored anywhere. Losing it means
--   losing the vault. Write it down and put it somewhere safe.
-- - Still true after this migration: only secret_blob is encrypted. Titles,
--   usernames, URLs, notes and tags remain plaintext in the database.
--
-- =====================================================
