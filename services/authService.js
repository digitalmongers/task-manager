import jwt from 'jsonwebtoken';
import AuthRepository from '../repositories/authRepository.js';
import EmailService from '../services/emailService.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import { HTTP_STATUS } from '../config/constants.js';

class AuthService {
  /**
   * Generate JWT token
   */
  generateToken(userId, rememberMe = false) {
    const expiresIn = rememberMe ? '30d' : '7d';
    
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn }
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Token has expired');
      }
      throw ApiError.unauthorized('Invalid token');
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    const { email, password, confirmPassword, firstName, lastName, termsAccepted } = userData;

    // Check if passwords match (validation should catch this, but double-check)
    if (password !== confirmPassword) {
      throw ApiError.badRequest('Passwords do not match');
    }

    // Check if email already exists
    const existingUser = await AuthRepository.findByEmail(email);
    if (existingUser) {
      throw ApiError.conflict('Email already registered');
    }

    // Create user
    const user = await AuthRepository.createUser({
      firstName,
      lastName,
      email,
      password,
      termsAccepted,
      termsAcceptedAt: termsAccepted ? new Date() : null,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await AuthRepository.saveUser(user);

    // Send verification email (don't await to improve response time)
    EmailService.sendVerificationEmail(user, verificationToken).catch((error) => {
      Logger.error('Failed to send verification email', { 
        userId: user._id, 
        error: error.message 
      });
    });

    Logger.logAuth('USER_REGISTERED', user._id, {
      email: user.email,
      name: user.fullName,
    });

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      user: userResponse,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Login user
   */
  async login(credentials, req) {
    const { email, password, rememberMe } = credentials;

    // Find user with password
    const user = await AuthRepository.findByEmailWithPassword(email);

    if (!user) {
      // Log failed login attempt
      Logger.logSecurity('FAILED_LOGIN_ATTEMPT', {
        email,
        ip: req.ip,
        reason: 'User not found',
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      Logger.logSecurity('LOGIN_ATTEMPT_LOCKED_ACCOUNT', {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });
      throw ApiError.unauthorized(
        `Account is temporarily locked. Please try again in ${lockTime} minutes.`
      );
    }

    // Check if account is active
    if (!user.isActive) {
      Logger.logSecurity('LOGIN_ATTEMPT_INACTIVE_ACCOUNT', {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });
      throw ApiError.forbidden('Your account has been deactivated. Please contact support.');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      Logger.logSecurity('LOGIN_ATTEMPT_UNVERIFIED_EMAIL', {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });
      throw ApiError.forbidden(
        'Please verify your email address before logging in. Check your inbox for the verification link.'
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();

      Logger.logSecurity('FAILED_LOGIN_ATTEMPT', {
        userId: user._id,
        email: user.email,
        ip: req.ip,
        reason: 'Invalid password',
        loginAttempts: user.loginAttempts + 1,
      });

      throw ApiError.unauthorized('Invalid email or password');
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const token = this.generateToken(user._id, rememberMe);
    const refreshToken = this.generateRefreshToken(user._id);

    // Log successful login
    Logger.logAuth('USER_LOGIN', user._id, {
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      rememberMe,
    });

    // Send login alert email (optional, don't await)
    if (process.env.SEND_LOGIN_ALERTS === 'true') {
      EmailService.sendLoginAlert(user, req.ip, req.get('user-agent')).catch((error) => {
        Logger.error('Failed to send login alert', { 
          userId: user._id, 
          error: error.message 
        });
      });
    }

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;

    return {
      user: userResponse,
      token,
      refreshToken,
      expiresIn: rememberMe ? '30d' : '7d',
    };
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    // Find user by verification token
    const user = await AuthRepository.findByVerificationToken(token);

    if (!user) {
      throw ApiError.badRequest('Invalid or expired verification token');
    }

    // Check if already verified
    if (user.isEmailVerified) {
      throw ApiError.badRequest('Email is already verified');
    }

    // Verify email
    const verifiedUser = await AuthRepository.verifyEmail(user._id);

    // Send welcome email (don't await)
    EmailService.sendWelcomeEmail(verifiedUser).catch((error) => {
      Logger.error('Failed to send welcome email', { 
        userId: user._id, 
        error: error.message 
      });
    });

    Logger.logAuth('EMAIL_VERIFIED', user._id, {
      email: user.email,
    });

    return {
      message: 'Email verified successfully. You can now login to your account.',
      user: verifiedUser,
    };
  }

  /**
   * Resend verification email
   */
  async resendVerification(email) {
    const user = await AuthRepository.findByEmail(email);

    if (!user) {
      throw ApiError.notFound('No account found with this email address');
    }

    if (user.isEmailVerified) {
      throw ApiError.badRequest('Email is already verified');
    }

    // Check if a recent verification email was sent (rate limiting)
    if (user.emailVerificationExpires && user.emailVerificationExpires > Date.now() + 23 * 60 * 60 * 1000) {
      throw ApiError.tooManyRequests('A verification email was recently sent. Please check your inbox.');
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await AuthRepository.saveUser(user);

    // Send verification email
    await EmailService.sendVerificationEmail(user, verificationToken);

    Logger.logAuth('VERIFICATION_EMAIL_RESENT', user._id, {
      email: user.email,
    });

    return {
      message: 'Verification email sent successfully. Please check your inbox.',
    };
  }

  /**
   * Forgot password
   */
  async forgotPassword(email) {
    const user = await AuthRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists for security
      return {
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    }

    if (!user.isEmailVerified) {
      throw ApiError.forbidden('Please verify your email address first');
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await AuthRepository.saveUser(user);

    // Send password reset email
    await EmailService.sendPasswordResetEmail(user, resetToken);

    Logger.logAuth('PASSWORD_RESET_REQUESTED', user._id, {
      email: user.email,
    });

    return {
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    const user = await AuthRepository.findByResetToken(token);

    if (!user) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    // Update password
    await AuthRepository.updatePassword(user._id, newPassword);

    Logger.logAuth('PASSWORD_RESET_COMPLETED', user._id, {
      email: user.email,
    });

    return {
      message: 'Password reset successfully. You can now login with your new password.',
    };
  }

  /**
   * Change password (for authenticated users)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await AuthRepository.findByEmailWithPassword(
      (await AuthRepository.findById(userId)).email
    );

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    // Check if new password is same as current
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      throw ApiError.badRequest('New password must be different from current password');
    }

    // Update password
    await AuthRepository.updatePassword(user._id, newPassword);

    Logger.logAuth('PASSWORD_CHANGED', user._id, {
      email: user.email,
    });

    return {
      message: 'Password changed successfully',
    };
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId) {
    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }

  /**
   * Logout user
   */
  async logout(userId, req) {
    Logger.logAuth('USER_LOGOUT', userId, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return {
      message: 'Logout successful',
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );

      if (decoded.type !== 'refresh') {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      const user = await AuthRepository.findById(decoded.userId);

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      if (!user.isActive || !user.isEmailVerified) {
        throw ApiError.unauthorized('Account is not active');
      }

      // Generate new tokens
      const token = this.generateToken(user._id);
      const newRefreshToken = this.generateRefreshToken(user._id);

      return {
        token,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Refresh token has expired');
      }
      throw ApiError.unauthorized('Invalid refresh token');
    }
  }
}

export default new AuthService();