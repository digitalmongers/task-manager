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

      // 1. Sync flags for existing users
      await this.syncEnterpriseFlags();

      // 2. Auto-create missing whitelisted users
      await this.createMissingWhitelistedUsers();

      Logger.info('Enterprise Bootstrap completed successfully.');
    } catch (error) {
      Logger.error('Enterprise Bootstrap failed:', { error: error.message });
    }
  }

  /**
   * Sync isEnterpriseUser flag based on WHITELISTED_EMAILS
   */
  async syncEnterpriseFlags() {
    // Set isEnterpriseUser: true for all emails in whitelist
    const grantResult = await User.updateMany(
      { email: { $in: WHITELISTED_EMAILS }, isEnterpriseUser: false },
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
  }

  /**
   * Create accounts for emails in whitelist if they don't exist
   */
  async createMissingWhitelistedUsers() {
    for (const email of WHITELISTED_EMAILS) {
      const existingUser = await User.findOne({ email });

      if (!existingUser) {
        Logger.info(`Auto-creating enterprise user: ${email}`);
        
        // Create user with default settings
        await User.create({
          firstName: 'Enterprise',
          lastName: 'User',
          email,
          password: DEFAULT_ENTERPRISE_PASSWORD,
          isEnterpriseUser: true,
          isEmailVerified: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          plan: 'TEAM', // Give them highest plan as well for UI consistency
          subscriptionStatus: 'active',
          currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) // 100 years
        });

        Logger.info(`Successfully created enterprise user: ${email}`);
      }
    }
  }
}

export default new EnterpriseBootstrap();
