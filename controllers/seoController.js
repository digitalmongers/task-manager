import cacheService, { TTL } from "../services/cacheService.js";
import Logger from "../config/logger.js";
import SitemapPage from "../models/SitemapPage.js";
import IndexingService from "../services/indexingService.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { HTTP_STATUS } from "../config/constants.js";

/**
 * Enterprise SEO Controller
 * Handles dynamic sitemap generation and crawlers instructions
 */
class SEOController {
  /**
   * Generates professional robots.txt
   * @param {Request} req
   * @param {Response} res
   */
  async getRobots(req, res) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://tasskr.com';
    
    // Set X-Robots-Tag for enterprise level control
    res.setHeader('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');

    const robots = [
      '# Advanced Task Management Suite - Tasskr',
      '# Professional Crawler Instructions',
      '',
      'User-agent: *',
      'Allow: /',
      'Allow: /public/',
      '',
      '# Disallow sensitive paths',
      'Disallow: /api/',
      'Disallow: /auth/',
      'Disallow: /admin/',
      'Disallow: /config/',
      'Disallow: /scripts/',
      'Disallow: /user/settings',
      'Disallow: /user/billing',
      '',
      '# Specific bot overrides',
      'User-agent: Googlebot',
      'Allow: /',
      'Disallow: /search',
      '',
      'User-agent: Bingbot',
      'Allow: /',
      '',
      `# Sitemap location`,
      `Sitemap: ${frontendUrl}/sitemap.xml`,
      '',
      '# Security and Anti-Scraping',
      'Crawl-delay: 1'
    ].join('\n');

    res.type('text/plain');
    return res.send(robots);
  }

  /**
   * Generates dynamic sitemap.xml with caching and advanced namespaces
   * @param {Request} req
   * @param {Response} res
   */
  async getSitemap(req, res) {
    try {
      const cacheKey = '/seo/sitemap';
      
      const sitemap = await cacheService.remember(cacheKey, TTL.SHORT, async () => {
        const frontendUrl = (process.env.FRONTEND_URL || 'https://tasskr.com').replace(/\/$/, '');
        const today = new Date().toISOString().split('T')[0];

        // Define core public pages from live site audit
        const pages = [
          { url: '/', priority: '1.0', changefreq: 'daily' },
          { url: '/pricing', priority: '0.9', changefreq: 'daily' },
          { url: '/faqs', priority: '0.7', changefreq: 'daily' },
          { url: '/blog', priority: '0.7', changefreq: 'daily' },
          { url: '/contact-us', priority: '0.7', changefreq: 'daily' },
          { url: '/about-us', priority: '0.6', changefreq: 'daily' },
          { url: '/boost-topup', priority: '0.6', changefreq: 'daily' },
          { url: '/terms-conditions', priority: '0.4', changefreq: 'daily' },
          { url: '/privacy-policy', priority: '0.4', changefreq: 'daily' },
          { url: '/refund-policy', priority: '0.4', changefreq: 'daily' },
          { url: '/shipping-policy', priority: '0.4', changefreq: 'daily' },
          { url: '/data-deletion', priority: '0.3', changefreq: 'daily' },
        ];

        // Fetch dynamic pages from database
        try {
          const dynamicPages = await SitemapPage.find({}).lean();
          dynamicPages.forEach(page => {
            // Avoid duplicates
            if (!pages.find(p => p.url === page.url)) {
              pages.push({
                url: page.url,
                priority: page.priority || '0.7',
                changefreq: page.changefreq || 'weekly',
                lastmod: page.lastmod ? new Date(page.lastmod).toISOString().split('T')[0] : today
              });
            }
          });
        } catch (dbError) {
          Logger.error('Failed to fetch dynamic sitemap pages:', { error: dbError.message });
        }

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" \n';
        xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" \n';
        xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

        pages.forEach(page => {
          xml += '  <url>\n';
          xml += `    <loc>${frontendUrl}${page.url}</loc>\n`;
          xml += `    <lastmod>${page.lastmod || today}</lastmod>\n`;
          xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
          xml += `    <priority>${page.priority}</priority>\n`;
          xml += '  </url>\n';
        });

        xml += '</urlset>';
        return xml;
      });

      res.type('application/xml');
      return res.send(sitemap);
    } catch (error) {
      Logger.error('Sitemap generation failed:', { error: error.message });
      res.status(500).send('Error generating sitemap');
    }
  }

  /**
   * Implements security.txt (RFC 9116)
   * Enterprise standard for vulnerability disclosure
   */
  async getSecurityTxt(req, res) {
    const securityTxt = [
      'Contact: mailto:security@tasskr.com',
      'Expires: 2027-01-01T00:00:00.000Z',
      'Acknowledgments: https://tasskr.com/security/hall-of-fame',
      'Preferred-Languages: en, hi',
      'Canonical: https://tasskr.com/.well-known/security.txt',
      'Policy: https://tasskr.com/security-policy'
    ].join('\n');

    res.type('text/plain');
    return res.send(securityTxt);
  }

  /**
   * Generates llms.txt (LLM Standard)
   * Help AI models understand the site structure and purpose
   */
  async getLLMsTxt(req, res) {
    Logger.info('LLMs.txt request received', { ip: req.ip });
    const frontendUrl = (process.env.FRONTEND_URL || 'https://tasskr.com').replace(/\/$/, '');
    
    let content = [
      '# Tasskr - Enterprise AI Task Management',
      '> Tasskr is a high-performance, AI-powered task management platform designed for teams to collaborate efficiently, track progress, and boost productivity with intelligent insights.',
      '',
      '## Core Pages',
      `- [Home](${frontendUrl}/): Access the main dashboard and landing page.`,
      `- [Pricing](${frontendUrl}/pricing): Detailed overview of subscription plans and boost options.`,
      `- [Blog](${frontendUrl}/blog): Latest updates, guides, and enterprise productivity tips.`,
      `- [FAQs](${frontendUrl}/faqs): Common questions about task management and AI features.`,
      `- [Contact](${frontendUrl}/contact-us): Get in touch with our support and sales teams.`,
      '',
      '## Advanced Features',
      `- [AI Synergy](${frontendUrl}/product): Learn about our collaborative synergy AI for team optimization.`,
      `- [Boost Top-ups](${frontendUrl}/boost-topup): System for adding additional AI tokens to your account.`,
      '',
      '## Dynamic Resources',
    ];

    // Fetch dynamic pages from database for LLMs
    try {
      const dynamicPages = await SitemapPage.find({}).lean();
      if (dynamicPages.length > 0) {
        dynamicPages.forEach(page => {
          // Use URL as label or a generic "Dynamic Link"
          const label = page.url.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Resource';
          content.push(`- [${label}](${frontendUrl}${page.url}): Dynamic content resource.`);
        });
      } else {
        content.push('_No dynamic resources available at the moment._');
      }
    } catch (dbError) {
      Logger.error('Failed to fetch dynamic pages for LLMs.txt:', { error: dbError.message });
    }

    content.push(
      '',
      '## Legal & Compliance',
      `- [Terms of Service](${frontendUrl}/terms-conditions): Legal terms for using the Tasskr platform.`,
      `- [Privacy Policy](${frontendUrl}/privacy-policy): How we protect and manage your data.`,
      `- [Refund Policy](${frontendUrl}/refund-policy): Information on billing and refund procedures.`,
      '',
      '## Technical Resources',
      `- [Sitemap](${frontendUrl}/sitemap.xml): The full XML map of the website for crawlers.`,
      `- [Security](${frontendUrl}/security.txt): Vulnerability disclosure and security contacts.`,
      '',
      '---',
      `© ${new Date().getFullYear()} Tasskr Enterprise. All rights reserved.`
    );

    res.type('text/plain');
    return res.send(content.join('\n'));
  }

  /**
   * Manually trigger Google Indexing for a URL
   * POST /api/seo/index-now
   */
  async requestIndexing(req, res) {
    const { url, type = 'update' } = req.body;

    if (!url) {
      throw ApiError.badRequest('URL is required');
    }

    // Only allow admin or secure context (basic check for now)
    // In real enterprise, check for req.user.role === 'admin'
    
    let success = false;
    if (type === 'delete') {
      success = await IndexingService.removeUrl(url);
    } else {
      success = await IndexingService.publishUrl(url);
    }

    if (!success) {
      // We don't throw an error to avoid exposing internal API issues to client completely,
      // but we return a failed status.
      return ApiResponse.error(res, HTTP_STATUS.BAD_GATEWAY, 'Failed to trigger indexing. Check server logs.');
    }

    return ApiResponse.success(res, HTTP_STATUS.OK, 'Indexing request sent to Google', {
      url,
      type
    });
  }
}

export default new SEOController();
