import Razorpay from 'razorpay';
import crypto from 'crypto';
import Logger from '../config/logger.js';
import { PLAN_LIMITS, RAZORPAY_PLANS } from '../config/aiConfig.js';
import ApiError from '../utils/ApiError.js';

class RazorpayService {
  constructor() {
    this.instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  /**
   * Create a Razorpay Subscription (Recurring billing)
   */
  async createSubscription(userId, planKey, billingCycle) {
    try {
      const planId = RAZORPAY_PLANS[planKey]?.[billingCycle.toUpperCase()];
      if (!planId) throw ApiError.badRequest('Invalid plan or billing cycle for subscription');

      const subscription = await this.instance.subscriptions.create({
        plan_id: planId,
        customer_notify: 1,
        total_count: billingCycle.toUpperCase() === 'YEARLY' ? 10 : 120, // 10 years
        notes: {
          userId: userId.toString(),
          plan: planKey,
          billingCycle: billingCycle.toUpperCase()
        }
      });

      Logger.info('Razorpay Subscription Created', { subscriptionId: subscription.id, userId });
      return subscription;
    } catch (error) {
      Logger.error('Razorpay Subscription Creation Failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create a Razorpay order (Legacy/One-time fallback)
   */
  async createOrder(userId, planKey, billingCycle) {
    try {
      const plan = PLAN_LIMITS[planKey];
      if (!plan) throw ApiError.badRequest('Invalid plan selected');

      const amount = plan.pricing[billingCycle.toLowerCase()];
      if (amount === undefined) throw ApiError.badRequest('Invalid billing cycle');

      // Razorpay expects amount in smallest currency unit (cents for USD)
      const options = {
        amount: amount * 100, 
        currency: "USD",
        receipt: `rcpt_${userId.toString().slice(-8)}_${Date.now()}`,
        notes: {
          userId: userId.toString(),
          plan: planKey,
          billingCycle: billingCycle,
        }
      };

      const order = await this.instance.orders.create(options);
      Logger.info('Razorpay Order Created', { orderId: order.id, userId });
      return order;
    } catch (error) {
      Logger.error('Razorpay Order Creation Failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Fetch order details from Razorpay (Recovery Fallback)
   */
  async getOrder(orderId) {
    try {
      return await this.instance.orders.fetch(orderId);
    } catch (error) {
      Logger.error('Failed to fetch Razorpay order', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch payments for an order
   */
  async getOrderPayments(orderId) {
    try {
      return await this.instance.orders.fetchPayments(orderId);
    } catch (error) {
      Logger.error('Failed to fetch payments for order', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch subscription details
   */
  async getSubscription(subscriptionId) {
    try {
      return await this.instance.subscriptions.fetch(subscriptionId);
    } catch (error) {
      Logger.error('Failed to fetch Razorpay subscription', { subscriptionId, error: error.message });
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId) {
    try {
      return await this.instance.subscriptions.cancel(subscriptionId);
    } catch (error) {
      Logger.error('Failed to cancel Razorpay subscription', { subscriptionId, error: error.message });
      throw error;
    }
  }

  /**
   * Create Razorpay Invoice for a captured payment
   */
  async createInvoice(user, payment) {
    try {
      const customer = {
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Customer',
        email: user.email,
        contact: user.phoneNumber || undefined,
      };

      const invoiceData = {
        type: "invoice",
        description: `Invoice for ${payment.plan} Plan - ${payment.billingCycle}`,
        customer,
        line_items: [
          {
            name: `${payment.plan} Subscription (${payment.billingCycle})`,
            amount: payment.amount * 100, // in cents
            currency: "USD",
            quantity: 1,
          },
        ],
        sms_notify: customer.contact ? 1 : 0,
        email_notify: 1,
        notes: {
          paymentId: payment._id.toString(),
          userId: user._id.toString(),
        },
      };

      const invoice = await this.instance.invoices.create(invoiceData);
      Logger.info('Razorpay Invoice Created', { invoiceId: invoice.id, paymentId: payment._id });
      return invoice;
    } catch (error) {
      Logger.error('Razorpay Invoice Creation Failed', { error: error.message, paymentId: payment._id });
      // Don't throw here to avoid failing the whole webhook if invoice fails
      return null;
    }
  }

  /**
   * Verify Webhook Signature
   */
  verifyWebhookSignature(payload, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Verify Payment Signature (Frontend callback)
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    const text = orderId + "|" + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return expectedSignature === signature;
  }
}

export default new RazorpayService();
