import jwt from "jsonwebtoken";
import AuthRepository from "../repositories/authRepository.js";
import EmailService from "../services/emailService.js";
import ApiError from "../utils/ApiError.js";
import Logger from "../config/logger.js";
import { HTTP_STATUS } from "../config/constants.js";
import SessionService from "./sessionService.js";
import SecurityService from "./securityService.js";
import RequestInfoService from "./requestInfoService.js";
import { PLAN_LIMITS } from "../config/aiConfig.js";

class AuthService {
  /**
   * Generate JWT token with session ID
   */
  generateToken(userId, sessionId, rememberMe = false) {
    const expiresIn = rememberMe ? "30d" : "7d";

    return jwt.sign(
      { userId, sid: sessionId },
      process.env.JWT_SECRET,
      { expiresIn }
    );
  }

  generateRefreshToken(userId, sessionId) {
    return jwt.sign(
      { userId, sid: sessionId, type: "refresh" },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
  }

  /**
   * Generate temporary 2FA token (short-lived)
   */
  generateTempToken(userId, initialMethod = 'password') {
    return jwt.sign(
      { userId, type: "2fa-temp", initialMethod },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw ApiError.unauthorized("Token has expired");
      }
      throw ApiError.unauthorized("Invalid token");
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      termsAccepted,
      invitationToken, // Optional: Token from invite link
    } = userData;

    // Check if passwords match (validation should catch this, but double-check)
    if (password !== confirmPassword) {
      throw ApiError.badRequest("Passwords do not match");
    }

    // Check if email already exists
    const existingUser = await AuthRepository.findByEmail(email);
    if (existingUser) {
      throw ApiError.conflict("Email already registered");
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
    EmailService.sendVerificationEmail(user, verificationToken).catch(
      (error) => {
        Logger.error("Failed to send verification email", {
          userId: user._id,
          error: error.message,
        });
      }
    );

    Logger.logAuth("USER_REGISTERED", user._id, {
      email: user.email,
      name: user.fullName,
    });

    // ALWAYS handle pending invitations (both token-based and email-based)
    // This ensures users who accepted invitations anonymously get linked
    await this.handlePendingInvitation(user, invitationToken);

    // Return enriched user without password
    const userResponse = this._enrichUserWithBoosts(user);
    delete userResponse.password;

    return {
      user: userResponse,
      message:
        "Registration successful. Please check your email to verify your account.",
    };
  }

  /**
   * Handle pending invitations after auth (both token-based and email-based)
   * This handles:
   * 1. Token-based: User clicked invitation link with token
   * 2. Email-based: User signed up/logged in without token, but has pending invitations
   */
  async handlePendingInvitation(user, invitationToken) {
    try {
      const email = user.email.toLowerCase();
      
      // ========== PART 1: Token-based acceptance (if token provided) ==========
      if (invitationToken) {
        const CollaborationService = (await import("../services/collaborationService.js")).default;
        const TeamService = (await import("../services/TeamService.js")).default;
        
        // Try accepting as Task Invitation
        try {
          await CollaborationService.acceptInvitation(invitationToken, user._id);
          Logger.info("Automatically accepted task invitation after auth", { userId: user._id, token: invitationToken });
        } catch (e) {
          // Try Team Invitation if task invitation failed
          try {
            await TeamService.acceptTeamInvitation(invitationToken, user._id);
            Logger.info("Automatically accepted team invitation after auth", { userId: user._id, token: invitationToken });
          } catch (e2) {
            Logger.warn("Failed to auto-accept invitation after auth", { userId: user._id, error: e2.message });
          }
        }
      }
      
      // ========== PART 2: Email-based late binding (always run) ==========
      // This links any pending invitations that were accepted anonymously
      
      // 1. Link pending TEAM invitations by email
      const TeamMember = (await import('../models/TeamMember.js')).default;
      const pendingTeamInvites = await TeamMember.find({
        memberEmail: email,
        status: { $in: ['pending', 'active'] },
        member: null // Not yet linked to a user
      });
      
      for (const invite of pendingTeamInvites) {
        invite.member = user._id;
        
        // If already accepted anonymously, set acceptedAt
        if (invite.status === 'active' && !invite.acceptedAt) {
          invite.acceptedAt = new Date();
        }
        
        await invite.save();
        
        Logger.info('Team invitation linked to user', {
          userId: user._id,
          invitationId: invite._id,
          email: email,
        });
      }
      
      // 2. Link pending TASK COLLABORATION invitations by email
      const TaskInvitation = (await import('../models/TaskInvitation.js')).default;
      const TaskCollaborator = (await import('../models/TaskCollaborator.js')).default;
      const Task = (await import('../models/Task.js')).default;
      
      const pendingTaskInvites = await TaskInvitation.find({
        inviteeEmail: email,
        status: { $in: ['pending', 'accepted'] },
        inviteeUser: null // Not yet linked to a user
      }).populate('task');
      
      for (const invite of pendingTaskInvites) {
        // Link user to invitation
        invite.inviteeUser = user._id;
        
        // If already accepted anonymously, create collaborator now
        if (invite.status === 'accepted') {
          // Check if collaborator already exists
          const existingCollab = await TaskCollaborator.findOne({
            task: invite.task._id,
            collaborator: user._id,
          });
          
          if (!existingCollab) {
            // Create collaborator record
            await TaskCollaborator.create({
              task: invite.task._id,
              taskOwner: invite.task.user,
              collaborator: user._id,
              role: invite.role,
              status: 'active',
              sharedBy: invite.inviter,
              shareMessage: invite.message,
            });
            
            // Update task counts
            const task = await Task.findById(invite.task._id);
            if (task) {
              if (!task.isShared) {
                task.isShared = true;
                task.collaboratorCount = 1;
              } else {
                task.collaboratorCount += 1;
              }
              await task.save();
            }
            
            Logger.info('Task collaborator created for anonymous acceptance', {
              userId: user._id,
              taskId: invite.task._id,
              invitationId: invite._id,
            });
          }
        }
        
        await invite.save();
        
        Logger.info('Task invitation linked to user', {
          userId: user._id,
          invitationId: invite._id,
          taskId: invite.task._id,
          email: email,
        });
      }
      
      // Log summary
      if (pendingTeamInvites.length > 0 || pendingTaskInvites.length > 0) {
        Logger.info('Pending invitations processed', {
          userId: user._id,
          teamInvitationsLinked: pendingTeamInvites.length,
          taskInvitationsLinked: pendingTaskInvites.length,
        });
      }
      
      return {
        teamInvitationsLinked: pendingTeamInvites.length,
        taskInvitationsLinked: pendingTaskInvites.length,
      };
      
    } catch (error) {
      Logger.error("Error in handlePendingInvitation", { 
        error: error.message,
        userId: user._id,
        stack: error.stack,
      });
      // Don't throw - this shouldn't block signup/login
      return { teamInvitationsLinked: 0, taskInvitationsLinked: 0 };
    }
  }

  /**
   * Login user
   */
  async login(credentials, req) {
    const { email, password, rememberMe, invitationToken } = credentials;

    // Find user with password
    const user = await AuthRepository.findByEmailWithPassword(email);

    if (!user) {
      // Record failed login attempt (User not found)
      await SecurityService.recordLoginAttempt({
        userId: null,
        sessionId: null,
        authMethod: 'password',
        twoFactorUsed: false,
        status: 'failed',
        failureReason: 'User not found',
        req,
      }).catch(error => {
        Logger.error('Failed to record failed login activity (not found)', {
          error: error.message,
        });
      });

      // Log failed login attempt
      Logger.logSecurity("FAILED_LOGIN_ATTEMPT", {
        email,
        ip: req.ip,
        reason: "User not found",
      });
      throw ApiError.unauthorized("Invalid email or password");
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      Logger.logSecurity("LOGIN_ATTEMPT_LOCKED_ACCOUNT", {
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
      Logger.logSecurity("LOGIN_ATTEMPT_INACTIVE_ACCOUNT", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });
      throw ApiError.forbidden(
        "Your account has been deactivated. Please contact support."
      );
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      Logger.logSecurity("LOGIN_ATTEMPT_UNVERIFIED_EMAIL", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });
      throw ApiError.forbidden(
        "Please verify your email address before logging in. Check your inbox for the verification link."
      );
    }

    // Check if user registered via OAuth (Google/Facebook) and doesn't have a password
    if (user.authProvider !== 'local' && !user.password) {
      Logger.logSecurity("LOGIN_ATTEMPT_OAUTH_USER_NO_PASSWORD", {
        userId: user._id,
        email: user.email,
        authProvider: user.authProvider,
        ip: req.ip,
      });
      throw ApiError.badRequest(
        `This account was created using ${user.authProvider === 'google' ? 'Google' : 'Facebook'}. Please sign in with ${user.authProvider === 'google' ? 'Google' : 'Facebook'} or contact support to set a password.`
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();

      // Record failed login activity
      await SecurityService.recordLoginAttempt({
        userId: user._id,
        sessionId: null,
        authMethod: 'password',
        twoFactorUsed: false,
        status: 'failed',
        failureReason: 'Invalid password',
        req,
      }).catch(error => {
        Logger.error('Failed to record failed login activity', {
          userId: user._id,
          error: error.message,
        });
      });

      Logger.logSecurity("FAILED_LOGIN_ATTEMPT", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
        reason: "Invalid password",
        loginAttempts: user.loginAttempts + 1,
      });

      throw ApiError.unauthorized("Invalid email or password");
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts(); // We reset it here, but if 2FA fails? 
    // Ideally we reset AFTER 2FA. But traditional password auth passed.
    // If we only reset after 2FA, password brute force + 2FA could lock account?
    // Enterprise standard: Password verified = success for password part. 2FA is separate layer.
    // So we reset login attempts here.
    
    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
        const tempToken = this.generateTempToken(user._id, 'password');
        
        Logger.logAuth("LOGIN_2FA_REQUIRED", user._id, {
            email: user.email,
            ip: req.ip
        });
        
        return {
            requires2FA: true,
            tempAuthToken: tempToken,
            message: 'Two-factor authentication required'
        };
    }

    // Generate tokens
    // Create session first
    const requestInfo = RequestInfoService.extractRequestInfo(req);
    const sessionId = await SessionService.createSession(user._id.toString(), {
      deviceType: requestInfo.deviceType,
      browser: requestInfo.browser,
      os: requestInfo.os,
      ipAddress: requestInfo.ipAddress,
      country: requestInfo.country,
      city: requestInfo.city,
    });

    const token = this.generateToken(user._id, sessionId, rememberMe);
    const refreshToken = this.generateRefreshToken(user._id, sessionId);

    // Record login activity
    await SecurityService.recordLoginAttempt({
      userId: user._id,
      sessionId,
      authMethod: 'password',
      twoFactorUsed: false,
      status: 'success',
      req,
    }).catch(error => {
      // Don't block login if activity recording fails
      Logger.error('Failed to record login activity', {
        userId: user._id,
        error: error.message,
      });
    });

    // ALWAYS handle pending invitations (both token-based and email-based)
    // This ensures users who accepted invitations before login get linked
    await this.handlePendingInvitation(user, invitationToken);

    // Log successful login
    Logger.logAuth("USER_LOGIN", user._id, {
      email: user.email,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      rememberMe,
      sessionId: sessionId.substring(0, 8) + '...',
    });

    // Send login alert email (optional, don't await)
    if (process.env.SEND_LOGIN_ALERTS === "true") {
      EmailService.sendLoginAlert(user, req.ip, req.get("user-agent")).catch(
        (error) => {
          Logger.error("Failed to send login alert", {
            userId: user._id,
            error: error.message,
          });
        }
      );
    }

    // Return enriched user without password
    const userResponse = this._enrichUserWithBoosts(user);
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;
    delete userResponse.twoFactorSecret; // Ensure secret is not returned
    delete userResponse.backupCodes;

    return {
      user: userResponse,
      token,
      refreshToken,
      expiresIn: rememberMe ? "30d" : "7d",
    };
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    // Find user by verification token
    const user = await AuthRepository.findByVerificationToken(token);

    if (!user) {
      throw ApiError.badRequest("Invalid or expired verification token");
    }

    // Check if already verified
    if (user.isEmailVerified) {
      throw ApiError.badRequest("Email is already verified");
    }

    // Verify email
    const verifiedUser = await AuthRepository.verifyEmail(user._id);

    // Send welcome email (don't await)
    EmailService.sendWelcomeEmail(verifiedUser).catch((error) => {
      Logger.error("Failed to send welcome email", {
        userId: user._id,
        error: error.message,
      });
    });

    Logger.logAuth("EMAIL_VERIFIED", user._id, {
      email: user.email,
    });

    return {
      message:
        "Email verified successfully. You can now login to your account.",
      user: verifiedUser,
    };
  }

  /**
   * Resend verification email
   */
  async resendVerification(email) {
    const user = await AuthRepository.findByEmail(email);

    if (!user) {
      throw ApiError.notFound("No account found with this email address");
    }

    if (user.isEmailVerified) {
      throw ApiError.badRequest("Email is already verified");
    }

    // Check if a recent verification email was sent (rate limiting)
    if (
      user.emailVerificationExpires &&
      user.emailVerificationExpires > Date.now() + 23 * 60 * 60 * 1000
    ) {
      throw ApiError.tooManyRequests(
        "A verification email was recently sent. Please check your inbox."
      );
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await AuthRepository.saveUser(user);

    // Send verification email
    await EmailService.sendVerificationEmail(user, verificationToken);

    Logger.logAuth("VERIFICATION_EMAIL_RESENT", user._id, {
      email: user.email,
    });

    return {
      message: "Verification email sent successfully. Please check your inbox.",
    };
  }

  /**
   * Forgot password - SECURED VERSION
   */
  async forgotPassword(email, req) {
    // Security: Always return the same message regardless of whether user exists
    // This prevents email enumeration attacks
    const genericMessage =
      "If an account exists with this email, a password reset link has been sent.";

    // Check rate limiting per email (prevent spam)
    // This should ideally be handled by middleware, but adding extra layer here

    const user = await AuthRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists for security
      Logger.logSecurity("PASSWORD_RESET_ATTEMPT_NONEXISTENT_EMAIL", {
        email,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Add small delay to prevent timing attacks (makes response time similar)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 100 + 50)
      );

      return {
        message: genericMessage,
      };
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // Don't send email if not verified, but don't reveal this to the user
      Logger.logSecurity("PASSWORD_RESET_ATTEMPT_UNVERIFIED_EMAIL", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });

      // Same delay for timing attack prevention
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 100 + 50)
      );

      return {
        message: genericMessage,
      };
    }

    // Check if account is locked
    if (user.isLocked()) {
      Logger.logSecurity("PASSWORD_RESET_ATTEMPT_LOCKED_ACCOUNT", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 100 + 50)
      );

      return {
        message: genericMessage,
      };
    }

    // Check if account is inactive
    if (!user.isActive) {
      Logger.logSecurity("PASSWORD_RESET_ATTEMPT_INACTIVE_ACCOUNT", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 100 + 50)
      );

      return {
        message: genericMessage,
      };
    }

    // Check if reset token was recently sent (rate limiting - 1 request per 5 minutes)
    if (
      user.passwordResetExpires &&
      user.passwordResetExpires > Date.now() + 55 * 60 * 1000
    ) {
      Logger.logSecurity("PASSWORD_RESET_RATE_LIMIT_HIT", {
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
      Logger.error("Failed to send password reset email", {
        userId: user._id,
        error: error.message,
      });
    });

    Logger.logAuth("PASSWORD_RESET_REQUESTED", user._id, {
      email: user.email,
      ip: req.ip,
      userAgent: req.get("user-agent"),
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
      Logger.logSecurity("PASSWORD_RESET_INVALID_TOKEN", {
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      throw ApiError.badRequest("Invalid or expired reset token");
    }

    // Check if account is still active and verified
    if (!user.isActive) {
      Logger.logSecurity("PASSWORD_RESET_INACTIVE_ACCOUNT", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });

      throw ApiError.forbidden(
        "Your account has been deactivated. Please contact support."
      );
    }

    if (!user.isEmailVerified) {
      Logger.logSecurity("PASSWORD_RESET_UNVERIFIED_ACCOUNT", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });

      throw ApiError.forbidden("Please verify your email first.");
    }

    // Check if new password is same as current password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      throw ApiError.badRequest(
        "New password must be different from your current password"
      );
    }

    // Update password
    await AuthRepository.updatePassword(user._id, newPassword);

    // Reset login attempts (in case account was locked)
    await user.resetLoginAttempts();

    // Send confirmation email (optional)
    EmailService.sendPasswordChangedConfirmation(
      user,
      req.ip,
      req.get("user-agent")
    ).catch((error) => {
      Logger.error("Failed to send password change confirmation", {
        userId: user._id,
        error: error.message,
      });
    });

    Logger.logAuth("PASSWORD_RESET_COMPLETED", user._id, {
      email: user.email,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    return {
      message:
        "Password reset successfully. You can now login with your new password.",
    };
  }

  /**
   * Change password (for authenticated users) - ENTERPRISE SECURED
   */
  async changePassword(userId, currentPassword, newPassword, req) {
    const user = await AuthRepository.findByIdWithPasswordHistory(userId);

    if (!user) {
      Logger.logSecurity("PASSWORD_CHANGE_USER_NOT_FOUND", {
        userId,
        ip: req?.ip,
      });
      throw ApiError.notFound("User not found");
    }

    if (!user.isActive) {
      Logger.logSecurity("PASSWORD_CHANGE_INACTIVE_ACCOUNT", {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
      });
      throw ApiError.forbidden(
        "Your account has been deactivated. Please contact support."
      );
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      Logger.logSecurity("PASSWORD_CHANGE_WRONG_CURRENT_PASSWORD", {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
        userAgent: req?.get("user-agent"),
      });

      throw ApiError.unauthorized("Current password is incorrect");
    }

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      Logger.logSecurity("PASSWORD_CHANGE_SAME_AS_CURRENT", {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
      });
      throw ApiError.badRequest(
        "New password must be different from current password"
      );
    }

    // ========== NEW: Check password history ==========
    const wasUsedBefore = await user.wasPasswordUsedRecently(newPassword, 5);
    if (wasUsedBefore) {
      Logger.logSecurity("PASSWORD_CHANGE_REUSED_OLD_PASSWORD", {
        userId: user._id,
        email: user.email,
        ip: req?.ip,
      });
      throw ApiError.badRequest(
        "You cannot reuse any of your last 5 passwords. Please choose a different password."
      );
    }

    // ========== NEW: Add to history before changing ==========
    await user.addToPasswordHistory();

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    await user.save();

    EmailService.sendPasswordChangedConfirmation(
      user,
      req?.ip,
      req?.get("user-agent")
    ).catch((error) => {
      Logger.error("Failed to send password change confirmation", {
        userId: user._id,
        error: error.message,
      });
    });

    Logger.logAuth("PASSWORD_CHANGED", user._id, {
      email: user.email,
      ip: req?.ip,
      userAgent: req?.get("user-agent"),
      timestamp: new Date().toISOString(),
    });

    return {
      message:
        "Password changed successfully. Please keep your new password secure.",
    };
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId) {
    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Enrich and remove sensitive fields
    const userResponse = this._enrichUserWithBoosts(user);
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
      throw ApiError.notFound("User not found");
    }

    if (!user.isActive) {
      throw ApiError.forbidden("Your account has been deactivated");
    }

    const updatedUser = await AuthRepository.updateProfile(userId, updateData);

    Logger.logAuth("PROFILE_UPDATED", userId, {
      email: user.email,
      updatedFields: Object.keys(updateData),
      ip: req?.ip,
      userAgent: req?.get("user-agent"),
    });

    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    delete userResponse.passwordHistory;

    return {
      user: userResponse,
      message: "Profile updated successfully",
    };
  }

  // ========== NEW: Update avatar method ==========
  /**
   * Update user avatar (profile photo)
   */
  async updateAvatar(userId, file, req) {
    const cloudinary = (await import("../config/cloudinary.js")).default;
    const streamifier = (await import("streamifier")).default;

    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (!user.isActive) {
      throw ApiError.forbidden("Your account has been deactivated");
    }

    try {
      // Delete old avatar if exists
      if (user.avatar?.publicId) {
        await cloudinary.uploader
          .destroy(user.avatar.publicId)
          .catch((error) => {
            Logger.warn("Failed to delete old avatar", {
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
            folder: "task-manager/avatars",
            resource_type: "image",
            transformation: [
              { width: 400, height: 400, crop: "fill", gravity: "face" },
              { quality: "auto", fetch_format: "auto" },
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

      Logger.logAuth("AVATAR_UPDATED", userId, {
        email: user.email,
        avatarUrl: uploadResult.secure_url,
        ip: req?.ip,
      });

      const userResponse = updatedUser.toObject();
      delete userResponse.password;
      delete userResponse.passwordHistory;

      return {
        user: userResponse,
        message: "Profile photo updated successfully",
      };
    } catch (error) {
      Logger.error("Failed to update avatar", {
        userId,
        error: error.message,
      });
      throw ApiError.internal(
        "Failed to upload profile photo. Please try again."
      );
    }
  }

  // ========== NEW: Delete avatar method ==========
  /**
   * Delete user avatar
   */
  async deleteAvatar(userId, req) {
    const cloudinary = (await import("../config/cloudinary.js")).default;

    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (!user.avatar?.publicId) {
      throw ApiError.badRequest("No profile photo to delete");
    }

    try {
      await cloudinary.uploader.destroy(user.avatar.publicId);

      const updatedUser = await AuthRepository.deleteAvatar(userId);

      Logger.logAuth("AVATAR_DELETED", userId, {
        email: user.email,
        ip: req?.ip,
      });

      const userResponse = updatedUser.toObject();
      delete userResponse.password;
      delete userResponse.passwordHistory;

      return {
        user: userResponse,
        message: "Profile photo deleted successfully",
      };
    } catch (error) {
      Logger.error("Failed to delete avatar", {
        userId,
        error: error.message,
      });
      throw ApiError.internal(
        "Failed to delete profile photo. Please try again."
      );
    }
  }

  // ========== UPDATED: Hard delete account method ==========
  /**
   * Delete user account permanently (hard delete)
   */
  async deleteAccount(userId, password, req) {
    const user = await AuthRepository.findByIdWithPassword(userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // For OAuth users (no password set), skip password verification
    if (user.authProvider === 'local' && user.password) {
      // Regular users must provide password
      if (!password) {
        throw ApiError.badRequest("Password is required to delete your account");
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        Logger.logSecurity("ACCOUNT_DELETE_WRONG_PASSWORD", {
          userId,
          email: user.email,
          ip: req?.ip,
        });
        throw ApiError.unauthorized("Incorrect password");
      }
    } else if (user.authProvider !== 'local') {
      // OAuth users (Google/Facebook) - no password required
      Logger.info("OAuth user deleting account", {
        userId,
        authProvider: user.authProvider,
        email: user.email,
      });
    }

    // Call the system hard delete to handle data purging
    await this.systemHardDeleteUser(userId);

    Logger.logAuth("ACCOUNT_PERMANENTLY_DELETED", userId, {
      email: user.email,
      authProvider: user.authProvider,
      ip: req?.ip,
      userAgent: req?.get("user-agent"),
    });

    return {
      message: "Your account and all associated data have been permanently deleted",
    };
  }

  /**
   * System-initiated hard delete (used for manual deletion and cron cleanup)
   * Does NOT check for password/auth as it's assumed to be called from a secure context
   */
  async systemHardDeleteUser(userId) {
    const user = await AuthRepository.findById(userId);
    if (!user) return false;

    // 1. Revoke all active sessions in Redis
    try {
      await SessionService.revokeAllSessions(userId);
    } catch (error) {
      Logger.warn("Failed to revoke sessions during system hard delete", { userId, error: error.message });
    }

    // 2. Cascade delete all user data
    await this.cascadeDeleteUserData(user);

    // 3. Hard delete user document from database
    await AuthRepository.hardDeleteUser(userId);

    return true;
  }

  /**
   * Helper to delete all data belonging to a user across all collections
   */
  async cascadeDeleteUserData(user) {
    const userId = user._id;
    const mongoose = (await import("mongoose")).default;
    const cloudinary = (await import("../config/cloudinary.js")).default;

    try {
      // Get all models dynamically to avoid circular dependencies
      const Task = mongoose.model('Task');
      const VitalTask = mongoose.model('VitalTask');
      const TaskCollaborator = mongoose.model('TaskCollaborator');
      const VitalTaskCollaborator = mongoose.model('VitalTaskCollaborator');
      const TaskInvitation = mongoose.model('TaskInvitation');
      const VitalTaskInvitation = mongoose.model('VitalTaskInvitation');
      const Notification = mongoose.model('Notification');
      const PushSubscription = mongoose.model('PushSubscription');
      const LoginActivity = mongoose.model('LoginActivity');
      const TaskMessage = mongoose.model('TaskMessage');
      const TeamMember = mongoose.model('TeamMember');

      Logger.info("Starting cascade delete for user", { userId, email: user.email });

      // 1. Delete user avatar from Cloudinary
      if (user.avatar?.publicId) {
        await cloudinary.uploader.destroy(user.avatar.publicId).catch(e => {});
      }

      // 2. Delete Tasks and their images
      const tasks = await Task.find({ user: userId });
      for (const t of tasks) {
        if (t.image?.publicId) {
          await cloudinary.uploader.destroy(t.image.publicId).catch(e => {});
        }
      }
      await Task.deleteMany({ user: userId });

      // 3. Delete VitalTasks and their images
      const vitalTasks = await VitalTask.find({ user: userId });
      for (const vt of vitalTasks) {
        if (vt.image?.publicId) {
          await cloudinary.uploader.destroy(vt.image.publicId).catch(e => {});
        }
      }
      await VitalTask.deleteMany({ user: userId });

      // 4. Delete collaborations (where user is collaborator)
      await TaskCollaborator.deleteMany({ collaborator: userId });
      await VitalTaskCollaborator.deleteMany({ collaborator: userId });

      // 5. Delete invitations
      await TaskInvitation.deleteMany({ $or: [{ sender: userId }, { recipientEmail: user.email }] });
      await VitalTaskInvitation.deleteMany({ $or: [{ sender: userId }, { recipientEmail: user.email }] });

      // 6. Delete other user-owned records
      await Notification.deleteMany({ recipient: userId });
      await PushSubscription.deleteMany({ user: userId });
      await LoginActivity.deleteMany({ userId: userId });
      await TaskMessage.deleteMany({ sender: userId });
      await TeamMember.deleteMany({ user: userId });

      Logger.info("Cascade delete completed for user", { userId });
      return true;
    } catch (error) {
      Logger.error("Error during cascade delete", { userId, error: error.message });
      return false;
    }
  }

  /**
   * Logout user
   */
  async logout(userId, sessionId, req) {
    if (sessionId) {
      await SessionService.revokeSession(userId, sessionId).catch(error => {
        Logger.error("Failed to revoke session during logout", {
          userId,
          sessionId: sessionId.substring(0, 8) + '...',
          error: error.message,
        });
      });
    }

    Logger.logAuth("USER_LOGOUT", userId, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    return {
      message: "Logout successful",
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      Logger.debug("Attempting to verify refresh token", {
        tokenSnippet: refreshToken ? refreshToken.substring(0, 20) + '...' : 'null',
        isJwt: refreshToken && refreshToken.startsWith('ey'),
      });

      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );

      if (decoded.type !== "refresh") {
        throw ApiError.unauthorized("Invalid refresh token");
      }

      const user = await AuthRepository.findById(decoded.userId);

      if (!user) {
        throw ApiError.unauthorized("User not found");
      }

      if (!user.isActive || !user.isEmailVerified) {
        throw ApiError.unauthorized("Account is not active");
      }

      // Generate new tokens (Preserve session ID)
      const token = this.generateToken(user._id, decoded.sid);
      const newRefreshToken = this.generateRefreshToken(user._id, decoded.sid);

      return {
        token,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw ApiError.unauthorized("Refresh token has expired");
      }
      throw ApiError.unauthorized("Invalid refresh token");
    }
  }

  // Add these methods to your existing AuthService class:

  /**
   * Handle Google OAuth callback success
   */
  async handleGoogleCallback(user, req, rememberMe = true) {
    try {
      // Check 2FA
      if (user.twoFactorEnabled) {
          const tempToken = this.generateTempToken(user._id, 'google-oauth');
          return {
              requires2FA: true,
              tempAuthToken: tempToken,
              authProvider: "google"
          };
      }

      // Create session
      const requestInfo = RequestInfoService.extractRequestInfo(req);
      const sessionId = await SessionService.createSession(user._id.toString(), {
        deviceType: requestInfo.deviceType,
        browser: requestInfo.browser,
        os: requestInfo.os,
        ipAddress: requestInfo.ipAddress,
        country: requestInfo.country,
        city: requestInfo.city,
      });

      // Generate tokens with sessionId
      const token = this.generateToken(user._id, sessionId, rememberMe);
      const refreshToken = this.generateRefreshToken(user._id, sessionId);

      // Record login activity
      await SecurityService.recordLoginAttempt({
        userId: user._id,
        sessionId,
        authMethod: 'google-oauth',
        twoFactorUsed: false,
        status: 'success',
        req,
      }).catch(error => {
        Logger.error('Failed to record Google OAuth login activity', {
          userId: user._id,
          error: error.message,
        });
      });

      // Enrich and remove sensitive fields
      const userResponse = this._enrichUserWithBoosts(user);
      delete userResponse.password;
      delete userResponse.passwordHistory;
      delete userResponse.googleId;
      delete userResponse.emailVerificationToken;
      delete userResponse.emailVerificationExpires;
      delete userResponse.passwordResetToken;
      delete userResponse.passwordResetExpires;
      delete userResponse.twoFactorSecret;
      delete userResponse.backupCodes;

      return {
        user: userResponse,
        token,
        refreshToken,
        expiresIn: rememberMe ? "30d" : "7d",
        authProvider: "google",
      };
    } catch (error) {
      Logger.error("Error handling Google callback", {
        error: error.message,
        userId: user._id,
      });
      throw error;
    }
  }

  /**
   * Unlink Google account and set password for local auth
   */
  async unlinkGoogleAndSetPassword(userId, newPassword, req) {
    try {
      const user = await AuthRepository.findByIdWithGoogle(userId);

      if (!user) {
        throw ApiError.notFound("User not found");
      }

      if (!user.isActive) {
        throw ApiError.forbidden("Your account has been deactivated");
      }

      if (user.authProvider !== "google") {
        throw ApiError.badRequest("This account is not linked with Google");
      }

      if (!user.googleId) {
        throw ApiError.badRequest("No Google account to unlink");
      }

      // Unlink Google account
      await AuthRepository.unlinkGoogleAccount(userId);

      // Set password
      user.password = newPassword;
      user.authProvider = "local";
      user.passwordChangedAt = new Date();
      await user.save();

      Logger.logAuth("GOOGLE_ACCOUNT_UNLINKED", userId, {
        email: user.email,
        ip: req?.ip,
        newAuthProvider: "local",
      });

      return {
        message:
          "Google account unlinked successfully. You can now login with email and password.",
      };
    } catch (error) {
      Logger.error("Error unlinking Google account", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if email is available (for Google OAuth)
   */
  async checkEmailAvailability(email) {
    try {
      const user = await AuthRepository.findByEmail(email);
      return {
        available: !user,
        exists: !!user,
        authProvider: user?.authProvider || null,
      };
    } catch (error) {
      Logger.error("Error checking email availability", {
        error: error.message,
        email,
      });
      throw error;
    }
  }

  

  /**
   * Handle Facebook OAuth callback success
   */
  async handleFacebookCallback(user, req, rememberMe = true) {
    try {
      // Check 2FA
      if (user.twoFactorEnabled) {
          const tempToken = this.generateTempToken(user._id, 'facebook-oauth');
          return {
              requires2FA: true,
              tempAuthToken: tempToken,
              authProvider: "facebook"
          };
      }

      // Create session
      const requestInfo = RequestInfoService.extractRequestInfo(req);
      const sessionId = await SessionService.createSession(user._id.toString(), {
        deviceType: requestInfo.deviceType,
        browser: requestInfo.browser,
        os: requestInfo.os,
        ipAddress: requestInfo.ipAddress,
        country: requestInfo.country,
        city: requestInfo.city,
      });

      const token = this.generateToken(user._id, sessionId, rememberMe);
      const refreshToken = this.generateRefreshToken(user._id, sessionId);

      // Record login activity
      await SecurityService.recordLoginAttempt({
        userId: user._id,
        sessionId,
        authMethod: 'facebook-oauth',
        twoFactorUsed: false,
        status: 'success',
        req,
      }).catch(error => {
        Logger.error('Failed to record Facebook OAuth login activity', {
          userId: user._id,
          error: error.message,
        });
      });

      // Enrich and remove sensitive fields
      const userResponse = this._enrichUserWithBoosts(user);
      delete userResponse.password;
      delete userResponse.passwordHistory;
      delete userResponse.facebookId;
      delete userResponse.googleId;
      delete userResponse.emailVerificationToken;
      delete userResponse.emailVerificationExpires;
      delete userResponse.passwordResetToken;
      delete userResponse.passwordResetExpires;
      delete userResponse.twoFactorSecret;
      delete userResponse.backupCodes;

      return {
        user: userResponse,
        token,
        refreshToken,
        expiresIn: rememberMe ? "30d" : "7d",
        authProvider: "facebook",
      };
    } catch (error) {
      Logger.error("Error handling Facebook callback", {
        error: error.message,
        userId: user._id,
      });
      throw error;
    }
  }

  /**
   * Unlink Facebook account and set password for local auth
   */
  async unlinkFacebookAndSetPassword(userId, newPassword, req) {
    try {
      const user = await AuthRepository.findByIdWithFacebook(userId);

      if (!user) {
        throw ApiError.notFound("User not found");
      }

      if (!user.isActive) {
        throw ApiError.forbidden("Your account has been deactivated");
      }

      if (user.authProvider !== "facebook") {
        throw ApiError.badRequest("This account is not linked with Facebook");
      }

      if (!user.facebookId) {
        throw ApiError.badRequest("No Facebook account to unlink");
      }

      await AuthRepository.unlinkFacebookAccount(userId);

      user.password = newPassword;
      user.authProvider = "local";
      user.passwordChangedAt = new Date();
      await user.save();

      Logger.logAuth("FACEBOOK_ACCOUNT_UNLINKED", userId, {
        email: user.email,
        ip: req?.ip,
        newAuthProvider: "local",
      });

      return {
        message:
          "Facebook account unlinked successfully. You can now login with email and password.",
      };
    } catch (error) {
      Logger.error("Error unlinking Facebook account", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(userId) {
    try {
      const user = await AuthRepository.updateUser(userId, { onboardingComplete: true });
      
      if (!user) {
        throw ApiError.notFound("User not found");
      }

      Logger.info("Onboarding marked as complete", { userId });
      
      return {
        user,
        message: "Onboarding marked as complete successfully",
      };
    } catch (error) {
      Logger.error("Error marking onboarding as complete", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Enrich user response with boost summary for frontend display
   */
  _enrichUserWithBoosts(user) {
    const userObj = user.toObject ? user.toObject() : user;
    const plan = PLAN_LIMITS[userObj.plan || 'FREE'] || PLAN_LIMITS.FREE;
    
    // Calculate Next Reset Date
    const lastReset = userObj.lastMonthlyReset || userObj.createdAt || new Date();
    const nextReset = new Date(lastReset);
    nextReset.setDate(nextReset.getDate() + 30);

    userObj.boosts = {
      total: userObj.totalBoosts, // Virtual: subscription + topup
      remaining: Math.max(0, userObj.totalBoosts - userObj.usedBoosts),
      subscription: {
        total: userObj.subscriptionBoosts,
        used: userObj.subscriptionBoostsUsed,
        remaining: Math.max(0, userObj.subscriptionBoosts - userObj.subscriptionBoostsUsed)
      },
      topup: {
        total: userObj.topupBoosts,
        used: userObj.topupBoostsUsed,
        remaining: Math.max(0, userObj.topupBoosts - userObj.topupBoostsUsed)
      },
      monthlyLimit: plan.monthlyBoosts,
      monthlyUsed: userObj.monthlyUsedBoosts || 0,
      monthlyRemaining: Math.max(0, plan.monthlyBoosts - (userObj.monthlyUsedBoosts || 0)),
      nextResetDate: nextReset,
      isMonthlyLimitReached: (userObj.monthlyUsedBoosts || 0) >= plan.monthlyBoosts
    };

    return userObj;
  }
}

export default new AuthService();
