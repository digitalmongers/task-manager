import AuthService from "../services/authService.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HTTP_STATUS } from "../config/constants.js";
import passport from "../config/passport.js";
import Logger from "../config/logger.js";
import ExportService from "../services/exportService.js";

class AuthController {

  
  getRedirectUrl() {
    
    if (process.env.REDIRECT_URL) {
      return process.env.REDIRECT_URL.trim();
    }
    
    
    if (process.env.FRONTEND_URL) {
      const urls = process.env.FRONTEND_URL.split(',');
      return urls[0].trim();
    }
    
    // Fallback
    return 'http://localhost:3000';
  }
  
  async register(req, res) {
    // Add invitationToken to body if present
    const userData = { ...req.body };
    const result = await AuthService.register(userData);

    return ApiResponse.created(res, result.message, { user: result.user });
  }

 
  async login(req, res) {
    // Pass invitationToken if present
    const result = await AuthService.login(req.body, req);

    // Check for 2FA requirement
    if (result.requires2FA) {
      return ApiResponse.success(res, HTTP_STATUS.OK, "Two-factor authentication required", {
        requires2FA: true,
        tempAuthToken: result.tempAuthToken,
        authProvider: result.authProvider || 'local'
      });
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' allows cross-origin cookies
      maxAge: req.body.rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000, // 30 days or 7 days
    };

    res.cookie("token", result.token, cookieOptions);
    res.cookie("refreshToken", result.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return ApiResponse.success(res, HTTP_STATUS.OK, "Login successful", {
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  }

  
  async verifyEmail(req, res) {
    const { token } = req.params;
    const result = await AuthService.verifyEmail(token);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      user: result.user,
    });
  }

  
  async resendVerification(req, res) {
    const { email } = req.body;
    const result = await AuthService.resendVerification(email);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  
  async forgotPassword(req, res) {
    const { email } = req.body;

    // Pass req for IP tracking
    const result = await AuthService.forgotPassword(email, req);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  
  async resetPassword(req, res) {
    const { token } = req.params;
    const { password } = req.body;

    // Pass req for IP tracking
    const result = await AuthService.resetPassword(token, password, req);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  
  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;

    
    const result = await AuthService.changePassword(
      req.user._id,
      currentPassword,
      newPassword,
      req
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  
  async getCurrentUser(req, res) {
    const user = await AuthService.getCurrentUser(req.user._id);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      "User profile fetched successfully",
      { user }
    );
  }

  
  
  async updateProfile(req, res) {
    const result = await AuthService.updateProfile(req.user._id, req.body, req);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      user: result.user,
    });
  }

  
  
  async updateAvatar(req, res) {
    if (!req.file) {
      throw ApiError.badRequest("Profile photo is required");
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw ApiError.badRequest("Only JPEG, PNG, and WebP images are allowed");
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      throw ApiError.badRequest("Profile photo must be less than 5MB");
    }

    const result = await AuthService.updateAvatar(req.user._id, req.file, req);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      user: result.user,
    });
  }

  
  
  async deleteAvatar(req, res) {
    const result = await AuthService.deleteAvatar(req.user._id, req);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      user: result.user,
    });
  }

  
  
  async deleteAccount(req, res) {
    const { password } = req.body;

    if (!password) {
      throw ApiError.badRequest("Password is required to delete account");
    }

    const result = await AuthService.deleteAccount(req.user._id, password, req);

    // Clear cookies
    res.clearCookie("token");
    res.clearCookie("refreshToken");

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  
  async logout(req, res) {
    const result = await AuthService.logout(req.user._id, req);

    // Clear cookies
    res.clearCookie("token");
    res.clearCookie("refreshToken");

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

    async refreshToken(req, res) {
    const { refreshToken } = req.body || req.cookies;

    if (!refreshToken) {
      throw ApiError.unauthorized("Refresh token is required");
    }

    const result = await AuthService.refreshToken(refreshToken);

    // Update cookies with cross-origin support
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    res.cookie("token", result.token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie("refreshToken", result.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      "Token refreshed successfully",
      result
    );
  }

  

  // Initiate Google OAuth
  googleAuth(req, res, next) {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      accessType: "offline",
      prompt: "consent",
    })(req, res, next);
  }

  // Google OAuth callback
    async googleCallback(req, res, next) {
    passport.authenticate(
      "google",
      { session: false },
      async (err, user, info) => {
        try {
          
          const redirectBase = this.getRedirectUrl();

          if (err) {
            Logger.error("Google OAuth authentication error", {
              error: err.message,
              stack: err.stack,
            });

            const errorUrl = `${redirectBase}/auth/google/error?error=${encodeURIComponent(err.message)}`;
            return res.redirect(errorUrl);
          }

          if (!user) {
            Logger.warn("Google OAuth: No user returned", { info });
            const errorUrl = `${redirectBase}/auth/google/error?error=authentication_failed`;
            return res.redirect(errorUrl);
          }

          const result = await AuthService.handleGoogleCallback(user, req, true);

          // Check for 2FA requirement
          if (result.requires2FA) {
             const redirectBase = this.getRedirectUrl();
             // Redirect to 2FA verification page
             const twoFactorUrl = `${redirectBase}/auth/2fa/verify?tempToken=${result.tempAuthToken}&requires2FA=true`;
             return res.redirect(twoFactorUrl);
          }

          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000,
          };

          res.cookie("token", result.token, cookieOptions);
          res.cookie("refreshToken", result.refreshToken, cookieOptions);

          
          const successUrl = `${redirectBase}/auth/google/success?token=${result.token}&refreshToken=${result.refreshToken}`;
          return res.redirect(successUrl);
        } catch (error) {
          Logger.error("Error in Google callback handler", {
            error: error.message,
            stack: error.stack,
          });

          const redirectBase = this.getRedirectUrl();
          const errorUrl = `${redirectBase}/auth/google/error?error=server_error`;
          return res.redirect(errorUrl);
        }
      }
    )(req, res, next);
  }

  // Unlink Google account
  async unlinkGoogle(req, res) {
    const { password } = req.body;

    if (!password) {
      throw ApiError.badRequest(
        "Password is required to unlink Google account"
      );
    }

    const result = await AuthService.unlinkGoogleAndSetPassword(
      req.user._id,
      password,
      req
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

    async checkEmail(req, res) {
    const { email } = req.body;

    if (!email) {
      throw ApiError.badRequest("Email is required");
    }

    const result = await AuthService.checkEmailAvailability(email);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      "Email availability checked",
      result
    );
  }

  // Initiate Facebook OAuth
    facebookAuth(req, res, next) {
    passport.authenticate("facebook", {
      scope: ["email", "public_profile"],
    })(req, res, next);
  }

  // Facebook OAuth callback
  async facebookCallback(req, res, next) {
    passport.authenticate(
      "facebook",
      { session: false },
      async (err, user, info) => {
        try {
          
          const redirectBase = this.getRedirectUrl();

          if (err) {
            Logger.error("Facebook OAuth authentication error", {
              error: err.message,
              stack: err.stack,
            });

            const errorUrl = `${redirectBase}/auth/facebook/error?error=${encodeURIComponent(err.message)}`;
            return res.redirect(errorUrl);
          }

          if (!user) {
            Logger.warn("Facebook OAuth: No user returned", { info });
            const errorUrl = `${redirectBase}/auth/facebook/error?error=authentication_failed`;
            return res.redirect(errorUrl);
          }

          const result = await AuthService.handleFacebookCallback(user, req, true);

          // Check for 2FA requirement
          if (result.requires2FA) {
             const redirectBase = this.getRedirectUrl();
             // Redirect to 2FA verification page
             const twoFactorUrl = `${redirectBase}/auth/2fa/verify?tempToken=${result.tempAuthToken}&requires2FA=true`;
             return res.redirect(twoFactorUrl);
          }

          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000,
          };

          res.cookie("token", result.token, cookieOptions);
          res.cookie("refreshToken", result.refreshToken, cookieOptions);

          
          const successUrl = `${redirectBase}/auth/facebook/success?token=${result.token}&refreshToken=${result.refreshToken}`;
          return res.redirect(successUrl);
        } catch (error) {
          Logger.error("Error in Facebook callback handler", {
            error: error.message,
            stack: error.stack,
          });

          const redirectBase = this.getRedirectUrl();
          const errorUrl = `${redirectBase}/auth/facebook/error?error=server_error`;
          return res.redirect(errorUrl);
        }
      }
    )(req, res, next);
  }

  // Unlink Facebook account
  async unlinkFacebook(req, res) {
    const { password } = req.body;

    if (!password) {
      throw ApiError.badRequest(
        "Password is required to unlink Facebook account"
      );
    }

    const result = await AuthService.unlinkFacebookAndSetPassword(
      req.user._id,
      password,
      req
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  /**
   * Export all user data to PDF
   * GET /api/auth/export-data
   */
  async exportUserData(req, res) {
    const userId = req.user._id;

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=user-data-${Date.now()}.pdf`);

    await ExportService.generateUserDataPdf(userId, res);
  }

  /**
   * Mark onboarding as complete
   * PATCH /api/auth/onboarding-complete
   */
  async completeOnboarding(req, res) {
    const userId = req.user._id;
    const result = await AuthService.completeOnboarding(userId);

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      user: result.user,
    });
  }
}

export default new AuthController();
