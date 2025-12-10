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
     const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
  const verificationUrl = `${frontendUrl}/verify-email/${verificationToken}`;


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
    const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
  const loginUrl = `${frontendUrl}/login`;

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
    const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;


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
 * Send password changed confirmation email
 */
async sendPasswordChangedConfirmation(user, ip, userAgent) {
  const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
  const loginUrl = `${frontendUrl}/login`;
  const supportUrl = `${frontendUrl}/support`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed Successfully</title>
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
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
          .content p {
            margin-bottom: 15px;
            color: #555;
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
          .warning { 
            background: #fee2e2; 
            border-left: 4px solid #ef4444; 
            padding: 15px; 
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning strong {
            color: #991b1b;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button { 
            display: inline-block; 
            padding: 15px 40px; 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: 600;
            font-size: 16px;
            margin: 5px;
          }
          .button-secondary { 
            background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); 
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
            <h1>✅ Password Changed Successfully</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.firstName},</h2>
            <p>Your password has been changed successfully.</p>
            
            <div class="info-box">
              <p><strong>📅 Change Details:</strong></p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>🌐 IP Address:</strong> ${ip}</p>
              <p><strong>💻 Device:</strong> ${userAgent}</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important Security Notice:</strong><br>
              If you did NOT make this change, your account may be compromised. Please contact our support team immediately and we'll help secure your account.
            </div>
            
            <div class="button-container">
              <a href="${loginUrl}" class="button">Login Now</a>
              <a href="${supportUrl}" class="button button-secondary">Contact Support</a>
            </div>
            
            <p><strong>Security Tips:</strong></p>
            <ul>
              <li>Never share your password with anyone</li>
              <li>Use a unique password for your Task Manager account</li>
              <li>Enable two-factor authentication if available</li>
              <li>Regularly update your password</li>
            </ul>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>The Task Manager Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            <p>This is an automated security notification.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Password Changed Successfully
    
    Hello ${user.firstName},
    
    Your password has been changed successfully.
    
    Change Details:
    Time: ${new Date().toLocaleString()}
    IP Address: ${ip}
    Device: ${userAgent}
    
    ⚠️ IMPORTANT: If you did NOT make this change, contact support immediately.
    
    Login: ${loginUrl}
    Support: ${supportUrl}
    
    Best regards,
    The Task Manager Team
  `;

  return await this.sendEmail({
    to: user.email,
    subject: 'Password Changed Successfully - Task Manager',
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

  async sendContactSupportEmail(contactData) {
  const { name, email, subject, message, submittedAt, ipAddress } = contactData;

  // Support email address
  const supportEmail = process.env.SUPPORT_EMAIL || 'noreply@digitalmongers.com';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
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
            max-width: 700px; 
            margin: 30px auto; 
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 600;
          }
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.95;
            font-size: 14px;
          }
          .content { 
            padding: 40px 30px;
          }
          .info-section {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-section h2 {
            margin: 0 0 15px 0;
            color: #667eea;
            font-size: 18px;
            font-weight: 600;
          }
          .info-row {
            display: flex;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #495057;
            min-width: 120px;
          }
          .info-value {
            color: #212529;
            word-break: break-word;
          }
          .message-box {
            background: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.8;
          }
          .message-box h3 {
            margin: 0 0 15px 0;
            color: #495057;
            font-size: 16px;
            font-weight: 600;
          }
          .metadata {
            background: #e7f3ff;
            border-left: 4px solid #0d6efd;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            font-size: 13px;
          }
          .metadata p {
            margin: 5px 0;
            color: #084298;
          }
          .reply-button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 15px;
            margin: 20px 0;
          }
          .footer { 
            text-align: center; 
            padding: 20px 30px;
            background: #f8f9fa;
            color: #6c757d; 
            font-size: 12px; 
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            margin: 5px 0;
          }
          .priority-badge {
            display: inline-block;
            background: #ffc107;
            color: #000;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📩 New Contact Form Submission</h1>
            <p>Task Manager Support</p>
          </div>
          
          <div class="content">
            <div class="info-section">
              <h2>👤 Contact Information</h2>
              <div class="info-row">
                <div class="info-label">Name:</div>
                <div class="info-value"><strong>${name}</strong></div>
              </div>
              <div class="info-row">
                <div class="info-label">Email:</div>
                <div class="info-value">
                  <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">
                    ${email}
                  </a>
                </div>
              </div>
              <div class="info-row">
                <div class="info-label">Subject:</div>
                <div class="info-value"><strong>${subject}</strong></div>
              </div>
            </div>

            <div class="message-box">
              <h3>💬 Message Content</h3>
              ${message}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" class="reply-button">
                📧 Reply to ${name}
              </a>
            </div>

            <div class="metadata">
              <p><strong>📅 Submitted:</strong> ${new Date(submittedAt).toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}</p>
              <p><strong>🌐 IP Address:</strong> ${ipAddress}</p>
              <p><strong>🆔 Reference ID:</strong> CONTACT-${Date.now()}</p>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404;">
                <strong>⚠️ Action Required:</strong> Please respond to this inquiry within 24 hours to maintain our service quality standards.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Task Manager Support Team</strong></p>
            <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            <p>This is an automated notification from the contact form system.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    NEW CONTACT FORM SUBMISSION
    Task Manager Support 
    
    ========================================
    CONTACT INFORMATION
    ========================================
    Name: ${name}
    Email: ${email}
    Subject: ${subject}
    
    ========================================
    MESSAGE
    ========================================
    ${message}
    
    ========================================
    METADATA
    ========================================
    Submitted: ${new Date(submittedAt).toLocaleString()}
    IP Address: ${ipAddress}
    Reference ID: CONTACT-${Date.now()}
    
    ========================================
    
    Reply directly to: ${email}
    
    ---
    Task Manager Support Team
    © ${new Date().getFullYear()} Task Manager
  `;

  return await this.sendEmail({
    to: supportEmail,
    subject: `🆕 Contact Form: ${subject}`,
    html,
    text,
    // Add reply-to header so replies go to the user
    replyTo: email,
  });
}

/**
 * Send auto-reply confirmation to user
 * Add this method to your existing EmailService class
 */
async sendContactConfirmation(contactData) {
  const { name, email, subject, submittedAt } = contactData;
  
  const frontendUrl = process.env.FRONTEND_URL?.split(',')[0].trim() || 'http://localhost:3000';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>We Received Your Message</title>
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
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
            font-size: 22px;
            margin-bottom: 20px;
          }
          .content p {
            margin-bottom: 15px;
            color: #555;
            line-height: 1.8;
          }
          .info-box {
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
          }
          .info-box p {
            margin: 8px 0;
            color: #065f46;
          }
          .timeline {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .timeline-item {
            padding: 10px 0;
            display: flex;
            align-items: flex-start;
          }
          .timeline-icon {
            background: #10b981;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-size: 16px;
            flex-shrink: 0;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 35px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 15px;
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
            <h1> Message Received!</h1>
          </div>
          
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for contacting Task Manager Support. We've successfully received your message and our team will review it shortly.</p>
            
            <div class="info-box">
              <p><strong>📋 Your Submission Details:</strong></p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
              <p><strong>Reference ID:</strong> CONTACT-${Date.now()}</p>
            </div>

          
            <div class="button-container">
              <a href="${frontendUrl}/contact-us" class="button">Submit Another Message</a>
            </div>

            <div style="background: #e7f3ff; border-left: 4px solid #0d6efd; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; color: #084298;">
                <strong>💡 Tip:</strong> You can reply directly to this email if you need to add more information to your request.
              </p>
            </div>

            <p style="margin-top: 30px;">Best regards,<br><strong>The Task Manager Support Team</strong></p>
          </div>
          
          <div class="footer">
            <p><strong>Task Manager</strong></p>
            <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            <p>Need immediate help? Visit our <a href="${frontendUrl}/help" style="color: #667eea;">Help Center</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Message Received!

    Hello ${name},

    Thank you for contacting Task Manager Support. We've received your message.

    Your Submission Details:
    - Subject: ${subject}
    - Submitted: ${new Date(submittedAt).toLocaleString()}
    - Reference ID: CONTACT-${Date.now()}

    
    

    Best regards,
    The Task Manager Support Team

    ---
    © ${new Date().getFullYear()} Task Manager
  `;

  return await this.sendEmail({
    to: email,
    subject: ` We Received Your Message: ${subject}`,
    html,
    text,
  });
}

/**
 * Send suggestion email to support
 */
async sendSuggestionEmail(suggestionData) {
  const { userName, userEmail, title, description, message, submittedAt, ipAddress, suggestionId } = suggestionData;

  // Support email address
  const supportEmail = process.env.SUPPORT_EMAIL || 'noreply@digitalmongers.com';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New User Suggestion</title>
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
            max-width: 700px; 
            margin: 30px auto; 
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 600;
          }
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.95;
            font-size: 14px;
          }
          .content { 
            padding: 40px 30px;
          }
          .info-section {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-section h2 {
            margin: 0 0 15px 0;
            color: #d97706;
            font-size: 18px;
            font-weight: 600;
          }
          .info-row {
            display: flex;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #fef3c7;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #92400e;
            min-width: 120px;
          }
          .info-value {
            color: #78350f;
            word-break: break-word;
          }
          .suggestion-box {
            background: #ffffff;
            border: 2px solid #fbbf24;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
          }
          .suggestion-box h3 {
            margin: 0 0 10px 0;
            color: #92400e;
            font-size: 20px;
            font-weight: 600;
          }
          .suggestion-title {
            background: #fef3c7;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            font-size: 18px;
            font-weight: 600;
            color: #78350f;
          }
          .suggestion-description {
            background: #fef9f3;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            color: #78350f;
            line-height: 1.8;
          }
          .suggestion-message {
            background: #ffffff;
            border: 1px solid #fbbf24;
            border-radius: 5px;
            padding: 20px;
            margin: 15px 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.8;
            color: #78350f;
          }
          .metadata {
            background: #dbeafe;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            font-size: 13px;
          }
          .metadata p {
            margin: 5px 0;
            color: #1e40af;
          }
          .reply-button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 15px;
            margin: 20px 5px;
          }
          .footer { 
            text-align: center; 
            padding: 20px 30px;
            background: #f8f9fa;
            color: #6c757d; 
            font-size: 12px; 
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            margin: 5px 0;
          }
          .badge {
            display: inline-block;
            background: #fbbf24;
            color: #78350f;
            padding: 5px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💡 New User Suggestion</h1>
            <p>Task Manager - User Feedback System</p>
          </div>
          
          <div class="content">
            <div class="info-section">
              <h2>👤 User Information</h2>
              <div class="info-row">
                <div class="info-label">Name:</div>
                <div class="info-value"><strong>${userName}</strong></div>
              </div>
              <div class="info-row">
                <div class="info-label">Email:</div>
                <div class="info-value">
                  <a href="mailto:${userEmail}" style="color: #d97706; text-decoration: none;">
                    ${userEmail}
                  </a>
                </div>
              </div>
            </div>

            <div class="suggestion-box">
              <h3>📋 Suggestion Details</h3>
              
              <div class="suggestion-title">
                <strong>Title:</strong> ${title}
              </div>

              <div class="suggestion-description">
                <strong>Description:</strong><br>
                ${description}
              </div>

              <div class="suggestion-message">
                <strong>💬 Detailed Message:</strong><br><br>
                ${message}
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${userEmail}?subject=Re: ${encodeURIComponent(title)}" class="reply-button">
                📧 Reply to User
              </a>
            </div>

            <div class="metadata">
              <p><strong>📅 Submitted:</strong> ${new Date(submittedAt).toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}</p>
              <p><strong>🌐 IP Address:</strong> ${ipAddress || 'N/A'}</p>
              <p><strong>🆔 Suggestion ID:</strong> ${suggestionId}</p>
            </div>

            <div style="background: #dcfce7; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #166534;">
                <strong>✅ Action:</strong> Please review this suggestion and consider implementing it in future updates.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Task Manager Support Team</strong></p>
            <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            <p>This is an automated notification from the user suggestion system.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    NEW USER SUGGESTION
    Task Manager - User Feedback System
    
    ========================================
    USER INFORMATION
    ========================================
    Name: ${userName}
    Email: ${userEmail}
    
    ========================================
    SUGGESTION DETAILS
    ========================================
    
    TITLE:
    ${title}
    
    DESCRIPTION:
    ${description}
    
    DETAILED MESSAGE:
    ${message}
    
    ========================================
    METADATA
    ========================================
    Submitted: ${new Date(submittedAt).toLocaleString()}
    IP Address: ${ipAddress || 'N/A'}
    Suggestion ID: ${suggestionId}
    
    ========================================
    
    Reply to user: ${userEmail}
    
    ---
    Task Manager Support Team
    © ${new Date().getFullYear()} Task Manager
  `;

  return await this.sendEmail({
    to: supportEmail,
    subject: `💡 New Suggestion: ${title}`,
    html,
    text,
    replyTo: userEmail,
  });
}

/**
 * Send confirmation email to user after submitting suggestion
 */
async sendSuggestionConfirmation(suggestionData) {
  const { userName, userEmail, title, submittedAt } = suggestionData;
  
  const frontendUrl = process.env.FRONTEND_URL?.split(',')[0].trim() || 'http://localhost:3000';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Suggestion Received</title>
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
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
            font-size: 22px;
            margin-bottom: 20px;
          }
          .content p {
            margin-bottom: 15px;
            color: #555;
            line-height: 1.8;
          }
          .info-box {
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
          }
          .info-box p {
            margin: 8px 0;
            color: #065f46;
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
            <h1>💡 Suggestion Received!</h1>
          </div>
          
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Thank you for taking the time to share your suggestion with us! We truly value your feedback and ideas for improving Task Manager.</p>
            
            <div class="info-box">
              <p><strong>📋 Your Suggestion:</strong></p>
              <p><strong>Title:</strong> ${title}</p>
              <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
            </div>

            <p>Our team will carefully review your suggestion and consider it for future updates. We're committed to making Task Manager better based on user feedback like yours.</p>

            <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; color: #0c4a6e;">
                <strong>📧 Note:</strong> If we need any clarification or have questions about your suggestion, we'll reach out to you at this email address.
              </p>
            </div>

            <p style="margin-top: 30px;">Best regards,<br><strong>The Task Manager Team</strong></p>
          </div>
          
          <div class="footer">
            <p><strong>Task Manager</strong></p>
            <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            <p>Continue improving with us! Visit <a href="${frontendUrl}" style="color: #667eea;">Task Manager</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Suggestion Received!

    Hello ${userName},

    Thank you for sharing your suggestion with us!

    Your Suggestion:
    - Title: ${title}
    - Submitted: ${new Date(submittedAt).toLocaleString()}

    Our team will review your suggestion and consider it for future updates.

    Best regards,
    The Task Manager Team

    ---
    © ${new Date().getFullYear()} Task Manager
  `;

  return await this.sendEmail({
    to: userEmail,
    subject: `✅ We Received Your Suggestion: ${title}`,
    html,
    text,
  });
}

// Add these methods to your existing EmailService class

/**
 * Send task invitation email
 */
async sendTaskInvitation(invitation, task, inviter) {
  const frontendUrl = process.env.REDIRECT_URL.split(',')[0].trim();
  const acceptUrl = `${frontendUrl}/collaborations/accept/${invitation.invitationToken}`;
  const declineUrl = `${frontendUrl}/collaborations/decline/${invitation.invitationToken}`;
  
  const roleDescriptions = {
    owner: 'Full control - manage task, invite others, delete',
    editor: 'Edit task details, add subtasks, change status',
    assignee: 'Edit task and receive assignment notifications',
    viewer: 'View task details only (read-only access)'
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Collaboration Invitation</title>
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
            max-width: 650px; 
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
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.95;
          }
          .content { 
            padding: 40px 30px;
          }
          .inviter-info {
            display: flex;
            align-items: center;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .inviter-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: 600;
            margin-right: 15px;
          }
          .inviter-details h3 {
            margin: 0 0 5px 0;
            color: #333;
            font-size: 18px;
          }
          .inviter-details p {
            margin: 0;
            color: #6c757d;
            font-size: 14px;
          }
          .task-card {
            background: #ffffff;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
          }
          .task-title {
            font-size: 22px;
            font-weight: 600;
            color: #333;
            margin: 0 0 15px 0;
          }
          .task-description {
            color: #555;
            line-height: 1.8;
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
          }
          .task-meta {
            display: flex;
            gap: 20px;
            margin-top: 15px;
            flex-wrap: wrap;
          }
          .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #6c757d;
            font-size: 14px;
          }
          .role-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-block;
            margin: 15px 0;
          }
          .role-description {
            background: #e7f3ff;
            border-left: 4px solid #0d6efd;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .role-description p {
            margin: 0;
            color: #084298;
            font-size: 14px;
          }
          .message-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .message-box p {
            margin: 5px 0;
            color: #856404;
            font-style: italic;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
            display: flex;
            gap: 15px;
            justify-content: center;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
          }
          .button-accept {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white !important;
          }
          .button-decline {
            background: #6c757d;
            color: white !important;
          }
          .button:hover {
            transform: translateY(-2px);
          }
          .expires-warning {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .expires-warning p {
            margin: 0;
            color: #991b1b;
            font-size: 14px;
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
            <h1>🤝 Task Collaboration Invitation</h1>
            <p>You've been invited to collaborate on a task</p>
          </div>
          
          <div class="content">
            <div class="inviter-info">
              <div class="inviter-avatar">
                ${inviter.firstName.charAt(0)}${inviter.lastName?.charAt(0) || ''}
              </div>
              <div class="inviter-details">
                <h3>${inviter.firstName} ${inviter.lastName || ''}</h3>
                <p>${inviter.email}</p>
                <p style="color: #667eea; font-weight: 600; margin-top: 5px;">wants to collaborate with you</p>
              </div>
            </div>

            <div class="task-card">
              <div class="task-title">📋 ${task.title}</div>
              
              ${task.description ? `
                <div class="task-description">
                  ${task.description}
                </div>
              ` : ''}

              <div class="task-meta">
                ${task.dueDate ? `
                  <div class="meta-item">
                    <span>📅</span>
                    <span>Due: ${new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                ` : ''}
                ${task.category ? `
                  <div class="meta-item">
                    <span>🏷️</span>
                    <span>${task.category.title || 'Categorized'}</span>
                  </div>
                ` : ''}
                ${task.priority ? `
                  <div class="meta-item">
                    <span>⚡</span>
                    <span>${task.priority.name || 'Priority Set'}</span>
                  </div>
                ` : ''}
              </div>

              <div style="margin-top: 20px;">
                <div>You're being invited as:</div>
                <div class="role-badge">${invitation.role}</div>
              </div>

              <div class="role-description">
                <p><strong>📌 Your Permissions:</strong> ${roleDescriptions[invitation.role]}</p>
              </div>
            </div>

            ${invitation.message ? `
              <div class="message-box">
                <p><strong>💬 Personal message from ${inviter.firstName}:</strong></p>
                <p>"${invitation.message}"</p>
              </div>
            ` : ''}

            <div class="button-container">
              <a href="${acceptUrl}" class="button button-accept">✓ Accept Invitation</a>
              <a href="${declineUrl}" class="button button-decline">✗ Decline</a>
            </div>

            <div class="expires-warning">
              <p><strong>⏰ Important:</strong> This invitation will expire on ${new Date(invitation.expiresAt).toLocaleDateString()} at ${new Date(invitation.expiresAt).toLocaleTimeString()}</p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 14px; margin: 0;">
                Don't have an account? You'll be able to create one when you accept this invitation.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            <p>This invitation was sent to ${invitation.inviteeEmail}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Task Collaboration Invitation
    
    ${inviter.firstName} ${inviter.lastName || ''} (${inviter.email}) has invited you to collaborate on a task.
    
    Task: ${task.title}
    ${task.description ? `Description: ${task.description}` : ''}
    
    Your Role: ${invitation.role}
    Permissions: ${roleDescriptions[invitation.role]}
    
    ${invitation.message ? `Personal message: "${invitation.message}"` : ''}
    
    Accept invitation: ${acceptUrl}
    Decline invitation: ${declineUrl}
    
    This invitation expires on ${new Date(invitation.expiresAt).toLocaleString()}
    
    ---
    Task Manager
    © ${new Date().getFullYear()}
  `;

  return await this.sendEmail({
    to: invitation.inviteeEmail,
    subject: `${inviter.firstName} invited you to collaborate on "${task.title}"`,
    html,
    text,
  });
}


/**
 * Send team member invitation email (Enterprise Design)
 */
async sendTeamMemberInvitation(teamMember, owner) {
  const frontendUrl = process.env.REDIRECT_URL.split(',')[0].trim();
  const acceptUrl = `${frontendUrl}/invitations/accept/${teamMember.invitationToken}`;
  const declineUrl = `${frontendUrl}/invitations/decline/${teamMember.invitationToken}`;
  
  const roleDescriptions = {
    owner: 'Full team control - manage all tasks and members',
    editor: 'Create and edit tasks, invite collaborators',
    assignee: 'Work on assigned tasks and update status',
    viewer: 'View team tasks and activity (read-only)'
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
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
            max-width: 650px; 
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
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.95;
          }
          .content { 
            padding: 40px 30px;
          }
          .inviter-info {
            display: flex;
            align-items: center;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .inviter-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: 600;
            margin-right: 15px;
            flex-shrink: 0;
          }
          .inviter-details h3 {
            margin: 0 0 5px 0;
            color: #333;
            font-size: 18px;
          }
          .inviter-details p {
            margin: 0;
            color: #6c757d;
            font-size: 14px;
          }
          .team-card {
            background: #ffffff;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
          }
          .team-info {
            margin: 20px 0;
          }
          .info-row {
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #495057;
            min-width: 120px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .info-value {
            color: #212529;
          }
          .role-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-block;
            margin: 15px 0;
          }
          .role-description {
            background: #e7f3ff;
            border-left: 4px solid #0d6efd;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .role-description p {
            margin: 0;
            color: #084298;
            font-size: 14px;
          }
          .message-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .message-box p {
            margin: 5px 0;
            color: #856404;
            font-style: italic;
          }
          .benefits-box {
            background: #d1fae5;
            border-left: 4px solid #10b981;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .benefits-box h4 {
            margin: 0 0 10px 0;
            color: #065f46;
            font-size: 16px;
          }
          .benefits-box ul {
            margin: 10px 0;
            padding-left: 20px;
            color: #065f46;
          }
          .benefits-box li {
            margin: 5px 0;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
          }
          .button-accept {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white !important;
          }
          .button-decline {
            background: #6c757d;
            color: white !important;
          }
          .button:hover {
            transform: translateY(-2px);
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
            <h1>👥 Team Invitation</h1>
            <p>Join a collaborative workspace</p>
          </div>
          
          <div class="content">
            <div class="inviter-info">
              <div class="inviter-avatar">
                ${owner.firstName.charAt(0)}${owner.lastName?.charAt(0) || ''}
              </div>
              <div class="inviter-details">
                <h3>${owner.firstName} ${owner.lastName || ''}</h3>
                <p>${owner.email}</p>
                <p style="color: #667eea; font-weight: 600; margin-top: 5px;">invited you to join their team</p>
              </div>
            </div>

            <div class="team-card">
              <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">Team Invitation Details</h2>
              
              <div class="team-info">
                <div class="info-row">
                  <div class="info-label">
                    <span>👤</span>
                    <span>Team Owner:</span>
                  </div>
                  <div class="info-value">${owner.firstName} ${owner.lastName || ''}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">
                    <span>📧</span>
                    <span>Your Email:</span>
                  </div>
                  <div class="info-value">${teamMember.member.email}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">
                    <span>🎭</span>
                    <span>Your Role:</span>
                  </div>
                  <div class="info-value">
                    <span class="role-badge" style="margin: 0; padding: 4px 12px; font-size: 12px;">${teamMember.role}</span>
                  </div>
                </div>
              </div>

              <div class="role-description">
                <p><strong>📌 Your Permissions:</strong> ${roleDescriptions[teamMember.role] || 'Team member with assigned permissions'}</p>
              </div>
            </div>

            ${teamMember.invitationNote ? `
              <div class="message-box">
                <p><strong>💬 Personal message from ${owner.firstName}:</strong></p>
                <p>"${teamMember.invitationNote}"</p>
              </div>
            ` : ''}

            <div class="benefits-box">
              <h4>✨ What you'll get as a team member:</h4>
              <ul>
                <li>Collaborate on tasks in real-time</li>
                <li>Stay updated with team activity</li>
                <li>Share progress and communicate effectively</li>
                <li>Access team tasks and resources</li>
              </ul>
            </div>

            <div class="button-container">
              <a href="${acceptUrl}" class="button button-accept">✓ Accept & Join Team</a>
              <a href="${declineUrl}" class="button button-decline">✗ Decline</a>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 14px; margin: 0;">
                Don't have an account? Sign up first, then accept this invitation.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Task Manager</strong></p>
            <p>© ${new Date().getFullYear()} Task Manager. All rights reserved.</p>
            <p>This invitation was sent to ${teamMember.member.email}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Team Invitation
    
    ${owner.firstName} ${owner.lastName || ''} (${owner.email}) has invited you to join their team on Task Manager.
    
    Your Role: ${teamMember.role}
    Permissions: ${roleDescriptions[teamMember.role] || 'Team member with assigned permissions'}
    
    ${teamMember.invitationNote ? `Personal message: "${teamMember.invitationNote}"` : ''}
    
    What you'll get:
    - Collaborate on tasks in real-time
    - Stay updated with team activity
    - Share progress and communicate effectively
    - Access team tasks and resources
    
    Accept invitation: ${acceptUrl}
    Decline invitation: ${declineUrl}
    
    ---
    Task Manager
    © ${new Date().getFullYear()}
  `;

  return await this.sendEmail({
    to: teamMember.member.email,
    subject: `${owner.firstName} invited you to join their team on Task Manager`,
    html,
    text,
  });
}

/**
 * Send invitation reminder
 */
async sendInvitationReminder(invitation, task, inviter) {
  const frontendUrl = process.env.REDIRECT_URL.split(',')[0].trim();
  const acceptUrl = `${frontendUrl}/invitations/accept/${invitation.invitationToken}`;
  
  const daysLeft = Math.ceil((invitation.expiresAt - new Date()) / (1000 * 60 * 60 * 24));

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invitation Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; padding: 40px; }
          .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>⏰ Reminder: Task Collaboration Invitation</h2>
          <p>Hi there,</p>
          <p>This is a friendly reminder that ${inviter.firstName} invited you to collaborate on the task "<strong>${task.title}</strong>".</p>
          <p><strong>⚠️ This invitation expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!</strong></p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}" class="button">Accept Invitation Now</a>
          </div>
          <p>Best regards,<br>Task Manager Team</p>
        </div>
      </body>
    </html>
  `;

  return await this.sendEmail({
    to: invitation.inviteeEmail,
    subject: `⏰ Reminder: Invitation for "${task.title}" expires soon`,
    html,
    text: `Reminder: ${inviter.firstName} invited you to collaborate on "${task.title}". Expires in ${daysLeft} days. Accept: ${acceptUrl}`,
  });
}

/**
 * Send notification when invitation is accepted
 */
async sendInvitationAcceptedNotification(invitation, task, acceptedBy) {
  const frontendUrl = process.env.REDIRECT_URL.split(',')[0].trim();
  const taskUrl = `${frontendUrl}/tasks/${task._id}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invitation Accepted</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; padding: 40px; }
          .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>✅ Invitation Accepted!</h2>
          <div class="success">
            <p><strong>${acceptedBy.firstName} ${acceptedBy.lastName}</strong> has accepted your invitation to collaborate on "<strong>${task.title}</strong>".</p>
          </div>
          <p>They can now access and collaborate on this task based on their assigned role.</p>
          <p><a href="${taskUrl}" style="color: #667eea;">View Task →</a></p>
        </div>
      </body>
    </html>
  `;

  return await this.sendEmail({
    to: invitation.inviter.email,
    subject: `✅ ${acceptedBy.firstName} accepted your task invitation`,
    html,
    text: `${acceptedBy.firstName} ${acceptedBy.lastName} accepted your invitation for "${task.title}". View: ${taskUrl}`,
  });
}

/**
 * Send notification when collaborator is removed
 */
async sendCollaboratorRemovedNotification(task, removedUser, removedBy) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Removed from Task</title>
      </head>
      <body>
        <div style="max-width: 600px; margin: 30px auto; padding: 40px; background: white;">
          <h2>📌 Task Access Removed</h2>
          <p>Hi ${removedUser.firstName},</p>
          <p>You have been removed from the task "<strong>${task.title}</strong>" by ${removedBy.firstName} ${removedBy.lastName}.</p>
          <p>You no longer have access to this task.</p>
          <p>Best regards,<br>Task Manager Team</p>
        </div>
      </body>
    </html>
  `;

  return await this.sendEmail({
    to: removedUser.email,
    subject: `Access removed: "${task.title}"`,
    html,
    text: `You have been removed from task "${task.title}".`,
  });
}

/**
 * Send task shared notification to team member
 */
async sendTaskSharedNotification(task, teamMember, owner) {
  const frontendUrl = process.env.REDIRECT_URL.split(',')[0].trim();
  const taskUrl = `${frontendUrl}/tasks/${task._id}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Task Shared With You</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; padding: 40px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -40px -40px 30px; }
          .task-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Task Shared With You</h1>
          </div>
          <h2>Hello ${teamMember.firstName},</h2>
          <p>${owner.firstName} ${owner.lastName} has shared a task with you from their Task Manager.</p>
          
          <div class="task-card">
            <h3>${task.title}</h3>
            ${task.description ? `<p>${task.description}</p>` : ''}
            ${task.dueDate ? `<p><strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${taskUrl}" class="button">View Task</a>
          </div>
          
          <p>You can now collaborate on this task based on your assigned role.</p>
          <p>Best regards,<br><strong>Task Manager Team</strong></p>
        </div>
      </body>
    </html>
  `;

  const text = `
    Task Shared With You
    
    Hello ${teamMember.firstName},
    
    ${owner.firstName} ${owner.lastName} has shared a task with you.
    
    Task: ${task.title}
    ${task.description ? `Description: ${task.description}` : ''}
    
    View task: ${taskUrl}
    
    Best regards,
    Task Manager Team
  `;

  return await this.sendEmail({
    to: teamMember.email,
    subject: `${owner.firstName} shared a task with you: "${task.title}"`,
    html,
    text,
  });
}

}

export default new EmailService();