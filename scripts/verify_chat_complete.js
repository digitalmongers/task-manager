
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Simple Login Helper
async function login(email, password) {
  try {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    return res.data.data.token;
  } catch (error) {
    if (error.response?.status === 404) {
       // Try to register if login fails (user might not exist)
       return null;
    }
    console.error('Login failed:', error.response?.data || error.message);
    console.error('Full Error:', error);
    throw error;
  }
}

async function register(firstName, lastName, email, password) {
    try {
        await axios.post(`${API_URL}/auth/register`, {
            firstName, lastName, email, password
        });
        return await login(email, password);
    } catch (error) {
         console.error('Register failed:', error.response?.data || error.message);
         throw error;
    }
}

async function getOrRegisterUser(firstName, lastName, email, password) {
    let token = await login(email, password);
    if (!token) {
        console.log(`User ${email} not found, registering...`);
        token = await register(firstName, lastName, email, password);
    }
    return token;
}

async function run() {
  console.log('--- Starting Chat Flow Verification (Standalone) ---');

  try {
    const ownerEmail = `chat_owner_${Date.now()}@test.com`;
    const collabEmail = `chat_collab_${Date.now()}@test.com`;
    const password = 'password123';

    // 1. Setup Users
    const ownerToken = await getOrRegisterUser('Chat', 'Owner', ownerEmail, password);
    console.log('✓ Owner Logged In');

    const collabToken = await getOrRegisterUser('Chat', 'Collab', collabEmail, password);
    console.log('✓ Collaborator Logged In');

    // 2. Create Task
    const taskRes = await axios.post(`${API_URL}/tasks`, {
      title: 'Chat Test Task',
      description: 'Testing chat persistence',
      status: 'In Progress',
      priority: 'High',
      dueDate: new Date()
    }, { headers: { Authorization: `Bearer ${ownerToken}` } });
    
    const taskId = taskRes.data.data._id;
    console.log(`✓ Task Created: ${taskId}`);

    // 3. Add Collaborator
    await axios.post(`${API_URL}/tasks/${taskId}/collaborators`, {
      email: collabEmail,
      role: 'editor'
    }, { headers: { Authorization: `Bearer ${ownerToken}` } });
    console.log('✓ Collaborator Added');

    // 4. Send Message (Owner)
    console.log('--- Sending Message ---');
    const sendRes = await axios.post(`${API_URL}/chat/${taskId}/send`, {
      content: 'Hello World Persistence Test',
      messageType: 'text',
      clientSideId: 'test-uuid-123'
    }, { headers: { Authorization: `Bearer ${ownerToken}` } });

    if (sendRes.status === 201) {
        console.log('✓ Message Sent Successfully');
    } else {
        console.error('X Message Send Failed', sendRes.data);
    }

    // 5. Verify History (Owner - Simulate Refresh)
    console.log('--- Verifying History (Owner) ---');
    const ownerHistory = await axios.get(`${API_URL}/chat/${taskId}/history?limit=50`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
    });
    
    // VERIFY STRUCTURE
    if (Array.isArray(ownerHistory.data.data)) {
        console.log('✓ Owner History Data is an ARRAY (Correct Structure)');
        const msg = ownerHistory.data.data.find(m => m.clientSideId === 'test-uuid-123');
        if (msg) console.log('✓ Message Found in Owner History');
        else console.error('X Message NOT Found in Owner History');
    } else {
        console.error('X Owner History Data is NOT an Array. It is:', typeof ownerHistory.data.data);
        console.log('Structure:', JSON.stringify(ownerHistory.data, null, 2));
    }

    // 6. Verify History (Collaborator - Simulate Receiver View)
    console.log('--- Verifying History (Collaborator) ---');
    const collabHistory = await axios.get(`${API_URL}/chat/${taskId}/history?limit=50`, {
        headers: { Authorization: `Bearer ${collabToken}` }
    });

    if (Array.isArray(collabHistory.data.data)) {
        console.log('✓ Collab History Data is an ARRAY (Correct Structure)');
        const msg = collabHistory.data.data.find(m => m.content === 'Hello World Persistence Test'); 
        if (msg) console.log('✓ Message Found in Collab History');
        else console.error('X Message NOT Found in Collab History');
    } else {
        console.error('X Collab History Data is NOT an Array. It is:', typeof collabHistory.data.data);
         console.log('Structure:', JSON.stringify(collabHistory.data, null, 2));
    }

    console.log('--- Verification Complete ---');

  } catch (error) {
    console.error('Verification Failed:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
  }
}

run();
