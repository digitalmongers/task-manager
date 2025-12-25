import cron from 'node-cron';
import Task from '../models/Task.js';
import VitalTask from '../models/VitalTask.js';
import NotificationService from './notificationService.js';
import Logger from '../config/logger.js';
import Notification from '../models/Notification.js';

class CronService {
  constructor() {
    this.cronJob = null;
  }

  /**
   * Initialize all cron jobs
   */
  init() {
    Logger.info('Initializing Cron Service...');
    
    // Run every hour for reminders
    this.cronJob = cron.schedule('0 * * * *', async () => {
      Logger.info('Running Due Date Reminder Job');
      await this.checkDueTasks();
      await this.checkDueVitalTasks();
    });

    // Run every day at midnight for account cleanup
    cron.schedule('0 0 * * *', async () => {
      Logger.info('Running Inactive Account Cleanup Job');
      await this.cleanupInactiveAccounts();
    });

    Logger.info('Cron Service Initialized');
  }

  /**
   * Automatically delete accounts inactive for more than 90 days
   */
  async cleanupInactiveAccounts() {
    try {
      const mongoose = (await import("mongoose")).default;
      const User = mongoose.model('User');
      const AuthService = (await import('./authService.js')).default;

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Find users where lastLogin < 90 days ago OR (lastLogin is null and createdAt < 90 days ago)
      const inactiveUsers = await User.find({
        $or: [
          { lastLogin: { $lt: ninetyDaysAgo } },
          { lastLogin: null, createdAt: { $lt: ninetyDaysAgo } }
        ]
      });

      if (inactiveUsers.length === 0) {
        Logger.info('No inactive users found for cleanup');
        return;
      }

      Logger.info(`Found ${inactiveUsers.length} inactive users for cleanup`);

      for (const user of inactiveUsers) {
        Logger.info(`Auto-deleting inactive user: ${user.email} (ID: ${user._id})`);
        await AuthService.systemHardDeleteUser(user._id).catch(e => {
          Logger.error("Failed to auto-delete user", { userId: user._id, error: e.message });
        });
      }
      
      Logger.info('Inactive account cleanup completed');
    } catch (error) {
      Logger.error('Error in cleanupInactiveAccounts cron', { error: error.message });
    }
  }

  /**
   * Check for tasks due in the next 24 hours
   */
  async checkDueTasks() {
    try {
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find active, incomplete tasks due in next 24 hours
      const tasks = await Task.find({
        dueDate: { $gte: now, $lte: next24Hours },
        isCompleted: false,
        status: { $ne: 'archived' } // Assuming 'archived' exists or status isn't deleted which is handled by find usually implies not deleted
      }).populate('user', 'firstName lastName email'); // Populate owner

      for (const task of tasks) {
        // Check if we already sent a reminder for this task
        const alreadyNotified = await Notification.findOne({
          type: 'task_due_soon',
          'relatedEntity.entityId': task._id
        });

        if (!alreadyNotified) {
          await this.sendTaskReminder(task);
        }
      }
    } catch (error) {
      Logger.error('Error in checkDueTasks cron', { error: error.message });
    }
  }

  /**
   * Check for vital tasks due in the next 24 hours
   */
  async checkDueVitalTasks() {
    try {
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const tasks = await VitalTask.find({
        dueDate: { $gte: now, $lte: next24Hours },
        isCompleted: false,
      }).populate('user', 'firstName lastName email');

      for (const task of tasks) {
        const alreadyNotified = await Notification.findOne({
          type: 'vital_task_due_soon',
          'relatedEntity.entityId': task._id
        });

        if (!alreadyNotified) {
          await this.sendVitalTaskReminder(task);
        }
      }
    } catch (error) {
      Logger.error('Error in checkDueVitalTasks cron', { error: error.message });
    }
  }

  /**
   * Send reminder for a task
   */
  async sendTaskReminder(task) {
    if (!task.user) return;

    // Notify Owner
    // In a real enterprise app, we might also notify Assignees if distinct from User.
    // For now, assuming Owner is the primary assignee.
    
    await NotificationService.createNotification({
      recipient: task.user._id,
      sender: task.user._id, // System notification, but schema requires sender. Can use self or Admin. using self for now.
      type: 'task_due_soon',
      title: '⏰ Task Due Soon',
      message: `Task "${task.title}" is due in less than 24 hours.`,
      relatedEntity: {
        entityType: 'Task',
        entityId: task._id,
      },
      actionUrl: `/tasks/${task._id}`,
      priority: 'high',
      metadata: {
        dueDate: task.dueDate,
      },
    });
    
    Logger.info(`Sent reminder for Task ${task._id}`);
  }

  /**
   * Send reminder for a vital task
   */
  async sendVitalTaskReminder(task) {
    if (!task.user) return;

    await NotificationService.createNotification({
      recipient: task.user._id,
      sender: task.user._id,
      type: 'vital_task_due_soon',
      title: '🔴 Vital Task Due Soon',
      message: `Vital Task "${task.title}" is due in less than 24 hours.`,
      relatedEntity: {
        entityType: 'VitalTask',
        entityId: task._id,
      },
      actionUrl: `/vital-tasks/${task._id}`,
      priority: 'urgent',
      metadata: {
        dueDate: task.dueDate,
      },
    });

    Logger.info(`Sent reminder for Vital Task ${task._id}`);
  }
}

export default new CronService();
