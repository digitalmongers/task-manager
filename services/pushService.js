import webPush from '../config/webPush.js';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';
import Logger from '../config/logger.js';

class PushService {
  /**
   * Save or update push subscription for a user
   */
  async saveSubscription(userId, subscription, userAgent = null) {
    try {
      const { endpoint, keys } = subscription;

      // Validate subscription data
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error('Invalid subscription data');
      }

      // Check if subscription already exists
      const existingSubscription = await PushSubscription.findOne({ endpoint });

      if (existingSubscription) {
        // Update existing subscription
        existingSubscription.user = userId;
        existingSubscription.keys = keys;
        existingSubscription.userAgent = userAgent;
        await existingSubscription.save();

        Logger.info('Push subscription updated', {
          userId,
          endpoint: endpoint.substring(0, 50) + '...',
        });

        return existingSubscription;
      }

      // Create new subscription
      const newSubscription = await PushSubscription.create({
        user: userId,
        endpoint,
        keys,
        userAgent,
      });

      // Enable push notifications for user
      await User.findByIdAndUpdate(userId, { pushEnabled: true });

      Logger.info('Push subscription created', {
        userId,
        endpoint: endpoint.substring(0, 50) + '...',
      });

      return newSubscription;
    } catch (error) {
      Logger.error('Error saving push subscription', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Remove all subscriptions for a user
   */
  async removeUserSubscriptions(userId) {
    try {
      const result = await PushSubscription.deleteMany({ user: userId });

      // Disable push notifications for user
      await User.findByIdAndUpdate(userId, { pushEnabled: false });

      Logger.info('User subscriptions removed', {
        userId,
        count: result.deletedCount,
      });

      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      Logger.error('Error removing user subscriptions', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Remove subscription by endpoint (for invalid/expired subscriptions)
   */
  async removeSubscriptionByEndpoint(endpoint) {
    try {
      await PushSubscription.removeByEndpoint(endpoint);

      Logger.info('Subscription removed by endpoint', {
        endpoint: endpoint.substring(0, 50) + '...',
      });
    } catch (error) {
      Logger.error('Error removing subscription by endpoint', {
        error: error.message,
      });
    }
  }

  /**
   * Send push notification to a specific user
   */
  async sendPushToUser(userId, payload) {
    try {
      // Check if user has push enabled
      const user = await User.findById(userId);
      if (!user || !user.pushEnabled) {
        Logger.debug('Push notifications disabled for user', { userId });
        return { sent: 0, failed: 0 };
      }

      // Get all subscriptions for user
      const subscriptions = await PushSubscription.getUserSubscriptions(userId);

      if (subscriptions.length === 0) {
        Logger.debug('No push subscriptions found for user', { userId });
        return { sent: 0, failed: 0 };
      }

      // Prepare notification payload
      const notificationPayload = JSON.stringify({
        title: payload.title || 'Task Manager',
        body: payload.body || 'You have a new notification',
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/badge-72x72.png',
        url: payload.url || '/',
        data: payload.data || {},
      });

      let sent = 0;
      let failed = 0;

      // Send to all user subscriptions
      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          };

          await webPush.sendNotification(pushSubscription, notificationPayload);

          // Update last used timestamp
          await subscription.updateLastUsed();

          sent++;

          Logger.debug('Push notification sent', {
            userId,
            endpoint: subscription.endpoint.substring(0, 50) + '...',
          });
        } catch (error) {
          failed++;

          // Handle subscription errors
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or not found - remove it
            Logger.warn('Removing invalid push subscription', {
              userId,
              statusCode: error.statusCode,
              endpoint: subscription.endpoint.substring(0, 50) + '...',
            });

            await this.removeSubscriptionByEndpoint(subscription.endpoint);
          } else {
            Logger.error('Error sending push notification', {
              error: error.message,
              statusCode: error.statusCode,
              userId,
            });
          }
        }
      });

      await Promise.all(sendPromises);

      Logger.info('Push notifications sent to user', {
        userId,
        sent,
        failed,
        total: subscriptions.length,
      });

      return { sent, failed };
    } catch (error) {
      Logger.error('Error in sendPushToUser', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendPushToMultipleUsers(userIds, payload) {
    try {
      const results = await Promise.all(
        userIds.map((userId) => this.sendPushToUser(userId, payload))
      );

      const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

      Logger.info('Bulk push notifications sent', {
        users: userIds.length,
        sent: totalSent,
        failed: totalFailed,
      });

      return { sent: totalSent, failed: totalFailed };
    } catch (error) {
      Logger.error('Error in sendPushToMultipleUsers', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user's active subscriptions count
   */
  async getUserSubscriptionCount(userId) {
    try {
      return await PushSubscription.countDocuments({ user: userId });
    } catch (error) {
      Logger.error('Error getting subscription count', {
        error: error.message,
        userId,
      });
      return 0;
    }
  }
}

export default new PushService();
