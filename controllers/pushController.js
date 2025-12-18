import PushService from '../services/pushService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { VAPID_PUBLIC_KEY } from '../config/webPush.js';

class PushController {
  /**
   * Get VAPID public key
   * GET /api/push/vapid-public-key
   */
  async getVapidPublicKey(req, res) {
    ApiResponse.success(res, 200, 'VAPID public key retrieved', {
      publicKey: VAPID_PUBLIC_KEY,
    });
  }

  /**
   * Subscribe to push notifications
   * POST /api/push/subscribe
   */
  async subscribe(req, res) {
    const userId = req.user._id;
    const { subscription } = req.body;
    const userAgent = req.headers['user-agent'];

    const result = await PushService.saveSubscription(userId, subscription, userAgent);

    ApiResponse.success(res, 201, 'Push subscription saved successfully', {
      subscription: {
        id: result._id,
        endpoint: result.endpoint.substring(0, 50) + '...',
        createdAt: result.createdAt,
      },
    });
  }

  /**
   * Unsubscribe from push notifications
   * DELETE /api/push/unsubscribe
   */
  async unsubscribe(req, res) {
    const userId = req.user._id;

    const result = await PushService.removeUserSubscriptions(userId);

    ApiResponse.success(res, 200, 'Push subscriptions removed successfully', result);
  }

  /**
   * Get user's subscription status
   * GET /api/push/status
   */
  async getStatus(req, res) {
    const userId = req.user._id;

    const count = await PushService.getUserSubscriptionCount(userId);

    ApiResponse.success(res, 200, 'Subscription status retrieved', {
      subscribed: count > 0,
      subscriptionCount: count,
    });
  }
}

export default new PushController();
