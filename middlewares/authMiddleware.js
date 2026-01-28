import jwt from 'jsonwebtoken';
import AuthRepository from '../repositories/authRepository.js';
import SessionService from '../services/sessionService.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import { WHITELISTED_EMAILS } from '../config/aiConfig.js';
import User from '../models/User.js';

/**
 * Protect routes - require authentication
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    // INFO: Log incoming auth indicators for production debugging
    Logger.info('Auth: [PROTECT] check', {
      url: req.originalUrl,
      method: req.method,
      hasHeader: !!req.headers.authorization,
      hasCookie: !!req.cookies?.token,
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      requestId: req.requestId,
      ip: req.ip
    });

    // Get token from Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      Logger.warn('Auth: [PROTECT] No token found', {
        headers: req.headers,
        cookies: req.cookies
      });
      throw ApiError.unauthorized('Please login to access this resource');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Your session has expired. Please login again');
      }
      throw ApiError.unauthorized('Invalid authentication token');
    }

    // Extract sessionId from token (if present)
    const sessionId = decoded.sid;

    // Validate session in Redis (if sessionId exists)
    // This allows immediate enforcement of remote logouts
    if (sessionId) {
      const isValidSession = await SessionService.validateSession(
        decoded.userId,
        sessionId
      );

      if (!isValidSession) {
        Logger.logSecurity('INVALID_SESSION_ATTEMPT', {
          userId: decoded.userId,
          sessionId: sessionId.substring(0, 8) + '...',
          ip: req.ip,
        });
        throw ApiError.unauthorized('Your session has been terminated. Please login again');
      }

      // Attach sessionId to request for use in controllers
      req.sessionId = sessionId;
    }

    // Get user from token
    const user = await AuthRepository.findById(decoded.userId);

    if (!user) {
      throw ApiError.unauthorized('User associated with this token no longer exists');
    }

    // Check if user is active
    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw ApiError.forbidden('Please verify your email to access this resource');
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw ApiError.forbidden(`Account is temporarily locked. Try again in ${lockTime} minutes`);
    }

    // ========== ENTERPRISE REAL-TIME SYNC ==========
    // We check every request to ensure the user's flag matches your config file
    const isWhitelisted = WHITELISTED_EMAILS.includes(user.email);
    
    if (isWhitelisted && !user.isEnterpriseUser) {
        // Upgrade to Enterprise silently
        await User.updateOne({ _id: user._id }, { $set: { isEnterpriseUser: true } });
        user.isEnterpriseUser = true;
        Logger.info(`Real-time: Upgraded ${user.email} to Enterprise status`);
    } else if (!isWhitelisted && user.isEnterpriseUser) {
        // Revoke Enterprise silently
        await User.updateOne({ _id: user._id }, { $set: { isEnterpriseUser: false } });
        user.isEnterpriseUser = false;
        Logger.info(`Real-time: Revoked Enterprise status from ${user.email}`);
    }
    // ===============================================

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize specific roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Please login to access this resource'));
    }

    if (!roles.includes(req.user.role)) {
      Logger.logSecurity('UNAUTHORIZED_ACCESS_ATTEMPT', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        route: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });

      return next(
        ApiError.forbidden('You do not have permission to perform this action')
      );
    }

    next();
  };
};

/**
 * Optional authentication - attach user if token is valid, but don't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // INFO: Log token availability for production debugging
    Logger.info('Auth: [OPTIONAL] check', {
      hasHeader: !!req.headers.authorization,
      hasCookie: !!req.cookies?.token,
      requestId: req.requestId
    });

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await AuthRepository.findById(decoded.userId);

    if (user && user.isActive && user.isEmailVerified) {
      req.user = user;
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

/**
 * Verify email is verified (for additional protection)
 */
export const verifyEmailMiddleware = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Please login to access this resource'));
  }

  if (!req.user.isEmailVerified) {
    return next(
      ApiError.forbidden('Please verify your email address to access this resource')
    );
  }

  next();
};

/**
 * Check if account is active
 */
export const checkActive = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Please login to access this resource'));
  }

  if (!req.user.isActive) {
    Logger.logSecurity('INACTIVE_ACCOUNT_ACCESS_ATTEMPT', {
      userId: req.user._id,
      email: req.user.email,
      route: req.originalUrl,
      ip: req.ip,
    });

    return next(
      ApiError.forbidden('Your account has been deactivated. Please contact support')
    );
  }

  next();
};


/**
 * Check if user must change password (for forced password changes)
 */
export const checkPasswordChangeRequired = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Please login to access this resource'));
  }

  // If admin has forced password change
  if (req.user.mustChangePassword) {
    // Allow access only to change-password and logout routes
    const allowedRoutes = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'];
    
    if (!allowedRoutes.includes(req.path)) {
      Logger.logSecurity('FORCED_PASSWORD_CHANGE_REQUIRED', {
        userId: req.user._id,
        email: req.user.email,
        attemptedRoute: req.path,
        ip: req.ip,
      });
      
      return next(
        ApiError.forbidden('You must change your password before accessing other resources')
      );
    }
  }

  next();
};