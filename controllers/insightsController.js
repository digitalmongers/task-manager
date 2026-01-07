import insightsService from '../services/insightsService.js';
import ApiResponse from '../utils/ApiResponse.js';
import Logger from '../config/logger.js';

export const getInsights = async (req, res) => {
  try {
    const userId = req.user._id;
    const insights = await insightsService.generateInsights(userId);
    ApiResponse.success(res, 200, 'Insights generated successfully', insights);
  } catch (error) {
    Logger.error('Error in getInsights', { error: error.message, userId: req.user?._id });
    // Use proper error handling that server expects
    if (error.statusCode) {
        ApiResponse.error(res, error.statusCode, error.message);
    } else {
        ApiResponse.error(res, 500, error.message || 'Failed to generate insights');
    }
  }
};
