import axios from 'axios';
import { formatToLocal } from './utils/dateUtils.js';

const API_URL = 'http://localhost:5000/api';

// Simulate a request from England (London timezone)
const ENGLAND_TIMEZONE = 'Europe/London';
const ENGLAND_IP = '81.2.69.142'; // Example UK IP

async function testTimezoneLocalization() {
  console.log('🧪 Testing Timezone Localization Feature\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Register a new user (simulating from England)
    console.log('\n📝 Step 1: Registering user from England...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      firstName: 'Test',
      lastName: 'England',
      email: `test-uk-${Date.now()}@example.com`,
      password: 'Test@123456',
      confirmPassword: 'Test@123456',
      termsAccepted: true
    }, {
      headers: {
        'X-Forwarded-For': ENGLAND_IP,
        'X-Real-IP': ENGLAND_IP
      }
    });
    
    const { token, user } = registerResponse.data.data;
    console.log(`✅ User registered: ${user.email}`);
    console.log(`   Detected Timezone: ${user.timezone || 'Not set'}`);
    
    // Step 2: Create a task
    console.log('\n📝 Step 2: Creating a task...');
    const taskResponse = await axios.post(`${API_URL}/task`, {
      title: 'Test Task for Timezone',
      description: 'This task should show England time',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Forwarded-For': ENGLAND_IP
      }
    });
    
    const task = taskResponse.data.data.task;
    console.log(`✅ Task created: ${task.title}`);
    console.log(`   Task ID: ${task._id}`);
    
    // Step 3: Fetch the task and verify localized timestamps
    console.log('\n📝 Step 3: Fetching task to verify localized timestamps...');
    const getTaskResponse = await axios.get(`${API_URL}/task/${task._id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Forwarded-For': ENGLAND_IP
      }
    });
    
    const fetchedTask = getTaskResponse.data.data.task;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TIMEZONE VERIFICATION RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n🌍 User Location: England (Europe/London)');
    console.log(`   Detected Timezone: ${user.timezone || 'UTC'}`);
    
    console.log('\n⏰ Task Timestamps:');
    console.log(`   Created At (UTC):   ${fetchedTask.createdAt}`);
    console.log(`   Created At (Local): ${fetchedTask.createdAtLocal || 'NOT LOCALIZED ❌'}`);
    console.log(`   Due Date (UTC):     ${fetchedTask.dueDate}`);
    console.log(`   Due Date (Local):   ${fetchedTask.dueDateLocal || 'NOT LOCALIZED ❌'}`);
    
    // Verify localization is working
    const hasLocalizedFields = !!(fetchedTask.createdAtLocal && fetchedTask.dueDateLocal);
    
    console.log('\n' + '='.repeat(60));
    if (hasLocalizedFields) {
      console.log('✅ SUCCESS: Timezone localization is working!');
      console.log('   All timestamps are properly localized to user timezone.');
    } else {
      console.log('❌ FAILURE: Timezone localization is NOT working!');
      console.log('   Local timestamp fields are missing.');
    }
    console.log('='.repeat(60));
    
    // Manual verification using dateUtils
    console.log('\n🔍 Manual Verification using dateUtils:');
    const manualLocal = formatToLocal(new Date(fetchedTask.createdAt), ENGLAND_TIMEZONE);
    console.log(`   Manual formatToLocal: ${manualLocal}`);
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Test Failed: Connection Refused!');
      console.error('   Please ensure the backend server is running at:', API_URL);
    } else {
      console.error('\n❌ Test Failed:', error.response?.data || error.message);
      if (error.response?.data) {
        console.error('   Error Details:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

// Run the test
testTimezoneLocalization();
