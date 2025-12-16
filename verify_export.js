
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import User from './models/User.js';
import Task from './models/Task.js';
import ExportService from './services/exportService.js';
import TaskService from './services/taskService.js';

dotenv.config();

const run = async () => {
    try {
        if (!process.env.MONGO_URI) {
           throw new Error('MONGO_URI is not defined in .env');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const suffix = Date.now().toString();
        // Create User
        const user = await User.create({
            firstName: 'Export',
            lastName: 'Tester',
            email: `export_${suffix}@test.com`,
            password: 'password123',
            passwordConfirm: 'password123'
        });
        
        // Create Tasks
        await TaskService.createTask(user._id, { title: 'Task 1' });
        
        // Toggle completion on the first task
        const tasks = await Task.find({ user: user._id });
        if(tasks.length > 0) {
             await TaskService.toggleComplete(user._id, tasks[0]._id);
        }

        await TaskService.createTask(user._id, { title: 'Task 2' });
        
        console.log('User and Data created');

        // Mock Response Object
        const writeStream = fs.createWriteStream('test_export.pdf');
        
        // Calling Service Directly
        console.log('Generating PDF...');
        await ExportService.generateUserDataPdf(user._id, writeStream);
        
        console.log('PDF generation initiated. Implementation creates stream asynchronously.');
        
        // Wait for finish
        await new Promise((resolve) => {
            writeStream.on('finish', () => {
                console.log('PDF File written successfully: test_export.pdf');
                resolve();
            });
             writeStream.on('error', (err) => {
                console.error('PDF File write error:', err);
                resolve();
            });
        });

        // Cleanup
        await User.deleteOne({_id: user._id});
        await Task.deleteMany({user: user._id});
        console.log('Cleanup done');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
