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
import { formatToLocal } from '../utils/dateUtils.js';
import AnalyticsService from '../services/analyticsService.js';
import FacebookCapiService from '../services/facebookCapiService.js';

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

  // Security Check 1: Don't allow buying the exact same plan + cycle they already have
  const user = await User.findById(userId);
  if (
    user.plan === planKey && 
    user.billingCycle === billingCycle.toUpperCase() && 
    user.subscriptionStatus === 'active'
  ) {
    throw ApiError.badRequest(`You are already on the ${planKey} ${billingCycle} plan`);
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

  // Track InitiateCheckout (Meta CAPI)
  FacebookCapiService.trackInitiateCheckout(user, req, {
    id: planKey,
    price: PLAN_LIMITS[planKey].pricing[billingCycle.toLowerCase()],
    currency: 'USD'
  }).catch(err => Logger.error('Meta CAPI InitiateCheckout failed', { error: err.message }));

  // Track AddPaymentInfo (Meta CAPI)
  FacebookCapiService.trackAddPaymentInfo(user, req, {
    contentIds: [planKey],
    value: PLAN_LIMITS[planKey].pricing[billingCycle.toLowerCase()],
    currency: 'USD'
  }).catch(() => {});

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
 * @desc    Handle Checkout Cancellation (User closed modal or backed out)
 * @route   POST /api/payments/checkout/cancel
 * @access  Private
 */
export const cancelCheckout = expressAsyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_subscription_id, reason } = req.body;
  const userId = req.user._id;

  // Find by order ID or subscription ID
  const query = razorpay_subscription_id 
    ? { razorpaySubscriptionId: razorpay_subscription_id }
    : { razorpayOrderId: razorpay_order_id };

  const payment = await Payment.findOne(query);
  if (!payment) throw ApiError.notFound('Payment record not found');

  if (payment.user.toString() !== userId.toString()) {
    Logger.warn('Unauthorized checkout cancel attempt', { 
      paymentUser: payment.user.toString(), 
      requestUser: userId.toString() 
    });
    throw ApiError.forbidden('Unauthorized access');
  }

  // Only cancel if it was NOT already captured
  if (payment.status === 'captured') {
    throw ApiError.badRequest('Cannot cancel a completed payment. Please use the "Stop Subscription" feature instead.');
  }

  // If it's a subscription and it's in created/authenticated state, cancel it in Razorpay
  if (razorpay_subscription_id) {
    try {
      const sub = await RazorpayService.getSubscription(razorpay_subscription_id);
      if (['created', 'authenticated'].includes(sub.status)) {
        await RazorpayService.cancelSubscription(razorpay_subscription_id);
      }
    } catch (e) {
      Logger.warn('Razorpay sub abandonment cleanup failed', { subId: razorpay_subscription_id });
    }
  }

  payment.status = 'cancelled';
  payment.metadata = { 
    ...payment.metadata,
    abandonedReason: reason || 'User closed checkout',
    cancelledAt: new Date()
  };
  await payment.save();

  Logger.info('Checkout abandoned and record updated', { userId, paymentId: payment._id });

  res.json({ success: true, message: 'Checkout cancelled successfully' });
});

/**
 * @desc    Stop Active Subscription (Churn - No more auto-deduct)
 * @route   POST /api/payments/subscription/stop
 * @access  Private
 */
export const stopSubscription = expressAsyncHandler(async (req, res) => {
  const { razorpay_subscription_id, reason } = req.body;
  const userId = req.user._id;

  if (!razorpay_subscription_id) throw ApiError.badRequest('Subscription ID is required');

  const payment = await Payment.findOne({ razorpaySubscriptionId: razorpay_subscription_id });
  if (!payment) throw ApiError.notFound('Subscription record not found');

  if (payment.user.toString() !== userId.toString()) {
    Logger.warn('Unauthorized subscription stop attempt', { 
      paymentUser: payment.user.toString(), 
      requestUser: userId.toString() 
    });
    throw ApiError.forbidden('Unauthorized access');
  }

  // Cancel in Razorpay at end of cycle
  try {
    const sub = await RazorpayService.getSubscription(razorpay_subscription_id);
    if (sub.status === 'active') {
      await RazorpayService.cancelSubscriptionAtCycleEnd(razorpay_subscription_id);
      Logger.info('Subscription scheduled for cancellation at cycle end', { subId: razorpay_subscription_id });
    } else {
        throw ApiError.badRequest(`Subscription is already in ${sub.status} state`);
    }
  } catch (e) {
    Logger.error('Razorpay subscription stop failed', { subId: razorpay_subscription_id, error: e.message });
    throw ApiError.internal(`Could not stop subscription: ${e.message}`);
  }

  // Note: We don't downgrade the plan IMMEDIATELY. 
  // We mark status as cancelled so user sees they won't be billed again.
  // The cron job or handleExpiry will move them to FREE when currentPeriodEnd hits.
  payment.status = 'cancelled';
  payment.metadata = { 
    ...payment.metadata,
    stopReason: reason || 'User stopped recurring billing',
    stoppedAt: new Date()
  };
  await payment.save();

  const user = await User.findById(userId);
  if (user) {
    user.subscriptionStatus = 'cancelled';
    await user.save();
  }

  res.json({ 
    success: true, 
    message: 'Recurring billing stopped. You will keep access until your current period ends.',
    expiryDate: user ? user.currentPeriodEnd : null
  });
});

/**
 * @desc    Check Payment Status (Client side polling/callback)
 * @route   POST /api/payments/status
 * @access  Private
 */
export const checkPaymentStatus = expressAsyncHandler(async (req, res) => {
  const { razorpay_subscription_id, razorpay_order_id } = req.body;
  const userId = req.user._id;

  // Search by subscription ID or order ID (for top-ups)
  const query = razorpay_subscription_id 
    ? { razorpaySubscriptionId: razorpay_subscription_id }
    : { razorpayOrderId: razorpay_order_id };

  if (!razorpay_subscription_id && !razorpay_order_id) {
    throw ApiError.badRequest('Subscription ID or Order ID is required');
  }

  const payment = await Payment.findOne(query);
  
  if (!payment) {
    Logger.warn('Payment record not found for status check', { 
      razorpay_subscription_id, 
      razorpay_order_id,
      userId 
    });
    throw ApiError.notFound('Payment record not found');
  }

  if (payment.user.toString() !== userId.toString()) {
    Logger.warn('Unauthorized payment access attempt', { 
      paymentUser: payment.user.toString(), 
      requestUser: userId.toString(),
      paymentId: payment._id,
      razorpay_subscription_id,
      razorpay_order_id
    });
    throw ApiError.forbidden('Unauthorized access');
  }

  res.json({
    success: true,
    status: payment.status,
    plan: payment.status === 'captured' ? payment.plan : null,
    purchaseType: payment.purchaseType
  });
});

/**
 * @desc    Sync Payment Status (Recovery Fallback)
 * @route   POST /api/payments/sync
 * @access  Private
 */
export const syncPaymentStatus = expressAsyncHandler(async (req, res) => {
  const { razorpay_subscription_id, razorpay_order_id } = req.body;
  const userId = req.user._id;

  // Search by subscription ID or order ID (for top-ups)
  const query = razorpay_subscription_id 
    ? { razorpaySubscriptionId: razorpay_subscription_id }
    : { razorpayOrderId: razorpay_order_id };

  if (!razorpay_subscription_id && !razorpay_order_id) {
    throw ApiError.badRequest('Subscription ID or Order ID is required');
  }

  const payment = await Payment.findOne(query);
  if (!payment) throw ApiError.notFound('Payment record not found');

  if (payment.user.toString() !== userId.toString()) {
    Logger.warn('Unauthorized payment sync attempt', { 
      paymentUser: payment.user.toString(), 
      requestUser: userId.toString() 
    });
    throw ApiError.forbidden('Unauthorized access');
  }

  if (payment.status === 'captured') {
    return res.json({ success: true, status: 'captured', message: 'Already active' });
  }

  // REACH OUT TO RAZORPAY
  if (razorpay_subscription_id) {
    const sub = await RazorpayService.getSubscription(razorpay_subscription_id);

    if (sub.status === 'active' || sub.status === 'completed') {
      Logger.info('Subscription recovery successful via manual sync', { subId: razorpay_subscription_id });
      
      payment.status = 'captured';
      await payment.save();

      await SubscriptionService.upgradeUserPlan(payment.user, payment.plan, payment.billingCycle, payment.razorpaySubscriptionId);
      
      return res.json({ success: true, status: 'captured', message: 'Recovery successful, plan upgraded' });
    }
    return res.json({ success: true, status: payment.status, message: `Current Status: ${sub.status}` });
  } else if (razorpay_order_id) {
    // For top-ups
    const order = await RazorpayService.getOrder(razorpay_order_id);
    if (order.status === 'paid') {
      // If paid but not captured in our DB, we might need to trigger the top-up logic
      // However, webhook usually handles this. Manual sync for top-up is a fallback.
      // We'll just report the status for now as full top-up sync needs more service logic
      return res.json({ success: true, status: 'paid', message: 'Order is paid' });
    }
    return res.json({ success: true, status: payment.status, message: `Current Status: ${order.status}` });
  }

  res.json({ success: true, status: payment.status });
});

/**
 * @desc    Razorpay Webhook Handler (THE ONLY PLACE FOR PLAN UPGRADES)
 * @route   POST /api/payments/webhook
 * @access  Public
 */
export const handleWebhook = expressAsyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  Logger.info('=============== WEBHOOK START ===============');
  Logger.info(`Headers: ${JSON.stringify(req.headers)}`);
  Logger.info(`Has RawBody: ${!!req.rawBody}`);
  Logger.info(`Has Secret: ${!!secret} (Length: ${secret ? secret.length : 0})`);
  
  if (!req.rawBody) {
    Logger.error('Webhook Error: req.rawBody is missing! Signature verification will fail. Check server.js middleware.');
    return res.status(400).send('Raw body missing');
  }

  Logger.info('WEBHOOK HIT RAW:', { 
    event: req.body.event, 
    subId: req.body.payload?.subscription?.entity?.id,
    payId: req.body.payload?.payment?.entity?.id,
    orderId: req.body.payload?.payment?.entity?.order_id
  });

  // 1. Verify Signature using raw body for maximum security
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(req.rawBody);
  const digest = shasum.digest('hex');

  Logger.info(`Webhook Signature Debug: 
    - Received (Header): ${signature}
    - Calculated (HMAC): ${digest}
    - Match: ${digest === signature}
  `);

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
    Logger.info('Handling subscription.authenticated event');
    const data = payload.subscription.entity;
    Logger.info(`Looking for payment with razorpaySubscriptionId: ${data.id}`);
    const payment = await Payment.findOne({ razorpaySubscriptionId: data.id });
    
    if (payment) {
      payment.status = 'authenticated';
      payment.metadata = { ...payment.metadata, authenticatedAt: new Date() };
      await payment.save();
      Logger.info('Subscription authenticated and updated in DB', { subscriptionId: data.id });
    } else {
      Logger.warn('Payment record NOT FOUND for subscription.authenticated', { subscriptionId: data.id });
    }
  }

  // 2. Subscription Charged / Activated / Completed (Successful payment state)
  else if (['subscription.charged', 'payment.captured', 'subscription.activated', 'subscription.completed', 'subscription.updated'].includes(event)) {
    Logger.info(`Handling Success Event: ${event}`);
    
    // For 'subscription.updated', we check if it was a plan change or just a detail update
    if (event === 'subscription.updated' && !payload.payment) {
        Logger.info(`[WEBHOOK TRACE] Event is ${event} without payment payload. Skipping logic.`);
        return res.status(200).send('OK');
    }

    const data = payload.payment ? payload.payment.entity : payload.subscription.entity;
    Logger.info(`[WEBHOOK TRACE] Extracted Entity Data:`, { 
      entityId: data.id, 
      orderId: data.order_id, 
      subId: data.subscription_id,
      email: data.email,
      contact: data.contact
    });

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
        Logger.warn('[WEBHOOK TRACE] ⚠️ Payment record NOT FOUND in DB. Ignoring orphaned event.', { subscriptionId, orderId: data.order_id });
        return res.status(200).send('Payment not found');
    }

    // Checking for User ID mismatch fix
    const notesUserId = payload.subscription?.entity?.notes?.userId || payload.payment?.entity?.notes?.userId;
    if (notesUserId && payment.user.toString() !== notesUserId) {
        Logger.warn(`[WEBHOOK TRACE] ⚠️ User ID Mismatch! DB: ${payment.user}, Webhook: ${notesUserId}. Updating DB to match Webhook.`);
        payment.user = notesUserId; // Self-heal the record
    }

    Logger.info(`[WEBHOOK TRACE] ✅ Payment Record FOUND: ${payment._id}`, { currentStatus: payment.status, user: payment.user });

    const isAlreadyCaptured = payment.status === 'captured';

    Logger.info(`[WEBHOOK TRACE] Updating Payment Status to 'captured' and saving...`);
    payment.status = 'captured';
    payment.razorpayPaymentId = payload.payment?.entity?.id || data.id; 
    payment.razorpaySignature = signature;
    await payment.save();
    Logger.info(`[WEBHOOK TRACE] ✅ Payment Saved Successfully.`);

    if (!isAlreadyCaptured) {
      // Check if this is a top-up purchase or subscription
      if (payment.purchaseType === 'topup') {
        Logger.info(`[WEBHOOK TRACE] Processing TOP-UP purchase...`);
        
        // Import TopupService dynamically
        const TopupService = (await import('../services/topupService.js')).default;
        
        // Add boosts to user account
        await TopupService.addBoostsToUser(payment.user.toString(), payment.boostsAdded);
        Logger.info(`[WEBHOOK TRACE] ✅ Boosts added to user account`, { 
          userId: payment.user, 
          boostsAdded: payment.boostsAdded 
        });
        
        const user = await User.findById(payment.user);
        if (user) {
          // Generate invoice for top-up
          Logger.info(`[WEBHOOK TRACE] Generating Invoice for Top-up: ${user._id}`);
          const invoice = await RazorpayService.createInvoice(user, payment);
          if (invoice) {
            payment.razorpayInvoiceId = invoice.id;
            payment.invoiceUrl = invoice.short_url;
            await payment.save();
            Logger.info(`[WEBHOOK TRACE] Invoice Generated & Saved: ${invoice.short_url}`);
          }
          
          // Send top-up confirmation emails
          try {
            await EmailService.sendTopupPurchaseEmail(user, payment.topupPackage, payment.boostsAdded, payment.amount, payment.invoiceUrl);
            await EmailService.sendAdminTopupNotification(user, payment.topupPackage, payment.amount);
            Logger.info(`[WEBHOOK TRACE] Emails Sent Successfully.`);
          } catch (emailError) {
            Logger.error('[WEBHOOK TRACE] ❌ Email sending FAILED', { error: emailError.message });
          }

          // Track Purchase (Meta CAPI)
          FacebookCapiService.trackPurchase(user, req, payment).catch(err => {
            Logger.error('Meta CAPI Purchase tracking failed', { error: err.message });
          });
        }

        // Track Top-up Purchase (GA4)
        AnalyticsService.trackPurchase(payment.user, { id: payment.topupPackage, name: `Topup: ${payment.topupPackage}` }, payment.amount).catch(err => {
          Logger.error("Failed to track top-up purchase event", { error: err.message });
        });

        Logger.info('[WEBHOOK TRACE] 🎉 FULL SUCCESS: Top-up processing completed perfectly.', { userId: payment.user, event });
      } else {
        // EXISTING SUBSCRIPTION LOGIC (unchanged)
        Logger.info(`[WEBHOOK TRACE] triggers User Plan Upgrade...`);
        const userIdStr = payment.user.toString();
        Logger.info(`[WEBHOOK TRACE] Passing UserID to Service: '${userIdStr}' (Original Type: ${typeof payment.user})`);
        
        await SubscriptionService.upgradeUserPlan(userIdStr, payment.plan, payment.billingCycle, payment.razorpaySubscriptionId);
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
            await EmailService.sendPlanPurchaseEmail(user, payment.plan, payment.billingCycle, payment.amount, payment.invoiceUrl);
            await EmailService.sendAdminPlanPurchaseNotification(user, payment.plan, payment.billingCycle, payment.amount);
            Logger.info(`[WEBHOOK TRACE] Emails Sent Successfully.`);
          } catch (emailError) {
            Logger.error('[WEBHOOK TRACE] ❌ Email sending FAILED', { error: emailError.message });
          }

          // Track Purchase & Subscribe (Meta CAPI)
          FacebookCapiService.trackPurchase(user, req, payment).catch(err => {
            Logger.error('Meta CAPI Purchase tracking failed', { error: err.message });
          });
          
          FacebookCapiService.trackSubscribe(user, req, {
            id: payment.razorpaySubscriptionId,
            amount: payment.amount,
            currency: payment.currency
          }).catch(err => {
            Logger.error('Meta CAPI Subscribe tracking failed', { error: err.message });
          });
        }

        // Track Subscription Purchase (GA4)
        AnalyticsService.trackPurchase(payment.user, { id: payment.plan, name: `${payment.plan} Plan` }, payment.amount).catch(err => {
          Logger.error("Failed to track subscription purchase event", { error: err.message });
        });

        Logger.info('[WEBHOOK TRACE] 🎉 FULL SUCCESS: Webhook processing completed perfectly.', { userId: payment.user, event });
      }
    } else {
      Logger.info('[WEBHOOK TRACE] ⚠️ Skipping plan upgrade and notifications as they were already processed for this payment.', { subscriptionId, event });
    }
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
    
    Logger.error('RAZORPAY PAYMENT FAILED DETAILED LOG:', {
      paymentId: data.id,
      orderId: data.order_id,
      error_code: data.error_code,
      error_description: data.error_description,
      error_source: data.error_source,
      error_reason: data.error_reason,
      error_metadata: data.error_metadata,
      currency: data.currency,
      amount: data.amount,
      method: data.method
    });

    await Payment.findOneAndUpdate(
      { $or: [{ razorpayOrderId: data.order_id }, { razorpayPaymentId: data.id }] },
      { 
        status: 'failed', 
        metadata: { 
          reason: data.error_description,
          code: data.error_code,
          paymentId: data.id,
          full_error: data.error_reason // Store more for debugging
        } 
      }
    );
    Logger.warn('Payment failed state updated in DB', { paymentId: data.id });
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
    let invoiceUrl = null;
    let invoiceId = null;

    // A. For Subscriptions: Fetch the auto-generated invoice
    if (payment.razorpaySubscriptionId) {
      try {
        const invoices = await RazorpayService.getSubscriptionInvoices(payment.razorpaySubscriptionId);
        
        // Find the invoice corresponding to this payment (or the latest paid one)
        // Ideally match by order_id, but subscription invoices might not always link clearly.
        // We prioritize 'paid' status and proximity to payment date.
        if (invoices && invoices.items && invoices.items.length > 0) {
           const match = invoices.items.find(inv => 
             inv.order_id === payment.razorpayOrderId || inv.status === 'paid'
           );
           
           if (match) {
             invoiceUrl = match.short_url;
             invoiceId = match.id;
             Logger.info('Found existing subscription invoice', { invoiceId, paymentId: payment._id });
           }
        }
      } catch (err) {
        Logger.warn('Failed to fetch subscription invoices', { error: err.message });
      }
    }

    // B. Fallback: If not found, try create (Caution: Creates unpaid invoice)
    if (!invoiceUrl) {
       // Only create if we are desperate, but user complained about "Proceed to Pay".
       // If it's a subscription and we didn't find a paid invoice, it might mean payment failed 
       // or Razorpay hasn't generated it yet. 
       // Creating a new one creates a DUPLICATE demand for payment.
       // Better to NOT create if it's a subscription.
       if (payment.razorpaySubscriptionId) {
          throw ApiError.notFound('Invoice not available yet from payment provider. Please wait for the system to sync.');
       }

       // For One-time orders, we might still need to create one if not exists
       const user = await User.findById(userId);
       const invoice = await RazorpayService.createInvoice(user, payment);
       if (invoice) {
         invoiceId = invoice.id;
         invoiceUrl = invoice.short_url;
       }
    }

    if (invoiceUrl) {
      payment.razorpayInvoiceId = invoiceId;
      payment.invoiceUrl = invoiceUrl;
      await payment.save();
    } else {
      throw ApiError.internal('Invoice could not be retrieved.');
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
  
  // 2. Fetch Payment history (both subscriptions and top-ups)
  const payments = await Payment.find({ user: userId })
    .sort({ createdAt: -1 })
    .select('purchaseType plan billingCycle topupPackage boostsAdded amount currency status createdAt invoiceUrl razorpayPaymentId');

  res.json({
    success: true,
    currentPlan: {
      plan: user.plan,
      billingCycle: user.billingCycle,
      status: user.subscriptionStatus,
      expiryDate: user.currentPeriodEnd,
      expiryDateLocal: user.currentPeriodEnd ? formatToLocal(user.currentPeriodEnd, req.timezone) : null,
      boosts: {
        total: user.totalBoosts,
        used: user.usedBoosts,
        remaining: Math.max(0, user.totalBoosts - user.usedBoosts)
      }
    },
    history: payments.map(p => {
      const obj = p.toObject ? p.toObject() : p;
      return {
        ...obj,
        createdAtLocal: formatToLocal(p.createdAt, req.timezone),
      };
    })
  });
});
