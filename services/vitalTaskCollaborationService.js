import CollaborationRepository from '../repositories/collaborationRepository.js';
import VitalTaskRepository from '../repositories/vitalTaskRepository.js';
import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';
import VitalTask from '../models/VitalTask.js';
import VitalTaskCollaborator from '../models/VitalTaskCollaborator.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import EmailService from '../services/emailService.js';
import NotificationService from '../services/notificationService.js';
import crypto from 'crypto';

class VitalTaskCollaborationService {
  // ========== VITAL TASK INVITATIONS (via email - for non-team members) ==========
  
  /**
   * Invite user to collaborate on vital task (via email invitation)
   */
  async inviteToVitalTask(vitalTaskId, inviterUserId, inviteeEmail, role = 'editor', message = null) {
    try {
      // Check if vital task exists and inviter has permission
      const vitalTask = await VitalTaskRepository.findByIdAndUser(vitalTaskId, inviterUserId);
      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found or you do not have permission');
      }

      // Check if inviter is owner or has editor rights
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, inviterUserId);
      if (!access.canAccess || (access.role !== 'owner' && access.role !== 'editor')) {
        throw ApiError.forbidden('You do not have permission to invite collaborators');
      }

      // Normalize email
      inviteeEmail = inviteeEmail.toLowerCase().trim();

      // Check if inviting self
      const inviter = await User.findById(inviterUserId);
      if (inviter.email === inviteeEmail) {
        throw ApiError.badRequest('You cannot invite yourself');
      }

      // Check if user exists
      const inviteeUser = await User.findOne({ email: inviteeEmail });

      // Check if already invited (pending)
      const existingInvitation = await CollaborationRepository.getVitalTaskInvitations(vitalTaskId, 'pending');
      const alreadyInvited = existingInvitation.some(inv => 
        inv.inviteeEmail === inviteeEmail
      );
      
      if (alreadyInvited) {
        throw ApiError.badRequest('User already has a pending invitation');
      }

      // Check if already a collaborator
      if (inviteeUser) {
        const existingCollab = await CollaborationRepository.getVitalTaskCollaborators(vitalTaskId, 'active');
        const alreadyCollaborator = existingCollab.some(collab => 
          collab.collaborator._id.equals(inviteeUser._id)
        );
        
        if (alreadyCollaborator) {
          throw ApiError.badRequest('User is already a collaborator on this vital task');
        }
      }

      // Create invitation (expires in 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await CollaborationRepository.createVitalTaskInvitation({
        vitalTask: vitalTaskId,
        inviteeEmail,
        inviteeUser: inviteeUser?._id || null,
        inviter: inviterUserId,
        role,
        message,
        expiresAt,
        invitationToken: crypto.randomBytes(32).toString('hex'),
      });

      // Send invitation email
      await EmailService.sendVitalTaskInvitation(invitation, vitalTask, inviter);

      Logger.logAuth('VITAL_TASK_INVITATION_SENT', inviterUserId, {
        vitalTaskId,
        inviteeEmail,
        role,
      });

      return {
        invitation,
        message: 'Invitation sent successfully',
      };
    } catch (error) {
      Logger.error('Error inviting to vital task', { error: error.message });
      throw error;
    }
  }

  /**
   * Share vital task with team members directly
   */
  async shareVitalTaskWithTeamMembers(vitalTaskId, ownerId, memberIds) {
    try {
      // Verify vital task ownership
      const vitalTask = await VitalTaskRepository.findByIdAndUser(vitalTaskId, ownerId);
      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found or you do not have permission');
      }

      // Verify all memberIds are valid team members
      const teamMembers = await TeamMember.find({
        _id: { $in: memberIds },
        owner: ownerId,
        status: 'active'
      }).populate('member', 'firstName lastName email avatar');

      if (teamMembers.length !== memberIds.length) {
        throw ApiError.badRequest('Some team members are invalid');
      }

      const results = [];
      const errors = [];

      for (const teamMember of teamMembers) {
        try {
          // Check if already a collaborator
          const existingCollab = await CollaborationRepository.getVitalTaskCollaborators(vitalTaskId, 'active');
          const alreadyCollaborator = existingCollab.some(collab => 
            collab.collaborator._id.equals(teamMember.member._id)
          );

          if (alreadyCollaborator) {
            errors.push({
              email: teamMember.memberEmail,
              error: 'Already a collaborator'
            });
            continue;
          }

          // Add as collaborator with their team role
          const collaborator = await CollaborationRepository.addVitalTaskCollaborator({
            vitalTask: vitalTaskId,
            taskOwner: ownerId,
            collaborator: teamMember.member._id,
            role: teamMember.role,
            status: 'active',
            sharedBy: ownerId,
          });

          // Update vital task shared status
          if (!vitalTask.isShared) {
            vitalTask.isShared = true;
            vitalTask.collaboratorCount = 1;
          } else {
            vitalTask.collaboratorCount += 1;
          }

          // Send email notification
          await EmailService.sendVitalTaskSharedNotification(
            vitalTask,
            teamMember.member,
            await User.findById(ownerId)
          );

          // Notification: Real-time notification
          const assigner = await User.findById(ownerId);
          await NotificationService.notifyVitalTaskAssigned(vitalTask, teamMember.member, assigner);

          results.push({
            email: teamMember.memberEmail,
            collaborator
          });

        } catch (error) {
          errors.push({
            email: teamMember.memberEmail,
            error: error.message
          });
        }
      }

      await vitalTask.save();

      Logger.logAuth('VITAL_TASK_SHARED_WITH_TEAM', ownerId, {
        vitalTaskId,
        sharedWith: results.length,
        errors: errors.length,
      });

      return {
        success: results,
        errors,
        message: `Vital task shared with ${results.length} team member(s)`,
      };
    } catch (error) {
      Logger.error('Error sharing vital task with team', { error: error.message });
      throw error;
    }
  }

  /**
   * Get team members for vital task sharing
   */
  async getTeamMembersForSharing(ownerId, vitalTaskId) {
    try {
      // Get all active team members
      const teamMembers = await TeamMember.getActiveMembers(ownerId);

      // Get current vital task collaborators
      const collaborators = await CollaborationRepository.getVitalTaskCollaborators(vitalTaskId, 'active');
      const collaboratorIds = collaborators.map(c => c.collaborator._id.toString());

      // Filter out members who are already collaborators
      const availableMembers = teamMembers.filter(tm => 
        !collaboratorIds.includes(tm.member._id.toString())
      );

      return {
        availableMembers,
        alreadyShared: teamMembers.length - availableMembers.length,
      };
    } catch (error) {
      Logger.error('Error getting team members for sharing', { error: error.message });
      throw error;
    }
  }

  /**
   * Accept vital task invitation
   */
  async acceptInvitation(invitationToken, userId) {
    try {
      // Find invitation
      const invitation = await CollaborationRepository.findVitalTaskInvitationByToken(invitationToken);
      
      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      // If already fully processed
      if (invitation.status === 'accepted' && invitation.inviteeUser && userId) {
        const existingCollab = await VitalTaskCollaborator.findOne({
          vitalTask: invitation.vitalTask._id || invitation.vitalTask,
          collaborator: userId,
          status: 'active'
        });
        
        if (existingCollab) {
          return {
            vitalTask: invitation.vitalTask,
            collaborator: existingCollab,
            message: 'You have already accepted this invitation',
          };
        }
      }

      // Check if expired
      if (invitation.status === 'pending' && invitation.isExpired) {
        invitation.status = 'expired';
        await invitation.save();
        throw ApiError.badRequest('Invitation has expired');
      }

      // Verify email if user is authenticated
      if (userId) {
        const user = await User.findById(userId);
        if (user && user.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
          throw ApiError.forbidden('This invitation is not for you');
        }
      }

      // Accept invitation
      await invitation.accept(userId || null);

      // Create collaborator ONLY if user is authenticated
      let collaborator = null;
      if (userId) {
        const vitalTaskId = invitation.vitalTask._id || invitation.vitalTask;
        const vitalTask = await VitalTask.findById(vitalTaskId);
        
        if (!vitalTask) {
          throw ApiError.notFound('Vital task not found');
        }
        
        // Check if already exists
        collaborator = await VitalTaskCollaborator.findOne({
          vitalTask: vitalTaskId,
          collaborator: userId,
        });
        
        if (!collaborator) {
          collaborator = await VitalTaskCollaborator.create({
            vitalTask: vitalTaskId,
            taskOwner: vitalTask.user,
            collaborator: userId,
            role: invitation.role,
            status: 'active',
            sharedBy: invitation.inviter,
            shareMessage: invitation.message,
          });
          
          // Update vital task counts
          if (!vitalTask.isShared) {
            vitalTask.isShared = true;
            vitalTask.collaboratorCount = 1;
          } else {
            vitalTask.collaboratorCount += 1;
          }
          await vitalTask.save();
        }
        
        await collaborator.populate([
          { path: 'vitalTask' },
          { path: 'collaborator', select: 'firstName lastName email avatar' },
          { path: 'sharedBy', select: 'firstName lastName' }
        ]);
      }

      Logger.logAuth('VITAL_TASK_INVITATION_ACCEPTED', userId || 'anonymous', {
        invitationId: invitation._id,
        vitalTaskId: invitation.vitalTask._id || invitation.vitalTask,
      });

      // Notification: Notify owner that someone accepted invitation (if userid exists)
      if (userId) {
         const vitalTaskId = invitation.vitalTask._id || invitation.vitalTask;
         const vitalTask = await (await import('../models/VitalTask.js')).default.findById(vitalTaskId);
         if (vitalTask) {
             const owner = await User.findById(vitalTask.user);
             const acceptor = await User.findById(userId);
             await NotificationService.notifyCollaboratorAdded(vitalTask, owner, acceptor, true); // true for isVitalTask
         }
      }

      return {
        vitalTask: invitation.vitalTask,
        collaborator,
        message: userId 
          ? 'Invitation accepted successfully' 
          : 'Invitation accepted! Please sign up or login to access the vital task.',
      };
    } catch (error) {
      Logger.error('Error accepting vital task invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Decline vital task invitation
   */
  async declineInvitation(invitationToken, userId = null) {
    try {
      const invitation = await CollaborationRepository.findVitalTaskInvitationByToken(invitationToken);
      
      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw ApiError.badRequest('Invitation is not pending');
      }

      // If userId provided, verify it matches
      if (userId) {
        const user = await User.findById(userId);
        if (user.email !== invitation.inviteeEmail) {
          throw ApiError.forbidden('This invitation is not for you');
        }
      }

      await invitation.decline();

      Logger.info('Vital task invitation declined', {
        invitationId: invitation._id,
        vitalTaskId: invitation.vitalTask._id,
      });

      return {
        message: 'Invitation declined',
      };
    } catch (error) {
      Logger.error('Error declining vital task invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel invitation (by inviter)
   */
  async cancelInvitation(invitationId, userId) {
    try {
      const invitation = await CollaborationRepository.findVitalTaskInvitationById(invitationId);
      
      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      // Check permission
      const access = await CollaborationRepository.canUserAccessVitalTask(
        invitation.vitalTask._id,
        userId
      );
      
      if (!access.canAccess || (access.role !== 'owner' && access.role !== 'editor')) {
        throw ApiError.forbidden('You do not have permission to cancel invitations');
      }

      await invitation.cancel();

      return {
        message: 'Invitation cancelled',
      };
    } catch (error) {
      Logger.error('Error cancelling vital task invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Get vital task invitations
   */
  async getVitalTaskInvitations(vitalTaskId, userId) {
    try {
      // Check permission
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, userId);
      if (!access.canAccess) {
        throw ApiError.forbidden('You do not have access to this vital task');
      }

      const invitations = await CollaborationRepository.getVitalTaskInvitations(vitalTaskId);

      return {
        invitations,
      };
    } catch (error) {
      Logger.error('Error getting vital task invitations', { error: error.message });
      throw error;
    }
  }

  // ========== VITAL TASK COLLABORATORS ==========
  
  /**
   * Get vital task collaborators
   */
  async getVitalTaskCollaborators(vitalTaskId, userId) {
    try {
      // Check permission
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, userId);
      if (!access.canAccess) {
        throw ApiError.forbidden('You do not have access to this vital task');
      }

      const collaborators = await CollaborationRepository.getVitalTaskCollaborators(vitalTaskId);

      return {
        collaborators,
        userRole: access.role,
        isOwner: access.isOwner,
      };
    } catch (error) {
      Logger.error('Error getting vital task collaborators', { error: error.message });
      throw error;
    }
  }

  /**
   * Update collaborator role
   */
  async updateCollaboratorRole(vitalTaskId, collaboratorId, newRole, userId) {
    try {
      // Check permission - only owner can change roles
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, userId);
      if (!access.canAccess || access.role !== 'owner') {
        throw ApiError.forbidden('Only vital task owner can change collaborator roles');
      }

      const collaboration = await CollaborationRepository.updateVitalTaskCollaboratorRole(
        vitalTaskId,
        collaboratorId,
        newRole
      );

      if (!collaboration) {
        throw ApiError.notFound('Collaborator not found');
      }

      return {
        collaboration,
        message: 'Collaborator role updated',
      };
    } catch (error) {
      Logger.error('Error updating vital task collaborator role', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove collaborator from vital task
   */
  async removeCollaborator(vitalTaskId, collaboratorId, userId) {
    try {
      // Fetch collaborator first
      const collaboration = await CollaborationRepository.findVitalTaskCollaborator(vitalTaskId, collaboratorId);
      
      if (!collaboration) {
        throw ApiError.notFound('Collaborator not found');
      }

      // Check permission - owner or the collaborator themselves
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, userId);
      
      const targetUserId = collaboration.collaborator._id.toString();
      const isSelf = userId.toString() === targetUserId;
      const canRemove = access.role === 'owner' || isSelf;
      
      if (!canRemove) {
        throw ApiError.forbidden('You do not have permission to remove this collaborator');
      }

      await collaboration.removeCollaborator();

      // Update vital task counts
      const vitalTask = await VitalTask.findById(vitalTaskId);
      if (vitalTask.collaboratorCount > 0) {
        vitalTask.collaboratorCount -= 1;
      }
      if (vitalTask.collaboratorCount === 0) {
        vitalTask.isShared = false;
      }
      await vitalTask.save();

      // Send notification if removed by owner
      if (!isSelf) {
        const removedUser = collaboration.collaborator;
        const remover = await User.findById(userId);
        
        await EmailService.sendVitalTaskCollaboratorRemovedNotification(
          vitalTask,
          removedUser,
          remover
        );

        // Notification: Notify removed collaborator
        await NotificationService.notifyCollaboratorRemoved(vitalTask, removedUser, remover, true);
      }

      return {
        message: isSelf ? 'You left the vital task' : 'Collaborator removed',
      };
    } catch (error) {
      Logger.error('Error removing vital task collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Update collaborator role
   */
  async updateCollaboratorRole(vitalTaskId, collaboratorId, newRole, userId) {
    try {
      // Check permission - only owner can change roles
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, userId);
      if (!access.canAccess || access.role !== 'owner') {
        throw ApiError.forbidden('Only vital task owner can change collaborator roles');
      }

      const collaboration = await CollaborationRepository.updateVitalTaskCollaboratorRole(
        vitalTaskId,
        collaboratorId,
        newRole
      );

      if (!collaboration) {
        throw ApiError.notFound('Collaborator not found');
      }

      // Notification: Notify collaborator of role update
      // reusing notifyCollaboratorAdded with specific message or create new generic method? 
      // Plan didn't specify Role Update for VitalTaskCollaborator but it's good to have.
      // NotificationService doesn't have specific 'vital_task_collaborator_role_updated'
      // We can skip or add if strict. User asked for "secure role based". 
      // Let's Skip explicit role update notification for now to save complexity/tokens as it wasn't explicitly asked, 
      // or just rely on generic sync. 
      // Actually, let's reuse 'notifyCollaboratorAdded' logic but we don't have a distinct type.
      // For now, I will leave it as is to avoid adding unverified types.

      return {
        collaboration,
        message: 'Collaborator role updated',
      };
    } catch (error) {
      Logger.error('Error updating vital task collaborator role', { error: error.message });
      throw error;
    }
  }

  /**
   * Transfer vital task ownership
   */
  async transferOwnership(vitalTaskId, newOwnerId, currentUserId) {
    try {
      // Check if current user is owner
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, currentUserId);
      if (!access.canAccess || access.role !== 'owner') {
        throw ApiError.forbidden('Only vital task owner can transfer ownership');
      }

      // Check if new owner is a collaborator
      const collaborators = await CollaborationRepository.getVitalTaskCollaborators(vitalTaskId);
      const isCollaborator = collaborators.some(c => c.collaborator._id.equals(newOwnerId));
      
      if (!isCollaborator) {
        throw ApiError.badRequest('New owner must be an existing collaborator');
      }

      const vitalTask = await CollaborationRepository.transferVitalTaskOwnership(
        vitalTaskId,
        currentUserId,
        newOwnerId
      );

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      Logger.logAuth('VITAL_TASK_OWNERSHIP_TRANSFERRED', currentUserId, {
        vitalTaskId,
        newOwnerId,
      });

      return {
        vitalTask,
        message: 'Ownership transferred successfully',
      };
    } catch (error) {
      Logger.error('Error transferring vital task ownership', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's shared vital tasks (vital tasks where user is collaborator)
   */
  async getUserSharedVitalTasks(userId, filters = {}) {
    try {
      const collaborations = await CollaborationRepository.getUserSharedVitalTasks(userId);

      return {
        sharedVitalTasks: collaborations,
      };
    } catch (error) {
      Logger.error('Error getting user shared vital tasks', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate shareable vital task link
   */
  async generateShareLink(vitalTaskId, userId) {
    try {
      // Check permission
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, userId);
      if (!access.canAccess) {
        throw ApiError.forbidden('You do not have access to this vital task');
      }

      // Generate secure token
      const shareToken = crypto.randomBytes(32).toString('hex');
      
      // Update vital task with share token
      const vitalTask = await VitalTask.findById(vitalTaskId);
      
      vitalTask.shareToken = shareToken;
      vitalTask.shareTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await vitalTask.save();

      const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
      const shareLink = `${frontendUrl}/vital-tasks/shared/${shareToken}`;

      return {
        shareLink,
        expiresAt: vitalTask.shareTokenExpires,
      };
    } catch (error) {
      Logger.error('Error generating vital task share link', { error: error.message });
      throw error;
    }
  }

  /**
   * Access vital task via share link
   */
  async accessVitalTaskViaShareLink(shareToken, userId) {
    try {
      const vitalTask = await VitalTask.findByShareToken(shareToken);

      if (!vitalTask) {
        throw ApiError.notFound('Invalid or expired share link');
      }

      // Check if user already has access
      const access = await CollaborationRepository.canUserAccessVitalTask(vitalTask._id, userId);
      
      if (access.canAccess) {
        return {
          vitalTask,
          message: 'You already have access to this vital task',
          alreadyMember: true,
        };
      }

      // Add user as viewer
      await CollaborationRepository.addVitalTaskCollaborator({
        vitalTask: vitalTask._id,
        taskOwner: vitalTask.user,
        collaborator: userId,
        role: 'viewer',
        status: 'active',
        sharedBy: vitalTask.user,
      });

      // Update vital task counts
      if (!vitalTask.isShared) {
        vitalTask.isShared = true;
        vitalTask.collaboratorCount = 1;
      } else {
        vitalTask.collaboratorCount += 1;
      }
      await vitalTask.save();

      Logger.logAuth('VITAL_TASK_ACCESSED_VIA_LINK', userId, {
        vitalTaskId: vitalTask._id,
        shareToken,
      });

      return {
        vitalTask,
        message: 'Successfully joined vital task as viewer',
        alreadyMember: false,
      };
    } catch (error) {
      Logger.error('Error accessing vital task via link', { error: error.message });
      throw error;
    }
  }
}

export default new VitalTaskCollaborationService();
