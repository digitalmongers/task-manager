import CollaborationRepository from '../repositories/collaborationRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

/**
 * Permission levels for vital tasks
 */
export const PERMISSIONS = {
  OWNER: ['view', 'edit', 'delete', 'share', 'transfer', 'manage_collaborators'],
  EDITOR: ['view', 'edit', 'share'],
  ASSIGNEE: ['view', 'edit'],
  VIEWER: ['view'],
};

/**
 * Check if user can access vital task
 */
export const canAccessVitalTask = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const vitalTaskId = req.params.vitalTaskId || req.params.id;

    if (!vitalTaskId) {
      return next(ApiError.badRequest('Vital Task ID is required'));
    }

    const access = await CollaborationRepository.canUserAccessVitalTask(vitalTaskId, userId);

    if (!access.canAccess) {
      Logger.logSecurity('UNAUTHORIZED_VITAL_TASK_ACCESS_ATTEMPT', {
        userId,
        vitalTaskId,
        ip: req.ip,
      });
      return next(ApiError.forbidden('You do not have access to this vital task'));
    }

    // Attach permission info to request
    req.vitalTaskAccess = {
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
    if (!req.vitalTaskAccess) {
      return next(ApiError.forbidden('Vital task access not verified'));
    }

    const hasPermission = req.vitalTaskAccess.permissions.includes(permission);

    if (!hasPermission) {
      Logger.logSecurity('INSUFFICIENT_VITAL_TASK_PERMISSIONS', {
        userId: req.user._id,
        vitalTaskId: req.params.vitalTaskId || req.params.id,
        requiredPermission: permission,
        userRole: req.vitalTaskAccess.role,
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
 * Check if user is vital task owner
 */
export const requireOwner = (req, res, next) => {
  if (!req.vitalTaskAccess || !req.vitalTaskAccess.isOwner) {
    Logger.logSecurity('NON_OWNER_VITAL_TASK_ACTION_ATTEMPT', {
      userId: req.user._id,
      vitalTaskId: req.params.vitalTaskId || req.params.id,
      userRole: req.vitalTaskAccess?.role,
      ip: req.ip,
    });

    return next(ApiError.forbidden('Only vital task owner can perform this action'));
  }

  next();
};

/**
 * Check if user can edit vital task
 */
export const canEditVitalTask = [
  canAccessVitalTask,
  requirePermission('edit'),
];

/**
 * Check if user can delete vital task
 */
export const canDeleteVitalTask = [
  canAccessVitalTask,
  requirePermission('delete'),
];

/**
 * Check if user can share vital task
 */
export const canShareVitalTask = [
  canAccessVitalTask,
  requirePermission('share'),
];

/**
 * Check if user can manage collaborators
 */
export const canManageCollaborators = [
  canAccessVitalTask,
  requirePermission('manage_collaborators'),
];

export default {
  canAccessVitalTask,
  requirePermission,
  requireOwner,
  canEditVitalTask,
  canDeleteVitalTask,
  canShareVitalTask,
  canManageCollaborators,
  PERMISSIONS,
};
