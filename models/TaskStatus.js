import mongoose from 'mongoose';

const taskStatusSchema = new mongoose.Schema(
  {
    
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Status must belong to a user'],
      index: true, 
    },

    // Status name
    name: {
      type: String,
      required: [true, 'Status name is required'],
      trim: true,
      minlength: [2, 'Status name must be at least 2 characters'],
      maxlength: [50, 'Status name cannot exceed 50 characters'],
    },

    // Optional description
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: null,
    },

    // Color for UI purposes
    color: {
      type: String,
      default: '#10B981', // Default green color
      match: [/^#([A-Fa-f0-9]{6})$/, 'Please provide a valid hex color'],
    },

    // Soft delete flag
    isDeleted: {
      type: Boolean,
      default: false,
      select: false, // Don't return by default
    },

    // Track when status was deleted
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ========== INDEXES ==========
// Compound index: user + name should be unique (one user can't have duplicate status names)
taskStatusSchema.index({ user: 1, name: 1 }, { unique: true });

// Index for fetching active statuses
taskStatusSchema.index({ user: 1, isDeleted: 1 });

// ========== VIRTUAL POPULATE ==========
// Get all tasks with this status (optional, agar task model banaoge)
taskStatusSchema.virtual('taskCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'status',
  count: true,
});

// ========== MIDDLEWARE ==========

// Pre-save: Name ko trim karo
taskStatusSchema.pre('save', function () {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
});

// Pre-find: Soft deleted statuses ko automatically exclude karo
taskStatusSchema.pre(/^find/, function () {
  // Agar explicitly deleted statuses chahiye toh this method use karo
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
});

// ========== METHODS ==========

/**
 * Soft delete status
 */
taskStatusSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Restore soft deleted status
 */
taskStatusSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

// ========== STATIC METHODS ==========

/**
 * Find user's statuses
 */
taskStatusSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId, isDeleted: false }).sort({ createdAt: -1 });
};

/**
 * Check if status belongs to user
 */
taskStatusSchema.statics.belongsToUser = async function (statusId, userId) {
  const status = await this.findOne({ _id: statusId, user: userId });
  return !!status;
};

/**
 * Get status with task count
 */
taskStatusSchema.statics.findByIdWithTaskCount = function (statusId, userId) {
  return this.findOne({ _id: statusId, user: userId })
    .populate('taskCount');
};

const TaskStatus = mongoose.model('TaskStatus', taskStatusSchema);

export default TaskStatus;