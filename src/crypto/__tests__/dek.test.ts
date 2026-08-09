/**
 * Tests for DEK wrapping.
 *
 * These run against real WebCrypto, not mocks. The point of this module is that
 * the server never holds anything that decrypts the vault, so the tests are
 * written to fail loudly if raw key material ever leaks into the wrapped form.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import { describe, it, expect } from 'vitest';
import {
  generateDEKBytes,
  wrapDEK,
  unwrapDEK,
  rewrapDEK,
  importDEK,
  isWrappedDEK,
  verifyPassphraseAgainstDEK,
  decodeLegacyRawDEK,
} from '../dek';
import { bufToBase64 } from '../encoding';
import { CryptoError, CryptoErrorType } from '../types';

const PASSPHRASE = 'correct horse battery staple';
const WRONG_PASSPHRASE = 'incorrect horse battery staple';

describe('generateDEKBytes', () => {
  it('produces a 256-bit key', () => {
    expect(generateDEKBytes()).toHaveLength(32);
  });

  it('produces a different key every time', () => {
    const a = bufToBase64(generateDEKBytes().buffer as ArrayBuffer);
    const b = bufToBase64(generateDEKBytes().buffer as ArrayBuffer);
    expect(a).not.toBe(b);
  });
});

describe('wrapDEK / unwrapDEK', () => {
  it('round-trips the DEK with the correct passphrase', async () => {
    const dek = generateDEKBytes();
    const wrapped = await wrapDEK(dek, PASSPHRASE);
    const recovered = await unwrapDEK(wrapped, PASSPHRASE);

    expect(Array.from(recovered)).toEqual(Array.from(dek));
  });

  it('honors a stored PBKDF2 marker when Argon2id is available', async () => {
    const dek = generateDEKBytes();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(PASSPHRASE),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const pbkdf2Key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, pbkdf2Key, dek);
    const wrapped = {
      v: 1 as const,
      kdf: 'pbkdf2' as const,
      salt: bufToBase64(salt.buffer as ArrayBuffer),
      iv: bufToBase64(iv.buffer as ArrayBuffer),
      ct: bufToBase64(ciphertext),
    };

    expect(Array.from(await unwrapDEK(wrapped, PASSPHRASE))).toEqual(Array.from(dek));
    await expect(unwrapDEK(wrapped, WRONG_PASSPHRASE)).rejects.toMatchObject({
      type: CryptoErrorType.INVALID_PASSPHRASE,
    });
  });

  it('rejects the wrong passphrase instead of returning garbage', async () => {
    const wrapped = await wrapDEK(generateDEKBytes(), PASSPHRASE);

    await expect(unwrapDEK(wrapped, WRONG_PASSPHRASE)).rejects.toThrow(CryptoError);
    await expect(unwrapDEK(wrapped, WRONG_PASSPHRASE)).rejects.toMatchObject({
      type: CryptoErrorType.INVALID_PASSPHRASE,
    });
  });

  it('does not leak the DEK into the wrapped output', async () => {
    const dek = generateDEKBytes();
    const wrapped = await wrapDEK(dek, PASSPHRASE);
    const serialized = JSON.stringify(wrapped);

    // The raw DEK must not appear anywhere in what gets sent to the server.
    expect(serialized).not.toContain(bufToBase64(dek.buffer as ArrayBuffer));
  });

  it('does not leak the passphrase into the wrapped output', async () => {
    const wrapped = await wrapDEK(generateDEKBytes(), PASSPHRASE);
    expect(JSON.stringify(wrapped)).not.toContain(PASSPHRASE);
  });

  it('uses a fresh salt and IV per wrap, so identical inputs differ', async () => {
    const dek = generateDEKBytes();
    const first = await wrapDEK(dek, PASSPHRASE);
    const second = await wrapDEK(dek, PASSPHRASE);

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ct).not.toBe(second.ct);

    // Both still unwrap to the same key.
    expect(Array.from(await unwrapDEK(first, PASSPHRASE)))
      .toEqual(Array.from(await unwrapDEK(second, PASSPHRASE)));
  });

  it('detects tampering with the ciphertext', async () => {
    const wrapped = await wrapDEK(generateDEKBytes(), PASSPHRASE);
    const tampered = { ...wrapped, ct: bufToBase64(new Uint8Array(48).fill(7).buffer) };

    await expect(unwrapDEK(tampered, PASSPHRASE)).rejects.toThrow(CryptoError);
  });

  it('rejects a short passphrase before attempting decryption', async () => {
    const wrapped = await wrapDEK(generateDEKBytes(), PASSPHRASE);
    await expect(unwrapDEK(wrapped, 'short')).rejects.toMatchObject({
      type: CryptoErrorType.INVALID_PASSPHRASE,
    });
  });

  it('rejects a malformed wrapped DEK', async () => {
    await expect(
      unwrapDEK({ v: 1, kdf: 'argon2id', salt: '', iv: '', ct: '' } as never, PASSPHRASE),
    ).rejects.toMatchObject({ type: CryptoErrorType.VAULT_NOT_INITIALIZED });
  });
});

describe('isWrappedDEK', () => {
  it('accepts a real wrapped DEK', async () => {
    expect(isWrappedDEK(await wrapDEK(generateDEKBytes(), PASSPHRASE))).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not-a-dek'],
    ['an empty object', {}],
    ['a legacy raw dek string field', { raw_dek: 'abc' }],
    ['wrong version', { v: 2, kdf: 'argon2id', salt: 'a', iv: 'b', ct: 'c' }],
    ['unknown kdf', { v: 1, kdf: 'md5', salt: 'a', iv: 'b', ct: 'c' }],
    ['missing ct', { v: 1, kdf: 'argon2id', salt: 'a', iv: 'b' }],
  ])('rejects %s', (_label, value) => {
    expect(isWrappedDEK(value)).toBe(false);
  });
});

describe('verifyPassphraseAgainstDEK', () => {
  it('returns true for the right passphrase and false for the wrong one', async () => {
    const wrapped = await wrapDEK(generateDEKBytes(), PASSPHRASE);

    expect(await verifyPassphraseAgainstDEK(wrapped, PASSPHRASE)).toBe(true);
    expect(await verifyPassphraseAgainstDEK(wrapped, WRONG_PASSPHRASE)).toBe(false);
  });
});

describe('rewrapDEK', () => {
  it('changes the passphrase without changing the key', async () => {
    const dek = generateDEKBytes();
    const original = await wrapDEK(dek, PASSPHRASE);

    const recovered = await unwrapDEK(original, PASSPHRASE);
    const rewrapped = await rewrapDEK(recovered, 'a brand new passphrase');

    // New passphrase works, old one no longer does, key is unchanged.
    expect(Array.from(await unwrapDEK(rewrapped, 'a brand new passphrase'))).toEqual(Array.from(dek));
    await expect(unwrapDEK(rewrapped, PASSPHRASE)).rejects.toThrow(CryptoError);
  });

  it('keeps existing ciphertext decryptable after a passphrase change', async () => {
    const dek = generateDEKBytes();
    const wrapped = await wrapDEK(dek, PASSPHRASE);

    // Encrypt something under the original DEK.
    const key = await importDEK(dek);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode('my secret value'),
    );

    // Change the passphrase, then unwrap with the new one.
    const rewrapped = await rewrapDEK(await unwrapDEK(wrapped, PASSPHRASE), 'totally different phrase');
    const recoveredKey = await importDEK(await unwrapDEK(rewrapped, 'totally different phrase'));

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, recoveredKey, ciphertext);
    expect(new TextDecoder().decode(plaintext)).toBe('my secret value');
  });
});

describe('importDEK', () => {
  it('imports a non-extractable key', async () => {
    const key = await importDEK(generateDEKBytes());

    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });
});

describe('decodeLegacyRawDEK', () => {
  it('decodes a valid legacy base64 DEK', () => {
    const dek = generateDEKBytes();
    const decoded = decodeLegacyRawDEK(bufToBase64(dek.buffer as ArrayBuffer));
    expect(Array.from(decoded)).toEqual(Array.from(dek));
  });

  it('rejects a DEK of the wrong length', () => {
    const short = bufToBase64(new Uint8Array(16).buffer);
    expect(() => decodeLegacyRawDEK(short)).toThrow(CryptoError);
  });

  it('migrating a legacy raw DEK preserves decryptability', async () => {
    // Simulates the Stage 2 migration: a raw DEK read from the old schema is
    // wrapped under the passphrase, and must still decrypt existing data.
    const dek = generateDEKBytes();
    const legacyStored = bufToBase64(dek.buffer as ArrayBuffer);

    const key = await importDEK(dek);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode('pre-migration secret'),
    );

    const wrapped = await wrapDEK(decodeLegacyRawDEK(legacyStored), PASSPHRASE);
    const migratedKey = await importDEK(await unwrapDEK(wrapped, PASSPHRASE));

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, migratedKey, ciphertext);
    expect(new TextDecoder().decode(plaintext)).toBe('pre-migration secret');
  });
});
