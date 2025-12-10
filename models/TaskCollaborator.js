import mongoose from 'mongoose';

const taskCollaboratorSchema = new mongoose.Schema(
  {
    // Task reference
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
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
taskCollaboratorSchema.index({ task: 1, collaborator: 1 }, { unique: true });
taskCollaboratorSchema.index({ collaborator: 1, status: 1 });

// Instance methods
taskCollaboratorSchema.methods.removeCollaborator = function() {
  this.status = 'removed';
  return this.save();
};

taskCollaboratorSchema.methods.updateLastAccess = function() {
  this.lastAccessedAt = new Date();
  return this.save();
};

// Static methods

/**
 * Check if user can access task
 * Returns { canAccess: boolean, role: string, isOwner: boolean }
 */
taskCollaboratorSchema.statics.canUserAccessTask = async function(taskId, userId) {
  // First check if user is the task owner (direct check on Task model would be ideal, 
  // but we can check here if we trust taskOwner field, or check Task model separately)
  
  // Find active collaboration or ownership
  const collaboration = await this.findOne({
    task: taskId,
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

  // Fallback: Check if actual Task owner (in case owner record missing in collaborators table)
  // This requires importing Task model, avoiding circular dependency via dynamic import or assumption
  const Task = mongoose.model('Task');
  const task = await Task.findOne({ _id: taskId, user: userId });
  
  if (task) {
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
 * Get all collaborators for a task
 */
taskCollaboratorSchema.statics.getTaskCollaborators = function(taskId, status = 'active') {
  return this.find({ task: taskId, status })
    .populate('collaborator', 'firstName lastName email avatar')
    .populate('sharedBy', 'firstName lastName')
    .sort('-createdAt');
};

/**
 * Get all tasks shared with a user
 */
taskCollaboratorSchema.statics.getUserSharedTasks = function(userId, status = 'active') {
  return this.find({ collaborator: userId, status })
    .populate({
      path: 'task',
      select: 'title description dueDate priority status category isCompleted createdAt',
      populate: [
        { path: 'category', select: 'title color' },
        { path: 'priority', select: 'name color' },
        { path: 'status', select: 'name color' },
        { path: 'user', select: 'firstName lastName email avatar' } // Task owner
      ]
    })
    .sort('-createdAt');
};

const TaskCollaborator = mongoose.model('TaskCollaborator', taskCollaboratorSchema);

export default TaskCollaborator;
