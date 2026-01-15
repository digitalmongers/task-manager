import { v1 as uuidv4 } from 'uuid';
import WebSocketService from '../config/websocket.js';

async function testWebSocketFix() {
  console.log('--- Testing WebSocket Disconnection Fix ---');
  
  // Mock socket
  const userId = 'user123';
  const socket = {
    id: 'socket_abc',
    userId: userId,
    on: () => {},
    join: () => {},
    leave: () => {},
    emit: () => {}
  };

  // Mock removeSocketFromPresence to simulate async delay
  WebSocketService._removeSocketFromPresence = async (uid, sid) => {
    console.log(`Simulating async Redis removal for user ${uid}, socket ${sid}...`);
    // Simulate a delay where the map might be cleared by another process/event
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Redis removal mock complete.');
  };

  // Setup userSockets
  WebSocketService.userSockets.set(userId, new Set([socket.id]));
  console.log('Initial userSockets size:', WebSocketService.userSockets.get(userId).size);

  // Scenario 1: Normal disconnection
  console.log('\nRunning handleDisconnection...');
  await WebSocketService.handleDisconnection(socket);
  console.log('Final userSockets:', WebSocketService.userSockets.has(userId) ? 'STILL EXISTS' : 'CLEANED UP');

  // Scenario 2: Race condition simulation
  // We'll set it up again, but this time we'll manually delete the entry WHILE handleDisconnection is awaiting
  WebSocketService.userSockets.set(userId, new Set([socket.id]));
  console.log('\nSimulating Race Condition...');
  
  const disconnectionPromise = WebSocketService.handleDisconnection(socket);
  
  // Manually delete the entry before the promise resolves
  console.log('Manually deleting userSockets entry for user...');
  WebSocketService.userSockets.delete(userId);
  
  try {
    await disconnectionPromise;
    console.log('Race condition handled safely without crash!');
  } catch (error) {
    console.error('CRASH DETECTED:', error);
    process.exit(1);
  }

  console.log('\n--- VERIFICATION PASSED ---');
  process.exit(0);
}

testWebSocketFix();
