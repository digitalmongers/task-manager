import CollaborationRepository from '../repositories/collaborationRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * Permission levels for tasks
 */
export const PERMISSIONS = {
  OWNER: ['view', 'edit', 'delete', 'share', 'transfer', 'manage_collaborators'],
  EDITOR: ['view', 'edit', 'share'],
  ASSIGNEE: ['view', 'edit'],
  VIEWER: ['view'],
};

/**
 * Check if user can access task
 */
export const canAccessTask = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const taskId = req.params.taskId || req.params.id;

    if (!taskId) {
      return next(ApiError.badRequest('Task ID is required'));
    }

    const access = await CollaborationRepository.canUserAccessTask(taskId, userId);

    if (!access.canAccess) {
      Logger.logSecurity('UNAUTHORIZED_TASK_ACCESS_ATTEMPT', {
        userId,
        taskId,
        ip: req.ip,
      });
      return next(ApiError.forbidden('You do not have access to this task'));
    }

    // Attach permission info to request
    req.taskAccess = {
      role: access.role,
      isOwner: access.isOwner,
      permissions: PERMISSIONS[access.role.toUpperCase()] || [],
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has specific permission
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.taskAccess) {
      return next(ApiError.forbidden('Task access not verified'));
    }

    const hasPermission = req.taskAccess.permissions.includes(permission);

    if (!hasPermission) {
      Logger.logSecurity('INSUFFICIENT_TASK_PERMISSIONS', {
        userId: req.user._id,
        taskId: req.params.taskId || req.params.id,
        requiredPermission: permission,
        userRole: req.taskAccess.role,
        ip: req.ip,
      });

      return next(
        ApiError.forbidden(`You need '${permission}' permission to perform this action`)
      );
    }

    next();
  };
};

/**
 * Check if user is task owner
 */
export const requireOwner = (req, res, next) => {
  if (!req.taskAccess || !req.taskAccess.isOwner) {
    Logger.logSecurity('NON_OWNER_TASK_ACTION_ATTEMPT', {
      userId: req.user._id,
      taskId: req.params.taskId || req.params.id,
      userRole: req.taskAccess?.role,
      ip: req.ip,
    });

    return next(ApiError.forbidden('Only task owner can perform this action'));
  }

  next();
};

/**
 * Check if user can edit task
 */
export const canEditTask = [
  canAccessTask,
  requirePermission('edit'),
];

/**
 * Check if user can delete task
 */
export const canDeleteTask = [
  canAccessTask,
  requirePermission('delete'),
];

/**
 * Check if user can share task
 */
export const canShareTask = [
  canAccessTask,
  requirePermission('share'),
];

/**
 * Check if user can manage collaborators
 */
export const canManageCollaborators = [
  canAccessTask,
  requirePermission('manage_collaborators'),
];

export default {
  canAccessTask,
  requirePermission,
  requireOwner,
  canEditTask,
  canDeleteTask,
  canShareTask,
  canManageCollaborators,
  PERMISSIONS,
};