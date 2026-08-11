-- =====================================================
-- 🔐 KEYPER DATABASE SETUP (Single Script)
-- =====================================================
-- 
-- Complete database setup for Keyper - encrypted vault system
-- This script creates all tables, indexes, policies, and functions needed.
-- 
-- Run this ENTIRE script in your Supabase SQL Editor.
-- 
-- Made with ❤️ by Pink Pixel ✨
-- Date: August 23, 2025 (Security Enhanced)
-- =====================================================

-- ============================================================================
-- 0. PRE-FLIGHT: REFUSE TO RUN OVER AN EXISTING VAULT
-- ============================================================================
--
-- This script is for FRESH INSTALLS. Section 5 drops every policy on these
-- tables and section 6 recreates them, so running it against a database that
-- already holds credentials can lock you out of your own rows, and on a
-- pre-1.3.0 database it will not add the ownership column your data needs.
--
-- If you already have a vault, stop here and run migration-auth-rls.sql instead.
--
-- This block aborts the whole script if it finds existing data. It is a guard,
-- not an obstacle: on a genuinely empty database it does nothing at all.

DO $$
DECLARE
  credential_count BIGINT := 0;
  vault_count BIGINT := 0;
BEGIN
  IF to_regclass('public.credentials') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.credentials' INTO credential_count;
  END IF;

  IF to_regclass('public.vault_config') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.vault_config' INTO vault_count;
  END IF;

  IF credential_count > 0 OR vault_count > 0 THEN
    RAISE EXCEPTION
      E'\n\n'
      '========================================================\n'
      'STOPPED: this database already contains a Keyper vault.\n'
      '========================================================\n'
      'Found % credential row(s) and % vault config row(s).\n'
      '\n'
      'supabase-setup.sql is for fresh installs only. It drops and\n'
      'recreates every RLS policy, which on an existing database can\n'
      'leave you unable to read your own rows.\n'
      '\n'
      'To upgrade an existing vault, run migration-auth-rls.sql and\n'
      'follow its stages in order.\n'
      '\n'
      'Nothing has been changed. Your data is untouched.\n'
      '========================================================',
      credential_count, vault_count;
  END IF;
END $$;

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Main credentials table - encrypted storage only
CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ownership. owner_id is the security boundary and is what RLS scopes on.
  -- It is filled from auth.uid() and can never be set to another user's id.
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Legacy display name. Kept for pre-auth installs and for the UI label only.
  -- NEVER use this for access control: it is user-supplied and unverified.
  user_id TEXT NOT NULL DEFAULT 'self-hosted-user',
  title TEXT NOT NULL,
  description TEXT,
  credential_type TEXT NOT NULL DEFAULT 'secret' CHECK (credential_type IN ('api_key', 'login', 'secret', 'token', 'certificate', 'document', 'misc')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  username TEXT,
  url TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Encrypted storage (all sensitive data stored here)
  secret_blob JSONB NOT NULL,
  encrypted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vault configuration table for secure key management (simplified bcrypt-only architecture)
CREATE TABLE IF NOT EXISTS vault_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL DEFAULT 'self-hosted-user', -- display label only, not a security boundary
  -- The DEK is stored ONLY wrapped: AES-GCM encrypted under a key derived from
  -- the master passphrase (Argon2id). The passphrase never reaches the server,
  -- so a full database read yields nothing usable without it.
  wrapped_dek JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One vault per authenticated account
  UNIQUE(owner_id)
);

-- Categories table for organization
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL DEFAULT 'self-hosted-user', -- display label only, not a security boundary
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique category names per account
  UNIQUE(owner_id, name)
);

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Credentials table indexes
-- owner_id is indexed because every RLS policy filters on it.
CREATE INDEX IF NOT EXISTS idx_credentials_owner_id ON credentials(owner_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_credentials_category ON credentials(category);
CREATE INDEX IF NOT EXISTS idx_credentials_created_at ON credentials(created_at);
CREATE INDEX IF NOT EXISTS idx_credentials_tags ON credentials USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_credentials_expires_at ON credentials(expires_at) WHERE expires_at IS NOT NULL;

-- Encryption-specific indexes
CREATE INDEX IF NOT EXISTS idx_credentials_encrypted ON credentials ((secret_blob IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_credentials_encrypted_at ON credentials (encrypted_at) WHERE encrypted_at IS NOT NULL;

-- Vault config indexes
CREATE INDEX IF NOT EXISTS idx_vault_config_owner_id ON vault_config(owner_id);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_owner_id ON categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- ============================================================================
-- 3. CREATE AUTOMATIC TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp (SECURE)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- CRITICAL: Set empty search path for security
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_credentials_updated_at ON credentials;
CREATE TRIGGER update_credentials_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vault_config_updated_at ON vault_config;
CREATE TRIGGER update_vault_config_updated_at
  BEFORE UPDATE ON vault_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. DROP EXISTING POLICIES (Clean slate)
-- ============================================================================

-- Drop all existing policies for clean setup
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies for credentials table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'credentials' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON credentials';
    END LOOP;
    
    -- Drop all policies for vault_config table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'vault_config' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON vault_config';
    END LOOP;
    
    -- Drop all policies for categories table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'categories' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON categories';
    END LOOP;
END $$;

-- ============================================================================
-- 6. CREATE RLS POLICIES (Self-Hosted Mode)
-- ============================================================================

-- Every policy below is scoped two ways:
--   TO authenticated  -> the anon key alone grants nothing. A request with no
--                        session never matches a policy, so it reads zero rows.
--   owner_id = auth.uid() -> an authenticated user reaches only their own rows.
--
-- auth.uid() is wrapped in a scalar subquery so Postgres evaluates it once per
-- statement instead of once per row (initplan caching).
--
-- The WITH CHECK clauses on INSERT/UPDATE are what stop a user from writing a
-- row owned by someone else, or re-assigning one of their rows to another user.

-- CREDENTIALS TABLE POLICIES
CREATE POLICY "credentials_select_policy" ON credentials
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "credentials_insert_policy" ON credentials
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "credentials_update_policy" ON credentials
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "credentials_delete_policy" ON credentials
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- VAULT_CONFIG TABLE POLICIES
-- This table holds the wrapped DEK. Even a successful read is useless without
-- the master passphrase, but it is still scoped to the owner.
CREATE POLICY "vault_config_select_policy" ON vault_config
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "vault_config_insert_policy" ON vault_config
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "vault_config_update_policy" ON vault_config
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "vault_config_delete_policy" ON vault_config
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- CATEGORIES TABLE POLICIES
CREATE POLICY "categories_select_policy" ON categories
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "categories_insert_policy" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "categories_update_policy" ON categories
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "categories_delete_policy" ON categories
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Revoke the blanket grants PostgREST hands out, so anon cannot even attempt a
-- read. RLS already blocks it; this makes the failure explicit at the grant
-- layer too, and means a future policy mistake does not silently open the door.
REVOKE ALL ON credentials, vault_config, categories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON credentials, vault_config, categories TO authenticated;

-- ============================================================================
-- 7. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get credential statistics.
-- SECURITY INVOKER on purpose: this function reads the credentials table, so it
-- must run as the caller and inherit their RLS policies. As SECURITY DEFINER it
-- would bypass RLS and hand any caller another user's statistics.
CREATE OR REPLACE FUNCTION public.get_credential_stats()
RETURNS TABLE(
  total_credentials BIGINT,
  by_type JSONB,
  by_category JSONB,
  recent_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- No session, no stats.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) as total_credentials,
    COALESCE(jsonb_object_agg(credential_type, type_count), '{}'::jsonb) as by_type,
    COALESCE(jsonb_object_agg(COALESCE(category, 'Uncategorized'), cat_count), '{}'::jsonb) as by_category,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as recent_count
  FROM (
    SELECT 
      credential_type,
      category,
      created_at,
      COUNT(*) OVER (PARTITION BY credential_type) as type_count,
      COUNT(*) OVER (PARTITION BY COALESCE(category, 'Uncategorized')) as cat_count
    FROM public.credentials  -- Fully qualified schema reference
    -- RLS already restricts this to the caller's rows; the predicate is kept as
    -- defence in depth so the function is still correct if policies change.
    WHERE owner_id = (SELECT auth.uid())
  ) stats;
END;
$$;

-- Function to check RLS configuration (SECURE)
CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count BIGINT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- CRITICAL: Set empty search path for security
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    COALESCE(c.relrowsecurity, false) as rls_enabled,
    COALESCE(p.policy_count, 0) as policy_count,
    CASE 
      WHEN COALESCE(c.relrowsecurity, false) AND COALESCE(p.policy_count, 0) >= 4 THEN '✅ OK'
      WHEN COALESCE(c.relrowsecurity, false) AND COALESCE(p.policy_count, 0) < 4 THEN '⚠️ MISSING_POLICIES'
      WHEN NOT COALESCE(c.relrowsecurity, false) THEN '❌ RLS_DISABLED'
      ELSE '❓ UNKNOWN'
    END as status
  FROM information_schema.tables t
  LEFT JOIN pg_catalog.pg_class c ON c.relname = t.table_name 
    AND c.relnamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
  LEFT JOIN (
    SELECT tablename, COUNT(*) as policy_count
    FROM pg_catalog.pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) p ON p.tablename = t.table_name
  WHERE t.table_schema = 'public' 
    AND t.table_name IN ('credentials', 'vault_config', 'categories')
    AND t.table_type = 'BASE TABLE';
END;
$$;

-- ============================================================================
-- 8. DEFAULT CATEGORIES
-- ============================================================================

-- Default categories are no longer seeded here.
--
-- Every row now needs an owner_id, and there is no authenticated session when
-- you run this script in the SQL editor, so a seed here would either fail or
-- create orphaned rows that no one can see. Keyper creates each account's
-- default categories in the app when the account is first registered.

-- ============================================================================
-- 9. ADD DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON TABLE credentials IS 'Main credentials table with end-to-end encryption support';
COMMENT ON TABLE vault_config IS 'Vault configuration for secure key management';
COMMENT ON TABLE categories IS 'Categories for organizing credentials';

COMMENT ON COLUMN credentials.owner_id IS 'Owning auth.users id. This is the RLS security boundary.';
COMMENT ON COLUMN credentials.user_id IS 'Display label only. Unverified and never used for access control.';
COMMENT ON COLUMN credentials.secret_blob IS 'Encrypted JSON blob containing all secret data';
COMMENT ON COLUMN credentials.encrypted_at IS 'Timestamp when the credential was encrypted';
COMMENT ON COLUMN vault_config.wrapped_dek IS 'DEK encrypted under an Argon2id key derived from the master passphrase. Useless without the passphrase, which never leaves the client.';

COMMENT ON FUNCTION get_credential_stats IS 'Get comprehensive statistics about stored credentials';
COMMENT ON FUNCTION check_rls_status IS 'Check Row Level Security configuration status';

-- ============================================================================
-- 10. VERIFICATION QUERIES
-- ============================================================================

-- Verify table creation
SELECT 
  table_name,
  CASE 
    WHEN table_name = ANY(ARRAY['credentials', 'vault_config', 'categories']) THEN '✅ Created'
    ELSE '❌ Missing'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('credentials', 'vault_config', 'categories')
ORDER BY table_name;

-- Verify RLS configuration
SELECT * FROM check_rls_status();

-- Verify no policy is left unconditional. Every row returned here is a hole:
-- a policy that applies to anon, or one whose predicate is literally true.
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

-- Confirm anon holds no table privileges at all.
SELECT
  table_name,
  COALESCE(string_agg(privilege_type, ', '), 'none') AS anon_privileges
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name IN ('credentials', 'vault_config', 'categories')
GROUP BY table_name;

-- =====================================================
-- 🎉 SETUP COMPLETE!
-- =====================================================
--
-- Your Keyper database is now ready with:
-- 
-- ✅ credentials, vault_config and categories tables
-- ✅ owner_id ownership column wired to auth.users
-- ✅ Performance indexes, including on every RLS predicate column
-- ✅ Row Level Security enabled AND enforced by owner-scoped policies
-- ✅ anon stripped of all table privileges
-- ✅ Automatic timestamp triggers
-- ✅ Verification queries that fail loudly if a policy is left open
--
-- NEXT STEPS:
-- 1. Turn on Email auth in your Supabase project (Authentication > Providers).
--    Keyper needs a real session now; the anon key alone will not open a vault.
-- 2. Configure your Supabase URL and anon/publishable key in Keyper.
-- 3. Create your account in the app, then set your master passphrase.
--
-- SECURITY NOTES:
-- - Use the anon/public key (NOT the service role key) in your app.
-- - The anon key is not a secret and is not a credential. On its own it now
--   reads nothing: every policy requires an authenticated session.
-- - Each account reaches only rows where owner_id = auth.uid().
-- - vault_config stores the DEK wrapped under your master passphrase. The
--   passphrase never leaves your device and is not recoverable. A full dump of
--   this database does not decrypt your secrets.
-- - Note the flip side: only secret_blob is encrypted. Titles, usernames, URLs,
--   notes and tags are stored in plaintext, so an authenticated attacker on
--   your own account still learns your credential inventory. Treat account
--   access as vault access.
--
-- SECURITY VERIFICATION:
-- Verify all functions pin their search_path. Note that SECURITY DEFINER is not
-- automatically the safe answer: get_credential_stats reads a user table and is
-- deliberately SECURITY INVOKER so it inherits the caller's RLS. Only
-- catalog-reading helpers should be DEFINER.
--
-- SELECT
--   routine_name as function_name,
--   CASE
--     WHEN prosecdef THEN 'SECURITY DEFINER (bypasses RLS)'
--     ELSE 'SECURITY INVOKER (inherits RLS)'
--   END as security_mode,
--   CASE
--     WHEN proconfig::text LIKE '%search_path%' THEN '✅ SEARCH PATH SECURED'
--     ELSE '❌ SEARCH PATH NOT SET'
--   END as search_path_status
-- FROM information_schema.routines r
-- JOIN pg_catalog.pg_proc p ON p.proname = r.routine_name
-- WHERE r.routine_schema = 'public'
--   AND r.routine_name IN ('update_updated_at_column', 'get_credential_stats', 'check_rls_status')
-- ORDER BY r.routine_name;
--
-- TROUBLESHOOTING:
-- Run these queries if you encounter issues:
-- - SELECT * FROM check_rls_status();
-- - SELECT * FROM get_credential_stats();
--
-- =====================================================
