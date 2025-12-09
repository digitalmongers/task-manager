import mongoose from 'mongoose';

const taskPrioritySchema = new mongoose.Schema(
  {
    // Priority owner - har priority ek user ki hogi
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Priority must belong to a user'],
      index: true, // Fast queries ke liye
    },

    // Priority name
    name: {
      type: String,
      required: [true, 'Priority name is required'],
      trim: true,
      minlength: [2, 'Priority name must be at least 2 characters'],
      maxlength: [50, 'Priority name cannot exceed 50 characters'],
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
      default: '#F59E0B', // Default amber/orange color
      match: [/^#([A-Fa-f0-9]{6})$/, 'Please provide a valid hex color'],
    },

    // Soft delete flag
    isDeleted: {
      type: Boolean,
      default: false,
      select: false, // Don't return by default
    },

    // Track when priority was deleted
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
// Compound index: user + name should be unique (one user can't have duplicate priority names)
taskPrioritySchema.index({ user: 1, name: 1 }, { unique: true });

// Index for fetching active priorities
taskPrioritySchema.index({ user: 1, isDeleted: 1 });

// ========== VIRTUAL POPULATE ==========
// Get all tasks with this priority (optional, agar task model banaoge)
taskPrioritySchema.virtual('taskCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'priority',
  count: true,
});

// ========== MIDDLEWARE ==========

// Pre-save: Name ko trim karo
taskPrioritySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  next();
});

// Pre-find: Soft deleted priorities ko automatically exclude karo
taskPrioritySchema.pre(/^find/, function (next) {
  // Agar explicitly deleted priorities chahiye toh this method use karo
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// ========== METHODS ==========

/**
 * Soft delete priority
 */
taskPrioritySchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Restore soft deleted priority
 */
taskPrioritySchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

// ========== STATIC METHODS ==========

/**
 * Find user's priorities
 */
taskPrioritySchema.statics.findByUser = function (userId) {
  return this.find({ user: userId, isDeleted: false }).sort({ createdAt: -1 });
};

/**
 * Check if priority belongs to user
 */
taskPrioritySchema.statics.belongsToUser = async function (priorityId, userId) {
  const priority = await this.findOne({ _id: priorityId, user: userId });
  return !!priority;
};

/**
 * Get priority with task count
 */
taskPrioritySchema.statics.findByIdWithTaskCount = function (priorityId, userId) {
  return this.findOne({ _id: priorityId, user: userId })
    .populate('taskCount');
};

const TaskPriority = mongoose.model('TaskPriority', taskPrioritySchema);

export default TaskPriority;