import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    // Category owner - har category ek user ki hogi
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Category must belong to a user'],
      index: true, // Fast queries ke liye
    },

    // Category title
    title: {
      type: String,
      required: [true, 'Category title is required'],
      trim: true,
      minlength: [2, 'Category title must be at least 2 characters'],
      maxlength: [50, 'Category title cannot exceed 50 characters'],
    },

    // Optional description
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: null,
    },

    // Color for UI purposes (optional)
    color: {
      type: String,
      default: '#3B82F6', // Default blue color
      match: [/^#([A-Fa-f0-9]{6})$/, 'Please provide a valid hex color'],
    },

    // Soft delete flag
    isDeleted: {
      type: Boolean,
      default: false,
      select: false, // Don't return by default
    },

    // Track when category was deleted
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
// Compound index: user + title should be unique (one user can't have duplicate category names)
categorySchema.index({ user: 1, title: 1 }, { unique: true });

// Index for fetching active categories
categorySchema.index({ user: 1, isDeleted: 1 });

// ========== VIRTUAL POPULATE ==========
// Get all tasks in this category (optional, agar task model banaoge)
categorySchema.virtual('taskCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'category',
  count: true,
});

// ========== MIDDLEWARE ==========

// Pre-save: Title ko lowercase mein convert karo for case-insensitive comparison
categorySchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.title = this.title.trim();
  }
  next();
});

// Pre-find: Soft deleted categories ko automatically exclude karo
categorySchema.pre(/^find/, function (next) {
  // Agar explicitly deleted categories chahiye toh this method use karo
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// ========== METHODS ==========

/**
 * Soft delete category
 */
categorySchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Restore soft deleted category
 */
categorySchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

// ========== STATIC METHODS ==========

/**
 * Find user's categories
 */
categorySchema.statics.findByUser = function (userId) {
  return this.find({ user: userId, isDeleted: false }).sort({ createdAt: -1 });
};

/**
 * Check if category belongs to user
 */
categorySchema.statics.belongsToUser = async function (categoryId, userId) {
  const category = await this.findOne({ _id: categoryId, user: userId });
  return !!category;
};

/**
 * Get category with task count
 */
categorySchema.statics.findByIdWithTaskCount = function (categoryId, userId) {
  return this.findOne({ _id: categoryId, user: userId })
    .populate('taskCount');
};

const Category = mongoose.model('Category', categorySchema);

export default Category;