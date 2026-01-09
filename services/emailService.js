import sgMail from '@sendgrid/mail';
import Logger from '../config/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read logo file for embedding
const logoPath = path.join(__dirname, '../public/task.ico');
let logoAttachment = null;

try {
  if (fs.existsSync(logoPath)) {
    const logoContent = fs.readFileSync(logoPath).toString('base64');
    logoAttachment = {
      content: logoContent,
      filename: 'task.ico',
      type: 'image/x-icon',
      disposition: 'inline',
      content_id: 'tasskr_logo'
    };
  } else {
    Logger.warn('Logo file not found at ' + logoPath);
  }
} catch (error) {
  Logger.error('Failed to read logo file:', error);
}

const LOGO_URL = 'cid:tasskr_logo';

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
          name: process.env.SENDGRID_FROM_NAME || 'Tasskr',
        },
        subject,
        text,
        html,
        attachments: logoAttachment ? [logoAttachment] : [],
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
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
              color: #FF6B6B;
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1> Welcome to Tasskr!</h1>
              </div>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName} ${user.lastName},</h2>
              <p>Thank you for registering with Tasskr. To complete your registration and start using our platform, please verify your email address by clicking the button below.</p>
              
              <div class="button-container">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <div class="link-box">
                <p><strong>Or copy and paste this link into your browser:</strong></p>
                <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This verification link will expire in 24 hours. If you did not create an account with Tasskr, please ignore this email.
              </div>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Tasskr Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to Tasskr!
      
      Hello ${user.firstName} ${user.lastName},
      
      Thank you for registering. Please verify your email address by visiting:
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you did not create an account, please ignore this email.
      
      Best regards,
      The Tasskr Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Tasskr',
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
          <title>Welcome to Tasskr</title>
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
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
              border-left: 4px solid #FF6B6B; 
              border-radius: 5px; 
            }
            .feature strong {
              color: #FF6B6B;
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1> Email Verified Successfully!</h1>
              </div>
            </div>
            <div class="content">
              <h2>Welcome aboard, ${user.firstName}!</h2>
              <p>Your email has been verified successfully. You can now access all features of Tasskr.</p>
              
              <div class="feature">
                <strong>✓ Create and manage tasks</strong>
                <p>Organize your work efficiently with our intuitive Tasskr.</p>
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
              
              <p>Best regards,<br><strong>The Tasskr Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
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
      The Tasskr Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Welcome to Tasskr - Email Verified',
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>🔐 Password Reset Request</h1>
              </div>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName},</h2>
              <p>We received a request to reset your password for your Tasskr account.</p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <div class="link-box">
                <p><strong>Or copy and paste this link into your browser:</strong></p>
                <p style="color: #FF6B6B;">${resetUrl}</p>
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
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Tasskr Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
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
      The Tasskr Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Reset Your Password - Tasskr',
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .header img {
            width: 50px;
            height: 50px;
            margin-bottom: 15px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>✅ Password Changed Successfully</h1>
              </div>
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
              <li>Use a unique password for your Tasskr account</li>
              <li>Enable two-factor authentication if available</li>
              <li>Regularly update your password</li>
            </ul>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>The Tasskr Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
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
    The Tasskr Team
  `;

  return await this.sendEmail({
    to: user.email,
    subject: 'Password Changed Successfully - Tasskr',
    html,
    text,
  });
}

  /**
   * Send new device login alert email
   */
  async sendNewDeviceLoginEmail(user, deviceInfo) {
    const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
    const securityUrl = `${frontendUrl}/security`;
    const changePasswordUrl = `${frontendUrl}/settings/security`;

    const { deviceType, browser, os, city, country, ipAddress, loginTime } = deviceInfo;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Device Login Detected</title>
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
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
              border-radius: 8px; 
              border-left: 4px solid #FF6B6B; 
            }
            .info-box p {
              margin: 10px 0;
              color: #555;
              display: flex;
              align-items: center;
            }
            .info-box strong {
              min-width: 120px;
              color: #333;
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
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button { 
              display: inline-block; 
              padding: 15px 30px; 
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
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
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>🔐 New Device Login Detected</h1>
              </div>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName},</h2>
              <p>We detected a login to your Tasskr account from a new device or location.</p>
              
              <div class="info-box">
                <p><strong>📅 Time:</strong> ${loginTime || new Date().toLocaleString()}</p>
                <p><strong>💻 Device:</strong> ${deviceType || 'Unknown'}</p>
                <p><strong>🌐 Browser:</strong> ${browser || 'Unknown'}</p>
                <p><strong>⚙️ OS:</strong> ${os || 'Unknown'}</p>
                <p><strong>📍 Location:</strong> ${city || 'Unknown'}, ${country || 'Unknown'}</p>
                <p><strong>🔢 IP Address:</strong> ${ipAddress || 'Unknown'}</p>
              </div>
              
              <p><strong>Was this you?</strong></p>
              <p>If you recognize this activity, you can safely ignore this email. Your account remains secure.</p>
              
              <div class="warning">
                <strong>⚠️ Security Alert:</strong><br>
                If you did NOT log in from this device, your account may be compromised. Please take immediate action to secure your account.
              </div>
              
              <div class="button-container">
                <a href="${securityUrl}" class="button">View Login Activity</a>
                <a href="${changePasswordUrl}" class="button button-secondary">Change Password</a>
              </div>
              
              <p><strong>Security Recommendations:</strong></p>
              <ul>
                <li>Review your recent login activity</li>
                <li>Change your password if you don't recognize this login</li>
                <li>Enable two-factor authentication for added security</li>
                <li>Log out from all devices if needed</li>
              </ul>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Tasskr Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
              <p>This is an automated security notification. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      New Device Login Detected
      
      Hello ${user.firstName},
      
      We detected a login to your account from a new device or location.
      
      Login Details:
      Time: ${loginTime || new Date().toLocaleString()}
      Device: ${deviceType || 'Unknown'}
      Browser: ${browser || 'Unknown'}
      OS: ${os || 'Unknown'}
      Location: ${city || 'Unknown'}, ${country || 'Unknown'}
      IP Address: ${ipAddress || 'Unknown'}
      
      Was this you?
      If you recognize this activity, you can safely ignore this email.
      
      ⚠️ SECURITY ALERT: If you did NOT log in from this device, please:
      1. Change your password immediately: ${changePasswordUrl}
      2. Review your login activity: ${securityUrl}
      3. Enable two-factor authentication
      4. Log out from all devices if needed
      
      Best regards,
      The Tasskr Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: '🔐 New Device Login Detected - Tasskr',
      html,
      text,
    });
  }

  /**
   * Send login alert email (legacy - kept for backward compatibility)
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>🔐 New Login Detected</h1>
              </div>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName},</h2>
              <p>We detected a new login to your Tasskr account.</p>
              
              <div class="info-box">
                <p><strong>📅 Login Details:</strong></p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>🌐 IP Address:</strong> ${ip}</p>
                <p><strong>💻 Device:</strong> ${userAgent}</p>
              </div>
              
              <p>If this was you, you can safely ignore this email.</p>
              <p><strong>If you did not log in, please change your password immediately and contact our support team.</strong></p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The Tasskr Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
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
      The Tasskr Team
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'New Login Detected - Tasskr',
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
          name: process.env.SENDGRID_FROM_NAME || 'Tasskr',
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
          }
          .header img {
            width: 50px;
            height: 50px;
            margin-bottom: 15px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            border-left: 4px solid #FF6B6B;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-section h2 {
            margin: 0 0 15px 0;
            color: #FF6B6B;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
          .header img {
            width: 50px;
            height: 50px;
            margin-bottom: 15px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
        </style>
      </head>
      <body>
        <div class="container">
            <div class="header">
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>📩 New Submission</h1>
              </div>
              <p>Tasskr Contact Form</p>
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
                  <a href="mailto:${email}" style="color: #FF6B6B; text-decoration: none;">
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
            <p><strong>Tasskr Support Team</strong></p>
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            <p>This is an automated notification from the contact form system.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    NEW CONTACT FORM SUBMISSION
    Tasskr Support 
    
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
    Tasskr Support Team
    © ${new Date().getFullYear()} Tasskr
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .header img {
            width: 50px;
            height: 50px;
            margin-bottom: 15px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            border-left: 4px solid #FF6B6B;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
          }
          .info-box p {
            margin: 8px 0;
            color: #FF6B6B;
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
            background: #FF6B6B;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
            <p>Thank you for contacting Tasskr Support. We've successfully received your message and our team will review it shortly.</p>
            
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

            <p style="margin-top: 30px;">Best regards,<br><strong>The Tasskr Support Team</strong></p>
          </div>
          
          <div class="footer">
            <p><strong>Tasskr</strong></p>
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            <p>Need immediate help? Visit our <a href="${frontendUrl}/help" style="color: #FF6B6B;">Help Center</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Message Received!

    Hello ${name},

    Thank you for contacting Tasskr Support. We've received your message.

    Your Submission Details:
    - Subject: ${subject}
    - Submitted: ${new Date(submittedAt).toLocaleString()}
    - Reference ID: CONTACT-${Date.now()}

    
    

    Best regards,
    The Tasskr Support Team

    ---
    © ${new Date().getFullYear()} Tasskr
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
          }
          .header img {
            width: 50px;
            height: 50px;
            margin-bottom: 15px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            border-left: 4px solid #FF6B6B;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .info-section h2 {
            margin: 0 0 15px 0;
            color: #FF6B6B;
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
            color: #FF6B6B;
            min-width: 120px;
          }
          .info-value {
            color: #78350f;
            word-break: break-word;
          }
          .suggestion-box {
            background: #ffffff;
            border: 2px solid #FF6B6B;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
          }
          .suggestion-box h3 {
            margin: 0 0 10px 0;
            color: #FF6B6B;
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
            border: 1px solid #FF6B6B;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
            font-size: 13px; 
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            margin: 5px 0;
          }
          .badge {
            display: inline-block;
            background: #FF6B6B;
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>💡 New User Suggestion</h1>
              </div>
              <p>Tasskr - User Feedback System</p>
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
                  <a href="mailto:${userEmail}" style="color: #FF6B6B; text-decoration: none;">
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
            <p><strong>Tasskr Support Team</strong></p>
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            <p>This is an automated notification from the user suggestion system.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    NEW USER SUGGESTION
    Tasskr - User Feedback System
    
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
    Tasskr Support Team
    © ${new Date().getFullYear()} Tasskr
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .header-branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 0; /* Adjusted for header-branding */
          }
          .header img {
            width: 50px;
            height: 50px;
            margin-bottom: 0; /* Adjusted for header-branding */
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            border-left: 4px solid #FF6B6B;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
          }
          .info-box p {
            margin: 8px 0;
            color: #FF6B6B;
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>💡 Suggestion Received!</h1>
              </div>
            </div>
          
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Thank you for taking the time to share your suggestion with us! We truly value your feedback and ideas for improving Tasskr.</p>
            
            <div class="info-box">
              <p><strong>📋 Your Suggestion:</strong></p>
              <p><strong>Title:</strong> ${title}</p>
              <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
            </div>

            <p>Our team will carefully review your suggestion and consider it for future updates. We're committed to making Tasskr better based on user feedback like yours.</p>

            <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; color: #0c4a6e;">
                <strong>📧 Note:</strong> If we need any clarification or have questions about your suggestion, we'll reach out to you at this email address.
              </p>
            </div>

            <p style="margin-top: 30px;">Best regards,<br><strong>The Tasskr Team</strong></p>
          </div>
          
          <div class="footer">
            <p><strong>Tasskr</strong></p>
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            <p>Continue improving with us! Visit <a href="${frontendUrl}" style="color: #FF6B6B;">Tasskr</a></p>
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
    The Tasskr Team

    ---
    © ${new Date().getFullYear()} Tasskr
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 25px 20px; 
            text-align: center; 
          }
          .header-branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 8px;
          }
          .header img {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 0;
            flex-shrink: 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
          }
          .header p {
            margin: 0;
            opacity: 0.95;
            font-size: 15px;
            font-weight: 500;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: 600;
            margin-right: 15px;
            flex-shrink: 0;
            line-height: 1;
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
            border: 2px solid #FF6B6B;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            min-width: 160px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .button-accept {
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white !important;
            border: 2px solid transparent;
          }
          .button-decline {
            background: #ffffff;
            color: #FF6B6B !important;
            border: 2px solid #FF6B6B;
          }
          .button-decline:hover {
            background: #fff0eb;
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
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1>Task Collaboration Invitation</h1>
            </div>
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
                <p style="color: #FF6B6B; font-weight: 600; margin-top: 5px;">wants to collaborate with you</p>
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
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
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
    Tasskr
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 25px 20px; 
            text-align: center; 
          }
          .header-branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 8px;
          }
          .header img {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 0;
            flex-shrink: 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
          }
          .header p {
            margin: 0;
            opacity: 0.95;
            font-size: 15px;
            font-weight: 500;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: 600;
            margin-right: 15px;
            flex-shrink: 0;
            line-height: 1;
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
            border: 2px solid #FF6B6B;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
            gap: 40px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            min-width: 160px;
            text-align: center;
            box-shadow: 0 2px 2px rgba(0,0,0,0.1);
          }
          .button-accept {
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white !important;
            border: 2px solid transparent;
          }
          .button-decline {
            background: #ffffff;
            color: #FF6B6B !important;
            border: 2px solid #FF6B6B;
          }
          .button-decline:hover {
            background: #fff0eb;
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
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1>Team Invitation</h1>
            </div>
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
                <p style="color: #FF6B6B; font-weight: 600; margin-top: 5px;">invited you to join their team</p>
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
                  <div class="info-value">${teamMember.memberEmail}</div>
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
            <p><strong>Tasskr</strong></p>
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            <p>This invitation was sent to ${teamMember.memberEmail}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Team Invitation
    
    ${owner.firstName} ${owner.lastName || ''} (${owner.email}) has invited you to join their team on Tasskr.
    
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
    Tasskr
    © ${new Date().getFullYear()}
  `;

  return await this.sendEmail({
    to: teamMember.memberEmail,
    subject: `${owner.firstName} invited you to join their team on Tasskr`,
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
            .header { 
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
            }
            .content { padding: 40px 30px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white !important; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: 600;
              min-width: 160px;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              border: 2px solid transparent;
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1> Invitation Reminder</h1>
              </div>
            </div>
            <div class="content">
              <h2>Hi there,</h2>
              <p>This is a friendly reminder that ${inviter.firstName} invited you to collaborate on the task "<strong>${task.title}</strong>".</p>
              
              <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b;">
                  <strong>⚠️ This invitation expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!</strong>
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${acceptUrl}" class="button">Accept Invitation Now</a>
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            </div>
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
            .header { 
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
            }
            .content { padding: 40px 30px; }
            .success { background: #ffebe0; border-left: 4px solid #FF6B6B; padding: 15px; border-radius: 4px; margin: 20px 0; }
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
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1> Invitation Accepted!</h1>
              </div>
            </div>
            <div class="content">
              <div class="success">
                <p><strong>${acceptedBy.firstName} ${acceptedBy.lastName}</strong> has accepted your invitation to collaborate on "<strong>${task.title}</strong>".</p>
              </div>
              <p>They can now access and collaborate on this task based on their assigned role.</p>
              <p style="text-align: center; margin-top: 30px;">
                <a href="${taskUrl}" style="color: #FF6B6B; font-weight: 600; text-decoration: none;">View Task →</a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            </div>
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 25px 20px; 
            text-align: center; 
          }
          .header-branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 8px;
          }
          .header img {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 0;
            flex-shrink: 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
          }
          .content { padding: 40px 30px; }
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
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1>📌 Task Access Removed</h1>
            </div>
          </div>
          <div class="content">
            <p>Hi ${removedUser.firstName},</p>
            <p>You have been removed from the task "<strong>${task.title}</strong>" by ${removedBy.firstName} ${removedBy.lastName}.</p>
            <p>You no longer have access to this task.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
          </div>
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
  const taskUrl = `${frontendUrl}/user`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Task Shared With You</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; padding: 40px; }
            .header { 
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
            }
            .task-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF6B6B; }
            .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white !important; text-decoration: none; border-radius: 5px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-branding">
                <img src="${LOGO_URL}" alt="Tasskr">
                <h1>Task Shared With You</h1>
              </div>
            </div>
          <h2>Hello ${teamMember.firstName},</h2>
          <p>${owner.firstName} ${owner.lastName} has shared a task with you from their Tasskr.</p>
          
          <div class="task-card">
            <h3>${task.title}</h3>
            ${task.description ? `<p>${task.description}</p>` : ''}
            ${task.dueDate ? `<p><strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${taskUrl}" class="button">View Task</a>
          </div>
          
          <p>You can now collaborate on this task based on your assigned role.</p>
          <p>Best regards,<br><strong>Tasskr Team</strong></p>
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
    Tasskr Team
  `;

  return await this.sendEmail({
    to: teamMember.email,
    subject: `${owner.firstName} shared a task with you: "${task.title}"`,
    html,
    text,
  });
}

// ========== VITAL TASK EMAIL TEMPLATES ==========

/**
 * Send vital task invitation email
 */
async sendVitalTaskInvitation(invitation, vitalTask, inviter) {
  const frontendUrl = process.env.REDIRECT_URL.split(',')[0].trim();
  const acceptUrl = `${frontendUrl}/vitalcollaborations/accept/${invitation.invitationToken}`;
  const declineUrl = `${frontendUrl}/vitalcollaborations/decline/${invitation.invitationToken}`;
  
  const roleDescriptions = {
    owner: 'Full control - manage vital task, invite others, delete',
    editor: 'Edit vital task details, change status',
    assignee: 'Edit vital task and receive assignment notifications',
    viewer: 'View vital task details only (read-only access)'
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vital Task Collaboration Invitation</title>
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
            }
            .header p {
              margin: 0;
              opacity: 0.95;
              font-size: 15px;
              font-weight: 500;
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 24px;
              font-weight: 600;
              margin-right: 15px;
              flex-shrink: 0;
              line-height: 1;
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
            border: 2px solid #FF6B6B;
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
          .vital-badge {
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white;
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-block;
            margin-left: 10px;
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
            background: #fee2e2;
            border-left: 4px solid #FF6B6B;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .role-description p {
            margin: 0;
            color: #FF6B6B;
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
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            min-width: 160px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .button-accept {
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white !important;
            border: 2px solid transparent;
          }
          .button-decline {
            background: #ffffff;
            color: #FF6B6B !important;
            border: 2px solid #FF6B6B;
          }
          .button-decline:hover {
            background: #fff0eb;
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
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1> Vital Task Invitation</h1>
            </div>
            <p>You've been invited to collaborate on a vital task</p>
          </div>
          
          <div class="content">
            <div class="inviter-info">
              <div class="inviter-avatar">
                ${inviter.firstName.charAt(0)}${inviter.lastName?.charAt(0) || ''}
              </div>
              <div class="inviter-details">
                <h3>${inviter.firstName} ${inviter.lastName || ''}</h3>
                <p>${inviter.email}</p>
                <p style="color: #FF6B6B; font-weight: 600; margin-top: 5px;">wants to collaborate with you</p>
              </div>
            </div>

            <div class="task-card">
              <div class="task-title">
                🔴 ${vitalTask.title}
                <span class="vital-badge">VITAL</span>
              </div>
              
              ${vitalTask.description ? `
                <div class="task-description">
                  ${vitalTask.description}
                </div>
              ` : ''}

              <div class="task-meta">
                ${vitalTask.dueDate ? `
                  <div class="meta-item">
                    <span>📅</span>
                    <span>Due: ${new Date(vitalTask.dueDate).toLocaleDateString()}</span>
                  </div>
                ` : ''}
                ${vitalTask.category ? `
                  <div class="meta-item">
                    <span>🏷️</span>
                    <span>${vitalTask.category.title || 'Categorized'}</span>
                  </div>
                ` : ''}
                ${vitalTask.priority ? `
                  <div class="meta-item">
                    <span>⚡</span>
                    <span>${vitalTask.priority.name || 'Priority Set'}</span>
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
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
            <p>This invitation was sent to ${invitation.inviteeEmail}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Vital Task Collaboration Invitation
    
    ${inviter.firstName} ${inviter.lastName || ''} (${inviter.email}) has invited you to collaborate on a vital task.
    
    Vital Task: ${vitalTask.title}
    ${vitalTask.description ? `Description: ${vitalTask.description}` : ''}
    
    Your Role: ${invitation.role}
    Permissions: ${roleDescriptions[invitation.role]}
    
    ${invitation.message ? `Personal message: "${invitation.message}"` : ''}
    
    Accept invitation: ${acceptUrl}
    Decline invitation: ${declineUrl}
    
    This invitation expires on ${new Date(invitation.expiresAt).toLocaleString()}
    
    ---
    Tasskr
    © ${new Date().getFullYear()}
  `;

  return await this.sendEmail({
    to: invitation.inviteeEmail,
    subject: `🔴 ${inviter.firstName} invited you to collaborate on vital task: "${vitalTask.title}"`,
    html,
    text,
  });
}

/**
 * Send vital task shared notification
 */
async sendVitalTaskSharedNotification(vitalTask, collaborator, owner) {
  const frontendUrl = process.env.REDIRECT_URL.split(',')[0].trim();
  const vitalTaskUrl = `${frontendUrl}/user/vital`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vital Task Shared With You</title>
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
              background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
              color: white; 
              padding: 25px 20px; 
              text-align: center; 
            }
            .header-branding {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 8px;
            }
            .header img {
              width: 48px;
              height: 48px;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin: 0;
              flex-shrink: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
              line-height: 1.2;
            }
          .content { 
            padding: 40px 30px;
          }
          .task-card {
            background: #ffffff;
            border: 2px solid #FF6B6B;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
          }
          .vital-badge {
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white;
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            display: inline-block;
            margin-left: 10px;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
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
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1> Vital Task Shared</h1>
            </div>
          </div>
          
          <div class="content">
            <p>Hello ${collaborator.firstName},</p>
            <p>${owner.firstName} ${owner.lastName || ''} has shared a vital task with you.</p>

            <div class="task-card">
              <h2>
                ${vitalTask.title}
                <span class="vital-badge">VITAL</span>
              </h2>
              ${vitalTask.description ? `<p>${vitalTask.description}</p>` : ''}
            </div>

            <div style="text-align: center;">
              <a href="${vitalTaskUrl}" class="button">View Vital Task</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Vital Task Shared With You

    Hello ${collaborator.firstName},

    ${owner.firstName} ${owner.lastName || ''} has shared a vital task with you.

    Vital Task: ${vitalTask.title}
    ${vitalTask.description ? `Description: ${vitalTask.description}` : ''}

    View vital task: ${vitalTaskUrl}

    ---
    Tasskr
    © ${new Date().getFullYear()}
  `;

  return await this.sendEmail({
    to: collaborator.email,
    subject: `🔴 ${owner.firstName} shared a vital task with you: "${vitalTask.title}"`,
    html,
    text,
  });
}

/**
 * Send vital task collaborator removed notification
 */
async sendVitalTaskCollaboratorRemovedNotification(vitalTask, removedUser, remover) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Removed from Vital Task</title>
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
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); 
            color: white; 
            padding: 25px 20px; 
            text-align: center; 
          }
          .header-branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 8px;
          }
          .header img {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 0;
            flex-shrink: 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
          }
          .content { 
            padding: 40px 30px;
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
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1> Removed from Vital Task</h1>
            </div>
          </div>
          
          <div class="content">
            <p>Hello ${removedUser.firstName},</p>
            <p>${remover.firstName} ${remover.lastName || ''} has removed you from the vital task: <strong>"${vitalTask.title}"</strong></p>
            <p>You no longer have access to this vital task.</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Removed from Vital Task

    Hello ${removedUser.firstName},

    ${remover.firstName} ${remover.lastName || ''} has removed you from the vital task: "${vitalTask.title}"

    You no longer have access to this vital task.

    ---
    Tasskr
    © ${new Date().getFullYear()}
  `;

  return await this.sendEmail({
    to: removedUser.email,
    subject: `Removed from vital task: "${vitalTask.title}"`,
    html,
    text,
  });
}

/**
 * Send plan purchase confirmation email to user
 */
async sendPlanPurchaseEmail(user, planKey, billingCycle, amount, invoiceUrl) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Confirmed - Tasskr</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white; padding: 25px 20px; text-align: center; }
          .header-branding { display: flex; align-items: center; justify-content: center; gap: 15px; }
          .header img { width: 48px; height: 48px; background: rgba(255, 255, 255, 0.2); padding: 8px; border-radius: 12px; }
          .content { padding: 40px 30px; }
          .plan-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .plan-name { font-size: 24px; font-weight: bold; color: #FF6B6B; margin-bottom: 5px; }
          .plan-price { font-size: 18px; color: #555; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white !important; text-decoration: none; border-radius: 5px; font-weight: 600; }
          .footer { text-align: center; padding: 20px 30px; background: #f8f9fa; color: #6c757d; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1>Purchase Confirmed!</h1>
            </div>
          </div>
          <div class="content">
            <p>Hello ${user.firstName},</p>
            <p>Thank you for upgrading! Your payment was successful, and your <strong>${planKey}</strong> plan is now active.</p>
            
            <div class="plan-box">
              <div class="plan-name">${planKey} Plan</div>
              <div class="plan-price">$${amount} / ${billingCycle.toLowerCase()}</div>
            </div>

            <p>You now have access to premium features, increased collaborator limits, and monthly AI boosts.</p>
            
            ${invoiceUrl ? `
            <div class="button-container">
              <a href="${invoiceUrl}" class="button">Download Invoice</a>
            </div>
            ` : ''}

            <p>Best regards,<br><strong>The Tasskr Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    Purchase Confirmed!
    
    Hello ${user.firstName},
    
    Thank you for upgrading to the ${planKey} plan ($${amount}/${billingCycle.toLowerCase()}).
    Your plan is now active with all premium features.
    
    ${invoiceUrl ? `You can download your invoice here: ${invoiceUrl}` : ''}
    
    Best regards,
    The Tasskr Team
  `;

  return await this.sendEmail({
    to: user.email,
    subject: `Welcome to the ${planKey} Plan! - Tasskr`,
    html,
    text,
  });
}

/**
 * Send plan purchase notification to admin
 */
async sendAdminPlanPurchaseNotification(user, planKey, billingCycle, amount) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
  
  const html = `
    <h2>New Subscription! </h2>
    <p>A user has just purchased a new plan.</p>
    <ul>
      <li><strong>User:</strong> ${user.firstName} ${user.lastName} (${user.email})</li>
      <li><strong>Plan:</strong> ${planKey}</li>
      <li><strong>Cycle:</strong> ${billingCycle}</li>
      <li><strong>Amount:</strong> $${amount}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
    </ul>
  `;

  return await this.sendEmail({
    to: adminEmail,
    subject: `🚀 New Sale: ${planKey} Plan purchased by ${user.email}`,
    html,
    text: `New Sale: ${user.email} purchased ${planKey} plan for $${amount} (${billingCycle})`,
  });
}

/**
 * Send AI Boost exhaustion alert
 */
async sendBoostExhaustionEmail(user) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Boosts Exhausted - Tasskr</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #6B7280 0%, #374151 100%); color: white; padding: 25px 20px; text-align: center; }
          .header-branding { display: flex; align-items: center; justify-content: center; gap: 15px; }
          .header img { width: 48px; height: 48px; background: rgba(255, 255, 255, 0.2); padding: 8px; border-radius: 12px; }
          .content { padding: 40px 30px; }
          .warning-box { background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .warning-title { font-size: 20px; font-weight: bold; color: #92400E; margin-bottom: 5px; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white !important; text-decoration: none; border-radius: 5px; font-weight: 600; }
          .footer { text-align: center; padding: 20px 30px; background: #f8f9fa; color: #6c757d; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-branding">
              <img src="${LOGO_URL}" alt="Tasskr">
              <h1>Action Required: AI Boosts Exhausted</h1>
            </div>
          </div>
          <div class="content">
            <p>Hello ${user.firstName},</p>
            <p>You have used up all your AI boosts for the current period.</p>
            
            <div class="warning-box">
              <div class="warning-title">Boosts Exhausted (0 remaining)</div>
              <p>Your AI-powered features will be limited until your next billing cycle.</p>
            </div>

            <p>To continue using AI features without interruption, you can upgrade to a higher plan or wait for your boosts to reset.</p>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL.split(',')[0].trim()}/pricing" class="button">View Plans & Upgrade</a>
            </div>

            <p>Best regards,<br><strong>The Tasskr Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
    AI Boosts Exhausted!
    
    Hello ${user.firstName},
    
    You have used all your AI boosts for this month. AI features will be limited until your next cycle.
    Upgrade your plan to get more boosts: ${process.env.FRONTEND_URL.split(',')[0].trim()}/pricing
    
    Best regards,
    The Tasskr Team
  `;

  return await this.sendEmail({
    to: user.email,
    subject: 'AI Boosts Exhausted - Upgrade for More!',
    html,
    text,
  });
}

/**
 * Send Subscription Expiry Reminder
 */
async sendSubscriptionExpiryReminder(user, daysRemaining) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Expiry - Tasskr</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 25px 20px; text-align: center; }
          .content { padding: 40px 30px; }
          .alert-box { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white !important; text-decoration: none; border-radius: 5px; font-weight: 600; }
          .footer { text-align: center; padding: 20px 30px; background: #f8f9fa; color: #6c757d; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Expiry Reminder</h1>
          </div>
          <div class="content">
            <p>Hello ${user.firstName},</p>
            <p>This is a friendly reminder that your <strong>${user.plan}</strong> plan subscription will expire in ${daysRemaining} days.</p>
            
            <div class="alert-box">
              <p>Expiry Date: <strong>${user.currentPeriodEnd.toLocaleDateString()}</strong></p>
            </div>

            <p>To avoid any disruption to your workflow and keep your premium features active, please ensure your payment details are up to date or renew your subscription.</p>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL.split(',')[0].trim()}/billing" class="button">Renew Subscription</a>
            </div>

            <p>Best regards,<br><strong>The Tasskr Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await this.sendEmail({
    to: user.email,
    subject: `Your Tasskr ${user.plan} Plan expires in ${daysRemaining} days! ⏳`,
    html,
    text: `Your ${user.plan} plan expires in ${daysRemaining} days on ${user.currentPeriodEnd.toLocaleDateString()}. Renew now: ${process.env.FRONTEND_URL.split(',')[0].trim()}/billing`,
  });
}

/**
 * Send Top-up Purchase Confirmation Email
 */
async sendTopupPurchaseEmail(user, topupPackage, boostsAdded, amount, invoiceUrl) {
  const { TOPUP_PACKAGES } = await import('../config/aiConfig.js');
  const packageInfo = TOPUP_PACKAGES[topupPackage];
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Boost Top-up Successful - Tasskr</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 25px 20px; text-align: center; }
          .content { padding: 40px 30px; }
          .success-box { background: #D1FAE5; border: 2px solid #10B981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .success-box h2 { color: #065F46; margin: 0 0 10px 0; }
          .boost-count { font-size: 48px; font-weight: bold; color: #10B981; margin: 10px 0; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white !important; text-decoration: none; border-radius: 5px; font-weight: 600; }
          .footer { text-align: center; padding: 20px 30px; background: #f8f9fa; color: #6c757d; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Boost Top-up Successful!</h1>
          </div>
          <div class="content">
            <p>Hello ${user.firstName},</p>
            <p>Your boost top-up purchase has been processed successfully!</p>
            
            <div class="success-box">
              <h2>🚀 ${packageInfo.name}</h2>
              <div class="boost-count">+${boostsAdded}</div>
              <p style="margin: 0; color: #065F46; font-weight: 600;">AI Boosts Added</p>
            </div>

            <div class="info-box">
              <p><strong>Package:</strong> ${packageInfo.name}</p>
              <p><strong>Boosts Added:</strong> ${boostsAdded}</p>
              <p><strong>Amount Paid:</strong> $${amount} USD</p>
              <p><strong>Current Plan:</strong> ${user.plan}</p>
            </div>

            <p>Your boosts have been added to your account and are ready to use immediately. Your plan features remain unchanged.</p>
            
            ${invoiceUrl ? `
            <div class="button-container">
              <a href="${invoiceUrl}" class="button">Download Invoice</a>
            </div>
            ` : ''}

            <p>Best regards,<br><strong>The Tasskr Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tasskr. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await this.sendEmail({
    to: user.email,
    subject: `🚀 ${boostsAdded} AI Boosts Added to Your Account!`,
    html,
    text: `Boost Top-up Successful!\n\nHello ${user.firstName},\n\nYour ${packageInfo.name} purchase is complete!\n\nBoosts Added: ${boostsAdded}\nAmount: $${amount} USD\n\nYour boosts are ready to use.\n\nBest regards,\nThe Tasskr Team`,
  });
}

/**
 * Send Admin Notification for Top-up Purchase
 */
async sendAdminTopupNotification(user, topupPackage, amount) {
  const { TOPUP_PACKAGES } = await import('../config/aiConfig.js');
  const packageInfo = TOPUP_PACKAGES[topupPackage];
  
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDGRID_FROM_EMAIL;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>New Boost Top-up Purchase</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>🚀 New Boost Top-up Purchase</h2>
        <p><strong>User:</strong> ${user.firstName} ${user.lastName} (${user.email})</p>
        <p><strong>Package:</strong> ${packageInfo.name}</p>
        <p><strong>Boosts:</strong> ${packageInfo.boosts}</p>
        <p><strong>Amount:</strong> $${amount} USD</p>
        <p><strong>Current Plan:</strong> ${user.plan}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `;

  return await this.sendEmail({
    to: adminEmail,
    subject: `New Top-up: $${amount} - ${user.email}`,
    html,
    text: `New Boost Top-up\n\nUser: ${user.firstName} ${user.lastName} (${user.email})\nPackage: ${packageInfo.name}\nBoosts: ${packageInfo.boosts}\nAmount: $${amount} USD\nPlan: ${user.plan}\nTime: ${new Date().toLocaleString()}`,
  });
}

}

export default new EmailService();