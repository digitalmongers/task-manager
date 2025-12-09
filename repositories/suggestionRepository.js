import Suggestion from "../models/Suggestion.js";
import Logger from "../config/logger.js";

class SuggestionRepository {
  /**
   * Create new suggestion
   */
  async createSuggestion(suggestionData) {
    try {
      const suggestion = await Suggestion.create(suggestionData);
      
      Logger.info("Suggestion created successfully", {
        suggestionId: suggestion._id,
        userId: suggestion.user,
        title: suggestion.title,
      });
      
      return suggestion;
    } catch (error) {
      Logger.error("Error creating suggestion", { 
        error: error.message,
        userId: suggestionData.user 
      });
      throw error;
    }
  }

  /**
   * Find suggestion by ID
   */
  async findById(suggestionId) {
    try {
      const suggestion = await Suggestion.findById(suggestionId)
        .populate('user', 'firstName lastName email avatar');
      return suggestion;
    } catch (error) {
      Logger.error("Error finding suggestion", { 
        error: error.message,
        suggestionId 
      });
      throw error;
    }
  }

  /**
   * Get user's suggestions
   */
  async getUserSuggestions(userId, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const skip = (page - 1) * limit;

      const suggestions = await Suggestion.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'firstName lastName email avatar');

      const total = await Suggestion.countDocuments({ user: userId });

      return {
        suggestions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      Logger.error("Error getting user suggestions", { 
        error: error.message,
        userId 
      });
      throw error;
    }
  }

  /**
   * Get suggestion stats
   */
  async getSuggestionStats() {
    try {
      const stats = await Suggestion.aggregate([
        {
          $group: {
            _id: null,
            totalSuggestions: { $sum: 1 },
          },
        },
      ]);

      return stats[0] || { totalSuggestions: 0 };
    } catch (error) {
      Logger.error("Error getting suggestion stats", { 
        error: error.message 
      });
      throw error;
    }
  }
}

export default new SuggestionRepository();