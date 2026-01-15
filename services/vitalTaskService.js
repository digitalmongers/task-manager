import VitalTaskRepository from '../repositories/vitalTaskRepository.js';
import CategoryRepository from '../repositories/categoryRepository.js';
import TaskPriorityRepository from '../repositories/taskPriorityRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';
import CollaborationRepository from '../repositories/collaborationRepository.js';
import VitalTask from '../models/VitalTask.js';
import NotificationService from '../services/notificationService.js';

class VitalTaskService {
  /**
   * Create new vital task
   */
  async createVitalTask(userId, taskData, file) {
    try {
      const { title, description, dueDate, priority, status, category, isCompleted, steps } = taskData;

      // Verify category belongs to user (if provided)
      if (category) {
        const categoryExists = await CategoryRepository.findByIdAndUser(category, userId);
        if (!categoryExists) {
          throw ApiError.badRequest('Invalid category or category does not belong to you');
        }
      }


      // Verify priority belongs to user (if provided)
      if (priority) {
        const priorityExists = await TaskPriorityRepository.findByIdAndUser(priority, userId);
        if (!priorityExists) {
          throw ApiError.badRequest('Invalid priority or priority does not belong to you');
        }
      }

      // Parse steps using robust logic (handles stringified JSON, real arrays, or mixed)
      const parsedSteps = this._parseSteps(steps);
      Logger.debug('Parsed steps for vital task creation', { count: parsedSteps.length });

      // Create vital task
      const vitalTask = await VitalTaskRepository.createVitalTask(
        {
          title,
          description: description || null,
          dueDate: dueDate || null,
          priority: priority || null,
          status: status || 'Not Started',
          category: category || null,
          isCompleted: isCompleted || false,
          steps: parsedSteps,
        },
        userId
      );

      // Handle image upload if file exists
      if (file) {
        await this.handleImageUpload(userId, vitalTask._id, file);
        // Refetch to get updated image
        const updatedVitalTask = await VitalTaskRepository.findByIdAndUser(vitalTask._id, userId);
        
        Logger.logAuth('VITAL_TASK_CREATED_WITH_IMAGE', userId, {
          vitalTaskId: vitalTask._id,
          title: vitalTask.title,
        });

        return {
          vitalTask: updatedVitalTask,
          message: 'Vital task created successfully',
        };
      }

      Logger.logAuth('VITAL_TASK_CREATED', userId, {
        vitalTaskId: vitalTask._id,
        title: vitalTask.title,
      });

      return {
        vitalTask,
        message: 'Vital task created successfully',
      };
    } catch (error) {
      Logger.error('Error in createVitalTask service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all vital tasks for user with filters (owned + shared)
   */
  async getAllVitalTasks(userId, filters = {}) {
    try {
      // Get owned vital tasks
      const ownedTasksResult = await VitalTaskRepository.findByUser(userId, {}, filters);
      
      // Get shared vital tasks (vital tasks where user is collaborator)
      const sharedTasks = await VitalTask.getSharedTasks(userId);
      
      // Apply filters to shared tasks if needed
      let filteredSharedTasks = sharedTasks;
      if (filters.category) {
        filteredSharedTasks = sharedTasks.filter(t => 
          t.category && t.category._id.toString() === filters.category
        );
      }
      if (filters.status) {
        filteredSharedTasks = filteredSharedTasks.filter(t => 
          t.status === filters.status
        );
      }
      if (filters.priority) {
        filteredSharedTasks = filteredSharedTasks.filter(t => 
          t.priority && t.priority._id.toString() === filters.priority
        );
      }
      if (filters.isCompleted !== undefined) {
        const completed = filters.isCompleted === 'true' || filters.isCompleted === true;
        filteredSharedTasks = filteredSharedTasks.filter(t => t.isCompleted === completed);
      }

      // Combine both lists
      const allTasks = [
        ...ownedTasksResult.vitalTasks.map(task => ({
          ...task.toObject(),
          isOwner: true,
          userRole: 'owner',
        })),
        ...filteredSharedTasks.map(task => ({
          ...task,
          isOwner: false,
        }))
      ];

      // Sort by most recent
      allTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTasks = allTasks.slice(startIndex, endIndex);

      return {
        vitalTasks: paginatedTasks,
        pagination: {
          total: allTasks.length,
          page,
          limit,
          pages: Math.ceil(allTasks.length / limit),
        },
        stats: {
          owned: ownedTasksResult.vitalTasks.length,
          shared: filteredSharedTasks.length,
          total: allTasks.length,
        }
      };
    } catch (error) {
      Logger.error('Error in getAllVitalTasks service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get single vital task by ID
   */
  async getVitalTaskById(userId, taskId) {
    try {
      // First check if user owns the vital task
      let vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);
      let isOwner = true;
      let userRole = 'owner';

      // If not owner, check if user is collaborator
      if (!vitalTask) {
        const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
        
        if (!access.canAccess) {
          throw ApiError.notFound('Vital task not found or you do not have access');
        }

        // User is collaborator, fetch vital task
        vitalTask = await VitalTask.findById(taskId)
          .populate('category', 'title color')
          .populate('priority', 'name color')
          .populate('priority', 'name color')
          .populate('user', 'firstName lastName email avatar')
          .populate('reviewRequestedBy', 'firstName lastName email avatar');
        
        isOwner = false;
        userRole = access.role;
      }

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      // Get collaborators if vital task is shared
      let collaborators = [];
      if (vitalTask.isShared) {
        const collabs = await CollaborationRepository.getVitalTaskCollaborators(taskId, 'active');
        collaborators = collabs.map(c => ({
          _id: c._id,
          user: c.collaborator,
          role: c.role,
          addedAt: c.createdAt,
        }));
      }

      return { 
        vitalTask: {
          ...vitalTask.toObject(),
          isOwner,
          userRole,
          collaborators,
        }
      };
    } catch (error) {
      Logger.error('Error in getVitalTaskById service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Update vital task
   */
  async updateVitalTask(userId, taskId, updateData, file) {
    try {
      // Check access permission
      let vitalTask;
      const ownedTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);
      
      if (ownedTask) {
        vitalTask = ownedTask;
      } else {
        // Check collaborator access
        const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
        if (access.role === 'viewer') {
          throw ApiError.forbidden('You do not have permission to edit this vital task');
        }
        vitalTask = await VitalTask.findById(taskId);

        if (updateData.isCompleted) {
           if (access.role === 'viewer' || access.role === 'assignee') {
               throw ApiError.forbidden('You cannot complete this vital task directly. Please request a review.');
           }
           // If completing, clear review flags
           vitalTask.reviewRequestedBy = null;
           vitalTask.reviewRequestedAt = null;
        }
      }

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      // Verify category belongs to task owner (if being updated)
      if (updateData.category) {
        const categoryExists = await CategoryRepository.findByIdAndUser(
          updateData.category,
          vitalTask.user
        );
        if (!categoryExists) {
          throw ApiError.badRequest('Invalid category or category does not belong to task owner');
        }
      }


      // Verify priority belongs to task owner (if being updated)
      if (updateData.priority) {
        const priorityExists = await TaskPriorityRepository.findByIdAndUser(
          updateData.priority,
          vitalTask.user
        );
        if (!priorityExists) {
          throw ApiError.badRequest('Invalid priority or priority does not belong to task owner');
        }
      }

      // Auto-update status based on isCompleted
      if (updateData.isCompleted !== undefined) {
        if (updateData.isCompleted) {
           updateData.status = 'Completed';
        } else if (!updateData.status) {
           // Only default to 'In Progress' if no explicit status is provided
           updateData.status = 'In Progress';
        }
      }

      // Robust steps parsing for updates
      if (updateData.steps) {
        if (typeof updateData.steps === 'string') {
          try {
            const parsed = JSON.parse(updateData.steps);
            updateData.steps = Array.isArray(parsed) ? parsed : [parsed];
          } catch (e) {
            // Keep as is
          }
        } else if (Array.isArray(updateData.steps)) {
          updateData.steps = updateData.steps.map(s => {
            if (typeof s === 'string') {
              try { return JSON.parse(s); } catch (e) { return s; }
            }
            return s;
          });
        }
      }

      // Update vital task using set()
      vitalTask.set(updateData);
      await vitalTask.save();
      
      // Populate
      await vitalTask.populate([
        { path: 'category', select: 'title color' },
        { path: 'status', select: 'name color' },
        { path: 'priority', select: 'name color' },
      ]);

      // Handle image upload if file exists
      if (file) {
        await this.handleImageUpload(userId, taskId, file);
        vitalTask = await VitalTask.findById(taskId)
          .populate('category', 'title color')
          .populate('priority', 'name color');
      }

      Logger.logAuth('VITAL_TASK_UPDATED', userId, {
        vitalTaskId: vitalTask._id,
        updatedFields: Object.keys(updateData),
      });

      return {
        vitalTask,
        message: 'Vital task updated successfully',
      };
    } catch (error) {
      Logger.error('Error in updateVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Delete vital task (only owner can delete)
   */
  async deleteVitalTask(userId, taskId) {
    try {
      // Only owner can delete vital task
      const vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found or you do not have permission to delete');
      }

      // Delete image from cloudinary if exists
      if (vitalTask.image?.publicId) {
        await cloudinary.uploader.destroy(vitalTask.image.publicId).catch((error) => {
          Logger.warn('Failed to delete vital task image from cloudinary', {
            taskId,
            publicId: vitalTask.image.publicId,
            error: error.message,
          });
        });
      }

      // Notification: Notify all collaborators (including owner if not deleter)
      let recipients = [];
      if (vitalTask.isShared) {
         const collaborators = await CollaborationRepository.getVitalTaskCollaborators(taskId, 'active');
         recipients = collaborators.map(c => c.collaborator._id);
      }
      if (vitalTask.user && vitalTask.user.toString() !== userId.toString() && !recipients.some(id => id.toString() === vitalTask.user.toString())) {
         recipients.push(vitalTask.user);
      }
      
      const deleter = await (await import('../models/User.js')).default.findById(userId);
      recipients = recipients.filter(id => id.toString() !== userId.toString());
      
      if (recipients.length > 0) {
        await NotificationService.notifyVitalTaskDeleted(vitalTask.title, deleter, recipients);
      }

      // Delete all collaborations
      if (vitalTask.isShared) {
        const VitalTaskCollaborator = (await import('../models/VitalTaskCollaborator.js')).default;
        await VitalTaskCollaborator.deleteMany({ vitalTask: taskId });
      }

      // Soft delete vital task
      await VitalTaskRepository.deleteVitalTask(taskId, userId);

      Logger.logAuth('VITAL_TASK_DELETED', userId, {
        vitalTaskId: taskId,
        title: vitalTask.title,
      });

      return {
        message: 'Vital task deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Toggle vital task completion
   */
  async toggleComplete(userId, taskId) {
    try {
      // Try as owner first
      let vitalTask = await VitalTaskRepository.toggleComplete(taskId, userId);

      // If not owner, check collaborator access
      if (!vitalTask) {
        const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
        if (access.role === 'viewer') {
          throw ApiError.forbidden('You do not have permission to modify this vital task');
        }
        
        // Fetch and toggle manually
        vitalTask = await VitalTask.findById(taskId);
        if (!vitalTask) {
          throw ApiError.notFound('Vital task not found');
        }
        
        if (vitalTask.isCompleted) {
           if (access.role === 'assignee') {
               throw ApiError.forbidden('You cannot change completion status directly. Please request a review.');
           }
          await vitalTask.markIncomplete();
        } else {
           if (access.role === 'assignee') {
               throw ApiError.forbidden('You cannot complete this vital task directly. Please request a review.');
           }
          await vitalTask.markComplete();
          // Clear review flags
          vitalTask.reviewRequestedBy = null;
          vitalTask.reviewRequestedAt = null;
          await vitalTask.save();
        }
        
        await vitalTask.populate([
          { path: 'category', select: 'title color' },
          { path: 'status', select: 'name color' },
          { path: 'priority', select: 'name color' },
        ]);
      }

      Logger.logAuth('VITAL_TASK_COMPLETION_TOGGLED', userId, {
        vitalTaskId: taskId,
        isCompleted: vitalTask.isCompleted,
      });

      // Notification: Notify collaborators if completed
      if (vitalTask.isCompleted) {
        // Fetch collaborators
        const collaborators = await CollaborationRepository.getVitalTaskCollaborators(taskId, 'active');
        const recipientIds = collaborators.map(c => c.collaborator._id || c.collaborator);
        
        // Add owner if needed
        if (vitalTask.user && !recipientIds.some(id => id.toString() === vitalTask.user.toString())) {
             recipientIds.push(vitalTask.user);
        }
        
        // Filter out the person who completed it
        const finalRecipients = recipientIds.filter(id => id.toString() !== userId.toString());

        if (finalRecipients.length > 0) {
          const completer = await (await import('../models/User.js')).default.findById(userId);
          await NotificationService.notifyVitalTaskCompleted(vitalTask, completer, finalRecipients);
        }
      }

      return {
        vitalTask,
        message: vitalTask.isCompleted ? 'Vital task marked as completed' : 'Vital task marked as incomplete',
      };
    } catch (error) {
      Logger.error('Error in toggleComplete service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }


  /**
   * Start vital task (change status to In Progress)
   * Accessible by Owner, Editor, Assignee, and Viewer
   */
  async startVitalTask(userId, taskId) {
    try {
      // Check access permission
      let vitalTask;
      
      const ownedTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);
      
      if (ownedTask) {
        vitalTask = ownedTask;
      } else {
        // Check collaborator access
        const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
        if (!access.canAccess) {
          throw ApiError.forbidden('You do not have permission to access this vital task');
        }
        
        // Explicitly allow ALL roles to start
        vitalTask = await VitalTask.findById(taskId);
      }

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      // Update status and start details
      vitalTask.status = 'In Progress';
      vitalTask.startedBy = userId;
      vitalTask.startedAt = new Date();
      
      if (vitalTask.isCompleted) {
          vitalTask.isCompleted = false;
          vitalTask.completedAt = null;
      }

      await vitalTask.save();
      
      // Populate for response
      await vitalTask.populate([
        { path: 'category', select: 'title color' },
        { path: 'status', select: 'name color' },
        { path: 'priority', select: 'name color' },
        { path: 'startedBy', select: 'firstName lastName email avatar role' }
      ]);

      Logger.logAuth('VITAL_TASK_STARTED', userId, {
        vitalTaskId: vitalTask._id,
        startedAt: vitalTask.startedAt
      });

      return {
        vitalTask,
        message: 'Vital task started successfully',
      };
    } catch (error) {
       Logger.error('Error in startVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Helper to handle image upload
   */
  async handleImageUpload(userId, taskId, file) {
    try {
      // Check access
      const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
      const isOwner = access.isOwner;
      
      let vitalTask;
      if (isOwner) {
        vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);
      } else {
        const VitalTask = (await import('../models/VitalTask.js')).default;
        vitalTask = await VitalTask.findById(taskId);
      }

      // Delete old image if exists
      if (vitalTask.image?.publicId) {
        await cloudinary.uploader.destroy(vitalTask.image.publicId).catch((error) => {
          Logger.warn('Failed to delete old vital task image', {
            taskId,
            publicId: vitalTask.image.publicId,
            error: error.message,
          });
        });
      }

      // Upload new image
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'task-manager/vital-tasks',
            resource_type: 'image',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(stream);
      });

      // Update vital task with new image
      let updatedVitalTask;
      if (isOwner) {
        updatedVitalTask = await VitalTaskRepository.updateVitalTaskImage(taskId, userId, {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });
      } else {
        vitalTask.image = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        };
        await vitalTask.save();
        updatedVitalTask = vitalTask;
      }

      return updatedVitalTask;
    } catch (error) {
       throw ApiError.internal('Failed to upload vital task image. Please try again.');
    }
  }

  /**
   * Delete vital task image
   */
  async deleteVitalTaskImage(userId, taskId) {
    try {
      // Check access
      const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
      
      let vitalTask;
      if (access.isOwner) {
        vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);
      } else {
        if (access.role === 'viewer') {
          throw ApiError.forbidden('You do not have permission to modify this vital task');
        }
        const VitalTask = (await import('../models/VitalTask.js')).default;
        vitalTask = await VitalTask.findById(taskId);
      }

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      if (!vitalTask.image?.publicId) {
        throw ApiError.badRequest('No image to delete');
      }

      // Delete from cloudinary
      await cloudinary.uploader.destroy(vitalTask.image.publicId);

      // Update vital task
      let updatedVitalTask;
      if (access.isOwner) {
        updatedVitalTask = await VitalTaskRepository.deleteVitalTaskImage(taskId, userId);
      } else {
        vitalTask.image = { url: null, publicId: null };
        await vitalTask.save();
        await vitalTask.populate([
          { path: 'category', select: 'title color' },
          { path: 'status', select: 'name color' },
          { path: 'priority', select: 'name color' },
        ]);
        updatedVitalTask = vitalTask;
      }

      Logger.logAuth('VITAL_TASK_IMAGE_DELETED', userId, {
        vitalTaskId: taskId,
      });

      return {
        vitalTask: updatedVitalTask,
        message: 'Vital task image deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteVitalTaskImage service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Get vital task statistics
   */
  async getVitalTaskStats(userId) {
    try {
      const stats = await VitalTaskRepository.getUserVitalTaskStats(userId);

      return {
        stats,
      };
    } catch (error) {
      Logger.error('Error in getVitalTaskStats service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore deleted vital task
   */
  async restoreVitalTask(userId, taskId) {
    try {
      const vitalTask = await VitalTaskRepository.restoreVitalTask(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      Logger.logAuth('VITAL_TASK_RESTORED', userId, {
        vitalTaskId: taskId,
      });

      // Notification: Notify restoration (To Owner only as collaborators generated during collaboration are hard deleted)
      if (vitalTask.user && vitalTask.user.toString() !== userId.toString()) {
         const restorer = await (await import('../models/User.js')).default.findById(userId);
         await NotificationService.notifyVitalTaskRestored(vitalTask, restorer, [vitalTask.user]);
      }

      return {
        vitalTask,
        message: 'Vital task restored successfully',
      };
    } catch (error) {
      Logger.error('Error in restoreVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Convert vital task to regular task
   */
  async convertToRegularTask(userId, taskId) {
    try {
      // Check access permission (Owner or Editor can convert)
      const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
      if (!access.canAccess || (access.role !== 'owner' && access.role !== 'editor')) {
        throw ApiError.forbidden('Only owners and editors can convert tasks');
      }

      // Get the vital task
      const vitalTask = await VitalTask.findById(taskId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      const originalOwnerId = vitalTask.user;

      // Import TaskRepository dynamically to avoid circular dependency
      const TaskRepository = (await import('../repositories/taskRepository.js')).default;

      // Create regular task with original owner's ID
      const task = await TaskRepository.createTask(
        {
          title: vitalTask.title,
          description: vitalTask.description,
          dueDate: vitalTask.dueDate,
          priority: vitalTask.priority,
          status: vitalTask.status,
          category: vitalTask.category,
          isCompleted: vitalTask.isCompleted,
          image: vitalTask.image,
          steps: vitalTask.steps,
        },
        originalOwnerId
      );

      // Migrate collaborators if vital task is shared
      if (vitalTask.isShared) {
        const collaborators = await CollaborationRepository.getVitalTaskCollaborators(taskId, 'active');
        const TaskCollaborator = (await import('../models/TaskCollaborator.js')).default;
        
        const migrationPromises = collaborators.map(c => {
          // If collaborator is owner, skip (model/repo handles owner)
          if (c.collaborator._id.toString() === originalOwnerId.toString()) return null;
          
          return TaskCollaborator.create({
            task: task._id,
            taskOwner: originalOwnerId,
            collaborator: c.collaborator._id,
            role: c.role,
            status: 'active',
            sharedBy: c.sharedBy || userId,
            shareMessage: c.shareMessage
          });
        }).filter(Boolean);

        if (migrationPromises.length > 0) {
          await Promise.all(migrationPromises);
          
          // Update task metadata
          task.isShared = true;
          task.collaboratorCount = migrationPromises.length;
          await task.save();
        }
      }

      // Soft delete the vital task
      await vitalTask.softDelete();

      Logger.logAuth('VITAL_TASK_CONVERTED_TO_REGULAR', userId, {
        vitalTaskId: taskId,
        regularTaskId: task._id,
        title: vitalTask.title,
        convertedBy: userId
      });

      return {
        task,
        message: 'Vital task converted to regular task successfully',
      };
    } catch (error) {
      Logger.error('Error in convertToRegularTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Request review for a vital task
   */
  async requestReview(taskId, userId) {
    try {
      const access = await CollaborationRepository.canUserAccessVitalTask(taskId, userId);
      
      if (!access.canAccess) {
         throw ApiError.notFound('Vital task not found or you do not have access');
      }

      const vitalTask = await VitalTask.findById(taskId);
      if (!vitalTask) throw ApiError.notFound('Vital task not found');
      
      if (vitalTask.isCompleted) {
        throw ApiError.badRequest('Vital task is already completed');
      }

      // Update vital task with review request
      vitalTask.reviewRequestedBy = userId;
      vitalTask.reviewRequestedAt = new Date();
      await vitalTask.save();

      // Notify Owner and Editors
      const collaborators = await CollaborationRepository.getVitalTaskCollaborators(taskId, 'active');
      const editors = collaborators.filter(c => c.role === 'editor').map(c => c.collaborator._id);
      
      const recipients = [...editors];
      
      // Add Owner
      if (vitalTask.user && !recipients.some(id => id.toString() === vitalTask.user.toString())) {
         recipients.push(vitalTask.user);
      }
      
      // Filter out requester
      const finalRecipients = recipients.filter(id => id.toString() !== userId.toString());

      if (finalRecipients.length > 0) {
         const requester = await (await import('../models/User.js')).default.findById(userId);
         await NotificationService.notifyVitalTaskReviewRequested(vitalTask, requester, finalRecipients);
      }

      return {
        message: 'Review requested successfully',
        vitalTask
      };

    } catch (error) {
      Logger.error('Error in requestReview service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Helper to parse steps from various input formats
   */
  _parseSteps(steps) {
    if (!steps) return [];
    
    let raw = steps;
    if (typeof steps === 'string') {
      try {
        const parsed = JSON.parse(steps);
        raw = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        return steps.trim() ? [{ text: steps.trim(), isCompleted: false }] : [];
      }
    }

    if (Array.isArray(raw)) {
      return raw.map(s => {
        if (typeof s === 'string') {
          try {
            const parsed = JSON.parse(s);
            return (typeof parsed === 'object' && parsed !== null && (parsed.text || parsed.content))
              ? { text: parsed.text || parsed.content, isCompleted: !!parsed.isCompleted }
              : { text: s, isCompleted: false };
          } catch (e) {
            return { text: s, isCompleted: false };
          }
        }
        if (typeof s === 'object' && s !== null) {
          return {
            text: s.text || s.content || '',
            isCompleted: !!s.isCompleted
          };
        }
        return { text: String(s), isCompleted: false };
      }).filter(s => s.text.trim() !== '');
    }

    return [];
  }
}

export default new VitalTaskService();
