import mongoose from 'mongoose';

const vitalTaskSchema = new mongoose.Schema(
  {
    
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vital Task must belong to a user'],
      index: true,
    },

    // Task title
    title: {
      type: String,
      required: [true, 'Vital Task title is required'],
      trim: true,
      minlength: [3, 'Vital Task title must be at least 3 characters'],
      maxlength: [200, 'Vital Task title cannot exceed 200 characters'],
    },

    // Task description
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: null,
    },

    // Due date
    dueDate: {
      type: Date,
      default: null,
    },

    
    priority: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskPriority',
      default: null,
      validate: {
        validator: async function(value) {
          if (!value) return true;
          const user = this.user || (typeof this.getQuery === 'function' ? this.getQuery().user : null);
          if (!user) return true; // Skip validation if user context is missing (handled by service)

          const TaskPriority = mongoose.model('TaskPriority');
          const priority = await TaskPriority.findOne({ 
            _id: value, 
            user: user 
          });
          return !!priority;
        },
        message: 'Invalid priority or priority does not belong to you',
      },
    },

    
    status: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskStatus',
      default: null,
      validate: {
        validator: async function(value) {
          if (!value) return true;
          const user = this.user || (typeof this.getQuery === 'function' ? this.getQuery().user : null);
          if (!user) return true; // Skip validation if user context is missing (handled by service)

          const TaskStatus = mongoose.model('TaskStatus');
          const status = await TaskStatus.findOne({ 
            _id: value, 
            user: user 
          });
          return !!status;
        },
        message: 'Invalid status or status does not belong to you',
      },
    },

    
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      validate: {
        validator: async function(value) {
          if (!value) return true;
          const user = this.user || (typeof this.getQuery === 'function' ? this.getQuery().user : null);
          if (!user) return true; // Skip validation if user context is missing (handled by service)

          const Category = mongoose.model('Category');
          const category = await Category.findOne({ 
            _id: value, 
            user: user 
          });
          return !!category;
        },
        message: 'Invalid category or category does not belong to you',
      },
    },

    // Vital Task image
    image: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },

    // Completion status
    isCompleted: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
    // Shareable link token
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },

    shareTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },

    // Track if vital task is shared
    isShared: {
      type: Boolean,
      default: false,
    },

    // Count of active collaborators
    collaboratorCount: {
      type: Number,
      default: 0,
    },
    // Shared with team members (for quick lookup)
    sharedWithTeam: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Review Workflow
    reviewRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    
    reviewRequestedAt: {
      type: Date,
      default: null,
      index: true, // Useful for sorting pending reviews
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========== INDEXES ==========
vitalTaskSchema.index({ user: 1, isDeleted: 1, dueDate: 1 });
vitalTaskSchema.index({ user: 1, category: 1 });
vitalTaskSchema.index({ user: 1, status: 1 });
vitalTaskSchema.index({ user: 1, priority: 1 });
vitalTaskSchema.index({ user: 1, isCompleted: 1 });
vitalTaskSchema.index({ user: 1, createdAt: -1 });
vitalTaskSchema.index({ shareToken: 1, shareTokenExpires: 1 });

// ========== VIRTUALS ==========
vitalTaskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.isCompleted) return false;
  return new Date() > this.dueDate;
});

vitalTaskSchema.virtual('isUnderReview').get(function() {
  return !!(this.reviewRequestedBy && !this.isCompleted);
});

// ========== MIDDLEWARE ==========
vitalTaskSchema.pre('save', function() {
  if (this.isModified('isCompleted')) {
    if (this.isCompleted) {
      this.completedAt = new Date();
    } else {
      this.completedAt = null;
    }
  }
});

vitalTaskSchema.pre(/^find/, function() {
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
});

// ========== INSTANCE METHODS ==========
vitalTaskSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

vitalTaskSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

vitalTaskSchema.methods.markComplete = function() {
  this.isCompleted = true;
  this.completedAt = new Date();
  return this.save();
};

vitalTaskSchema.methods.markIncomplete = function() {
  this.isCompleted = false;
  this.completedAt = null;
  return this.save();
};

vitalTaskSchema.methods.hasValidShareLink = function() {
  return this.shareToken && this.shareTokenExpires && new Date() < this.shareTokenExpires;
};

vitalTaskSchema.methods.addCollaborator = function() {
  if (!this.isShared) {
    this.isShared = true;
    this.collaboratorCount = 1;
  } else {
    this.collaboratorCount += 1;
  }
  return this.save();
};

vitalTaskSchema.methods.removeCollaborator = function() {
  if (this.collaboratorCount > 0) {
    this.collaboratorCount -= 1;
  }
  if (this.collaboratorCount === 0) {
    this.isShared = false;
    this.sharedWithTeam = false;
  }
  return this.save();
};

// ========== STATIC METHODS ==========
vitalTaskSchema.statics.findByUser = function(userId, filters = {}) {
  const query = { user: userId, isDeleted: false };
  
  if (filters.category) query.category = filters.category;
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.isCompleted !== undefined) query.isCompleted = filters.isCompleted;
  
  return this.find(query)
    .populate('category', 'title color')
    .populate('status', 'name color')
    .populate('priority', 'name color')
    .populate('reviewRequestedBy', 'firstName lastName email avatar')
    .sort(filters.sort || '-createdAt');
};

vitalTaskSchema.statics.countByCategory = async function(categoryId) {
  return this.countDocuments({ category: categoryId, isDeleted: false });
};

vitalTaskSchema.statics.countByStatus = async function(statusId) {
  return this.countDocuments({ status: statusId, isDeleted: false });
};

vitalTaskSchema.statics.countByPriority = async function(priorityId) {
  return this.countDocuments({ priority: priorityId, isDeleted: false });
};

vitalTaskSchema.statics.findByShareToken = function(token) {
  return this.findOne({
    shareToken: token,
    shareTokenExpires: { $gt: new Date() },
  }).populate([
    { path: 'category', select: 'title color' },
    { path: 'status', select: 'name color' },
    { path: 'priority', select: 'name color' },
    { path: 'user', select: 'firstName lastName email avatar' },
  ]);
};

// Get vital tasks shared with user (as collaborator)
vitalTaskSchema.statics.getSharedTasks = async function(userId) {
  const VitalTaskCollaborator = mongoose.model('VitalTaskCollaborator');
  
  const collaborations = await VitalTaskCollaborator.find({
    collaborator: userId,
    status: 'active'
  }).populate({
    path: 'vitalTask',
    populate: [
      { path: 'category', select: 'title color' },
      { path: 'status', select: 'name color' },
      { path: 'priority', select: 'name color' },
      { path: 'user', select: 'firstName lastName email avatar' },
      { path: 'reviewRequestedBy', select: 'firstName lastName email avatar' }
    ]
  });
  
  return collaborations.map(c => ({
    ...c.vitalTask.toObject(),
    userRole: c.role,
    sharedBy: c.taskOwner,
    sharedAt: c.createdAt
  }));
};

const VitalTask = mongoose.model('VitalTask', vitalTaskSchema);

export default VitalTask;
