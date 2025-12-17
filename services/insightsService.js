import taskRepository from '../repositories/taskRepository.js';
import vitalTaskRepository from '../repositories/vitalTaskRepository.js';
import aiService from './ai/aiService.js';
import { INSIGHTS_PROMPTS, SYSTEM_PROMPTS } from './ai/aiPrompts.js';
import { parseJSONResponse } from './ai/aiHelpers.js';
import Logger from '../config/logger.js';

class InsightsService {
  /**
   * Get aggregated stats from all task sources
   */
  async getAggregatedStats(userId) {
    const [taskStats, vitalTaskStats] = await Promise.all([
      taskRepository.getInsightsStats(userId),
      vitalTaskRepository.getInsightsStats(userId),
    ]);

    return {
      tasks: taskStats,
      vitalTasks: vitalTaskStats,
    };
  }

  /**
   * Calculate productivity metrics
   */
  calculateMetrics(taskStats, vitalTaskStats) {
    const totalTasks = (taskStats.overview[0]?.total || 0) + (vitalTaskStats.overview[0]?.total || 0);
    const totalCompleted = (taskStats.overview[0]?.completed || 0) + (vitalTaskStats.overview[0]?.completed || 0);
    const totalOverdue = (taskStats.overview[0]?.overdue || 0) + (vitalTaskStats.overview[0]?.overdue || 0);
    
    // Completion Rate
    const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

    // Last Week Comparison
    const lastWeekCompleted = (taskStats.lastWeekCompleted[0]?.count || 0) + (vitalTaskStats.lastWeekCompleted[0]?.count || 0);
    const thisWeekCompleted = (taskStats.thisWeekCompleted[0]?.count || 0) + (vitalTaskStats.thisWeekCompleted[0]?.count || 0);
    
    let completionTrend = 0;
    if (lastWeekCompleted > 0) {
      completionTrend = ((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100;
    } else if (thisWeekCompleted > 0) {
      completionTrend = 100; // 100% increase if last week was 0
    }

    // Average Completion Time (hours)
    const taskTime = taskStats.overview[0]?.totalCompletionTime || 0;
    const vitalTaskTime = vitalTaskStats.overview[0]?.totalCompletionTime || 0;
    const taskCompletedCount = taskStats.overview[0]?.completedCount || 0;
    const vitalTaskCompletedCount = vitalTaskStats.overview[0]?.completedCount || 0;
    
    const totalTime = taskTime + vitalTaskTime;
    const totalCount = taskCompletedCount + vitalTaskCompletedCount;
    
    const avgCompletionTimeHours = totalCount > 0 ? (totalTime / totalCount) / (1000 * 60 * 60) : 0;

    // Productivity Score (Heuristic: 0-100)
    // Factors: Completion Rate (40%), Task Volume (30%), Speed (30%)
    // Volume base: 50 tasks/week = 100 points
    // Speed base: < 24h avg = 100 points
    
    const volumeScore = Math.min((thisWeekCompleted / 10) * 100, 100); 
    const speedScore = avgCompletionTimeHours === 0 ? 0 : Math.max(0, 100 - (avgCompletionTimeHours * 2)); // Deduct points for slowness
    
    const productivityScore = Math.round(
      (completionRate * 0.4) + 
      (volumeScore * 0.3) + 
      (speedScore * 0.3)
    );

    return {
      totalTasks,
      totalCompleted,
      totalOverdue,
      completionRate: Math.round(completionRate),
      completionTrend: Math.round(completionTrend),
      avgCompletionTimeHours: parseFloat(avgCompletionTimeHours.toFixed(1)),
      productivityScore,
      lastWeekCompleted,
      thisWeekCompleted
    };
  }

  /**
   * Generate comprehensive insights
   */
  async generateInsights(userId) {
    try {
      const stats = await this.getAggregatedStats(userId);
      const metrics = this.calculateMetrics(stats.tasks, stats.vitalTasks);

      // Prepare data for AI
      const aiInput = {
        metrics,
        taskDistribution: stats.tasks.byStatus,
        vitalTaskDistribution: stats.vitalTasks.byStatus,
        recentActivity: {
          tasksCompletedLast7Days: stats.tasks.weeklyProgress,
          vitalTasksCompletedLast7Days: stats.vitalTasks.weeklyProgress
        }
      };

      // Generate AI analysis
      const systemPrompt = SYSTEM_PROMPTS.TASK_ASSISTANT;
      const userPrompt = INSIGHTS_PROMPTS.ANALYZE_COMPREHENSIVE_INSIGHTS(aiInput);

      const aiResponse = await aiService.callOpenAI(systemPrompt, userPrompt);
      const aiAnalysis = parseJSONResponse(aiResponse);

      // Construct final response
      return {
        metrics,
        charts: {
          taskStatus: stats.tasks.byStatus,
          vitalTaskStatus: stats.vitalTasks.byStatus,
          weeklyProgress: this.mergeWeeklyProgress(stats.tasks.weeklyProgress, stats.vitalTasks.weeklyProgress)
        },
        aiInsights: aiAnalysis
      };
    } catch (error) {
      Logger.error('Error generating insights', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Helper to merge daily progress arrays
   */
  mergeWeeklyProgress(tasksProgress, vitalTasksProgress) {
    const map = new Map();
    
    // Initialize map or process tasks
    tasksProgress.forEach(item => {
      map.set(item._id, (map.get(item._id) || 0) + item.count);
    });

    // Add vital tasks
    vitalTasksProgress.forEach(item => {
      map.set(item._id, (map.get(item._id) || 0) + item.count);
    });

    // Convert back to array and sort
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export default new InsightsService();
