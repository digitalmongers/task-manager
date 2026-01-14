import User from '../models/User.js';
import { WHITELISTED_EMAILS, DEFAULT_ENTERPRISE_PASSWORD } from '../config/aiConfig.js';
import Logger from '../config/logger.js';

class EnterpriseBootstrap {
  /**
   * Initialize enterprise users and sync flags
   */
  async init() {
    try {
      Logger.info('Initializing Enterprise Bootstrap...');
      Logger.info(`Configured Whitelist: ${JSON.stringify(WHITELISTED_EMAILS)}`);

      if (!WHITELISTED_EMAILS || WHITELISTED_EMAILS.length === 0) {
        Logger.warn('No whitelisted emails configured.');
        return;
      }

      // 1. Sync flags for existing users
      await this.syncEnterpriseFlags();

      // 2. Auto-create missing whitelisted users
      await this.createMissingWhitelistedUsers();

      Logger.info('Enterprise Bootstrap completed successfully.');
    } catch (error) {
      Logger.error('Enterprise Bootstrap failed:', { 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  /**
   * Sync isEnterpriseUser flag based on WHITELISTED_EMAILS
   */
  async syncEnterpriseFlags() {
    try {
      // Set isEnterpriseUser: true for all emails in whitelist
      const grantResult = await User.updateMany(
        { email: { $in: WHITELISTED_EMAILS }, isEnterpriseUser: { $ne: true } },
        { $set: { isEnterpriseUser: true } }
      );

      if (grantResult.modifiedCount > 0) {
        Logger.info(`Granted enterprise access to ${grantResult.modifiedCount} existing users.`);
      }

      // Set isEnterpriseUser: false for all emails NOT in whitelist
      const revokeResult = await User.updateMany(
        { email: { $nin: WHITELISTED_EMAILS }, isEnterpriseUser: true },
        { $set: { isEnterpriseUser: false } }
      );

      if (revokeResult.modifiedCount > 0) {
        Logger.info(`Revoked enterprise access from ${revokeResult.modifiedCount} users.`);
      }
    } catch (error) {
      Logger.error('Failed to sync enterprise flags:', { error: error.message });
      throw error;
    }
  }

  /**
   * Create accounts for emails in whitelist if they don't exist
   */
  async createMissingWhitelistedUsers() {
    try {
      for (const email of WHITELISTED_EMAILS) {
        const existingUser = await User.findOne({ email: email.toLowerCase() });

        if (!existingUser) {
          Logger.info(`Auto-creating enterprise user: ${email}`);
          
          // Create user with default settings
          const newUser = await User.create({
            firstName: 'Enterprise',
            lastName: 'User',
            email: email.toLowerCase(),
            password: DEFAULT_ENTERPRISE_PASSWORD,
            isEnterpriseUser: true,
            isEmailVerified: true,
            isActive: true, // Ensure they are active
            termsAccepted: true,
            termsAcceptedAt: new Date(),
            plan: 'TEAM',
            subscriptionStatus: 'active',
            currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) // 100 years
          });

          Logger.info(`Successfully created enterprise user: ${email} with ID: ${newUser._id}`);
        } else {
          Logger.debug(`Enterprise user already exists: ${email}`);
          
          // Ensure flag is set if they exist (double-check)
          if (!existingUser.isEnterpriseUser) {
            existingUser.isEnterpriseUser = true;
            await existingUser.save();
            Logger.info(`Updated existing user to enterprise: ${email}`);
          }
        }
      }
    } catch (error) {
      Logger.error('Failed to create missing enterprise users:', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Just-In-Time creation helper (can be used by login service)
   */
  async ensureEnterpriseUser(email) {
    if (WHITELISTED_EMAILS.includes(email.toLowerCase())) {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            Logger.info(`JIT Creation: Whitelisted user ${email} not found, creating now.`);
            await this.createMissingWhitelistedUsers();
            return await User.findOne({ email: email.toLowerCase() });
        }
        return user;
    }
    return null;
  }
}

export default new EnterpriseBootstrap();
