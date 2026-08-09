/**
 * DEK wrapping and unwrapping.
 *
 * The vault uses two keys:
 *   DEK  Data Encryption Key. Random 256-bit AES-GCM key that encrypts every
 *        credential. Never leaves memory in usable form.
 *   KEK  Key Encryption Key. Derived from the master passphrase with Argon2id
 *        (PBKDF2 fallback) and used only to wrap the DEK.
 *
 * The server stores the wrapped DEK and nothing else about the key. Without the
 * passphrase, a full database dump is inert: there is no stored value that can
 * be turned into the DEK. This is what makes the zero-knowledge claim true.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import { deriveKey, deriveKeyForKdf } from './crypto';
import { bufToBase64, base64ToBuf, randomBytes } from './encoding';
import { CryptoError, CryptoErrorType } from './types';

const IV_LENGTH = 12;   // 96-bit IV for AES-GCM
const SALT_LENGTH = 16; // 128-bit KDF salt
const DEK_LENGTH = 32;  // 256-bit DEK

/**
 * The DEK as stored on the server: AES-GCM ciphertext of the raw DEK bytes,
 * plus the KDF salt and IV needed to reconstruct the KEK. Contains no
 * passphrase material and no key material usable on its own.
 */
export interface WrappedDEK {
  v: 1;
  kdf: 'argon2id' | 'pbkdf2';
  salt: string; // base64, KDF salt
  iv: string;   // base64, AES-GCM IV
  ct: string;   // base64, encrypted DEK bytes
}

/**
 * Shape check for values coming back from the database, which are typed as
 * loose JSON. A malformed wrapped DEK should fail here rather than surfacing as
 * a confusing decrypt error later.
 */
export function isWrappedDEK(value: unknown): value is WrappedDEK {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WrappedDEK>;
  return (
    candidate.v === 1 &&
    (candidate.kdf === 'argon2id' || candidate.kdf === 'pbkdf2') &&
    typeof candidate.salt === 'string' && candidate.salt.length > 0 &&
    typeof candidate.iv === 'string' && candidate.iv.length > 0 &&
    typeof candidate.ct === 'string' && candidate.ct.length > 0
  );
}

/**
 * Generate a fresh random DEK.
 */
export function generateDEKBytes(): Uint8Array {
  return randomBytes(DEK_LENGTH);
}

/**
 * Wrap raw DEK bytes under a key derived from the passphrase.
 *
 * A fresh salt and IV are generated on every call, so re-wrapping the same DEK
 * under the same passphrase produces different ciphertext. That is intended.
 */
export async function wrapDEK(dekBytes: Uint8Array, passphrase: string): Promise<WrappedDEK> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const { key: kek, kdf } = await deriveKey(passphrase, salt);

  // randomBytes is typed as Uint8Array<ArrayBufferLike>, which the DOM crypto
  // types will not accept as a BufferSource. The bytes are correct; only the
  // ArrayBuffer/SharedArrayBuffer distinction in the lib types is in the way.
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    kek,
    dekBytes as unknown as BufferSource,
  );

  return {
    v: 1,
    kdf,
    salt: bufToBase64(salt.buffer as ArrayBuffer),
    iv: bufToBase64(iv.buffer as ArrayBuffer),
    ct: bufToBase64(ciphertext),
  };
}

/**
 * Recover raw DEK bytes from a wrapped DEK.
 *
 * AES-GCM is authenticated, so a wrong passphrase fails the tag check rather
 * than returning garbage. That failure IS the passphrase check: there is no
 * separate stored hash to verify against, and none is needed.
 */
export async function unwrapDEK(wrapped: WrappedDEK, passphrase: string): Promise<Uint8Array> {
  if (!isWrappedDEK(wrapped)) {
    throw new CryptoError(
      CryptoErrorType.VAULT_NOT_INITIALIZED,
      'Stored vault key is malformed or missing.',
    );
  }

  const salt = new Uint8Array(base64ToBuf(wrapped.salt));
  const iv = new Uint8Array(base64ToBuf(wrapped.iv));
  const ciphertext = base64ToBuf(wrapped.ct);

  // The wrapper records the KDF used at encryption time. Honor it exactly:
  // choosing a runtime-dependent fallback here derives a different key and
  // makes the correct passphrase look invalid across browser or desktop builds.
  const kek = await deriveKeyForKdf(passphrase, salt, wrapped.kdf);

  try {
    const dekBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, ciphertext);
    return new Uint8Array(dekBytes);
  } catch {
    throw new CryptoError(
      CryptoErrorType.INVALID_PASSPHRASE,
      'Invalid master passphrase.',
    );
  }
}

/**
 * Verify a passphrase without keeping the DEK around.
 */
export async function verifyPassphraseAgainstDEK(
  wrapped: WrappedDEK,
  passphrase: string,
): Promise<boolean> {
  try {
    const dekBytes = await unwrapDEK(wrapped, passphrase);
    dekBytes.fill(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-wrap an existing DEK under a new passphrase.
 *
 * Used both for changing the passphrase and for migrating a legacy vault whose
 * DEK was stored raw. The DEK itself is unchanged, so nothing needs
 * re-encrypting and every existing credential still decrypts.
 */
export async function rewrapDEK(
  dekBytes: Uint8Array,
  newPassphrase: string,
): Promise<WrappedDEK> {
  return wrapDEK(dekBytes, newPassphrase);
}

/**
 * Import raw DEK bytes as a non-extractable AES-GCM key.
 *
 * Non-extractable means script running in the page cannot read the key back out
 * of the CryptoKey, so an XSS bug cannot exfiltrate it directly. Re-wrapping on
 * passphrase change deliberately goes back to the wrapped DEK and unwraps again
 * rather than exporting this key, so extractability is never needed.
 */
export async function importDEK(dekBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    dekBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Decode a legacy base64 raw DEK from the pre-migration schema.
 */
export function decodeLegacyRawDEK(rawDEK: string): Uint8Array {
  const bytes = new Uint8Array(base64ToBuf(rawDEK));
  if (bytes.length !== DEK_LENGTH) {
    throw new CryptoError(
      CryptoErrorType.VAULT_NOT_INITIALIZED,
      `Legacy DEK has unexpected length ${bytes.length}, expected ${DEK_LENGTH}.`,
    );
  }
  return bytes;
}
