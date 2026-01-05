import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskService from './services/taskService.js';
import VitalTaskService from './services/vitalTaskService.js';
import Task from './models/Task.js';
import VitalTask from './models/VitalTask.js';

dotenv.config();

async function verifyStepsFix() {
  console.log('🚀 Starting Steps Fix Verification...');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const testUserId = new mongoose.Types.ObjectId();
    const stringifiedSteps = JSON.stringify([
      { text: 'Step 1 from String', isCompleted: false },
      { text: 'Step 2 from String', isCompleted: true }
    ]);

    // Test 1: Regular Task Creation
    console.log('\n--- Test 1: Regular Task Creation with stringified steps ---');
    const taskResult = await TaskService.createTask(testUserId, {
      title: 'Test Task Steps',
      steps: stringifiedSteps
    });
    console.log('Task steps type:', Array.isArray(taskResult.task.steps) ? 'Array' : typeof taskResult.task.steps);
    console.log('Steps count:', taskResult.task.steps.length);
    if (taskResult.task.steps.length === 2 && taskResult.task.steps[0].text === 'Step 1 from String') {
      console.log('✅ Regular Task Creation PASSED');
    } else {
      console.log('❌ Regular Task Creation FAILED');
    }

    // Test 2: Regular Task Update
    console.log('\n--- Test 2: Regular Task Update with stringified steps ---');
    const updatedTaskResult = await TaskService.updateTask(testUserId, taskResult.task._id, {
      steps: JSON.stringify([{ text: 'Updated Step', isCompleted: false }])
    });
    if (updatedTaskResult.task.steps[0].text === 'Updated Step') {
      console.log('✅ Regular Task Update PASSED');
    } else {
      console.log('❌ Regular Task Update FAILED');
    }

    // Test 3: Vital Task Creation
    console.log('\n--- Test 3: Vital Task Creation with stringified steps ---');
    const vitalResult = await VitalTaskService.createVitalTask(testUserId, {
      title: 'Test Vital Steps',
      steps: stringifiedSteps
    });
    if (vitalResult.vitalTask.steps.length === 2) {
      console.log('✅ Vital Task Creation PASSED');
    } else {
      console.log('❌ Vital Task Creation FAILED');
    }

    // Test 4: Vital Task Update
    console.log('\n--- Test 4: Vital Task Update with stringified steps ---');
    const updatedVitalResult = await VitalTaskService.updateVitalTask(testUserId, vitalResult.vitalTask._id, {
        steps: JSON.stringify([{ text: 'Updated Vital Step', isCompleted: true }])
    });
    if (updatedVitalResult.vitalTask.steps[0].text === 'Updated Vital Step') {
        console.log('✅ Vital Task Update PASSED');
    } else {
        console.log('❌ Vital Task Update FAILED');
    }

    // Cleanup
    await Task.deleteMany({ title: /Test Task Steps/ });
    await VitalTask.deleteMany({ title: /Test Vital Steps/ });
    console.log('\n🧹 Cleanup complete');

  } catch (error) {
    console.error('❌ Verification Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

verifyStepsFix();
