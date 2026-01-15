import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskService from '../services/taskService.js';
import AuthService from '../services/authService.js';
import Task from '../models/Task.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import TaskMessage from '../models/TaskMessage.js';
import User from '../models/User.js';

dotenv.config();

async function runVerification() {
  console.log('--- Starting Task Deletion & Cascade Verification ---');
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Database');

  const ownerId = new mongoose.Types.ObjectId();
  const collabId = new mongoose.Types.ObjectId();
  const ownerEmail = `owner_delete_${Date.now()}@example.com`;
  const collabEmail = `collab_delete_${Date.now()}@example.com`;
  
  try {
    // 1. Setup Data
    await User.create([
      { _id: ownerId, firstName: 'Owner', lastName: 'Alpha', email: ownerEmail, password: 'Password123!', termsAccepted: true },
      { _id: collabId, firstName: 'Collab', lastName: 'Beta', email: collabEmail, password: 'Password123!', termsAccepted: true }
    ]);
    console.log('Created test users');

    const task = await Task.create({
      user: ownerId,
      title: 'Shared Task',
      description: 'Delete me',
      isShared: true
    });
    console.log('Created shared task');

    await TaskCollaborator.create({
      task: task._id,
      taskOwner: ownerId,
      collaborator: collabId,
      role: 'editor',
      sharedBy: ownerId
    });
    console.log('Added collaborator B to task A');

    // 2. Test TypeError Fix (Ghost Collaborator)
    console.log('\n--- Scenario 1: Ghost Collaborator Delete ---');
    // Delete user B directly from DB to simulate orphan record
    await User.deleteOne({ _id: collabId });
    console.log('User B hard deleted (ghost collab record remains)');
    
    try {
      await TaskService.deleteTask(ownerId, task._id);
      console.log('Task A deleted successfully despite ghost collaborator! Fix works.');
    } catch (error) {
      console.error('Task deletion FAILED with ghost record:', error);
      throw error;
    }

    // 3. Test Account Deletion Cascade (Ownership Purge)
    console.log('\n--- Scenario 2: Account Deletion Cascade ---');
    // Re-create user B and a new task for A
    await User.create({ _id: collabId, firstName: 'Collab', lastName: 'Beta', email: collabEmail, password: 'Password123!', termsAccepted: true });
    const task2 = await Task.create({
      user: ownerId,
      title: 'Deathbed Task',
      description: 'Owner is leaving',
      isShared: true
    });
    await TaskCollaborator.create({
      task: task2._id,
      taskOwner: ownerId,
      collaborator: collabId,
      role: 'editor',
      sharedBy: ownerId
    });
    console.log('Task 2 created for Owner A and shared with Collab B');

    // Delete User A account
    const userA = await User.findById(ownerId);
    await AuthService.cascadeDeleteUserData(ownerId, userA);
    console.log('User A account deleted with cascade cleanup');

    // Verify User B no longer has the collaboration record
    const remains = await TaskCollaborator.findOne({ taskOwner: ownerId });
    if (!remains) {
      console.log('Collaboration records for tasks owned by A are purged. B no longer sees them. Fix works!');
    } else {
      console.error('FAILED: Collaboration records still exist for deleted owner A');
      throw new Error('Cascade failed');
    }

    console.log('\n--- ALL VERIFICATIONS PASSED ---');

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
