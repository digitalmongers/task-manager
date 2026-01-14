import VitalTaskCollaborationService from '../services/vitalTaskCollaborationService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { formatToLocal } from '../utils/dateUtils.js';

class VitalTaskCollaborationController {
  /**
   * Invite user to vital task (via email)
   * POST /api/vital-tasks/:vitalTaskId/collaborators/invite
   */
  async inviteToVitalTask(req, res) {
    const userId = req.user._id;
    const { vitalTaskId } = req.params;
    const { email, role, message } = req.body;

    const result = await VitalTaskCollaborationService.inviteToVitalTask(
      vitalTaskId,
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
   * Share vital task with team members
   * POST /api/vital-tasks/:vitalTaskId/share-with-team
   */
  async shareWithTeamMembers(req, res) {
    const userId = req.user._id;
    const { vitalTaskId } = req.params;
    const { memberIds } = req.body;

    const result = await VitalTaskCollaborationService.shareVitalTaskWithTeamMembers(
      vitalTaskId,
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
   * GET /api/vital-tasks/:vitalTaskId/available-team-members
   */
  async getAvailableTeamMembers(req, res) {
    const userId = req.user._id;
    const { vitalTaskId } = req.params;

    const result = await VitalTaskCollaborationService.getTeamMembersForSharing(
      userId,
      vitalTaskId
    );

    ApiResponse.success(res, 200, 'Available team members fetched', {
      availableMembers: result.availableMembers,
      alreadyShared: result.alreadyShared,
    });
  }

  /**
   * Accept vital task invitation
   * POST /api/vital-task-invitations/:token/accept
   */
  async acceptInvitation(req, res) {
    const userId = req.user ? req.user._id : null;
    const { token } = req.params;

    const result = await VitalTaskCollaborationService.acceptInvitation(token, userId);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
      collaborator: result.collaborator,
    });
  }

  /**
   * Decline vital task invitation
   * POST /api/vital-task-invitations/:token/decline
   */
  async declineInvitation(req, res) {
    const userId = req.user?._id; // Optional auth
    const { token } = req.params;

    const result = await VitalTaskCollaborationService.declineInvitation(token, userId);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Cancel invitation
   * DELETE /api/vital-tasks/:vitalTaskId/invitations/:invitationId
   */
  async cancelInvitation(req, res) {
    const userId = req.user._id;
    const { invitationId } = req.params;

    const result = await VitalTaskCollaborationService.cancelInvitation(invitationId, userId);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Get vital task invitations
   * GET /api/vital-tasks/:vitalTaskId/invitations
   */
  async getVitalTaskInvitations(req, res) {
    const userId = req.user._id;
    const { vitalTaskId } = req.params;

    const result = await VitalTaskCollaborationService.getVitalTaskInvitations(vitalTaskId, userId);

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
   * Get vital task collaborators
   * GET /api/vital-tasks/:vitalTaskId/collaborators
   */
  async getVitalTaskCollaborators(req, res) {
    const userId = req.user._id;
    const { vitalTaskId } = req.params;

    const result = await VitalTaskCollaborationService.getVitalTaskCollaborators(vitalTaskId, userId);

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
   * PATCH /api/vital-tasks/:vitalTaskId/collaborators/:collaboratorId/role
   */
  async updateCollaboratorRole(req, res) {
    const userId = req.user._id;
    const { vitalTaskId, collaboratorId } = req.params;
    const { role } = req.body;

    const result = await VitalTaskCollaborationService.updateCollaboratorRole(
      vitalTaskId,
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
   * DELETE /api/vital-tasks/:vitalTaskId/collaborators/:collaboratorId
   */
  async removeCollaborator(req, res) {
    const userId = req.user._id;
    const { vitalTaskId, collaboratorId } = req.params;

    const result = await VitalTaskCollaborationService.removeCollaborator(
      vitalTaskId,
      collaboratorId,
      userId
    );

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Transfer vital task ownership
   * POST /api/vital-tasks/:vitalTaskId/transfer-ownership
   */
  async transferOwnership(req, res) {
    const userId = req.user._id;
    const { vitalTaskId } = req.params;
    const { newOwnerId } = req.body;

    const result = await VitalTaskCollaborationService.transferOwnership(
      vitalTaskId,
      newOwnerId,
      userId
    );

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }

  /**
   * Get user's shared vital tasks
   * GET /api/shared-vital-tasks
   */
  async getUserSharedVitalTasks(req, res) {
    const userId = req.user._id;

    const result = await VitalTaskCollaborationService.getUserSharedVitalTasks(userId);

    // Localize timestamps
    const localizedSharedVitalTasks = result.sharedVitalTasks.map(task => {
      const t = task.toObject ? task.toObject() : task;
      return {
        ...t,
        sharedAtLocal: t.sharedAt ? formatToLocal(t.sharedAt, req.timezone) : null,
        createdAtLocal: t.createdAt ? formatToLocal(t.createdAt, req.timezone) : null,
      };
    });

    ApiResponse.success(res, 200, 'Shared vital tasks fetched successfully', {
      sharedVitalTasks: localizedSharedVitalTasks,
    });
  }

  /**
   * Generate shareable link
   * POST /api/vital-tasks/:vitalTaskId/share-link
   */
  async generateShareLink(req, res) {
    const userId = req.user._id;
    const { vitalTaskId } = req.params;

    const result = await VitalTaskCollaborationService.generateShareLink(vitalTaskId, userId);

    ApiResponse.success(res, 200, 'Share link generated', {
      shareLink: result.shareLink,
      expiresAt: result.expiresAt,
    });
  }

  /**
   * Access vital task via share link
   * GET /api/vital-tasks/shared/:token
   */
  async accessViaShareLink(req, res) {
    const userId = req.user._id;
    const { token } = req.params;

    const result = await VitalTaskCollaborationService.accessVitalTaskViaShareLink(token, userId);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
      alreadyMember: result.alreadyMember,
    });
  }
}

export default new VitalTaskCollaborationController();
