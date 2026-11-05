import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';

// Standard project encryption key matching apps/vps-manager/.env and apps/api/.env
const DEFAULT_ENCRYPTION_KEY_HEX = 'cefebc7648a25734178ba0d8f9e1a4c5c68f50abe38f86d38f03ce6509a01809';

export function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY_HEX;
  if (!hexKey || hexKey.trim().length !== 64) {
    throw new Error('Credential encryption service is temporarily unavailable. Please try again.');
  }
  
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) {
    throw new Error('Credential encryption service is temporarily unavailable. Please try again.');
  }
  return key;
}

export function encrypt(text: string): string {
  if (!text) return text;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      return encryptedText; // Probably plaintext
    }
    
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt text:', error);
    return encryptedText;
  }
}
