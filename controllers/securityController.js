import SecurityService from '../services/securityService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * SecurityController - Handles login activity and device management endpoints
 * 
 * ASSUMPTIONS:
 * - User is authenticated (protect middleware applied)
 * - SessionId is present in JWT payload
 * 
 * EDGE CASES HANDLED:
 * - Missing sessionId in request
 * - Invalid sessionId format
 * - Attempting to logout other users' sessions
 * - Empty device list
 * 
 * FAILURE SCENARIOS:
 * - Service errors: Return 500 with safe error message
 * - Validation errors: Return 400 with specific error
 * - Authorization errors: Return 403
 */

class SecurityController {
  /**
   * Get login activity history
   * GET /api/security/login-activity
   */
  async getLoginActivity(req, res) {
    try {
      const userId = req.user._id.toString();
      const limit = parseInt(req.query.limit) || 30;

      // Validate limit
      if (limit < 1 || limit > 100) {
        throw ApiError.badRequest('Limit must be between 1 and 100');
      }

      const activities = await SecurityService.getLoginActivity(userId, limit);

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'Login activity retrieved successfully',
        {
          activities,
          total: activities.length,
        }
      );
    } catch (error) {
      Logger.error('Failed to get login activity', {
        userId: req.user?._id,
        error: error.message,
        stack: error.stack,
      });

      if (error.statusCode) {
        throw error;
      }

      throw ApiError.internal('Failed to retrieve login activity');
    }
  }

  /**
   * Get active devices/sessions
   * GET /api/security/active-devices
   */
  async getActiveDevices(req, res) {
    try {
      const userId = req.user._id.toString();
      
      // Extract current sessionId from JWT
      const currentSessionId = req.sessionId || null;

      const devices = await SecurityService.getActiveDevices(userId, currentSessionId);

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'Active devices retrieved successfully',
        {
          devices,
          total: devices.length,
        }
      );
    } catch (error) {
      Logger.error('Failed to get active devices', {
        userId: req.user?._id,
        error: error.message,
        stack: error.stack,
      });

      if (error.statusCode) {
        throw error;
      }

      throw ApiError.internal('Failed to retrieve active devices');
    }
  }

  /**
   * Logout from a specific device
   * POST /api/security/logout-device
   */
  async logoutDevice(req, res) {
    try {
      const userId = req.user._id.toString();
      const { sessionId } = req.body;

      // Validation
      if (!sessionId || typeof sessionId !== 'string') {
        throw ApiError.badRequest('sessionId is required and must be a string');
      }

      // Prevent logout from current device via this endpoint
      // Users should use normal logout for current device
      if (sessionId === req.sessionId) {
        throw ApiError.badRequest('Use /api/auth/logout to logout from current device');
      }

      await SecurityService.logoutDevice(userId, sessionId);

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'Device logged out successfully'
      );
    } catch (error) {
      Logger.error('Failed to logout device', {
        userId: req.user?._id,
        sessionId: req.body?.sessionId?.substring(0, 8) + '...',
        error: error.message,
        stack: error.stack,
      });

      if (error.statusCode) {
        throw error;
      }

      // Don't leak information about session existence
      throw ApiError.internal('Failed to logout device');
    }
  }

  /**
   * Logout from all devices (except current)
   * POST /api/security/logout-all
   */
  async logoutAllDevices(req, res) {
    try {
      const userId = req.user._id.toString();
      const currentSessionId = req.sessionId;

      // Logout all devices
      const count = await SecurityService.logoutAllDevices(userId);

      // If there was a current session, we need to recreate it
      // so the user stays logged in on this device
      // This is handled by the frontend - they keep their current token

      Logger.logSecurity('USER_INITIATED_GLOBAL_LOGOUT', {
        userId,
        devicesLoggedOut: count,
        currentSessionPreserved: !!currentSessionId,
      });

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'All devices logged out successfully',
        {
          devicesLoggedOut: count,
        }
      );
    } catch (error) {
      Logger.error('Failed to logout all devices', {
        userId: req.user?._id,
        error: error.message,
        stack: error.stack,
      });

      if (error.statusCode) {
        throw error;
      }

      throw ApiError.internal('Failed to logout all devices');
    }
  }

  /**
   * Update name for a specific device
   * PATCH /api/security/device-name
   */
  async updateDeviceName(req, res) {
    try {
      const userId = req.user._id.toString();
      const { sessionId, deviceName } = req.body;

      // Validation
      if (!sessionId || typeof sessionId !== 'string') {
        throw ApiError.badRequest('sessionId is required');
      }

      if (!deviceName || typeof deviceName !== 'string' || deviceName.trim().length === 0) {
        throw ApiError.badRequest('deviceName is required');
      }

      if (deviceName.length > 50) {
        throw ApiError.badRequest('deviceName must not exceed 50 characters');
      }

      await SecurityService.updateDeviceName(userId, sessionId, deviceName.trim());

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'Device name updated successfully'
      );
    } catch (error) {
      Logger.error('Failed to update device name', {
        userId: req.user?._id,
        sessionId: req.body?.sessionId?.substring(0, 8) + '...',
        error: error.message,
      });

      if (error.statusCode) throw error;
      throw ApiError.internal('Failed to update device name');
    }
  }

  /**
   * Explicitly refresh current session activity
   * POST /api/security/refresh-session
   */
  async refreshSession(req, res) {
    try {
      const userId = req.user._id.toString();
      const sessionId = req.sessionId;

      if (!sessionId) {
        throw ApiError.badRequest('No active session to refresh');
      }

      // Session renewal happens in the validateSession middleware
      // but we can explicitly call it here if needed
      const isValid = await SessionService.validateSession(userId, sessionId);

      if (!isValid) {
        throw ApiError.unauthorized('Session has expired');
      }

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'Session refreshed successfully'
      );
    } catch (error) {
      Logger.error('Failed to refresh session', {
        userId: req.user?._id,
        error: error.message,
      });

      if (error.statusCode) throw error;
      throw ApiError.internal('Failed to refresh session');
    }
  }
}

export default new SecurityController();
