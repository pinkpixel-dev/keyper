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
-- There is exactly ONE thing to edit in this block: paste your account UUID
-- into target_owner below. Get it from:
--
--     SELECT id, email FROM auth.users ORDER BY created_at;
--
-- By default this claims every row that does not yet have an owner, which is
-- what you want on a single-user install. If several people share this database,
-- set only_username to one legacy user_id and run the block once per person.
--
-- The block checks the UUID before touching anything, so a wrong or unedited
-- value stops with a clear message instead of a constraint error.

DO $$
DECLARE
  -- ⬇⬇⬇  PASTE YOUR ACCOUNT UUID HERE  ⬇⬇⬇
  target_owner  UUID := '00000000-0000-0000-0000-000000000000';

  -- Leave NULL to claim everything unclaimed. Set to a legacy user_id (for
  -- example 'jess') only if this database holds several people's vaults.
  only_username TEXT := NULL;

  n_credentials INT;
  n_vault       INT;
  n_categories  INT;
  owner_email   TEXT;
BEGIN
  IF target_owner = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION
      E'\n\nThe account UUID has not been filled in yet.\n\n'
      'Run this to find it:\n'
      '    SELECT id, email FROM auth.users ORDER BY created_at;\n\n'
      'Then paste the id into target_owner at the top of this block.\n'
      'If the query returns nothing, create an account first under\n'
      'Authentication > Users > Add user.\n';
  END IF;

  SELECT email INTO owner_email FROM auth.users WHERE id = target_owner;

  IF owner_email IS NULL THEN
    RAISE EXCEPTION
      E'\n\nNo account exists with id %.\n\n'
      'Check the value against:\n'
      '    SELECT id, email FROM auth.users ORDER BY created_at;\n\n'
      'Nothing has been changed.\n', target_owner;
  END IF;

  -- One account can only hold one vault. Each legacy username has its own
  -- vault_config with its own encryption key, and credentials under each are
  -- encrypted with a different key, so two vaults cannot be merged into one
  -- account. Catch that here rather than letting the unique index fail later.
  SELECT COUNT(*) INTO n_vault
  FROM vault_config
  WHERE owner_id = target_owner
     OR (owner_id IS NULL AND (only_username IS NULL OR user_id = only_username));

  IF n_vault > 1 THEN
    RAISE EXCEPTION
      E'\n\nThis database holds % separate vaults, and one account can only\n'
      'hold one of them.\n\n'
      'Each legacy username has its own encryption key, so their credentials\n'
      'cannot be merged into a single account.\n\n'
      'See which usernames have a vault:\n'
      '    SELECT user_id, created_at FROM vault_config ORDER BY created_at;\n\n'
      'Then either:\n'
      '  a) create one Supabase account per username, and run this block once\n'
      '     per person with only_username set to that username; or\n'
      '  b) if you only want one of them, set only_username to that username\n'
      '     and deal with the others separately.\n\n'
      'Nothing has been changed.\n', n_vault;
  END IF;

  UPDATE credentials SET owner_id = target_owner
   WHERE owner_id IS NULL
     AND (only_username IS NULL OR user_id = only_username);
  GET DIAGNOSTICS n_credentials = ROW_COUNT;

  UPDATE vault_config SET owner_id = target_owner
   WHERE owner_id IS NULL
     AND (only_username IS NULL OR user_id = only_username);
  GET DIAGNOSTICS n_vault = ROW_COUNT;

  UPDATE categories SET owner_id = target_owner
   WHERE owner_id IS NULL
     AND (only_username IS NULL OR user_id = only_username);
  GET DIAGNOSTICS n_categories = ROW_COUNT;

  RAISE NOTICE 'Assigned to % : % credential(s), % vault config(s), % category/ies.',
    owner_email, n_credentials, n_vault, n_categories;
END $$;


-- ============================================================================
-- STAGE 1d: VERIFY NOTHING WAS LEFT BEHIND
-- ============================================================================
--
-- Every count here should be 0. A non-zero count means Stage 1c did not match
-- those rows, usually because they use a different legacy username.

SELECT 'credentials'  AS table_name, user_id, COUNT(*) AS unclaimed FROM credentials  WHERE owner_id IS NULL GROUP BY 1,2
UNION ALL
SELECT 'vault_config' AS table_name, user_id, COUNT(*) AS unclaimed FROM vault_config WHERE owner_id IS NULL GROUP BY 1,2
UNION ALL
SELECT 'categories'   AS table_name, user_id, COUNT(*) AS unclaimed FROM categories   WHERE owner_id IS NULL GROUP BY 1,2;

-- ============================================================================
-- STAGE 1e: LOCK DOWN THE COLUMNS AND REPLACE THE POLICIES
-- ============================================================================
--
-- Everything from here runs inside ONE block on purpose. A bare guard is not
-- enough: psql and the Supabase SQL editor carry on to the next statement after
-- an error, which would apply half of this anyway. Inside a single block, a
-- failed check means none of the statements below it run, and your existing
-- setup keeps working untouched.

DO $$
DECLARE
  unclaimed INT;
  tbl       TEXT;
BEGIN
  SELECT (SELECT COUNT(*) FROM credentials  WHERE owner_id IS NULL)
       + (SELECT COUNT(*) FROM vault_config WHERE owner_id IS NULL)
       + (SELECT COUNT(*) FROM categories   WHERE owner_id IS NULL)
    INTO unclaimed;

  IF unclaimed > 0 THEN
    RAISE EXCEPTION
      E'\n\nSTOPPED: % row(s) still have no owner.\n\n'
      'The new policies match rows on owner_id, so an unowned row would become\n'
      'invisible to the app even though it is still on disk. Nothing has been\n'
      'changed.\n\n'
      'Re-run Stage 1c with only_username left as NULL to claim everything.\n', unclaimed;
  END IF;

  -- Every row has an owner, so the columns can be tightened.
  FOREACH tbl IN ARRAY ARRAY['credentials', 'vault_config', 'categories'] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET NOT NULL', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET DEFAULT auth.uid()', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(owner_id)',
                   'idx_' || tbl || '_owner_id', tbl);
  END LOOP;

  -- One vault per account, and category names unique per account, replacing the
  -- old per-username constraints. Guarded so the file stays safe to re-run.
  ALTER TABLE vault_config DROP CONSTRAINT IF EXISTS vault_config_user_id_key;
  ALTER TABLE categories   DROP CONSTRAINT IF EXISTS categories_user_id_name_key;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_config_owner_id_key') THEN
    ALTER TABLE vault_config ADD CONSTRAINT vault_config_owner_id_key UNIQUE (owner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_owner_id_name_key') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_owner_id_name_key UNIQUE (owner_id, name);
  END IF;

  FOREACH tbl IN ARRAY ARRAY['credentials', 'vault_config', 'categories'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Clear whatever is currently attached, whatever it happens to be called.
    EXECUTE (
      SELECT COALESCE(string_agg(format('DROP POLICY IF EXISTS %I ON public.%I;', policyname, tbl), ' '), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    );

    -- TO authenticated means an unauthenticated request matches no policy.
    -- owner_id = auth.uid() keeps each account to its own rows. The WITH CHECK
    -- clauses stop a row being written under, or moved to, another owner.
    -- auth.uid() sits in a subquery so it is evaluated once per statement.
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
      CREATE POLICY %I ON public.%I
        FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
      CREATE POLICY %I ON public.%I
        FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid()))
                                    WITH CHECK (owner_id = (SELECT auth.uid()));
      CREATE POLICY %I ON public.%I
        FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
    $f$,
      tbl || '_select_policy', tbl,
      tbl || '_insert_policy', tbl,
      tbl || '_update_policy', tbl,
      tbl || '_delete_policy', tbl
    );
  END LOOP;

  -- Inside the block too, for the same reason: revoking anon while the old
  -- permissive policies were still in place would break the running app without
  -- the new rules being ready to take over.
  EXECUTE 'REVOKE ALL ON credentials, vault_config, categories FROM anon';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON credentials, vault_config, categories TO authenticated';

  RAISE NOTICE 'Columns locked down, policies replaced, anon privileges revoked.';
END $$;

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
