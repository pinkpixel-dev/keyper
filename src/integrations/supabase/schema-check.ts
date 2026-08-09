/**
 * Detects a database that predates the v1.3.0 security migration.
 *
 * Upgrading the app without running migration-auth-rls.sql leaves the client
 * asking for an owner_id column that does not exist yet. Without this check the
 * user sees a generic "could not reach your vault" error on a vault full of
 * credentials, which reads like data loss and invites exactly the wrong
 * reaction: re-running the setup script over live data.
 *
 * The probe runs before sign-in on purpose. On an un-migrated database the old
 * USING (true) policies still let the anon key read vault_config, so we can
 * diagnose the problem without a session, and we should: telling someone to
 * create an account first, only to fail afterwards, wastes their time.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import { supabase } from './client';
import { getDatabaseProvider } from './client';

/** Postgres: column does not exist. The one unambiguous signal we act on. */
const UNDEFINED_COLUMN = '42703';

export type SchemaState =
  /** Schema is current, or we have no reason to think otherwise. */
  | 'ok'
  /** owner_id is missing. migration-auth-rls.sql Stage 1 has not been run. */
  | 'needs-migration'
  /** Could not reach the database at all. Not a schema problem. */
  | 'unreachable';

export interface SchemaCheckResult {
  state: SchemaState;
  /** Raw error text, shown only in the details disclosure. */
  detail?: string;
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

/**
 * Check whether this database has the v1.3.0 ownership column.
 *
 * Deliberately fails open. Only an explicit "column does not exist" routes the
 * user to the migration screen; anything else returns 'ok' and lets the normal
 * flow produce its own, more specific error. A false positive here would block
 * a perfectly healthy vault behind a scary migration wall, which is worse than
 * the generic error we are replacing.
 */
export async function checkSchemaState(): Promise<SchemaCheckResult> {
  // Only Supabase has an owner_id column. The local providers still use the
  // user_id text column and are never queried for owner_id.
  if (getDatabaseProvider() !== 'supabase') {
    return { state: 'ok' };
  }

  try {
    const { error } = await supabase.from('vault_config').select('owner_id').limit(1);

    if (error && errorCode(error) === UNDEFINED_COLUMN) {
      return { state: 'needs-migration', detail: errorMessage(error) };
    }

    // Any other error is someone else's problem to report precisely:
    // permission denied means the new policies are working and anon is
    // correctly locked out, which is a healthy database, not a broken one.
    return { state: 'ok' };
  } catch (error) {
    // Network failure, bad URL, project paused. Not a schema issue.
    return { state: 'unreachable', detail: errorMessage(error) };
  }
}
