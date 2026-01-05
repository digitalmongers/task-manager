
import Task from './models/Task.js';
import VitalTask from './models/VitalTask.js';

console.log('Task steps schema:', Task.schema.paths.steps ? 'EXISTS' : 'MISSING');
console.log('VitalTask steps schema:', VitalTask.schema.paths.steps ? 'EXISTS' : 'MISSING');
process.exit(0);
