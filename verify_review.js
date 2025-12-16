
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';
import User from './models/User.js';
import TaskCollaborator from './models/TaskCollaborator.js';
import TaskService from './services/taskService.js';
import Notification from './models/Notification.js';

dotenv.config();

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const suffix = Date.now().toString();

    // 1. Create Users
    const owner = await User.create({ firstName: 'Owner', lastName: 'User', email: `owner_${suffix}@test.com`, password: 'password123', passwordConfirm: 'password123' });
    const editor = await User.create({ firstName: 'Editor', lastName: 'User', email: `editor_${suffix}@test.com`, password: 'password123', passwordConfirm: 'password123' });
    const viewer = await User.create({ firstName: 'Viewer', lastName: 'User', email: `viewer_${suffix}@test.com`, password: 'password123', passwordConfirm: 'password123' });

    console.log(`Users created: Owner(${owner._id}), Editor(${editor._id}), Viewer(${viewer._id})`);

    // 2. Create Task
    const task = await TaskService.createTask(owner._id, { title: 'Review Workflow Test' });
    const taskId = task.task._id;
    console.log('Task created:', taskId);

    // 3. Share Task
    await TaskCollaborator.create({ task: taskId, taskOwner: owner._id, collaborator: editor._id, role: 'editor', sharedBy: owner._id });
    await TaskCollaborator.create({ task: taskId, taskOwner: owner._id, collaborator: viewer._id, role: 'viewer', sharedBy: owner._id });
    console.log('Task shared with Editor and Viewer');

    // 4. Viewer tries to complete -> Should fail
    console.log('\n--- Test 1: Viewer trying to complete task ---');
    try {
      await TaskService.toggleComplete(viewer._id, taskId);
      console.error('FAIL: Viewer was able to complete task!');
    } catch (error) {
      console.log('SUCCESS: Viewer blocked:', error.message);
    }

    // 5. Viewer requests review -> Should succeed
    console.log('\n--- Test 2: Viewer requesting review ---');
    await TaskService.requestTaskReview(taskId, viewer._id);
    
    // Fetch task again using Service to test population in getAllTasks/getTaskById
    // We already tested the direct update. Now let's test the retrieval via Service.
    // Simulating retrieval by owner
    const ownerTasks = await TaskService.getAllTasks(owner._id, {}); // Should include the shared task? No, getAllTasks logic is complex.
    // Let's rely on getTaskById which we modified.
    
    const fetchedTask = await TaskService.getTaskById(owner._id, taskId); // Owner fetching the task
    
    console.log('Fetched Task reviewRequestedBy:', fetchedTask.task.reviewRequestedBy);

    if (fetchedTask.task.reviewRequestedBy && fetchedTask.task.reviewRequestedBy.firstName === 'Viewer') {
        console.log('SUCCESS: reviewRequestedBy is populated with firstName');
    } else {
        console.error('FAIL: reviewRequestedBy is NOT populated or incorrect', fetchedTask.task.reviewRequestedBy);
    }
    
    const updatedTask = await Task.findById(taskId);
    if (updatedTask.reviewRequestedBy.toString() === viewer._id.toString()) {
        console.log('SUCCESS: Task marked as review requested by viewer (DB check)');
        console.log('isUnderReview virtual:', updatedTask.isUnderReview); // Check virtual
    } else {
        console.error('FAIL: reviewRequestedBy is not set properly');
    }

    // 6. Check Notifications
    console.log('\n--- Test 3: Check Notifications ---');
    const note = await Notification.findOne({ type: 'task_review_requested', relatedEntity: { entityType: 'Task', entityId: taskId } });
    if (note) {
        console.log(`SUCCESS: Notification found for recipient ${note.recipient}`);
    } else {
        console.error('FAIL: No notification found');
    }

    // 7. Owner completes task -> Should succeed and clear review
    console.log('\n--- Test 4: Owner completes task ---');
    await TaskService.toggleComplete(owner._id, taskId);
    const completedTask = await Task.findById(taskId);
    if (completedTask.isCompleted && !completedTask.reviewRequestedBy) {
        console.log('SUCCESS: Task completed and review flags cleared');
    } else {
        console.error('FAIL: Task completion or flag clearing failed', completedTask);
    }

    // Cleanup
    await Task.deleteOne({ _id: taskId });
    await TaskCollaborator.deleteMany({ task: taskId });
    await User.deleteMany({ _id: { $in: [owner._id, editor._id, viewer._id] } });
    await Notification.deleteMany({ 'relatedEntity.entityId': taskId });
    console.log('\nCleanup done');

  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

run();
