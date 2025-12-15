import mongoose from 'mongoose';
import crypto from 'crypto';

const vitalTaskInvitationSchema = new mongoose.Schema(
  {
    // Vital Task being shared
    vitalTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VitalTask',
      required: true,
      index: true,
    },

    // Email of invitee (may not be a user yet)
    inviteeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Invitee user (if they have an account)
    inviteeUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Inviter
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Role being offered
    role: {
      type: String,
      enum: ['editor', 'assignee', 'viewer'],
      default: 'editor',
    },

    // Invitation token (for email links)
    invitationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Status
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Personal message
    message: {
      type: String,
      maxlength: 500,
      default: null,
    },

    // Timestamps
    invitedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    declinedAt: {
      type: Date,
      default: null,
    },

    // Track if reminder was sent
    reminderSent: {
      type: Boolean,
      default: false,
    },

    reminderSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vitalTaskInvitationSchema.index({ vitalTask: 1, inviteeEmail: 1, status: 1 });
vitalTaskInvitationSchema.index({ invitationToken: 1, status: 1 });
vitalTaskInvitationSchema.index({ expiresAt: 1, status: 1 });

// Generate invitation token before saving
vitalTaskInvitationSchema.pre('save', async function() {
  if (this.isNew && !this.invitationToken) {
    this.invitationToken = crypto.randomBytes(32).toString('hex');
  }
});

// Virtual for checking if expired
vitalTaskInvitationSchema.virtual('isExpired').get(function() {
  return this.status === 'pending' && new Date() > this.expiresAt;
});

// Instance methods
vitalTaskInvitationSchema.methods.accept = async function(userId) {
  const isPending = this.status === 'pending';
  
  if (this.status !== 'pending' && this.status !== 'accepted') {
    throw new Error('Invitation is not pending');
  }
  
  if (isPending && this.isExpired) {
    this.status = 'expired';
    await this.save();
    throw new Error('Invitation has expired');
  }
  
  this.status = 'accepted';
  // Only set acceptedAt if first time
  if (!this.acceptedAt) {
      this.acceptedAt = new Date();
  }
  
  if (userId) {
      this.inviteeUser = userId;
  }
  
  return this.save();
};

vitalTaskInvitationSchema.methods.decline = function() {
  if (this.status !== 'pending') {
    throw new Error('Invitation is not pending');
  }
  
  this.status = 'declined';
  this.declinedAt = new Date();
  return this.save();
};

vitalTaskInvitationSchema.methods.cancel = function() {
  if (this.status !== 'pending') {
    throw new Error('Invitation is not pending');
  }
  
  this.status = 'cancelled';
  return this.save();
};

vitalTaskInvitationSchema.methods.sendReminder = function() {
  this.reminderSent = true;
  this.reminderSentAt = new Date();
  return this.save();
};

// Static methods
vitalTaskInvitationSchema.statics.findByToken = function(token) {
  return this.findOne({ invitationToken: token })
    .populate('vitalTask')
    .populate('inviter', 'firstName lastName email avatar');
};

vitalTaskInvitationSchema.statics.getPendingInvitations = function(vitalTaskId) {
  return this.find({ vitalTask: vitalTaskId, status: 'pending' })
    .populate('inviteeUser', 'firstName lastName email avatar');
};

vitalTaskInvitationSchema.statics.cleanupExpired = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: now }
    },
    {
      $set: { status: 'expired' }
    }
  );
  return result;
};

const VitalTaskInvitation = mongoose.model('VitalTaskInvitation', vitalTaskInvitationSchema);

export default VitalTaskInvitation;
