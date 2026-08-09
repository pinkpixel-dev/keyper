/**
 * VaultManager - high-level vault operations
 *
 * Sits between the UI and the crypto/storage layers. Owns the lifecycle:
 * create a vault, unlock it, change the passphrase, migrate a legacy vault.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import { secureVault } from './SecureVault';
import {
  getVaultConfig,
  saveVaultConfig,
  deleteVaultConfig,
  replaceRawDEKWithWrapped,
  isVaultInitialized,
  isWrappedVaultConfig,
  isLegacyRawVaultConfig,
} from './VaultStorage';
import { supabase } from '@/integrations/supabase/client';
import { getOwnerId, ownershipFields } from '@/integrations/supabase/auth';
import type { VaultEvent } from './SecureVault';
import type { SecretBlobV1 } from '@/crypto/types';
import { CryptoError, CryptoErrorType } from '@/crypto/types';

export class VaultManager {
  private initialized = false;
  private initializedOwnerId: string | null = null;

  /** Set when the loaded vault still stores its key raw and needs migrating. */
  private pendingRawDEK: string | null = null;

  /**
   * Load the vault config for the signed-in account.
   *
   * This never unlocks anything. Loading a wrapped key tells us a vault exists;
   * only a correct passphrase can open it.
   */
  async initialize(): Promise<void> {
    const ownerId = await getOwnerId();

    if (this.initialized && this.initializedOwnerId === ownerId) {
      return;
    }

    // Switching accounts must not leave the previous account's key in memory.
    if (this.initializedOwnerId && this.initializedOwnerId !== ownerId) {
      secureVault.resetConfiguration();
      this.pendingRawDEK = null;
    }

    if (!ownerId) {
      this.initialized = false;
      this.initializedOwnerId = null;
      return;
    }

    try {
      const config = await getVaultConfig();
      this.pendingRawDEK = null;

      if (config && isWrappedVaultConfig(config)) {
        await secureVault.initializeWithWrappedDEK(config.wrapped_dek);
      } else if (config && isLegacyRawVaultConfig(config)) {
        // Hold the raw key aside. It is migrated on the next successful unlock,
        // which is the first moment we actually have the passphrase.
        console.warn('⚠️ Vault still stores its key raw; it will be migrated on unlock');
        this.pendingRawDEK = config.raw_dek;
      } else {
        secureVault.resetConfiguration();
      }

      this.initialized = true;
      this.initializedOwnerId = ownerId;
    } catch (error) {
      console.error('Error initializing vault manager:', error);
      throw error;
    }
  }

  /**
   * True when the signed-in account has no vault yet.
   */
  async isFirstTimeUser(): Promise<boolean> {
    try {
      await this.initialize();
      return !(await isVaultInitialized());
    } catch (error) {
      console.error('Error checking first-time user status:', error);
      // Do NOT assume first-time on error. Saying "you're new" to someone whose
      // vault simply failed to load invites them to overwrite real data.
      throw error;
    }
  }

  /**
   * Whether the loaded vault predates wrapped key storage.
   */
  hasPendingMigration(): boolean {
    return this.pendingRawDEK !== null;
  }

  /**
   * Create a vault for the signed-in account and leave it unlocked.
   */
  async createVault(masterPassphrase: string): Promise<void> {
    await this.initialize();

    if (await isVaultInitialized()) {
      throw new Error('A vault already exists for this account.');
    }

    const wrapped = await secureVault.createNewVault(masterPassphrase);
    await saveVaultConfig(wrapped);
    await this.createDefaultCategories();
  }

  /**
   * Unlock the vault with the master passphrase.
   *
   * If the vault still stores its key raw, this is also where it gets migrated:
   * the passphrase is only available at unlock time, and we need it to wrap the
   * key. The DEK is unchanged, so nothing is re-encrypted.
   */
  async unlockVault(masterPassphrase: string): Promise<void> {
    await this.initialize();

    try {
      if (this.pendingRawDEK) {
        const wrapped = await secureVault.migrateFromRawDEK(this.pendingRawDEK, masterPassphrase);
        await replaceRawDEKWithWrapped(wrapped);
        this.pendingRawDEK = null;
        console.log('✅ Vault migrated to wrapped key storage');
        return;
      }

      if (!secureVault.getWrappedDEK()) {
        throw new CryptoError(
          CryptoErrorType.VAULT_NOT_INITIALIZED,
          'Vault not initialized. Please set up encryption first.',
        );
      }

      await secureVault.unlock(masterPassphrase);
    } catch (error) {
      if (error instanceof CryptoError) {
        if (error.type === CryptoErrorType.INVALID_PASSPHRASE) {
          throw new Error('Invalid master passphrase. Please try again.');
        }
        if (error.type === CryptoErrorType.VAULT_NOT_INITIALIZED) {
          throw new Error('Vault not initialized. Please set up encryption first.');
        }
      }
      throw error;
    }
  }

  /**
   * Change the master passphrase.
   *
   * Re-wraps the same DEK, so existing credentials stay readable and nothing is
   * re-encrypted. Requires the current passphrase; there is no way to change it
   * without one, by design.
   */
  async changePassphrase(currentPassphrase: string, newPassphrase: string): Promise<void> {
    await this.initialize();

    if (this.pendingRawDEK) {
      throw new Error('Unlock your vault once to finish migrating it before changing your passphrase.');
    }

    try {
      const rewrapped = await secureVault.changePassphrase(currentPassphrase, newPassphrase);
      await saveVaultConfig(rewrapped);
    } catch (error) {
      if (error instanceof CryptoError && error.type === CryptoErrorType.INVALID_PASSPHRASE) {
        throw new Error('Current master passphrase is incorrect.');
      }
      throw error;
    }
  }

  /**
   * Check a passphrase without unlocking.
   */
  async testPassphrase(passphrase: string): Promise<boolean> {
    await this.initialize();
    return secureVault.testPassphrase(passphrase);
  }

  lockVault(): void {
    secureVault.lock();
  }

  isUnlocked(): boolean {
    return secureVault.isUnlocked();
  }

  async encrypt(plaintext: string): Promise<SecretBlobV1> {
    return secureVault.encrypt(plaintext);
  }

  async decrypt(blob: SecretBlobV1): Promise<string> {
    return secureVault.decrypt(blob);
  }

  /**
   * Delete the vault key.
   *
   * This is destructive and unrecoverable: without the wrapped key, existing
   * credential rows can never be decrypted again. Callers must confirm first.
   */
  async resetVault(): Promise<void> {
    secureVault.resetConfiguration();
    await deleteVaultConfig();

    this.pendingRawDEK = null;
    this.initialized = false;
    this.initializedOwnerId = null;
  }

  /**
   * Drop all in-memory vault state, e.g. on sign-out or account switch.
   */
  clearSession(): void {
    secureVault.resetConfiguration();
    this.pendingRawDEK = null;
    this.initialized = false;
    this.initializedOwnerId = null;
  }

  addEventListener(listener: (event: VaultEvent) => void): void {
    secureVault.addEventListener(listener);
  }

  removeEventListener(listener: (event: VaultEvent) => void): void {
    secureVault.removeEventListener(listener);
  }

  setAutoLockTimeout(timeoutMs: number): void {
    secureVault.setAutoLockTimeout(timeoutMs);
  }

  getTimeUntilAutoLock(): number {
    return secureVault.getTimeUntilAutoLock();
  }

  /**
   * Seed default categories for a newly created vault.
   *
   * Best effort. Categories are convenience, not data integrity, so a failure
   * here must not block vault creation.
   */
  private async createDefaultCategories(): Promise<void> {
    const defaultCategories = [
      { name: 'Development', color: '#3b82f6', icon: 'code', description: 'Development tools and APIs' },
      { name: 'Personal', color: '#10b981', icon: 'user', description: 'Personal accounts and services' },
      { name: 'Work', color: '#f59e0b', icon: 'briefcase', description: 'Work-related credentials' },
      { name: 'Social Media', color: '#ec4899', icon: 'users', description: 'Social media accounts' },
      { name: 'Finance', color: '#06b6d4', icon: 'credit-card', description: 'Banking and financial services' },
      { name: 'Cloud Services', color: '#8b5cf6', icon: 'cloud', description: 'Cloud platforms and services' },
      { name: 'Security', color: '#ef4444', icon: 'shield', description: 'Security tools and certificates' },
    ];

    try {
      const ownership = await ownershipFields();

      for (const category of defaultCategories) {
        await supabase.from('categories').insert({ ...ownership, ...category });
      }
    } catch (error) {
      console.error('⚠️ Could not create default categories:', error);
    }
  }
}

// Export singleton instance
export const vaultManager = new VaultManager();
export default vaultManager;
