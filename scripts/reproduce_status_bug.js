import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskService from '../services/taskService.js';
import Task from '../models/Task.js';
import User from '../models/User.js';

dotenv.config();

async function reproduceBug() {
  console.log('--- Starting Status Bug Reproduction ---');
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Database');

  const userId = new mongoose.Types.ObjectId();
  
  try {
    // 1. Setup User
    await User.create({
      _id: userId,
      firstName: 'Status',
      lastName: 'Tester',
      email: `status_test_${Date.now()}@example.com`,
      password: 'Password123!',
      termsAccepted: true
    });

    // 2. Create Task (defaults to Not Started)
    const task = await Task.create({
      user: userId,
      title: 'Status Bug Task',
      status: 'In Progress',
      isCompleted: false
    });
    console.log(`Initial Task Status: ${task.status}`);

    // 3. Update Task to "Not Started"
    console.log('Updating task to "Not Started"...');
    const updateData = { 
      status: 'Not Started',
      isCompleted: false 
    };
    
    // We use the service directly as that's where the buggy logic is
    const TaskService = (await import('../services/taskService.js')).default;
    const result = await TaskService.updateTask(userId, task._id, updateData);

    // 4. Verify Result
    console.log(`Updated Task Status: ${result.task.status}`);

    if (result.task.status === 'In Progress') {
      console.log('BUG REPRODUCED: Status reverted to "In Progress"!');
    } else if (result.task.status === 'Not Started') {
      console.log('SUCCESS: Status is correctly "Not Started".');
    } else {
      console.log(`Unexpected status: ${result.task.status}`);
    }

  } catch (error) {
    console.error('ERROR during reproduction:', error);
  } finally {
    await User.deleteMany({ _id: userId });
    await Task.deleteMany({ user: userId });
    await mongoose.connection.close();
  }
}

reproduceBug();
