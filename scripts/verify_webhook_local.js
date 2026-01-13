import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000'; // Adjust if PORT is different in .env
const TEST_EMAIL = 'webhook_test_' + Date.now() + '@example.com';

async function verifyWebhook() {
  console.log('Testing Mailchimp Webhook...');
  console.log(`Target URL: ${BASE_URL}/api/newsletter/webhook`);
  console.log(`Test Email: ${TEST_EMAIL}`);

  try {
    // 1. Verify GET (Mailchimp checking if endpoint exists)
    console.log('\n--- 1. Testing GET verification ---');
    const getResponse = await fetch(`${BASE_URL}/api/newsletter/webhook`);
    console.log(`GET Status: ${getResponse.status}`);
    const getText = await getResponse.text();
    console.log(`GET Body: ${getText}`);

    if (getResponse.status === 200) {
        console.log('✅ GET Verification passed.');
    } else {
        console.log('❌ GET Verification failed.');
    }

    // 2. Verify POST (Simulating unsubscribe event)
    console.log('\n--- 2. Testing POST unsubscribe event ---');
    const params = new URLSearchParams();
    params.append('type', 'unsubscribe');
    params.append('data[email]', TEST_EMAIL);
    params.append('data[action]', 'unsub');
    params.append('data[reason]', 'manual');
    params.append('data[id]', '123456');
    params.append('data[list_id]', 'abcdef');

    const postResponse = await fetch(`${BASE_URL}/api/newsletter/webhook`, {
      method: 'POST',
      body: params,
      // headers: { 'Content-Type': 'application/x-www-form-urlencoded' } // fetch handles this for URLSearchParams
    });

    console.log(`POST Status: ${postResponse.status}`);
    const postText = await postResponse.text();
    console.log(`POST Body: ${postText}`);

    if (postResponse.status === 200) {
        console.log('✅ POST Webhook simulation passed.');
        console.log('   (Check your local database "newslettersubscribers" collection to confirm the user was created/updated as "unsubscribed")');
    } else {
        console.log('❌ POST Webhook simulation failed.');
    }

  } catch (error) {
    console.error('❌ ERROR: Could not connect to API.');
    console.error(error);
  }
}

verifyWebhook();
