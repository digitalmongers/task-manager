import sgMail from '@sendgrid/mail';
import Logger from '../config/logger.js';

class EmailService {
  constructor() {
    // Initialize SendGrid with API key
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      Logger.info('SendGrid email service initialized');
    } else {
      Logger.warn('SendGrid API key not found. Email service will not work.');
    }
  }

  /**
   * Send email using SendGrid
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      const msg = {
        to,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM,
          name: process.env.SENDGRID_FROM_NAME || 'Task Manager',
        },
        subject,
        text,
        html,
      };

      const response = await sgMail.send(msg);

      Logger.info('Email sent successfully via SendGrid', {
        messageId: response[0].headers['x-message-id'],
        to,
        subject,
        statusCode: response[0].statusCode,
      });

      return { 
        success: true, 
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode 
      };
    } catch (error) {
      Logger.error('Failed to send email via SendGrid:', {
        error: error.message,
        to,
        subject,
        code: error.code,
        response: error.response?.body,
      });
      throw error;
    }
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6; 
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 30px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
              background: white;
            }
            .content h2 {
              color: #333;
              font-size: 24px;
              margin-bottom: 20px;
            }
            .content p {
              margin-bottom: 15px;
              color: #555;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button { 
              display: inline-block; 
              padding: 15px 40px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white !important; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: 600;
              font-size: 16px;
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
            }
            .link-box {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
              word-break: break-all;
            }
            .link-box p {
              margin: 5px 0;
              font-size: 14px;
            }
            .link-box a {
              color: #667eea;
              text-decoration: none;
            }
            .warning { 
              background: #fff3cd; 
              border-left: 4px solid #ffc107; 
              padding: 15px; 
              margin: 20px 0;
              border-radius: 4px;
            }
            .warning strong {
              color: #856404;
            }
            .footer { 
              text-align: center; 
              padding: 20px 30px;
              background: #f8f9fa;
              color: #6c757d; 
              font-size: 13px; 
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Task Manager!</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName} ${user.lastName},</h2>
              <p>Thank you for registering with Task Manager. To complete your registration and start using our platform, please verify your email address by clicking the button below.</p>
              
              <div class="button-container">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <div class="link-box">
                <p><strong>Or copy and paste this link into your browser:</strong></p>
                <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This verification link will expire in 24 hours. If you did not create an account with Task Manager, please ignore this email.
              </div>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Task Manager Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to Task Manager!
      
      Hello ${user.firstName} ${user.lastName},
      
      Thank you for registering. Please verify your email address by visiting:
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you did not create an account, please ignore this email.
      
      Best regards,
      The Task Manager Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Task Manager',
      html,
      text,
    });
  }

  /**
   * Send welcome email (after verification)
   */
  async sendWelcomeEmail(user) {
    const loginUrl = `${process.env.FRONTEND_URL}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Task Manager</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6; 
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 30px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
            }
            .content h2 {
              color: #333;
              font-size: 24px;
              margin-bottom: 20px;
            }
            .feature { 
              background: #f8f9fa; 
              padding: 20px; 
              margin: 15px 0; 
              border-left: 4px solid #667eea; 
              border-radius: 5px; 
            }
            .feature strong {
              color: #667eea;
              font-size: 16px;
            }
            .feature p {
              margin: 10px 0 0 0;
              color: #555;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button { 
              display: inline-block; 
              padding: 15px 40px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white !important; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: 600;
              font-size: 16px;
            }
            .footer { 
              text-align: center; 
              padding: 20px 30px;
              background: #f8f9fa;
              color: #6c757d; 
              font-size: 13px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Email Verified Successfully!</h1>
            </div>
            <div class="content">
              <h2>Welcome aboard, ${user.firstName}!</h2>
              <p>Your email has been verified successfully. You can now access all features of Task Manager.</p>
              
              <div class="feature">
                <strong>✓ Create and manage tasks</strong>
                <p>Organize your work efficiently with our intuitive task management system.</p>
              </div>
              
              <div class="feature">
                <strong>✓ Collaborate with team</strong>
                <p>Assign tasks and work together seamlessly.</p>
              </div>
              
              <div class="feature">
                <strong>✓ Track progress</strong>
                <p>Monitor your productivity with detailed analytics.</p>
              </div>
              
              <div class="button-container">
                <a href="${loginUrl}" class="button">Login to Your Account</a>
              </div>
              
              <p style="margin-top: 30px;">If you have any questions, feel free to reach out to our support team.</p>
              
              <p>Best regards,<br><strong>The Task Manager Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Email Verified Successfully!
      
      Welcome aboard, ${user.firstName}!
      
      Your email has been verified. You can now login at:
      ${loginUrl}
      
      Best regards,
      The Task Manager Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Welcome to Task Manager - Email Verified',
      html,
      text,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6; 
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 30px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .content { 
              padding: 40px 30px;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button { 
              display: inline-block; 
              padding: 15px 40px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white !important; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: 600;
              font-size: 16px;
            }
            .link-box {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
              word-break: break-all;
            }
            .warning { 
              background: #fff3cd; 
              border-left: 4px solid #ffc107; 
              padding: 15px; 
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer { 
              text-align: center; 
              padding: 20px 30px;
              background: #f8f9fa;
              color: #6c757d; 
              font-size: 13px; 
            }
            ul {
              padding-left: 20px;
            }
            ul li {
              margin: 8px 0;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName},</h2>
              <p>We received a request to reset your password for your Task Manager account.</p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <div class="link-box">
                <p><strong>Or copy and paste this link into your browser:</strong></p>
                <p style="color: #667eea;">${resetUrl}</p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you did not request a password reset, please ignore this email and your password will remain unchanged.
              </div>
              
              <p><strong>For security reasons, we recommend that you:</strong></p>
              <ul>
                <li>Use a strong, unique password</li>
                <li>Never share your password with anyone</li>
                <li>Enable two-factor authentication if available</li>
              </ul>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Task Manager Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      Hello ${user.firstName},
      
      We received a request to reset your password. Click the link below:
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you did not request this, please ignore this email.
      
      Best regards,
      The Task Manager Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Reset Your Password - Task Manager',
      html,
      text,
    });
  }

  /**
   * Send login alert email
   */
  async sendLoginAlert(user, ip, userAgent) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Login Detected</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6; 
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 30px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .content { 
              padding: 40px 30px;
            }
            .info-box { 
              background: #f8f9fa; 
              padding: 20px; 
              margin: 20px 0; 
              border-radius: 5px; 
              border: 1px solid #dee2e6; 
            }
            .info-box p {
              margin: 8px 0;
              color: #555;
            }
            .footer { 
              text-align: center; 
              padding: 20px 30px;
              background: #f8f9fa;
              color: #6c757d; 
              font-size: 13px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 New Login Detected</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName},</h2>
              <p>We detected a new login to your Task Manager account.</p>
              
              <div class="info-box">
                <p><strong>📅 Login Details:</strong></p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>🌐 IP Address:</strong> ${ip}</p>
                <p><strong>💻 Device:</strong> ${userAgent}</p>
              </div>
              
              <p>If this was you, you can safely ignore this email.</p>
              <p><strong>If you did not log in, please change your password immediately and contact our support team.</strong></p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Task Manager Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      New Login Detected
      
      Hello ${user.firstName},
      
      We detected a new login to your account.
      
      Time: ${new Date().toLocaleString()}
      IP: ${ip}
      Device: ${userAgent}
      
      If this wasn't you, please change your password immediately.
      
      Best regards,
      The Task Manager Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'New Login Detected - Task Manager',
      html,
      text,
    });
  }

  /**
   * Send bulk emails (for notifications, newsletters, etc.)
   */
  async sendBulkEmail(recipients, subject, html, text) {
    try {
      const messages = recipients.map(recipient => ({
        to: recipient.email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM,
          name: process.env.SENDGRID_FROM_NAME || 'Task Manager',
        },
        subject,
        text,
        html,
      }));

      const response = await sgMail.send(messages);

      Logger.info('Bulk emails sent successfully', {
        count: recipients.length,
        statusCode: response[0].statusCode,
      });

      return { success: true, count: recipients.length };
    } catch (error) {
      Logger.error('Failed to send bulk emails:', {
        error: error.message,
        count: recipients.length,
      });
      throw error;
    }
  }
}

export default new EmailService();