import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ["STARTER", "PRO", "TEAM"],
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      required: true,
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
      unique: true,
      sparse: true, // Make optional for subscriptions
    },
    razorpaySubscriptionId: {
      type: String,
      unique: true,
      sparse: true,
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
      enum: ['created', 'captured', 'failed', 'cancelled', 'refunded'],
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
