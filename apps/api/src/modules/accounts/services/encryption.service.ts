import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const hexKey = process.env.ENCRYPTION_KEY;
    if (!hexKey) {
      this.logger.warn('ENCRYPTION_KEY environment variable is missing! Falling back to empty key (NOT SECURE)');
      this.key = Buffer.alloc(32); // 32 bytes of zeros
    } else {
      this.key = Buffer.from(hexKey, 'hex');
      if (this.key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
      }
    }
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM.
   * Returns a formatted string: iv:authTag:ciphertext
   */
  encrypt(text: string): string {
    if (!text) return text;
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(12);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the auth tag
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted string (iv:authTag:ciphertext) using AES-256-GCM.
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        // Assume it's plaintext if it doesn't match our format
        return encryptedText;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error(`Failed to decrypt text: ${error.message}`);
      // Fallback to original text if decryption fails (e.g., if it was actually plaintext)
      return encryptedText;
    }
  }
}
