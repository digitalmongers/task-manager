import MetricsService from './services/metricsService.js';
import dotenv from 'dotenv';
import redisClient from './config/redis.js';

dotenv.config();

async function verifyObservability() {
    console.log('🚀 Starting Observability Verification...');

    try {
        // 1. Simulate Socket Connections
        console.log('\n--- Test 1: Socket Metrics ---');
        await MetricsService.incrementSockets();
        await MetricsService.incrementSockets();
        let metrics = await MetricsService.getMetrics();
        console.log('Active Sockets (expecting 2+):', metrics.activeSockets);

        await MetricsService.decrementSockets();
        metrics = await MetricsService.getMetrics();
        console.log('Active Sockets after decrement (expecting 1+):', metrics.activeSockets);

        // 2. Simulate Throughput
        console.log('\n--- Test 2: Message Throughput ---');
        // Simulate 10 messages
        for (let i = 0; i < 10; i++) {
            await MetricsService.trackMessage();
        }
        metrics = await MetricsService.getMetrics();
        console.log('Messages/Sec (Rolling average):', metrics.messagesPerSec);

        // 3. Simulate Sync Lag
        console.log('\n--- Test 3: Sync Lag Tracking ---');
        await MetricsService.trackSyncLag(150); // 150ms
        await MetricsService.trackSyncLag(250); // 250ms
        metrics = await MetricsService.getMetrics();
        console.log('Avg Sync Lag (expecting 200ms):', metrics.avgSyncLagMs);

        // 4. Simulate Failed Retry
        console.log('\n--- Test 4: Failed Retries ---');
        await MetricsService.trackFailedRetry();
        metrics = await MetricsService.getMetrics();
        console.log('Failed Retries count:', metrics.failedRetries);

        if (metrics.activeSockets >= 0 && metrics.messagesPerSec >= 0 && metrics.avgSyncLagMs === 200) {
            console.log('\n✅ Observability Logic Verified!');
        } else {
            console.log('\n❌ Observability logic check FAILED');
        }

    } catch (error) {
        console.error('❌ Verification Error:', error);
    } finally {
        // Cleanup if needed (counters)
        // Note: We don't want to reset global metrics in a dev environment if shared, 
        // but for this verification skip cleanup to see persisting values.
        process.exit();
    }
}

verifyObservability();
