import expressAsyncHandler from 'express-async-handler';
import RazorpayService from '../services/razorpayService.js';
import SubscriptionService from '../services/subscriptionService.js';
import EmailService from '../services/emailService.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { PLAN_LIMITS } from '../config/aiConfig.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * @desc    Create Razorpay Order
 * @route   POST /api/payments/create-order
 * @access  Private
 */
export const createOrder = expressAsyncHandler(async (req, res) => {
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

  // Security Check 2: Check for existing pending order to avoid redundancy
  const existingOrder = await Payment.findOne({
    user: userId,
    plan: planKey,
    billingCycle: billingCycle.toUpperCase(),
    status: 'created',
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  });

  if (existingOrder) {
    // If redundant order exists, return it instead of creating new one in Razorpay
    // This allows user to resume the same payment session
    try {
      const razorOrder = await RazorpayService.getOrder(existingOrder.razorpayOrderId);
      if (razorOrder.status === 'created') {
        return res.json({ success: true, order: razorOrder, resumed: true });
      }
    } catch (e) {
      Logger.warn('Existing order session lost, creating new one', { orderId: existingOrder.razorpayOrderId });
    }
  }

  const order = await RazorpayService.createOrder(userId, planKey, billingCycle);

  // Log payment attempt
  await Payment.create({
    user: userId,
    plan: planKey,
    billingCycle: billingCycle.toUpperCase(),
    amount: order.amount / 100, // back to dollars
    currency: order.currency,
    razorpayOrderId: order.id,
    status: 'created',
  });

  res.status(201).json({
    success: true,
    order,
  });
});

/**
 * @desc    Handle Payment Cancellation (User closed checkout)
 * @route   POST /api/payments/cancel
 * @access  Private
 */
export const cancelPayment = expressAsyncHandler(async (req, res) => {
  const { razorpay_order_id, reason } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) throw ApiError.notFound('Order not found');

  if (payment.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized access');
  }

  // Only cancel if it's still in 'created' status
  if (payment.status === 'created') {
    payment.status = 'cancelled';
    payment.metadata = { 
      cancellationReason: reason || 'User closed checkout',
      cancelledAt: new Date()
    };
    await payment.save();
    Logger.info('Payment marked as cancelled by user', { orderId: razorpay_order_id, userId });
  }

  res.json({ success: true, message: 'Payment cancellation recorded' });
});

/**
 * @desc    Check Payment Status (Client side polling/callback)
 * @route   POST /api/payments/status
 * @access  Private
 */
export const checkPaymentStatus = expressAsyncHandler(async (req, res) => {
  const { razorpay_order_id } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) throw ApiError.notFound('Order not found');

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
 * @desc    Sync Payment Status (Recovery Fallback if phone switched off)
 * @route   POST /api/payments/sync
 * @access  Private
 */
export const syncPaymentStatus = expressAsyncHandler(async (req, res) => {
  const { razorpay_order_id } = req.body;
  const userId = req.user._id;

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) throw ApiError.notFound('Order not found');

  if (payment.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized access');
  }

  // If already captured, just return
  if (payment.status === 'captured') {
    return res.json({ success: true, status: 'captured', message: 'Already upgraded' });
  }

  // REACH OUT TO RAZORPAY (The fallback)
  const razorOrder = await RazorpayService.getOrder(razorpay_order_id);
  const razorPayments = await RazorpayService.getOrderPayments(razorpay_order_id);

  // Check if any payment for this order is captured/paid
  const capturedPayment = razorPayments.items?.find(p => p.status === 'captured' || p.status === 'authorized');

  if (capturedPayment || razorOrder.status === 'paid') {
    Logger.info('Payment recovery successful via manual sync', { orderId: razorpay_order_id });
    
    payment.status = 'captured';
    payment.razorpayPaymentId = capturedPayment?.id || 'manual_sync';
    await payment.save();

    await SubscriptionService.upgradeUserPlan(payment.user, payment.plan, payment.billingCycle);
    
    return res.json({ success: true, status: 'captured', message: 'Recovery successful, plan upgraded' });
  }

  res.json({ success: true, status: payment.status, message: 'Payment not yet confirmed' });
});

/**
 * @desc    Razorpay Webhook Handler (THE ONLY PLACE FOR PLAN UPGRADES)
 * @route   POST /api/payments/webhook
 * @access  Public
 */
export const handleWebhook = expressAsyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // 1. Verify Signature using raw body for maximum security
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(req.rawBody);
  const digest = shasum.digest('hex');

  if (digest !== signature) {
    Logger.error('SECURITY ALERT: Invalid Razorpay Webhook Signature');
    return res.status(400).send('Invalid signature');
  }

  const { event, payload } = req.body;
  const data = payload.payment.entity;

  Logger.info(`Razorpay Webhook Received: ${event}`, { 
    paymentId: data.id, 
    orderId: data.order_id 
  });

  if (event === 'payment.captured') {
    const orderId = data.order_id;
    const payment = await Payment.findOne({ razorpayOrderId: orderId });

    // IDEMPOTENCY: Check if already processed
    if (payment && payment.status === 'captured') {
      Logger.warn('Webhook received for already captured payment', { orderId });
      return res.status(200).send('Already processed');
    }

    if (payment) {
      // Security Check: Verify amount and currency
      if (data.amount !== payment.amount * 100 || data.currency !== 'USD') {
        Logger.error('SECURITY ALERT: Webhook data mismatch', { 
          orderId, 
          webhookAmount: data.amount, 
          dbAmount: payment.amount,
          currency: data.currency
        });
        payment.status = 'failed';
        payment.metadata = { error: 'Amount or currency mismatch during webhook' };
        await payment.save();
        return res.status(400).send('Data mismatch');
      }

      payment.status = 'captured';
      payment.razorpayPaymentId = data.id;
      payment.razorpaySignature = signature;
      await payment.save();

      // THE SINGLE SOURCE OF TRUTH FOR UPGRADES
      await SubscriptionService.upgradeUserPlan(payment.user, payment.plan, payment.billingCycle);
      
      // ENTERPRISE FEATURE: Auto-generate Razorpay Invoice
      const user = await User.findById(payment.user);
      if (user) {
        const invoice = await RazorpayService.createInvoice(user, payment);
        if (invoice) {
          payment.razorpayInvoiceId = invoice.id;
          payment.invoiceUrl = invoice.short_url;
          await payment.save();
          Logger.info('Invoice link attached to payment', { orderId });
        }

        // NOITIFCATION: Send Emails
        try {
          // 1. Send confirmation to User
          await EmailService.sendPlanPurchaseEmail(
            user, 
            payment.plan, 
            payment.billingCycle, 
            payment.amount, 
            payment.invoiceUrl
          );

          // 2. Send notification to Admin
          await EmailService.sendAdminPlanPurchaseNotification(
            user,
            payment.plan,
            payment.billingCycle,
            payment.amount
          );
          
          Logger.info('Purchase notification emails sent', { userId: user._id });
        } catch (emailError) {
          Logger.error('Failed to send purchase notification emails', { 
            error: emailError.message, 
            userId: user._id 
          });
        }
      }
      
      Logger.info('Subscription successfully upgraded via Webhook', { userId: payment.user, plan: payment.plan });
    }
  } else if (event === 'payment.failed') {
    const orderId = data.order_id;
    await Payment.findOneAndUpdate(
      { razorpayOrderId: orderId },
      { 
        status: 'failed', 
        metadata: { 
          reason: data.error_description,
          code: data.error_code,
          paymentId: data.id
        } 
      }
    );
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
