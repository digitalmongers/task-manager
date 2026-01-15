import TaskPriorityRepository from '../repositories/taskPriorityRepository.js';
import CategoryRepository from '../repositories/categoryRepository.js';

console.log('Verifying Repository Fixes...');

let success = true;

if (typeof TaskPriorityRepository.findOne === 'function') {
  console.log('✅ TaskPriorityRepository.findOne is a function');
} else {
  console.error('❌ TaskPriorityRepository.findOne is NOT a function');
  success = false;
}

if (typeof CategoryRepository.findOne === 'function') {
  console.log('✅ CategoryRepository.findOne is a function');
} else {
  console.error('❌ CategoryRepository.findOne is NOT a function');
  success = false;
}

if (success) {
  console.log('🎉 Verification PASSED');
  process.exit(0);
} else {
  console.error('💥 Verification FAILED');
  process.exit(1);
}
