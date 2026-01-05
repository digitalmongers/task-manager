import redisClient from '../config/redis.js';
import Logger from '../config/logger.js';

class MetricsService {
    constructor() {
        this.socketMetricKey = 'metrics:chat:active_sockets';
        this.msgMetricKey = 'metrics:chat:msg_throughput';
        this.retryFailedKey = 'metrics:chat:retry_failed';
        this.lagMetricKey = 'metrics:chat:sync_lag';
        this.rateLimitHitKey = 'metrics:chat:ratelimit_hits';
    }

    /**
     * Increment active socket count
     */
    async incrementSockets() {
        try {
            await redisClient.incr(this.socketMetricKey);
        } catch (e) {
            Logger.error('Failed to increment socket metrics', { error: e.message });
        }
    }

    /**
     * Decrement active socket count
     */
    async decrementSockets() {
        try {
            const count = await redisClient.get(this.socketMetricKey);
            if (count && parseInt(count) > 0) {
                await redisClient.decr(this.socketMetricKey);
            }
        } catch (e) {
            Logger.error('Failed to decrement socket metrics', { error: e.message });
        }
    }

    /**
     * Track a message event for throughput (sliding window 1 min)
     */
    async trackMessage() {
        try {
            const now = Math.floor(Date.now() / 1000);
            const key = `${this.msgMetricKey}:${now}`;
            await redisClient.incr(key);
            await redisClient.expire(key, 120); // 2 min history
        } catch (e) {
             Logger.error('Failed to track message throughput', { error: e.message });
        }
    }

    /**
     * Track a failed retry (idempotency hit but couldn't serve)
     */
    async trackFailedRetry() {
        await redisClient.incr(this.retryFailedKey);
    }

    /**
     * Track sync lag (ms)
     */
    async trackSyncLag(ms) {
        // We store the last 50 lag samples for averaging
        await redisClient.lpush(this.lagMetricKey, ms);
        await redisClient.ltrim(this.lagMetricKey, 0, 49);
    }

    /**
     * Get real-time metrics summary
     */
    async getMetrics() {
        try {
            const now = Math.floor(Date.now() / 1000);
            
            // Calculate messages/sec for the last 60 seconds
            const throughputKeys = Array.from({ length: 60 }, (_, i) => `${this.msgMetricKey}:${now - i}`);
            const throughputValues = await redisClient.mget(...throughputKeys);
            const totalMsgsLastMin = throughputValues.reduce((sum, val) => sum + (val ? parseInt(val) : 0), 0);

            const [activeSockets, retryFailed, lagSamples] = await Promise.all([
                redisClient.get(this.socketMetricKey),
                redisClient.get(this.retryFailedKey),
                redisClient.lrange(this.lagMetricKey, 0, -1)
            ]);

            const avgLag = lagSamples.length > 0 
                ? lagSamples.reduce((a, b) => parseInt(a) + parseInt(b), 0) / lagSamples.length 
                : 0;

            return {
                activeSockets: parseInt(activeSockets || 0),
                messagesPerSec: parseFloat((totalMsgsLastMin / 60).toFixed(2)),
                failedRetries: parseInt(retryFailed || 0),
                avgSyncLagMs: parseFloat(avgLag.toFixed(2)),
                timestamp: new Date().toISOString()
            };
        } catch (e) {
            Logger.error('Failed to fetch metrics', { error: e.message });
            return { error: 'Metrics fetch failed' };
        }
    }
}

export default new MetricsService();
