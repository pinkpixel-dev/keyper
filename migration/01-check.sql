-- =====================================================
-- KEYPER 1.3.0 MIGRATION — STEP 1 of 5: CHECK
-- =====================================================
--
-- Safe to run. This only reads. It changes nothing.
--
-- Paste the whole file into the Supabase SQL Editor and run it.
--
-- It tells you which account UUID to use in step 2, and whether any of the
-- migration has already been applied.
-- =====================================================

SELECT 'Accounts you can migrate to' AS check,
       COALESCE(string_agg(email || '  ->  ' || id, E'\n'),
                'NONE — create one under Authentication > Users') AS result
FROM auth.users

UNION ALL
SELECT 'Migration started?',
       CASE WHEN COUNT(*) = 3 THEN 'YES — step 2 already applied'
            WHEN COUNT(*) = 0 THEN 'NO — nothing applied yet, start at step 2'
            ELSE 'PARTLY — owner_id on ' || COUNT(*) || ' of 3 tables' END
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'owner_id'
  AND table_name IN ('credentials', 'vault_config', 'categories')

UNION ALL
SELECT 'Your data',
       'credentials=' || (SELECT COUNT(*) FROM credentials)
    || '  vault_config=' || (SELECT COUNT(*) FROM vault_config)
    || '  categories=' || (SELECT COUNT(*) FROM categories)

UNION ALL
SELECT 'Usernames in use',
       (SELECT COALESCE(string_agg(DISTINCT user_id, ', '), 'none') FROM (
          SELECT user_id FROM credentials
          UNION SELECT user_id FROM vault_config
          UNION SELECT user_id FROM categories
        ) u)

UNION ALL
SELECT 'Vault key state',
       COALESCE((SELECT CASE
          WHEN wrapped_dek IS NOT NULL AND raw_dek IS NULL THEN 'new format — step 4 done'
          WHEN raw_dek IS NOT NULL THEN 'original format — step 4 not done yet'
          ELSE 'no key found' END
        FROM vault_config LIMIT 1), 'no vault_config row')

UNION ALL
SELECT 'Access rules',
       (SELECT CASE
          WHEN COUNT(*) FILTER (WHERE 'authenticated' = ANY(roles)) = 12 THEN 'new owner-scoped rules active — step 3 done'
          WHEN COUNT(*) = 0 THEN 'no policies found'
          ELSE 'original rules still active (' || COUNT(*) || ' policies)' END
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('credentials', 'vault_config', 'categories'));

-- =====================================================
-- WHAT TO DO WITH THIS OUTPUT
-- =====================================================
--
-- "Accounts you can migrate to"
--     Copy the UUID after your email address. That is what step 2 needs.
--     If it says NONE, go to Authentication > Providers, enable Email, then
--     Authentication > Users > Add user. Then run this file again.
--
--     Note: this is NOT any of the id values you see in the credentials or
--     vault_config tables. Those are row ids, one per row.
--
-- "Migration started?"
--     NO      -> continue to 02-claim-your-data.sql
--     PARTLY  -> continue to 02-claim-your-data.sql, it is safe to re-run
--     YES     -> step 2 is done; check "Access rules" for whether step 3 is too
--
-- NEXT: 02-claim-your-data.sql
-- =====================================================
