/**
 * VaultStorage - reads and writes the vault key record.
 *
 * Rows are owned by owner_id, which is the authenticated account id and the
 * column every RLS policy scopes on. The legacy user_id column is still written
 * as a display label but carries no authority: the database ignores it for
 * access control, and so should we.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import { supabase } from '@/integrations/supabase/client';
import { requireOwnerId, ownerColumn, ownershipFields } from '@/integrations/supabase/auth';
import { isWrappedDEK, type WrappedDEK } from '@/crypto/dek';

/**
 * The vault key record as stored today.
 */
export interface VaultConfig {
  id: string;
  owner_id: string;
  user_id: string;
  wrapped_dek: WrappedDEK;
  created_at: string;
  updated_at: string;
}

/**
 * A pre-migration record whose DEK is still sitting in the database in raw,
 * directly usable form. Anything that reads one of these must migrate it.
 */
export interface LegacyRawVaultConfig {
  id: string;
  owner_id: string;
  user_id: string;
  raw_dek: string;
  created_at: string;
  updated_at: string;
}

export type AnyVaultConfig = VaultConfig | LegacyRawVaultConfig;

export function isWrappedVaultConfig(config: AnyVaultConfig): config is VaultConfig {
  return isWrappedDEK((config as VaultConfig).wrapped_dek);
}

export function isLegacyRawVaultConfig(config: AnyVaultConfig): config is LegacyRawVaultConfig {
  const raw = (config as LegacyRawVaultConfig).raw_dek;
  return typeof raw === 'string' && raw.length > 0;
}

/**
 * Get the vault config for the signed-in account.
 *
 * Returns null when there is no vault yet. Throws when there is no session,
 * because a missing session is a bug in the caller rather than an empty vault,
 * and silently returning null would look like a first-time user and prompt to
 * overwrite a vault that is actually there.
 */
export async function getVaultConfig(): Promise<AnyVaultConfig | null> {
  const ownerId = await requireOwnerId();

  // single() rather than maybeSingle(): the SQLite and Neon builders only
  // implement single(), and all three providers report "no rows" as PGRST116.
  const { data, error } = await supabase
    .from('vault_config')
    .select('*')
    .eq(ownerColumn(), ownerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No vault yet. That is a normal first-run state, not a failure.
      return null;
    }
    console.error('❌ Error getting vault config:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  // The compat wrapper unions three provider builders, so `data` arrives as
  // unknown. Narrow it once here rather than casting at every access.
  const row = data as { wrapped_dek?: unknown; raw_dek?: unknown };

  if (isWrappedDEK(row.wrapped_dek)) {
    return data as AnyVaultConfig as VaultConfig;
  }

  if (typeof row.raw_dek === 'string' && row.raw_dek.length > 0) {
    console.warn('⚠️ Legacy vault detected: key is stored raw and needs migrating');
    return data as AnyVaultConfig as LegacyRawVaultConfig;
  }

  console.warn('🚫 Vault config row exists but holds no usable key');
  return null;
}

/**
 * Persist the wrapped DEK for the signed-in account.
 *
 * onConflict targets owner_id because that is the real identity of a vault. The
 * old code upserted on user_id, which meant renaming yourself could collide with
 * or overwrite a different vault.
 */
export async function saveVaultConfig(wrappedDEK: WrappedDEK): Promise<VaultConfig> {
  const ownerId = await requireOwnerId();

  const payload = {
    ...(await ownershipFields()),
    wrapped_dek: wrappedDEK as unknown,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('vault_config')
    // The ownership column is chosen at runtime per provider, which the
    // generated row types cannot express, so the payload is cast at the call.
    .upsert(payload as never, { onConflict: ownerColumn() })
    .select()
    .single();

  if (error) {
    console.error('Error saving vault config:', error);
    throw new Error(`Failed to save vault configuration: ${error.message}`);
  }

  return data as unknown as VaultConfig;
}

/**
 * Complete the legacy migration: store the wrapped DEK and clear the raw one in
 * a single write, so we never leave a row holding both.
 */
export async function replaceRawDEKWithWrapped(wrappedDEK: WrappedDEK): Promise<void> {
  const ownerId = await requireOwnerId();

  const { error } = await supabase
    .from('vault_config')
    .update({
      wrapped_dek: wrappedDEK as unknown,
      raw_dek: null,
      bcrypt_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq(ownerColumn(), ownerId);

  if (error) {
    // Older databases may already have had the columns dropped by Stage 3 of the
    // migration. That is fine: the wrapped key is what matters.
    console.error('Error clearing legacy raw key:', error);
    throw new Error(`Failed to complete vault migration: ${error.message}`);
  }
}

/**
 * Delete the vault config for the signed-in account.
 */
export async function deleteVaultConfig(): Promise<void> {
  const ownerId = await requireOwnerId();

  const { error } = await supabase
    .from('vault_config')
    .delete()
    .eq(ownerColumn(), ownerId);

  if (error) {
    console.error('Error deleting vault config:', error);
    throw new Error(`Failed to delete vault configuration: ${error.message}`);
  }
}

/**
 * Check whether the signed-in account has a vault yet.
 */
export async function isVaultInitialized(): Promise<boolean> {
  try {
    return (await getVaultConfig()) !== null;
  } catch (error) {
    console.error('Error checking vault initialization:', error);
    return false;
  }
}
