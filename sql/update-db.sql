-- Add new credential types for document uploads and miscellaneous sensitive values
-- Run this in Supabase SQL Editor for existing deployments.

ALTER TABLE credentials
  DROP CONSTRAINT IF EXISTS credentials_credential_type_check;

ALTER TABLE credentials
  ADD CONSTRAINT credentials_credential_type_check
  CHECK (
    credential_type IN (
      'api_key',
      'login',
      'secret',
      'token',
      'certificate',
      'document',
      'misc'
    )
  );
