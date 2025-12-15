import mongoose from 'mongoose';

const vitalTaskCollaboratorSchema = new mongoose.Schema(
  {
    // Vital Task reference
    vitalTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VitalTask',
      required: true,
      index: true,
    },

    // Task Owner (for quick access checks)
    taskOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Collaborator User
    collaborator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Role
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer', 'assignee'],
      default: 'editor',
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'removed'],
      default: 'active',
      index: true,
    },

    // Metadata
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    shareMessage: {
      type: String,
      maxlength: 500,
      default: null,
    },

    lastAccessedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vitalTaskCollaboratorSchema.index({ vitalTask: 1, collaborator: 1 }, { unique: true });
vitalTaskCollaboratorSchema.index({ collaborator: 1, status: 1 });

// Instance methods
vitalTaskCollaboratorSchema.methods.removeCollaborator = function() {
  this.status = 'removed';
  return this.save();
};

vitalTaskCollaboratorSchema.methods.updateLastAccess = function() {
  this.lastAccessedAt = new Date();
  return this.save();
};

// Static methods

/**
 * Check if user can access vital task
 * Returns { canAccess: boolean, role: string, isOwner: boolean }
 */
vitalTaskCollaboratorSchema.statics.canUserAccessVitalTask = async function(vitalTaskId, userId) {
  // Find active collaboration or ownership
  const collaboration = await this.findOne({
    vitalTask: vitalTaskId,
    collaborator: userId,
    status: 'active'
  });

  if (collaboration) {
    return {
      canAccess: true,
      role: collaboration.role,
      isOwner: collaboration.role === 'owner',
    };
  }

  // Fallback: Check if actual VitalTask owner
  const VitalTask = mongoose.model('VitalTask');
  const vitalTask = await VitalTask.findOne({ _id: vitalTaskId, user: userId });
  
  if (vitalTask) {
    return {
      canAccess: true,
      role: 'owner',
      isOwner: true,
    };
  }

  return {
    canAccess: false,
    role: null,
    isOwner: false,
  };
};

/**
 * Get all collaborators for a vital task
 */
vitalTaskCollaboratorSchema.statics.getVitalTaskCollaborators = function(vitalTaskId, status = 'active') {
  return this.find({ vitalTask: vitalTaskId, status })
    .populate('collaborator', 'firstName lastName email avatar')
    .populate('sharedBy', 'firstName lastName')
    .sort('-createdAt');
};

/**
 * Get all vital tasks shared with a user
 */
vitalTaskCollaboratorSchema.statics.getUserSharedVitalTasks = function(userId, status = 'active') {
  return this.find({ collaborator: userId, status })
    .populate({
      path: 'vitalTask',
      select: 'title description dueDate priority status category isCompleted createdAt',
      populate: [
        { path: 'category', select: 'title color' },
        { path: 'priority', select: 'name color' },
        { path: 'status', select: 'name color' },
        { path: 'user', select: 'firstName lastName email avatar' } // VitalTask owner
      ]
    })
    .sort('-createdAt');
};

const VitalTaskCollaborator = mongoose.model('VitalTaskCollaborator', vitalTaskCollaboratorSchema);

export default VitalTaskCollaborator;
