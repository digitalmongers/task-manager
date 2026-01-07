import expressAsyncHandler from 'express-async-handler';
import crypto from 'crypto';
import RazorpayService from '../services/razorpayService.js';
import SubscriptionService from '../services/subscriptionService.js';
import EmailService from '../services/emailService.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { PLAN_LIMITS } from '../config/aiConfig.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * @desc    Create Razorpay Subscription
 * @route   POST /api/payments/create-subscription
 * @access  Private
 */
export const createSubscription = expressAsyncHandler(async (req, res) => {
  const { planKey, billingCycle } = req.body;
  const userId = req.user._id;

  if (!planKey || !billingCycle) {
    throw ApiError.badRequest('Plan and billing cycle are required');
  }

  // Security Check 1: Don't allow buying the same plan they already have
  const user = await User.findById(userId);
  if (user.plan === planKey && user.subscriptionStatus === 'active') {
    throw ApiError.badRequest(`You are already on the ${planKey} plan`);
  }

  const subscription = await RazorpayService.createSubscription(userId, planKey, billingCycle);

  // Log subscription attempt
  await Payment.create({
    user: userId,
    plan: planKey,
    billingCycle: billingCycle.toUpperCase(),
    amount: PLAN_LIMITS[planKey].pricing[billingCycle.toLowerCase()],
    currency: 'USD',
    razorpaySubscriptionId: subscription.id,
    status: 'created',
  });

  res.status(201).json({
    success: true,
    subscription,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID
  });
});

/**
 * @desc    Handle Payment Cancellation (User closed checkout)
 * @route   POST /api/payments/cancel
 * @access  Private
 */
/**
 * @desc    Handle Payment Cancellation (User closed checkout or wants to stop sub)
 * @route   POST /api/payments/cancel
 * @access  Private
 */
export const cancelPayment = expressAsyncHandler(async (req, res) => {
  const { razorpay_subscription_id, reason } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({ razorpaySubscriptionId: razorpay_subscription_id });
  if (!payment) throw ApiError.notFound('Subscription record not found');

  if (payment.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized access');
  }

  // Cancel in Razorpay if it's active
  try {
    const sub = await RazorpayService.getSubscription(razorpay_subscription_id);
    if (sub.status === 'active' || sub.status === 'authenticated' || sub.status === 'created') {
      await RazorpayService.cancelSubscription(razorpay_subscription_id);
    }
  } catch (e) {
    Logger.warn('Razorpay sub cancellation failed or already cancelled', { subId: razorpay_subscription_id });
  }

  payment.status = 'cancelled';
  payment.metadata = { 
    ...payment.metadata,
    cancellationReason: reason || 'User cancelled',
    cancelledAt: new Date()
  };
  await payment.save();

  // Mark subscriptionStatus as cancelled
  const user = await User.findById(userId);
  if (user) {
    user.subscriptionStatus = 'cancelled';
    await user.save();
  }

  res.json({ success: true, message: 'Subscription cancelled successfully' });
});

/**
 * @desc    Check Payment Status (Client side polling/callback)
 * @route   POST /api/payments/status
 * @access  Private
 */
export const checkPaymentStatus = expressAsyncHandler(async (req, res) => {
  const { razorpay_subscription_id } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({ razorpaySubscriptionId: razorpay_subscription_id });
  if (!payment) throw ApiError.notFound('Subscription not found');

  if (payment.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized access');
  }

  res.json({
    success: true,
    status: payment.status,
    plan: payment.status === 'captured' ? payment.plan : null,
  });
});

/**
 * @desc    Sync Payment Status (Recovery Fallback)
 * @route   POST /api/payments/sync
 * @access  Private
 */
export const syncPaymentStatus = expressAsyncHandler(async (req, res) => {
  const { razorpay_subscription_id } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({ razorpaySubscriptionId: razorpay_subscription_id });
  if (!payment) throw ApiError.notFound('Subscription not found');

  if (payment.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized access');
  }

  if (payment.status === 'captured') {
    return res.json({ success: true, status: 'captured', message: 'Already active' });
  }

  // REACH OUT TO RAZORPAY
  const sub = await RazorpayService.getSubscription(razorpay_subscription_id);

  if (sub.status === 'active') {
    Logger.info('Subscription recovery successful via manual sync', { subId: razorpay_subscription_id });
    
    payment.status = 'captured';
    await payment.save();

    await SubscriptionService.upgradeUserPlan(payment.user, payment.plan, payment.billingCycle);
    
    return res.json({ success: true, status: 'captured', message: 'Recovery successful, plan upgraded' });
  }

  res.json({ success: true, status: payment.status, message: `Current Status: ${sub.status}` });
});

/**
 * @desc    Razorpay Webhook Handler (THE ONLY PLACE FOR PLAN UPGRADES)
 * @route   POST /api/payments/webhook
 * @access  Public
 */
export const handleWebhook = expressAsyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  if (!req.rawBody) {
    Logger.error('Webhook Error: req.rawBody is missing! Signature verification will fail.');
    return res.status(400).send('Raw body missing');
  }

  Logger.info('WEBHOOK HIT RAW:', { 
    event: req.body.event, 
    subId: req.body.payload?.subscription?.entity?.id,
    payId: req.body.payload?.payment?.entity?.id 
  });

  // 1. Verify Signature using raw body for maximum security
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(req.rawBody);
  const digest = shasum.digest('hex');

  Logger.info(`Webhook Debug: Secret=${secret?.substring(0,4)}... Received=${signature}, Calculated=${digest}`);

  if (digest !== signature) {
    Logger.error('SECURITY ALERT: Invalid Razorpay Webhook Signature', { received: signature, calculated: digest });
    return res.status(400).send('Invalid signature');
  }

  const { event, payload } = req.body;
  
  Logger.info(`Razorpay Webhook Verified & Received: ${event}`, { 
    subscriptionId: payload?.subscription?.entity?.id,
    paymentId: payload?.payment?.entity?.id 
  });

  // 1. Subscription Authenticated (Initial setup successful)
  if (event === 'subscription.authenticated') {
    const data = payload.subscription.entity;
    const payment = await Payment.findOne({ razorpaySubscriptionId: data.id });
    
    if (payment) {
      payment.status = 'authenticated';
      payment.metadata = { ...payment.metadata, authenticatedAt: new Date() };
      await payment.save();
      Logger.info('Subscription authenticated', { subscriptionId: data.id });
    }
  }

  // 2. Subscription Charged / Activated / Completed (Successful payment state)
  else if (['subscription.charged', 'payment.captured', 'subscription.activated', 'subscription.completed', 'subscription.updated'].includes(event)) {
    // For 'subscription.updated', we check if it was a plan change or just a detail update
    if (event === 'subscription.updated' && !payload.payment) {
        Logger.info(`[WEBHOOK TRACE] Event is ${event} without payment payload. Skipping logic.`);
        return res.status(200).send('OK');
    }

    const data = payload.payment ? payload.payment.entity : payload.subscription.entity;
    Logger.info(`[WEBHOOK TRACE] Extracted Entity Data`, { entityId: data.id, orderId: data.order_id, subId: data.subscription_id });

    // Correctly extract subscription_id based on event type
    let subscriptionId;

    // 1. Try from Payment Entity
    if (payload.payment && payload.payment.entity && payload.payment.entity.subscription_id) {
        subscriptionId = payload.payment.entity.subscription_id;
    }
    
    // 2. Fallback: Try from Subscription Entity (Crucial for subscription.activated)
    if (!subscriptionId && payload.subscription && payload.subscription.entity) {
        subscriptionId = payload.subscription.entity.id;
    }

    // 3. Final Fallback
    if (!subscriptionId) {
        subscriptionId = data.subscription_id || data.id;
    }
    
    Logger.info(`[WEBHOOK TRACE] Extracted Real SubID: ${subscriptionId}, OrderID: ${data.order_id}`);

    const payment = await Payment.findOne({
      $or: [
        { razorpaySubscriptionId: subscriptionId },
        { razorpayOrderId: data.order_id }
      ]
    });

    if (!payment) {
        Logger.error('[WEBHOOK TRACE] ❌ FATAL: Payment record NOT FOUND in DB', { subscriptionId, orderId: data.order_id });
        // Self-Healing: If not found, create a placeholder payment? (Optional, skipping for now)
        return res.status(200).send('Payment not found');
    }

    // Checking for User ID mismatch fix
    const notesUserId = payload.subscription?.entity?.notes?.userId || payload.payment?.entity?.notes?.userId;
    if (notesUserId && payment.user.toString() !== notesUserId) {
        Logger.warn(`[WEBHOOK TRACE] ⚠️ User ID Mismatch! DB: ${payment.user}, Webhook: ${notesUserId}. Updating DB to match Webhook.`);
        payment.user = notesUserId; // Self-heal the record
    }

    Logger.info(`[WEBHOOK TRACE] ✅ Payment Record FOUND: ${payment._id}`, { currentStatus: payment.status, user: payment.user });

    if (payment.status === 'captured') {
        Logger.info('[WEBHOOK TRACE] ⚠️ Payment is ALREADY CAPTURED. Logic ensures plan is synced, but this might be a duplicate event.');
    }

    Logger.info(`[WEBHOOK TRACE] Updating Payment Status to 'captured' and saving...`);
    payment.status = 'captured';
    payment.razorpayPaymentId = payload.payment?.entity?.id || data.id; 
    payment.razorpaySignature = signature;
    await payment.save();
    Logger.info(`[WEBHOOK TRACE] ✅ Payment Saved Successfully.`);

    Logger.info(`[WEBHOOK TRACE] triggers User Plan Upgrade...`);
    const userIdStr = payment.user.toString();
    Logger.info(`[WEBHOOK TRACE] Passing UserID to Service: '${userIdStr}' (Original Type: ${typeof payment.user})`);
    
    await SubscriptionService.upgradeUserPlan(userIdStr, payment.plan, payment.billingCycle);
    Logger.info(`[WEBHOOK TRACE] ✅ User Plan Upgrade Function Completed.`);
      
      const user = await User.findById(payment.user);
      if (user) {
        Logger.info(`[WEBHOOK TRACE] Generating Invoice for User: ${user._id}`);
        const invoice = await RazorpayService.createInvoice(user, payment);
        if (invoice) {
          payment.razorpayInvoiceId = invoice.id;
          payment.invoiceUrl = invoice.short_url;
          await payment.save();
          Logger.info(`[WEBHOOK TRACE] Invoice Generated & Saved: ${invoice.short_url}`);
        }

        try {
          Logger.info(`[WEBHOOK TRACE] Sending Success Emails...`);
          await EmailService.sendPlanPurchaseEmail(user, payment.plan, payment.billingCycle, payment.amount, payment.invoiceUrl);
          await EmailService.sendAdminPlanPurchaseNotification(user, payment.plan, payment.billingCycle, payment.amount);
          Logger.info(`[WEBHOOK TRACE] Emails Sent Successfully.`);
        } catch (emailError) {
          Logger.error('[WEBHOOK TRACE] ❌ Email sending FAILED', { error: emailError.message });
        }
      }
      Logger.info('[WEBHOOK TRACE] 🎉 FULL SUCCESS: Webhook processing completed perfectly.', { userId: payment.user, event });
  }

  // 3. Subscription Cancelled
  else if (event === 'subscription.cancelled') {
    const data = payload.subscription.entity;
    const payment = await Payment.findOne({ razorpaySubscriptionId: data.id });
    
    if (payment) {
      payment.status = 'failed';
      payment.metadata = { ...payment.metadata, cancelledAt: new Date(), reason: 'Subscription cancelled' };
      await payment.save();
      
      const user = await User.findById(payment.user);
      if (user) {
        user.subscriptionStatus = 'cancelled';
        await user.save();
      }
      Logger.info('Subscription cancelled via webhook', { subscriptionId: data.id });
    }
  } 
  
  // 4. Payment Failed
  else if (event === 'payment.failed') {
    const data = payload.payment.entity;
    await Payment.findOneAndUpdate(
      { $or: [{ razorpayOrderId: data.order_id }, { razorpayPaymentId: data.id }] },
      { 
        status: 'failed', 
        metadata: { 
          reason: data.error_description,
          code: data.error_code,
          paymentId: data.id
        } 
      }
    );
    Logger.warn('Payment failed via webhook', { paymentId: data.id });
  }

  res.status(200).send('OK');
});

/**
 * @desc    Get Invoice URL for a payment
 * @route   GET /api/payments/invoice/:paymentId
 * @access  Private
 */
export const getInvoice = expressAsyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user._id;

  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment record not found');

  if (payment.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized access');
  }

  if (!payment.invoiceUrl) {
    // If invoice doesn't exist, try to create it now (fallback)
    const user = await User.findById(userId);
    const invoice = await RazorpayService.createInvoice(user, payment);
    if (invoice) {
      payment.razorpayInvoiceId = invoice.id;
      payment.invoiceUrl = invoice.short_url;
      await payment.save();
    } else {
      throw ApiError.internal('Invoice not available yet. Please try again later.');
    }
  }

  res.json({
    success: true,
    invoiceUrl: payment.invoiceUrl,
  });
});

/**
 * @desc    Get Payment History and Current Plan Status
 * @route   GET /api/payments/history
 * @access  Private
 */
export const getPaymentHistory = expressAsyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Fetch User details for current plan status
  const user = await User.findById(userId).select('plan billingCycle subscriptionStatus currentPeriodEnd totalBoosts usedBoosts');
  
  // 2. Fetch Payment history
  const payments = await Payment.find({ user: userId })
    .sort({ createdAt: -1 })
    .select('plan billingCycle amount currency status createdAt invoiceUrl razorpayPaymentId');

  res.json({
    success: true,
    currentPlan: {
      plan: user.plan,
      billingCycle: user.billingCycle,
      status: user.subscriptionStatus,
      expiryDate: user.currentPeriodEnd,
      boosts: {
        total: user.totalBoosts,
        used: user.usedBoosts,
        remaining: Math.max(0, user.totalBoosts - user.usedBoosts)
      }
    },
    history: payments
  });
});
