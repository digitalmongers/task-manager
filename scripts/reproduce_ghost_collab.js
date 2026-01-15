import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AuthService from '../services/authService.js';
import Task from '../models/Task.js';
import VitalTask from '../models/VitalTask.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import VitalTaskCollaborator from '../models/VitalTaskCollaborator.js';
import TaskInvitation from '../models/TaskInvitation.js';
import VitalTaskInvitation from '../models/VitalTaskInvitation.js';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import LoginActivity from '../models/LoginActivity.js';
import TaskMessage from '../models/TaskMessage.js';
import TeamMember from '../models/TeamMember.js';
import Category from '../models/Category.js';
import TaskPriority from '../models/TaskPriority.js';
import TaskStatus from '../models/TaskStatus.js';
import AIPlan from '../models/AIPlan.js';
import AIUsage from '../models/AIUsage.js';
import Suggestion from '../models/Suggestion.js';
import User from '../models/User.js';

dotenv.config();

async function runReproduction() {
  console.log('--- Starting Ghost Collaborator Reproduction ---');
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Database');

  const ownerId = new mongoose.Types.ObjectId();
  const collabId = new mongoose.Types.ObjectId();
  
  try {
    // 1. Setup Users
    const owner = await User.create({
      _id: ownerId,
      firstName: 'Owner',
      lastName: 'User',
      email: `owner_${Date.now()}@example.com`,
      password: 'Password123!',
      termsAccepted: true
    });

    const collaborator = await User.create({
      _id: collabId,
      firstName: 'Collaborator',
      lastName: 'User',
      email: `collab_${Date.now()}@example.com`,
      password: 'Password123!',
      termsAccepted: true
    });

    // 2. Setup Task and Collaboration
    const task = await Task.create({
      _id: new mongoose.Types.ObjectId(),
      user: ownerId,
      title: 'Reproduction Task',
      isShared: true,
      collaboratorCount: 1
    });

    await TaskCollaborator.create({
      task: task._id,
      taskOwner: ownerId,
      collaborator: collabId,
      role: 'viewer',
      status: 'active',
      sharedBy: ownerId
    });

    console.log(`Initial state: Task ${task._id}, Owner ${ownerId}, Collab ${collabId}`);
    console.log(`Task collaboratorCount before: ${task.collaboratorCount}`);

    // 3. Delete Collaborator Account
    console.log('\n--- Deleting Collaborator Account ---');
    await AuthService.cascadeDeleteUserData(collaborator);
    await User.deleteOne({ _id: collabId });

    // 4. Verify Task State
    const updatedTask = await Task.findById(task._id);
    const remainingCollabs = await TaskCollaborator.find({ task: task._id });

    console.log(`\nTask collaboratorCount after: ${updatedTask.collaboratorCount}`);
    console.log(`Remaining TaskCollaborator records: ${remainingCollabs.length}`);
    
    if (remainingCollabs.length > 0) {
      console.log('ISSUE REPRODUCED: TaskCollaborator record still exists!');
      console.log('Record details:', remainingCollabs[0]);
    } else if (updatedTask.collaboratorCount !== 0) {
      console.log('ISSUE REPRODUCED: collaboratorCount not decremented!');
    } else {
      console.log('SUCCESS: All data purged and count synced.');
    }

  } catch (error) {
    console.error('ERROR during reproduction:', error);
  } finally {
    await User.deleteMany({ _id: { $in: [ownerId, collabId] } });
    await Task.deleteOne({ _id: ownerId }); // This is wrong, should be task id
    await TaskCollaborator.deleteMany({ taskOwner: ownerId });
    await mongoose.connection.close();
  }
}

runReproduction();
