import mailchimp from '@mailchimp/mailchimp_marketing';
import crypto from 'crypto';
import logger from '../config/logger.js';
import ApiError from '../utils/ApiError.js';

class MailchimpService {
  constructor() {
    this.apiKey = process.env.MAILCHIMP_API_KEY;
    this.serverPrefix = process.env.MAILCHIMP_SERVER; // e.g. 'us21'
    this.audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

    if (!this.apiKey || !this.serverPrefix || !this.audienceId) {
      logger.warn('Mailchimp configuration is missing. Newsletter features will fail.');
    }

    mailchimp.setConfig({
      apiKey: this.apiKey,
      server: this.serverPrefix,
    });
  }

  /**
   * Subscribe a user to the newsletter list
   * @param {string} email - The user's email address
   * @returns {Promise<Object>} - The response from Mailchimp
   */
  async subscribeUser(email) {
    if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    try {
      // Calculate MD5 hash of the email (lowercase) for the subscriber hash
      const subscriberHash = crypto
        .createHash('md5')
        .update(email.toLowerCase())
        .digest('hex');

      // We use PUT to create or update the member
      // status 'subscribed' ensures they are opted-in
      const response = await mailchimp.lists.setListMember(
        this.audienceId,
        subscriberHash,
        {
          email_address: email,
          status_if_new: 'subscribed',
          // status: 'subscribed', // If we want to force resubscribe, but usually better to leave existing status unless specific requirement
        }
      );

      logger.info(`Successfully subscribed/updated user ${email} to Mailchimp list ${this.audienceId}`);
      return response;
    } catch (error) {
      logger.error('Mailchimp subscription error:', {
        message: error.message,
        response: error.response ? error.response.body : 'No response body',
        status: error.status,
      });
      
      // Handle known Mailchimp errors nicely if possible
      if (error.status === 400) {
        const body = error.response?.body;
        
        if (body?.title === 'Member Exists') {
          throw new ApiError(400, 'User is already subscribed');
        }
        
        if (body?.title === 'Forgotten Email Not Subscribed') {
          throw new ApiError(400, 'This email was previously deleted and cannot be re-added via API. Please use our official Mailchimp subscribe form or contact support.');
        }

        if (body?.title === 'Member In Compliance State') {
          throw new ApiError(400, 'This email is currently in a compliance state and cannot be subscribed.');
        }

        // Rethrow other 400 errors with original message if helpful
        throw new ApiError(400, body?.detail || 'Invalid subscription request');
      }

      throw new ApiError(500, 'Failed to subscribe to newsletter. Please try again later.');
    }
  }
}

export default new MailchimpService();
