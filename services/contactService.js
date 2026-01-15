import Logger from '../config/logger.js';

class ContactService {
  /**
   * Handle contact form submission
   */
  async sendContactMessage(contactData, ipAddress = 'Unknown') {
    try {
      const { name, email, subject, message } = contactData;

      // Log the contact attempt 
      Logger.info('Contact form submission received', {
        name,
        email: email.toLowerCase(),
        subject,
        ip: ipAddress,
        timestamp: new Date().toISOString(),
      });

      // Return formatted data for email service
      return {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        subject: subject.trim(),
        message: message.trim(),
        submittedAt: new Date(),
        ipAddress,
      };
    } catch (error) {
      Logger.error('Error processing contact form', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default new ContactService();
