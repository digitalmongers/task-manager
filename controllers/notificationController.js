import NotificationService from '../services/notificationService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { formatToLocal } from '../utils/dateUtils.js';

class NotificationController {
  /**
   * Get user notifications
   * GET /api/notifications
   */
  async getNotifications(req, res) {
    const userId = req.user._id;
    const {
      limit = 20,
      skip = 0,
      isRead,
      type,
      teamId,
    } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : null,
      type,
      teamId,
    };

    const result = await NotificationService.getUserNotifications(userId, options);

    // Localize timestamps
    const localizedNotifications = result.notifications.map(notification => {
      const n = notification.toObject ? notification.toObject() : notification;
      return {
        ...n,
        createdAtLocal: formatToLocal(notification.createdAt, req.timezone),
        updatedAtLocal: formatToLocal(notification.updatedAt, req.timezone),
      };
    });

    ApiResponse.success(res, 200, 'Notifications fetched successfully', {
      notifications: localizedNotifications,
      pagination: result.pagination || { total: result.total, limit: result.limit, skip: result.skip }
    });
  }

  /**
   * Get unread count
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req, res) {
    const userId = req.user._id;
    const Notification = (await import('../models/Notification.js')).default;
    const unreadCount = await Notification.getUnreadCount(userId);

    ApiResponse.success(res, 200, 'Unread count fetched', { unreadCount });
  }

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  async markAsRead(req, res) {
    const userId = req.user._id;
    const { id } = req.params;

    const result = await NotificationService.markAsRead(id, userId);

    ApiResponse.success(res, 200, 'Notification marked as read', result);
  }

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead(req, res) {
    const userId = req.user._id;

    const result = await NotificationService.markAllAsRead(userId);

    ApiResponse.success(res, 200, 'All notifications marked as read', result);
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req, res) {
    const userId = req.user._id;
    const { id } = req.params;

    const result = await NotificationService.deleteNotification(id, userId);

    ApiResponse.success(res, 200, 'Notification deleted', result);
  }

  /**
   * Delete all notifications
   * DELETE /api/notifications/all
   */
  async deleteAllNotifications(req, res) {
    const userId = req.user._id;

    const result = await NotificationService.deleteAllNotifications(userId);

    ApiResponse.success(res, 200, 'All notifications deleted successfully', result);
  }

  /**
   * Toggle WebSocket notifications
   * PATCH /api/notifications/settings/websocket
   */
  async toggleWebSocketNotifications(req, res) {
    const userId = req.user._id;
    const { enabled } = req.body;

    const User = (await import('../models/User.js')).default;
    
    // Update user's WebSocket notification setting
    const user = await User.findByIdAndUpdate(
      userId,
      { websocketNotificationsEnabled: enabled },
      { new: true, select: 'websocketNotificationsEnabled' }
    );

    if (!user) {
      return ApiResponse.error(res, 404, 'User not found');
    }

    ApiResponse.success(res, 200, 'WebSocket notification settings updated', {
      websocketNotificationsEnabled: user.websocketNotificationsEnabled,
    });
  }
}

export default new NotificationController();
