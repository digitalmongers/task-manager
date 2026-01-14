import SuggestionService from '../services/suggestionService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { formatToLocal } from '../utils/dateUtils.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../config/constants.js';

class SuggestionController {
  /**
   * Submit new suggestion
   */
  async submitSuggestion(req, res) {
    const result = await SuggestionService.submitSuggestion(
      req.user._id,
      req.body,
      req
    );

    return ApiResponse.created(res, result.message, {
      suggestion: result.suggestion,
    });
  }

  /**
   * Get user's suggestions
   */
  async getUserSuggestions(req, res) {
    const { page, limit } = req.query;
    
    const result = await SuggestionService.getUserSuggestions(req.user._id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });

    // Localize timestamps
    const localizedSuggestions = result.suggestions.map(suggestion => {
      const s = suggestion.toObject ? suggestion.toObject() : suggestion;
      return {
        ...s,
        createdAtLocal: formatToLocal(suggestion.createdAt, req.timezone),
        updatedAtLocal: formatToLocal(suggestion.updatedAt, req.timezone),
      };
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Suggestions fetched successfully',
      {
        ...result,
        suggestions: localizedSuggestions,
      }
    );
  }

  /**
   * Get single suggestion
   */
  async getSuggestion(req, res) {
    const { id } = req.params;
    
    const suggestion = await SuggestionService.getSuggestion(id, req.user._id);

    // Localize timestamps
    const s = suggestion.toObject ? suggestion.toObject() : suggestion;
    const localizedSuggestion = {
      ...s,
      createdAtLocal: formatToLocal(suggestion.createdAt, req.timezone),
      updatedAtLocal: formatToLocal(suggestion.updatedAt, req.timezone),
    };

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Suggestion fetched successfully',
      { suggestion: localizedSuggestion }
    );
  }
}

export default new SuggestionController();