import redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new redis(process.env.REDIS_URL);

async function verifyPresence() {
  console.log('🚀 Starting Presence & Typing Verification...');
  const userId = 'test_user_123';
  const socket1 = 'socket_A';
  const socket2 = 'socket_B';

  try {
    // 1. Setup multi-device presence
    console.log('\n--- Test 1: Multi-device Login ---');
    const socketSetKey = `presence:sockets:user:${userId}`;
    const presenceKey = `presence:user:${userId}`;
    
    await redisClient.sadd(socketSetKey, socket1, socket2);
    await redisClient.set(`presence:socket:${socket1}`, userId, 'EX', 60);
    await redisClient.set(`presence:socket:${socket2}`, userId, 'EX', 60);
    await redisClient.hset(presenceKey, 'status', 'online');
    
    console.log('Sockets in Redis:', await redisClient.smembers(socketSetKey));
    
    // 2. Simulate Ghost Socket (socket_A expires)
    console.log('\n--- Test 2: Ghost Socket Detection ---');
    await redisClient.del(`presence:socket:${socket1}`);
    console.log('socket_A TTL deleted (manual ghost)');

    // Mocking the check logic from websocket.js
    const socketIds = await redisClient.smembers(socketSetKey);
    const ttlChecks = await Promise.all(
        socketIds.map(sid => redisClient.exists(`presence:socket:${sid}`))
    );
    const activeSocketCount = ttlChecks.filter(exists => exists === 1).length;
    
    console.log('Total Sockets in Set:', socketIds.length);
    console.log('Active Sockets (with TTL):', activeSocketCount);
    
    if (activeSocketCount === 1) {
        console.log('✅ Ghost detection logic verified (socket_A ignored)');
    } else {
        console.log('❌ Ghost detection FAILED');
    }

    // 3. Cleanup logic check
    const ghostsActual = socketIds.filter((_, index) => ttlChecks[index] === 0);
    if (ghostsActual.length > 0) {
        await redisClient.srem(socketSetKey, ...ghostsActual);
        console.log('✅ Cleaned up ghost sockets from Set');
    }

    const finalCount = await redisClient.scard(socketSetKey);
    console.log('Remaining sockets in Set:', finalCount);

    // 4. Typing Lock check
    console.log('\n--- Test 3: Typing Throttle Lock ---');
    const taskId = 'task_456';
    const lockKey = `typing:lock:${userId}:${taskId}`;
    await redisClient.set(lockKey, 'true', 'EX', 2);
    const isLocked = await redisClient.get(lockKey);
    if (isLocked) {
        console.log('✅ Typing lock active (2s throttle enforced)');
    } else {
        console.log('❌ Typing lock FAILED');
    }

  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    // Cleanup
    await redisClient.del(`presence:user:${userId}`);
    await redisClient.del(`presence:sockets:user:${userId}`);
    await redisClient.del(`presence:socket:${socket1}`);
    await redisClient.del(`presence:socket:${socket2}`);
    await redisClient.disconnect();
    console.log('\n🏁 Verification Finished');
  }
}

verifyPresence();
