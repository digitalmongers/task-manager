import AuthService from '../services/authService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

class AuthController {
  /**
   * Register new user
   * @route POST /api/v1/auth/register
   */
  async register(req, res) {
    const result = await AuthService.register(req.body);

    return ApiResponse.created(
      res,
      result.message,
      { user: result.user }
    );
  }

  /**
   * Login user
   * @route POST /api/v1/auth/login
   */
  async login(req, res) {
    const result = await AuthService.login(req.body, req);

    // Set token in httpOnly cookie for security
    // For cross-origin (Vercel frontend + Render backend), we need sameSite: 'none' with secure: true
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' allows cross-origin cookies
      maxAge: req.body.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 30 days or 7 days
    };

    res.cookie('token', result.token, cookieOptions);
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Login successful',
      {
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      }
    );
  }

  /**
   * Verify email
   * @route GET /api/v1/auth/verify-email/:token
   */
  async verifyEmail(req, res) {
    const { token } = req.params;
    const result = await AuthService.verifyEmail(token);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message,
      { user: result.user }
    );
  }

  /**
   * Resend verification email
   * @route POST /api/v1/auth/resend-verification
   */
  async resendVerification(req, res) {
    const { email } = req.body;
    const result = await AuthService.resendVerification(email);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message
    );
  }

  /**
 * Forgot password
 * @route POST /api/auth/forgot-password
 */
async forgotPassword(req, res) {
  const { email } = req.body;
  
  // Pass req for IP tracking
  const result = await AuthService.forgotPassword(email, req);

  return ApiResponse.success(
    res,
    HTTP_STATUS.OK,
    result.message
  );
}

/**
 * Reset password
 * @route POST /api/auth/reset-password/:token
 */
async resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;
  
  // Pass req for IP tracking
  const result = await AuthService.resetPassword(token, password, req);

  return ApiResponse.success(
    res,
    HTTP_STATUS.OK,
    result.message
  );
}

  
  /**
   * Change password (authenticated)
   * @route POST /api/auth/change-password
   */
  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    
    // IMPORTANT: Pass req object for IP tracking and security logging
    const result = await AuthService.changePassword(
      req.user._id,
      currentPassword,
      newPassword,
      req
    );

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message
    );
  }

  /**
   * Get current user
   * @route GET /api/auth/me
   */
  async getCurrentUser(req, res) {
    const user = await AuthService.getCurrentUser(req.user._id);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'User profile fetched successfully',
      { user }
    );
  }

  // ========== NEW: Update profile ==========
  /**
   * Update user profile
   * @route PATCH /api/auth/profile
   */
  async updateProfile(req, res) {
    const result = await AuthService.updateProfile(
      req.user._id,
      req.body,
      req
    );

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message,
      { user: result.user }
    );
  }

  // ========== NEW: Update avatar ==========
  /**
   * Update profile photo
   * @route PUT /api/auth/avatar
   */
  async updateAvatar(req, res) {
    if (!req.file) {
      throw ApiError.badRequest('Profile photo is required');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw ApiError.badRequest('Only JPEG, PNG, and WebP images are allowed');
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      throw ApiError.badRequest('Profile photo must be less than 5MB');
    }

    const result = await AuthService.updateAvatar(
      req.user._id,
      req.file,
      req
    );

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message,
      { user: result.user }
    );
  }

  // ========== NEW: Delete avatar ==========
  /**
   * Delete profile photo
   * @route DELETE /api/auth/avatar
   */
  async deleteAvatar(req, res) {
    const result = await AuthService.deleteAvatar(req.user._id, req);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message,
      { user: result.user }
    );
  }

  // ========== NEW: Delete account ==========
  /**
   * Delete user account
   * @route DELETE /api/auth/account
   */
  async deleteAccount(req, res) {
    const { password } = req.body;

    if (!password) {
      throw ApiError.badRequest('Password is required to delete account');
    }

    const result = await AuthService.deleteAccount(
      req.user._id,
      password,
      req
    );

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message
    );
  }

  /**
   * Logout user
   * @route POST /api/v1/auth/logout
   */
  async logout(req, res) {
    const result = await AuthService.logout(req.user._id, req);

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      result.message
    );
  }

  /**
   * Refresh access token
   * @route POST /api/v1/auth/refresh-token
   */
  async refreshToken(req, res) {
    const { refreshToken } = req.body || req.cookies;

    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token is required');
    }

    const result = await AuthService.refreshToken(refreshToken);

    // Update cookies with cross-origin support
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    };

    res.cookie('token', result.token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Token refreshed successfully',
      result
    );
  }
}

export default new AuthController();