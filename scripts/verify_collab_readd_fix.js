import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Repo from '../repositories/collaborationRepository.js';
import Task from '../models/Task.js';
import VitalTask from '../models/VitalTask.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import VitalTaskCollaborator from '../models/VitalTaskCollaborator.js';
import User from '../models/User.js';

import fs from 'fs';

dotenv.config();

async function runVerification() {
  const resultPath = 'C:\\Task-Manager-Backend\\scripts\\readd_collab_results.txt';
  console.log('--- Starting Task Collaborator Re-addition Verification ---');
  let results = '';
  
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Database');

  const ownerId = new mongoose.Types.ObjectId();
  const collabId = new mongoose.Types.ObjectId();
  const ownerEmail = `owner_readd_${Date.now()}@example.com`;
  const collabEmail = `collab_readd_${Date.now()}@example.com`;
  
  try {
    // Setup Data
    await User.create([
      { _id: ownerId, firstName: 'Owner', lastName: 'Alpha', email: ownerEmail, password: 'Password123!', termsAccepted: true },
      { _id: collabId, firstName: 'Collab', lastName: 'Beta', email: collabEmail, password: 'Password123!', termsAccepted: true }
    ]);

    const task = await Task.create({ user: ownerId, title: 'Re-add Task' });
    const vitalTask = await VitalTask.create({ user: ownerId, title: 'Re-add Vital Task' });

    // 1. Test Regular Task Re-addition
    console.log('\nScenario 1: Regular Task');
    await Repo.addCollaborator({ task: task._id, collaborator: collabId, role: 'editor', sharedBy: ownerId, taskOwner: ownerId });
    console.log('Added initial collaborator');
    
    // Simulate removal
    await TaskCollaborator.updateOne({ task: task._id, collaborator: collabId }, { status: 'removed' });
    console.log('Simulated removal (status=removed)');

    // Attempt re-add
    try {
      await Repo.addCollaborator({ task: task._id, collaborator: collabId, role: 'editor', sharedBy: ownerId, taskOwner: ownerId });
      results += 'Scenario 1: SUCCESS\n';
      console.log('SUCCESS: Re-added collaborator without duplicate key error!');
    } catch (error) {
      results += 'Scenario 1: FAILED\n';
      console.error('FAILED: Error re-adding collaborator:', error);
      throw error;
    }

    // 2. Test Vital Task Re-addition
    console.log('\nScenario 2: Vital Task');
    await Repo.addVitalTaskCollaborator({ vitalTask: vitalTask._id, collaborator: collabId, role: 'editor', sharedBy: ownerId, taskOwner: ownerId });
    console.log('Added initial vital collaborator');

    // Simulate removal
    await VitalTaskCollaborator.updateOne({ vitalTask: vitalTask._id, collaborator: collabId }, { status: 'removed' });
    console.log('Simulated removal (status=removed)');

    // Attempt re-add
    try {
      await Repo.addVitalTaskCollaborator({ vitalTask: vitalTask._id, collaborator: collabId, role: 'editor', sharedBy: ownerId, taskOwner: ownerId });
      results += 'Scenario 2: SUCCESS\n';
      console.log('SUCCESS: Re-added vital collaborator without duplicate key error!');
    } catch (error) {
      results += 'Scenario 2: FAILED\n';
      console.error('FAILED: Error re-adding vital collaborator:', error);
      throw error;
    }

    console.log('\n--- ALL VERIFICATIONS PASSED ---');
    fs.writeFileSync(resultPath, results);

  } catch (error) {
    console.error('VERIFICATION FAILED:', error);
  } finally {
    await User.deleteMany({ $or: [{ _id: ownerId }, { _id: collabId }] });
    await Task.deleteMany({ user: ownerId });
    await VitalTask.deleteMany({ user: ownerId });
    await TaskCollaborator.deleteMany({ taskOwner: ownerId });
    await VitalTaskCollaborator.deleteMany({ taskOwner: ownerId });
    await mongoose.disconnect();
  }
}

runVerification();
