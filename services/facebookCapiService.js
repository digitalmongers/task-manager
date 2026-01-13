import crypto from 'crypto';
import https from 'https';
import Logger from '../config/logger.js';

class FacebookCapiService {
  constructor() {
    this.pixelId = process.env.META_PIXEL_ID;
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.apiVersion = 'v18.0';
    this.baseUrl = `graph.facebook.com`;
    this.enabled = this.pixelId && this.accessToken;

    if (!this.enabled) {
      Logger.warn('Meta CAPI is disabled: Missing META_PIXEL_ID or META_ACCESS_TOKEN');
    }
  }

  /**
   * Universal SHA-256 hashing for Meta PII requirements
   */
  hash(value) {
    if (!value) return null;
    return crypto
      .createHash('sha256')
      .update(String(value).trim().toLowerCase())
      .digest('hex');
  }

  /**
   * Build user data object according to Meta standards
   * @param {Object} user - User document or data
   * @param {Object} req - Express request object for IP/UA
   */
  buildUserData(user, req) {
    const userData = {
      client_ip_address: req ? (req.ip || req.connection.remoteAddress) : null,
      client_user_agent: req ? req.headers['user-agent'] : null,
      fbc: req ? req.cookies['_fbc'] : null,
      fbp: req ? req.cookies['_fbp'] : null,
    };

    if (user) {
      if (user.email) userData.em = [this.hash(user.email)];
      if (user.phoneNumber) userData.ph = [this.hash(user.phoneNumber)];
      if (user.firstName) userData.fn = [this.hash(user.firstName)];
      if (user.lastName) userData.ln = [this.hash(user.lastName)];
      if (user._id) userData.external_id = [this.hash(user._id.toString())];
    }

    // Clean up null/undefined
    return Object.fromEntries(Object.entries(userData).filter(([_, v]) => v != null));
  }

  /**
   * Construct event object
   */
  constructEvent(eventName, eventId, userData, customData = {}, eventSourceUrl = '') {
    return {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: eventSourceUrl,
      action_source: 'website',
      user_data: userData,
      custom_data: customData,
    };
  }

  /**
   * Send event(s) to Meta Graph API
   */
  async sendEvent(events) {
    if (!this.enabled) return;

    const payload = JSON.stringify({
      data: Array.isArray(events) ? events : [events],
      test_event_code: process.env.NODE_ENV !== 'production' ? (process.env.META_TEST_EVENT_CODE || null) : null,
    });

    const options = {
      hostname: this.baseUrl,
      path: `/${this.apiVersion}/${this.pixelId}/events?access_token=${this.accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            Logger.info('Meta CAPI Event Sent Successfully', {
              events: Array.isArray(events) ? events.map(e => e.event_name) : events.event_name,
              ids: Array.isArray(events) ? events.map(e => e.event_id) : events.event_id
            });
            resolve({ success: true, data: JSON.parse(responseBody) });
          } else {
            Logger.error('Meta CAPI API Error', {
              status: res.statusCode,
              body: responseBody,
              events: Array.isArray(events) ? events.map(e => e.event_name) : events.event_name
            });
            resolve({ success: false, error: responseBody });
          }
        });
      });

      req.on('error', (err) => {
        Logger.error('Meta CAPI Connection Error', { error: err.message });
        resolve({ success: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }

  // --- Helper Methods for Specific Events ---

  async trackPurchase(user, req, payment) {
    const eventId = payment.razorpayPaymentId || `pur_${payment._id}`;
    const userData = this.buildUserData(user, req);
    const customData = {
      value: payment.amount, // Razorpay amount is usually already in the correct unit if handled properly in DB
      currency: (payment.currency || 'USD').toUpperCase(),
      order_id: payment.razorpayOrderId || payment._id.toString(),
      content_type: 'product',
      contents: [{
        id: payment.plan || payment.topupPackage,
        quantity: 1,
        item_price: payment.amount
      }]
    };

    const event = this.constructEvent(
      'Purchase',
      eventId,
      userData,
      customData,
      req ? `${req.protocol}://${req.get('host')}${req.originalUrl}` : ''
    );

    return this.sendEvent(event);
  }

  async trackInitiateCheckout(user, req, planInfo) {
    const eventId = `init_${user._id}_${Date.now()}`;
    const userData = this.buildUserData(user, req);
    const customData = {
      value: planInfo.price,
      currency: (planInfo.currency || 'USD').toUpperCase(),
      content_ids: [planInfo.id],
      content_type: 'product'
    };

    const event = this.constructEvent(
      'InitiateCheckout',
      eventId,
      userData,
      customData,
      req ? `${req.protocol}://${req.get('host')}${req.originalUrl}` : ''
    );

    return this.sendEvent(event);
  }

  async trackSubscribe(user, req, subscription) {
    const eventId = subscription.id || `sub_${user._id}_${Date.now()}`;
    const userData = this.buildUserData(user, req);
    const customData = {
      predicted_ltv: subscription.amount * 12, // Simple LTV estimation
      currency: (subscription.currency || 'USD').toUpperCase(),
      value: subscription.amount
    };

    const event = this.constructEvent('Subscribe', eventId, userData, customData);
    return this.sendEvent(event);
  }

  async trackSearch(user, req, searchQuery) {
    const userData = this.buildUserData(user, req);
    const customData = { search_string: searchQuery };
    const event = this.constructEvent('Search', `search_${user._id}_${Date.now()}`, userData, customData);
    return this.sendEvent(event);
  }

  async trackViewContent(user, req, contentInfo) {
    const userData = this.buildUserData(user, req);
    const customData = {
      content_category: contentInfo.category,
      content_ids: [contentInfo.id],
      content_name: contentInfo.name,
      content_type: 'product',
      value: contentInfo.price,
      currency: 'USD'
    };
    const event = this.constructEvent('ViewContent', `view_${user._id}_${Date.now()}`, userData, customData);
    return this.sendEvent(event);
  }

  async trackStartTrial(user, req, trialInfo = { plan: 'FREE', value: 0 }) {
    const userData = this.buildUserData(user, req);
    const customData = {
      content_name: trialInfo.plan,
      currency: 'USD',
      value: trialInfo.value
    };
    const event = this.constructEvent('StartTrial', `trial_${user._id}_${Date.now()}`, userData, customData);
    return this.sendEvent(event);
  }

  async trackAddPaymentInfo(user, req, paymentInfo) {
    const userData = this.buildUserData(user, req);
    const customData = {
      content_ids: paymentInfo.contentIds,
      content_type: 'product',
      value: paymentInfo.value,
      currency: paymentInfo.currency || 'USD'
    };
    const event = this.constructEvent(
      'AddPaymentInfo', 
      `pay_info_${user._id}_${Date.now()}`, 
      userData, 
      customData,
      req ? `${req.protocol}://${req.get('host')}${req.originalUrl}` : ''
    );
    return this.sendEvent(event);
  }
}

export default new FacebookCapiService();
