import mongoose from 'mongoose';
import User from './models/User.js';
import Task from './models/Task.js';
import VitalTask from './models/VitalTask.js';
import TaskPriority from './models/TaskPriority.js';
import dotenv from 'dotenv';

dotenv.config();

const checkTasks = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const email = 'parasmourya288@gmail.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log(`User ID: ${user._id}`);

    const vitalTasks = await VitalTask.find({
      user: user._id,
      isCompleted: false,
      isDeleted: false
    });
    console.log(`Vital Tasks count: ${vitalTasks.length}`);

    const allTasks = await Task.find({
      user: user._id,
      isCompleted: false,
      isDeleted: false
    }).populate('priority');

    console.log(`Total Pending Tasks: ${allTasks.length}`);

    if (allTasks.length > 0) {
      console.log('--- Task Details ---');
      allTasks.forEach(t => {
        console.log(`Task: "${t.title}"`);
        console.log(`   - Priority: ${t.priority ? t.priority.name : 'None'}`);
        console.log(`   - DueDate: ${t.dueDate ? t.dueDate : 'None'}`);
      });
    }

    const highPriorityTasks = allTasks.filter(t => 
      !t.priority || ['high', 'urgent', 'High', 'Urgent'].includes(t.priority?.name)
    );
    console.log(`\nFiltered 'High/Vital' Tasks count (by current logic): ${highPriorityTasks.length}`);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkTasks();
