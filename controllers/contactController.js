import ContactService from '../services/contactService.js';
import EmailService from '../services/emailService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';
import Logger from '../config/logger.js';

class ContactController {
  
  async sendMessage(req, res) {
    try {
      // Process contact data
      const contactData = await ContactService.sendContactMessage(
        req.body,
        req.ip
      );
  
      // Send email to support team
      EmailService.sendContactSupportEmail(contactData).catch((error) => {
        Logger.error('Failed to send support email', {
          error: error.message,
          contactData,
        });
      });

      // Send confirmation email to user
      EmailService.sendContactConfirmation(contactData).catch((error) => {
        Logger.error('Failed to send confirmation email', {
          error: error.message,
          contactData,
        });
      });

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'Message sent successfully. We will get back to you soon!',
        {
          referenceId: `CONTACT-${Date.now()}`,
          submittedAt: contactData.submittedAt,
        }
      );
    } catch (error) {
      Logger.error('Error in contact form submission', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default new ContactController();
