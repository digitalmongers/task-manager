import axios from "axios";
import Logger from "../config/logger.js";

/**
 * Enterprise Analytics Service
 * Implements GA4 Measurement Protocol for server-side tracking
 * This bypasses ad-blockers and ensures 100% accuracy for critical business events.
 */
class AnalyticsService {
  constructor() {
    this.measurementId = process.env.GA4_MEASUREMENT_ID;
    this.apiSecret = process.env.GA4_API_SECRET;
    this.endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;
    this.debugEndpoint = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;
  }

  /**
   * Tracks an event to GA4
   * @param {string} clientId - Unique client identifier (e.g., user ID or session ID)
   * @param {string} eventName - Name of the event (e.g., 'purchase', 'login')
   * @param {object} params - Event parameters
   */
  async trackEvent(clientId, eventName, params = {}) {
    if (!this.measurementId || !this.apiSecret) {
      Logger.debug("GA4 Analytics skipped: GA4_MEASUREMENT_ID or GA4_API_SECRET missing in .env");
      return;
    }

    const payload = {
      client_id: clientId || 'anonymous_backend_user',
      events: [{
        name: eventName,
        params: {
          ...params,
          engagement_time_msec: "100", // Standard param
          source: 'backend'
        },
      }],
    };

    try {
      // In production, we fire and forget or use a queue. For now, we await but handle error.
      const response = await axios.post(this.endpoint, payload);
      
      Logger.debug("GA4 Event tracked successfully:", { 
        eventName, 
        clientId,
        status: response.status 
      });
    } catch (error) {
      Logger.error("GA4 Analytics tracking failed:", { 
        error: error.message,
        eventName,
        clientId
      });
    }
  }

  /**
   * Specifically track business critical events
   */
  async trackPurchase(user, plan, amount, currency = 'INR') {
    return this.trackEvent(user._id.toString(), 'purchase', {
      transaction_id: `TXN_${Date.now()}`,
      value: amount,
      currency: currency,
      items: [{
        item_id: plan.id,
        item_name: plan.name,
        price: amount,
        quantity: 1
      }]
    });
  }

  async trackUserLogin(user) {
    return this.trackEvent(user._id.toString(), 'login', {
      method: 'password'
    });
  }

  async trackAIGeneration(user, model) {
    return this.trackEvent(user._id.toString(), 'ai_prediction', {
      model: model,
      feature: 'collaboration_synergy'
    });
  }
}

export default new AnalyticsService();
