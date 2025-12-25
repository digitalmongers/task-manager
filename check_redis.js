import redisClient from './config/redis.js';

async function checkRedis() {
  try {
    console.log('Attempting to ping Redis...');
    const result = await redisClient.ping();
    console.log('Redis Ping Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Redis Ping Failed:', error.message);
    process.exit(1);
  }
}

checkRedis();
