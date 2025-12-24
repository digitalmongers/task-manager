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
    const encryptedSecret = encrypt(secret.base32);

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

    const secret = decrypt(userWithSecret.twoFactorSecret);

    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 30sec slack
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
    
    let isVerified = false;
    let usedBackupCodeId = null;

    // 1. Try as OTP (if 6 digits)
    if (/^\d{6}$/.test(token)) {
        const secret = decrypt(user.twoFactorSecret);
        isVerified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1
        });
    }

    // 2. If not Verified and looks like backup code (or just try if OTP failed)
    if (!isVerified) {
        // Check backup codes
        // We need to compare specific code against all hashes? That's expensive (10 comparisons).
        // But 10 is small.
        const availableCodes = user.backupCodes.filter(c => !c.usedAt);
        
        for (const codeObj of availableCodes) {
            const isMatch = await bcrypt.compare(token, codeObj.codeHash);
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
    const user = await AuthRepository.findByIdWithPassword(userId);
    
    if (!user.twoFactorEnabled) {
      throw ApiError.badRequest('2FA is not enabled');
    }

    // Verify Password (if Local auth)
    if (user.authProvider === 'local') {
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) throw ApiError.unauthorized('Invalid password');
    }
    // For OAuth users, we might skip password check or require re-auth? 
    // Requirement says: "Require ALL: Password, OTP...". 
    // If OAuth user has no password, this is tricky. 
    // Assume OAuth users must define a password to use 2FA? Or we skip password for them?
    // "Password login MUST stop... OAuth login MUST stop..."
    // If OAuth user wants to disable, they might not have a password.
    // We should check if user has password.
    
    if (!user.password && user.authProvider !== 'local') {
        // If no password, we rely on OTP/Backup code only? 
        // Or maybe force them to set password?
        // Let's assume for now if they have no password, we skip it but enforce OTP strongly.
    } else if (user.password) {
         if (!password) throw ApiError.badRequest('Password required');
         const isMatch = await user.comparePassword(password);
         if (!isMatch) throw ApiError.unauthorized('Invalid password');
    }

    // Verify OTP to disable
    // Reuse verifyLogin logic but we don't need side effects (like using backup code)?
    // Actually, "OTP OR unused backup code".
    // If we use a backup code to disable, we should probably mark it used? 
    // But we are wiping them anyway.
    
    // Use the verify logic (without marking backup code as used, since we are wiping)
    // But verifyLogin marks it. 
    // We'll duplicate verify logic slightly or refactor.
    // Refactoring verifyLogin to separate verification from side effects is better.
    
    // For now, I'll validte manually here to avoid side effects of verifyLogin
    const userWithSecret = await AuthRepository.findByIdWith2FASecret(userId);
    let isCodeValid = false;
    
    if (/^\d{6}$/.test(token)) {
        const secret = decrypt(userWithSecret.twoFactorSecret);
        isCodeValid = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1
        });
    }
    
    if (!isCodeValid) {
         // check backup codes
         const availableCodes = userWithSecret.backupCodes.filter(c => !c.usedAt);
         for (const codeObj of availableCodes) {
            if (await bcrypt.compare(token, codeObj.codeHash)) {
                isCodeValid = true;
                break;
            }
         }
    }
    
    if (!isCodeValid) throw ApiError.unauthorized('Invalid 2FA code');

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
