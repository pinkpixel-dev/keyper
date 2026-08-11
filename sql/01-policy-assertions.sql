-- Behavioural tests for the Keyper RLS policies.
-- Each assertion raises on failure, so with ON_ERROR_STOP=1 any regression
-- makes psql exit non-zero. Run against a DB that has had 00-supabase-shim.sql
-- and then supabase-setup.sql applied.

\set ALICE '11111111-1111-1111-1111-111111111111'
\set BOB   '22222222-2222-2222-2222-222222222222'

-- ---------------------------------------------------------------------------
-- Seed as table owner (bypasses RLS), one vault per user.
-- ---------------------------------------------------------------------------
INSERT INTO credentials (owner_id, user_id, title, username, url, secret_blob) VALUES
  (:'ALICE', 'alice', 'Alice Bank Login', 'alice@bank', 'https://bank.example', '{"ct":"alice-secret"}'),
  (:'BOB',   'bob',   'Bob AWS Key',      'bob@aws',    'https://aws.example',  '{"ct":"bob-secret"}');

INSERT INTO vault_config (owner_id, user_id, wrapped_dek) VALUES
  (:'ALICE', 'alice', '{"v":1,"kdf":"argon2id","salt":"a","iv":"a","ct":"alice-wrapped-dek"}'),
  (:'BOB',   'bob',   '{"v":1,"kdf":"argon2id","salt":"b","iv":"b","ct":"bob-wrapped-dek"}');

INSERT INTO categories (owner_id, user_id, name) VALUES
  (:'ALICE', 'alice', 'Personal'),
  (:'BOB',   'bob',   'Work');

-- Helper: run a statement and report whether it was refused.
CREATE OR REPLACE FUNCTION pg_temp.refused(stmt TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RETURN false;
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  RETURN true;
END;
$$;

-- ===========================================================================
-- 1. ANON, holding only the anon key, must reach nothing.
--    This is the exact case the old USING (true) policies left wide open.
-- ===========================================================================
SET ROLE anon;
SELECT set_config('request.jwt.claims', NULL, false);

DO $$
BEGIN
  IF NOT pg_temp.refused('SELECT * FROM credentials') THEN
    RAISE EXCEPTION 'FAIL: anon could SELECT credentials';
  END IF;
  IF NOT pg_temp.refused('SELECT * FROM vault_config') THEN
    RAISE EXCEPTION 'FAIL: anon could SELECT vault_config (DEK exposure)';
  END IF;
  IF NOT pg_temp.refused('SELECT * FROM categories') THEN
    RAISE EXCEPTION 'FAIL: anon could SELECT categories';
  END IF;
  IF NOT pg_temp.refused('DELETE FROM credentials') THEN
    RAISE EXCEPTION 'FAIL: anon could DELETE credentials (vault wipe)';
  END IF;
  IF NOT pg_temp.refused($i$INSERT INTO credentials (owner_id, title, secret_blob) VALUES ('11111111-1111-1111-1111-111111111111','x','{}')$i$) THEN
    RAISE EXCEPTION 'FAIL: anon could INSERT credentials';
  END IF;
  RAISE NOTICE 'PASS 1: anon is refused on all three tables (select/insert/delete)';
END $$;
RESET ROLE;

-- ===========================================================================
-- 2. An authenticated session with no valid subject claim sees nothing.
-- ===========================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', NULL, false);

DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM credentials;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: claimless session saw % credential rows', n; END IF;
  SELECT COUNT(*) INTO n FROM vault_config;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: claimless session saw % vault_config rows', n; END IF;
  RAISE NOTICE 'PASS 2: authenticated role with no subject claim sees 0 rows';
END $$;
RESET ROLE;

-- ===========================================================================
-- 3. Alice sees exactly her own rows, and none of Bob's.
-- ===========================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);

DO $$
DECLARE n INT; t TEXT;
BEGIN
  SELECT COUNT(*) INTO n FROM credentials;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: alice saw % credential rows, expected 1', n; END IF;

  SELECT title INTO t FROM credentials;
  IF t <> 'Alice Bank Login' THEN RAISE EXCEPTION 'FAIL: alice saw wrong row: %', t; END IF;

  SELECT COUNT(*) INTO n FROM credentials WHERE title = 'Bob AWS Key';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: alice could see bob credential'; END IF;

  SELECT COUNT(*) INTO n FROM vault_config;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: alice saw % vault_config rows, expected 1', n; END IF;

  SELECT wrapped_dek ->> 'ct' INTO t FROM vault_config;
  IF t <> 'alice-wrapped-dek' THEN RAISE EXCEPTION 'FAIL: alice got wrong DEK: %', t; END IF;

  SELECT COUNT(*) INTO n FROM categories;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: alice saw % category rows, expected 1', n; END IF;

  RAISE NOTICE 'PASS 3: alice sees only her own rows across all three tables';
END $$;

-- ===========================================================================
-- 4. Alice cannot reach Bob's DEK. This was the headline finding.
-- ===========================================================================
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM vault_config
   WHERE owner_id = '22222222-2222-2222-2222-222222222222';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: alice reached bob vault_config'; END IF;
  RAISE NOTICE 'PASS 4: alice cannot read another account DEK';
END $$;

-- ===========================================================================
-- 5. Alice cannot write rows owned by Bob, nor hand her rows to Bob.
-- ===========================================================================
DO $$
BEGIN
  IF NOT pg_temp.refused($i$INSERT INTO credentials (owner_id, title, secret_blob) VALUES ('22222222-2222-2222-2222-222222222222','planted','{}')$i$) THEN
    RAISE EXCEPTION 'FAIL: alice inserted a row owned by bob';
  END IF;
  IF NOT pg_temp.refused($i$UPDATE credentials SET owner_id = '22222222-2222-2222-2222-222222222222'$i$) THEN
    RAISE EXCEPTION 'FAIL: alice re-assigned her row to bob';
  END IF;
  RAISE NOTICE 'PASS 5: WITH CHECK blocks cross-owner insert and re-assignment';
END $$;

-- ===========================================================================
-- 6. Alice cannot modify or delete Bob's data.
-- ===========================================================================
DO $$
DECLARE n INT;
BEGIN
  UPDATE credentials SET title = 'hijacked' WHERE title = 'Bob AWS Key';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: alice updated % of bob rows', n; END IF;

  DELETE FROM credentials;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: alice DELETE FROM credentials removed % rows, expected only her own 1', n; END IF;

  DELETE FROM vault_config;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: alice DELETE FROM vault_config removed % rows', n; END IF;

  RAISE NOTICE 'PASS 6: unqualified DELETE removes only the caller own rows';
END $$;
RESET ROLE;

-- ===========================================================================
-- 7. Bob's data survived Alice's unqualified DELETE.
-- ===========================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', false);

DO $$
DECLARE n INT; t TEXT;
BEGIN
  SELECT COUNT(*) INTO n FROM credentials;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: bob has % credential rows after alice DELETE, expected 1', n; END IF;

  SELECT wrapped_dek ->> 'ct' INTO t FROM vault_config;
  IF t IS DISTINCT FROM 'bob-wrapped-dek' THEN RAISE EXCEPTION 'FAIL: bob DEK damaged: %', t; END IF;

  RAISE NOTICE 'PASS 7: bob data intact after another account tried to wipe the tables';
END $$;

-- ===========================================================================
-- 8. get_credential_stats must not leak across accounts.
--    It used to be SECURITY DEFINER, which bypassed RLS entirely.
-- ===========================================================================
DO $$
DECLARE n BIGINT;
BEGIN
  SELECT total_credentials INTO n FROM public.get_credential_stats();
  IF COALESCE(n, 0) <> 1 THEN
    RAISE EXCEPTION 'FAIL: get_credential_stats returned % for bob, expected 1', n;
  END IF;
  RAISE NOTICE 'PASS 8: get_credential_stats is owner-scoped';
END $$;
RESET ROLE;

-- ===========================================================================
-- 9. Regression guard: no policy may be unconditional or reachable by anon.
-- ===========================================================================
DO $$
DECLARE bad INT;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('credentials','vault_config','categories')
    AND ('anon' = ANY(roles)
         OR 'public' = ANY(roles)
         OR (COALESCE(qual,'true') = 'true' AND COALESCE(with_check,'true') = 'true'));
  IF bad > 0 THEN
    RAISE EXCEPTION 'FAIL: % policy(ies) are unconditional or anon-reachable', bad;
  END IF;
  RAISE NOTICE 'PASS 9: all 12 policies are role-scoped and predicate-scoped';
END $$;

SELECT '=== ALL RLS ASSERTIONS PASSED ===' AS result;
