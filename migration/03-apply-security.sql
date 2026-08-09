-- =====================================================
-- KEYPER 1.3.0 MIGRATION — STEP 3 of 5: APPLY THE NEW ACCESS RULES
-- =====================================================
--
-- No edits needed. Paste the whole file into the SQL Editor and run it.
--
-- What it does: replaces the database access rules so that each account can
-- only reach its own rows, and requires a signed-in session. It does not touch
-- any credential data and does not touch your encryption key.
--
-- Safe to re-run. If step 2 was not finished, this stops without changing
-- anything and tells you what is missing.
--
-- After this runs, the app needs you to sign in. That is expected.
-- =====================================================

DO $$
DECLARE
  unclaimed INT;
  have_cols INT;
  tbl       TEXT;
BEGIN
  -- Has step 2 been run at all? Without the owner column there is nothing here
  -- to work with, and the checks below would fail with a raw Postgres error.
  SELECT COUNT(*) INTO have_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'owner_id'
    AND table_name IN ('credentials', 'vault_config', 'categories');

  IF have_cols < 3 THEN
    RAISE EXCEPTION
      E'\n\nSTOPPED: this database has not had step 2 applied yet.\n\n'
      'Run 02-claim-your-data.sql first. It adds the owner column and marks\n'
      'your existing rows as yours.\n\n'
      'Nothing has been changed. Your current setup still works.\n';
  END IF;

  -- Refuse to continue while any row has no owner. The new rules match rows by
  -- owner, so an unowned row would still be on disk but invisible to the app.
  SELECT (SELECT COUNT(*) FROM credentials  WHERE owner_id IS NULL)
       + (SELECT COUNT(*) FROM vault_config WHERE owner_id IS NULL)
       + (SELECT COUNT(*) FROM categories   WHERE owner_id IS NULL)
    INTO unclaimed;

  IF unclaimed > 0 THEN
    RAISE EXCEPTION
      E'\n\nSTOPPED: % row(s) do not have an owner yet.\n\n'
      'Run 02-claim-your-data.sql first, with only_username left as NULL so it\n'
      'claims everything.\n\n'
      'Nothing has been changed. Your current setup still works.\n', unclaimed;
  END IF;

  -- Every row has an owner, so the column can be required from now on.
  FOREACH tbl IN ARRAY ARRAY['credentials', 'vault_config', 'categories'] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET NOT NULL', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_id SET DEFAULT auth.uid()', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(owner_id)',
                   'idx_' || tbl || '_owner_id', tbl);
  END LOOP;

  -- One vault per account, and category names unique per account, replacing the
  -- old per-username versions.
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

    -- TO authenticated means a request with no session matches no policy.
    -- owner_id = auth.uid() keeps each account to its own rows. The WITH CHECK
    -- clauses stop a row being written under, or moved to, another owner.
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

  -- Also inside this block: revoking anon while the old rules were still in
  -- place would break the running app before the new rules were ready.
  EXECUTE 'REVOKE ALL ON credentials, vault_config, categories FROM anon';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON credentials, vault_config, categories TO authenticated';

  RAISE NOTICE E'\n\nDone. Access rules replaced on all three tables.\n\n'
               'Next: open Keyper, sign in with your account, and unlock with your\n'
               'existing master passphrase. Then run 04-check-key.sql.\n';
END $$;


-- This function read the credentials table in a way that ignored access rules.
DROP FUNCTION IF EXISTS public.get_credential_stats();


-- Every row below must say SCOPED.
SELECT
  tablename,
  policyname,
  CASE
    WHEN 'anon' = ANY(roles) OR 'public' = ANY(roles) THEN 'REACHABLE WITHOUT SIGNING IN'
    WHEN COALESCE(qual, 'true') = 'true' AND COALESCE(with_check, 'true') = 'true' THEN 'NOT SCOPED'
    ELSE 'SCOPED'
  END AS verdict
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('credentials', 'vault_config', 'categories')
ORDER BY tablename, policyname;

-- This should come back empty.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name IN ('credentials', 'vault_config', 'categories');

-- =====================================================
-- NEXT: open Keyper, sign in, unlock with your existing master passphrase.
--       Then run 04-check-key.sql.
-- =====================================================
