import Notification from '../models/Notification.js';
import WebSocketService from '../config/websocket.js';
import PushService from './pushService.js';
import Logger from '../config/logger.js';
import TeamMember from '../models/TeamMember.js';

const CLIENT_URL = process.env.REDIRECT_URL || process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000';

class NotificationService {
  /**
   * Create and send notification
   */
  async createNotification(data) {
    try {
      const notification = await Notification.create(data);
      await notification.populate([
        { path: 'sender', select: 'firstName lastName email avatar' },
        { path: 'team', select: 'teamName' },
      ]);

      // Send real-time notification via WebSocket
      WebSocketService.sendToUser(data.recipient, 'notification:new', {
        notification: notification.toObject(),
        unreadCount: await Notification.getUnreadCount(data.recipient),
      });

      // Send push notification for offline/background users
      await PushService.sendPushToUser(data.recipient, {
        title: data.title,
        body: data.message,
        url: data.actionUrl || CLIENT_URL,
        icon: '/icon-192x192.png',
        data: {
          notificationId: notification._id,
          type: data.type,
        },
      });

      Logger.info('Notification created and sent', {
        notificationId: notification._id,
        recipient: data.recipient,
        type: data.type,
      });

      return notification;
    } catch (error) {
      Logger.error('Error creating notification', { error: error.message });
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  async createBulkNotifications(notifications) {
    try {
      const created = await Notification.insertMany(notifications);
      
      // Send real-time notifications
      for (const notification of created) {
        await notification.populate([
          { path: 'sender', select: 'firstName lastName email avatar' },
          { path: 'team', select: 'teamName' },
        ]);

        WebSocketService.sendToUser(notification.recipient, 'notification:new', {
          notification: notification.toObject(),
          unreadCount: await Notification.getUnreadCount(notification.recipient),
        });
      }

      Logger.info('Bulk notifications created', { count: created.length });
      return created;
    } catch (error) {
      Logger.error('Error creating bulk notifications', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const notifications = await Notification.getUserNotifications(userId, options);
      const unreadCount = await Notification.getUnreadCount(userId);
      
      return {
        notifications,
        unreadCount,
        total: await Notification.countDocuments({ recipient: userId }),
      };
    } catch (error) {
      Logger.error('Error getting user notifications', { error: error.message });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();
      const unreadCount = await Notification.getUnreadCount(userId);

      // Send updated count via WebSocket
      WebSocketService.sendToUser(userId, 'notification:read', {
        notificationId,
        unreadCount,
      });

      return { notification, unreadCount };
    } catch (error) {
      Logger.error('Error marking notification as read', { error: error.message });
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      await Notification.markAllAsRead(userId);
      
      // Send updated count via WebSocket
      WebSocketService.sendToUser(userId, 'notifications:all-read', {
        unreadCount: 0,
      });

      return { success: true, unreadCount: 0 };
    } catch (error) {
      Logger.error('Error marking all notifications as read', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId,
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      const unreadCount = await Notification.getUnreadCount(userId);

      WebSocketService.sendToUser(userId, 'notification:deleted', {
        notificationId,
        unreadCount,
      });

      return { success: true, unreadCount };
    } catch (error) {
      Logger.error('Error deleting notification', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId) {
    try {
      const result = await Notification.deleteMany({ recipient: userId });

      WebSocketService.sendToUser(userId, 'notifications:all-deleted', {
        deletedCount: result.deletedCount,
        unreadCount: 0,
      });

      Logger.info('All notifications deleted', {
        userId,
        deletedCount: result.deletedCount,
      });

      return { success: true, deletedCount: result.deletedCount, unreadCount: 0 };
    } catch (error) {
      Logger.error('Error deleting all notifications', { error: error.message });
      throw error;
    }
  }

  // ========== TEAM NOTIFICATIONS ==========

  /**
   * Notify team owner when member joins
   */
  async notifyTeamMemberJoined(teamMember, newMember) {
    return this.createNotification({
      recipient: teamMember.owner,
      sender: newMember._id,
      type: 'team_member_joined',
      title: '🎉 New Team Member Joined',
      message: `${newMember.firstName} ${newMember.lastName} has joined your team`,
      team: teamMember._id,
      actionUrl: `/user/${teamMember.owner}`,
      priority: 'high',
      metadata: {
        memberEmail: newMember.email,
        memberRole: teamMember.role,
      },
    });
  }

  /**
   * Notify team when member leaves
   */
  async notifyTeamMemberLeft(teamMember, leftMember, teamOwner) {
    const teamMembers = await TeamMember.getActiveMembers(teamOwner._id);
    const recipients = teamMembers
      .filter(tm => tm.member._id.toString() !== leftMember._id.toString())
      .map(tm => tm.member._id);

    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: leftMember._id,
      type: 'team_member_left',
      title: '👋 Team Member Left',
      message: `${leftMember.firstName} ${leftMember.lastName} has left the team`,
      team: teamMember._id,
      actionUrl: `/user/${teamMember.owner}`,
      priority: 'medium',
    }));

    return this.createBulkNotifications(notifications);
  }

  // ========== TASK NOTIFICATIONS ==========

  /**
   * Notify user when task is assigned
   */
  async notifyTaskAssigned(task, assignedTo, assignedBy) {
    return this.createNotification({
      recipient: assignedTo._id,
      sender: assignedBy._id,
      type: 'task_assigned',
      title: '📋 New Task Assigned',
      message: `${assignedBy.firstName} assigned you a task: "${task.title}"`,
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id,
      },
      actionUrl: `${CLIENT_URL}/user/tasks`,
      priority: task.priority?.name === 'High' ? 'high' : 'medium',
      metadata: {
        taskTitle: task.title,
        dueDate: task.dueDate,
      },
    });
  }

  /**
   * Notify team members when task is updated
   */
  async notifyTaskUpdated(task, updatedBy, teamMembers, changes = {}) {
    const recipients = teamMembers
      .filter(tm => tm.member._id.toString() !== updatedBy._id.toString())
      .map(tm => tm.member._id);

    if (recipients.length === 0) return [];

    const changeDescription = this.formatTaskChanges(changes);
    
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: updatedBy._id,
      type: 'task_updated',
      title: '🔄 Task Updated',
      message: `${updatedBy.firstName} updated task "${task.title}"${changeDescription}`,
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id,
      },
      actionUrl: `${CLIENT_URL}/user/tasks`,
      priority: 'low',
      metadata: {
        taskTitle: task.title,
        changes,
      },
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
   * Notify team members when task is completed
   */
  async notifyTaskCompleted(task, completedBy, teamMembers) {
    const recipients = teamMembers
      .filter(tm => tm.member._id.toString() !== completedBy._id.toString())
      .map(tm => tm.member._id);

    if (recipients.length === 0) return [];

    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: completedBy._id,
      type: 'task_completed',
      title: '✅ Task Completed',
      message: `${completedBy.firstName} completed task: "${task.title}"`,
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id,
      },
      actionUrl: `${CLIENT_URL}/user/tasks`,
      priority: 'medium',
      metadata: {
        taskTitle: task.title,
      },
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
   * Notify when review is requested for a task
   */
  async notifyTaskReviewRequested(task, requester, recipients) {
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: requester._id,
      type: 'task_review_requested',
      title: '👀 Review Requested',
      message: `${requester.firstName} requested review for task: "${task.title}"`,
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id,
      },
      actionUrl: `${CLIENT_URL}/user/tasks`,
      priority: 'high',
      metadata: {
        taskTitle: task.title,
      },
    }));

    return this.createBulkNotifications(notifications);
  }

  // ========== VITAL TASK NOTIFICATIONS ==========

  /**
   * Notify user when vital task is assigned
   */
  async notifyVitalTaskAssigned(vitalTask, assignedTo, assignedBy) {
    return this.createNotification({
      recipient: assignedTo._id,
      sender: assignedBy._id,
      type: 'vital_task_assigned',
      title: '🔴 Vital Task Assigned',
      message: `${assignedBy.firstName} assigned you a VITAL task: "${vitalTask.title}"`,
      relatedEntity: {
        entityType: 'VitalTask',
        entityId: vitalTask._id,
      },
      actionUrl: `${CLIENT_URL}/user/vital`,
      priority: 'urgent',
      metadata: {
        taskTitle: vitalTask.title,
        dueDate: vitalTask.dueDate,
      },
    });
  }

  /**
   * Notify team members when vital task is updated
   */
  async notifyVitalTaskUpdated(vitalTask, updatedBy, teamMembers, changes = {}) {
    const recipients = teamMembers
      .filter(tm => tm.member._id.toString() !== updatedBy._id.toString())
      .map(tm => tm.member._id);

    if (recipients.length === 0) return [];

    const changeDescription = this.formatTaskChanges(changes);
    
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: updatedBy._id,
      type: 'vital_task_updated',
      title: '🔴 Vital Task Updated',
      message: `${updatedBy.firstName} updated vital task "${vitalTask.title}"${changeDescription}`,
      relatedEntity: {
        entityType: 'VitalTask',
        entityId: vitalTask._id,
      },
      actionUrl: `${CLIENT_URL}/user/vital`,
      priority: 'high',
      metadata: {
        taskTitle: vitalTask.title,
        changes,
      },
    }));

    return this.createBulkNotifications(notifications);
  }

  // ========== COLLABORATION NOTIFICATIONS ==========

  /**
   * Notify user when added as collaborator
   */
  async notifyCollaboratorAdded(task, collaborator, addedBy, isVitalTask = false) {
    return this.createNotification({
      recipient: collaborator._id,
      sender: addedBy._id,
      type: isVitalTask ? 'vital_task_collaborator_added' : 'task_collaborator_added',
      title: isVitalTask ? '🔴 Added to Vital Task' : '🤝 Added as Collaborator',
      message: `${addedBy.firstName} added you as collaborator on ${isVitalTask ? 'vital task' : 'task'}: "${task.title}"`,
      relatedEntity: {
        entityType: isVitalTask ? 'VitalTask' : 'Task',
        entityId: task._id,
      },
      actionUrl: isVitalTask ? `${CLIENT_URL}/vital-tasks/${task._id}` : `${CLIENT_URL}/user/tasks${task._id}`,
      priority: isVitalTask ? 'high' : 'medium',
      metadata: {
        taskTitle: task.title,
      },
    });
  }

  /**
   * Notify user when removed as collaborator
   */
  async notifyCollaboratorRemoved(task, collaborator, removedBy, isVitalTask = false) {
    return this.createNotification({
      recipient: collaborator._id,
      sender: removedBy._id,
      type: isVitalTask ? 'vital_task_collaborator_removed' : 'task_collaborator_removed',
      title: '🚫 Removed from ' + (isVitalTask ? 'Vital Task' : 'Task'),
      message: `${removedBy.firstName} removed you from ${isVitalTask ? 'vital task' : 'task'}: "${task.title}"`,
      relatedEntity: {
        entityType: isVitalTask ? 'VitalTask' : 'Task',
        entityId: task._id,
      },
      actionUrl: isVitalTask ? `${CLIENT_URL}/user/vital` : `${CLIENT_URL}/user/tasks`,
      priority: 'medium',
      metadata: {
        taskTitle: task.title,
      },
    });
  }

  // ========== HELPER METHODS ==========

  /**
   * Format task changes for notification message
   */
  formatTaskChanges(changes) {
    if (!changes || Object.keys(changes).length === 0) return '';
    
    const changeKeys = Object.keys(changes);
    if (changeKeys.length === 1) {
      return ` (${changeKeys[0]} changed)`;
    } else if (changeKeys.length === 2) {
      return ` (${changeKeys.join(' and ')} changed)`;
    } else {
      return ` (${changeKeys.length} fields changed)`;
    }
  }

  /**
   * Get team members for notifications (excluding sender)
   */
  async getTeamMembersForNotification(teamOwnerId, excludeUserId = null) {
    const teamMembers = await TeamMember.getActiveMembers(teamOwnerId);
    
    if (excludeUserId) {
      return teamMembers.filter(
        tm => tm.member._id.toString() !== excludeUserId.toString()
      );
    }
    
    return teamMembers;
  }


  /**
   * Notify team member when removed
   */
  async notifyTeamMemberRemoved(teamMember, removedMember, remover) {
    if (removedMember._id.toString() === remover._id.toString()) return; // Don't notify if removed self

    return this.createNotification({
      recipient: removedMember._id,
      sender: remover._id,
      type: 'team_member_left', // Reuse 'left' or add specific 'removed' type if needed. Schema has 'team_member_left'
      title: '🚫 Removed from Team',
      message: `${remover.firstName} removed you from the team`,
      team: teamMember.owner, // teamMember.owner is the Team Owner ID usually used as team identifier in this app
      priority: 'high',
      actionUrl: `${CLIENT_URL}/user/tasks`,
      metadata: {
        teamName: 'Your Team', // We might need to fetch team details if not available
      },
    });
  }

  /**
   * Notify team member when role updated
   */
  async notifyTeamRoleUpdated(teamMember, updatedMember, updater) {
    return this.createNotification({
      recipient: updatedMember._id,
      sender: updater._id,
      type: 'team_member_role_updated',
      title: '👮 Team Role Updated',
      message: `${updater.firstName} updated your role to "${teamMember.role}"`,
      team: teamMember.owner,
      actionUrl: `${CLIENT_URL}/user/tasks`,
      priority: 'medium',
      metadata: {
        newRole: teamMember.role,
      },
    });
  }

  /**
   * Notify when task is deleted 
   */
  async notifyTaskDeleted(taskTitle, deletedBy, recipients) {
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: deletedBy._id,
      type: 'task_deleted',
      title: '🗑️ Task Deleted',
      message: `${deletedBy.firstName} deleted task: "${taskTitle}"`,
      priority: 'medium',
      actionUrl: `${CLIENT_URL}/user/tasks`,
      metadata: {
        taskTitle: taskTitle,
      },
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
   * Notify when task is restored
   */
  async notifyTaskRestored(task, restoredBy, recipients) {
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: restoredBy._id,
      type: 'task_restored',
      title: '♻️ Task Restored',
      message: `${restoredBy.firstName} restored task: "${task.title}"`,
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id,
      },
      actionUrl: `${CLIENT_URL}/user/tasks`,
      priority: 'medium',
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
   * Notify when vital task is completed
   */
  async notifyVitalTaskCompleted(vitalTask, completedBy, recipients) {
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: completedBy._id,
      type: 'vital_task_completed',
      title: '✅ Vital Task Completed',
      message: `${completedBy.firstName} completed vital task: "${vitalTask.title}"`,
      relatedEntity: {
        entityType: 'VitalTask',
        entityId: vitalTask._id,
      },
      actionUrl: `${CLIENT_URL}/user/vital`,
      priority: 'high',
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
   * Notify when review is requested for a vital task
   */
  async notifyVitalTaskReviewRequested(vitalTask, requester, recipients) {
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: requester._id,
      type: 'vital_task_review_requested',
      title: '👀 Vital Task Review Requested',
      message: `${requester.firstName} requested review for VITAL task: "${vitalTask.title}"`,
      relatedEntity: {
        entityType: 'VitalTask',
        entityId: vitalTask._id,
      },
      actionUrl: `${CLIENT_URL}/user/vital`,
      priority: 'urgent',
      metadata: {
        taskTitle: vitalTask.title,
      },
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
   * Notify when vital task is deleted
   */
  async notifyVitalTaskDeleted(taskTitle, deletedBy, recipients) {
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: deletedBy._id,
      type: 'vital_task_deleted',
      title: '🗑️ Vital Task Deleted',
      message: `${deletedBy.firstName} deleted vital task: "${taskTitle}"`,
      priority: 'high',
      actionUrl: `${CLIENT_URL}/user/vital`,
      metadata: {
        taskTitle: taskTitle,
      },
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
   * Notify when vital task is restored
   */
  async notifyVitalTaskRestored(vitalTask, restoredBy, recipients) {
    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      sender: restoredBy._id,
      type: 'task_restored', // Schema uses 'task_restored' generally or check if specific type exists. Schema has 'vital_task_updated' but no specific restore. Reusing 'vital_task_updated' or generic. Let's use 'vital_task_updated' with restore message or add type if strictly needed. Schema from Step 135 DOES NOT have 'vital_task_restored'. I will use 'vital_task_updated'.
      title: '♻️ Vital Task Restored',
      message: `${restoredBy.firstName} restored vital task: "${vitalTask.title}"`,
      relatedEntity: {
        entityType: 'VitalTask',
        entityId: vitalTask._id,
      },
      actionUrl: `${CLIENT_URL}/user/vital`,
      priority: 'high',
    }));

    return this.createBulkNotifications(notifications);
  }
}



export default new NotificationService();
