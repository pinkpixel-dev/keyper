/**
 * Guards on the shipped SQL setup scripts.
 *
 * Two jobs here. The first is the original one: keep the Neon and Supabase
 * schemas from drifting apart. The second matters more: fail the build if the
 * unconditional RLS policies ever come back, or if plaintext key material
 * reappears in the schema.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSql(file: string): string {
  return readFileSync(file, 'utf8');
}

const neonSql = readSql('sql/neon-setup.sql');
const supabaseSql = readSql('sql/supabase-setup.sql');
const migrationSql = ['02-claim-your-data.sql', '05-remove-old-key.sql']
  .map((f) => readSql(`migration/${f}`))
  .join('\n');

/** Strip SQL line comments so prose about a pattern never satisfies a check. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

describe('shared schema shape', () => {
  const requiredFragments = [
    'CREATE TABLE IF NOT EXISTS credentials',
    'CREATE TABLE IF NOT EXISTS vault_config',
    'CREATE TABLE IF NOT EXISTS categories',
    'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    'user_id TEXT NOT NULL DEFAULT',
    'credential_type TEXT NOT NULL DEFAULT',
    'priority TEXT NOT NULL DEFAULT',
    'tags TEXT[] DEFAULT',
    'secret_blob JSONB NOT NULL',
    'encrypted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
    'wrapped_dek JSONB',
    'CREATE INDEX IF NOT EXISTS idx_credentials_tags ON credentials USING GIN(tags)',
    'ALTER TABLE credentials ENABLE ROW LEVEL SECURITY',
    'CREATE OR REPLACE FUNCTION public.update_updated_at_column()',
  ];

  it.each(requiredFragments)('both scripts contain %s', (fragment) => {
    expect(neonSql).toContain(fragment);
    expect(supabaseSql).toContain(fragment);
  });

  it('keeps pgcrypto for the Neon script', () => {
    expect(neonSql).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  });
});

describe('no plaintext key material in the schema', () => {
  // raw_dek held the DEK in directly usable form and bcrypt_hash held an
  // offline-crackable hash of the master passphrase. Neither should be created
  // by a fresh install ever again.
  it.each([
    ['supabase-setup.sql', supabaseSql],
    ['neon-setup.sql', neonSql],
  ])('%s does not create raw_dek or bcrypt_hash columns', (_name, sql) => {
    const schema = stripComments(sql);
    expect(schema).not.toMatch(/raw_dek\s+TEXT/i);
    expect(schema).not.toMatch(/bcrypt_hash\s+TEXT/i);
  });

  it('the migration still references them, since it has to clean them up', () => {
    expect(migrationSql).toContain('raw_dek');
    expect(migrationSql).toContain('bcrypt_hash');
  });
});

describe('Supabase RLS policies are scoped', () => {
  const policyLines = stripComments(supabaseSql)
    .split(';')
    .map((statement) => statement.trim().replace(/\s+/g, ' '))
    .filter((statement) => statement.toUpperCase().startsWith('CREATE POLICY'));

  it('creates a policy for every table and operation', () => {
    // 3 tables x 4 operations.
    expect(policyLines).toHaveLength(12);
  });

  it.each(['credentials', 'vault_config', 'categories'])(
    'scopes every %s policy to the authenticated owner',
    (table) => {
      const tablePolicies = policyLines.filter((line) => line.includes(`ON ${table}`));
      expect(tablePolicies).toHaveLength(4);

      for (const policy of tablePolicies) {
        // The anon key alone must never match a policy.
        expect(policy).toContain('TO authenticated');
        // And the predicate must compare against the caller, not be a constant.
        expect(policy).toContain('owner_id = (SELECT auth.uid())');
      }
    },
  );

  it('contains no unconditional USING (true) or WITH CHECK (true)', () => {
    for (const policy of policyLines) {
      expect(policy).not.toMatch(/USING\s*\(\s*true\s*\)/i);
      expect(policy).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/i);
    }
  });

  it('revokes anon privileges outright', () => {
    expect(supabaseSql).toContain('REVOKE ALL ON credentials, vault_config, categories FROM anon');
  });

  it('does not expose credential stats through a SECURITY DEFINER function', () => {
    // SECURITY DEFINER on a function that reads user tables bypasses RLS.
    const statsFunction = supabaseSql.slice(
      supabaseSql.indexOf('FUNCTION public.get_credential_stats()'),
    );
    const body = statsFunction.slice(0, statsFunction.indexOf('$$;'));

    expect(body).toContain('SECURITY INVOKER');
    expect(body).not.toContain('SECURITY DEFINER');
  });
});

describe('Neon script is honest about what it cannot enforce', () => {
  it('creates no permissive policies', () => {
    const policies = stripComments(neonSql).match(/CREATE POLICY/gi) ?? [];
    expect(policies).toHaveLength(0);
  });

  it('warns that the connection string is a full database credential', () => {
    // The warning is a wrapped comment block, so collapse whitespace and drop
    // the leading comment markers before matching on the prose.
    const prose = neonSql.replace(/^\s*--\s?/gm, '').replace(/\s+/g, ' ');

    expect(prose).toContain('full database credential');
    expect(prose).toMatch(/table owners bypass RLS/i);
  });
});
