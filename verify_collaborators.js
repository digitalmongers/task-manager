
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskRepository from './repositories/taskRepository.js';
import VitalTaskRepository from './repositories/vitalTaskRepository.js';
import Task from './models/Task.js';
import User from './models/User.js';

dotenv.config();

const verifyCollaborators = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is missing in .env');
      return;
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find a user to test with - let's find the first user
    const user = await User.findOne();
    if (!user) {
      console.log('No user found to test with.');
      return;
    }
    console.log(`Testing with user: ${user.email} (${user._id})`);

    // 1. Create a task
    console.log('Creating a test task...');
    const task = await TaskRepository.createTask({
      title: 'Test Collaborator Task',
      description: 'Testing virtuals',
    }, user._id);
    console.log('Task created:', task._id);
    
    // Check if collaborators field exists in the created task object
    // Note: virtuals might not show up in console.log of the mongoose doc unless toObject is called
    console.log('Task created (toObject):', JSON.stringify(task.toObject().collaborators, null, 2));

    // 2. Fetch tasks by user
    console.log('Fetching tasks by user...');
    const result = await TaskRepository.findByUser(user._id);
    const fetchedTask = result.tasks.find(t => t._id.toString() === task._id.toString());
    
    if (fetchedTask) {
       console.log('Fetched Task Collaborators:', JSON.stringify(fetchedTask.collaborators, null, 2));
    } else {
       console.log('Task not found in fetched list');
    }

    // Clean up
    await TaskRepository.deleteTask(task._id, user._id);
    console.log('Test task deleted.');

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

verifyCollaborators();
