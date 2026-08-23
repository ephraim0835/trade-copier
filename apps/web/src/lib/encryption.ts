import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';

export function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    console.warn('ENCRYPTION_KEY environment variable is missing! Falling back to empty key (NOT SECURE)');
    return Buffer.alloc(32);
  }
  
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
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
