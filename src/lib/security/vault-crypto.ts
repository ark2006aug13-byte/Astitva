import crypto from 'crypto';
import { env } from '../../config/env';

export interface EncryptedVaultPayload {
  encryptedPayload: string; // hex
  iv: string;               // hex (12 bytes)
  authTag: string;          // hex (16 bytes)
}

/**
 * Retrieves the 32-byte Buffer key for AES-256-GCM.
 */
function getVaultKey(customKeyHex?: string): Buffer {
  const hex = customKeyHex || env.VAULT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('Vault encryption key must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts sensitive secrets (TinyFish session tokens, OAuth refresh tokens, credentials)
 * using AES-256-GCM with authenticated encryption.
 */
export function encryptForVault(plainText: string, customKeyHex?: string): EncryptedVaultPayload {
  const key = getVaultKey(customKeyHex);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf-8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encryptedPayload: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts a vault payload and verifies authentication tag integrity.
 * Throws an error if payload, IV, or authTag have been tampered with.
 */
export function decryptFromVault(item: EncryptedVaultPayload, customKeyHex?: string): string {
  const key = getVaultKey(customKeyHex);
  const iv = Buffer.from(item.iv, 'hex');
  const authTag = Buffer.from(item.authTag, 'hex');
  const encrypted = Buffer.from(item.encryptedPayload, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}
