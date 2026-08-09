-- =====================================================
-- KEYPER 1.3.0 MIGRATION — STEP 4 of 5: CHECK THE KEY MOVED
-- =====================================================
--
-- Safe to run. This only reads. It changes nothing.
--
-- Run this AFTER you have opened Keyper, signed in, and unlocked your vault
-- with your existing master passphrase.
--
-- When you unlock, Keyper moves your vault key to the new format on its own.
-- Nothing is re-encrypted, so it happens instantly. This file just confirms it.
-- =====================================================

SELECT
  user_id AS vault,
  CASE
    WHEN wrapped_dek IS NOT NULL AND raw_dek IS NULL
      THEN 'DONE — ready for step 5'
    WHEN wrapped_dek IS NOT NULL AND raw_dek IS NOT NULL
      THEN 'DONE — ready for step 5 (old copy still present, step 5 removes it)'
    ELSE
      'NOT YET — open Keyper and unlock this vault first. Do not run step 5.'
  END AS status
FROM vault_config
ORDER BY user_id;

-- =====================================================
-- WHAT TO DO WITH THIS OUTPUT
-- =====================================================
--
-- Every row says DONE
--     -> continue to 05-remove-old-key.sql
--
-- Any row says NOT YET
--     -> open Keyper, sign in as that account, and unlock with its master
--        passphrase. Then run this file again.
--        Do not run step 5 until every row says DONE. Step 5 removes the old
--        key, and a vault that has not moved across still needs it.
--
-- NEXT: 05-remove-old-key.sql
-- =====================================================
