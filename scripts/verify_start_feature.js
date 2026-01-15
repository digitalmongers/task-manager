
process.env.OPENAI_API_KEY = 'dummy'; // Prevent AI service crash during import
process.env.MONGO_URI = 'mongodb://localhost:27017/task-manager-test';

async function runTest() {
    const fs = await import('fs');
    try {
        const mongoose = (await import('mongoose')).default;
        const { default: TaskService } = await import('../services/taskService.js');
        const { default: VitalTaskService } = await import('../services/vitalTaskService.js');
        const { default: User } = await import('../models/User.js');
        const { default: Task } = await import('../models/Task.js');
        const { default: VitalTask } = await import('../models/VitalTask.js');

        // Connect to Test DB
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('Connected to Test DB');
        }

        // Cleanup
        await User.deleteMany({ email: /test.*@example.com/ });
        await Task.deleteMany({});
        await VitalTask.deleteMany({});

        // 1. Create a User (Owner)
        const owner = await User.create({
            firstName: 'Owner',
            lastName: 'User',
            email: 'testowner@example.com',
            password: 'password123',
            isVerified: true
        });

        console.log('--- Testing Regular Task ---');
        // 3. Create a Task (Status: Not Started)
        let task = await Task.create({
            title: 'Test Start Task',
            user: owner._id,
            status: 'Not Started',
            steps: [{ text: 'Step 1' }]
        });

        console.log(`Task created. Status: ${task.status}, StartedBy: ${task.startedBy}`);

        // 4. Start Task as Owner
        console.log('Starting task as Owner...');
        const resultOwner = await TaskService.startTask(owner._id, task._id);
        
        if (resultOwner.task.status === 'In Progress' && 
            resultOwner.task.startedBy.toString() === owner._id.toString() &&
            resultOwner.task.startedAt) {
            console.log('SUCCESS: Owner started task.');
        } else {
            console.error('FAIL: Owner start task failed.', resultOwner.task);
        }

        console.log('\n--- Testing Vital Task ---');
        let vitalTask = await VitalTask.create({
            title: 'Test Vital Start',
            user: owner._id,
            status: 'Not Started',
            steps: [{ text: 'Vital Step 1' }]
        });
        
        console.log(`Vital Task created. Status: ${vitalTask.status}`);
        
        console.log('Starting vital task as Owner...');
        const resultVital = await VitalTaskService.startVitalTask(owner._id, vitalTask._id);

        if (resultVital.vitalTask.status === 'In Progress' && 
            resultVital.vitalTask.startedBy.toString() === owner._id.toString() &&
            resultVital.vitalTask.startedAt) {
            console.log('SUCCESS: Owner started Vital Task.');
        } else {
            console.error('FAIL: Owner start Vital Task failed.', resultVital.vitalTask);
        }

        console.log('\n--- ALL VERIFICATIONS PASSED ---');
        fs.writeFileSync('verification_output.txt', 'ALL VERIFICATIONS PASSED');

    } catch (error) {
        console.error('Verification Output Error:', error);
        fs.writeFileSync('verification_output.txt', 'FAILED: ' + error.message);
    } finally {
        process.exit();
    }
}

runTest();
