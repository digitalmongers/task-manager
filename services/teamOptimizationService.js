import Task from '../models/Task.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import Logger from '../config/logger.js';
import mongoose from 'mongoose';

class TeamOptimizationService {
  /**
   * Calculate performance metrics for a user's team members
   * @param {string} userId - ID of the user requesting suggestions
   * @param {string} categoryId - Optional category to filter expertise
   */
  async getTeamPerformanceMetrics(userId, categoryId = null) {
    try {
      // 1. Find all people this user has collaborated with
      const collaborations = await TaskCollaborator.find({
        $or: [
          { taskOwner: userId },
          { collaborator: userId }
        ],
        status: 'active'
      }).select('collaborator taskOwner');

      const teammateIds = new Set();
      collaborations.forEach(c => {
        teammateIds.add(c.collaborator.toString());
        teammateIds.add(c.taskOwner.toString());
      });
      teammateIds.delete(userId.toString()); // Remove self

      if (teammateIds.size === 0) return [];

      // 2. Aggregate task completion data for these teammates
      const metrics = await Task.aggregate([
        {
          $match: {
            user: { $in: Array.from(teammateIds).map(id => new mongoose.Types.ObjectId(id)) },
            isCompleted: true,
            completedAt: { $ne: null },
            isDeleted: false,
            ...(categoryId ? { category: new mongoose.Types.ObjectId(categoryId) } : {})
          }
        },
        {
          $project: {
            user: 1,
            category: 1,
            duration: { $subtract: ["$completedAt", "$createdAt"] }
          }
        },
        {
          $group: {
            _id: { user: "$user", category: "$category" },
            avgCompletionTime: { $avg: "$duration" },
            taskCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id.user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $unwind: '$userInfo'
        },
        {
          $project: {
            userId: '$_id.user',
            categoryId: '$_id.category',
            userName: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
            avgCompletionTimeMs: '$avgCompletionTime',
            taskCount: 1
          }
        },
        { $sort: { avgCompletionTimeMs: 1 } }
      ]);

      return metrics;
    } catch (error) {
      Logger.error('Failed to calculate team performance metrics', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Get formatted suggestions for AI context
   */
  async getAIPerformanceContext(userId) {
    const metrics = await this.getTeamPerformanceMetrics(userId);
    if (!metrics.length) return "No team performance data available.";

    // Group by user for cleaner context
    const userGroups = {};
    metrics.forEach(m => {
      if (!userGroups[m.userName]) userGroups[m.userName] = [];
      const hours = (m.avgCompletionTimeMs / (1000 * 60 * 60)).toFixed(1);
      userGroups[m.userName].push(`Category[${m.categoryId}] avg ${hours}h (${m.taskCount} tasks)`);
    });

    return Object.entries(userGroups)
      .map(([name, data]) => `${name}: ${data.join(', ')}`)
      .join('\n');
  }
}

export default new TeamOptimizationService();
