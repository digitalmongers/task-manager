import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    // ========== GOOGLE OAUTH FIELDS ==========
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
      select: false,
    },

    // ========== NEW: Facebook OAuth Fields ==========
  facebookId: {
    type: String,
    unique: true,
    sparse: true,
    select: false,
  },
  
  // Auth provider tracking
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local',
  },
  

    googlePhoto: {
      type: String,
      default: null,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
    password: {
      type: String,
      required: function() {
        // Password is only required for local auth, not for OAuth providers
        return this.authProvider === 'local';
      },
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't include password by default in queries
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    avatar: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
        "Please provide a valid phone number",
      ],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    termsAccepted: {
      type: Boolean,
      required: [true, "You must accept the terms and conditions"],
      default: false,
    },
    termsAcceptedAt: {
      type: Date,
    },

    passwordHistory: [
      {
        password: {
          type: String,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    passwordChangedAt: {
      type: Date,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    // Push notification preference
    pushEnabled: {
      type: Boolean,
      default: false,
    },

    // WebSocket notification preference
    websocketNotificationsEnabled: {
      type: Boolean,
      default: true,
    },

    // ========== 2FA FIELDS ==========
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    // Encrypted TOTP secret
    twoFactorSecret: {
      type: String,
      select: false, // Never return by default
    },
    twoFactorConfirmedAt: {
      type: Date,
    },
    twoFactorLastVerifiedAt: {
      type: Date,
    },
    // Backup codes (hashed)
    backupCodes: [
      {
        codeHash: {
          type: String,
          required: true,
        },
        usedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    // Token version for global logout
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // ========== ONBOARDING FIELDS ==========
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
    firstTaskCreated: {
      type: Boolean,
      default: false,
    },

    // ========== AI & PLAN FIELDS ==========
    plan: {
      type: String,
      enum: ["FREE", "STARTER", "PRO", "TEAM"],
      default: "FREE",
    },
    
    // Subscription boosts (from plan)
    subscriptionBoosts: {
      type: Number,
      default: 100, // Default for FREE plan
    },
    subscriptionBoostsUsed: {
      type: Number,
      default: 0,
    },
    
    // Top-up boosts (from purchases)
    topupBoosts: {
      type: Number,
      default: 0,
    },
    topupBoostsUsed: {
      type: Number,
      default: 0,
    },
    
    // Track usage within the current billing month (vital for Yearly plans)
    // This tracks ONLY subscription boost usage for monthly limits
    monthlyUsedBoosts: {
      type: Number,
      default: 0,
    },
    lastMonthlyReset: {
      type: Date,
      default: Date.now,
    },
    aiUsageBlocked: {
      type: Boolean,
      default: false,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      default: "MONTHLY",
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "past_due", "cancelled"],
      default: "inactive",
    },
    currentPeriodEnd: {
      type: Date,
    },
    razorpayCustomerId: {
      type: String,
    },
    razorpaySubscriptionId: {
      type: String,
    },
    // ========== LOCALIZATION FIELDS ==========
    isEnterpriseUser: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      default: "UTC", // Use IANA timezone names like 'Asia/Kolkata'
    },
    lastKnownIp: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for performance (email index is already created by unique: true)
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre("save", async function () {
  // Only hash password if it exists and has been modified
  if (!this.password || !this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre("save", function () {
  if (this.isModified("termsAccepted") && this.termsAccepted) {
    this.termsAcceptedAt = new Date();
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  // If password doesn't exist (OAuth users), return false
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  // Generate random token
  const verificationToken = crypto.randomBytes(32).toString("hex");

  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // Set expiry time (24 hours)
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash token and set to passwordResetToken field
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expiry time (1 hour)
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;

  return resetToken;
};

// Virtual fields for backward compatibility
userSchema.virtual('totalBoosts').get(function() {
  if (this.isEnterpriseUser) return 999999; // Represent unlimited in UI
  return (this.subscriptionBoosts || 0) + (this.topupBoosts || 0);
});

userSchema.virtual('usedBoosts').get(function() {
  if (this.isEnterpriseUser) return 0; // Always 0 used for enterprise
  return (this.subscriptionBoostsUsed || 0) + (this.topupBoostsUsed || 0);
});

// Ensure virtuals are included in JSON and Object outputs
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Instance method to check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function () {
  // If lock has expired, reset attempts and lock
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });
};

// ADD THIS METHOD: Check if password was used in last N passwords
userSchema.methods.wasPasswordUsedRecently = async function (
  password,
  historyCount = 5
) {
  if (!this.passwordHistory || this.passwordHistory.length === 0) {
    return false;
  }

  // Check last 5 passwords
  const recentPasswords = this.passwordHistory.slice(-historyCount);

  for (const oldPass of recentPasswords) {
    const isMatch = await bcrypt.compare(password, oldPass.password);
    if (isMatch) {
      return true;
    }
  }

  return false;
};

// ADD THIS METHOD: Add current password to history before changing
userSchema.methods.addToPasswordHistory = async function () {
  if (!this.passwordHistory) {
    this.passwordHistory = [];
  }

  // Add current password to history
  this.passwordHistory.push({
    password: this.password,
    changedAt: new Date(),
  });

  // Keep only last 10 passwords in history
  if (this.passwordHistory.length > 10) {
    this.passwordHistory = this.passwordHistory.slice(-10);
  }
};

// Static method to find by email with password
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email }).select(
    "+password +emailVerificationToken +emailVerificationExpires"
  );
};

const User = mongoose.model("User", userSchema);

export default User;
