import SuggestionRepository from "../repositories/suggestionRepository.js";
import EmailService from "./emailService.js";
import ApiError from "../utils/ApiError.js";
import Logger from "../config/logger.js";

class SuggestionService {
  /**
   * Submit new suggestion
   */
  async submitSuggestion(userId, suggestionData, req) {
    const { title, description, message, userEmail } = suggestionData;

    try {
      // Create suggestion in database
      const suggestion = await SuggestionRepository.createSuggestion({
        user: userId,
        title,
        description,
        message,
        userEmail,
        submittedAt: new Date(),
        ipAddress: req?.ip || null,
        userAgent: req?.get('user-agent') || null,
      });

      // Get user details for email
      const user = await suggestion.populate('user', 'firstName lastName');
      const userName = `${user.user.firstName} ${user.user.lastName}`;

      // Prepare email data
      const emailData = {
        userName,
        userEmail,
        title,
        description,
        message,
        submittedAt: suggestion.submittedAt,
        ipAddress: suggestion.ipAddress,
        suggestionId: suggestion._id,
      };

      // Send notification email to support (don't wait)
      EmailService.sendSuggestionEmail(emailData).catch((error) => {
        Logger.error('Failed to send suggestion email to support', {
          suggestionId: suggestion._id,
          error: error.message,
        });
      });

      // Send confirmation email to user (don't wait)
      EmailService.sendSuggestionConfirmation(emailData).catch((error) => {
        Logger.error('Failed to send suggestion confirmation to user', {
          suggestionId: suggestion._id,
          error: error.message,
        });
      });

      Logger.logAuth('SUGGESTION_SUBMITTED', userId, {
        suggestionId: suggestion._id,
        title: title,
        email: userEmail,
        ip: req?.ip,
      });

      return {
        suggestion,
        message: 'Thank you for your suggestion! We have received it and will review it soon.',
      };
    } catch (error) {
      Logger.error('Error submitting suggestion', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user's suggestions
   */
  async getUserSuggestions(userId, options) {
    try {
      const result = await SuggestionRepository.getUserSuggestions(userId, options);
      return result;
    } catch (error) {
      Logger.error('Error fetching user suggestions', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get single suggestion
   */
  async getSuggestion(suggestionId, userId) {
    try {
      const suggestion = await SuggestionRepository.findById(suggestionId);

      if (!suggestion) {
        throw ApiError.notFound('Suggestion not found');
      }

      // Ensure user can only view their own suggestion
      if (suggestion.user._id.toString() !== userId.toString()) {
        throw ApiError.forbidden('You do not have permission to view this suggestion');
      }

      return suggestion;
    } catch (error) {
      Logger.error('Error fetching suggestion', {
        suggestionId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }
}

export default new SuggestionService();