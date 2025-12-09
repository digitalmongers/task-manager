import TaskStatusService from '../services/taskstatusService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

class TaskStatusController {
  /**
   * Create new task status
   * POST /api/task-statuses
   */
  async createTaskStatus(req, res) {
    const result = await TaskStatusService.createTaskStatus(
      req.user._id,
      req.body
    );

    return ApiResponse.created(res, result.message, {
      status: result.status,
    });
  }

  /**
   * Get all task statuses for logged-in user
   * GET /api/task-statuses
   */
  async getAllTaskStatuses(req, res) {
    const options = {
      sort: req.query.sort || '-createdAt',
      includeTaskCount: req.query.includeTaskCount === 'true',
    };

    const result = await TaskStatusService.getAllTaskStatuses(
      req.user._id,
      options
    );

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task statuses fetched successfully',
      {
        statuses: result.statuses,
        count: result.count,
      }
    );
  }

  /**
   * Get single task status by ID
   * GET /api/task-statuses/:id
   */
  async getTaskStatusById(req, res) {
    const result = await TaskStatusService.getTaskStatusById(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task status fetched successfully',
      {
        status: result.status,
      }
    );
  }

  /**
   * Update task status
   * PATCH /api/task-statuses/:id
   */
  async updateTaskStatus(req, res) {
    const result = await TaskStatusService.updateTaskStatus(
      req.user._id,
      req.params.id,
      req.body
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      status: result.status,
    });
  }

  /**
   * Delete task status
   * DELETE /api/task-statuses/:id
   */
  async deleteTaskStatus(req, res) {
    const result = await TaskStatusService.deleteTaskStatus(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  /**
   * Get task status statistics
   * GET /api/task-statuses/stats/me
   */
  async getTaskStatusStats(req, res) {
    const result = await TaskStatusService.getTaskStatusStats(req.user._id);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task status statistics fetched successfully',
      result.stats
    );
  }

  /**
   * Restore deleted task status (optional)
   * POST /api/task-statuses/:id/restore
   */
  async restoreTaskStatus(req, res) {
    const result = await TaskStatusService.restoreTaskStatus(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      status: result.status,
    });
  }
}

export default new TaskStatusController();