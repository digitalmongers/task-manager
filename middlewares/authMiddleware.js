import jwt from 'jsonwebtoken';
import AuthRepository from '../repositories/authRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * Protect routes - require authentication
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
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