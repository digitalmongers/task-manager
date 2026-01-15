import TaskCollaborator from '../models/TaskCollaborator.js';
import TaskInvitation from '../models/TaskInvitation.js';
import TeamMember from '../models/TeamMember.js';
import Task from '../models/Task.js';
import VitalTaskCollaborator from '../models/VitalTaskCollaborator.js';
import VitalTask from '../models/VitalTask.js';
import VitalTaskInvitation from '../models/VitalTaskInvitation.js';
import User from '../models/User.js';
import Logger from '../config/logger.js';

class CollaborationRepository {
  // ========== TASK INVITATIONS ==========
  
  /**
   * Create task invitation
   */
  async createTaskInvitation(data) {
    try {
      const invitation = await TaskInvitation.create(data);
      await invitation.populate([
        { path: 'task' },
        { path: 'inviter', select: 'firstName lastName email avatar' },
        { path: 'inviteeUser', select: 'firstName lastName email avatar' }
      ]);
      
      Logger.info('Task invitation created', {
        invitationId: invitation._id,
        taskId: data.task,
        inviteeEmail: data.inviteeEmail,
      });
      
      return invitation;
    } catch (error) {
      Logger.error('Error creating task invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Find invitation by token
   */
  async findInvitationByToken(token) {
    try {
      return await TaskInvitation.findByToken(token);
    } catch (error) {
      Logger.error('Error finding invitation by token', { error: error.message });
      throw error;
    }
  }

  /**
   * Find invitation by ID
   */
  async findInvitationById(invitationId) {
    try {
      return await TaskInvitation.findById(invitationId)
        .populate('task')
        .populate('inviter', 'firstName lastName email avatar');
    } catch (error) {
      Logger.error('Error finding invitation by ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Get pending invitations for a task
   */
  async getTaskInvitations(taskId, status = 'pending') {
    try {
      return await TaskInvitation.find({ task: taskId, status })
        .populate('inviteeUser', 'firstName lastName email avatar')
        .populate('inviter', 'firstName lastName')
        .sort('-invitedAt');
    } catch (error) {
      Logger.error('Error getting task invitations', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId) {
    try {
      const invitation = await TaskInvitation.findById(invitationId);
      if (!invitation) return null;
      
      await invitation.cancel();
      Logger.info('Invitation cancelled', { invitationId });
      return invitation;
    } catch (error) {
      Logger.error('Error cancelling invitation', { error: error.message });
      throw error;
    }
  }

  // ========== TASK COLLABORATORS ==========
  
  /**
   * Add collaborator to task
   */
  async addCollaborator(data) {
    try {
      // Clean up any existing record (e.g. status='removed') to avoid unique index conflict
      await TaskCollaborator.deleteOne({ task: data.task, collaborator: data.collaborator });
      
      const collaborator = await TaskCollaborator.create(data);
      await collaborator.populate([
        { path: 'task' },
        { path: 'collaborator', select: 'firstName lastName email avatar' },
        { path: 'sharedBy', select: 'firstName lastName' }
      ]);
      
      Logger.info('Collaborator added', {
        taskId: data.task,
        collaboratorId: data.collaborator,
        role: data.role,
      });
      
      return collaborator;
    } catch (error) {
      Logger.error('Error adding collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Find a specific collaborator safely (by User ID or Row ID)
   */
  async findCollaborator(taskId, collaboratorId) {
    try {
      return await TaskCollaborator.findOne({
        task: taskId,
        $or: [{ collaborator: collaboratorId }, { _id: collaboratorId }],
        status: 'active'
      }).populate('collaborator', 'firstName lastName email avatar');
    } catch (error) {
      Logger.error('Error finding collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Get task collaborators
   */
  async getTaskCollaborators(taskId, status = 'active') {
    try {
      return await TaskCollaborator.getTaskCollaborators(taskId, status);
    } catch (error) {
      Logger.error('Error getting task collaborators', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's shared tasks
   */
  async getUserSharedTasks(userId, status = 'active') {
    try {
      return await TaskCollaborator.getUserSharedTasks(userId, status);
    } catch (error) {
      Logger.error('Error getting user shared tasks', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if user can access task
   */
  async canUserAccessTask(taskId, userId) {
    try {
      return await TaskCollaborator.canUserAccessTask(taskId, userId);
    } catch (error) {
      Logger.error('Error checking task access', { error: error.message });
      throw error;
    }
  }

  /**
   * Update collaborator role
   */
  async updateCollaboratorRole(taskId, collaboratorId, newRole) {
    try {
      const collaboration = await TaskCollaborator.findOne({
        task: taskId,
        $or: [{ collaborator: collaboratorId }, { _id: collaboratorId }],
        status: 'active'
      });
      
      if (!collaboration) return null;
      
      collaboration.role = newRole;
      await collaboration.save();
      
      Logger.info('Collaborator role updated', {
        taskId,
        collaboratorId,
        newRole,
      });
      
      return collaboration;
    } catch (error) {
      Logger.error('Error updating collaborator role', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove collaborator from task
   */
  async removeCollaborator(taskId, collaboratorId) {
    try {
      const collaboration = await TaskCollaborator.findOne({
        task: taskId,
        $or: [{ collaborator: collaboratorId }, { _id: collaboratorId }],
        status: 'active'
      });
      
      if (!collaboration) return null;
      
      await collaboration.removeCollaborator();
      
      Logger.info('Collaborator removed', {
        taskId,
        collaboratorId,
      });
      
      return collaboration;
    } catch (error) {
      Logger.error('Error removing collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Transfer task ownership
   */
  async transferOwnership(taskId, currentOwnerId, newOwnerId) {
    try {
      const task = await Task.findOne({ _id: taskId, user: currentOwnerId });
      if (!task) return null;

      // Update task owner
      task.user = newOwnerId;
      await task.save();

      // Update current owner to editor
      const currentOwnerCollab = await TaskCollaborator.findOne({
        task: taskId,
        collaborator: currentOwnerId
      });
      
      if (currentOwnerCollab) {
        currentOwnerCollab.role = 'editor';
        await currentOwnerCollab.save();
      } else {
        await TaskCollaborator.create({
          task: taskId,
          taskOwner: newOwnerId,
          collaborator: currentOwnerId,
          role: 'editor',
          status: 'active',
          sharedBy: newOwnerId,
        });
      }

      // Update new owner to owner role
      await TaskCollaborator.updateOne(
        { task: taskId, collaborator: newOwnerId },
        { 
          role: 'owner',
          taskOwner: newOwnerId 
        }
      );

      // Update all other collaborators' taskOwner field
      await TaskCollaborator.updateMany(
        { task: taskId, collaborator: { $ne: newOwnerId } },
        { taskOwner: newOwnerId }
      );

      Logger.info('Task ownership transferred', {
        taskId,
        from: currentOwnerId,
        to: newOwnerId,
      });

      return task;
    } catch (error) {
      Logger.error('Error transferring ownership', { error: error.message });
      throw error;
    }
  }

  // ========== TEAM MEMBERS ==========
  
  /**
   * Add team member
   */
  async addTeamMember(data) {
    try {
      const teamMember = await TeamMember.create(data);
      await teamMember.populate([
        { path: 'member', select: 'firstName lastName email avatar' },
        { path: 'invitedBy', select: 'firstName lastName' }
      ]);
      
      Logger.info('Team member added', {
        owner: data.owner,
        member: data.member,
        role: data.role,
      });
      
      return teamMember;
    } catch (error) {
      Logger.error('Error adding team member', { error: error.message });
      throw error;
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(ownerId, status = 'active') {
    try {
      if (status === 'active') {
        return await TeamMember.getActiveMembers(ownerId);
      } else if (status === 'pending') {
        return await TeamMember.getPendingInvitations(ownerId);
      }
      
      return await TeamMember.find({ owner: ownerId, status })
        .populate('member', 'firstName lastName email avatar')
        .sort('-acceptedAt');
    } catch (error) {
      Logger.error('Error getting team members', { error: error.message });
      throw error;
    }
  }

  /**
   * Accept team invitation
   */
  async acceptTeamInvitation(teamMemberId) {
    try {
      const teamMember = await TeamMember.findById(teamMemberId);
      if (!teamMember) return null;
      
      await teamMember.acceptInvitation();
      
      Logger.info('Team invitation accepted', { teamMemberId });
      return teamMember;
    } catch (error) {
      Logger.error('Error accepting team invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove team member
   */
  async removeTeamMember(ownerId, memberId, removedBy) {
    try {
      const teamMember = await TeamMember.findOne({
        owner: ownerId,
        member: memberId,
        status: { $in: ['pending', 'active'] }
      });
      
      if (!teamMember) return null;
      
      await teamMember.removeMember(removedBy);
      
      Logger.info('Team member removed', { ownerId, memberId });
      return teamMember;
    } catch (error) {
      Logger.error('Error removing team member', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if user is team member
   */
  async isTeamMember(ownerId, userId) {
    try {
      const teamMember = await TeamMember.findOne({
        owner: ownerId,
        member: userId,
        status: 'active'
      });
      
      return !!teamMember;
    } catch (error) {
      Logger.error('Error checking team membership', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's teams (where they are a member)
   */
  async getUserTeams(userId) {
    try {
      return await TeamMember.find({ member: userId, status: 'active' })
        .populate('owner', 'firstName lastName email avatar')
        .sort('-acceptedAt');
    } catch (error) {
      Logger.error('Error getting user teams', { error: error.message });
      throw error;
    }
  }

  // ========== VITAL TASK COLLABORATORS ==========
  
  /**
   * Add collaborator to vital task
   */
  async addVitalTaskCollaborator(data) {
    try {
      // Clean up any existing record (e.g. status='removed') to avoid unique index conflict
      await VitalTaskCollaborator.deleteOne({ vitalTask: data.vitalTask, collaborator: data.collaborator });

      const collaborator = await VitalTaskCollaborator.create(data);
      await collaborator.populate([
        { path: 'vitalTask' },
        { path: 'collaborator', select: 'firstName lastName email avatar' },
        { path: 'sharedBy', select: 'firstName lastName' }
      ]);
      
      Logger.info('Vital task collaborator added', {
        vitalTaskId: data.vitalTask,
        collaboratorId: data.collaborator,
        role: data.role,
      });
      
      return collaborator;
    } catch (error) {
      Logger.error('Error adding vital task collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Get vital task collaborators
   */
  async getVitalTaskCollaborators(vitalTaskId, status = 'active') {
    try {
      return await VitalTaskCollaborator.getVitalTaskCollaborators(vitalTaskId, status);
    } catch (error) {
      Logger.error('Error getting vital task collaborators', { error: error.message });
      throw error;
    }
  }

  /**
   * Find a specific vital task collaborator safely
   */
  async findVitalTaskCollaborator(vitalTaskId, collaboratorId) {
    try {
      return await VitalTaskCollaborator.findOne({
        vitalTask: vitalTaskId,
        $or: [{ collaborator: collaboratorId }, { _id: collaboratorId }],
        status: 'active'
      }).populate('collaborator', 'firstName lastName email avatar');
    } catch (error) {
      Logger.error('Error finding vital task collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's shared vital tasks
   */
  async getUserSharedVitalTasks(userId, status = 'active') {
    try {
      return await VitalTaskCollaborator.getUserSharedVitalTasks(userId, status);
    } catch (error) {
      Logger.error('Error getting user shared vital tasks', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if user can access vital task
   */
  async canUserAccessVitalTask(vitalTaskId, userId) {
    try {
      return await VitalTaskCollaborator.canUserAccessVitalTask(vitalTaskId, userId);
    } catch (error) {
      Logger.error('Error checking vital task access', { error: error.message });
      throw error;
    }
  }

  /**
   * Update vital task collaborator role
   */
  async updateVitalTaskCollaboratorRole(vitalTaskId, collaboratorId, newRole) {
    try {
      const collaboration = await VitalTaskCollaborator.findOne({
        vitalTask: vitalTaskId,
        $or: [{ collaborator: collaboratorId }, { _id: collaboratorId }],
        status: 'active'
      });
      
      if (!collaboration) return null;
      
      collaboration.role = newRole;
      await collaboration.save();
      
      Logger.info('Vital task collaborator role updated', {
        vitalTaskId,
        collaboratorId,
        newRole,
      });
      
      return collaboration;
    } catch (error) {
      Logger.error('Error updating vital task collaborator role', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove collaborator from vital task
   */
  async removeVitalTaskCollaborator(vitalTaskId, collaboratorId) {
    try {
      const collaboration = await VitalTaskCollaborator.findOne({
        vitalTask: vitalTaskId,
        $or: [{ collaborator: collaboratorId }, { _id: collaboratorId }],
        status: 'active'
      });
      
      if (!collaboration) return null;
      
      await collaboration.removeCollaborator();
      
      Logger.info('Vital task collaborator removed', {
        vitalTaskId,
        collaboratorId,
      });
      
      return collaboration;
    } catch (error) {
      Logger.error('Error removing vital task collaborator', { error: error.message });
      throw error;
    }
  }

  /**
   * Transfer vital task ownership
   */
  async transferVitalTaskOwnership(vitalTaskId, currentOwnerId, newOwnerId) {
    try {
      const vitalTask = await VitalTask.findOne({ _id: vitalTaskId, user: currentOwnerId });
      if (!vitalTask) return null;

      // Update vital task owner
      vitalTask.user = newOwnerId;
      await vitalTask.save();

      // Update current owner to editor
      const currentOwnerCollab = await VitalTaskCollaborator.findOne({
        vitalTask: vitalTaskId,
        collaborator: currentOwnerId
      });
      
      if (currentOwnerCollab) {
        currentOwnerCollab.role = 'editor';
        await currentOwnerCollab.save();
      } else {
        await VitalTaskCollaborator.create({
          vitalTask: vitalTaskId,
          taskOwner: newOwnerId,
          collaborator: currentOwnerId,
          role: 'editor',
          status: 'active',
          sharedBy: newOwnerId,
        });
      }

      // Update new owner to owner role
      await VitalTaskCollaborator.updateOne(
        { vitalTask: vitalTaskId, collaborator: newOwnerId },
        { 
          role: 'owner',
          taskOwner: newOwnerId 
        }
      );

      // Update all other collaborators' taskOwner field
      await VitalTaskCollaborator.updateMany(
        { vitalTask: vitalTaskId, collaborator: { $ne: newOwnerId } },
        { taskOwner: newOwnerId }
      );

      Logger.info('Vital task ownership transferred', {
        vitalTaskId,
        from: currentOwnerId,
        to: newOwnerId,
      });

      return vitalTask;
    } catch (error) {
      Logger.error('Error transferring vital task ownership', { error: error.message });
      throw error;
    }
  }

  // ========== VITAL TASK INVITATIONS ==========
  
  /**
   * Create vital task invitation
   */
  async createVitalTaskInvitation(data) {
    try {
      const invitation = await VitalTaskInvitation.create(data);
      await invitation.populate([
        { path: 'vitalTask' },
        { path: 'inviter', select: 'firstName lastName email avatar' },
        { path: 'inviteeUser', select: 'firstName lastName email avatar' }
      ]);
      
      Logger.info('Vital task invitation created', {
        invitationId: invitation._id,
        vitalTaskId: data.vitalTask,
        inviteeEmail: data.inviteeEmail,
      });
      
      return invitation;
    } catch (error) {
      Logger.error('Error creating vital task invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Find vital task invitation by ID
   */
  async findVitalTaskInvitationById(invitationId) {
    try {
      return await VitalTaskInvitation.findById(invitationId)
        .populate('vitalTask')
        .populate('inviter', 'firstName lastName email avatar');
    } catch (error) {
      Logger.error('Error finding vital task invitation by ID', { error: error.message });
      throw error;
    }
  }

  /**
   * Find vital task invitation by token
   */
  async findVitalTaskInvitationByToken(token) {
    try {
      return await VitalTaskInvitation.findByToken(token);
    } catch (error) {
      Logger.error('Error finding vital task invitation by token', { error: error.message });
      throw error;
    }
  }

  /**
   * Get pending invitations for a vital task
   */
  async getVitalTaskInvitations(vitalTaskId, status = 'pending') {
    try {
      return await VitalTaskInvitation.find({ vitalTask: vitalTaskId, status })
        .populate('inviteeUser', 'firstName lastName email avatar')
        .populate('inviter', 'firstName lastName')
        .sort('-invitedAt');
    } catch (error) {
      Logger.error('Error getting vital task invitations', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel vital task invitation
   */
  async cancelVitalTaskInvitation(invitationId) {
    try {
      const invitation = await (await import('../models/VitalTaskInvitation.js')).default.findById(invitationId);
      if (!invitation) return null;

      await invitation.cancel();
      Logger.info('Vital task invitation cancelled', { invitationId });
      return invitation;
    } catch (error) {
      Logger.error('Error cancelling vital task invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Get global unique collaborator emails for a user
   * (Across Teams, Tasks, and Vital Tasks)
   */
  async getGlobalCollaboratorEmails(userId) {
    try {
      const user = await User.findById(userId).select('email');
      const ownerEmail = user?.email?.toLowerCase();
      const now = new Date();

      // 1. Get Team Members (active & pending-unexpired)
      const teamMembers = await TeamMember.find({
        owner: userId,
        status: { $in: ['active', 'pending'] }
      }).select('memberEmail status tokenExpiresAt');

      // 2. Get Task Collaborators (active)
      const taskCollabs = await TaskCollaborator.find({
        taskOwner: userId,
        status: 'active'
      }).populate('collaborator', 'email');

      // 3. Get Task Invitations (pending-unexpired)
      const taskInvites = await TaskInvitation.find({
        inviter: userId,
        status: 'pending',
        expiresAt: { $gt: now }
      }).select('inviteeEmail');

      // 4. Get Vital Task Collaborators (active)
      const vitalCollabs = await VitalTaskCollaborator.find({
        taskOwner: userId,
        status: 'active'
      }).populate('collaborator', 'email');

      // 5. Get Vital Task Invitations (pending-unexpired)
      const vitalInvites = await VitalTaskInvitation.find({
        inviter: userId,
        status: 'pending',
        expiresAt: { $gt: now }
      }).select('inviteeEmail');

      const uniqueEmails = new Set();

      // Collect emails from TeamMembers
      teamMembers.forEach(tm => {
        // Only count if active OR pending and not expired
        const isPendingAndExpired = tm.status === 'pending' && tm.tokenExpiresAt && tm.tokenExpiresAt < now;
        if (tm.memberEmail && !isPendingAndExpired) {
          const email = tm.memberEmail.toLowerCase();
          if (email !== ownerEmail) {
            uniqueEmails.add(email);
          }
        }
      });

      // Collect emails from Task Collaborators
      taskCollabs.forEach(tc => {
        if (tc.collaborator && tc.collaborator.email) {
          const email = tc.collaborator.email.toLowerCase();
          if (email !== ownerEmail) {
            uniqueEmails.add(email);
          }
        }
      });

      // Collect emails from Task Invitations
      taskInvites.forEach(ti => {
        if (ti.inviteeEmail) {
          const email = ti.inviteeEmail.toLowerCase();
          if (email !== ownerEmail) {
            uniqueEmails.add(email);
          }
        }
      });

      // Collect emails from Vital Task Collaborators
      vitalCollabs.forEach(vc => {
        if (vc.collaborator && vc.collaborator.email) {
          const email = vc.collaborator.email.toLowerCase();
          if (email !== ownerEmail) {
            uniqueEmails.add(email);
          }
        }
      });

      // Collect emails from Vital Task Invitations
      vitalInvites.forEach(vi => {
        if (vi.inviteeEmail) {
          const email = vi.inviteeEmail.toLowerCase();
          if (email !== ownerEmail) {
            uniqueEmails.add(email);
          }
        }
      });

      return uniqueEmails;
    } catch (error) {
      Logger.error('Error getting global unique collaborator emails', { error: error.message });
      return new Set();
    }
  }
}

export default new CollaborationRepository();