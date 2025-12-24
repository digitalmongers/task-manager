import crypto from 'crypto';
import ApiError from './ApiError.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Get key from env or throw error
const getEncryptionKey = (customKey) => {
    const secret = customKey || process.env.CHAT_ENCRYPTION_KEY || process.env.TWO_FACTOR_ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('Encryption key (CHAT_ENCRYPTION_KEY or TWO_FACTOR_ENCRYPTION_KEY) is not defined');
    }
    // ensure key is 32 bytes (256 bits)
    return crypto.createHash('sha256').update(secret).digest();
};

export const encrypt = (text, customKey) => {
    try {
        if (!text) return null;
        
        const key = getEncryptionKey(customKey);
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Format: iv:authTag:encryptedData
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        throw new Error('Encryption failed');
    }
};

export const decrypt = (text, customKey) => {
    try {
        if (!text) return null;
        
        const key = getEncryptionKey(customKey);
        const parts = text.split(':');
        
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error('Decryption failed');
    }
};

export default {
    encrypt,
    decrypt
};
