import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskService from './services/taskService.js';
import VitalTaskService from './services/vitalTaskService.js';
import CollaborationRepository from './repositories/collaborationRepository.js';
import User from './models/User.js';
import Task from './models/Task.js';
import VitalTask from './models/VitalTask.js';
import TaskCollaborator from './models/TaskCollaborator.js';
import VitalTaskCollaborator from './models/VitalTaskCollaborator.js';

dotenv.config();

async function runVerification() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        // 1. Create Users
        const owner = await User.create({
            firstName: 'Owner',
            lastName: 'User',
            email: `owner_${Date.now()}@example.com`,
            password: 'password123'
        });
        const editor = await User.create({
            firstName: 'Editor',
            lastName: 'User',
            email: `editor_${Date.now()}@example.com`,
            password: 'password123'
        });
        const viewer = await User.create({
            firstName: 'Viewer',
            lastName: 'User',
            email: `viewer_${Date.now()}@example.com`,
            password: 'password123'
        });

        console.log('Users created');

        // 2. Create Regular Task
        const createResult = await TaskService.createTask(owner._id, {
            title: 'Test Conversion Task',
            description: 'A task to test conversion with collaborators'
        });
        const task = createResult.task;
        console.log('Task created:', task._id);

        // 3. Add collaborators
        await CollaborationRepository.addCollaborator({
            task: task._id,
            taskOwner: owner._id,
            collaborator: editor._id,
            role: 'editor',
            sharedBy: owner._id
        });
        await CollaborationRepository.addCollaborator({
            task: task._id,
            taskOwner: owner._id,
            collaborator: viewer._id,
            role: 'viewer',
            sharedBy: owner._id
        });

        // Update task metadata (manually for now as repo might not auto-sync on direct model create/update in this test setup)
        await Task.findByIdAndUpdate(task._id, { isShared: true, collaboratorCount: 2 });
        console.log('Collaborators added');

        // 4. Convert to Vital Task (as Editor)
        console.log('Converting to Vital Task as Editor...');
        const conversionToVital = await TaskService.convertToVitalTask(editor._id, task._id);
        const vitalTask = conversionToVital.vitalTask;
        console.log('Converted to Vital Task:', vitalTask._id);

        // 5. Verify Vital Task
        const fetchedVitalTask = await VitalTask.findById(vitalTask._id);
        if (fetchedVitalTask.user.toString() !== owner._id.toString()) {
            throw new Error(`Ownership mismatch! Expected ${owner._id}, got ${fetchedVitalTask.user}`);
        }
        console.log('Ownership preserved in Vital Task');

        const vitalCollabs = await VitalTaskCollaborator.find({ vitalTask: vitalTask._id, status: 'active' });
        if (vitalCollabs.length !== 2) {
            throw new Error(`Collaborator count mismatch! Expected 2, got ${vitalCollabs.length}`);
        }
        console.log('Collaborators migrated to Vital Task');

        // Check if original task is soft-deleted
        const originalTask = await Task.findOne({ _id: task._id }).setOptions({ includeDeleted: true }).select('+isDeleted');
        if (!originalTask || !originalTask.isDeleted) {
            throw new Error(`Original task was not soft-deleted. isDeleted: ${originalTask?.isDeleted}`);
        }
        console.log('Original task soft-deleted');

        // 6. Convert back to Regular Task (as Owner)
        console.log('Converting back to Regular Task as Owner...');
        const conversionToRegular = await VitalTaskService.convertToRegularTask(owner._id, vitalTask._id);
        const newTask = conversionToRegular.task;
        console.log('Converted back to Regular Task:', newTask._id);

        // 7. Verify Regular Task
        const fetchedNewTask = await Task.findById(newTask._id);
        if (fetchedNewTask.user.toString() !== owner._id.toString()) {
            throw new Error(`Ownership mismatch after re-conversion! Expected ${owner._id}, got ${fetchedNewTask.user}`);
        }
        console.log('Ownership preserved in Regular Task');

        const regularCollabs = await TaskCollaborator.find({ task: newTask._id, status: 'active' });
        if (regularCollabs.length !== 2) {
            throw new Error(`Collaborator count mismatch after re-conversion! Expected 2, got ${regularCollabs.length}`);
        }
        console.log('Collaborators migrated back to Regular Task');

        // Check if vital task is soft-deleted
        const deletedVitalTask = await VitalTask.findOne({ _id: vitalTask._id }).setOptions({ includeDeleted: true }).select('+isDeleted');
        if (!deletedVitalTask || !deletedVitalTask.isDeleted) {
            throw new Error(`Vital task was not soft-deleted. isDeleted: ${deletedVitalTask?.isDeleted}`);
        }
        console.log('Vital task soft-deleted');

        console.log('FINAL VERIFICATION PASSED');
        process.exit(0);
    } catch (error) {
        console.error('VERIFICATION FAILED:', error.message);
        process.exit(1);
    }
}

runVerification();
