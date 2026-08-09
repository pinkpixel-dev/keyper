/**
 * Client-side cryptographic functions for the Keyper vault
 * 
 * Implements end-to-end encryption using:
 * - Preferred KDF: Argon2id (argon2-browser)
 * - Fallback KDF: PBKDF2-HMAC-SHA256
 * - Cipher: AES-GCM with 12-byte IV
 * 
 * Made with ❤️ by Pink Pixel ✨
 */

import { bufToBase64, base64ToBuf, utf8Encode, utf8Decode, randomBytes } from "./encoding";
import type {
  SecretBlobV1,
  KdfName,
  KeyDerivationResult,
  Argon2Params,
  PBKDF2Params
} from "./types";
import { CryptoErrorType, CryptoError } from "./types";

// Import argon2 bundled build directly to avoid Vite/WASM issues
type Argon2BrowserModule = typeof import("argon2-browser/dist/argon2-bundled.min.js")["default"];

let argon2Module: Argon2BrowserModule | null = null;

const MIN_PASSPHRASE_LENGTH = 8;

// Cryptographic constants
const IV_LENGTH = 12;           // 96-bit IV for AES-GCM
const SALT_LENGTH = 16;         // 128-bit salt for KDF
const PBKDF2_ITERATIONS = 310_000; // Strong iteration count (~100-300ms on modern CPUs)
const AES_KEY_LENGTH = 256;     // 256-bit AES key

// Argon2id parameters (balanced security/performance)
const ARGON2_PARAMS: Argon2Params = {
  time: 3,              // 3 iterations
  mem: 64 * 1024,       // 64MB memory
  parallelism: 1,       // Single thread
  hashLen: 32           // 256-bit output
};

// PBKDF2 parameters
const PBKDF2_PARAMS: PBKDF2Params = {
  iterations: PBKDF2_ITERATIONS,
  hashLen: 32           // 256-bit output
};

function toError(error: unknown): Error | undefined {
  return error instanceof Error ? error : undefined;
}

async function loadArgon2Module(): Promise<Argon2BrowserModule | null> {
  if (argon2Module) {
    return argon2Module;
  }

  try {
    const mod = await import("argon2-browser/dist/argon2-bundled.min.js");
    argon2Module = mod.default ?? mod;
    return argon2Module;
  } catch {
    return null;
  }
}

function assertValidPassphrase(passphrase: string): void {
  if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) {
    throw new CryptoError(
      CryptoErrorType.INVALID_PASSPHRASE,
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long`
    );
  }
}

/**
 * Import raw key material as AES-GCM key
 */
async function importAesKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive encryption key using PBKDF2-HMAC-SHA256
 */
async function deriveKeyPBKDF2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  try {
    // Import passphrase as key material
    const baseKey = await crypto.subtle.importKey(
      "raw",
      utf8Encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    // Derive AES key using PBKDF2
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: PBKDF2_PARAMS.iterations,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: AES_KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    throw new CryptoError(
      CryptoErrorType.KEY_DERIVATION_FAILED,
      "PBKDF2 key derivation failed",
      error as Error
    );
  }
}

/**
 * Derive encryption key using Argon2id (preferred method)
 */
async function deriveKeyArgon2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  try {
    const loadedModule = await loadArgon2Module();
    if (!loadedModule) {
      throw new CryptoError(
        CryptoErrorType.KEY_DERIVATION_FAILED,
        "Argon2id is unavailable in this runtime"
      );
    }

    // Perform Argon2id key derivation
    const result = await loadedModule.hash({
      pass: passphrase,
      salt: salt, // Uint8Array
      type: loadedModule.ArgonType.Argon2id,
      time: ARGON2_PARAMS.time,
      mem: ARGON2_PARAMS.mem,
      parallelism: ARGON2_PARAMS.parallelism,
      hashLen: ARGON2_PARAMS.hashLen,
    });

    // The bundled version returns hash as Uint8Array
    const rawKey: Uint8Array = result.hash;
    return await importAesKey(rawKey.buffer);
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      CryptoErrorType.KEY_DERIVATION_FAILED,
      "Argon2id key derivation failed",
      toError(error)
    );
  }
}

/**
 * Derive encryption key with automatic algorithm selection
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<KeyDerivationResult> {
  assertValidPassphrase(passphrase);

  try {
    const key = await deriveKeyArgon2(passphrase, salt);
    return { key, kdf: "argon2id" };
  } catch {
    const key = await deriveKeyPBKDF2(passphrase, salt);
    return { key, kdf: "pbkdf2" };
  }
}

/**
 * Derive a key with the algorithm recorded beside existing ciphertext.
 *
 * Decryption must never auto-select a different fallback algorithm. PBKDF2 and
 * Argon2id produce unrelated keys from the same passphrase and salt, so using
 * the runtime's preferred algorithm would make a valid passphrase look wrong.
 */
export async function deriveKeyForKdf(
  passphrase: string,
  salt: Uint8Array,
  kdf: KdfName,
): Promise<CryptoKey> {
  assertValidPassphrase(passphrase);

  if (kdf === "pbkdf2") {
    return deriveKeyPBKDF2(passphrase, salt);
  }

  try {
    return await deriveKeyArgon2(passphrase, salt);
  } catch (error) {
    throw new CryptoError(
      CryptoErrorType.KEY_DERIVATION_FAILED,
      "This vault uses Argon2id, but Keyper could not load Argon2id in this runtime",
      toError(error)
    );
  }
}

/**
 * Encrypt plaintext string using passphrase
 */
export async function encryptString(passphrase: string, plaintext: string): Promise<SecretBlobV1> {
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    
    // Derive encryption key
    const { key, kdf } = await deriveKey(passphrase, salt);
    
    // Encrypt plaintext
    const plaintextBytes = utf8Encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      plaintextBytes
    );
    
    // Return encrypted blob
    return {
      v: 1,
      kdf,
      salt: bufToBase64(salt.buffer),
      iv: bufToBase64(iv.buffer),
      ct: bufToBase64(ciphertext)
    };
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }

    throw new CryptoError(
      CryptoErrorType.ENCRYPTION_FAILED,
      "Failed to encrypt string",
      toError(error)
    );
  }
}

/**
 * Decrypt encrypted blob using passphrase
 */
export async function decryptString(passphrase: string, blob: SecretBlobV1): Promise<string> {
  try {
    // Validate blob version
    if (blob.v !== 1) {
      throw new CryptoError(
        CryptoErrorType.UNSUPPORTED_VERSION,
        `Unsupported blob version: ${blob.v}`
      );
    }
    
    // Extract components from blob
    const salt = new Uint8Array(base64ToBuf(blob.salt));
    const iv = new Uint8Array(base64ToBuf(blob.iv));
    const ciphertext = base64ToBuf(blob.ct);
    
    // Derive decryption key (must match encryption KDF)
    const { key } = await deriveKey(passphrase, salt);
    
    // Decrypt ciphertext
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    
    return utf8Decode(plaintextBuffer);
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    
    // Handle decryption failures (likely wrong passphrase)
    if (error instanceof Error && error.name === "OperationError") {
      throw new CryptoError(
        CryptoErrorType.INVALID_PASSPHRASE,
        "Invalid passphrase or corrupted data"
      );
    }
    
    throw new CryptoError(
      CryptoErrorType.DECRYPTION_FAILED,
      "Failed to decrypt string",
      error as Error
    );
  }
}

/**
 * Validate secret blob format
 */
export function validateSecretBlob(blob: unknown): blob is SecretBlobV1 {
  if (typeof blob !== "object" || blob === null) {
    return false;
  }

  const candidate = blob as Record<string, unknown>;
  return (
    candidate.v === 1 &&
    typeof candidate.kdf === "string" &&
    (candidate.kdf === "argon2id" || candidate.kdf === "pbkdf2") &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.ct === "string"
  );
}

/**
 * Get estimated key derivation time for performance tuning
 */
export async function benchmarkKeyDerivation(passphrase: string = "test"): Promise<{
  argon2Time: number;
  pbkdf2Time: number;
}> {
  const salt = randomBytes(SALT_LENGTH);
  
  // Benchmark Argon2id
  const argon2Start = performance.now();
  try {
    await deriveKeyArgon2(passphrase, salt);
  } catch {
    // Fallback occurred
  }
  const argon2Time = performance.now() - argon2Start;
  
  // Benchmark PBKDF2
  const pbkdf2Start = performance.now();
  await deriveKeyPBKDF2(passphrase, salt);
  const pbkdf2Time = performance.now() - pbkdf2Start;
  
  return { argon2Time, pbkdf2Time };
}
