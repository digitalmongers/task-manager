import VitalTaskService from '../services/vitalTaskService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { formatToLocal } from '../utils/dateUtils.js';
import ApiError from '../utils/ApiError.js';
import AIService from '../services/ai/aiService.js';

class VitalTaskController {
  /**
   * Create new vital task
   * POST /api/vital-tasks
   * POST /api/vital-tasks?suggestions=true (for AI suggestions)
   */
  async createVitalTask(req, res) {
    const userId = req.user._id;
    const taskData = req.body;
    const file = req.file;

    // Check if AI suggestions requested
    if (req.query.suggestions === 'true') {
      if (!AIService.isEnabled()) {
        throw ApiError.serviceUnavailable('AI service is not configured');
      }

      const suggestions = await AIService.generateVitalTaskSuggestions({
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

    // Normal vital task creation
    const result = await VitalTaskService.createVitalTask(userId, taskData, file);

    ApiResponse.success(res, 201, result.message, {
      vitalTask: result.vitalTask,
    });
  }

  /**
   * Get all vital tasks for user
   * GET /api/vital-tasks
   */
  async getAllVitalTasks(req, res) {
    const userId = req.user._id;
    const filters = req.query;

    const result = await VitalTaskService.getAllVitalTasks(userId, req.query);

    // Localize timestamps
    const localizedTasks = result.vitalTasks.map(task => {
      const taskObj = task.toObject();
      return {
        ...taskObj,
        createdAtLocal: formatToLocal(task.createdAt, req.timezone),
        updatedAtLocal: formatToLocal(task.updatedAt, req.timezone),
        dueDateLocal: task.dueDate ? formatToLocal(task.dueDate, req.timezone) : null,
        completedAtLocal: task.completedAt ? formatToLocal(task.completedAt, req.timezone) : null,
      };
    });

    ApiResponse.success(res, 200, 'Vital tasks fetched successfully', {
      vitalTasks: localizedTasks,
      pagination: result.pagination,
    });
  }

  /**
   * Get single vital task by ID
   * GET /api/vital-tasks/:id
   */
  async getVitalTaskById(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const vitalTask = await VitalTaskService.getVitalTaskById(userId, taskId);

    // Localize timestamps
    const taskObj = vitalTask.toObject();
    const localizedTask = {
      ...taskObj,
      createdAtLocal: formatToLocal(vitalTask.createdAt, req.timezone),
      updatedAtLocal: formatToLocal(vitalTask.updatedAt, req.timezone),
      dueDateLocal: vitalTask.dueDate ? formatToLocal(vitalTask.dueDate, req.timezone) : null,
      completedAtLocal: vitalTask.completedAt ? formatToLocal(vitalTask.completedAt, req.timezone) : null,
    };

    ApiResponse.success(res, 200, 'Vital task fetched successfully', {
      vitalTask: localizedTask,
    });
  }

  /**
   * Update vital task
   * PATCH /api/vital-tasks/:id
   * PATCH /api/vital-tasks/:id?suggestions=true (for AI suggestions)
   */
  async updateVitalTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;
    const updateData = req.body;
    const file = req.file;

    // Check if AI suggestions requested
    if (req.query.suggestions === 'true') {
      if (!AIService.isEnabled()) {
        throw ApiError.serviceUnavailable('AI service is not configured');
      }

      const suggestions = await AIService.generateVitalTaskSuggestions({
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

    // Normal vital task update
    const result = await VitalTaskService.updateVitalTask(userId, taskId, updateData, file);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }

  /**
   * Delete vital task
   * DELETE /api/vital-tasks/:id
   */
  async deleteVitalTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await VitalTaskService.deleteVitalTask(userId, taskId);

    ApiResponse.success(res, 200, result.message);
  }

  /**
   * Toggle vital task completion
   * POST /api/vital-tasks/:id/toggle-complete
   */
  async toggleComplete(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await VitalTaskService.toggleComplete(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }

  /*
   * Upload vital task image endpoint removed.
   * Image upload is now handled in create/update vital task.
   */

  /**
   * Delete vital task image
   * DELETE /api/vital-tasks/:id/image
   */
  async deleteVitalTaskImage(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await VitalTaskService.deleteVitalTaskImage(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }

  /**
   * Get vital task statistics
   * GET /api/vital-tasks/stats/me
   */
  async getVitalTaskStats(req, res) {
    const userId = req.user._id;

    const result = await VitalTaskService.getVitalTaskStats(userId);

    ApiResponse.success(res, 200, 'Vital task statistics fetched successfully', {
      stats: result.stats,
    });
  }

  /**
   * Restore deleted vital task
   * POST /api/vital-tasks/:id/restore
   */
  async restoreVitalTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await VitalTaskService.restoreVitalTask(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }

  /**
   * Convert vital task to regular task
   * POST /api/vital-tasks/:id/convert-to-regular
   */
  async convertToRegularTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await VitalTaskService.convertToRegularTask(userId, taskId);

    ApiResponse.success(res, 200, result.message, {
      task: result.task,
    });
  }

  /**
   * Request review for a vital task
   * POST /api/vital-tasks/:id/review
   */
  async requestReview(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;

    const result = await VitalTaskService.requestReview(taskId, userId);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }
}

export default new VitalTaskController();