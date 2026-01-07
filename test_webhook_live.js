import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const testWebhookLive = async () => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    // Replace with your actual Render URL
    const url = 'https://task-manager-ljbx.onrender.com/api/payments/webhook';

    const payload = {
        event: 'subscription.charged',
        payload: {
            subscription: {
                entity: {
                    id: 'sub_test_live_ping'
                }
            },
            payment: {
                entity: {
                    id: 'pay_test_live_ping',
                    subscription_id: 'sub_test_live_ping',
                    order_id: 'order_test_live_ping',
                    status: 'captured'
                }
            }
        }
    };

    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    console.log(`Sending Webhook to: ${url}`);
    console.log(`Signature: ${signature}`);

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'x-razorpay-signature': signature,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Response Status:', response.status);
        console.log('✅ Response Data:', response.data);
    } catch (error) {
        if (error.response) {
            console.error('❌ Server Error Status:', error.response.status);
            console.error('❌ Server Error Data:', error.response.data);
        } else if (error.request) {
            console.error('❌ No Response Received (Network/Timeout):', error.message);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
};

testWebhookLive();
