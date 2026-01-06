
import "dotenv/config";
import axios from 'axios';
import crypto from 'crypto';

const mockWebhook = async () => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const url = 'http://localhost:5000/api/payments/webhook'; // Assuming local server is running

  const payload = {
    event: 'subscription.charged',
    payload: {
      subscription: {
        entity: {
          id: 'sub_S0aTPr8j6Dr1Q1', // The one we just created
          status: 'active'
        }
      },
      payment: {
        entity: {
          id: 'pay_MOK123',
          amount: 1200,
          currency: 'USD',
          order_id: 'order_MOCK123',
          subscription_id: 'sub_S0aTPr8j6Dr1Q1',
          status: 'captured'
        }
      }
    }
  };

  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  try {
    console.log('Sending mock webhook...');
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature
      }
    });

    console.log('Response:', response.data);
  } catch (error) {
    console.error('Webhook failed:', error.response?.data || error.message);
  }
};

mockWebhook();
