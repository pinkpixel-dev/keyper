-- =====================================================
-- KEYPER 1.3.0 MIGRATION — STEP 5 of 5: REMOVE THE OLD KEY COPY
-- =====================================================
--
-- No edits needed. Paste the whole file into the SQL Editor and run it.
--
-- What it does: removes the two old columns that stored your vault key in its
-- previous form, now that Keyper has moved it to the new one.
--
-- This one does remove data, so it checks first. If any vault has not moved to
-- the new format yet, it stops and changes nothing. You cannot run this too
-- early by accident.
--
-- Run 04-check-key.sql first if you have not already.
-- =====================================================

DO $$
DECLARE
  not_ready INT;
  names     TEXT;
BEGIN
  -- Nothing to do if a previous run already removed the columns.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vault_config'
      AND column_name IN ('raw_dek', 'bcrypt_hash')
  ) THEN
    RAISE NOTICE E'\n\nAlready done. The old columns are gone.\n\n'
                 'Your migration is complete.\n';
    RETURN;
  END IF;

  SELECT COUNT(*), string_agg(user_id, ', ')
    INTO not_ready, names
  FROM vault_config
  WHERE wrapped_dek IS NULL;

  IF not_ready > 0 THEN
    RAISE EXCEPTION
      E'\n\nSTOPPED: % vault(s) have not moved to the new key format yet: %\n\n'
      'Open Keyper, sign in as that account, and unlock with its master\n'
      'passphrase. Keyper moves the key across automatically.\n\n'
      'Then run 04-check-key.sql to confirm, and try this file again.\n\n'
      'Nothing has been changed. Removing the old key now would leave that\n'
      'vault unreadable.\n', not_ready, names;
  END IF;

  ALTER TABLE vault_config DROP COLUMN IF EXISTS raw_dek;
  ALTER TABLE vault_config DROP COLUMN IF EXISTS bcrypt_hash;

  RAISE NOTICE E'\n\nDone. Old key columns removed.\n\n'
               'Your migration is complete. Your vault key is now stored only in\n'
               'a form your master passphrase can open.\n';
END $$;


-- Confirm the columns are gone. This should come back empty.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vault_config'
  AND column_name IN ('raw_dek', 'bcrypt_hash');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
--
-- What is different now:
--
-- - You sign in to Keyper with an account, then unlock with your master
--   passphrase. Two separate steps.
-- - Each account reaches only its own rows, checked by the database.
-- - Your vault key is stored only in a form your passphrase can open. Keep a
--   copy of that passphrase somewhere safe: it is now the only way in.
-- =====================================================
