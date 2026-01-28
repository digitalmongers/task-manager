import { google } from 'googleapis';
import Logger from '../config/logger.js';

class IndexingService {
  constructor() {
    this.jwtClient = null;
    this.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_INDEXING_KEY;
  }

  /**
   * Initialize JWT Client for Google API
   */
  async _getClient() {
    if (this.jwtClient) {
      return this.jwtClient;
    }

    if (!this.keyFile) {
      Logger.warn('[IndexingService] No Google Service Account Key found. Indexing skipped.');
      return null;
    }

    try {
      this.jwtClient = new google.auth.JWT({
        keyFile: this.keyFile,
        scopes: ['https://www.googleapis.com/auth/indexing'],
      });

      await this.jwtClient.authorize();
      return this.jwtClient;
    } catch (error) {
      Logger.error('[IndexingService] Failed to authorize Google Client', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Notify Google about a URL update or creation
   * @param {string} url - The full URL (e.g., https://example.com/blog/post-1)
   */
  async publishUrl(url) {
    if (!url) return false;

    try {
      const client = await this._getClient();
      if (!client) return false;

      const indexing = google.indexing({ version: 'v3', auth: client });

      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED',
        },
      });

      Logger.info('[IndexingService] URL published successfully', {
        url,
        status: response.status,
        notificationResult: response.data
      });

      return true;
    } catch (error) {
      Logger.error('[IndexingService] Failed to publish URL', {
        url,
        error: error.message,
        details: error.response?.data
      });
      return false;
    }
  }

  /**
   * Notify Google about a URL deletion
   * @param {string} url - The full URL to remove
   */
  async removeUrl(url) {
    if (!url) return false;

    try {
      const client = await this._getClient();
      if (!client) return false;

      const indexing = google.indexing({ version: 'v3', auth: client });

      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_DELETED',
        },
      });

      Logger.info('[IndexingService] URL removal notified', {
        url,
        status: response.status
      });

      return true;
    } catch (error) {
      Logger.error('[IndexingService] Failed to notify URL removal', {
        url,
        error: error.message
      });
      return false;
    }
  }
}

export default new IndexingService();
