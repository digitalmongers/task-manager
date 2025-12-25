import User from '../models/User.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import AuthRepository from '../repositories/authRepository.js';
import { encrypt, decrypt } from '../utils/encryptionUtils.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

class TwoFAService {
  /**
   * Generate secret and QR code for setup
   */
  async generateSetupData(userId) {
    const user = await AuthRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    if (user.twoFactorEnabled) {
      throw ApiError.badRequest('2FA is already enabled');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Task Manager:${user.email}`,
      issuer: 'Task Manager'
    });

    // Encrypt secret for temporary storage (or just return it and expect client to send it back for verification? 
    // Better to store it temporarily or just return to client and let them verify. 
    // Actually, widespread practice is to NOT save it to DB until verification. 
    // BUT we need to verify against THIS secret.
    // So we can return it to client, and client sends it back with the token? No, unsafe.
    // We should probably save it in a temporary field or cache. 
    // However, for simplicity and statelessness, many implementations return the secret and require it to be sent back signed/etc? No.
    // Best practice: Store in DB but mark as not confirmed?
    // User model has `twoFactorSecret`. We can store it there but `twoFactorEnabled` is false.
    // So we overwrite any existing unconfirmed secret.
    
    // Encrypt secret
    const encryptedSecret = encrypt(secret.base32, '2FA');

    // Save secret to user (but keep 2FA disabled)
    // We need a method in repo for this partial update
    await AuthRepository.updateUser(userId, {
      twoFactorSecret: encryptedSecret,
      // twoFactorEnabled remains false until verified
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl
    };
  }

  /**
   * Verify token and enable 2FA
   */
  async verifyAndEnable(userId, token) {
    const user = await AuthRepository.findById(userId); // Need to select secret? 
    // The default findById might not select secret if select: false.
    // We need a repo method to get secret.
    
    // Using a direct mongoose query here via repo would be better if repo supports it.
    // Let's assume we might need to add a method to Repo or use findById and expect select to work if we modify Repo.
    // Wait, `twoFactorSecret` has `select: false`.
    // I should add a method in AuthRepository: `findByIdWith2FASecret`
    
    // For now I'll use `User.findById(userId).select('+twoFactorSecret')` inside Repo?
    // I'll add `findUserWith2FASecret` to Repo in a bit.
    // Assuming it exists for now or I will modify Repo.
    const userWithSecret = await AuthRepository.findByIdWith2FASecret(userId);
    
    if (!userWithSecret || !userWithSecret.twoFactorSecret) {
      throw ApiError.badRequest('2FA setup not initiated');
    }

    const secret = decrypt(userWithSecret.twoFactorSecret, '2FA');

    const normalizedToken = String(token).trim().replace(/\s/g, '');

    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: normalizedToken,
      window: 2 // Increased to 2 (90s slack) to handle time drift
    });

    if (!verified) {
      throw ApiError.badRequest('Invalid OTP');
    }

    // Generate Backup Codes
    const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (code) => ({
        codeHash: await bcrypt.hash(code, 10),
        usedAt: null
      }))
    );

    // Enable 2FA
    await AuthRepository.updateUser(userId, {
      twoFactorEnabled: true,
      twoFactorConfirmedAt: new Date(),
      twoFactorLastVerifiedAt: new Date(),
      backupCodes: hashedBackupCodes
    });

    Logger.logAuth('2FA_ENABLED', userId, { ip: 'unknown' }); // Controller should pass IP? We'll leave it for now.

    return {
      backupCodes, // Return raw codes ONCE
      message: 'Two-factor authentication enabled successfully'
    };
  }

  /**
   * Verify Login (OTP or Backup Code)
   */
  async verifyLogin(userId, token, isRecoveryParams = false) {
    const user = await AuthRepository.findByIdWith2FASecret(userId);
    
    if (!user || !user.twoFactorEnabled) {
      throw ApiError.badRequest('2FA is not enabled for this user');
    }

    // Check if input is a backup code (usually longer, alphanumeric) vs OTP (6 digits)
    // Or we accept `token` and `type`?
    // Promp said: "Accept: OTP OR backup code".
    // We can try both.
    
    const normalizedToken = String(token).trim().replace(/\s/g, '');
    let isVerified = false;
    let usedBackupCodeId = null;

    // 1. Try as OTP (if 6 digits)
    if (/^\d{6}$/.test(normalizedToken)) {
        const secret = decrypt(user.twoFactorSecret, '2FA');
        isVerified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: normalizedToken,
            window: 2
        });
    }

    // 2. If not Verified and looks like backup code (or just try if OTP failed)
    if (!isVerified) {
        // Check backup codes
        const availableCodes = user.backupCodes.filter(c => !c.usedAt);
        
        for (const codeObj of availableCodes) {
            const isMatch = await bcrypt.compare(normalizedToken, codeObj.codeHash);
            if (isMatch) {
                isVerified = true;
                usedBackupCodeId = codeObj._id; 
                break;
            }
        }
    }

    if (!isVerified) {
        throw ApiError.unauthorized('Invalid 2FA code');
    }

    // If backup code used, mark it
    if (usedBackupCodeId) {
        // We need to update the specific subdocument. 
        // using repo to update.
        await AuthRepository.markBackupCodeAsUsed(userId, usedBackupCodeId);
        Logger.logAuth('BACKUP_CODE_USED', userId);
    }

    // Update last verified
    await AuthRepository.updateUser(userId, {
        twoFactorLastVerifiedAt: new Date()
    });
    
    return true;
  }

  /**
   * Disable 2FA
   */
  async disable(userId, password, token) {
    // Fetch user with all needed fields in one query
    const user = await User.findById(userId).select('+password +twoFactorSecret +backupCodes');
    
    if (!user) throw ApiError.notFound('User not found');
    if (!user.twoFactorEnabled) throw ApiError.badRequest('2FA is not enabled');

    const normalizedToken = String(token).trim().replace(/\s/g, '');

    // 1. Verify 2FA token or Backup code first
    let isCodeValid = false;
    
    // Check if OTP
    if (/^\d{6}$/.test(normalizedToken)) {
        const secret = decrypt(user.twoFactorSecret, '2FA');
        isCodeValid = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: normalizedToken,
            window: 2
        });
    }
    
    // Check backup codes if not validated by OTP
    if (!isCodeValid) {
         const availableCodes = user.backupCodes.filter(c => !c.usedAt);
         for (const codeObj of availableCodes) {
            if (await bcrypt.compare(normalizedToken, codeObj.codeHash)) {
                isCodeValid = true;
                break;
            }
         }
    }
    
    if (!isCodeValid) throw ApiError.unauthorized('Invalid 2FA code');

    // 2. Optional: Password check (kept as a second layer only if explicitly needed, but user wants to disable via OTP)
    // We'll skip password requirement if OTP is valid, as OTP is stronger proof of possession.
    // However, if we want to be paranoid, we could check it if provided.
    if (password && user.password) {
         const isMatch = await user.comparePassword(password);
         if (!isMatch) throw ApiError.unauthorized('Invalid password');
    }

    // Disable
    await AuthRepository.updateUser(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorConfirmedAt: null,
        backupCodes: [],
        twoFactorLastVerifiedAt: null
    });
    
    Logger.logAuth('2FA_DISABLED', userId);
    return { message: '2FA disabled successfully' };
  }

  async regenerateBackupCodes(userId) {
       const user = await AuthRepository.findById(userId);
       if (!user.twoFactorEnabled) throw ApiError.badRequest('2FA not enabled');
       
       const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
       const hashedBackupCodes = await Promise.all(
          backupCodes.map(async (code) => ({
            codeHash: await bcrypt.hash(code, 10),
            usedAt: null
          }))
        );
        
        await AuthRepository.updateUser(userId, {
            backupCodes: hashedBackupCodes
        });
        
        return { backupCodes };
  }
}

export default new TwoFAService();
