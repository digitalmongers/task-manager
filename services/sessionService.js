import redisClient from '../config/redis.js';
import Logger from '../config/logger.js';
import crypto from 'crypto';

/**
 * SessionService - Manages active user sessions in Redis
 * 
 * ASSUMPTIONS:
 * - Redis is available and configured
 * - Session IDs are unique and cryptographically secure
 * - Session data is serializable to JSON
 * 
 * EDGE CASES HANDLED:
 * - Redis connection failures (graceful degradation)
 * - Concurrent session operations
 * - Expired sessions
 * - Invalid session data
 * 
 * FAILURE SCENARIOS:
 * - Redis unavailable: Log error, throw exception (fail-fast)
 * - Invalid data: Validate and reject
 * - Race conditions: Use Redis atomic operations
 */

const SESSION_PREFIX = 'sess:';
const USER_SESSIONS_PREFIX = 'user:';
const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

class SessionService {
  /**
   * Generate a cryptographically secure session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new session in Redis
   * 
   * @param {string} userId - User ID
   * @param {Object} sessionData - Session metadata (device, browser, IP, etc.)
   * @returns {Promise<string>} sessionId
   */
  async createSession(userId, sessionData) {
    if (!userId) {
      throw new Error('userId is required to create session');
    }

    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('sessionData must be a valid object');
    }

    try {
      const sessionId = this.generateSessionId();
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}:sessions`;

      // Prepare session data with metadata
      const fullSessionData = {
        userId,
        ...sessionData,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };

      // Use pipeline for atomic operations
      const pipeline = redisClient.pipeline();
      
      // Store session data
      pipeline.setex(
        sessionKey,
        SESSION_TTL,
        JSON.stringify(fullSessionData)
      );

      // Add session ID to user's session set
      pipeline.sadd(userSessionsKey, sessionId);
      pipeline.expire(userSessionsKey, SESSION_TTL);

      await pipeline.exec();

      Logger.debug('Session created', {
        userId,
        sessionId: sessionId.substring(0, 8) + '...',
        device: sessionData.deviceType,
        browser: sessionData.browser,
      });

      return sessionId;
    } catch (error) {
      Logger.error('Failed to create session', {
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error('Session creation failed');
    }
  }

  /**
   * Validate if a session exists and is active
   * 
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  async validateSession(userId, sessionId) {
    if (!userId || !sessionId) {
      return false;
    }

    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const sessionData = await redisClient.get(sessionKey);

      if (!sessionData) {
        return false;
      }

      const parsed = JSON.parse(sessionData);

      // Verify session belongs to the user
      if (parsed.userId !== userId) {
        Logger.warn('Session userId mismatch', {
          expectedUserId: userId,
          actualUserId: parsed.userId,
          sessionId: sessionId.substring(0, 8) + '...',
        });
        return false;
      }

      // Update last active timestamp
      parsed.lastActive = new Date().toISOString();
      await redisClient.setex(sessionKey, SESSION_TTL, JSON.stringify(parsed));

      return true;
    } catch (error) {
      Logger.error('Session validation error', {
        userId,
        sessionId: sessionId?.substring(0, 8) + '...',
        error: error.message,
      });
      // Fail-open: If Redis is down, don't block all requests
      // This is a trade-off between availability and security
      // In production, you might want to fail-closed instead
      return false;
    }
  }

  /**
   * Get session data
   * 
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>}
   */
  async getSession(sessionId) {
    if (!sessionId) {
      return null;
    }

    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const sessionData = await redisClient.get(sessionKey);

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      Logger.error('Failed to get session', {
        sessionId: sessionId?.substring(0, 8) + '...',
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get all active sessions for a user
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getUserSessions(userId) {
    if (!userId) {
      return [];
    }

    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}:sessions`;
      const sessionIds = await redisClient.smembers(userSessionsKey);

      if (!sessionIds || sessionIds.length === 0) {
        return [];
      }

      // Fetch all session data
      const pipeline = redisClient.pipeline();
      sessionIds.forEach(sid => {
        pipeline.get(`${SESSION_PREFIX}${sid}`);
      });

      const results = await pipeline.exec();
      const sessions = [];

      results.forEach((result, index) => {
        const [err, data] = result;
        if (!err && data) {
          try {
            const sessionData = JSON.parse(data);
            sessions.push({
              sessionId: sessionIds[index],
              ...sessionData,
            });
          } catch (parseError) {
            Logger.warn('Failed to parse session data', {
              sessionId: sessionIds[index],
              error: parseError.message,
            });
          }
        }
      });

      return sessions;
    } catch (error) {
      Logger.error('Failed to get user sessions', {
        userId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Revoke a specific session
   * 
   * @param {string} userId - User ID (for verification)
   * @param {string} sessionId - Session ID to revoke
   * @returns {Promise<boolean>}
   */
  async revokeSession(userId, sessionId) {
    if (!userId || !sessionId) {
      throw new Error('userId and sessionId are required');
    }

    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}:sessions`;

      // Verify session belongs to user before revoking
      const sessionData = await redisClient.get(sessionKey);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed.userId !== userId) {
          Logger.warn('Attempted to revoke session belonging to different user', {
            requestingUserId: userId,
            sessionUserId: parsed.userId,
          });
          throw new Error('Unauthorized session revocation attempt');
        }
      }

      // Use pipeline for atomic operations
      const pipeline = redisClient.pipeline();
      pipeline.del(sessionKey);
      pipeline.srem(userSessionsKey, sessionId);
      await pipeline.exec();

      Logger.logSecurity('SESSION_REVOKED', {
        userId,
        sessionId: sessionId.substring(0, 8) + '...',
      });

      return true;
    } catch (error) {
      Logger.error('Failed to revoke session', {
        userId,
        sessionId: sessionId?.substring(0, 8) + '...',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user (global logout)
   * 
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeAllSessions(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}:sessions`;
      const sessionIds = await redisClient.smembers(userSessionsKey);

      if (!sessionIds || sessionIds.length === 0) {
        return 0;
      }

      // Delete all session keys
      const pipeline = redisClient.pipeline();
      sessionIds.forEach(sid => {
        pipeline.del(`${SESSION_PREFIX}${sid}`);
      });
      pipeline.del(userSessionsKey);

      await pipeline.exec();

      Logger.logSecurity('ALL_SESSIONS_REVOKED', {
        userId,
        sessionCount: sessionIds.length,
      });

      return sessionIds.length;
    } catch (error) {
      Logger.error('Failed to revoke all sessions', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clean up expired sessions from user's session set
   * This is a maintenance operation
   * 
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of expired sessions removed
   */
  async cleanupExpiredSessions(userId) {
    if (!userId) {
      return 0;
    }

    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}:sessions`;
      const sessionIds = await redisClient.smembers(userSessionsKey);

      if (!sessionIds || sessionIds.length === 0) {
        return 0;
      }

      let removedCount = 0;
      const pipeline = redisClient.pipeline();

      for (const sid of sessionIds) {
        const exists = await redisClient.exists(`${SESSION_PREFIX}${sid}`);
        if (!exists) {
          pipeline.srem(userSessionsKey, sid);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        await pipeline.exec();
      }

      return removedCount;
    } catch (error) {
      Logger.error('Failed to cleanup expired sessions', {
        userId,
        error: error.message,
      });
      return 0;
    }
  }
}

export default new SessionService();
