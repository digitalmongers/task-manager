import mongoose from 'mongoose';
import crypto from 'crypto';

const teamMemberSchema = new mongoose.Schema(
  {
    // Owner of the team (who created it)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Invited member email (may not be a user yet)
    memberEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Actual user (once they accept/signup)
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Role in the team
    role: {
      type: String,
      enum: ['editor', 'assignee', 'viewer'],
      default: 'editor',
    },

    // Status
    status: {
      type: String,
      enum: ['pending', 'active', 'removed'],
      default: 'pending',
      index: true,
    },

    // Invitation token for email verification
    invitationToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Token expiry
    tokenExpiresAt: {
      type: Date,
      default: null,
    },

    // Invitation details
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    invitedAt: {
      type: Date,
      default: Date.now,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    removedAt: {
      type: Date,
      default: null,
    },

    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Personal note from inviter
    invitationNote: {
      type: String,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
teamMemberSchema.index({ owner: 1, memberEmail: 1 }, { unique: true });
teamMemberSchema.index({ owner: 1, status: 1 });
teamMemberSchema.index({ member: 1, status: 1 });
teamMemberSchema.index({ invitationToken: 1, status: 1 });

// Pre-save validations and token generation
// Pre-save validations and token generation
teamMemberSchema.pre('save', async function() {
  // Prevent user from inviting themselves
  if (this.member && this.owner.equals(this.member)) {
    throw new Error('Cannot invite yourself as a team member');
  }
  
  // Generate invitation token
  if (this.isNew && this.status === 'pending' && !this.invitationToken) {
    this.invitationToken = crypto.randomBytes(32).toString('hex');
    // Token expires in 7 days
    this.tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
});

// Virtual for checking if expired
teamMemberSchema.virtual('isExpired').get(function() {
  return this.status === 'pending' && 
         this.tokenExpiresAt && 
         new Date() > this.tokenExpiresAt;
});

// Instance method to accept invitation
teamMemberSchema.methods.acceptInvitation = async function(userId) {
  // Allow accepting if pending OR if active but member is null (late binding for unauthenticated accept)
  const isPending = this.status === 'pending';
  const isActiveButNoMember = this.status === 'active' && !this.member;

  if (!isPending && !isActiveButNoMember) {
    throw new Error('Invitation is already accepted or removed');
  }
  
  if (isPending && this.isExpired) {
    this.status = 'expired';
    await this.save();
    throw new Error('Invitation has expired');
  }
  
  this.status = 'active';
  // Only set member if userId provided
  if (userId) {
    this.member = userId;
  }
  
  // Update acceptedAt only if not already set (or set it again, doesn't matter much)
  if (!this.acceptedAt) {
      this.acceptedAt = new Date();
  }
  
  return this.save();
};

// Instance method to remove member
teamMemberSchema.methods.removeMember = function(removedByUserId) {
  this.status = 'removed';
  this.removedAt = new Date();
  this.removedBy = removedByUserId;
  return this.save();
};

// Static method to find by token
teamMemberSchema.statics.findByToken = function(token) {
  return this.findOne({ 
    invitationToken: token,
    status: 'pending'
  })
    .populate('owner', 'firstName lastName email avatar')
    .populate('invitedBy', 'firstName lastName email');
};

// Static method to get active team members
teamMemberSchema.statics.getActiveMembers = function(ownerId) {
  return this.find({ owner: ownerId, status: 'active' })
    .populate('member', 'firstName lastName email avatar')
    .sort('-acceptedAt');
};

// Static method to get pending invitations
teamMemberSchema.statics.getPendingInvitations = function(ownerId) {
  return this.find({ owner: ownerId, status: 'pending' })
    .populate('invitedBy', 'firstName lastName')
    .sort('-invitedAt');
};

// Static method to check if user is team member
teamMemberSchema.statics.isTeamMember = async function(ownerId, userEmail) {
  const member = await this.findOne({
    owner: ownerId,
    memberEmail: userEmail,
    status: 'active'
  });
  return !!member;
};

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

export default TeamMember;