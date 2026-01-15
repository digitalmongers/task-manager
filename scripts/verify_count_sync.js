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
import User from '../models/User.js';

dotenv.config();

async function runVerification() {
  console.log('--- Starting Collaborator Count Sync Verification ---');
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Database');

  const ownerId = new mongoose.Types.ObjectId();
  const collabId = new mongoose.Types.ObjectId();
  const ownerEmail = `owner_sync_${Date.now()}@example.com`;
  const collabEmail = `collab_sync_${Date.now()}@example.com`;
  
  try {
    // 1. Setup Data
    await User.create([
      { _id: ownerId, firstName: 'Owner', lastName: 'Alpha', email: ownerEmail, password: 'Password123!', termsAccepted: true },
      { _id: collabId, firstName: 'Collab', lastName: 'Beta', email: collabEmail, password: 'Password123!', termsAccepted: true }
    ]);
    console.log('Created test users');

    const task = await Task.create({
      user: ownerId,
      title: 'Sync Count Task',
      description: 'Test count decrementation',
      isShared: true,
      collaboratorCount: 1
    });
    console.log('Created shared task with count 1');

    await TaskCollaborator.create({
      task: task._id,
      taskOwner: ownerId,
      collaborator: collabId,
      role: 'editor',
      sharedBy: ownerId,
      status: 'active'
    });
    console.log('Added active collaborator B to task A');

    // 2. Trigger Account Deletion for User B
    const userB = await User.findById(collabId);
    console.log('Deleting User B account...');
    await AuthService.cascadeDeleteUserData(collabId, userB);

    // 3. Verify User A's task count
    const updatedTask = await Task.findById(task._id);
    console.log(`Updated Task Collaborator Count: ${updatedTask.collaboratorCount}`);
    console.log(`Updated Task isShared: ${updatedTask.isShared}`);

    if (updatedTask.collaboratorCount === 0 && updatedTask.isShared === false) {
      console.log('SUCCESS: Collaborator count decremented correctly and isShared reset.');
    } else {
      console.error('FAILED: Collaborator count or isShared flag not synced correctly.');
      throw new Error('Count sync failed');
    }

    console.log('\n--- VERIFICATION PASSED ---');

  } catch (error) {
    console.error('VERIFICATION FAILED:', error);
  } finally {
    await User.deleteMany({ $or: [{ _id: ownerId }, { _id: collabId }] });
    await Task.deleteMany({ user: ownerId });
    await TaskCollaborator.deleteMany({ taskOwner: ownerId });
    await mongoose.disconnect();
  }
}

runVerification();
