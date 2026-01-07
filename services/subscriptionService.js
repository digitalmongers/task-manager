import User from '../models/User.js';
import { PLAN_LIMITS } from '../config/aiConfig.js';
import Logger from '../config/logger.js';
import NotificationService from '../services/notificationService.js';
import EmailService from './emailService.js';

class SubscriptionService {
  /**
   * Upgrade user plan after successful payment
   */
  async upgradeUserPlan(userId, planKey, billingCycle) {
    Logger.info('Starting upgradeUserPlan', { userId, planKey, billingCycle });
    try {
      const user = await User.findById(userId);
      if (!user) {
        Logger.error(`[SubscriptionService] User not found during upgrade. UserID: ${userId}`);
        throw new Error('User not found');
      }

      const plan = PLAN_LIMITS[planKey];
      
      // Update User Plan Details
      user.plan = planKey;
      user.billingCycle = billingCycle.toUpperCase();
      user.subscriptionStatus = 'active';
      
      // Calculate Expiration Date
      const durationDays = user.billingCycle === 'YEARLY' ? 365 : 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationDays);
      user.currentPeriodEnd = expiryDate;

      // Reset/Update Boosts
      user.totalBoosts = plan.monthlyBoosts;
      user.usedBoosts = 0;
      user.aiUsageBlocked = false;

      await user.save();

      Logger.info('User Plan Upgraded', { userId, plan: planKey, cycle: billingCycle });

      // Notify User
      await NotificationService.notifyPlanUpgraded(user, planKey, user.billingCycle, expiryDate);

      return user;
    } catch (error) {
      Logger.error('Plan Upgrade Failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Proactively check and send expiry reminders
   * To be called by daily cron
   */
  async checkAndSendExpiryReminders() {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      // Find active subscriptions expiring in exactly 3 days (approx)
      const startOfDay = new Date(threeDaysFromNow.setHours(0,0,0,0));
      const endOfDay = new Date(threeDaysFromNow.setHours(23,59,59,999));

      const usersToNotify = await User.find({
        plan: { $ne: 'FREE' },
        subscriptionStatus: 'active',
        currentPeriodEnd: { $gte: startOfDay, $lte: endOfDay }
      });

      Logger.info(`Found ${usersToNotify.length} users for subscription expiry reminders`);

      for (const user of usersToNotify) {
        try {
          await EmailService.sendSubscriptionExpiryReminder(user, 3);
          Logger.info(`Sent expiry reminder to user: ${user.email}`);
        } catch (e) {
          Logger.error(`Failed to send expiry reminder to ${user.email}`, { error: e.message });
        }
      }
    } catch (error) {
      Logger.error('Error in checkAndSendExpiryReminders', { error: error.message });
    }
  }

  /**
   * Handle Subscription Expiry (To be called by Cron)
   */
  async handleExpiry(userId) {
    const user = await User.findById(userId);
    if (user && user.currentPeriodEnd < new Date()) {
      const oldPlan = user.plan;
      user.subscriptionStatus = 'inactive';
      user.plan = 'FREE';
      user.totalBoosts = PLAN_LIMITS.FREE.monthlyBoosts;
      user.usedBoosts = 0; // Reset for free plan
      user.aiUsageBlocked = false;
      await user.save();
      
      Logger.info('Subscription Expired and Downgraded to FREE', { userId, oldPlan });
      
      // Notify User (System notification + potentially email if needed later)
      await NotificationService.createNotification({
        recipient: userId,
        type: 'subscription_expired',
        title: 'Plan Expired ⚠️',
        message: `Your ${oldPlan} subscription has expired. You've been moved to the FREE plan.`,
        priority: 'high'
      });
    }
  }

  /**
   * Global task to process all expired subscriptions
   */
  async processAllExpiries() {
    try {
      const expiredUsers = await User.find({
        plan: { $ne: 'FREE' },
        subscriptionStatus: 'active',
        currentPeriodEnd: { $lt: new Date() }
      });

      for (const user of expiredUsers) {
        await this.handleExpiry(user._id);
      }
    } catch (error) {
      Logger.error('Error in processAllExpiries', { error: error.message });
    }
  }
}

export default new SubscriptionService();
