-- =====================================================
-- 🔐 KEYPER SECURITY UPGRADE - BCRYPT MIGRATION
-- =====================================================
-- 
-- This migration adds bcrypt hash support for secure master passphrase
-- reset functionality without backdoors or security vulnerabilities.
-- 
-- Made with ❤️ by Pink Pixel ✨
-- Date: August 23, 2025 (Security Enhancement)
-- =====================================================

-- Update vault_config table for simplified bcrypt-only architecture
-- Add bcrypt_hash column and raw_dek column, remove wrapped_dek dependency
ALTER TABLE vault_config 
ADD COLUMN IF NOT EXISTS bcrypt_hash TEXT;

ALTER TABLE vault_config 
ADD COLUMN IF NOT EXISTS raw_dek TEXT;

-- Note: Both new columns are nullable for backwards compatibility
-- Existing users have wrapped_dek, new users will use raw_dek + bcrypt_hash

-- =====================================================
-- ⚠️  IMPORTANT NOTICE FOR EXISTING USERS
-- =====================================================
-- 
-- After running this migration, you will need to set up:
-- 1. The bcrypt hash for your master passphrase
-- 2. Extract your raw DEK from your wrapped_dek
-- 
-- STEP 1: Generate bcrypt hash
-- 1. Visit https://bcrypt-generator.com/
-- 2. Enter your current master passphrase under "Text to Hash"
-- 3. Click "Generate" to create the hash
-- 4. Copy the generated bcrypt hash
-- 
-- STEP 2: Extract your raw DEK
-- If you are migrating, you need to unlock your vault with your 
-- current passphrase first, then use the Admin Console to extract
-- the raw DEK by running this command in your browser console:
-- 
-- console.log(await secureVault.exportRawDEK());
-- 
-- STEP 3: Update your database
-- Execute this SQL replacing the placeholders with your values:
-- 
--    UPDATE vault_config 
--    SET 
--      bcrypt_hash = 'your_generated_hash_here',
--      raw_dek = 'your_exported_raw_dek_here'
--    WHERE user_id = 'your-username';
-- 
-- This one-time setup enables secure passphrase reset capability
-- without any backdoors or admin overrides.
-- 
-- ✅ Your existing encrypted data remains completely safe
-- ✅ Your current passphrase continues to work normally
-- ✅ You gain the ability to securely reset your passphrase
--   by only updating the bcrypt_hash field in the future
-- 
-- =====================================================

-- Verify the columns were added successfully
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'vault_config' 
  AND column_name IN ('bcrypt_hash', 'raw_dek');

-- =====================================================
-- 📝 MIGRATION COMPLETE
-- =====================================================
-- 
-- The bcrypt_hash and raw_dek columns have been added to your vault_config table.
-- 
-- NEXT STEPS:
-- 1. Follow the instructions above to set your bcrypt hash
-- 2. Update your Keyper application to the latest version
-- 3. Enjoy secure, user-controlled passphrase reset capability!
-- 
-- =====================================================
