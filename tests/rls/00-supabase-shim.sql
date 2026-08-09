-- Minimal stand-in for the parts of Supabase that supabase-setup.sql depends on.
-- Lets us run the real shipped setup file against a plain Postgres and then
-- exercise the policies as anon and as two different authenticated users.

CREATE SCHEMA IF NOT EXISTS auth;

-- Supabase's auth.users, reduced to what we reference.
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE
);

-- Supabase derives auth.uid() from the "sub" claim of the request JWT, which
-- PostgREST puts into the request.jwt.claims GUC. Same contract here.
-- Mirrors Supabase's real definition: nullif the raw GUC BEFORE casting to
-- jsonb, so an unset or empty claims string yields NULL rather than a cast error.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

-- The two PostgREST roles that matter for these policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

-- Mirror the blanket grant Supabase hands out by default. supabase-setup.sql is
-- expected to revoke this for anon; if it does not, the tests must fail.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- Two accounts to test isolation between.
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com')
ON CONFLICT (id) DO NOTHING;
