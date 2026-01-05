import MetricsService from '../services/metricsService.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Get real-time system metrics
 * @route GET /api/system/metrics
 * @access Private (Admin)
 */
export const getSystemMetrics = async (req, res, next) => {
    try {
        const metrics = await MetricsService.getMetrics();
        
        return ApiResponse.success(res, 200, 'System metrics retrieved successfully', {
            metrics,
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};
