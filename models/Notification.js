import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Sender (who triggered the notification)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Notification Type
    type: {
      type: String,
      enum: [
        // Team notifications
        'team_member_joined',
        'team_member_left',
        'team_member_role_updated',
        
        // Task notifications
        'task_assigned',
        'task_updated',
        'task_completed',
        'task_deleted',
        'task_restored',
        'task_due_soon',
        
        // Vital Task notifications
        'vital_task_assigned',
        'vital_task_updated',
        'vital_task_completed',
        'vital_task_deleted',
        'vital_task_due_soon',
        
        // Collaboration notifications
        'task_shared',
        'task_collaborator_added',
        'task_collaborator_removed',
        'task_ownership_transferred',
        
        // Vital Task Collaboration
        'vital_task_shared',
        'vital_task_collaborator_added',
        'vital_task_collaborator_removed',
        'vital_task_ownership_transferred',
        
        // Invitation notifications
        'task_invitation_received',
        'vital_task_invitation_received',
        'task_invitation_received',
        'vital_task_invitation_received',
        'team_invitation_received',
        
        // Review notifications
        'task_review_requested',
        'vital_task_review_requested',
      ],
      required: true,
      index: true,
    },

    // Title
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },

    // Message
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },

    // Related Entity (task, vital task, team, etc.)
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['Task', 'VitalTask', 'Team', 'TeamMember', 'TaskCollaborator', 'VitalTaskCollaborator'],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'relatedEntity.entityType',
      },
    },

    // Team context (for filtering notifications by team)
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamMember',
      index: true,
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // Action URL (where to redirect when clicked)
    actionUrl: {
      type: String,
      maxlength: 500,
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Priority
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    // Expiry (auto-delete old notifications)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, team: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Instance Methods
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static Methods
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    isRead = null,
    type = null,
    teamId = null,
  } = options;

  const query = { recipient: userId };
  
  if (isRead !== null) {
    query.isRead = isRead;
  }
  
  if (type) {
    query.type = type;
  }
  
  if (teamId) {
    query.team = teamId;
  }

  return this.find(query)
    .populate('sender', 'firstName lastName email avatar')
    .populate('team', 'teamName')
    .sort('-createdAt')
    .limit(limit)
    .skip(skip);
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

notificationSchema.statics.deleteOldNotifications = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({ createdAt: { $lt: cutoffDate } });
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
