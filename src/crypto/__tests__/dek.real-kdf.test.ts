/**
 * DEK wrapping against a real, unmocked key derivation function.
 *
 * The shared test setup mocks argon2-browser with a fast SHA-256 stand-in so the
 * rest of the suite stays quick. That is fine for exercising logic, but it means
 * no other test ever proves the wrap survives a genuine memory-hard-style KDF
 * round trip. Here we force the PBKDF2 fallback, which is real WebCrypto at the
 * full 310k iterations, and check the whole path end to end.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import { describe, it, expect, vi } from 'vitest';

// Make the argon2 import fail so deriveKey falls back to real PBKDF2.
vi.mock('argon2-browser/dist/argon2-bundled.min.js', () => {
  throw new Error('not supported');
});

const { generateDEKBytes, wrapDEK, unwrapDEK, importDEK } = await import('../dek');
const { CryptoErrorType } = await import('../types');

const PASSPHRASE = 'a genuinely long master passphrase';

describe('DEK wrapping with real PBKDF2', () => {
  it('records the KDF actually used', async () => {
    const wrapped = await wrapDEK(generateDEKBytes(), PASSPHRASE);
    expect(wrapped.kdf).toBe('pbkdf2');
  });

  it('round-trips through real key derivation', async () => {
    const dek = generateDEKBytes();
    const wrapped = await wrapDEK(dek, PASSPHRASE);

    expect(Array.from(await unwrapDEK(wrapped, PASSPHRASE))).toEqual(Array.from(dek));
  });

  it('rejects a wrong passphrase under real key derivation', async () => {
    const wrapped = await wrapDEK(generateDEKBytes(), PASSPHRASE);

    await expect(unwrapDEK(wrapped, 'a different long passphrase')).rejects.toMatchObject({
      type: CryptoErrorType.INVALID_PASSPHRASE,
    });
  });

  it('protects real ciphertext end to end', async () => {
    const dek = generateDEKBytes();
    const wrapped = await wrapDEK(dek, PASSPHRASE);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await importDEK(dek),
      new TextEncoder().encode('sk-live-not-a-real-key'),
    );

    const recovered = await importDEK(await unwrapDEK(wrapped, PASSPHRASE));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, recovered, ciphertext);

    expect(new TextDecoder().decode(plaintext)).toBe('sk-live-not-a-real-key');
  });
});
