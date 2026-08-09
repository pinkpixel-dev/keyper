/**
 * EncryptedCredentialsApi - Service for managing encrypted credentials
 * 
 * Provides a high-level API for creating, reading, updating, and deleting
 * encrypted credentials with automatic encryption/decryption handling.
 * 
 * Made with ❤️ by Pink Pixel ✨
 */

import { supabase } from '@/integrations/supabase/client';
import { requireOwnerId, ownerColumn, ownershipFields } from '@/integrations/supabase/auth';
import { vaultManager } from '@/services/VaultManager';
import type { SecretBlobV1 } from '@/crypto/types';
import { CryptoError, CryptoErrorType } from '@/crypto/types';

// Enhanced credential interface with encryption support
export interface EncryptedCredential {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  credential_type: 'api_key' | 'login' | 'secret' | 'token' | 'certificate' | 'document' | 'misc';
  priority: 'low' | 'medium' | 'high' | 'critical';
  username?: string | null;
  url?: string | null;
  category?: string | null;
  notes?: string | null;
  tags: string[];
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  
  // Encryption fields
  secret_blob: SecretBlobV1 | null;
  encrypted_at: string | null;
  
  // Legacy plaintext fields (for backward compatibility)
  password?: string | null;
  api_key?: string | null;
  secret_value?: string | null;
  token_value?: string | null;
  certificate_data?: string | null;
  misc_value?: string | null;
  document_name?: string | null;
  document_mime_type?: string | null;
  document_content_base64?: string | null;
  document_size_bytes?: number | null;
}

// Decrypted credential data structure
export interface DecryptedSecrets {
  password?: string | null;
  api_key?: string | null;
  secret_value?: string | null;
  token_value?: string | null;
  certificate_data?: string | null;
  misc_value?: string | null;
  document_name?: string | null;
  document_mime_type?: string | null;
  document_content_base64?: string | null;
  document_size_bytes?: number | null;
}

// Input for creating/updating credentials
export interface CredentialInput {
  title: string;
  description?: string;
  credential_type: 'api_key' | 'login' | 'secret' | 'token' | 'certificate' | 'document' | 'misc';
  priority: 'low' | 'medium' | 'high' | 'critical';
  username?: string;
  url?: string;
  category?: string;
  notes?: string;
  tags: string[];
  expires_at?: string;
  
  // Secret data (will be encrypted if vault is unlocked)
  secrets: DecryptedSecrets;
}

function normalizeEncryptedCredential(row: Record<string, unknown>): EncryptedCredential {
  return {
    ...(row as Omit<EncryptedCredential, 'secret_blob' | 'encrypted_at'>),
    secret_blob: (row.secret_blob as SecretBlobV1 | null) ?? null,
    encrypted_at: (row.encrypted_at as string | null) ?? null,
  };
}

/**
 * Create a new encrypted credential
 */
export async function createEncryptedCredential(input: CredentialInput): Promise<EncryptedCredential> {
  // Prepare base credential data
  const baseData = {
    ...(await ownershipFields()),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    credential_type: input.credential_type,
    priority: input.priority,
    username: input.username?.trim() || null,
    url: input.url?.trim() || null,
    category: input.category || null,
    notes: input.notes?.trim() || null,
    tags: input.tags,
    expires_at: input.expires_at || null,
  };

  // Check if we have any secret data to encrypt
  const hasSecrets = Object.values(input.secrets).some(value => 
    value !== null && value !== undefined && value !== ''
  );

  let credentialData: Record<string, unknown> = baseData;

  if (hasSecrets && vaultManager.isUnlocked()) {
    // Encrypt the secrets when vault is unlocked
    try {
      const secretsJson = JSON.stringify(input.secrets);
      const encryptedBlob = await vaultManager.encrypt(secretsJson);
      
      credentialData = {
        ...baseData,
        secret_blob: encryptedBlob,
        encrypted_at: new Date().toISOString(),
        // Clear plaintext fields for security
        password: null,
        api_key: null,
        secret_value: null,
        token_value: null,
        certificate_data: null,
        misc_value: null,
        document_name: null,
        document_mime_type: null,
        document_content_base64: null,
        document_size_bytes: null,
      };
    } catch (error) {
      throw new CryptoError(
        CryptoErrorType.ENCRYPTION_FAILED,
        'Failed to encrypt credential secrets'
      );
    }
  } else if (hasSecrets && !vaultManager.isUnlocked()) {
    // Vault is locked but user is trying to save secrets - this should not happen in a properly designed app
    throw new CryptoError(
      CryptoErrorType.VAULT_LOCKED,
      'Cannot save credentials with secrets when vault is locked. Please unlock the vault first.'
    );
  } else {
    // No secrets to store (metadata-only credential)
    credentialData = {
      ...baseData,
      password: null,
      api_key: null,
      secret_value: null,
      token_value: null,
      certificate_data: null,
      misc_value: null,
      document_name: null,
      document_mime_type: null,
      document_content_base64: null,
      document_size_bytes: null,
      secret_blob: null,
      encrypted_at: null,
    };
  }

  const { data, error } = await supabase
    .from('credentials')
    .insert(credentialData)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create credential: ${error.message}`);
  }

  return normalizeEncryptedCredential((data ?? {}) as Record<string, unknown>);
}

/**
 * Get all credentials for the current user
 */
export async function getEncryptedCredentials(): Promise<EncryptedCredential[]> {
  const ownerId = await requireOwnerId();

  const { data, error } = await supabase
    .from('credentials')
    .select('*')
    .eq(ownerColumn(), ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch credentials: ${error.message}`);
  }

  // The ownership column is picked at runtime, so the builder cannot infer a
  // concrete row type here and hands back unknown.
  return ((data || []) as Record<string, unknown>[]).map((item) =>
    normalizeEncryptedCredential(item)
  );
}

/**
 * Get a single credential by ID
 */
export async function getEncryptedCredential(id: string): Promise<EncryptedCredential | null> {
  const ownerId = await requireOwnerId();

  const { data, error } = await supabase
    .from('credentials')
    .select('*')
    .eq('id', id)
    .eq(ownerColumn(), ownerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch credential: ${error.message}`);
  }

  return normalizeEncryptedCredential((data ?? {}) as Record<string, unknown>);
}

/**
 * Decrypt the secrets from an encrypted credential
 */
export async function decryptCredentialSecrets(credential: EncryptedCredential): Promise<DecryptedSecrets> {
  // If credential has encrypted data
  if (credential.secret_blob) {
    if (!vaultManager.isUnlocked()) {
      throw new CryptoError(
        CryptoErrorType.VAULT_LOCKED,
        'Vault must be unlocked to decrypt secrets'
      );
    }

    try {
      const decryptedJson = await vaultManager.decrypt(credential.secret_blob);
      return JSON.parse(decryptedJson);
    } catch (error) {
      throw new CryptoError(
        CryptoErrorType.DECRYPTION_FAILED,
        'Failed to decrypt credential secrets'
      );
    }
  }

  // Return plaintext data (legacy format)
  return {
    password: credential.password,
    api_key: credential.api_key,
    secret_value: credential.secret_value,
    token_value: credential.token_value,
    certificate_data: credential.certificate_data,
    misc_value: credential.misc_value,
    document_name: credential.document_name,
    document_mime_type: credential.document_mime_type,
    document_content_base64: credential.document_content_base64,
    document_size_bytes: credential.document_size_bytes,
  };
}

/**
 * Update an existing credential
 */
export async function updateEncryptedCredential(
  id: string, 
  input: Partial<CredentialInput>
): Promise<EncryptedCredential> {
  const ownerId = await requireOwnerId();

  // getEncryptedCredential already filters by owner, so a hit here is ours.
  // The real enforcement is the RLS policy on the database side; this check
  // only turns a silent no-op update into a clear error.
  const existing = await getEncryptedCredential(id);
  if (!existing) {
    throw new Error('Credential not found');
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {};
  
  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.description !== undefined) updateData.description = input.description?.trim() || null;
  if (input.credential_type !== undefined) updateData.credential_type = input.credential_type;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.username !== undefined) updateData.username = input.username?.trim() || null;
  if (input.url !== undefined) updateData.url = input.url?.trim() || null;
  if (input.category !== undefined) updateData.category = input.category || null;
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.expires_at !== undefined) updateData.expires_at = input.expires_at || null;

  // Handle secrets update
  if (input.secrets) {
    const hasSecrets = Object.values(input.secrets).some(value => 
      value !== null && value !== undefined && value !== ''
    );

    if (hasSecrets && vaultManager.isUnlocked()) {
      // Encrypt the new secrets
      try {
        const secretsJson = JSON.stringify(input.secrets);
        const encryptedBlob = await vaultManager.encrypt(secretsJson);
        
        updateData.secret_blob = encryptedBlob;
        updateData.encrypted_at = new Date().toISOString();
        // Clear plaintext fields
        updateData.password = null;
        updateData.api_key = null;
        updateData.secret_value = null;
        updateData.token_value = null;
        updateData.certificate_data = null;
        updateData.misc_value = null;
        updateData.document_name = null;
        updateData.document_mime_type = null;
        updateData.document_content_base64 = null;
        updateData.document_size_bytes = null;
      } catch (error) {
        throw new CryptoError(
          CryptoErrorType.ENCRYPTION_FAILED,
          'Failed to encrypt updated secrets'
        );
      }
    } else if (hasSecrets && !vaultManager.isUnlocked()) {
      // Vault is locked but user is trying to update with secrets - this should not happen
      throw new CryptoError(
        CryptoErrorType.VAULT_LOCKED,
        'Cannot update credentials with secrets when vault is locked. Please unlock the vault first.'
      );
    } else {
      // No secrets to update or clearing secrets
      updateData.password = null;
      updateData.api_key = null;
      updateData.secret_value = null;
      updateData.token_value = null;
      updateData.certificate_data = null;
      updateData.misc_value = null;
      updateData.document_name = null;
      updateData.document_mime_type = null;
      updateData.document_content_base64 = null;
      updateData.document_size_bytes = null;
      updateData.secret_blob = null;
      updateData.encrypted_at = null;
    }
  }

  const { data, error } = await supabase
    .from('credentials')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update credential: ${error.message}`);
  }

  return normalizeEncryptedCredential((data ?? {}) as Record<string, unknown>);
}

/**
 * Delete a credential
 */
export async function deleteEncryptedCredential(id: string): Promise<void> {
  const ownerId = await requireOwnerId();

  const { error } = await supabase
    .from('credentials')
    .delete()
    .eq('id', id)
    .eq(ownerColumn(), ownerId);

  if (error) {
    throw new Error(`Failed to delete credential: ${error.message}`);
  }
}

/**
 * Get encryption statistics for the current user
 */
export async function getEncryptionStats(): Promise<{
  total: number;
  encrypted: number;
  plaintext: number;
  encryptionPercentage: number;
}> {
  const credentials = await getEncryptedCredentials();
  
  const total = credentials.length;
  const encrypted = credentials.filter(c => c.secret_blob !== null).length;
  const plaintext = total - encrypted;
  const encryptionPercentage = total > 0 ? Math.round((encrypted / total) * 100) : 0;

  return {
    total,
    encrypted,
    plaintext,
    encryptionPercentage,
  };
}

/**
 * Check if a credential is encrypted
 */
export function isCredentialEncrypted(credential: EncryptedCredential): boolean {
  return credential.secret_blob !== null;
}

/**
 * Get the encryption method used for a credential
 */
export function getCredentialEncryptionMethod(credential: EncryptedCredential): string | null {
  if (!credential.secret_blob) return null;
  return credential.secret_blob.kdf === 'argon2id' ? 'Argon2id' : 'PBKDF2';
}
