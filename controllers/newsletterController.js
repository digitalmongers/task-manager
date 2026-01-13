import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import mailchimpService from '../services/mailchimpService.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';
import logger from '../config/logger.js';
import ApiError from '../utils/ApiError.js';

/**
 * @desc    Subscribe to newsletter
 * @route   POST /api/newsletter/subscribe
 * @access  Public
 */
export const subscribe = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { email } = value;

  try {
    // 1. Subscribe to Mailchimp
    const response = await mailchimpService.subscribeUser(email);

    // 2. Update/Create local record
    await NewsletterSubscriber.findOneAndUpdate(
      { email: email },
      {
        status: 'subscribed',
        source: 'website',
        lastSyncedAt: new Date(),
        mailchimpId: response?.id, // Capture Mailchimp ID if returned
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Successfully subscribed to our newsletter!',
    });
  } catch (err) {
    logger.error(`Newsletter subscription process failed for ${email}`, { 
      error: err.message,
      statusCode: err.statusCode || 500
    });

    // If user is already subscribed in Mailchimp, ensure local DB reflects that (self-healing)
    if (err.message === 'User is already subscribed') {
       await NewsletterSubscriber.findOneAndUpdate(
        { email: email },
        { status: 'subscribed', lastSyncedAt: new Date() },
        { upsert: true }
      );
    }

    // Pass the specific error up to the global error handler
    throw err;
  }
});

/**
 * @desc    Handle Mailchimp Webhook
 * @route   POST /api/newsletter/webhook
 * @access  Public (Protected by secret in URL or logic if configured)
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  // Mailchimp sends data as x-www-form-urlencoded usually
  const { type, data } = req.body;

  if (!type || !data || !data.email) {
    // Respond 200 to keep Mailchimp happy even if payload is weird, to avoid retries
    return res.status(200).send('received');
  }

  logger.info(`Received Mailchimp webhook: ${type} for ${data.email}`);

  try {
    if (type === 'unsubscribe') {
        await NewsletterSubscriber.findOneAndUpdate(
            { email: data.email },
            { 
                status: 'unsubscribed', 
                unsubscribeReason: data.reason || 'manual',
                lastSyncedAt: new Date() 
            },
            { upsert: true } // Upsert just in case we missed the sub event
        );
    } else if (type === 'cleaned') {
        await NewsletterSubscriber.findOneAndUpdate(
            { email: data.email },
            { 
                status: 'cleaned',
                lastSyncedAt: new Date() 
            },
            { upsert: true }
        );
    } else if (type === 'subscribe') {
        // Optional: Sync subscribes that happen elsewhere (e.g. Mailchimp landing page)
        await NewsletterSubscriber.findOneAndUpdate(
            { email: data.email },
            { 
                status: 'subscribed',
                source: 'webhook', // Indicates they subbed via Mailchimp form directly
                lastSyncedAt: new Date(),
                mailchimpId: data.id 
            },
            { upsert: true }
        );
    } // Add more types as needed (profile, upemail)

    res.status(200).send('updated');
  } catch (error) {
    logger.error('Webhook processing error:', error);
    // Still return 200 to Mailchimp so they don't retry endlessly
    res.status(200).send('error_logged');
  }
});

/**
 * @desc    Handle Mailchimp Webhook Verification (GET)
 * @route   GET /api/newsletter/webhook
 * @access  Public
 */
export const handleWebhookGet = (req, res) => {
    res.status(200).send('Mailchimp Webhook Handler Active');
};
