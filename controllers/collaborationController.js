import CollaborationService from '../services/collaborationService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { formatToLocal } from '../utils/dateUtils.js';

class CollaborationController {
  /**
   * Invite user to task (via email)
   * POST /api/tasks/:taskId/collaborators/invite
   */
  async inviteToTask(req, res) {
    const userId = req.user._id;
    const { taskId } = req.params;
    const { email, role, message } = req.body;

    const result = await CollaborationService.inviteToTask(
      taskId,
      userId,
      email,
      role,
      message
    );

    ApiResponse.success(res, 201, result.message, {
      invitation: result.invitation,
    });
  }

  /**
   * Share task with team members
   * POST /api/tasks/:taskId/share-with-team
   */
  async shareWithTeamMembers(req, res) {
    const userId = req.user._id;
    const { taskId } = req.params;
    const { memberIds } = req.body;

    const result = await CollaborationService.shareTaskWithTeamMembers(
      taskId,
      userId,
      memberIds
    );

    ApiResponse.success(res, 200, result.message, {
      success: result.success,
      errors: result.errors,
    });
  }

  /**
   * Get team members available for sharing
   * GET /api/tasks/:taskId/available-team-members
   */
  async getAvailableTeamMembers(req, res) {
    const userId = req.user._id;
    const { taskId } = req.params;

    const result = await CollaborationService.getTeamMembersForSharing(
      userId,
      taskId
    );

    ApiResponse.success(res, 200, 'Available team members fetched', {
      availableMembers: result.availableMembers,
      alreadyShared: result.alreadyShared,
    });
  }

  /**
   * Accept task invitation
   * POST /api/collaborations/invitations/:token/accept
   */
  async acceptInvitation(req, res) {
    const userId = req.user ? req.user._id : null;
    const { token } = req.params;

    const result = await CollaborationService.acceptInvitation(token, userId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
      collaborator: result.collaborator,
    });
  }

  /**
   * Decline task invitation
   * POST /api/collaborations/invitations/:token/decline
   */
  async declineInvitation(req, res) {
    const userId = req.user?._id; // Optional auth
    const { token } = req.params;

    const result = await CollaborationService.declineInvitation(token, userId);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Cancel invitation
   * DELETE /api/tasks/:taskId/invitations/:invitationId
   */
  async cancelInvitation(req, res) {
    const userId = req.user._id;
    const { invitationId } = req.params;

    const result = await CollaborationService.cancelInvitation(invitationId, userId);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Get task invitations
   * GET /api/tasks/:taskId/invitations
   */
  async getTaskInvitations(req, res) {
    const userId = req.user._id;
    const { taskId } = req.params;

    const result = await CollaborationService.getTaskInvitations(taskId, userId);

    // Localize timestamps
    const localizedInvitations = result.invitations.map(inv => {
      const i = inv.toObject ? inv.toObject() : inv;
      return {
        ...i,
        expiresAtLocal: i.expiresAt ? formatToLocal(i.expiresAt, req.timezone) : null,
        createdAtLocal: i.createdAt ? formatToLocal(i.createdAt, req.timezone) : null,
      };
    });

    ApiResponse.success(res, 200, 'Invitations fetched successfully', {
      invitations: localizedInvitations,
    });
  }

  /**
   * Get task collaborators
   * GET /api/tasks/:taskId/collaborators
   */
  async getTaskCollaborators(req, res) {
    const userId = req.user._id;
    const { taskId } = req.params;

    const result = await CollaborationService.getTaskCollaborators(taskId, userId);

    // Localize timestamps
    const localizedCollaborators = result.collaborators.map(collab => {
      const c = collab.toObject ? collab.toObject() : collab;
      return {
        ...c,
        joinedAtLocal: c.joinedAt ? formatToLocal(c.joinedAt, req.timezone) : null,
        createdAtLocal: c.createdAt ? formatToLocal(c.createdAt, req.timezone) : null,
      };
    });

    ApiResponse.success(res, 200, 'Collaborators fetched successfully', {
      collaborators: localizedCollaborators,
      userRole: result.userRole,
      isOwner: result.isOwner,
    });
  }

  /**
   * Update collaborator role
   * PATCH /api/tasks/:taskId/collaborators/:collaboratorId/role
   */
  async updateCollaboratorRole(req, res) {
    const userId = req.user._id;
    const { taskId, collaboratorId } = req.params;
    const { role } = req.body;

    const result = await CollaborationService.updateCollaboratorRole(
      taskId,
      collaboratorId,
      role,
      userId
    );

    ApiResponse.success(res, 200, result.message, {
      collaboration: result.collaboration,
    });
  }

  /**
   * Remove collaborator
   * DELETE /api/tasks/:taskId/collaborators/:collaboratorId
   */
  async removeCollaborator(req, res) {
    const userId = req.user._id;
    const { taskId, collaboratorId } = req.params;

    const result = await CollaborationService.removeCollaborator(
      taskId,
      collaboratorId,
      userId
    );

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Transfer task ownership
   * POST /api/tasks/:taskId/transfer-ownership
   */
  async transferOwnership(req, res) {
    const userId = req.user._id;
    const { taskId } = req.params;
    const { newOwnerId } = req.body;

    const result = await CollaborationService.transferOwnership(
      taskId,
      newOwnerId,
      userId
    );

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }

  /**
   * Get user's shared tasks
   * GET /api/collaborations/shared-tasks
   */
  async getUserSharedTasks(req, res) {
    const userId = req.user._id;

    const result = await CollaborationService.getUserSharedTasks(userId);

    // Localize timestamps
    const localizedSharedTasks = result.sharedTasks.map(task => {
      const t = task.toObject ? task.toObject() : task;
      return {
        ...t,
        sharedAtLocal: t.sharedAt ? formatToLocal(t.sharedAt, req.timezone) : null,
        createdAtLocal: t.createdAt ? formatToLocal(t.createdAt, req.timezone) : null,
      };
    });

    ApiResponse.success(res, 200, 'Shared tasks fetched successfully', {
      sharedTasks: localizedSharedTasks,
    });
  }

  /**
   * Generate shareable link
   * POST /api/tasks/:taskId/share-link
   */
  async generateShareLink(req, res) {
    const userId = req.user._id;
    const { taskId } = req.params;

    const result = await CollaborationService.generateShareLink(taskId, userId);

    ApiResponse.success(res, 200, 'Share link generated', {
      shareLink: result.shareLink,
      expiresAt: result.expiresAt,
    });
  }

  /**
   * Access task via share link
   * GET /api/tasks/shared/:token
   */
  async accessViaShareLink(req, res) {
    const userId = req.user._id;
    const { token } = req.params;

    const result = await CollaborationService.accessTaskViaShareLink(token, userId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
      alreadyMember: result.alreadyMember,
    });
  }
}

export default new CollaborationController();