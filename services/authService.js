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
 * Forgot password - SECURED VERSION
 */
async forgotPassword(email, req) {
  // Security: Always return the same message regardless of whether user exists
  // This prevents email enumeration attacks
  const genericMessage = 'If an account exists with this email, a password reset link has been sent.';

  // Check rate limiting per email (prevent spam)
  // This should ideally be handled by middleware, but adding extra layer here
  
  const user = await AuthRepository.findByEmail(email);

  if (!user) {
    // Don't reveal if email exists for security
    Logger.logSecurity('PASSWORD_RESET_ATTEMPT_NONEXISTENT_EMAIL', {
      email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    // Add small delay to prevent timing attacks (makes response time similar)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    return {
      message: genericMessage,
    };
  }

  // Check if email is verified
  if (!user.isEmailVerified) {
    // Don't send email if not verified, but don't reveal this to the user
    Logger.logSecurity('PASSWORD_RESET_ATTEMPT_UNVERIFIED_EMAIL', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });
    
    // Same delay for timing attack prevention
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    return {
      message: genericMessage,
    };
  }

  // Check if account is locked
  if (user.isLocked()) {
    Logger.logSecurity('PASSWORD_RESET_ATTEMPT_LOCKED_ACCOUNT', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    return {
      message: genericMessage,
    };
  }

  // Check if account is inactive
  if (!user.isActive) {
    Logger.logSecurity('PASSWORD_RESET_ATTEMPT_INACTIVE_ACCOUNT', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    return {
      message: genericMessage,
    };
  }

  // Check if reset token was recently sent (rate limiting - 1 request per 5 minutes)
  if (user.passwordResetExpires && user.passwordResetExpires > Date.now() + 55 * 60 * 1000) {
    Logger.logSecurity('PASSWORD_RESET_RATE_LIMIT_HIT', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });
    
    return {
      message: genericMessage, // Don't reveal rate limiting
    };
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await AuthRepository.saveUser(user);

  // Send password reset email (don't await to improve response time)
  EmailService.sendPasswordResetEmail(user, resetToken).catch((error) => {
    Logger.error('Failed to send password reset email', { 
      userId: user._id, 
      error: error.message 
    });
  });

  Logger.logAuth('PASSWORD_RESET_REQUESTED', user._id, {
    email: user.email,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return {
    message: genericMessage,
  };
}

/**
 * Reset password - SECURED VERSION
 */
async resetPassword(token, newPassword, req) {
  const user = await AuthRepository.findByResetToken(token);

  if (!user) {
    Logger.logSecurity('PASSWORD_RESET_INVALID_TOKEN', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  // Check if account is still active and verified
  if (!user.isActive) {
    Logger.logSecurity('PASSWORD_RESET_INACTIVE_ACCOUNT', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });
    
    throw ApiError.forbidden('Your account has been deactivated. Please contact support.');
  }

  if (!user.isEmailVerified) {
    Logger.logSecurity('PASSWORD_RESET_UNVERIFIED_ACCOUNT', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });
    
    throw ApiError.forbidden('Please verify your email first.');
  }

  // Check if new password is same as current password
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    throw ApiError.badRequest('New password must be different from your current password');
  }

  // Update password
  await AuthRepository.updatePassword(user._id, newPassword);

  // Reset login attempts (in case account was locked)
  await user.resetLoginAttempts();

  // Send confirmation email (optional)
  EmailService.sendPasswordChangedConfirmation(user, req.ip, req.get('user-agent')).catch((error) => {
    Logger.error('Failed to send password change confirmation', { 
      userId: user._id, 
      error: error.message 
    });
  });

  Logger.logAuth('PASSWORD_RESET_COMPLETED', user._id, {
    email: user.email,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  return {
    message: 'Password reset successfully. You can now login with your new password.',
  };
}

  
  /**
   * Change password (for authenticated users) - ENTERPRISE SECURED
   */
  async changePassword(userId, currentPassword, newPassword, req) {
    const user = await AuthRepository.findByIdWithPasswordHistory(userId);

    if (!user) {
      Logger.logSecurity('PASSWORD_CHANGE_USER_NOT_FOUND', {
        userId,
        ip: req?.ip,
      });
      throw ApiError.notFound('User not found');
    }

    if (!user.isActive) {
      Logger.logSecurity('PASSWORD_CHANGE_INACTIVE_ACCOUNT', {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
      });
      throw ApiError.forbidden('Your account has been deactivated. Please contact support.');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      Logger.logSecurity('PASSWORD_CHANGE_WRONG_CURRENT_PASSWORD', {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
        userAgent: req?.get('user-agent'),
      });
      
      throw ApiError.unauthorized('Current password is incorrect');
    }

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      Logger.logSecurity('PASSWORD_CHANGE_SAME_AS_CURRENT', {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
      });
      throw ApiError.badRequest('New password must be different from current password');
    }

    // ========== NEW: Check password history ==========
    const wasUsedBefore = await user.wasPasswordUsedRecently(newPassword, 5);
    if (wasUsedBefore) {
      Logger.logSecurity('PASSWORD_CHANGE_REUSED_OLD_PASSWORD', {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
      });
      throw ApiError.badRequest('You cannot reuse any of your last 5 passwords. Please choose a different password.');
    }

    // ========== NEW: Add to history before changing ==========
    await user.addToPasswordHistory();

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    await user.save();

    EmailService.sendPasswordChangedConfirmation(user, req?.ip, req?.get('user-agent')).catch((error) => {
      Logger.error('Failed to send password change confirmation', { 
        userId: user._id, 
        error: error.message 
      });
    });

    Logger.logAuth('PASSWORD_CHANGED', user._id, {
      email: user.email,
      ip: req?.ip,
      userAgent: req?.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    return {
      message: 'Password changed successfully. Please keep your new password secure.',
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

    // Remove sensitive fields
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.passwordHistory;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;

    return userResponse;
  }

  // ========== NEW: Update profile method ==========
  /**
   * Update user profile (firstName, lastName, phoneNumber)
   */
  async updateProfile(userId, updateData, req) {
    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    const updatedUser = await AuthRepository.updateProfile(userId, updateData);

    Logger.logAuth('PROFILE_UPDATED', userId, {
      email: user.email,
      updatedFields: Object.keys(updateData),
      ip: req?.ip,
      userAgent: req?.get('user-agent'),
    });

    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    delete userResponse.passwordHistory;

    return {
      user: userResponse,
      message: 'Profile updated successfully',
    };
  }

  // ========== NEW: Update avatar method ==========
  /**
   * Update user avatar (profile photo)
   */
  async updateAvatar(userId, file, req) {
    const cloudinary = (await import('../config/cloudinary.js')).default;
    const streamifier = (await import('streamifier')).default;

    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    try {
      // Delete old avatar if exists
      if (user.avatar?.publicId) {
        await cloudinary.uploader.destroy(user.avatar.publicId).catch((error) => {
          Logger.warn('Failed to delete old avatar', {
            userId,
            publicId: user.avatar.publicId,
            error: error.message,
          });
        });
      }

      // Upload new avatar
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'task-manager/avatars',
            resource_type: 'image',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(stream);
      });

      const updatedUser = await AuthRepository.updateAvatar(userId, {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });

      Logger.logAuth('AVATAR_UPDATED', userId, {
        email: user.email,
        avatarUrl: uploadResult.secure_url,
        ip: req?.ip,
      });

      const userResponse = updatedUser.toObject();
      delete userResponse.password;
      delete userResponse.passwordHistory;

      return {
        user: userResponse,
        message: 'Profile photo updated successfully',
      };
    } catch (error) {
      Logger.error('Failed to update avatar', {
        userId,
        error: error.message,
      });
      throw ApiError.internal('Failed to upload profile photo. Please try again.');
    }
  }

  // ========== NEW: Delete avatar method ==========
  /**
   * Delete user avatar
   */
  async deleteAvatar(userId, req) {
    const cloudinary = (await import('../config/cloudinary.js')).default;

    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (!user.avatar?.publicId) {
      throw ApiError.badRequest('No profile photo to delete');
    }

    try {
      await cloudinary.uploader.destroy(user.avatar.publicId);

      const updatedUser = await AuthRepository.deleteAvatar(userId);

      Logger.logAuth('AVATAR_DELETED', userId, {
        email: user.email,
        ip: req?.ip,
      });

      const userResponse = updatedUser.toObject();
      delete userResponse.password;
      delete userResponse.passwordHistory;

      return {
        user: userResponse,
        message: 'Profile photo deleted successfully',
      };
    } catch (error) {
      Logger.error('Failed to delete avatar', {
        userId,
        error: error.message,
      });
      throw ApiError.internal('Failed to delete profile photo. Please try again.');
    }
  }

  // ========== NEW: Delete account method ==========
  /**
   * Delete user account (soft delete)
   */
  async deleteAccount(userId, password, req) {
    const cloudinary = (await import('../config/cloudinary.js')).default;

    const user = await AuthRepository.findById(userId).select('+password');

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      Logger.logSecurity('ACCOUNT_DELETE_WRONG_PASSWORD', {
        userId,
        email: user.email,
        ip: req?.ip,
      });
      throw ApiError.unauthorized('Incorrect password');
    }

    // Delete avatar if exists
    if (user.avatar?.publicId) {
      await cloudinary.uploader.destroy(user.avatar.publicId).catch((error) => {
        Logger.warn('Failed to delete avatar during account deletion', {
          userId,
          error: error.message,
        });
      });
    }

    // Soft delete
    await AuthRepository.updateUser(userId, {
      isActive: false,
      avatar: {
        url: null,
        publicId: null,
      },
    });

    Logger.logAuth('ACCOUNT_DELETED', userId, {
      email: user.email,
      ip: req?.ip,
      userAgent: req?.get('user-agent'),
    });

    return {
      message: 'Your account has been deleted successfully',
    };
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