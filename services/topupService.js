import User from '../models/User.js';
import Logger from '../config/logger.js';
import ApiError from '../utils/ApiError.js';
import cacheService from './cacheService.js';
import WebSocketService from '../config/websocket.js';

class TopupService {
  /**
   * Add boosts to user's account (Atomic operation)
   * @param {String} userId - User ID
   * @param {Number} boostAmount - Number of boosts to add
   * @returns {Object} Updated user
   */
  async addBoostsToUser(userId, boostAmount) {
    try {
      if (!userId || !boostAmount || boostAmount <= 0) {
        throw ApiError.badRequest('Invalid userId or boost amount');
      }

      // Atomic update to prevent race conditions
      // Add to top-up boosts (not subscription boosts)
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $inc: { topupBoosts: boostAmount }
        },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw ApiError.notFound('User not found');
      }

      Logger.info('Boosts added to user account', {
        userId,
        boostsAdded: boostAmount,
        newTopupBoosts: user.topupBoosts,
        totalBoosts: (user.subscriptionBoosts || 0) + (user.topupBoosts || 0),
        plan: user.plan
      });

      // Invalidate user cache
      await cacheService.deletePattern(`user:${userId}:*`).catch(err => {
        Logger.warn('Failed to clear user cache after boost top-up', { userId, error: err.message });
      });

      // Send real-time update via WebSocket
      try {
        WebSocketService.sendToUser(userId, 'user:updated', {
          _id: user._id,
          subscriptionBoosts: user.subscriptionBoosts,
          topupBoosts: user.topupBoosts,
          totalBoosts: (user.subscriptionBoosts || 0) + (user.topupBoosts || 0),
          usedBoosts: (user.subscriptionBoostsUsed || 0) + (user.topupBoostsUsed || 0),
          plan: user.plan
        });
      } catch (wsError) {
        Logger.warn('Failed to send WebSocket update after boost top-up', { userId, error: wsError.message });
      }

      return user;
    } catch (error) {
      Logger.error('Failed to add boosts to user', {
        userId,
        boostAmount,
        error: error.message
      });
      throw error;
    }
  }
}

export default new TopupService();
