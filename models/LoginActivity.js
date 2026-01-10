import mongoose from 'mongoose';

const loginActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Optional for failed logins where user is not found
      index: true,
    },
    sessionId: {
      type: String,
      sparse: true, // Only successful logins have sessionId
    },
    authMethod: {
      type: String,
      enum: ['password', 'google-oauth', 'facebook-oauth', '2fa'],
      required: true,
    },
    twoFactorUsed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgentRaw: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    deviceName: {
      type: String,
      default: null,
      maxlength: 50,
    },
    browser: {
      type: String,
      default: 'Unknown',
    },
    os: {
      type: String,
      default: 'Unknown',
    },
    country: {
      type: String,
      default: 'Unknown',
    },
    city: {
      type: String,
      default: 'Unknown',
    },
    isSuspicious: {
      type: Boolean,
      default: false,
    },
    suspiciousReasons: [{
      type: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
loginActivitySchema.index({ userId: 1, createdAt: -1 });
loginActivitySchema.index({ userId: 1, status: 1, createdAt: -1 });
loginActivitySchema.index({ sessionId: 1 }, { sparse: true });

// TTL index - automatically delete records older than 90 days
loginActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const LoginActivity = mongoose.model('LoginActivity', loginActivitySchema);

export default LoginActivity;
