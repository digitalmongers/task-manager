import mongoose from 'mongoose';

const aiUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['FREE', 'STARTER', 'PRO', 'TEAM'],
      required: true,
    },
    feature: {
      type: String,
      required: true,
    },
    promptTokens: {
      type: Number,
      required: true,
    },
    completionTokens: {
      type: Number,
      required: true,
    },
    totalTokens: {
      type: Number,
      required: true,
    },
    boostsUsed: {
      type: Number,
      required: true,
    },
    requestMetadata: {
      type: Object,
      default: {},
    },
    isEnterpriseBypass: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for reporting and limiting
aiUsageSchema.index({ user: 1, createdAt: -1 });

const AIUsage = mongoose.model('AIUsage', aiUsageSchema);

export default AIUsage;
