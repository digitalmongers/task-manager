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
    // If customKey is provided, check if it's one of our known ENV keys or a raw key
    if (customKey === '2FA') return crypto.createHash('sha256').update(process.env.TWO_FACTOR_ENCRYPTION_KEY).digest();
    if (customKey === 'CHAT') return crypto.createHash('sha256').update(process.env.CHAT_ENCRYPTION_KEY).digest();
    
    // If it's a raw string, use it
    if (customKey && customKey.length > 0) {
        return crypto.createHash('sha256').update(customKey).digest();
    }

    // Fallback (Legacy/Implicit) - Prioritize 2FA if only 2FA exists, etc.
    const secret = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.CHAT_ENCRYPTION_KEY;
    
    if (!secret) {
        throw new Error('Encryption key (TWO_FACTOR_ENCRYPTION_KEY or CHAT_ENCRYPTION_KEY) is not defined');
    }
    
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
        
        // Fallback for legacy plain-text data
        // Encrypted format is iv:authTag:encryptedData
        if (typeof text !== 'string' || !text.includes(':')) {
            return text;
        }

        const parts = text.split(':');
        if (parts.length !== 3) {
            // If it has colons but not 3 parts, it might be something else
            // but for safety with legacy data, we return original if it doesn't match format
            return text;
        }
        
        const key = getEncryptionKey(customKey);
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        // If decryption fails but it looked like encrypted data, 
        // it might be legacy data that happens to have colons, or wrong key.
        // Returning original text as extreme fallback for legacy recovery.
        return text;
    }
};

export default {
    encrypt,
    decrypt
};
