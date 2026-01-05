
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskService from './services/taskService.js';
import VitalTaskService from './services/vitalTaskService.js';
import Task from './models/Task.js';
import VitalTask from './models/VitalTask.js';
import User from './models/User.js';
import fs from 'fs';

dotenv.config();

const results = {
  tests: [],
  summary: { passed: 0, failed: 0 }
};

const addTest = (name, passed, data) => {
  results.tests.push({ name, passed, data });
  if (passed) results.summary.passed++;
  else results.summary.failed++;
};

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }
    await mongoose.connect(process.env.MONGO_URI);

    const suffix = Date.now().toString();
    const user = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: `test_${suffix}@test.com`,
      password: 'password123',
      passwordConfirm: 'password123'
    });
    const userId = user._id;

    // 1. Create Task with steps
    try {
      const taskData = {
        title: 'Step Test Task',
        steps: [
          { text: 'Step 1', isCompleted: false },
          { text: 'Step 2', isCompleted: true }
        ]
      };
      const createResult = await TaskService.createTask(userId, taskData);
      const taskId = createResult.task._id;
      const passed = createResult.task.steps.length === 2 && createResult.task.steps[1].isCompleted === true;
      addTest('Create Task with steps', passed, createResult.task.steps);

      // 2. Update Task steps
      const updateData = {
        steps: [
          { text: 'Step 1 Updated', isCompleted: true },
          { text: 'Step 3 New', isCompleted: false }
        ]
      };
      const updateResult = await TaskService.updateTask(userId, taskId, updateData);
      const uPassed = updateResult.task.steps.length === 2 && updateResult.task.steps[0].text === 'Step 1 Updated';
      addTest('Update Task steps', uPassed, updateResult.task.steps);

      // 3. Convert Task to Vital Task
      const convertToVitalResult = await TaskService.convertToVitalTask(userId, taskId);
      const vitalTaskId = convertToVitalResult.vitalTask._id;
      const cvPassed = convertToVitalResult.vitalTask.steps.length === 2 && convertToVitalResult.vitalTask.steps[0].text === 'Step 1 Updated';
      addTest('Convert Task to Vital Task', cvPassed, convertToVitalResult.vitalTask.steps);

      // 4. Update Vital Task steps
      const vitalUpdateData = {
        steps: [
          { text: 'Vital Step 1', isCompleted: true }
        ]
      };
      const vitalUpdateResult = await VitalTaskService.updateVitalTask(userId, vitalTaskId, vitalUpdateData);
      const vuPassed = vitalUpdateResult.vitalTask.steps.length === 1 && vitalUpdateResult.vitalTask.steps[0].text === 'Vital Step 1';
      addTest('Update Vital Task steps', vuPassed, vitalUpdateResult.vitalTask.steps);

      // 5. Convert Vital Task to regular Task
      const convertToRegularResult = await VitalTaskService.convertToRegularTask(userId, vitalTaskId);
      const crPassed = convertToRegularResult.task.steps.length === 1 && convertToRegularResult.task.steps[0].text === 'Vital Step 1';
      addTest('Convert Vital Task to Task', crPassed, convertToRegularResult.task.steps);

      // Cleanup
      const finalTaskId = convertToRegularResult.task._id;
      await Task.deleteOne({ _id: finalTaskId });
      await VitalTask.deleteOne({ _id: vitalTaskId });
    } catch (testError) {
      addTest('Tests failure', false, testError.message);
    }

    await User.deleteOne({ _id: userId });

  } catch (error) {
    results.error = error.message;
  } finally {
    fs.writeFileSync('verification_results.json', JSON.stringify(results, null, 2));
    await mongoose.disconnect();
  }
};

run();
