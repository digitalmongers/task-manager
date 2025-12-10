import mongoose from 'mongoose';
import crypto from 'crypto';

const taskInvitationSchema = new mongoose.Schema(
  {
    // Task being shared
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
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
taskInvitationSchema.index({ task: 1, inviteeEmail: 1, status: 1 });
taskInvitationSchema.index({ invitationToken: 1, status: 1 });
taskInvitationSchema.index({ expiresAt: 1, status: 1 });

// Generate invitation token before saving
// Generate invitation token before saving
taskInvitationSchema.pre('save', async function() {
  if (this.isNew && !this.invitationToken) {
    this.invitationToken = crypto.randomBytes(32).toString('hex');
  }
});

// Virtual for checking if expired
taskInvitationSchema.virtual('isExpired').get(function() {
  return this.status === 'pending' && new Date() > this.expiresAt;
});

// Instance methods
taskInvitationSchema.methods.accept = async function(userId) {
  const isPending = this.status === 'pending';
  // Check if accepted but waiting for user binding (if we decide to support this state)
  // For now, let's keep it simple: if accepted, it's accepted.
  // But if we want late binding, we might need to check inviteeUser.
  
  // NOTE: For task invitations, usually we create a TaskCollaborator record.
  // If we accept anonymously, we update status to 'accepted'.
  // When user signs up, we link them.
  
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

taskInvitationSchema.methods.decline = function() {
  if (this.status !== 'pending') {
    throw new Error('Invitation is not pending');
  }
  
  this.status = 'declined';
  this.declinedAt = new Date();
  return this.save();
};

taskInvitationSchema.methods.cancel = function() {
  if (this.status !== 'pending') {
    throw new Error('Invitation is not pending');
  }
  
  this.status = 'cancelled';
  return this.save();
};

taskInvitationSchema.methods.sendReminder = function() {
  this.reminderSent = true;
  this.reminderSentAt = new Date();
  return this.save();
};

// Static methods
taskInvitationSchema.statics.findByToken = function(token) {
  return this.findOne({ invitationToken: token })
    .populate('task')
    .populate('inviter', 'firstName lastName email avatar');
};

taskInvitationSchema.statics.getPendingInvitations = function(taskId) {
  return this.find({ task: taskId, status: 'pending' })
    .populate('inviteeUser', 'firstName lastName email avatar');
};

taskInvitationSchema.statics.cleanupExpired = async function() {
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

const TaskInvitation = mongoose.model('TaskInvitation', taskInvitationSchema);

export default TaskInvitation;