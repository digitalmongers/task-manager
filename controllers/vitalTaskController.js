import VitalTaskService from '../services/vitalTaskService.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

class VitalTaskController {
  /**
   * Create new vital task
   * POST /api/vital-tasks
   */
  async createVitalTask(req, res) {
    const userId = req.user._id;
    const taskData = req.body;

    const result = await VitalTaskService.createVitalTask(userId, taskData);

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

    const result = await VitalTaskService.getAllVitalTasks(userId, filters);

    ApiResponse.success(res, 200, 'Vital tasks fetched successfully', {
      vitalTasks: result.vitalTasks,
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

    const result = await VitalTaskService.getVitalTaskById(userId, taskId);

    ApiResponse.success(res, 200, 'Vital task fetched successfully', {
      vitalTask: result.vitalTask,
    });
  }

  /**
   * Update vital task
   * PATCH /api/vital-tasks/:id
   */
  async updateVitalTask(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;
    const updateData = req.body;

    const result = await VitalTaskService.updateVitalTask(userId, taskId, updateData);

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

  /**
   * Upload vital task image
   * POST /api/vital-tasks/:id/image
   */
  async uploadVitalTaskImage(req, res) {
    const userId = req.user._id;
    const taskId = req.params.id;
    const file = req.file;

    if (!file) {
      throw ApiError.badRequest('Please upload an image file');
    }

    const result = await VitalTaskService.uploadVitalTaskImage(userId, taskId, file);

    ApiResponse.success(res, 200, result.message, {
      vitalTask: result.vitalTask,
    });
  }

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
}

export default new VitalTaskController();