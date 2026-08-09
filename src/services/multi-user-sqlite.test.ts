/**
 * Per-user vault isolation on the SQLite provider.
 *
 * SQLite is a local file with no sessions, so accounts here are just local
 * labels. What still has to hold, and what this test pins down, is that each
 * label gets its own vault key and that one user's passphrase cannot open
 * another user's vault.
 *
 * Uses a real SQLite database, not a mock.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { initializeSqliteDatabase, sqliteClient } from '@/integrations/database/sqlite-client';
import {
  DB_PROVIDER_KEY,
  SQLITE_DB_PATH_KEY,
  SUPABASE_USERNAME_KEY,
  saveCurrentUsername,
} from '@/integrations/supabase/client';
import { vaultManager } from '@/services/VaultManager';

function installInMemoryLocalStorage(): void {
  const store = new Map<string, string>();

  const storage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
  }
}

/**
 * Switch the active local user. clearSession() is the important half: it drops
 * any key still in memory so the next unlock genuinely has to derive it again.
 */
function switchLocalUser(username: string): void {
  saveCurrentUsername(username);
  vaultManager.clearSession();
}

describe('multi-user flow with sqlite provider', () => {
  beforeEach(async () => {
    installInMemoryLocalStorage();

    const dbName = `multi-user-sqlite-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DB_PROVIDER_KEY, 'sqlite');
    localStorage.setItem(SQLITE_DB_PATH_KEY, dbName);
    localStorage.setItem(SUPABASE_USERNAME_KEY, 'bootstrap-user');

    const result = await initializeSqliteDatabase(dbName);
    expect(result.error).toBeNull();

    switchLocalUser('bootstrap-user');
  });

  it('gives each user their own vault and default categories', async () => {
    switchLocalUser('alice');
    await vaultManager.createVault('alice-password-123');

    switchLocalUser('bob');
    await vaultManager.createVault('bob-password-456');

    const { data: vaultConfigs, error: vaultConfigError } = await sqliteClient
      .from('vault_config')
      .select('user_id')
      .order('user_id', { ascending: true });

    expect(vaultConfigError).toBeNull();
    expect((vaultConfigs as { user_id: string }[]).map((row) => row.user_id)).toEqual([
      'alice',
      'bob',
    ]);

    const { data: aliceCategories, error: categoryError } = await sqliteClient
      .from('categories')
      .select('name')
      .eq('user_id', 'alice');

    expect(categoryError).toBeNull();
    expect((aliceCategories as unknown[] | null)?.length ?? 0).toBeGreaterThan(0);
  });

  it('refuses to open a vault with another user passphrase', async () => {
    switchLocalUser('alice');
    await vaultManager.createVault('alice-password-123');

    switchLocalUser('bob');
    await vaultManager.createVault('bob-password-456');

    switchLocalUser('alice');
    await expect(vaultManager.unlockVault('alice-password-123')).resolves.toBeUndefined();

    vaultManager.lockVault();
    await expect(vaultManager.unlockVault('bob-password-456')).rejects.toThrow(
      /invalid master passphrase/i,
    );

    switchLocalUser('bob');
    await expect(vaultManager.unlockVault('bob-password-456')).resolves.toBeUndefined();
    expect(vaultManager.isUnlocked()).toBe(true);
  });

  it('stores the key wrapped, never in a directly usable form', async () => {
    switchLocalUser('alice');
    await vaultManager.createVault('alice-password-123');

    const { data } = await sqliteClient
      .from('vault_config')
      .select('*')
      .eq('user_id', 'alice')
      .single();

    const row = data as Record<string, unknown>;

    // The wrapped key is present and carries its KDF parameters.
    const wrapped = typeof row.wrapped_dek === 'string'
      ? JSON.parse(row.wrapped_dek)
      : row.wrapped_dek;

    expect(wrapped).toMatchObject({ v: 1 });
    expect(['argon2id', 'pbkdf2']).toContain(wrapped.kdf);
    expect(wrapped.salt).toBeTruthy();
    expect(wrapped.ct).toBeTruthy();

    // Nothing that shortcuts the passphrase is written any more.
    expect(row.raw_dek ?? null).toBeNull();
    expect(row.bcrypt_hash ?? null).toBeNull();

    // And the passphrase itself is nowhere in the stored row.
    expect(JSON.stringify(row)).not.toContain('alice-password-123');
  });
});
