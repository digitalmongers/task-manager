import TaskPriorityService from '../services/taskPriorityService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

class TaskPriorityController {
  /**
   * Create new task priority
   * POST /api/task-priorities
   */
  async createTaskPriority(req, res) {
    const result = await TaskPriorityService.createTaskPriority(
      req.user._id,
      req.body
    );

    return ApiResponse.created(res, result.message, {
      priority: result.priority,
    });
  }

  /**
   * Get all task priorities for logged-in user
   * GET /api/task-priorities
   */
  async getAllTaskPriorities(req, res) {
    const options = {
      sort: req.query.sort || '-createdAt',
      includeTaskCount: req.query.includeTaskCount === 'true',
    };

    const result = await TaskPriorityService.getAllTaskPriorities(
      req.user._id,
      options
    );

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task priorities fetched successfully',
      {
        priorities: result.priorities,
        count: result.count,
      }
    );
  }

  /**
   * Get single task priority by ID
   * GET /api/task-priorities/:id
   */
  async getTaskPriorityById(req, res) {
    const result = await TaskPriorityService.getTaskPriorityById(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task priority fetched successfully',
      {
        priority: result.priority,
      }
    );
  }

  /**
   * Update task priority
   * PATCH /api/task-priorities/:id
   */
  async updateTaskPriority(req, res) {
    const result = await TaskPriorityService.updateTaskPriority(
      req.user._id,
      req.params.id,
      req.body
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      priority: result.priority,
    });
  }

  /**
   * Delete task priority
   * DELETE /api/task-priorities/:id
   */
  async deleteTaskPriority(req, res) {
    const result = await TaskPriorityService.deleteTaskPriority(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  /**
   * Get task priority statistics
   * GET /api/task-priorities/stats/me
   */
  async getTaskPriorityStats(req, res) {
    const result = await TaskPriorityService.getTaskPriorityStats(req.user._id);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task priority statistics fetched successfully',
      result.stats
    );
  }

  /**
   * Restore deleted task priority (optional)
   * POST /api/task-priorities/:id/restore
   */
  async restoreTaskPriority(req, res) {
    const result = await TaskPriorityService.restoreTaskPriority(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      priority: result.priority,
    });
  }
}

export default new TaskPriorityController();