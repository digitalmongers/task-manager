import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000'; // Adjust if PORT is different in .env
const TEST_EMAIL = 'test_newsletter_' + Date.now() + '@example.com';

async function verifyNewsletter() {
  console.log('Testing Newsletter Subscription...');
  console.log(`Target URL: ${BASE_URL}/api/newsletter/subscribe`);
  console.log(`Test Email: ${TEST_EMAIL}`);

  try {
    const response = await fetch(`${BASE_URL}/api/newsletter/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });

    const data = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', data);

    if (response.status === 200 && data.success) {
      console.log('✅ SUCCESS: Newsletter subscription endpoint is reachable and returned success.');
    } else if (response.status === 500) {
      console.log('⚠️  NOTE: Received 500 error. This is EXPECTED if Mailchimp API keys are invalid or missing in .env.');
      console.log('   Please check your .env file for MAILCHIMP_API_KEY, MAILCHIMP_SERVER, and MAILCHIMP_AUDIENCE_ID.');
    } else {
      console.log('❌ FAILURE: Unexpected response status or body.');
    }

  } catch (error) {
    console.error('❌ ERROR: Could not connect to API.');
    console.error(error);
  }
}

verifyNewsletter();
