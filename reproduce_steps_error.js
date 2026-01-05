import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';
import TaskService from './services/taskService.js';

dotenv.config();

async function reproduce() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  try {
    const testUserId = new mongoose.Types.ObjectId();
    const task = await Task.create({
      user: testUserId,
      title: 'Reproduction Task',
      steps: [{ text: 'Step 1', isCompleted: false }]
    });

    console.log('Task created');

    const edgeCases = [
      {
        name: 'Single Stringified Array',
        steps: "[{\"text\":\"hello\",\"isCompleted\":true}]"
      },
      {
        name: 'Array of Stringified Objects',
        steps: ["{\"text\":\"hello 2\",\"isCompleted\":true}"]
      },
      {
        name: 'Mixed Objects and Strings',
        steps: [
            { text: 'Normal Object', isCompleted: false },
            "{\"text\":\"Stringified Object\",\"isCompleted\":true}"
        ]
      }
    ];

    for (const testCase of edgeCases) {
      console.log(`\n--- Testing: ${testCase.name} ---`);
      try {
        const result = await TaskService.updateTask(testUserId, task._id, { steps: testCase.steps });
        console.log('✅ Result steps count:', result.task.steps.length);
        console.log('✅ First step text:', result.task.steps[0].text);
      } catch (err) {
        console.error('❌ FAILED with error:', err.message);
      }
    }

  } catch (err) {
    console.error('Setup failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

reproduce();
