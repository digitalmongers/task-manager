import TeamService from '../services/TeamService.js';
import ApiResponse from '../utils/ApiResponse.js';

class TeamController {
  /**
   * Invite team member
   * POST /api/team/invite
   */
  async inviteTeamMember(req, res) {
    const userId = req.user._id;
    const { email, role, message } = req.body;

    const result = await TeamService.inviteTeamMember(
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
   * Get team members
   * GET /api/team/members
   */
  async getTeamMembers(req, res) {
    const userId = req.user._id;
    const { status } = req.query;

    const result = await TeamService.getTeamMembers(userId, status);

    ApiResponse.success(res, 200, 'Team members fetched successfully', {
      members: result.members,
      pending: result.pending,
    });
  }

  /**
   * Accept team invitation
   * POST /api/team/accept/:token
   */
  async acceptInvitation(req, res) {
    const userId = req.user ? req.user._id : null;
    const { token } = req.params;

    const result = await TeamService.acceptTeamInvitation(token, userId);

    ApiResponse.success(res, 200, result.message, {
      teamMember: result.teamMember,
    });
  }

  /**
   * Decline team invitation
   * POST /api/team/decline/:token
   */
  async declineInvitation(req, res) {
    const { token } = req.params;

    const result = await TeamService.declineTeamInvitation(token);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Remove team member
   * DELETE /api/team/members/:memberId
   */
  async removeTeamMember(req, res) {
    const userId = req.user._id;
    const { memberId } = req.params;

    const result = await TeamService.removeTeamMember(userId, memberId);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Update member role
   * PATCH /api/team/members/:memberId/role
   */
  async updateMemberRole(req, res) {
    const userId = req.user._id;
    const { memberId } = req.params;
    const { role } = req.body;

    const result = await TeamService.updateMemberRole(userId, memberId, role);

    ApiResponse.success(res, 200, result.message, {
      member: result.member,
    });
  }

  /**
   * Get my teams (where I'm a member)
   * GET /api/team/my-teams
   */
  async getMyTeams(req, res) {
    const userId = req.user._id;

    const result = await TeamService.getMyTeams(userId);

    ApiResponse.success(res, 200, 'Teams fetched successfully', {
      teams: result.teams,
    });
  }

  /**
   * Cancel pending invitation
   * DELETE /api/team/invitations/:invitationId
   */
  async cancelInvitation(req, res) {
    const userId = req.user._id;
    const { invitationId } = req.params;

    const result = await TeamService.cancelInvitation(userId, invitationId);

    ApiResponse.success(res, 200, result.message);
  }
}

export default new TeamController();