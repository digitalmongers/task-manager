import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    // User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },

    // Push subscription endpoint (unique per device/browser)
    endpoint: {
      type: String,
      required: [true, 'Endpoint is required'],
      unique: true,
    },

    // Encryption keys
    keys: {
      p256dh: {
        type: String,
        required: [true, 'p256dh key is required'],
      },
      auth: {
        type: String,
        required: [true, 'Auth key is required'],
      },
    },

    // Optional: Track device/browser info
    userAgent: {
      type: String,
      default: null,
    },

    // Track when subscription was created
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Track last successful push
    lastUsed: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
pushSubscriptionSchema.index({ user: 1, createdAt: -1 });
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

// Static method to get all subscriptions for a user
pushSubscriptionSchema.statics.getUserSubscriptions = function(userId) {
  return this.find({ user: userId }).sort({ createdAt: -1 });
};

// Static method to remove subscription by endpoint
pushSubscriptionSchema.statics.removeByEndpoint = function(endpoint) {
  return this.deleteOne({ endpoint });
};

// Instance method to update last used timestamp
pushSubscriptionSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

export default PushSubscription;
