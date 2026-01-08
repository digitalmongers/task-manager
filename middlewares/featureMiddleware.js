import { PLAN_LIMITS } from '../config/aiConfig.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * Middleware to restrict access based on Plan Features
 * @param {string} feature - The feature key to check (e.g., 'CHAT', 'AI_INSIGHTS')
 */
export const requireFeature = (feature) => {
  return (req, res, next) => {
    try {
      // User should be attached by 'protect' middleware already
      const user = req.user;

      if (!user) {
        return next(ApiError.unauthorized('User not authenticated'));
      }

      const userPlan = user.plan || 'FREE';
      const planDetails = PLAN_LIMITS[userPlan];

      if (!planDetails) {
        Logger.error('Invalid user plan encountered', { userId: user._id, plan: userPlan });
        return next(ApiError.forbidden('Invalid subscription plan'));
      }

      const features = planDetails.aiFeatures || [];

      // Check for specific feature OR 'ALL' admin/team capability
      if (!features.includes(feature) && !features.includes('ALL')) {
        return next(ApiError.forbidden(`Your ${userPlan} plan does not include access to ${feature}. Please upgrade to access this feature.`));
      }

      next();
    } catch (error) {
      Logger.error('Feature restriction middleware error', { error: error.message });
      next(ApiError.internal('Internal server error during feature check'));
    }
  };
};
