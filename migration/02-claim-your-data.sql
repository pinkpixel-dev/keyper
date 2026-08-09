-- =====================================================
-- KEYPER 1.3.0 MIGRATION — STEP 2 of 5: CLAIM YOUR DATA
-- =====================================================
--
-- ⚠️  ONE EDIT NEEDED before you run this.
--
-- Find this line below and replace the zeros with your account UUID from
-- step 1 (01-check.sql):
--
--     target_owner  UUID := '00000000-0000-0000-0000-000000000000';
--
-- Then paste the whole file into the SQL Editor and run it.
--
-- What it does: adds an owner column to your three tables and marks your
-- existing rows as belonging to your account. It does not change any
-- credential data and does not touch your encryption key.
--
-- Safe to re-run. If you get it wrong, nothing is applied and it tells you why.
-- =====================================================


-- Add the ownership column. Nullable for now; step 3 tightens it once every
-- row has an owner.
ALTER TABLE credentials  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE vault_config ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE categories   ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


DO $$
DECLARE
  -- ⬇⬇⬇  PASTE YOUR ACCOUNT UUID FROM STEP 1 HERE  ⬇⬇⬇
  target_owner  UUID := '00000000-0000-0000-0000-000000000000';

  -- Leave this as NULL unless several people share this database. If they do,
  -- set it to one legacy username (for example 'sizzlebop') and run this file
  -- once per person, using each person's own account UUID.
  only_username TEXT := NULL;

  n_credentials INT;
  n_vault       INT;
  n_categories  INT;
  owner_email   TEXT;
BEGIN
  IF target_owner = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION
      E'\n\nThe account UUID has not been filled in yet.\n\n'
      'Run 01-check.sql and copy the UUID shown next to your email address,\n'
      'then paste it into target_owner near the top of this file.\n\n'
      'Nothing has been changed.\n';
  END IF;

  SELECT email INTO owner_email FROM auth.users WHERE id = target_owner;

  IF owner_email IS NULL THEN
    RAISE EXCEPTION
      E'\n\nNo account exists with id %.\n\n'
      'Re-run 01-check.sql and copy the UUID exactly as shown.\n'
      'If no accounts are listed, create one under\n'
      'Authentication > Users > Add user.\n\n'
      'Nothing has been changed.\n', target_owner;
  END IF;

  -- One account holds one vault. Each legacy username has its own vault_config
  -- with its own encryption key, and the credentials under each are encrypted
  -- with a different key, so two vaults cannot merge into one account.
  SELECT COUNT(*) INTO n_vault
  FROM vault_config
  WHERE owner_id = target_owner
     OR (owner_id IS NULL AND (only_username IS NULL OR user_id = only_username));

  IF n_vault > 1 THEN
    RAISE EXCEPTION
      E'\n\nThis database holds % separate vaults, and one account can hold\n'
      'only one of them.\n\n'
      'Each username has its own encryption key, so their credentials cannot\n'
      'be merged into a single account.\n\n'
      'See which usernames have a vault:\n'
      '    SELECT user_id, created_at FROM vault_config ORDER BY created_at;\n\n'
      'Then either:\n'
      '  a) create one account per username, and run this file once per person\n'
      '     with only_username set to that username; or\n'
      '  b) if you only want to keep one, set only_username to that username.\n\n'
      'Nothing has been changed.\n', n_vault;
  END IF;

  UPDATE credentials SET owner_id = target_owner
   WHERE owner_id IS NULL AND (only_username IS NULL OR user_id = only_username);
  GET DIAGNOSTICS n_credentials = ROW_COUNT;

  UPDATE vault_config SET owner_id = target_owner
   WHERE owner_id IS NULL AND (only_username IS NULL OR user_id = only_username);
  GET DIAGNOSTICS n_vault = ROW_COUNT;

  UPDATE categories SET owner_id = target_owner
   WHERE owner_id IS NULL AND (only_username IS NULL OR user_id = only_username);
  GET DIAGNOSTICS n_categories = ROW_COUNT;

  RAISE NOTICE E'\n\nAssigned to %:\n'
               '  % credential(s)\n'
               '  % vault config(s)\n'
               '  % category/ies\n\n'
               'Check those numbers look right, then run 03-apply-security.sql\n',
    owner_email, n_credentials, n_vault, n_categories;
END $$;


-- Anything still unowned? This should come back empty.
-- If it lists rows, run this file again with only_username set to NULL.
SELECT 'credentials'  AS table_name, user_id, COUNT(*) AS still_unowned FROM credentials  WHERE owner_id IS NULL GROUP BY 1, 2
UNION ALL
SELECT 'vault_config' AS table_name, user_id, COUNT(*) AS still_unowned FROM vault_config WHERE owner_id IS NULL GROUP BY 1, 2
UNION ALL
SELECT 'categories'   AS table_name, user_id, COUNT(*) AS still_unowned FROM categories   WHERE owner_id IS NULL GROUP BY 1, 2;

-- =====================================================
-- NEXT: 03-apply-security.sql
-- =====================================================
