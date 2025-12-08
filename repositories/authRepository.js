import User from "../models/User.js";
import Logger from "../config/logger.js";
import crypto from "crypto";

class AuthRepository {
  /**
   * Create new user
   */
  async createUser(userData) {
    try {
      const user = await User.create(userData);
      Logger.info("User created successfully", {
        userId: user._id,
        email: user.email,
      });
      return user;
    } catch (error) {
      Logger.error("Error creating user", { error: error.message });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    try {
      const user = await User.findOne({ email });
      return user;
    } catch (error) {
      Logger.error("Error finding user by email", { error: error.message });
      throw error;
    }
  }

  /**
   * Find user by email with password
   */
  async findByEmailWithPassword(email) {
    try {
      const user = await User.findByEmailWithPassword(email);
      return user;
    } catch (error) {
      Logger.error("Error finding user with password", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(userId) {
    try {
      const user = await User.findById(userId);
      return user;
    } catch (error) {
      Logger.error("Error finding user by ID", { error: error.message });
      throw error;
    }
  }

  // ========== NEW METHOD ==========
  /**
   * Find user by ID with password and password history (for password changes)
   */
  async findByIdWithPasswordHistory(userId) {
    try {
      const user = await User.findById(userId).select(
        "+password +passwordHistory +passwordChangedAt"
      );
      return user;
    } catch (error) {
      Logger.error("Error finding user with password history", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find user by ID with password (for account deletion and authentication)
   */
  async findByIdWithPassword(userId) {
    try {
      const user = await User.findById(userId).select("+password");
      return user;
    } catch (error) {
      Logger.error("Error finding user with password", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find user by ID with Google OAuth fields (for unlinking)
   */
  async findByIdWithGoogle(userId) {
    try {
      const user = await User.findById(userId).select(
        "+googleId +authProvider"
      );
      return user;
    } catch (error) {
      Logger.error("Error finding user with Google fields", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find user by ID with Facebook OAuth fields (for unlinking)
   */
  async findByIdWithFacebook(userId) {
    try {
      const user = await User.findById(userId).select("+facebookId +authProvider");
      return user;
    } catch (error) {
      Logger.error("Error finding user with Facebook fields", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    try {
      const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      });
      Logger.info("User updated successfully", { userId });
      return user;
    } catch (error) {
      Logger.error("Error updating user", { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Save user (for instance methods like save())
   */
  async saveUser(user) {
    try {
      await user.save();
      Logger.info("User saved successfully", { userId: user._id });
      return user;
    } catch (error) {
      Logger.error("Error saving user", { error: error.message });
      throw error;
    }
  }

  /**
   * Find user by verification token
   */
  async findByVerificationToken(token) {
    try {
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      }).select("+emailVerificationToken +emailVerificationExpires");

      return user;
    } catch (error) {
      Logger.error("Error finding user by verification token", {
        error: error.message,
      });
      throw error;
    }
  }

  // ========== UPDATED: Now includes passwordHistory ==========
  /**
   * Find user by reset token
   */
  async findByResetToken(token) {
    try {
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      }).select(
        "+passwordResetToken +passwordResetExpires +password +passwordHistory"
      );

      return user;
    } catch (error) {
      Logger.error("Error finding user by reset token", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isEmailVerified: true,
          $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 },
        },
        { new: true }
      );
      Logger.info("Email verified successfully", { userId });
      return user;
    } catch (error) {
      Logger.error("Error verifying email", { error: error.message, userId });
      throw error;
    }
  }

  // ========== UPDATED: Now tracks password history ==========
  /**
   * Update password with history tracking
   */
  async updatePassword(userId, newPassword) {
    try {
      const user = await User.findById(userId).select(
        "+password +passwordHistory +passwordChangedAt"
      );

      if (!user) {
        throw new Error("User not found");
      }

      // Add current password to history before changing
      await user.addToPasswordHistory();

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      user.mustChangePassword = false;

      await user.save();

      // Clear reset token if exists
      await User.findByIdAndUpdate(userId, {
        $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
      });

      Logger.info("Password updated successfully with history tracking", {
        userId,
        passwordHistoryCount: user.passwordHistory?.length || 0,
      });

      return user;
    } catch (error) {
      Logger.error("Error updating password", { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email) {
    try {
      const count = await User.countDocuments({ email });
      return count > 0;
    } catch (error) {
      Logger.error("Error checking email existence", { error: error.message });
      throw error;
    }
  }

  // ========== NEW METHOD ==========
  /**
   * Force password change for user (admin feature)
   */
  async forcePasswordChange(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { mustChangePassword: true },
        { new: true }
      );

      Logger.info("Forced password change flag set", { userId });
      return user;
    } catch (error) {
      Logger.error("Error forcing password change", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ========== NEW METHOD ==========
  /**
   * Get user's password change history
   */
  async getPasswordHistory(userId, limit = 5) {
    try {
      const user = await User.findById(userId).select(
        "+passwordHistory +passwordChangedAt"
      );

      if (!user) {
        return null;
      }

      const history = user.passwordHistory || [];

      return {
        lastChanged: user.passwordChangedAt,
        historyCount: history.length,
        recentChanges: history.slice(-limit).map((h) => ({
          changedAt: h.changedAt,
        })),
      };
    } catch (error) {
      Logger.error("Error getting password history", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ========== UPDATED: Added mustChangePasswordUsers stat ==========
  // ========== NEW METHOD ==========
  /**
   * Update user profile (firstName, lastName, phoneNumber)
   */
  async updateProfile(userId, updateData) {
    try {
      const allowedUpdates = ["firstName", "lastName", "phoneNumber"];
      const filteredData = {};

      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      const user = await User.findByIdAndUpdate(userId, filteredData, {
        new: true,
        runValidators: true,
      });

      Logger.info("User profile updated successfully", {
        userId,
        updatedFields: Object.keys(filteredData),
      });

      return user;
    } catch (error) {
      Logger.error("Error updating user profile", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ========== NEW METHOD ==========
  /**
   * Update user avatar
   */
  async updateAvatar(userId, avatarData) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { avatar: avatarData },
        { new: true, runValidators: true }
      );

      Logger.info("User avatar updated successfully", {
        userId,
        avatarUrl: avatarData.url,
      });

      return user;
    } catch (error) {
      Logger.error("Error updating user avatar", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ========== NEW METHOD ==========
  /**
   * Delete user avatar
   */
  async deleteAvatar(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          avatar: {
            url: null,
            publicId: null,
          },
        },
        { new: true }
      );

      Logger.info("User avatar deleted successfully", { userId });
      return user;
    } catch (error) {
      Logger.error("Error deleting user avatar", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            verifiedUsers: {
              $sum: { $cond: ["$isEmailVerified", 1, 0] },
            },
            activeUsers: {
              $sum: { $cond: ["$isActive", 1, 0] },
            },
            mustChangePasswordUsers: {
              $sum: { $cond: ["$mustChangePassword", 1, 0] },
            },
          },
        },
      ]);

      return (
        stats[0] || {
          totalUsers: 0,
          verifiedUsers: 0,
          activeUsers: 0,
          mustChangePasswordUsers: 0,
        }
      );
    } catch (error) {
      Logger.error("Error getting user stats", { error: error.message });
      throw error;
    }
  }

  /**
   * Delete unverified users older than specified days
   */
  async deleteUnverifiedUsers(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await User.deleteMany({
        isEmailVerified: false,
        createdAt: { $lt: cutoffDate },
      });

      Logger.info(
        `Deleted ${result.deletedCount} unverified users older than ${days} days`
      );
      return result.deletedCount;
    } catch (error) {
      Logger.error("Error deleting unverified users", { error: error.message });
      throw error;
    }
  }

  /**
   * Update user profile (firstName, lastName, phoneNumber)
   */
  async updateProfile(userId, updateData) {
    try {
      // Only allow specific fields to be updated
      const allowedUpdates = ["firstName", "lastName", "phoneNumber"];
      const filteredData = {};

      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      const user = await User.findByIdAndUpdate(userId, filteredData, {
        new: true,
        runValidators: true,
      });

      Logger.info("User profile updated successfully", {
        userId,
        updatedFields: Object.keys(filteredData),
      });

      return user;
    } catch (error) {
      Logger.error("Error updating user profile", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ========== NEW METHOD ==========
  /**
   * Update user avatar
   */
  async updateAvatar(userId, avatarData) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { avatar: avatarData },
        { new: true, runValidators: true }
      );

      Logger.info("User avatar updated successfully", {
        userId,
        avatarUrl: avatarData.url,
      });

      return user;
    } catch (error) {
      Logger.error("Error updating user avatar", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ========== NEW METHOD ==========
  /**
   * Delete user avatar
   */
  async deleteAvatar(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          avatar: {
            url: null,
            publicId: null,
          },
        },
        { new: true }
      );

      Logger.info("User avatar deleted successfully", { userId });
      return user;
    } catch (error) {
      Logger.error("Error deleting user avatar", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Clean up old password history entries (maintenance)
   */
  async cleanupPasswordHistory(maxHistoryCount = 10) {
    try {
      const result = await User.updateMany(
        { "passwordHistory.10": { $exists: true } },
        {
          $push: {
            passwordHistory: {
              $each: [],
              $slice: -maxHistoryCount,
            },
          },
        }
      );

      Logger.info(
        `Cleaned up password history for ${result.modifiedCount} users`
      );
      return result.modifiedCount;
    } catch (error) {
      Logger.error("Error cleaning up password history", {
        error: error.message,
      });
      throw error;
    }
  }

  // Add these methods to your existing AuthRepository class:

  /**
   * Create user via Google OAuth
   */
  async createGoogleUser(userData) {
    try {
      const { googlePhoto, ...restData } = userData;

      let avatarData = {
        url: null,
        publicId: null,
      };

      // If Google photo exists, save it
      if (googlePhoto) {
        avatarData.url = googlePhoto;
        // Google photos don't need publicId as they're hosted by Google
      }

      const user = await User.create({
        ...restData,
        authProvider: "google",
        isEmailVerified: true, // Google emails are pre-verified
        isActive: true,
        avatar: avatarData,
        lastLogin: new Date(),
      });

      Logger.info("Google user created successfully", {
        userId: user._id,
        email: user.email,
        hasPhoto: !!googlePhoto,
      });

      return user;
    } catch (error) {
      Logger.error("Error creating Google user", {
        error: error.message,
        email: userData.email,
      });
      throw error;
    }
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId) {
    try {
      const user = await User.findOne({ googleId }).select("+googleId");
      return user;
    } catch (error) {
      Logger.error("Error finding user by Google ID", {
        error: error.message,
        googleId,
      });
      throw error;
    }
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId, googleData) {
    try {
      const { googleId, googlePhoto } = googleData;

      const updateData = {
        googleId,
        authProvider: "google",
      };

      // If user doesn't have avatar and Google provides one, use it
      const user = await User.findById(userId);
      if (!user.avatar?.url && googlePhoto) {
        updateData.avatar = {
          url: googlePhoto,
          publicId: null,
        };
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      });

      Logger.info("Google account linked successfully", {
        userId,
        googleId,
        photoAdded: !!googlePhoto && !user.avatar?.url,
      });

      return updatedUser;
    } catch (error) {
      Logger.error("Error linking Google account", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId) {
    try {
      await User.findByIdAndUpdate(
        userId,
        { lastLogin: new Date() },
        { new: false } // Don't need the updated document
      );

      Logger.debug("Last login updated", { userId });
    } catch (error) {
      Logger.error("Error updating last login", {
        error: error.message,
        userId,
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Unlink Google account (for users who want to switch to local auth)
   */
  async unlinkGoogleAccount(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $unset: { googleId: 1, googlePhoto: 1 },
          authProvider: "local",
        },
        { new: true }
      );

      Logger.info("Google account unlinked", { userId });
      return user;
    } catch (error) {
      Logger.error("Error unlinking Google account", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  

  /**
   * Create user via Facebook OAuth
   */
  async createFacebookUser(userData) {
    try {
      const { facebookPhoto, ...restData } = userData;

      let avatarData = {
        url: null,
        publicId: null,
      };

      if (facebookPhoto) {
        avatarData.url = facebookPhoto;
      }

      const user = await User.create({
        ...restData,
        authProvider: "facebook",
        isEmailVerified: true,
        isActive: true,
        avatar: avatarData,
        lastLogin: new Date(),
      });

      Logger.info("Facebook user created successfully", {
        userId: user._id,
        email: user.email,
        hasPhoto: !!facebookPhoto,
      });

      return user;
    } catch (error) {
      Logger.error("Error creating Facebook user", {
        error: error.message,
        email: userData.email,
      });
      throw error;
    }
  }

  /**
   * Find user by Facebook ID
   */
  async findByFacebookId(facebookId) {
    try {
      const user = await User.findOne({ facebookId }).select("+facebookId");
      return user;
    } catch (error) {
      Logger.error("Error finding user by Facebook ID", {
        error: error.message,
        facebookId,
      });
      throw error;
    }
  }

  /**
   * Link Facebook account to existing user
   */
  async linkFacebookAccount(userId, facebookData) {
    try {
      const { facebookId, facebookPhoto } = facebookData;

      const updateData = {
        facebookId,
        authProvider: "facebook",
      };

      const user = await User.findById(userId);
      if (!user.avatar?.url && facebookPhoto) {
        updateData.avatar = {
          url: facebookPhoto,
          publicId: null,
        };
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      });

      Logger.info("Facebook account linked successfully", {
        userId,
        facebookId,
        photoAdded: !!facebookPhoto && !user.avatar?.url,
      });

      return updatedUser;
    } catch (error) {
      Logger.error("Error linking Facebook account", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Unlink Facebook account
   */
  async unlinkFacebookAccount(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $unset: { facebookId: 1 },
          authProvider: "local",
        },
        { new: true }
      );

      Logger.info("Facebook account unlinked", { userId });
      return user;
    } catch (error) {
      Logger.error("Error unlinking Facebook account", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }
}

export default new AuthRepository();
