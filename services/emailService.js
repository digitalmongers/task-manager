import sgMail from '@sendgrid/mail';
import Logger from '../config/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatToLocal } from '../utils/dateUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read logo file for embedding
const logoPath = path.join(__dirname, '../public/logo.png');
let logoAttachment = null;

try {
  if (fs.existsSync(logoPath)) {
    const logoContent = fs.readFileSync(logoPath).toString('base64');
    logoAttachment = {
      content: logoContent,
      filename: 'logo.png',
      type: 'image/png',
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: #F8FAFC;
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #FFFFFF;
                  border: 1px solid #E2E8F0;
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                  margin-top: 40px;
                  margin-bottom: 40px;
              }

              .header {
                  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .welcome-text {
                  font-size: 18px;
                  font-weight: 700;
                  color: #1E293B;
                  margin-bottom: 16px;
              }

              .main-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: #1E293B;
                  margin-bottom: 32px;
              }

              .actions {
                  text-align: center;
                  margin-bottom: 32px;
              }

              .btn {
                  display: inline-block;
                  padding: 16px 40px;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 16px;
                  text-decoration: none;
                  transition: all 0.2s;
                  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
              }

              .link-box {
                  background: #F1F5F9;
                  padding: 20px;
                  border-radius: 12px;
                  margin-bottom: 32px;
              }

              .link-box p {
                  margin: 0 0 8px 0;
                  font-size: 12px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: #64748B;
              }

              .link-box a {
                  font-size: 14px;
                  color: #FF6B6B;
                  text-decoration: none;
                  word-break: break-all;
              }

              .warning-strip {
                  background: #FFFBEB;
                  border-left: 4px solid #F59E0B;
                  padding: 16px;
                  border-radius: 8px;
                  margin-bottom: 32px;
              }

              .warning-strip p {
                  margin: 0;
                  font-size: 14px;
                  color: #92400E;
                  line-height: 1.5;
              }

              .footer {
                  padding: 32px 40px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid #E2E8F0;
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: #64748B;
                  line-height: 1.5;
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Email Verification</h1>
              </div>

              <div class="content">
                  <p class="welcome-text">Hello ${user.firstName} ${user.lastName || ''},</p>
                  <p class="main-text">
                      Welcome to Tasskr! We're excited to have you on board. To start collaborating and managing your tasks effectively, please verify your email address by clicking the button below.
                  </p>

                  <div class="actions">
                      <a href="${verificationUrl}" class="btn">Verify Email Address</a>
                  </div>

                  <div class="warning-strip">
                      <p><strong>Note:</strong> This verification link is valid for <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
                  </div>

                  <div class="link-box">
                      <p>Trouble with the button? Copy this link:</p>
                      <a href="${verificationUrl}">${verificationUrl}</a>
                  </div>

                  <p class="main-text" style="margin-bottom: 0;">
                      Best regards,<br>
                      <strong>The Tasskr Team</strong>
                  </p>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to Tasskr!
      
      Hello ${user.firstName} ${user.lastName || ''},
      
      We're excited to have you on board. Please verify your email address to get started:
      ${verificationUrl}
      
      This link is valid for 24 hours.
      
      If you did not create an account, please ignore this email.
      
      Best regards,
      The Tasskr Team
      Tasskr — AI Task Management Software
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Tasskr</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: #F8FAFC;
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #FFFFFF;
                  border: 1px solid #E2E8F0;
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                  margin-top: 40px;
                  margin-bottom: 40px;
              }

              .header {
                  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .welcome-text {
                  font-size: 20px;
                  font-weight: 800;
                  color: #1E293B;
                  margin-bottom: 16px;
              }

              .main-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: #1E293B;
                  margin-bottom: 32px;
              }

              .feature-item {
                  display: flex;
                  align-items: flex-start;
                  padding: 16px;
                  background: #F8FAFC;
                  border-radius: 12px;
                  margin-bottom: 12px;
                  border: 1px solid #E2E8F0;
              }

              .feature-icon {
                  width: 32px;
                  height: 32px;
                  background: #FFEBEB;
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #FF6B6B;
                  font-size: 18px;
                  flex-shrink: 0;
                  margin-right: 20px;
              }

              .feature-content h3 {
                  margin: 0;
                  font-size: 15px;
                  font-weight: 700;
                  color: #1E293B;
              }

              .feature-content p {
                  margin: 4px 0 0;
                  font-size: 13px;
                  color: #64748B;
                  line-height: 1.4;
              }

              .actions {
                  text-align: center;
                  margin-bottom: 32px;
                  margin-top: 32px;
              }

              .btn {
                  display: inline-block;
                  padding: 16px 40px;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 16px;
                  text-decoration: none;
                  transition: all 0.2s;
                  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
              }

              .footer {
                  padding: 32px 40px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid #E2E8F0;
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: #64748B;
                  line-height: 1.5;
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Successfully Verified</h1>
              </div>

              <div class="content">
                  <p class="welcome-text">Welcome aboard, ${user.firstName}!</p>
                  <p class="main-text">
                      Your email has been successfully verified. You're now ready to experience the full power of Tasskr. Here's what you can do next:
                  </p>

                  <div class="feature-item">
                      <div class="feature-icon">✓</div>
                      <div class="feature-content">
                          <h3>Manage Tasks Effortlessly</h3>
                          <p>Organize, prioritize, and track your work with our intuitive task manager.</p>
                      </div>
                  </div>

                  <div class="feature-item">
                      <div class="feature-icon">✓</div>
                      <div class="feature-content">
                          <h3>Seamless Collaboration</h3>
                          <p>Invite team members, assign tasks, and communicate in real-time.</p>
                      </div>
                  </div>

                  <div class="feature-item">
                      <div class="feature-icon">✓</div>
                      <div class="feature-content">
                          <h3>Insightful Analytics</h3>
                          <p>Monitor your productivity and team progress with detailed visual reports.</p>
                      </div>
                  </div>

                  <div class="actions">
                      <a href="${loginUrl}" class="btn">Login to Your Account</a>
                  </div>

                  <p class="main-text" style="margin-bottom: 0;">
                      Need help getting started? Visit our <a href="${frontendUrl}/help" style="color: #FF6B6B; text-decoration: none;">Help Center</a> or reply to this email.
                  </p>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      Email Verified Successfully!
      
      Welcome aboard, ${user.firstName}!
      
      Your email has been verified. You're now ready to use Tasskr. Here's what you can do:
      - Manage Tasks Effortlessly
      - Seamless Collaboration
      - Insightful Analytics
      
      Login to your account: ${loginUrl}
      
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .welcome-text {
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--text-main);
                  margin-bottom: 16px;
              }

              .main-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: var(--text-main);
                  margin-bottom: 32px;
              }

              .actions {
                  text-align: center;
                  margin-bottom: 32px;
              }

              .btn {
                  display: inline-block;
                  padding: 16px 40px;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 16px;
                  text-decoration: none;
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
              }

              .link-box {
                  background: #F1F5F9;
                  padding: 20px;
                  border-radius: 12px;
                  margin-bottom: 32px;
              }

              .link-box p {
                  margin: 0 0 8px 0;
                  font-size: 12px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: var(--text-muted);
              }

              .link-box a {
                  font-size: 14px;
                  color: var(--primary);
                  text-decoration: none;
                  word-break: break-all;
              }

              .warning-strip {
                  background: #FFFBEB;
                  border-left: 4px solid #F59E0B;
                  padding: 16px;
                  border-radius: 8px;
                  margin-bottom: 32px;
              }

              .warning-strip p {
                  margin: 0;
                  font-size: 14px;
                  color: #92400E;
                  line-height: 1.5;
              }

              .security-tips {
                  background: #F8FAFC;
                  padding: 24px;
                  border-radius: 12px;
                  border: 1px solid var(--border);
                  margin-bottom: 32px;
              }

              .security-tips h3 {
                  margin: 0 0 16px 0;
                  font-size: 15px;
                  font-weight: 700;
                  color: var(--text-main);
              }

              .security-tips ul {
                  margin: 0;
                  padding: 0;
                  list-style: none;
              }

              .security-tips li {
                  font-size: 14px;
                  color: var(--text-muted);
                  margin-bottom: 8px;
                  padding-left: 20px;
                  position: relative;
              }

              .security-tips li::before {
                  content: "•";
                  color: var(--primary);
                  font-weight: bold;
                  position: absolute;
                  left: 0;
              }

              .footer {
                  padding: 32px 40px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: var(--text-muted);
                  line-height: 1.5;
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Reset Your Password</h1>
              </div>

              <div class="content">
                  <p class="welcome-text">Hello ${user.firstName},</p>
                  <p class="main-text">
                      We received a request to reset the password for your Tasskr account. Click the button below to set a new password.
                  </p>

                  <div class="actions">
                      <a href="${resetUrl}" class="btn">Reset Password</a>
                  </div>

                  <div class="warning-strip">
                      <p><strong>Important:</strong> This link is valid for <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
                  </div>

                  <div class="security-tips">
                      <h3>Security Best Practices</h3>
                      <ul>
                          <li>Use a strong, unique password for every account.</li>
                          <li>Never share your password with anyone.</li>
                          <li>Enable Two-Factor Authentication (2FA) for extra security.</li>
                      </ul>
                  </div>

                  <div class="link-box">
                      <p>Trouble with the button? Copy this link:</p>
                      <a href="${resetUrl}">${resetUrl}</a>
                  </div>

                  <p class="main-text" style="margin-bottom: 0;">
                      Best regards,<br>
                      <strong>The Tasskr Team</strong>
                  </p>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      Reset Your Password
      
      Hello ${user.firstName},
      
      We received a request to reset your password. Click the link below:
      ${resetUrl}
      
      This link is valid for 1 hour.
      
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
  const localizedTime = formatToLocal(new Date(), user.timezone);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .welcome-text {
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--text-main);
                  margin-bottom: 16px;
              }

              .main-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: var(--text-main);
                  margin-bottom: 32px;
              }

              .info-box {
                  background: #F8FAFC;
                  padding: 24px;
                  border-radius: 12px;
                  border: 1px solid var(--border);
                  margin-bottom: 32px;
              }

              .info-box h3 {
                  margin: 0 0 16px 0;
                  font-size: 14px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: var(--text-muted);
              }

              .info-row {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 8px;
                  font-size: 14px;
              }

              .info-label {
                  color: var(--text-muted);
                  font-weight: 500;
              }

              .info-value {
                  color: var(--text-main);
                  font-weight: 600;
              }

              .actions {
                  text-align: center;
                  margin-bottom: 32px;
                  display: flex;
                  gap: 16px;
                  justify-content: center;
              }

              .btn {
                  display: inline-block;
                  padding: 14px 24px;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 15px;
                  text-decoration: none;
                  flex: 1;
                  max-width: 200px;
              }

              .btn-primary {
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
              }

              .btn-secondary {
                  background: white;
                  color: var(--text-main) !important;
                  border: 1px solid var(--border);
              }

              .warning-strip {
                  background: #FEF2F2;
                  border-left: 4px solid #EF4444;
                  padding: 16px;
                  border-radius: 8px;
                  margin-bottom: 32px;
              }

              .warning-strip p {
                  margin: 0;
                  font-size: 14px;
                  color: #991B1B;
                  line-height: 1.5;
              }

              .footer {
                  padding: 32px 40px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: var(--text-muted);
                  line-height: 1.5;
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
                  .actions {
                      flex-direction: column;
                      align-items: center;
                  }
                  .btn {
                      max-width: 100%;
                      width: 100%;
                      margin-bottom: 12px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Password Changed</h1>
              </div>

              <div class="content">
                  <p class="welcome-text">Hello ${user.firstName},</p>
                  <p class="main-text">
                      This is a confirmation that the password for your Tasskr account has been successfully changed.
                  </p>

                  <div class="info-box">
                      <h3>Change Details</h3>
                      <div class="info-row">
                          <span class="info-label">Time</span>
                          <span class="info-value">${localizedTime}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">IP Address</span>
                          <span class="info-value">${ip}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Device</span>
                          <span class="info-value">${userAgent}</span>
                      </div>
                  </div>

                  <div class="warning-strip">
                      <p><strong>Urgent:</strong> If you did not make this change, your account may be compromised. Please contact our support team immediately to secure your account.</p>
                  </div>

                  <div class="actions">
                      <a href="${loginUrl}" class="btn btn-primary">Login to Account</a>
                      <a href="${supportUrl}" class="btn btn-secondary">Contact Support</a>
                  </div>

                  <p class="main-text" style="margin-bottom: 0;">
                      Best regards,<br>
                      <strong>The Tasskr Team</strong>
                  </p>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
      Time: ${localizedTime}
      IP Address: ${ip}
      Device: ${userAgent}
      
      IMPORTANT: If you did NOT make this change, your account may be compromised. Contact support immediately.
      
      Login to Account: ${loginUrl}
      Contact Support: ${supportUrl}
      
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
    const localizedTime = formatToLocal(loginTime || new Date(), user.timezone);

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
                <p><strong>📅 Time:</strong> ${localizedTime}</p>
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
      Time: ${localizedTime}
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
    const localizedTime = formatToLocal(new Date(), user.timezone);
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
                <p><strong>Time:</strong> ${localizedTime}</p>
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
      
      Time: ${localizedTime}
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Submission</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 650px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 30px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 48px;
                  height: 48px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 12px;
                  margin-bottom: 12px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 20px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 32px;
              }

              .section-title {
                  font-size: 14px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: var(--primary);
                  margin-bottom: 20px;
                  border-bottom: 1px solid var(--border);
                  padding-bottom: 8px;
              }

              .info-grid {
                  background: #F8FAFC;
                  border-radius: 12px;
                  padding: 20px;
                  margin-bottom: 24px;
                  border: 1px solid var(--border);
              }

              .info-row {
                  display: flex;
                  margin-bottom: 12px;
                  font-size: 14px;
              }

              .info-row:last-child {
                  margin-bottom: 0;
              }

              .info-label {
                  color: var(--text-muted);
                  min-width: 100px;
                  font-weight: 500;
              }

              .info-value {
                  color: var(--text-main);
                  font-weight: 600;
                  word-break: break-all;
              }

              .message-box {
                  background: #FFFFFF;
                  border: 1px solid var(--border);
                  border-radius: 12px;
                  padding: 24px;
                  margin-bottom: 24px;
                  font-size: 15px;
                  line-height: 1.7;
                  color: var(--text-main);
                  white-space: pre-wrap;
              }

              .actions {
                  text-align: center;
                  margin-bottom: 24px;
              }

              .btn {
                  display: inline-block;
                  padding: 14px 30px;
                  border-radius: 10px;
                  font-weight: 600;
                  font-size: 15px;
                  text-decoration: none;
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
              }

              .metadata-strip {
                  background: #F1F5F9;
                  padding: 16px;
                  border-radius: 8px;
                  font-size: 12px;
                  color: var(--text-muted);
                  margin-bottom: 24px;
              }

              .warning-strip {
                  background: #FFFBEB;
                  border-left: 4px solid #F59E0B;
                  padding: 16px;
                  border-radius: 8px;
                  font-size: 13px;
                  color: #92400E;
              }

              .footer {
                  padding: 24px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 11px;
                  color: var(--text-muted);
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 24px 16px;
                  }
                  .info-row {
                      flex-direction: column;
                  }
                  .info-label {
                      margin-bottom: 4px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>New Support Inquiry</h1>
              </div>

              <div class="content">
                  <div class="section-title">User Information</div>
                  <div class="info-grid">
                      <div class="info-row">
                          <span class="info-label">Name</span>
                          <span class="info-value">${name}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Email</span>
                          <span class="info-value">${email}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Subject</span>
                          <span class="info-value">${subject}</span>
                      </div>
                  </div>

                  <div class="section-title">Message Content</div>
                  <div class="message-box">${message}</div>

                  <div class="actions">
                      <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" class="btn">Reply to User</a>
                  </div>

                  <div class="metadata-strip">
                      <div><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZoneName: 'short'
                      })}</div>
                      <div style="margin-top: 4px;"><strong>IP Address:</strong> ${ipAddress} | <strong>Reference ID:</strong> CONTACT-${Date.now()}</div>
                  </div>

                  <div class="warning-strip">
                      <strong>Action Required:</strong> Please respond within 24 hours to maintain our service quality standards.
                  </div>
              </div>

              <div class="footer">
                  <p><strong>Tasskr Support System</strong></p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      NEW CONTACT FORM SUBMISSION
      
      CONTACT INFORMATION
      ------------------
      Name: ${name}
      Email: ${email}
      Subject: ${subject}
      
      MESSAGE
      -------
      ${message}
      
      METADATA
      --------
      Submitted: ${new Date(submittedAt).toLocaleString()}
      IP Address: ${ipAddress}
      Reference ID: CONTACT-${Date.now()}
      
      Reply directly to: ${email}
      
      Best regards,
      The Tasskr Support Team
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Message Received</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .welcome-text {
                  font-size: 20px;
                  font-weight: 700;
                  color: var(--text-main);
                  margin-bottom: 16px;
              }

              .main-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: var(--text-main);
                  margin-bottom: 32px;
              }

              .ticket-card {
                  background: #F8FAFC;
                  border-radius: 12px;
                  padding: 24px;
                  margin-bottom: 32px;
                  border: 1px solid var(--border);
              }

              .ticket-title {
                  font-size: 12px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: var(--text-muted);
                  margin-bottom: 12px;
              }

              .ticket-details {
                  font-size: 15px;
                  color: var(--text-main);
                  line-height: 1.5;
              }

              .ticket-details strong {
                  color: var(--primary);
              }

              .next-steps {
                  background: #F1F5F9;
                  padding: 24px;
                  border-radius: 12px;
                  margin-bottom: 32px;
              }

              .next-steps h3 {
                  margin: 0 0 16px 0;
                  font-size: 15px;
                  font-weight: 700;
                  color: var(--text-main);
              }

              .step-item {
                  display: flex;
                  align-items: flex-start;
                  margin-bottom: 12px;
              }

              .step-icon {
                  color: var(--primary);
                  font-weight: 800;
                  margin-right: 12px;
                  font-size: 16px;
              }

              .step-text {
                  font-size: 14px;
                  color: var(--text-muted);
                  line-height: 1.5;
              }

              .tip-box {
                  background: #E0F2FE;
                  border-left: 4px solid #0EA5E9;
                  padding: 16px;
                  border-radius: 8px;
                  margin-bottom: 32px;
                  font-size: 14px;
                  color: #0369A1;
              }

              .footer {
                  padding: 32px 40px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: var(--text-muted);
                  line-height: 1.5;
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>We've Received Your Message</h1>
              </div>

              <div class="content">
                  <p class="welcome-text">Hi ${name},</p>
                  <p class="main-text">
                      Thank you for reaching out to Tasskr Support. We've successfully received your inquiry and our team is already on it.
                  </p>

                  <div class="ticket-card">
                      <div class="ticket-title">Submission Details</div>
                      <div class="ticket-details">
                          <div><strong>Subject:</strong> ${subject}</div>
                          <div style="margin-top: 4px;"><strong>Reference ID:</strong> #CONTACT-${Date.now()}</div>
                      </div>
                  </div>

                  <div class="next-steps">
                      <h3>What Happens Next?</h3>
                      <div class="step-item">
                          <span class="step-icon">✓</span>
                          <span class="step-text">Our support engineers will review your inquiry.</span>
                      </div>
                      <div class="step-item">
                          <span class="step-icon">✓</span>
                          <span class="step-text">We'll get back to you with a solution or update.</span>
                      </div>
                      <div class="step-item">
                          <span class="step-icon">✓</span>
                          <span class="step-text">Expected response time: Under 24 hours.</span>
                      </div>
                  </div>

                  <div class="tip-box">
                      <strong>💡 Quick Tip:</strong> You can reply directly to this email if you have any additional information or screenshots to share.
                  </div>

                  <p class="main-text" style="margin-bottom: 0;">
                      Best regards,<br>
                      <strong>The Tasskr Support Team</strong>
                  </p>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      Message Received!
      
      Hello ${name},
      
      Thank you for contacting Tasskr Support. We've successfully received your inquiry and our team is already on it.
      
      Submission Details
      ------------------
      Subject: ${subject}
      Reference ID: #CONTACT-${Date.now()}
      
      What Happens Next?
      -----------------
      1. Our support engineers will review your inquiry.
      2. We'll get back to you with a solution or update.
      3. Expected response time: Under 24 hours.
      
      Quick Tip: You can reply directly to this email if you have any additional information or screenshots to share.
      
      Best regards,
      The Tasskr Support Team
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New User Suggestion</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 650px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 30px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 48px;
                  height: 48px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 12px;
                  margin-bottom: 12px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 20px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 32px;
              }

              .section-title {
                  font-size: 14px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: var(--primary);
                  margin-bottom: 20px;
                  border-bottom: 1px solid var(--border);
                  padding-bottom: 8px;
              }

              .info-grid {
                  background: #F8FAFC;
                  border-radius: 12px;
                  padding: 20px;
                  margin-bottom: 24px;
                  border: 1px solid var(--border);
              }

              .info-row {
                  display: flex;
                  margin-bottom: 12px;
                  font-size: 14px;
              }

              .info-row:last-child {
                  margin-bottom: 0;
              }

              .info-label {
                  color: var(--text-muted);
                  min-width: 100px;
                  font-weight: 500;
              }

              .info-value {
                  color: var(--text-main);
                  font-weight: 600;
                  word-break: break-all;
              }

              .suggestion-card {
                  background: #FFFFFF;
                  border: 1px solid var(--border);
                  border-radius: 12px;
                  padding: 24px;
                  margin-bottom: 24px;
              }

              .suggestion-title-box {
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--text-main);
                  margin-bottom: 12px;
                  padding-bottom: 12px;
                  border-bottom: 1px solid #F1F5F9;
              }

              .suggestion-desc {
                  font-size: 15px;
                  color: var(--text-muted);
                  margin-bottom: 16px;
                  line-height: 1.6;
              }

              .suggestion-message {
                  background: #F8FAFC;
                  padding: 16px;
                  border-radius: 8px;
                  font-size: 14px;
                  color: var(--text-main);
                  white-space: pre-wrap;
                  border: 1px dashed var(--border);
              }

              .actions {
                  text-align: center;
                  margin-bottom: 24px;
              }

              .btn {
                  display: inline-block;
                  padding: 14px 30px;
                  border-radius: 10px;
                  font-weight: 600;
                  font-size: 15px;
                  text-decoration: none;
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
              }

              .metadata-strip {
                  background: #F1F5F9;
                  padding: 16px;
                  border-radius: 8px;
                  font-size: 12px;
                  color: var(--text-muted);
                  margin-bottom: 24px;
              }

              .footer {
                  padding: 24px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 11px;
                  color: var(--text-muted);
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 24px 16px;
                  }
                  .info-row {
                      flex-direction: column;
                  }
                  .info-label {
                      margin-bottom: 4px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>New Product Suggestion</h1>
              </div>

              <div class="content">
                  <div class="section-title">Contributor Information</div>
                  <div class="info-grid">
                      <div class="info-row">
                          <span class="info-label">Name</span>
                          <span class="info-value">${userName}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Email</span>
                          <span class="info-value">${userEmail}</span>
                      </div>
                  </div>

                  <div class="section-title">Suggestion Details</div>
                  <div class="suggestion-card">
                      <div class="suggestion-title-box">${title}</div>
                      <div class="suggestion-desc">${description}</div>
                      <div class="suggestion-message">${message}</div>
                  </div>

                  <div class="actions">
                      <a href="mailto:${userEmail}?subject=Re: Suggestion - ${encodeURIComponent(title)}" class="btn">Connect with User</a>
                  </div>

                  <div class="metadata-strip">
                      <div><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZoneName: 'short'
                      })}</div>
                      <div style="margin-top: 4px;"><strong>IP Address:</strong> ${ipAddress || 'N/A'} | <strong>Reference ID:</strong> ${suggestionId}</div>
                  </div>

                  <div style="background: #EBF7FF; border-left: 4px solid #3B82F6; padding: 16px; border-radius: 8px; font-size: 13px; color: #1E3A8A;">
                      <strong>Next Step:</strong> Review this feedback with the product team and update the roadmap if applicable.
                  </div>
              </div>

              <div class="footer">
                  <p><strong>Tasskr Product Feedback System</strong></p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      NEW USER SUGGESTION
      
      CONTRIBUTOR INFORMATION
      -----------------------
      Name: ${userName}
      Email: ${userEmail}
      
      SUGGESTION DETAILS
      ------------------
      Title: ${title}
      Description: ${description}
      Detailed Message: ${message}
      
      METADATA
      --------
      Submitted: ${new Date(submittedAt).toLocaleString()}
      IP Address: ${ipAddress || 'N/A'}
      Reference ID: ${suggestionId}
      
      Reply to user: ${userEmail}
      
      Best regards,
      The Tasskr Product Team
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Suggestion Received</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .welcome-text {
                  font-size: 20px;
                  font-weight: 700;
                  color: var(--text-main);
                  margin-bottom: 16px;
              }

              .main-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: var(--text-main);
                  margin-bottom: 32px;
              }

              .suggestion-summary {
                  background: #F8FAFC;
                  border-radius: 12px;
                  padding: 24px;
                  margin-bottom: 32px;
                  border: 1px solid var(--border);
              }

              .summary-title {
                  font-size: 12px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: var(--text-muted);
                  margin-bottom: 12px;
              }

              .summary-content {
                  font-size: 16px;
                  color: var(--text-main);
                  font-weight: 600;
              }

              .status-box {
                  background: #ECFDF5;
                  border-left: 4px solid #10B981;
                  padding: 20px;
                  border-radius: 8px;
                  margin-bottom: 32px;
              }

              .status-box p {
                  margin: 0;
                  font-size: 14px;
                  color: #065F46;
                  line-height: 1.6;
              }

              .cta-box {
                  text-align: center;
                  padding: 32px;
                  background: #F1F5F9;
                  border-radius: 16px;
                  margin-bottom: 32px;
              }

              .cta-box h3 {
                  margin: 0 0 16px 0;
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--text-main);
              }

              .btn {
                  display: inline-block;
                  padding: 14px 28px;
                  border-radius: 12px;
                  font-weight: 600;
                  font-size: 15px;
                  text-decoration: none;
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
              }

              .footer {
                  padding: 32px 40px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: var(--text-muted);
                  line-height: 1.5;
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Expert Feedback Received</h1>
              </div>

              <div class="content">
                  <p class="welcome-text">Hi ${userName},</p>
                  <p class="main-text">
                      Thank you for contributing to the growth of Tasskr. Your suggestion has been successfully captured and sent to our product engineering team.
                  </p>

                  <div class="suggestion-summary">
                      <div class="summary-title">Your Suggestion Snapshot</div>
                      <div class="summary-content">"${title}"</div>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">
                          ${new Date(submittedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                  </div>

                  <div class="status-box">
                      <p>
                          <strong>What's Next?</strong> Our team reviews all suggestions during our weekly product refinement sessions. If your idea aligns with our upcoming features, we may reach out for further insights.
                      </p>
                  </div>

                  <div class="cta-box">
                      <h3>Keep the ideas coming!</h3>
                      <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">
                          Your feedback is the engine that drives our innovation.
                      </p>
                      <a href="${frontendUrl}" class="btn">Explore New Features</a>
                  </div>

                  <p class="main-text" style="margin-bottom: 0;">
                      Best regards,<br>
                      <strong>The Tasskr Product Team</strong>
                  </p>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      Expert Feedback Received!
      
      Hi ${userName},
      
      Thank you for contributing to the growth of Tasskr. Your suggestion has been successfully captured and sent to our product engineering team.
      
      Your Suggestion Snapshot
      ------------------------
      "${title}"
      ${new Date(submittedAt).toLocaleDateString()}
      
      What's Next?
      ------------
      Our team reviews all suggestions during our weekly product refinement sessions. If your idea aligns with our upcoming features, we may reach out for further insights.
      
      Keep the ideas coming! Your feedback is the engine that drives our innovation.
      
      Best regards,
      The Tasskr Product Team
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Collaboration Invite</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 650px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 30px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 48px;
                  height: 48px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 12px;
                  margin-bottom: 12px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 20px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 32px;
              }

              .inviter-card {
                  display: flex;
                  align-items: center;
                  background: #F8FAFC;
                  border-radius: 12px;
                  padding: 20px;
                  margin-bottom: 24px;
                  border: 1px solid var(--border);
              }

              .inviter-avatar {
                  width: 48px;
                  height: 48px;
                  border-radius: 50%;
                  background: var(--primary-gradient);
                  color: white;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 700;
                  font-size: 18px;
                  margin-right: 16px;
              }

              .inviter-details {
                  flex-grow: 1;
              }

              .inviter-name {
                  font-size: 16px;
                  font-weight: 700;
                  color: var(--text-main);
                  margin: 0;
              }

              .inviter-label {
                  font-size: 13px;
                  color: var(--text-muted);
                  margin: 2px 0 0 0;
              }

              .task-card {
                  background: #FFFFFF;
                  border: 2px solid var(--primary);
                  border-radius: 16px;
                  padding: 24px;
                  margin-bottom: 24px;
                  position: relative;
              }

              .task-tag {
                  position: absolute;
                  top: -12px;
                  right: 24px;
                  background: var(--primary-gradient);
                  color: white;
                  padding: 4px 12px;
                  border-radius: 20px;
                  font-size: 11px;
                  font-weight: 800;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
              }

              .task-title {
                  font-size: 20px;
                  font-weight: 800;
                  color: var(--text-main);
                  margin-bottom: 12px;
              }

              .task-desc {
                  font-size: 14px;
                  color: var(--text-muted);
                  margin-bottom: 20px;
                  line-height: 1.6;
                  background: #F8FAFC;
                  padding: 12px;
                  border-radius: 8px;
              }

              .meta-grid {
                  display: flex;
                  gap: 16px;
                  flex-wrap: wrap;
              }

              .meta-item {
                  display: flex;
                  align-items: center;
                  font-size: 13px;
                  color: var(--text-main);
                  font-weight: 600;
              }

              .meta-icon {
                  margin-right: 6px;
              }

              .role-section {
                  background: #F0F9FF;
                  border-left: 4px solid #0EA5E9;
                  padding: 16px;
                  border-radius: 8px;
                  margin-top: 20px;
              }

              .role-label {
                  font-size: 12px;
                  font-weight: 700;
                  text-transform: uppercase;
                  color: #0369A1;
                  margin-bottom: 4px;
              }

              .role-desc {
                  font-size: 14px;
                  color: #0369A1;
                  margin: 0;
              }

              .personal-message {
                  background: #FFFBEB;
                  border-left: 4px solid #F59E0B;
                  padding: 16px;
                  border-radius: 8px;
                  margin-bottom: 24px;
                  font-style: italic;
                  font-size: 14px;
                  color: #92400E;
              }

              .actions {
                  text-align: center;
                  display: flex;
                  gap: 16px;
                  justify-content: center;
                  margin-bottom: 32px;
              }

              .btn {
                  display: inline-block;
                  padding: 14px 28px;
                  border-radius: 12px;
                  font-weight: 700;
                  font-size: 15px;
                  text-decoration: none;
                  transition: all 0.2s;
              }

              .btn-primary {
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
              }

              .btn-secondary {
                  background: white;
                  color: var(--primary) !important;
                  border: 2px solid var(--primary);
              }

              .expiry-box {
                  background: #F1F5F9;
                  padding: 12px;
                  border-radius: 8px;
                  text-align: center;
                  font-size: 12px;
                  color: var(--text-muted);
              }

              .footer {
                  padding: 32px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 11px;
                  color: var(--text-muted);
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 24px 16px;
                  }
                  .actions {
                      flex-direction: column;
                  }
                  .btn {
                      width: 100%;
                      box-sizing: border-box;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Collaboration Invite</h1>
              </div>

              <div class="content">
                  <div class="inviter-card">
                      <div class="inviter-avatar">${inviter.firstName.charAt(0)}${inviter.lastName?.charAt(0) || ''}</div>
                      <div class="inviter-details">
                          <p class="inviter-name">${inviter.firstName} ${inviter.lastName || ''}</p>
                          <p class="inviter-label">Invited you to collaborate</p>
                      </div>
                  </div>

                  <div class="task-card">
                      <div class="task-tag">${task.priority?.name || 'Task'}</div>
                      <div class="task-title">${task.title}</div>
                      ${task.description ? `
                      <div class="task-desc">
                          ${task.description}
                      </div>
                      ` : ''}
                      <div class="meta-grid">
                          ${task.dueDate ? `
                          <div class="meta-item"><span class="meta-icon">📅</span> Due ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          ` : ''}
                          ${task.category ? `
                          <div class="meta-item"><span class="meta-icon">🏷️</span> ${task.category.title}</div>
                          ` : ''}
                          ${task.priority ? `
                          <div class="meta-item"><span class="meta-icon">⚡</span> ${task.priority.name}</div>
                          ` : ''}
                      </div>

                      <div class="role-section">
                          <div class="role-label">Your Role: ${invitation.role}</div>
                          <p class="role-desc">${roleDescriptions[invitation.role]}</p>
                      </div>
                  </div>

                  ${invitation.message ? `
                  <div class="personal-message">
                      "${invitation.message}"
                  </div>
                  ` : ''}

                  <div class="actions">
                      <a href="${acceptUrl}" class="btn btn-primary">Accept Invitation</a>
                      <a href="${declineUrl}" class="btn btn-secondary">Decline</a>
                  </div>

                  <div class="expiry-box">
                      This invitation will expire on <strong>${new Date(invitation.expiresAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </div>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `
      COLLABORATION INVITATION
      
      Hi! ${inviter.firstName} ${inviter.lastName || ''} has invited you to collaborate on a task in Tasskr.
      
      TASK DETAILS
      ------------
      Task: ${task.title}
      Role: ${invitation.role}
      Permissions: ${roleDescriptions[invitation.role]}
      ${task.description ? `Description: ${task.description}` : ''}
      
      ${invitation.message ? `MESSAGE FROM ${inviter.firstName.toUpperCase()}:\n"${invitation.message}"\n` : ''}
      
      ACCEPT INVITATION: ${acceptUrl}
      DECLINE: ${declineUrl}
      
      This invitation expires on ${new Date(invitation.expiresAt).toLocaleString()}.
      
      Best regards,
      The Tasskr Team
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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --secondary: #2D3436;
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #F8FAFC;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                margin-top: 40px;
                margin-bottom: 40px;
            }

            .header {
                background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }

            .content {
                padding: 40px;
            }

            .user-block {
                display: flex;
                align-items: center;
                padding: 20px;
                background: #F1F5F9;
                border-radius: 12px;
                margin-bottom: 32px;
            }

            .avatar {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                font-weight: 600;
                flex-shrink: 0;
                margin-right: 16px;
            }

            .user-info h3 {
                margin: 0;
                font-size: 16px;
                color: #1E293B;
            }

            .user-info p {
                margin: 4px 0 0;
                font-size: 13px;
                color: #64748B;
            }

            .invite-text {
                font-size: 16px;
                line-height: 1.6;
                color: #1E293B;
                margin-bottom: 24px;
            }

            .role-card {
                border: 1px solid #E2E8F0;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 32px;
                background: #FFFFFF;
            }

            .role-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .role-label {
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #64748B;
            }

            .role-badge {
                background: #FFEBEB;
                color: #FF6B6B;
                padding: 4px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 700;
            }

            .role-desc {
                font-size: 14px;
                color: #64748B;
                margin: 8px 0 0;
            }

            .actions {
                text-align: center;
                display: block;
            }

            .btn {
                display: block;
                padding: 14px 24px;
                border-radius: 10px;
                font-weight: 600;
                font-size: 16px;
                text-decoration: none;
                transition: all 0.2s;
                margin-bottom: 12px;
                text-align: center;
            }

            .btn-primary {
                background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                color: white !important;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
            }

            .btn-secondary {
                background: white;
                color: #1E293B !important;
                border: 1px solid #E2E8F0;
            }

            .footer {
                padding: 32px 40px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid #E2E8F0;
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: #64748B;
                line-height: 1.5;
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
                .header {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Team Invitation</h1>
            </div>

            <div class="content">
                <div class="user-block">
                    <div class="avatar">${owner.firstName.charAt(0)}${owner.lastName?.charAt(0) || ''}</div>
                    <div class="user-info">
                        <h3>${owner.firstName} ${owner.lastName || ''}</h3>
                        <p>${owner.email}</p>
                    </div>
                </div>

                <p class="invite-text">
                    Hello! You've been invited to join <strong>${owner.firstName}'s Team</strong> on Tasskr. Collaborate with your team members in a shared workspace.
                </p>

                <div class="role-card">
                    <div class="role-header">
                        <span class="role-label">Assigned Role</span>
                        <span class="role-badge">${teamMember.role.toUpperCase()}</span>
                    </div>
                    <p class="role-desc">
                        ${roleDescriptions[teamMember.role] || 'Team member with assigned permissions'}
                    </p>
                </div>

                ${teamMember.invitationNote ? `
                  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin-bottom: 32px; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #856404; font-style: italic;">" ${teamMember.invitationNote} "</p>
                  </div>
                ` : ''}

                <div class="actions">
                    <a href="${acceptUrl}" class="btn btn-primary">Accept & Join Team</a>
                    <a href="${declineUrl}" class="btn btn-secondary">Decline Invitation</a>
                </div>
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
                <p style="margin-top: 8px;">Sent to ${teamMember.memberEmail}. If you weren't expecting this invitation, you can safely ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    Team Invitation from Tasskr
    
    Hello! ${owner.firstName} ${owner.lastName || ''} (${owner.email}) has invited you to join their team on Tasskr.
    
    Your Role: ${teamMember.role.toUpperCase()}
    Permissions: ${roleDescriptions[teamMember.role] || 'Team member with assigned permissions'}
    
    ${teamMember.invitationNote ? `Personal message: "${teamMember.invitationNote}"` : ''}
    
    Accept invitation: ${acceptUrl}
    Decline invitation: ${declineUrl}
    
    ---
    <strong>Tasskr</strong> — Tasskr — AI Task Management Software
    © ${new Date().getFullYear()} Tasskr Inc.
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation Reminder</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .reminder-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: var(--text-main);
                  margin-bottom: 24px;
              }

              .task-summary-card {
                  background: #F8FAFC;
                  border-radius: 12px;
                  padding: 20px;
                  margin-bottom: 24px;
                  border: 1px solid var(--border);
              }

              .task-title {
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--text-main);
                  margin-bottom: 4px;
              }

              .inviter-info {
                  font-size: 13px;
                  color: var(--text-muted);
              }

              .expiry-warning {
                  background: #FFF1F2;
                  border-left: 4px solid #F43F5E;
                  padding: 16px;
                  border-radius: 8px;
                  margin-bottom: 32px;
              }

              .warning-message {
                  font-size: 14px;
                  color: #9F1239;
                  font-weight: 600;
                  margin: 0;
              }

              .actions {
                  text-align: center;
              }

              .btn {
                  display: inline-block;
                  padding: 14px 40px;
                  border-radius: 12px;
                  font-weight: 700;
                  font-size: 16px;
                  text-decoration: none;
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
              }

              .footer {
                  padding: 32px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: var(--text-muted);
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Invitation Reminder</h1>
              </div>

              <div class="content">
                  <p class="reminder-text">
                      Hi there, this is a friendly reminder that you have a pending invitation to collaborate on a task in Tasskr.
                  </p>

                  <div class="task-summary-card">
                      <div class="task-title">${task.title}</div>
                      <div class="inviter-info">Invited by ${inviter.firstName} ${inviter.lastName || ''}</div>
                  </div>

                  <div class="expiry-warning">
                      <p class="warning-message">
                          ⏰ This invitation expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!
                      </p>
                  </div>

                  <div class="actions">
                      <a href="${acceptUrl}" class="btn">Connect & Collaborate</a>
                  </div>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation Accepted</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .success-box {
                  background: #ECFDF5;
                  border-left: 4px solid #10B981;
                  padding: 24px;
                  border-radius: 12px;
                  margin-bottom: 32px;
                  text-align: center;
              }

              .success-avatar {
                  width: 64px;
                  height: 64px;
                  border-radius: 50%;
                  background: #10B981;
                  color: white;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 24px;
                  font-weight: 700;
                  margin-bottom: 16px;
                  border: 4px solid white;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }

              .success-message {
                  font-size: 16px;
                  color: #065F46;
                  font-weight: 600;
                  line-height: 1.5;
              }

              .task-info {
                  background: #F8FAFC;
                  padding: 20px;
                  border-radius: 12px;
                  border: 1px solid var(--border);
                  margin-bottom: 32px;
              }

              .task-label {
                  font-size: 12px;
                  font-weight: 700;
                  text-transform: uppercase;
                  color: var(--text-muted);
                  margin-bottom: 8px;
              }

              .task-name {
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--text-main);
              }

              .actions {
                  text-align: center;
              }

              .btn {
                  display: inline-block;
                  padding: 14px 40px;
                  border-radius: 12px;
                  font-weight: 700;
                  font-size: 15px;
                  text-decoration: none;
                  background: var(--primary-gradient);
                  color: white !important;
                  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
              }

              .footer {
                  padding: 32px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: var(--text-muted);
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Invite Accepted!</h1>
              </div>

              <div class="content">
                  <div class="success-box">
                      <div class="success-avatar">${acceptedBy.firstName.charAt(0)}${acceptedBy.lastName?.charAt(0) || ''}</div>
                      <div class="success-message">
                          <strong>${acceptedBy.firstName} ${acceptedBy.lastName || ''}</strong> has accepted your invitation to collaborate.
                      </div>
                  </div>

                  <div class="task-info">
                      <div class="task-label">Collaborating On</div>
                      <div class="task-name">${task.title}</div>
                  </div>

                  <div class="actions">
                      <a href="${taskUrl}" class="btn">View Task Progress</a>
                  </div>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Collaborator Removed</title>
          <style>
              :root {
                  --primary: #FF6B6B;
                  --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                  --background: #F8FAFC;
                  --card-bg: #FFFFFF;
                  --text-main: #1E293B;
                  --text-muted: #64748B;
                  --border: #E2E8F0;
              }

              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: var(--background);
                  margin: 0;
                  padding: 0;
                  -webkit-font-smoothing: antialiased;
              }

              .email-container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: var(--card-bg);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
              }

              .header {
                  background: var(--primary-gradient);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
              }

              .logo {
                  width: 56px;
                  height: 56px;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: 14px;
                  margin-bottom: 16px;
                  object-fit: contain;
                  padding: 4px;
              }

              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.025em;
              }

              .content {
                  padding: 40px;
              }

              .info-card {
                  background: #F8FAFC;
                  border-radius: 12px;
                  padding: 24px;
                  margin-bottom: 24px;
                  border: 1px solid var(--border);
                  text-align: center;
              }

              .info-icon {
                  font-size: 32px;
                  margin-bottom: 16px;
                  display: block;
              }

              .info-text {
                  font-size: 16px;
                  line-height: 1.6;
                  color: var(--text-main);
                  margin: 0;
              }
              
              .task-name {
                  font-weight: 700;
                  color: #1E293B;
                  display: block;
                  margin-top: 8px;
                  font-size: 18px;
              }

              .details-box {
                  background: #FFF1F2;
                  border-left: 4px solid #F43F5E;
                  padding: 16px;
                  border-radius: 8px;
                  margin-top: 24px;
              }

              .details-text {
                  font-size: 14px;
                  color: #9F1239;
                  margin: 0;
                  line-height: 1.5;
              }

              .footer {
                  padding: 32px;
                  background: #F8FAFC;
                  text-align: center;
                  border-top: 1px solid var(--border);
              }

              .footer p {
                  margin: 0;
                  font-size: 12px;
                  color: var(--text-muted);
              }

              @media (max-width: 480px) {
                  .email-container {
                      margin: 0;
                      border-radius: 0;
                      border: none;
                  }
                  .content {
                      padding: 30px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                  <h1>Access Update</h1>
              </div>

              <div class="content">
                  <div class="info-card">
                      <span class="info-icon">📋</span>
                      <p class="info-text">
                          This is to inform you that your access to the following task has been revoked:
                      </p>
                      <span class="task-name">${task.title}</span>
                  </div>

                  <div class="details-box">
                      <p class="details-text">
                          <strong>Action:</strong> Removed from collaborators<br>
                          <strong>By:</strong> ${removedBy.firstName} ${removedBy.lastName}<br>
                          <span style="display:block; margin-top: 8px; font-size: 13px; opacity: 0.8;">You no longer have access to view or edit this task.</span>
                      </p>
                  </div>
              </div>

              <div class="footer">
                  <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                  <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
  const frontendUrl = (process.env.REDIRECT_URL || 'https://tasskr.com').split(',')[0].trim();
  const taskUrl = `${frontendUrl}/user`;
  const LOGO_URL = 'https://tasskr.com/logo512.png';

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Task Shared Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); padding: 30px 20px;">
                            <img src="${LOGO_URL}" alt="Tasskr" width="48" height="48" style="display: block; border-radius: 8px; margin-bottom: 12px;" />
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Task Shared</h1>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <!-- Shared By Badge -->
                                <tr>
                                    <td style="padding-bottom: 24px;">
                                        <div style="display: inline-block; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 20px; padding: 6px 16px; font-size: 13px; font-weight: 700; color: #ef4444;">
                                            Shared by ${owner.firstName} ${owner.lastName || ''}
                                        </div>
                                    </td>
                                </tr>

                                <!-- Intro Text -->
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #1e293b;">
                                            Hi ${teamMember.firstName}, a new task has been shared with you for collaboration. You can now access this task and contribute based on your role.
                                        </p>
                                        
                                        <!-- Task Card -->
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; border: 2px solid #FF6B6B; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
                                            <tr>
                                                <td style="padding: 24px;">
                                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                        <tr>
                                                            <td style="padding-bottom: 12px;">
                                                                <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e293b;">${task.title}</h2>
                                                            </td>
                                                        </tr>
                                                        ${task.description ? `
                                                        <tr>
                                                            <td style="padding: 12px; background-color: #f8fafc; border-radius: 8px; margin-bottom: 16px;">
                                                                <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">${task.description}</p>
                                                            </td>
                                                        </tr>
                                                        ` : ''}
                                                        <tr>
                                                            <td style="padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 16px;">
                                                                <table border="0" cellpadding="0" cellspacing="0">
                                                                    <tr>
                                                                        ${task.dueDate ? `
                                                                        <td style="padding-right: 16px;">
                                                                            <span style="font-size: 13px; font-weight: 600; color: #1e293b;">📅 Due ${new Date(task.dueDate).toLocaleDateString()}</span>
                                                                        </td>
                                                                        ` : ''}
                                                                        <td>
                                                                            <span style="font-size: 13px; font-weight: 600; color: #1e293b;">⚡ ${task.priority?.name || 'Standard Priority'}</span>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Actions -->
                                <tr>
                                    <td align="center" style="padding-bottom: 10px;">
                                        <a href="${taskUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(255, 107, 107, 0.4);">View Task Details</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #475569;"><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                            <p style="margin: 8px 0 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
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
    <html lang="en">
    <head>
        <meta charset="UTF-8"> 
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vital Task Invitation</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--background);
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }

            .header {
                background: var(--primary-gradient);
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }
            
            .header p {
                margin: 8px 0 0;
                font-size: 16px;
                opacity: 0.9;
            }

            .content {
                padding: 40px;
            }

            .user-block {
                display: flex;
                align-items: center;
                margin-bottom: 32px;
                padding: 16px;
                background: #FFF1F2;
                border-radius: 12px;
                border: 1px solid #FECDD3;
            }

            .avatar {
                width: 48px;
                height: 48px;
                background: var(--primary-gradient);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 20px;
                margin-right: 16px;
                box-shadow: 0 4px 6px rgba(255, 107, 107, 0.2);
            }

            .user-info h3 {
                margin: 0;
                color: var(--text-main);
                font-size: 16px;
                font-weight: 700;
            }

            .user-info p {
                margin: 2px 0 0;
                color: #E11D48;
                font-size: 13px;
                font-weight: 500;
            }

            .invite-text {
                font-size: 16px;
                line-height: 1.6;
                color: var(--text-main);
                margin-bottom: 32px;
            }

            .task-card {
                border: 2px solid #E11D48;
                border-radius: 16px;
                padding: 24px;
                margin-bottom: 32px;
                position: relative;
            }
            
            .vital-badge {
                position: absolute;
                top: -12px;
                right: 24px;
                background: #E11D48;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .task-title {
                font-size: 20px;
                font-weight: 800;
                color: var(--text-main);
                margin-bottom: 8px;
            }

            .task-desc {
                font-size: 14px;
                color: var(--text-muted);
                line-height: 1.6;
            }

            .role-section {
                background: #F8FAFC;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 32px;
                border: 1px solid var(--border);
            }

            .role-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .role-label {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-muted);
                font-weight: 700;
            }

            .role-value {
                font-weight: 700;
                color: var(--primary);
                background: #FFF1F2;
                padding: 2px 10px;
                border-radius: 12px;
                font-size: 12px;
            }
            
            .role-desc {
                font-size: 14px;
                color: var(--text-main);
                margin: 0;
                line-height: 1.5;
            }

            .actions {
                display: flex;
                gap: 16px;
                justify-content: center;
            }

            .btn {
                padding: 14px 32px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 15px;
                text-decoration: none;
                transition: transform 0.2s;
                text-align: center;
                flex: 1;
            }
            
            .btn-primary {
                background: var(--primary-gradient);
                color: white !important;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
            }
            
            .btn-secondary {
                background: white;
                color: var(--text-main) !important;
                border: 1px solid var(--border);
            }
            
            .btn:hover {
                transform: translateY(-2px);
            }

            .expiry {
                margin-top: 24px;
                text-align: center;
                font-size: 13px;
                color: #EF4444;
                background: #FEF2F2;
                padding: 8px;
                border-radius: 8px;
            }

            .footer {
                padding: 32px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid var(--border);
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
                .actions {
                    flex-direction: column;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Vital Invitation</h1>
                <p>High Priority Collaboration Request</p>
            </div>

            <div class="content">
                <div class="user-block">
                    <div class="avatar">${inviter.firstName.charAt(0)}${inviter.lastName?.charAt(0) || ''}</div>
                    <div class="user-info">
                        <h3>${inviter.firstName} ${inviter.lastName || ''}</h3>
                        <p>Invited you to collaborate</p>
                    </div>
                </div>

                <p class="invite-text">
                    You have been invited to collaborate on a <strong>Vital Task</strong>. These tasks are critical to the project's success and require immediate attention.
                </p>
                
                <div class="task-card">
                    <div class="vital-badge">VITAL</div>
                    <div class="task-title">${vitalTask.title}</div>
                    ${vitalTask.description ? `
                    <div class="task-desc">
                        ${vitalTask.description}
                    </div>
                    ` : ''}
                </div>

                <div class="role-section">
                    <div class="role-header">
                        <span class="role-label">Assigned Role</span>
                        <span class="role-value">${invitation.role.toUpperCase()}</span>
                    </div>
                    <p class="role-desc">
                        ${roleDescriptions[invitation.role]}
                    </p>
                </div>
                
                ${invitation.message ? `
                  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin-bottom: 32px; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #856404; font-style: italic;">" ${invitation.message} "</p>
                  </div>
                ` : ''}

                <div class="actions">
                    <a href="${acceptUrl}" class="btn btn-primary">Accept Invitation</a>
                    <a href="${declineUrl}" class="btn btn-secondary">Decline</a>
                </div>
                
                <div class="expiry">
                    ⏰ This invitation expires on ${new Date(invitation.expiresAt).toLocaleDateString()} at ${new Date(invitation.expiresAt).toLocaleTimeString()}
                </div>
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vital Task Shared</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--background);
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }

            .header {
                background: var(--primary-gradient);
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }
            
            .header p {
                margin: 8px 0 0;
                font-size: 16px;
                opacity: 0.9;
            }

            .content {
                padding: 40px;
            }

            .intro-text {
                font-size: 16px;
                line-height: 1.6;
                color: var(--text-main);
                margin-bottom: 24px;
            }

            .task-card {
                border: 2px solid #E11D48;
                border-radius: 16px;
                padding: 24px;
                margin-bottom: 32px;
                position: relative;
                background: #FFF1F2;
            }
            
            .vital-badge {
                position: absolute;
                top: -12px;
                right: 24px;
                background: #E11D48;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .task-title {
                font-size: 20px;
                font-weight: 800;
                color: #881337;
                margin-bottom: 8px;
            }

            .task-desc {
                font-size: 14px;
                color: #9F1239;
                line-height: 1.6;
            }

            .actions {
                text-align: center;
            }

            .btn {
                display: inline-block;
                padding: 14px 40px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 15px;
                text-decoration: none;
                background: var(--primary-gradient);
                color: white !important;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
                transition: transform 0.2s;
            }
            
            .btn:hover {
                transform: translateY(-2px);
            }

            .footer {
                padding: 32px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid var(--border);
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Vital Task Shared</h1>
                <p>Critically Important Task</p>
            </div>

            <div class="content">
                <p class="intro-text">
                    Hi ${collaborator.firstName}, <strong>${owner.firstName} ${owner.lastName || ''}</strong> has shared a vital task with you. This task is flagged as critical.
                </p>

                <div class="task-card">
                    <div class="vital-badge">VITAL</div>
                    <div class="task-title">${vitalTask.title}</div>
                    ${vitalTask.description ? `
                    <div class="task-desc">
                        ${vitalTask.description}
                    </div>
                    ` : ''}
                </div>

                <div class="actions">
                    <a href="${vitalTaskUrl}" class="btn">View Vital Task</a>
                </div>
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Removed from Vital Task</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--background);
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }

            .header {
                background: var(--primary-gradient);
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }

            .content {
                padding: 40px;
            }

            .alert-card {
                background: #FFF1F2;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                border: 1px solid #FECDD3;
                text-align: center;
            }

            .alert-icon {
                font-size: 32px;
                margin-bottom: 16px;
                display: block;
            }

            .alert-text {
                font-size: 16px;
                line-height: 1.6;
                color: #881337;
                margin: 0;
            }
            
            .task-name {
                font-weight: 800;
                color: #881337;
                display: block;
                margin-top: 8px;
                font-size: 18px;
                text-transform: uppercase;
            }

            .details-box {
                background: #F8FAFC;
                border-left: 4px solid #E11D48;
                padding: 16px;
                border-radius: 8px;
                margin-top: 24px;
            }

            .details-text {
                font-size: 14px;
                color: var(--text-main);
                margin: 0;
                line-height: 1.5;
            }

            .footer {
                padding: 32px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid var(--border);
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Vital Access Revoked</h1>
            </div>

            <div class="content">
                <div class="alert-card">
                    <span class="alert-icon">🚫</span>
                    <p class="alert-text">
                        Your access to the following <strong>Vital Task</strong> has been revoked:
                    </p>
                    <span class="task-name">${vitalTask.title}</span>
                </div>

                <div class="details-box">
                    <p class="details-text">
                        <strong>Removed By:</strong> ${remover.firstName} ${remover.lastName || ''}<br>
                        <span style="display:block; margin-top: 8px; font-size: 13px; color: var(--text-muted);">You can no longer view or edit this critical task. If you believe this is an error, please contact the task owner immediately.</span>
                    </p>
                </div>
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
  const localizedDate = formatToLocal(new Date(), user.timezone, 'MMMM D, YYYY');
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Confirmed</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
                --success: #10B981;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--background);
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }

            .header {
                background: var(--primary-gradient);
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }

            .content {
                padding: 40px;
            }

            .plan-card {
                background: #F8FAFC;
                border: 1px solid var(--border);
                border-radius: 16px;
                padding: 24px;
                text-align: center;
                margin: 32px 0;
            }

            .plan-name {
                color: #FF6B6B;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                font-weight: 700;
                margin-bottom: 8px;
                display: block;
            }

            .plan-price {
                font-size: 32px;
                font-weight: 800;
                color: var(--text-main);
                letter-spacing: -0.02em;
            }

            .plan-cycle {
                font-size: 14px;
                color: var(--text-muted);
                font-weight: 500;
            }

            .features-list {
                list-style: none;
                padding: 0;
                margin: 24px 0 0;
                text-align: left;
                display: inline-block;
            }

            .features-list li {
                margin-bottom: 10px;
                color: var(--text-main);
                font-size: 14px;
                display: flex;
                align-items: center;
            }

            .features-list li::before {
                content: "✓";
                color: var(--success);
                font-weight: bold;
                margin-right: 10px;
            }

            .btn {
                display: inline-block;
                padding: 14px 40px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 15px;
                text-decoration: none;
                background: var(--primary-gradient);
                color: white !important;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
                transition: transform 0.2s;
            }
            
            .btn-outline {
                background: transparent;
                border: 1px solid var(--border);
                color: var(--text-main) !important;
                box-shadow: none;
            }

            .footer {
                padding: 32px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid var(--border);
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Purchase Confirmed!</h1>
            </div>

            <div class="content">
                <p style="text-align: center; margin-bottom: 32px; color: var(--text-main);">
                    Hi <strong>${user.firstName}</strong>, thank you for upgrading! Your subscription is now active as of ${localizedDate}.
                </p>

                <div class="plan-card">
                    <span class="plan-name">${planKey} Plan</span>
                    <div class="plan-price">$${amount}</div>
                    <span class="plan-cycle">per ${billingCycle.toLowerCase()}</span>

                    <ul class="features-list">
                        <li>Unlimited Projects</li>
                        <li>Advanced AI Features</li>
                        <li>Priority Support</li>
                    </ul>
                </div>

                ${invoiceUrl ? `
                <div style="text-align: center;">
                    <a href="${invoiceUrl}" class="btn btn-outline">Download Invoice</a>
                </div>
                ` : ''}
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    Purchase Confirmed!
    
    Hello ${user.firstName},
    
    Thank you for upgrading to the ${planKey} plan ($${amount}/${billingCycle.toLowerCase()}) on ${localizedDate}.
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
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || process.env.SUPPORT_EMAIL;

  if (!adminEmail) {
    Logger.warn('Admin email not configured. Skipping plan purchase notification.');
    return { success: false, message: 'Admin email ignored' };
  }

  const localizedTime = formatToLocal(new Date(), user.timezone);
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Subscription Order</title>
        <style>
            body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
            .admin-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            .header { color: #FF6B6B; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
            .label { color: #64748b; font-weight: 500; }
            .value { font-weight: 700; color: #1e293b; }
        </style>
    </head>
    <body>
        <div class="admin-card">
            <h2 class="header">🚀 New Subscription Order</h2>
            <div class="row"><span class="label">User:</span> <span class="value">${user.firstName} ${user.lastName}</span></div>
            <div class="row"><span class="label">Email:</span> <span class="value">${user.email}</span></div>
            <div class="row"><span class="label">Plan:</span> <span class="value">${planKey}</span></div>
            <div class="row"><span class="label">Cycle:</span> <span class="value">${billingCycle}</span></div>
            <div class="row"><span class="label">Amount:</span> <span class="value">$${amount}</span></div>
            <div class="row"><span class="label">User Local Time:</span> <span class="value">${localizedTime}</span></div>
        </div>
    </body>
    </html>
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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Boosts Exhausted</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
                --warning-bg: #FFFBEB;
                --warning-border: #FEF3C7;
                --warning-text: #92400E;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--background);
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }

            .header {
                background: #1E293B;
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }

            .content {
                padding: 40px;
            }

            .alert-box {
                background: var(--warning-bg);
                border: 1px solid var(--warning-border);
                border-radius: 12px;
                padding: 24px;
                text-align: center;
                margin-bottom: 32px;
            }

            .boost-icon {
                font-size: 40px;
                margin-bottom: 16px;
                display: block;
            }

            .alert-title {
                color: var(--warning-text);
                font-weight: 800;
                font-size: 18px;
                margin-bottom: 8px;
                display: block;
            }

            .alert-desc {
                color: #B45309;
                font-size: 14px;
                line-height: 1.5;
            }

            .info-text {
                color: var(--text-main);
                line-height: 1.6;
                margin-bottom: 32px;
                text-align: center;
            }

            .btn {
                display: inline-block;
                padding: 14px 40px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 15px;
                text-decoration: none;
                background: var(--primary-gradient);
                color: white !important;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
                transition: transform 0.2s;
            }

            .footer {
                padding: 32px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid var(--border);
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Boosts Exhausted</h1>
            </div>

            <div class="content">
                <div class="alert-box">
                    <span class="boost-icon">⚡</span>
                    <span class="alert-title">0 AI Boosts Remaining</span>
                    <span class="alert-desc">You've used all your AI boosts for this billing cycle.</span>
                </div>

                <p class="info-text">
                    Your AI-powered features will be limited until your next renewal. Upgrade your plan or purchase a top-up to continue working at super speed.
                </p>

                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL.split(',')[0].trim()}/pricing" class="btn">Get More Boosts</a>
                </div>
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
  const localizedExpiry = formatToLocal(user.currentPeriodEnd, user.timezone, 'MMMM D, YYYY');
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Expiry</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
                --urgent-bg: #FEF2F2;
                --urgent-border: #FEE2E2;
                --urgent-text: #B91C1C;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--background);
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }

            .header {
                background: #F59E0B;
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }

            .content {
                padding: 40px;
            }

            .expiry-card {
                background: var(--urgent-bg);
                border: 1px solid var(--urgent-border);
                border-radius: 12px;
                padding: 24px;
                text-align: center;
                margin-bottom: 32px;
            }

            .days-remaining {
                font-size: 36px;
                font-weight: 800;
                color: var(--primary);
                display: block;
                margin-bottom: 4px;
            }

            .expiry-label {
                color: var(--urgent-text);
                font-weight: 600;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .expiry-date {
                margin-top: 12px;
                font-size: 14px;
                color: #7F1D1D;
                background: rgba(255,255,255,0.5);
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
            }

            .info-text {
                color: var(--text-main);
                line-height: 1.6;
                margin-bottom: 32px;
                text-align: center;
            }

            .btn {
                display: inline-block;
                padding: 14px 40px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 15px;
                text-decoration: none;
                background: var(--primary-gradient);
                color: white !important;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
                transition: transform 0.2s;
            }

            .footer {
                padding: 32px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid var(--border);
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Subscription Expiring</h1>
            </div>

            <div class="content">
                <div class="expiry-card">
                    <span class="days-remaining">${daysRemaining} Days</span>
                    <span class="expiry-label">Remaining in your subscription</span>
                    <br>
                    <div class="expiry-date">Expires: ${localizedExpiry}</div>
                </div>

                <p class="info-text">
                    Your <strong>${user.plan} Plan</strong> is about to expire. Renew now to keep your premium features active and avoid any disruption to your workflow.
                </p>

                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL.split(',')[0].trim()}/billing" class="btn">Renew Subscription</a>
                </div>
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await this.sendEmail({
    to: user.email,
    subject: `Your Tasskr ${user.plan} Plan expires in ${daysRemaining} days! ⏳`,
    html,
    text: `Your ${user.plan} plan expires in ${daysRemaining} days on ${localizedExpiry}. Renew now: ${process.env.FRONTEND_URL.split(',')[0].trim()}/billing`,
  });
}

/**
 * Send Top-up Purchase Confirmation Email
 */
async sendTopupPurchaseEmail(user, topupPackage, boostsAdded, amount, invoiceUrl) {
  const { TOPUP_PACKAGES } = await import('../config/aiConfig.js');
  const packageInfo = TOPUP_PACKAGES[topupPackage];
  const localizedDate = formatToLocal(new Date(), user.timezone, 'MMMM D, YYYY');
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Top-up Successful</title>
        <style>
            :root {
                --primary: #FF6B6B;
                --primary-gradient: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                --background: #F8FAFC;
                --card-bg: #FFFFFF;
                --text-main: #1E293B;
                --text-muted: #64748B;
                --border: #E2E8F0;
                --success-bg: #F0FDF4;
                --success-border: #DCFCE7;
                --success-text: #166534;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: var(--background);
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }

            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }

            .header {
                background: #10B981;
                padding: 40px 20px;
                text-align: center;
                color: white;
            }

            .logo {
                width: 56px;
                height: 56px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 14px;
                margin-bottom: 16px;
                object-fit: contain;
                padding: 4px;
            }

            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.025em;
            }

            .content {
                padding: 40px;
            }

            .success-card {
                background: var(--success-bg);
                border: 1px solid var(--success-border);
                border-radius: 16px;
                padding: 32px;
                text-align: center;
                margin-bottom: 32px;
            }

            .boost-amount {
                font-size: 48px;
                font-weight: 800;
                color: #10B981;
                display: block;
                margin-bottom: 4px;
                line-height: 1;
            }

            .success-label {
                color: var(--success-text);
                font-weight: 700;
                font-size: 16px;
            }

            .details-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 32px;
            }
            
            .details-table td {
                padding: 12px 0;
                border-bottom: 1px solid var(--border);
                color: var(--text-main);
            }
            
            .details-table td:last-child {
                text-align: right;
                font-weight: 600;
            }

            .btn {
                display: inline-block;
                padding: 14px 40px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 15px;
                text-decoration: none;
                background: var(--primary-gradient);
                color: white !important;
                box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
                transition: transform 0.2s;
            }

            .footer {
                padding: 32px;
                background: #F8FAFC;
                text-align: center;
                border-top: 1px solid var(--border);
            }

            .footer p {
                margin: 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            @media (max-width: 480px) {
                .email-container {
                    margin: 0;
                    border-radius: 0;
                    border: none;
                }
                .content {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="${LOGO_URL}" alt="Tasskr" class="logo">
                <h1>Top-up Successful!</h1>
            </div>

            <div class="content">
                <div class="success-card">
                    <span class="boost-amount">+${boostsAdded}</span>
                    <span class="success-label">AI Boosts Added</span>
                </div>

                <table class="details-table">
                    <tr>
                        <td>Package</td>
                        <td>${packageInfo.name}</td>
                    </tr>
                    <tr>
                        <td>Amount Paid</td>
                        <td>$${amount} USD</td>
                    </tr>
                    <tr>
                      <td>Current Plan</td>
                      <td>${user.plan}</td>
                    </tr>
                    <tr>
                        <td>Date</td>
                        <td>${localizedDate}</td>
                    </tr>
                </table>

                ${invoiceUrl ? `
                <div style="text-align: center;">
                    <a href="${invoiceUrl}" class="btn">Download Invoice</a>
                </div>
                ` : ''}
            </div>

            <div class="footer">
                <p><strong>Tasskr</strong> — Tasskr — AI Task Management Software</p>
                <p>© ${new Date().getFullYear()} Tasskr Inc. All rights reserved.</p>
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
  
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SUPPORT_EMAIL;

  if (!adminEmail) {
    Logger.warn('Admin email not configured. Skipping top-up notification.');
    return { success: false, message: 'Admin email ignored' };
  }

  const localizedTime = formatToLocal(new Date(), user.timezone);
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>New Boost Top-up</title>
        <style>
            body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
            .admin-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            .header { color: #10B981; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
            .label { color: #64748b; font-weight: 500; }
            .value { font-weight: 700; color: #1e293b; }
        </style>
    </head>
    <body>
        <div class="admin-card">
            <h2 class="header">⚡ New Boost Top-up Order</h2>
            <div class="row"><span class="label">User:</span> <span class="value">${user.firstName} ${user.lastName}</span></div>
            <div class="row"><span class="label">Email:</span> <span class="value">${user.email}</span></div>
            <div class="row"><span class="label">Package:</span> <span class="value">${packageInfo.name}</span></div>
            <div class="row"><span class="label">Boosts:</span> <span class="value">${packageInfo.boosts}</span></div>
            <div class="row"><span class="label">Amount:</span> <span class="value">$${amount} USD</span></div>
            <div class="row"><span class="label">Plan:</span> <span class="value">${user.plan}</span></div>
            <div class="row"><span class="label">User Local Time:</span> <span class="value">${localizedTime}</span></div>
        </div>
    </body>
    </html>
  `;

  return await this.sendEmail({
    to: adminEmail,
    subject: `New Top-up: $${amount} - ${user.email}`,
    html,
    text: `New Boost Top-up\n\nUser: ${user.firstName} ${user.lastName} (${user.email})\nPackage: ${packageInfo.name}\nBoosts: ${packageInfo.boosts}\nAmount: $${amount} USD\nPlan: ${user.plan}\nTime: ${localizedTime}`,
  });
}

}

export default new EmailService();
