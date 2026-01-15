import TaskService from '../services/taskService.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import AIService from '../services/ai/aiService.js';
import FacebookCapiService from '../services/facebookCapiService.js';
import { formatToLocal } from '../utils/dateUtils.js';

class TaskController {
  /**
   * Create new task
   * POST /api/tasks
   * POST /api/tasks?suggestions=true (for AI suggestions)
   */
  async createTask(req, res) {
    const userId = req.user._id;
    const taskData = req.body;
    const file = req.file;

    // Check if AI suggestions requested
    if (req.query.suggestions === 'true') {
      if (!AIService.isEnabled()) {
        throw ApiError.serviceUnavailable('AI service is not configured');
      }

      const suggestions = await AIService.generateTaskSuggestions({
        ...taskData,
        userId,
      });

      if (suggestions && suggestions.error) {
        throw ApiError.serviceUnavailable(suggestions.error);
      }

      return ApiResponse.success(res, 200, 'AI suggestions generated', {
        suggestions,
      });
    }

    // Normal task creation
    const result = await TaskService.createTask(userId, taskData, file);

    ApiResponse.success(res, 201, result.message, {
      task: result.task,
    });
  }

  /**
   * Get all tasks for user
   * GET /api/tasks
   */
  async getAllTasks(req, res) {
    const userId = req.user._id;
    const filters = req.query;

    const result = await TaskService.getAllTasks(userId, filters);

    // Track Search (Meta CAPI) if keyword exists
    if (filters.keyword) {
      FacebookCapiService.trackSearch(req.user, req, filters.keyword).catch(err => {
        // Fail silently as per requirement
      });
    }

    // Localize timestamps for all tasks
    const localizedTasks = result.tasks.map(task => {
      // task is already a plain object from service
      return {
        ...task,
        createdAtLocal: formatToLocal(task.createdAt, req.timezone),
        updatedAtLocal: formatToLocal(task.updatedAt, req.timezone),
        dueDateLocal: task.dueDate ? formatToLocal(task.dueDate, req.timezone) : null,
        completedAtLocal: task.completedAt ? formatToLocal(task.completedAt, req.timezone) : null,
      };
    });

    ApiResponse.success(res, 200, 'Tasks fetched successfully', {
      tasks: localizedTasks,
      pagination: result.pagination,
    });
  }

  /**
   * Get single task by ID
   * GET /api/tasks/:id
   */
  async getTaskById(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.getTaskById(userId, taskId);

    // Localize timestamps
    // task is already a plain object from service
    const localizedTask = {
      ...result.task,
      createdAtLocal: formatToLocal(result.task.createdAt, req.timezone),
      updatedAtLocal: formatToLocal(result.task.updatedAt, req.timezone),
      dueDateLocal: result.task.dueDate ? formatToLocal(result.task.dueDate, req.timezone) : null,
      completedAtLocal: result.task.completedAt ? formatToLocal(result.task.completedAt, req.timezone) : null,
    };

    ApiResponse.success(res, 200, 'Task fetched successfully', {
      task: localizedTask,
    });
  }

  /**
   * Update task
   * PATCH /api/tasks/:id
   * PATCH /api/tasks/:id?suggestions=true (for AI suggestions)
   */
  async updateTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;
    const updateData = req.body;
    const file = req.file;

    // Check if AI suggestions requested
    if (req.query.suggestions === 'true') {
      if (!AIService.isEnabled()) {
        throw ApiError.serviceUnavailable('AI service is not configured');
      }

      const suggestions = await AIService.generateTaskSuggestions({
        ...updateData,
        userId,
        isUpdate: true,
      });

      if (suggestions.error) {
        throw ApiError.internalServerError(suggestions.error);
      }

      return ApiResponse.success(res, 200, 'AI suggestions generated', {
        suggestions,
      });
    }

    // Normal task update
    const result = await TaskService.updateTask(userId, taskId, updateData, file);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }

  /**
   * Delete task
   * DELETE /api/tasks/:id
   */
  async deleteTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.deleteTask(userId, taskId);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Toggle task completion
   * POST /api/tasks/:id/toggle-complete
   */
  async toggleComplete(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.toggleComplete(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }

  /*
   * Upload task image endpoint removed.
   * Image upload is now handled in create/update task.
   */

  /**
   * Delete task image
   * DELETE /api/tasks/:id/image
   */
  async deleteTaskImage(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.deleteTaskImage(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }

  /**
   * Get task statistics
   * GET /api/tasks/stats/me
   */
  async getTaskStats(req, res) {
    const userId = req.user._id;

    const result = await TaskService.getTaskStats(userId);

    ApiResponse.success(res, 200, 'Task statistics fetched successfully', {
      stats: result.stats,
    });
  }

  /**
   * Get dropdown options (categories, statuses, priorities)
   * GET /api/tasks/dropdown-options
   */
  async getDropdownOptions(req, res) {
    const userId = req.user._id;

    const result = await TaskService.getDropdownOptions(userId);

    ApiResponse.success(res, 200, 'Dropdown options fetched successfully', {
      options: result,
    });
  }

  /**
   * Restore deleted task
   * POST /api/tasks/:id/restore
   */
  async restoreTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.restoreTask(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }

  /**
   * Convert regular task to vital task
   * POST /api/task/:id/convert-to-vital
   */
  async convertToVitalTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.convertToVitalTask(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }

  /**
   * Request review for a task
   * POST /api/tasks/:id/review
   */
  async requestReview(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.requestTaskReview(taskId, userId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }

  /**
   * Start task
   * POST /api/tasks/:id/start
   */
  async startTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await TaskService.startTask(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }
}

export default new TaskController();