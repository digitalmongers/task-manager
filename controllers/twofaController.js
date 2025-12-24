import TwoFAService from '../services/twofa.service.js';
import AuthService from '../services/authService.js';
import SessionService from '../services/sessionService.js';
import SecurityService from '../services/securityService.js';
import RequestInfoService from '../services/requestInfoService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';
import Logger from '../config/logger.js';
import ApiError from '../utils/ApiError.js';

class TwoFAController {
  
  /**
   * Setup 2FA (Start flow)
   * POST /auth/2fa/setup
   */
  async setup(req, res) {
    const result = await TwoFAService.generateSetupData(req.user._id);

    return ApiResponse.success(res, HTTP_STATUS.OK, '2FA setup initiated', {
      secret: result.secret,
      qrCode: result.qrCode
    });
  }

  /**
   * Verify and Enable 2FA
   * POST /auth/2fa/verify
   */
  async verifyAndEnable(req, res) {
    const { token } = req.body;
    
    if (!token) throw ApiError.badRequest('Token is required');

    const result = await TwoFAService.verifyAndEnable(req.user._id, token);

    Logger.logAuth('2FA_ENABLED', req.user._id, { ip: req.ip });

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      backupCodes: result.backupCodes
    });
  }

  /**
   * Verify Login with 2FA
   * POST /auth/2fa/verify-login
   */
  async verifyLogin(req, res) {
    const { token, tempAuthToken } = req.body;
    
    if (!token || !tempAuthToken) throw ApiError.badRequest('Token and temporary auth token are required');

    // Verify temp token first
    let decoded;
    try {
        decoded = AuthService.verifyToken(tempAuthToken);
        if (decoded.type !== '2fa-temp') throw new Error('Invalid token type');
    } catch (error) {
        throw ApiError.unauthorized('Invalid or expired session. Please login again.');
    }
    
    const userId = decoded.userId;
    const authMethod = decoded.initialMethod || '2fa';

    // Verify 2FA token/backup code
    const isBackupCode = !/^\d{6}$/.test(token);
    await TwoFAService.verifyLogin(userId, token);

    // If successful, create session and issue final tokens
    const rememberMe = req.body.rememberMe || false;

    // Create session
    const requestInfo = RequestInfoService.extractRequestInfo(req);
    const sessionId = await SessionService.createSession(userId, {
      deviceType: requestInfo.deviceType,
      browser: requestInfo.browser,
      os: requestInfo.os,
      ipAddress: requestInfo.ipAddress,
      country: requestInfo.country,
      city: requestInfo.city,
    });

    // Generate final tokens with sessionId
    const accessToken = AuthService.generateToken(userId, sessionId, rememberMe);
    const refreshToken = AuthService.generateRefreshToken(userId);

    // Record login activity with 2FA
    await SecurityService.recordLoginAttempt({
      userId,
      sessionId,
      authMethod,
      twoFactorUsed: true,
      status: 'success',
      req,
    }).catch(error => {
      Logger.error('Failed to record 2FA login activity', {
        userId,
        error: error.message,
      });
    });

    // Set cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", accessToken, cookieOptions);
    res.cookie("refreshToken", refreshToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Get user for response
    const user = await AuthService.getCurrentUser(userId);

    Logger.logAuth("LOGIN_2FA_SUCCESS", userId, { 
      ip: req.ip,
      sessionId: sessionId.substring(0, 8) + '...',
      usedBackupCode: isBackupCode,
    });

    return ApiResponse.success(res, HTTP_STATUS.OK, 'Login successful', {
        user,
        token: accessToken,
        refreshToken,
        expiresIn: rememberMe ? "30d" : "7d",
    });
  }

  /**
   * Disable 2FA
   * POST /auth/2fa/disable
   */
  async disable(req, res) {
    const { password, token } = req.body;
    
    if (!token) throw ApiError.badRequest('2FA token or backup code is required');
    // Password might be optional for OAuth users? 
    // Service handles checking if password exists.
    
    await TwoFAService.disable(req.user._id, password, token);
    
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Two-factor authentication disabled');
  }

  /**
   * Regenerate Backup Codes
   * POST /auth/2fa/backup-codes/regenerate
   */
  async regenerateBackupCodes(req, res) {
    const result = await TwoFAService.regenerateBackupCodes(req.user._id);

    Logger.logAuth('BACKUP_CODES_REGENERATED', req.user._id, { ip: req.ip });

    return ApiResponse.success(res, HTTP_STATUS.OK, 'Backup codes regenerated', {
        backupCodes: result.backupCodes
    });
  }
}

export default new TwoFAController();
