import NotificationService from '../services/notificationService.js';
import ApiResponse from '../utils/ApiResponse.js';

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

    ApiResponse.success(res, 200, 'Notifications fetched successfully', result);
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
}

export default new NotificationController();
