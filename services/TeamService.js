import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import EmailService from '../services/emailService.js';
import NotificationService from '../services/notificationService.js';
import { PLAN_LIMITS } from '../config/aiConfig.js';


class TeamService {
  /**
   * Invite team member
   */
  async inviteTeamMember(ownerId, email, role = 'editor', message = null) {
    try {
      // Normalize email
      email = email.toLowerCase().trim();

      // Check if inviting self
      const owner = await User.findById(ownerId);

      // --- PLAN LIMIT CHECK ---
      const plan = PLAN_LIMITS[owner.plan || 'FREE'];
      const CollaborationRepository = (await import('../repositories/collaborationRepository.js')).default;
      const globalCollaborators = await CollaborationRepository.getGlobalCollaboratorEmails(ownerId);

      if (!globalCollaborators.has(email.toLowerCase()) && globalCollaborators.size >= plan.maxCollaborators) {
        throw ApiError.badRequest(`Your ${owner.plan || 'FREE'} plan only allows up to ${plan.maxCollaborators} unique collaborator(s) globally. Please upgrade for more.`);
      }
      // -------------------------

      if (owner.email === email) {
        throw ApiError.badRequest('You cannot invite yourself');
      }

      // Check if already invited or member
      const existing = await TeamMember.findOne({
        owner: ownerId,
        memberEmail: email,
        status: { $in: ['pending', 'active'] }
      });

      if (existing) {
        if (existing.status === 'active') {
          throw ApiError.badRequest('This user is already a team member');
        }
        throw ApiError.badRequest('Invitation already sent to this email');
      }

      // Check if user exists
      const existingUser = await User.findOne({ email });

      // Create invitation
      const invitation = await TeamMember.create({
        owner: ownerId,
        memberEmail: email,
        member: existingUser?._id || null,
        role,
        invitedBy: ownerId,
        invitationNote: message,
        status: 'pending',
        invitationToken: (await import('crypto')).randomBytes(32).toString('hex'),
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      await invitation.populate([
        { path: 'owner', select: 'firstName lastName email avatar' },
        { path: 'invitedBy', select: 'firstName lastName' }
      ]);

      // Send invitation email
      await EmailService.sendTeamMemberInvitation(invitation, owner);

      Logger.logAuth('TEAM_MEMBER_INVITED', ownerId, {
        email,
        role,
        invitationId: invitation._id,
      });

      return {
        invitation,
        message: 'Team invitation sent successfully',
      };
    } catch (error) {
      Logger.error('Error inviting team member', { error: error.message });
      throw error;
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(ownerId, status = 'all') {
    try {
      let members, pending;

      if (status === 'all' || status === 'active') {
        members = await TeamMember.getActiveMembers(ownerId);
      }

      if (status === 'all' || status === 'pending') {
        pending = await TeamMember.getPendingInvitations(ownerId);
      }

      return {
        members: members || [],
        pending: pending || [],
      };
    } catch (error) {
      Logger.error('Error getting team members', { error: error.message });
      throw error;
    }
  }

  /**
   * Accept team invitation
   */
  async acceptTeamInvitation(token, userId) {
    try {
      // Find invitation by token (even if active, to allow late binding)
      const invitation = await TeamMember.findOne({ invitationToken: token })
        .populate('owner', 'firstName lastName email avatar')
        .populate('invitedBy', 'firstName lastName email');

      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      // If invitation is removed or expired
      if (invitation.status === 'removed' || invitation.status === 'expired') {
         throw ApiError.badRequest('Invitation is no longer valid');
      }

      // If passed userId is present (Authenticated user)
      if (userId) {
        // Verify email matches if user exists and email is set on invitation
        const user = await User.findById(userId);
        if (user && user.email.toLowerCase() !== invitation.memberEmail.toLowerCase()) {
          throw ApiError.forbidden('This invitation is not for your email address');
        }
      }

      // Accept invitation (userId can be null)
      await invitation.acceptInvitation(userId || null);

      if (userId) {
        Logger.logAuth('TEAM_INVITATION_ACCEPTED', userId, {
          invitationId: invitation._id,
          ownerId: invitation.owner._id,
        });
      } else {
        Logger.info('Team invitation accepted anonymously', {
           invitationId: invitation._id,
           email: invitation.memberEmail
        });
      }

      return {
        teamMember: invitation,
        message: userId 
          ? 'Team invitation accepted successfully' 
          : 'Invitation accepted! Please sign up or login to access the team.',
      };
    } catch (error) {
      Logger.error('Error accepting team invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Decline team invitation
   */
  async declineTeamInvitation(token) {
    try {
      const invitation = await TeamMember.findByToken(token);

      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      invitation.status = 'removed';
      invitation.removedAt = new Date();
      await invitation.save();

      Logger.info('Team invitation declined', {
        invitationId: invitation._id,
        email: invitation.memberEmail,
      });

      return {
        message: 'Invitation declined',
      };
    } catch (error) {
      Logger.error('Error declining invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove team member
   */
  async removeTeamMember(ownerId, memberId) {
    try {
      const teamMember = await TeamMember.findOne({
        _id: memberId,
        owner: ownerId,
        status: { $in: ['pending', 'active'] }
      });

      if (!teamMember) {
        throw ApiError.notFound('Team member not found');
      }

      await teamMember.removeMember(ownerId);

      // Notification: Notify removed member
      const remover = await User.findById(ownerId);
      const removedMember = await User.findById(teamMember.member);
      // We need teamMember populated or we pass ownerId as team identifier
      // teamMember.owner is an ObjectId.
      // notifyTeamMemberRemoved expects: (teamMemberDoc, removedUserDoc, removerUserDoc)
      await NotificationService.notifyTeamMemberRemoved(teamMember, removedMember, remover);

      Logger.logAuth('TEAM_MEMBER_REMOVED', ownerId, {
        memberId,
        email: teamMember.memberEmail,
      });

      return {
        message: 'Team member removed successfully',
      };
    } catch (error) {
      Logger.error('Error removing team member', { error: error.message });
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(ownerId, memberId, newRole) {
    try {
      const teamMember = await TeamMember.findOne({
        _id: memberId,
        owner: ownerId,
        status: 'active'
      });

      if (!teamMember) {
        throw ApiError.notFound('Team member not found');
      }

      teamMember.role = newRole;
      await teamMember.save();

      await teamMember.populate('member', 'firstName lastName email avatar');

      // Notification: Notify member of role update
      const updater = await User.findById(ownerId);
      // teamMember.member is populated now
      await NotificationService.notifyTeamRoleUpdated(teamMember, teamMember.member, updater);

      Logger.logAuth('TEAM_MEMBER_ROLE_UPDATED', ownerId, {
        memberId,
        newRole,
      });

      return {
        member: teamMember,
        message: 'Member role updated successfully',
      };
    } catch (error) {
      Logger.error('Error updating member role', { error: error.message });
      throw error;
    }
  }

  /**
   * Get teams where user is a member
   */
  async getMyTeams(userId) {
    try {
      const teams = await TeamMember.find({
        member: userId,
        status: 'active'
      })
        .populate('owner', 'firstName lastName email avatar')
        .sort('-acceptedAt');

      return {
        teams,
      };
    } catch (error) {
      Logger.error('Error getting user teams', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel pending invitation
   */
  async cancelInvitation(ownerId, invitationId) {
    try {
      const invitation = await TeamMember.findOne({
        _id: invitationId,
        owner: ownerId,
        status: 'pending'
      });

      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      invitation.status = 'removed';
      invitation.removedAt = new Date();
      invitation.removedBy = ownerId;
      await invitation.save();

      return {
        message: 'Invitation cancelled successfully',
      };
    } catch (error) {
      Logger.error('Error cancelling invitation', { error: error.message });
      throw error;
    }
  }
}

export default new TeamService();