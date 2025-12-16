import VitalTask from '../models/VitalTask.js';
import ApiError from '../utils/ApiError.js';

class VitalTaskRepository {
  /**
   * Create new vital task
   */
  async createVitalTask(taskData, userId) {
    const vitalTask = await VitalTask.create({
      ...taskData,
      user: userId,
    });

    return vitalTask.populate([
      { path: 'category', select: 'title color' },
      { path: 'status', select: 'name color' },
      { path: 'priority', select: 'name color' },
    ]);
  }

  /**
   * Find vital tasks by user with filters and pagination
   */
  async findByUser(userId, query = {}, filters = {}) {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      category,
      status,
      priority,
      isCompleted,
      search,
    } = filters;

    const findQuery = { user: userId, isDeleted: false, ...query };

    // Apply filters
    if (category) findQuery.category = category;
    if (status) findQuery.status = status;
    if (priority) findQuery.priority = priority;
    if (isCompleted !== undefined) findQuery.isCompleted = isCompleted;

    // Search in title and description
    if (search) {
      findQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [vitalTasks, total] = await Promise.all([
      VitalTask.find(findQuery)
        .populate('category', 'title color')
        .populate('status', 'name color')
        .populate('priority', 'name color')
        .populate('reviewRequestedBy', 'firstName lastName email avatar')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      VitalTask.countDocuments(findQuery),
    ]);

    return {
      vitalTasks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find vital task by ID and user
   */
  async findByIdAndUser(taskId, userId) {
    return VitalTask.findOne({ _id: taskId, user: userId, isDeleted: false })
      .populate('category', 'title color')
      .populate('status', 'name color')
      .populate('priority', 'name color')
      .populate('reviewRequestedBy', 'firstName lastName email avatar');
  }

  /**
   * Update vital task
   */
  async updateVitalTask(taskId, userId, updateData) {
    const vitalTask = await VitalTask.findOneAndUpdate(
      { _id: taskId, user: userId, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    )
      .populate('category', 'title color')
      .populate('status', 'name color')
      .populate('priority', 'name color');

    return vitalTask;
  }

  /**
   * Soft delete vital task
   */
  async deleteVitalTask(taskId, userId) {
    const vitalTask = await VitalTask.findOne({
      _id: taskId,
      user: userId,
      isDeleted: false,
    });

    if (!vitalTask) {
      return null;
    }

    return vitalTask.softDelete();
  }

  /**
   * Toggle vital task completion
   */
  async toggleComplete(taskId, userId) {
    const vitalTask = await this.findByIdAndUser(taskId, userId);

    if (!vitalTask) {
      return null;
    }

    if (vitalTask.isCompleted) {
      await vitalTask.markIncomplete();
    } else {
      await vitalTask.markComplete();
    }

    return this.findByIdAndUser(taskId, userId);
  }

  /**
   * Update vital task image
   */
  async updateVitalTaskImage(taskId, userId, imageData) {
    return VitalTask.findOneAndUpdate(
      { _id: taskId, user: userId, isDeleted: false },
      { image: imageData },
      { new: true }
    )
      .populate('category', 'title color')
      .populate('status', 'name color')
      .populate('priority', 'name color');
  }

  /**
   * Delete vital task image
   */
  async deleteVitalTaskImage(taskId, userId) {
    return VitalTask.findOneAndUpdate(
      { _id: taskId, user: userId, isDeleted: false },
      { image: { url: null, publicId: null } },
      { new: true }
    )
      .populate('category', 'title color')
      .populate('status', 'name color')
      .populate('priority', 'name color');
  }

  /**
   * Get user's vital task statistics
   */
  async getUserVitalTaskStats(userId) {
    const [total, completed, overdue, byCategory] = await Promise.all([
      VitalTask.countDocuments({ user: userId, isDeleted: false }),
      VitalTask.countDocuments({ user: userId, isDeleted: false, isCompleted: true }),
      VitalTask.countDocuments({
        user: userId,
        isDeleted: false,
        isCompleted: false,
        dueDate: { $lt: new Date() },
      }),
      this.getVitalTasksByCategory(userId),
    ]);

    return {
      total,
      completed,
      incomplete: total - completed,
      overdue,
    };
  }

  /**
   * Get vital tasks grouped by category
   */
  async getVitalTasksByCategory(userId) {
    return VitalTask.aggregate([
      {
        $match: {
          user: userId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: ['$isCompleted', 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $unwind: {
          path: '$categoryInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          completed: 1,
          title: '$categoryInfo.title',
          color: '$categoryInfo.color',
        },
      },
    ]);
  }

  /**
   * Restore deleted vital task
   */
  async restoreVitalTask(taskId, userId) {
    const vitalTask = await VitalTask.findOne({
      _id: taskId,
      user: userId,
    }).setOptions({ includeDeleted: true });

    if (!vitalTask || !vitalTask.isDeleted) {
      return null;
    }

    return vitalTask.restore();
  }
}

export default new VitalTaskRepository();
