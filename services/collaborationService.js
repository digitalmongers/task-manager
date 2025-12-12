import CollaborationRepository from '../repositories/collaborationRepository.js';
import TaskRepository from '../repositories/taskRepository.js';
import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import EmailService from '../services/emailService.js';
import crypto from 'crypto';

class CollaborationService {
  // ========== TASK INVITATIONS (via email - for non-team members) ==========
  
  /**
   * Invite user to collaborate on task (via email invitation)
   */
  async inviteToTask(taskId, inviterUserId, inviteeEmail, role = 'editor', message = null) {
    try {
      // Check if task exists and inviter has permission
      const task = await TaskRepository.findByIdAndUser(taskId, inviterUserId);
      if (!task) {
        throw ApiError.notFound('Task not found or you do not have permission');
      }

      // Check if inviter is owner or has editor rights
      const access = await CollaborationRepository.canUserAccessTask(taskId, inviterUserId);
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
      const existingInvitation = await CollaborationRepository.getTaskInvitations(taskId, 'pending');
      const alreadyInvited = existingInvitation.some(inv => 
        inv.inviteeEmail === inviteeEmail
      );
      
      if (alreadyInvited) {
        throw ApiError.badRequest('User already has a pending invitation');
      }

      // Check if already a collaborator
      if (inviteeUser) {
        const existingCollab = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
        const alreadyCollaborator = existingCollab.some(collab => 
          collab.collaborator._id.equals(inviteeUser._id)
        );
        
        if (alreadyCollaborator) {
          throw ApiError.badRequest('User is already a collaborator on this task');
        }
      }

      // Create invitation (expires in 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await CollaborationRepository.createTaskInvitation({
        task: taskId,
        inviteeEmail,
        inviteeUser: inviteeUser?._id || null,
        inviter: inviterUserId,
        role,
        message,
        expiresAt,
        invitationToken: crypto.randomBytes(32).toString('hex'),
      });

      // Send invitation email
      await EmailService.sendTaskInvitation(invitation, task, inviter);

      Logger.logAuth('TASK_INVITATION_SENT', inviterUserId, {
        taskId,
        inviteeEmail,
        role,
      });

      return {
        invitation,
        message: 'Invitation sent successfully',
      };
    } catch (error) {
      Logger.error('Error inviting to task', { error: error.message });
      throw error;
    }
  }

  /**
   * Share task with team members directly
   */
  async shareTaskWithTeamMembers(taskId, ownerId, memberIds) {
    try {
      // Verify task ownership
      const task = await TaskRepository.findByIdAndUser(taskId, ownerId);
      if (!task) {
        throw ApiError.notFound('Task not found or you do not have permission');
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
          const existingCollab = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
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
          const collaborator = await CollaborationRepository.addCollaborator({
            task: taskId,
            taskOwner: ownerId,
            collaborator: teamMember.member._id,
            role: teamMember.role,
            status: 'active',
            sharedBy: ownerId,
          });

          // Update task shared status
          if (!task.isShared) {
            task.isShared = true;
            task.collaboratorCount = 1;
          } else {
            task.collaboratorCount += 1;
          }

          // Send email notification
          await EmailService.sendTaskSharedNotification(
            task,
            teamMember.member,
            await User.findById(ownerId)
          );

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

      await task.save();

      Logger.logAuth('TASK_SHARED_WITH_TEAM', ownerId, {
        taskId,
        sharedWith: results.length,
        errors: errors.length,
      });

      return {
        success: results,
        errors,
        message: `Task shared with ${results.length} team member(s)`,
      };
    } catch (error) {
      Logger.error('Error sharing task with team', { error: error.message });
      throw error;
    }
  }

  /**
   * Get team members for task sharing
   */
  async getTeamMembersForSharing(ownerId, taskId) {
    try {
      // Get all active team members
      const teamMembers = await TeamMember.getActiveMembers(ownerId);

      // Get current task collaborators
      const collaborators = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
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
   * Accept task invitation
   */
  async acceptInvitation(invitationToken, userId) {
    try {
      // Find invitation
      const invitation = await CollaborationRepository.findInvitationByToken(invitationToken);
      
      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      // If already fully processed (accepted + user linked + collaborator created)
      if (invitation.status === 'accepted' && invitation.inviteeUser && userId) {
        const TaskCollaborator = (await import('../models/TaskCollaborator.js')).default;
        const existingCollab = await TaskCollaborator.findOne({
          task: invitation.task._id || invitation.task,
          collaborator: userId,
          status: 'active'
        });
        
        if (existingCollab) {
          return {
            task: invitation.task,
            collaborator: existingCollab,
            message: 'You have already accepted this invitation',
          };
        }
      }

      // Check if expired (only if still pending)
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
      // If anonymous, we just mark invitation as accepted
      // The user will be linked when they sign up (handled by AuthService.handlePendingInvitation)
      let collaborator = null;
      if (userId) {
        const TaskCollaborator = (await import('../models/TaskCollaborator.js')).default;
        const Task = (await import('../models/Task.js')).default;
        
        // Get task to ensure we have the owner
        const taskId = invitation.task._id || invitation.task;
        const task = await Task.findById(taskId);
        
        if (!task) {
          throw ApiError.notFound('Task not found');
        }
        
        // Check if already exists
        collaborator = await TaskCollaborator.findOne({
          task: taskId,
          collaborator: userId,
        });
        
        if (!collaborator) {
          collaborator = await TaskCollaborator.create({
            task: taskId,
            taskOwner: task.user, // Use task.user from fetched task
            collaborator: userId,
            role: invitation.role,
            status: 'active',
            sharedBy: invitation.inviter,
            shareMessage: invitation.message,
          });
          
          // Update task counts
          if (!task.isShared) {
            task.isShared = true;
            task.collaboratorCount = 1;
          } else {
            task.collaboratorCount += 1;
          }
          await task.save();
        }
        
        await collaborator.populate([
          { path: 'task' },
          { path: 'collaborator', select: 'firstName lastName email avatar' },
          { path: 'sharedBy', select: 'firstName lastName' }
        ]);
      }

      Logger.logAuth('TASK_INVITATION_ACCEPTED', userId || 'anonymous', {
        invitationId: invitation._id,
        taskId: invitation.task._id || invitation.task,
      });

      return {
        task: invitation.task,
        collaborator,
        message: userId 
          ? 'Invitation accepted successfully' 
          : 'Invitation accepted! Please sign up or login to access the task.',
      };
    } catch (error) {
      Logger.error('Error accepting invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Decline task invitation
   */
  async declineInvitation(invitationToken, userId = null) {
    try {
      const invitation = await CollaborationRepository.findInvitationByToken(invitationToken);
      
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

      Logger.info('Task invitation declined', {
        invitationId: invitation._id,
        taskId: invitation.task._id,
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
   * Cancel invitation (by inviter)
   */
  async cancelInvitation(invitationId, userId) {
    try {
      const invitation = await CollaborationRepository.findInvitationByToken(invitationId);
      
      if (!invitation) {
        throw ApiError.notFound('Invitation not found');
      }

      // Check permission
      const access = await CollaborationRepository.canUserAccessTask(
        invitation.task._id,
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
      Logger.error('Error cancelling invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Get task invitations
   */
  async getTaskInvitations(taskId, userId) {
    try {
      // Check permission
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      if (!access.canAccess) {
        throw ApiError.forbidden('You do not have access to this task');
      }

      const invitations = await CollaborationRepository.getTaskInvitations(taskId);

      return {
        invitations,
      };
    } catch (error) {
      Logger.error('Error getting task invitations', { error: error.message });
      throw error;
    }
  }

  // ========== TASK COLLABORATORS ==========
  
  /**
   * Get task collaborators
   */
  async getTaskCollaborators(taskId, userId) {
    try {
      // Check permission
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      if (!access.canAccess) {
        throw ApiError.forbidden('You do not have access to this task');
      }

      const collaborators = await CollaborationRepository.getTaskCollaborators(taskId);

      return {
        collaborators,
        userRole: access.role,
        isOwner: access.isOwner,
      };
    } catch (error) {
      Logger.error('Error getting task collaborators', { error: error.message });
      throw error;
    }
  }

  /**
   * Update collaborator role
   */
  async updateCollaboratorRole(taskId, collaboratorId, newRole, userId) {
    try {
      // Check permission - only owner can change roles
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      if (!access.canAccess || access.role !== 'owner') {
        throw ApiError.forbidden('Only task owner can change collaborator roles');
      }

      const collaboration = await CollaborationRepository.updateCollaboratorRole(
        taskId,
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
      Logger.error('Error updating collaborator role', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove collaborator from task
   */
  async removeCollaborator(taskId, collaboratorId, userId) {
    try {
      // Check permission - owner or the collaborator themselves
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      
      const isSelf = userId.toString() === collaboratorId.toString();
      const canRemove = access.role === 'owner' || isSelf;
      
      if (!canRemove) {
        throw ApiError.forbidden('You do not have permission to remove this collaborator');
      }

      const collaboration = await CollaborationRepository.removeCollaborator(
        taskId,
        collaboratorId
      );

      if (!collaboration) {
        throw ApiError.notFound('Collaborator not found');
      }

      // Update task counts
      const Task = (await import('../models/Task.js')).default;
      const task = await Task.findById(taskId);
      if (task.collaboratorCount > 0) {
        task.collaboratorCount -= 1;
      }
      if (task.collaboratorCount === 0) {
        task.isShared = false;
      }
      await task.save();

      // Send notification if removed by owner
      if (!isSelf) {
        const removedUser = await User.findById(collaboratorId);
        const remover = await User.findById(userId);
        
        await EmailService.sendCollaboratorRemovedNotification(
          task,
          removedUser,
          remover
        );
      }

      return {
        message: isSelf ? 'You left the task' : 'Collaborator removed',
      };
    } catch (error) {
      Logger.error('Error removing collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Transfer task ownership
   */
  async transferOwnership(taskId, newOwnerId, currentUserId) {
    try {
      // Check if current user is owner
      const access = await CollaborationRepository.canUserAccessTask(taskId, currentUserId);
      if (!access.canAccess || access.role !== 'owner') {
        throw ApiError.forbidden('Only task owner can transfer ownership');
      }

      // Check if new owner is a collaborator
      const collaborators = await CollaborationRepository.getTaskCollaborators(taskId);
      const isCollaborator = collaborators.some(c => c.collaborator._id.equals(newOwnerId));
      
      if (!isCollaborator) {
        throw ApiError.badRequest('New owner must be an existing collaborator');
      }

      const task = await CollaborationRepository.transferOwnership(
        taskId,
        currentUserId,
        newOwnerId
      );

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      Logger.logAuth('TASK_OWNERSHIP_TRANSFERRED', currentUserId, {
        taskId,
        newOwnerId,
      });

      return {
        task,
        message: 'Ownership transferred successfully',
      };
    } catch (error) {
      Logger.error('Error transferring ownership', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's shared tasks (tasks where user is collaborator)
   */
  async getUserSharedTasks(userId, filters = {}) {
    try {
      const collaborations = await CollaborationRepository.getUserSharedTasks(userId);

      return {
        sharedTasks: collaborations,
      };
    } catch (error) {
      Logger.error('Error getting user shared tasks', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate shareable task link
   */
  async generateShareLink(taskId, userId) {
    try {
      // Check permission
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      if (!access.canAccess) {
        throw ApiError.forbidden('You do not have access to this task');
      }

      // Generate secure token
      const shareToken = crypto.randomBytes(32).toString('hex');
      
      // Update task with share token
      const Task = (await import('../models/Task.js')).default;
      const task = await Task.findById(taskId);
      
      task.shareToken = shareToken;
      task.shareTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await task.save();

      const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
      const shareLink = `${frontendUrl}/tasks/shared/${shareToken}`;

      return {
        shareLink,
        expiresAt: task.shareTokenExpires,
      };
    } catch (error) {
      Logger.error('Error generating share link', { error: error.message });
      throw error;
    }
  }

  /**
   * Access task via share link
   */
  async accessTaskViaShareLink(shareToken, userId) {
    try {
      const Task = (await import('../models/Task.js')).default;
      const task = await Task.findByShareToken(shareToken);

      if (!task) {
        throw ApiError.notFound('Invalid or expired share link');
      }

      // Check if user already has access
      const access = await CollaborationRepository.canUserAccessTask(task._id, userId);
      
      if (access.canAccess) {
        return {
          task,
          message: 'You already have access to this task',
          alreadyMember: true,
        };
      }

      // Add user as viewer
      await CollaborationRepository.addCollaborator({
        task: task._id,
        taskOwner: task.user,
        collaborator: userId,
        role: 'viewer',
        status: 'active',
        sharedBy: task.user,
      });

      // Update task counts
      if (!task.isShared) {
        task.isShared = true;
        task.collaboratorCount = 1;
      } else {
        task.collaboratorCount += 1;
      }
      await task.save();

      Logger.logAuth('TASK_ACCESSED_VIA_LINK', userId, {
        taskId: task._id,
        shareToken,
      });

      return {
        task,
        message: 'Successfully joined task as viewer',
        alreadyMember: false,
      };
    } catch (error) {
      Logger.error('Error accessing task via link', { error: error.message });
      throw error;
    }
  }
}

export default new CollaborationService();