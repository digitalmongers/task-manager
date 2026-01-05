import http from 'http';
import https from 'https';
import { URL } from 'url';
import Logger from '../config/logger.js';

/**
 * Robust SSRF protection: Blocks private/internal IP ranges
 */
const isPrivateIP = (ip) => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true; // Block IPv6 for simplicity or if malformed
  
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  );
};

/**
 * Extracts OG metadata from a URL
 */
export const getLinkPreview = async (urlStr) => {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return resolve(null);
      }

      // 1. Basic SSRF check (Hostname level)
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
        return resolve(null);
      }

      const transport = url.protocol === 'https:' ? https : http;
      
      const options = {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DobbyBot/1.0; +http://dobby.com)',
          'Accept': 'text/html',
        }
      };

      const req = transport.get(url, options, (res) => {
        // Only process HTML
        const contentType = res.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          res.resume(); // Consume stream
          return resolve(null);
        }

        let html = '';
        const maxSize = 512 * 1024; // 512KB limit

        res.on('data', (chunk) => {
          html += chunk;
          if (html.length > maxSize) {
            req.destroy();
            resolve(extractMetadata(html, urlStr));
          }
        });

        res.on('end', () => {
          resolve(extractMetadata(html, urlStr));
        });
      });

      req.on('error', (err) => {
        Logger.error('Link preview fetch error', { url: urlStr, error: err.message });
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

    } catch (e) {
      resolve(null);
    }
  });
};

/**
 * Regex-based metadata extraction (Performance optimized)
 */
const extractMetadata = (html, originalUrl) => {
  try {
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || 
                       html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i) ||
                      html.match(/<meta name="description" content="([^"]+)"/i);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    const siteMatch = html.match(/<meta property="og:site_name" content="([^"]+)"/i);

    const title = titleMatch ? (titleMatch[1] || titleMatch[0]).trim() : null;
    let description = descMatch ? descMatch[1].trim() : null;
    let image = imageMatch ? imageMatch[1] : null;

    if (!title) return null;

    // Fix relative image URLs
    if (image && image.startsWith('/')) {
      const url = new URL(originalUrl);
      image = `${url.protocol}//${url.hostname}${image}`;
    }

    // Truncate description
    if (description && description.length > 200) {
      description = description.substring(0, 197) + '...';
    }

    return {
      url: originalUrl,
      title: title.substring(0, 100),
      description,
      image,
      siteName: siteMatch ? siteMatch[1] : null
    };
  } catch (e) {
    return null;
  }
};
