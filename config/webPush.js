import webPush from 'web-push';
import Logger from './logger.js';

// Validate VAPID environment variables
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  const errorMsg = 'CRITICAL: VAPID keys not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in environment variables.';
  Logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Validate VAPID_SUBJECT format (should be mailto: or https:)
if (!VAPID_SUBJECT.startsWith('mailto:') && !VAPID_SUBJECT.startsWith('https:')) {
  const errorMsg = 'VAPID_SUBJECT must start with "mailto:" or "https:"';
  Logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Set VAPID details for web-push
webPush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Logger.info('Web Push initialized successfully', {
  subject: VAPID_SUBJECT,
  publicKeyLength: VAPID_PUBLIC_KEY.length,
});

export default webPush;
export { VAPID_PUBLIC_KEY };
