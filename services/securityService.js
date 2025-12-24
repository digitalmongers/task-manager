import LoginActivity from '../models/LoginActivity.js';
import SessionService from './sessionService.js';
import RequestInfoService from './requestInfoService.js';
import EmailService from './emailService.js';
import Logger from '../config/logger.js';

/**
 * SecurityService - Orchestrates login activity tracking and device management
 * 
 * ASSUMPTIONS:
 * - LoginActivity model is available
 * - SessionService and RequestInfoService are functional
 * - User has recent login history to compare against
 * 
 * EDGE CASES HANDLED:
 * - First-time login (no history)
 * - Database write failures
 * - Missing request data
 * - Concurrent login attempts
 * 
 * FAILURE SCENARIOS:
 * - DB unavailable: Log error, don't block login
 * - Suspicious detection failure: Log warning, continue
 * - Session creation failure: Propagate error (critical)
 */

class SecurityService {
  /**
   * Record a login attempt (success or failure)
   * 
   * @param {Object} params - Login attempt parameters
   * @returns {Promise<Object>} Created login activity record
   */
  async recordLoginAttempt(params) {
    const {
      userId,
      sessionId = null,
      authMethod,
      twoFactorUsed = false,
      status,
      failureReason = null,
      req,
    } = params;

    // Validation (userId is optional for failed attempts)
    if (status === 'success' && !userId) {
      throw new Error('userId is required for successful login');
    }

    if (!authMethod || !['password', 'google-oauth', 'facebook-oauth', '2fa'].includes(authMethod)) {
      throw new Error('Invalid authMethod');
    }

    if (!status || !['success', 'failed'].includes(status)) {
      throw new Error('Invalid status');
    }

    if (!req) {
      throw new Error('Request object is required');
    }

    try {
      // Extract request info
      const requestInfo = RequestInfoService.extractRequestInfo(req);

      // Detect suspicious activity
      const suspiciousCheck = await this.detectSuspiciousActivity({
        userId,
        ...requestInfo,
        authMethod,
        twoFactorUsed,
      });

      // Create activity record
      const activity = await LoginActivity.create({
        userId,
        sessionId,
        authMethod,
        twoFactorUsed,
        status,
        failureReason,
        ipAddress: requestInfo.ipAddress,
        userAgentRaw: requestInfo.userAgentRaw,
        deviceType: requestInfo.deviceType,
        browser: requestInfo.browser,
        os: requestInfo.os,
        country: requestInfo.country,
        city: requestInfo.city,
        isSuspicious: suspiciousCheck.isSuspicious,
        suspiciousReasons: suspiciousCheck.reasons,
      });

      // Log security event
      if (status === 'success') {
        Logger.logAuth('LOGIN_ACTIVITY_RECORDED', userId, {
          sessionId: sessionId?.substring(0, 8) + '...',
          authMethod,
          device: requestInfo.deviceType,
          location: `${requestInfo.city}, ${requestInfo.country}`,
          isSuspicious: suspiciousCheck.isSuspicious,
        });

        // Check if this is a new device and send email notification
        const isNewDevice = await this.isNewDevice(userId, requestInfo);
        if (isNewDevice) {
          // Send email notification asynchronously (don't block login)
          this.sendNewDeviceEmail(userId, requestInfo).catch(error => {
            Logger.error('Failed to send new device email', {
              userId,
              error: error.message,
            });
          });
        }
      } else {
        Logger.logSecurity('FAILED_LOGIN_RECORDED', {
          userId,
          authMethod,
          failureReason,
          ip: requestInfo.ipMasked,
        });
      }

      return activity;
    } catch (error) {
      // Log but don't throw - login activity recording should not block authentication
      Logger.error('Failed to record login activity', {
        userId,
        authMethod,
        status,
        error: error.message,
        stack: error.stack,
      });

      // Re-throw if it's a validation error (caller should handle)
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        throw error;
      }

      // For DB errors, log and continue
      return null;
    }
  }

  /**
   * Check if the current login is from a new device
   * 
   * @param {string} userId - User ID
   * @param {Object} requestInfo - Request information (device, browser, OS, location)
   * @returns {Promise<boolean>}
   */
  async isNewDevice(userId, requestInfo) {
    try {
      const { deviceType, browser, os, country } = requestInfo;

      // Check if we have any previous successful logins with this device/browser/OS combination
      const existingLogin = await LoginActivity.findOne({
        userId,
        status: 'success',
        deviceType,
        browser,
        os,
      }).lean();

      // If no existing login found, this is a new device
      if (!existingLogin) {
        return true;
      }

      // Also check if country is new (potential location change)
      if (country && country !== 'Unknown') {
        const existingCountryLogin = await LoginActivity.findOne({
          userId,
          status: 'success',
          country,
        }).lean();

        if (!existingCountryLogin) {
          return true; // New country
        }
      }

      return false;
    } catch (error) {
      Logger.error('Failed to check if new device', {
        userId,
        error: error.message,
      });
      // Fail-safe: If check fails, don't send email
      return false;
    }
  }

  /**
   * Send new device login email notification
   * 
   * @param {string} userId - User ID
   * @param {Object} requestInfo - Request information
   * @returns {Promise<void>}
   */
  async sendNewDeviceEmail(userId, requestInfo) {
    try {
      // Get user from repository
      const AuthRepository = (await import('../repositories/authRepository.js')).default;
      const user = await AuthRepository.findById(userId);

      if (!user) {
        Logger.warn('User not found for new device email', { userId });
        return;
      }

      // Prepare device info for email
      const deviceInfo = {
        deviceType: requestInfo.deviceType,
        browser: requestInfo.browser,
        os: requestInfo.os,
        city: requestInfo.city,
        country: requestInfo.country,
        ipAddress: requestInfo.ipMasked,
        loginTime: new Date().toLocaleString(),
      };

      // Send email
      await EmailService.sendNewDeviceLoginEmail(user, deviceInfo);

      Logger.info('New device email sent', {
        userId,
        email: user.email,
        device: requestInfo.deviceType,
        location: `${requestInfo.city}, ${requestInfo.country}`,
      });
    } catch (error) {
      Logger.error('Failed to send new device email', {
        userId,
        error: error.message,
        stack: error.stack,
      });
      // Don't throw - email failure should not affect login
    }
  }

  /**
   * Detect suspicious login activity
   * 
   * @param {Object} params - Login parameters
   * @returns {Promise<Object>} Suspicion result
   */
  async detectSuspiciousActivity(params) {
    const {
      userId,
      country,
      city,
      deviceType,
      browser,
      os,
      authMethod,
      twoFactorUsed,
    } = params;

    const reasons = [];
    let isSuspicious = false;

    try {
      // Get recent successful logins (last 30 days)
      const recentLogins = await LoginActivity.find({
        userId,
        status: 'success',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // First-time login is not suspicious
      if (recentLogins.length === 0) {
        return { isSuspicious: false, reasons: [] };
      }

      // Check for new country
      const knownCountries = new Set(recentLogins.map(l => l.country));
      if (country && country !== 'Unknown' && !knownCountries.has(country)) {
        reasons.push('New country');
        isSuspicious = true;
      }

      // Check for new device type
      const knownDeviceTypes = new Set(recentLogins.map(l => l.deviceType));
      if (deviceType && deviceType !== 'unknown' && !knownDeviceTypes.has(deviceType)) {
        reasons.push('New device type');
        isSuspicious = true;
      }

      // Check for new browser
      const knownBrowsers = new Set(recentLogins.map(l => l.browser));
      if (browser && browser !== 'Unknown' && !knownBrowsers.has(browser)) {
        reasons.push('New browser');
        // Browser change alone is not highly suspicious
      }

      // OAuth without 2FA is slightly suspicious if user has 2FA enabled history
      if ((authMethod === 'google' || authMethod === 'facebook') && !twoFactorUsed) {
        const has2FAHistory = recentLogins.some(l => l.twoFactorUsed);
        if (has2FAHistory) {
          reasons.push('OAuth without 2FA');
          // Not marking as suspicious, just noting
        }
      }

      // Multiple failed attempts recently (check last 24 hours)
      const recentFailures = await LoginActivity.countDocuments({
        userId,
        status: 'failed',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (recentFailures >= 3) {
        reasons.push('Recent failed attempts');
        isSuspicious = true;
      }

      return {
        isSuspicious,
        reasons,
      };
    } catch (error) {
      Logger.warn('Failed to detect suspicious activity', {
        userId,
        error: error.message,
      });

      // Fail-safe: If detection fails, don't mark as suspicious
      return {
        isSuspicious: false,
        reasons: ['Detection error'],
      };
    }
  }

  /**
   * Get login activity for a user (last 30 records)
   * 
   * @param {string} userId - User ID
   * @param {number} limit - Max records to return
   * @returns {Promise<Array>} Login activity records (with masked IPs)
   */
  async getLoginActivity(userId, limit = 30) {
    if (!userId) {
      throw new Error('userId is required');
    }

    try {
      const activities = await LoginActivity.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Mask IP addresses before returning
      return activities.map(activity => ({
        ...activity,
        ipAddress: RequestInfoService.maskIp(activity.ipAddress),
        ipMasked: RequestInfoService.maskIp(activity.ipAddress),
      }));
    } catch (error) {
      Logger.error('Failed to get login activity', {
        userId,
        error: error.message,
      });
      throw new Error('Failed to retrieve login activity');
    }
  }

  /**
   * Get active devices (sessions) for a user
   * Merges Redis session data with DB metadata
   * 
   * @param {string} userId - User ID
   * @param {string} currentSessionId - Current session ID (to mark as current)
   * @returns {Promise<Array>} Active devices
   */
  async getActiveDevices(userId, currentSessionId = null) {
    if (!userId) {
      throw new Error('userId is required');
    }

    try {
      // Get active sessions from Redis
      const sessions = await SessionService.getUserSessions(userId);

      if (!sessions || sessions.length === 0) {
        return [];
      }

      // Enrich with login activity data
      const enrichedDevices = await Promise.all(
        sessions.map(async (session) => {
          // Find the most recent login activity for this session
          const activity = await LoginActivity.findOne({
            sessionId: session.sessionId,
            status: 'success',
          })
            .sort({ createdAt: -1 })
            .lean();

          return {
            sessionId: session.sessionId,
            deviceType: session.deviceType || activity?.deviceType || 'unknown',
            browser: session.browser || activity?.browser || 'Unknown',
            os: session.os || activity?.os || 'Unknown',
            country: session.country || activity?.country || 'Unknown',
            city: session.city || activity?.city || 'Unknown',
            ipAddress: RequestInfoService.maskIp(session.ipAddress || activity?.ipAddress),
            lastActive: session.lastActive || session.createdAt,
            createdAt: session.createdAt || activity?.createdAt,
            deviceName: session.deviceName || activity?.deviceName || null,
            isCurrent: session.sessionId === currentSessionId,
          };
        })
      );

      // Sort by last active (most recent first)
      return enrichedDevices.sort((a, b) => 
        new Date(b.lastActive) - new Date(a.lastActive)
      );
    } catch (error) {
      Logger.error('Failed to get active devices', {
        userId,
        error: error.message,
      });
      throw new Error('Failed to retrieve active devices');
    }
  }

  /**
   * Logout from a specific device
   * 
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID to logout
   * @returns {Promise<boolean>}
   */
  async logoutDevice(userId, sessionId) {
    if (!userId || !sessionId) {
      throw new Error('userId and sessionId are required');
    }

    try {
      await SessionService.revokeSession(userId, sessionId);

      Logger.logSecurity('DEVICE_LOGOUT', {
        userId,
        sessionId: sessionId.substring(0, 8) + '...',
      });

      return true;
    } catch (error) {
      Logger.error('Failed to logout device', {
        userId,
        sessionId: sessionId?.substring(0, 8) + '...',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Logout from all devices (global logout)
   * 
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of sessions revoked
   */
  async logoutAllDevices(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    try {
      const count = await SessionService.revokeAllSessions(userId);

      Logger.logSecurity('ALL_DEVICES_LOGOUT', {
        userId,
        devicesCount: count,
      });

      return count;
    } catch (error) {
      Logger.error('Failed to logout all devices', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }
}

export default new SecurityService();
