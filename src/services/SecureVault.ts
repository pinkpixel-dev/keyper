/**
 * SecureVault - passphrase-wrapped encryption system
 *
 * Architecture:
 * - DEK (Data Encryption Key): random 256-bit key that encrypts all secrets
 * - Master passphrase: derives a KEK (Argon2id, PBKDF2 fallback) that wraps the DEK
 * - Server sees: ciphertexts + the wrapped DEK, and nothing else
 * - Unlock: derive KEK from passphrase -> unwrap DEK -> decrypt secrets
 * - Lock: drop the DEK from memory
 *
 * The passphrase never leaves the device and is never stored in any form, so a
 * full read of the database does not decrypt anything. The flip side is that a
 * forgotten passphrase cannot be recovered by anyone, including us.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import {
  generateDEKBytes,
  wrapDEK,
  unwrapDEK,
  importDEK,
  decodeLegacyRawDEK,
  verifyPassphraseAgainstDEK,
  type WrappedDEK,
} from '@/crypto/dek';
import type { SecretBlobV1 } from '@/crypto/types';
import { CryptoError, CryptoErrorType } from '@/crypto/types';
import { bufToBase64, base64ToBuf } from '@/crypto/encoding';
import { securityLogger, logVaultUnlock, logEncryptionOperation } from '@/security/SecurityAuditLogger';

export type { WrappedDEK } from '@/crypto/dek';

/**
 * Event types for vault state changes
 */
export type VaultEvent = 'locked' | 'unlocked' | 'auto-locked';

/**
 * Vault event listener function
 */
export type VaultEventListener = (event: VaultEvent) => void;

class SecureVault {
  private dek: CryptoKey | null = null;          // in memory only, non-extractable
  private wrappedDEK: WrappedDEK | null = null;  // safe to persist
  private autoLockTimeoutMs: number = 15 * 60 * 1000;
  private autoLockTimer: NodeJS.Timeout | null = null;
  private lastActivity: Date | null = null;
  private listeners: VaultEventListener[] = [];

  /**
   * Load an existing wrapped DEK. This does not unlock anything on its own:
   * the vault stays locked until a passphrase successfully unwraps it.
   */
  async initializeWithWrappedDEK(wrappedDEK: WrappedDEK): Promise<void> {
    console.log('🔧 Loading wrapped vault key:', { version: wrappedDEK.v, kdf: wrappedDEK.kdf });
    this.wrappedDEK = wrappedDEK;
  }

  /**
   * Create a brand new vault. Generates a fresh DEK, wraps it under the
   * passphrase, and leaves the vault unlocked. The caller persists the returned
   * wrapped DEK.
   */
  async createNewVault(masterPassphrase: string): Promise<WrappedDEK> {
    const startTime = performance.now();

    try {
      console.log('🔧 Creating new vault...');

      const dekBytes = generateDEKBytes();
      const wrapped = await wrapDEK(dekBytes, masterPassphrase);

      this.dek = await importDEK(dekBytes);
      this.wrappedDEK = wrapped;
      dekBytes.fill(0);

      this.lastActivity = new Date();
      this.resetAutoLockTimer();

      logVaultUnlock(true, performance.now() - startTime);
      this.notifyListeners('unlocked');

      console.log('✅ New vault created');
      return wrapped;
    } catch (error) {
      logVaultUnlock(false, performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Unlock the vault by unwrapping the DEK with the master passphrase.
   *
   * There is no separate passphrase check. AES-GCM is authenticated, so a wrong
   * passphrase fails the tag verification and we surface that as an invalid
   * passphrase. That is the check.
   */
  async unlock(masterPassphrase: string): Promise<void> {
    const startTime = performance.now();
    console.log('🔓 Unlocking vault...');

    try {
      if (!this.wrappedDEK) {
        throw new CryptoError(
          CryptoErrorType.VAULT_NOT_INITIALIZED,
          'Vault not initialized - no wrapped key found',
        );
      }

      const dekBytes = await unwrapDEK(this.wrappedDEK, masterPassphrase);
      this.dek = await importDEK(dekBytes);
      dekBytes.fill(0);

      this.lastActivity = new Date();
      this.resetAutoLockTimer();

      logVaultUnlock(true, performance.now() - startTime);
      this.notifyListeners('unlocked');
      console.log('🎉 Vault unlocked');
    } catch (error) {
      logVaultUnlock(false, performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Migrate a legacy vault whose DEK was stored raw in the database.
   *
   * The DEK itself is kept, so nothing needs re-encrypting and every existing
   * credential still decrypts. Only the way the key is stored changes. The
   * caller persists the returned wrapped DEK and clears the raw column.
   */
  async migrateFromRawDEK(rawDEK: string, masterPassphrase: string): Promise<WrappedDEK> {
    console.log('🔄 Migrating legacy raw key to wrapped storage...');

    const dekBytes = decodeLegacyRawDEK(rawDEK);
    const wrapped = await wrapDEK(dekBytes, masterPassphrase);

    this.dek = await importDEK(dekBytes);
    this.wrappedDEK = wrapped;
    dekBytes.fill(0);

    this.lastActivity = new Date();
    this.resetAutoLockTimer();
    this.notifyListeners('unlocked');

    console.log('✅ Legacy key migrated to wrapped storage');
    return wrapped;
  }

  /**
   * Re-wrap the DEK under a new passphrase.
   *
   * Requires the current passphrase, which is used to unwrap the DEK again
   * rather than exporting the in-memory key. That keeps the live DEK
   * non-extractable. The caller persists the returned wrapped DEK.
   */
  async changePassphrase(currentPassphrase: string, newPassphrase: string): Promise<WrappedDEK> {
    if (!this.wrappedDEK) {
      throw new CryptoError(
        CryptoErrorType.VAULT_NOT_INITIALIZED,
        'Vault not initialized - nothing to re-wrap',
      );
    }

    const dekBytes = await unwrapDEK(this.wrappedDEK, currentPassphrase);
    const rewrapped = await wrapDEK(dekBytes, newPassphrase);

    this.dek = await importDEK(dekBytes);
    this.wrappedDEK = rewrapped;
    dekBytes.fill(0);

    securityLogger.logEvent('vault_passphrase_change', 'info', 'Master passphrase changed');
    return rewrapped;
  }

  /**
   * Check a passphrase without changing vault state.
   */
  async testPassphrase(passphrase: string): Promise<boolean> {
    if (!this.wrappedDEK) return false;
    return verifyPassphraseAgainstDEK(this.wrappedDEK, passphrase);
  }

  isUnlocked(): boolean {
    return this.dek !== null;
  }

  /**
   * Lock the vault. Dropping the CryptoKey reference is the most we can do in
   * JS; the key was non-extractable, so it was never readable from script.
   */
  lock(): void {
    if (this.dek) {
      this.dek = null;
      this.clearAutoLockTimer();
      this.lastActivity = null;

      securityLogger.logEvent('vault_lock', 'info', 'Vault locked');
      this.notifyListeners('locked');
    }
  }

  /**
   * Clear all vault material so another account can be loaded safely.
   */
  resetConfiguration(): void {
    this.lock();
    this.wrappedDEK = null;
  }

  /**
   * Encrypt data using the DEK
   */
  async encrypt(plaintext: string): Promise<SecretBlobV1> {
    if (!this.dek) {
      throw new CryptoError(CryptoErrorType.VAULT_LOCKED, 'Vault is locked');
    }

    this.updateActivity();
    const startTime = performance.now();

    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.dek,
        new TextEncoder().encode(plaintext),
      );

      logEncryptionOperation('encrypt', true, performance.now() - startTime);

      return {
        v: 1,
        // Credentials are encrypted directly under the DEK, so no derivation
        // happens here and there is no per-blob salt. We record the KDF that
        // protects the DEK itself, since that is what actually stands between
        // this ciphertext and an attacker, and it is what the UI reports.
        kdf: this.wrappedDEK?.kdf ?? 'pbkdf2',
        salt: '',
        iv: bufToBase64(iv.buffer as ArrayBuffer),
        ct: bufToBase64(ciphertext),
      };
    } catch (error) {
      logEncryptionOperation('encrypt', false, performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Decrypt data using the DEK
   */
  async decrypt(blob: SecretBlobV1): Promise<string> {
    if (!this.dek) {
      throw new CryptoError(CryptoErrorType.VAULT_LOCKED, 'Vault is locked');
    }

    this.updateActivity();
    const startTime = performance.now();

    try {
      const iv = new Uint8Array(base64ToBuf(blob.iv));
      const plaintextBytes = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.dek,
        base64ToBuf(blob.ct),
      );

      logEncryptionOperation('decrypt', true, performance.now() - startTime);
      return new TextDecoder().decode(plaintextBytes);
    } catch (error) {
      logEncryptionOperation('decrypt', false, performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Get the wrapped DEK for persistence. Safe to send to the server.
   */
  getWrappedDEK(): WrappedDEK | null {
    return this.wrappedDEK;
  }

  private updateActivity(): void {
    this.lastActivity = new Date();
    this.resetAutoLockTimer();
  }

  private resetAutoLockTimer(): void {
    this.clearAutoLockTimer();

    if (this.autoLockTimeoutMs > 0) {
      this.autoLockTimer = setTimeout(() => {
        this.lock();
        this.notifyListeners('auto-locked');
      }, this.autoLockTimeoutMs);
    }
  }

  private clearAutoLockTimer(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  private notifyListeners(event: VaultEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in vault event listener:', error);
      }
    });
  }

  addEventListener(listener: VaultEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: VaultEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  setAutoLockTimeout(timeoutMs: number): void {
    this.autoLockTimeoutMs = timeoutMs;
    if (this.isUnlocked()) {
      this.resetAutoLockTimer();
    }
  }

  getTimeUntilAutoLock(): number {
    if (!this.lastActivity || this.autoLockTimeoutMs <= 0) {
      return 0;
    }

    const elapsed = Date.now() - this.lastActivity.getTime();
    return Math.max(0, this.autoLockTimeoutMs - elapsed);
  }
}

// Export singleton instance
export const secureVault = new SecureVault();
export default secureVault;
