import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import Logger from '../config/logger.js';

/**
 * RequestInfoService - Extract and parse request metadata
 * 
 * ASSUMPTIONS:
 * - User-Agent header may be missing or malformed
 * - IP address may be proxied or missing
 * - GeoIP database may not have all IPs
 * 
 * EDGE CASES HANDLED:
 * - Missing or invalid User-Agent
 * - Missing or invalid IP address
 * - Proxy headers (X-Forwarded-For, X-Real-IP)
 * - IPv6 addresses
 * - Private/local IP addresses
 * 
 * FAILURE SCENARIOS:
 * - Invalid input: Return safe defaults
 * - Parsing errors: Log and return 'Unknown'
 */

class RequestInfoService {
  /**
   * Extract real IP address from request
   * Handles proxy headers safely
   * 
   * @param {Object} req - Express request object
   * @returns {string} IP address
   */
  getClientIp(req) {
    if (!req) {
      return 'Unknown';
    }

    try {
      // Check proxy headers first (in order of trust)
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
        // Take the first one (original client)
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        if (ips[0] && this.isValidIp(ips[0])) {
          return ips[0];
        }
      }

      const realIp = req.headers['x-real-ip'];
      if (realIp && this.isValidIp(realIp)) {
        return realIp;
      }

      // Fallback to req.ip (Express default)
      if (req.ip && this.isValidIp(req.ip)) {
        // Remove IPv6 prefix if present
        return req.ip.replace(/^::ffff:/, '');
      }

      // Last resort: connection remote address
      if (req.connection?.remoteAddress) {
        return req.connection.remoteAddress.replace(/^::ffff:/, '');
      }

      return 'Unknown';
    } catch (error) {
      Logger.warn('Failed to extract client IP', {
        error: error.message,
      });
      return 'Unknown';
    }
  }

  /**
   * Basic IP validation
   */
  isValidIp(ip) {
    if (!ip || typeof ip !== 'string') {
      return false;
    }

    // IPv4 regex
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 regex (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Mask IP address for privacy
   * Example: 192.168.1.100 -> 192.xxx.xxx.xxx
   * 
   * @param {string} ip - IP address
   * @returns {string} Masked IP
   */
  maskIp(ip) {
    if (!ip || ip === 'Unknown') {
      return 'Unknown';
    }

    try {
      // IPv4
      if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.xxx.xxx.xxx`;
        }
      }

      // IPv6 - mask last 4 groups
      if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 4) {
          return parts.slice(0, 4).join(':') + ':xxxx:xxxx:xxxx:xxxx';
        }
      }

      return 'xxx.xxx.xxx.xxx';
    } catch (error) {
      Logger.warn('Failed to mask IP', {
        error: error.message,
      });
      return 'xxx.xxx.xxx.xxx';
    }
  }

  /**
   * Parse User-Agent string
   * 
   * @param {string} userAgent - User-Agent header
   * @returns {Object} Parsed UA data
   */
  parseUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
      return {
        browser: 'Unknown',
        os: 'Unknown',
        deviceType: 'unknown',
      };
    }

    try {
      const parser = new UAParser(userAgent);
      const result = parser.getResult();

      const browser = result.browser?.name || 'Unknown';
      const browserVersion = result.browser?.version || '';
      const os = result.os?.name || 'Unknown';
      const osVersion = result.os?.version || '';
      
      // Determine device type
      let deviceType = 'desktop';
      if (result.device?.type === 'mobile') {
        deviceType = 'mobile';
      } else if (result.device?.type === 'tablet') {
        deviceType = 'tablet';
      } else if (result.device?.type) {
        deviceType = result.device.type;
      }

      return {
        browser: browserVersion ? `${browser} ${browserVersion}` : browser,
        os: osVersion ? `${os} ${osVersion}` : os,
        deviceType,
        raw: userAgent,
      };
    } catch (error) {
      Logger.warn('Failed to parse User-Agent', {
        error: error.message,
        userAgent: userAgent?.substring(0, 50),
      });
      return {
        browser: 'Unknown',
        os: 'Unknown',
        deviceType: 'unknown',
        raw: userAgent,
      };
    }
  }

  /**
   * Get geo-location from IP address
   * 
   * @param {string} ip - IP address
   * @returns {Object} Location data
   */
  getLocation(ip) {
    if (!ip || ip === 'Unknown' || !this.isValidIp(ip)) {
      return {
        country: 'Unknown',
        city: 'Unknown',
      };
    }

    try {
      // Skip private/local IPs
      if (this.isPrivateIp(ip)) {
        return {
          country: 'Local',
          city: 'Local',
        };
      }

      const geo = geoip.lookup(ip);

      if (!geo) {
        return {
          country: 'Unknown',
          city: 'Unknown',
        };
      }

      return {
        country: geo.country || 'Unknown',
        city: geo.city || 'Unknown',
        region: geo.region || null,
        timezone: geo.timezone || null,
      };
    } catch (error) {
      Logger.warn('Failed to get geo-location', {
        error: error.message,
        ip: this.maskIp(ip),
      });
      return {
        country: 'Unknown',
        city: 'Unknown',
      };
    }
  }

  /**
   * Check if IP is private/local
   */
  isPrivateIp(ip) {
    if (!ip) return false;

    // Private IPv4 ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/i,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Extract all request info in one call
   * 
   * @param {Object} req - Express request object
   * @returns {Object} Complete request info
   */
  extractRequestInfo(req) {
    if (!req) {
      throw new Error('Request object is required');
    }

    const ip = this.getClientIp(req);
    const userAgent = req.headers?.['user-agent'] || 'Unknown';
    const uaData = this.parseUserAgent(userAgent);
    const location = this.getLocation(ip);

    return {
      ipAddress: ip,
      ipMasked: this.maskIp(ip),
      userAgentRaw: userAgent,
      browser: uaData.browser,
      os: uaData.os,
      deviceType: uaData.deviceType,
      country: location.country,
      city: location.city,
      region: location.region,
      timezone: location.timezone,
    };
  }
}

export default new RequestInfoService();
