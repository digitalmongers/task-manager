import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    purchaseType: {
      type: String,
      enum: ['subscription', 'topup'],
      required: true,
      default: 'subscription',
    },
    plan: {
      type: String,
      enum: ["STARTER", "PRO", "TEAM"],
      required: function() {
        return this.purchaseType === 'subscription';
      },
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      required: function() {
        return this.purchaseType === 'subscription';
      },
    },
    topupPackage: {
      type: String,
      enum: ["SMALL", "MEDIUM", "LARGE", "XLARGE"],
      required: function() {
        return this.purchaseType === 'topup';
      },
    },
    boostsAdded: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    razorpayOrderId: {
      type: String,
    },
    razorpaySubscriptionId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    razorpayInvoiceId: {
      type: String,
    },
    invoiceUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['created', 'captured', 'failed', 'cancelled', 'refunded', 'authenticated'],
      default: 'created',
    },
    metadata: {
      type: Object,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ razorpaySubscriptionId: 1 }, { unique: true, sparse: true });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
