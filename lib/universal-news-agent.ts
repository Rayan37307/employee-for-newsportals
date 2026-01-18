import { extract } from '@extractus/article-extractor';
import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
import { Browser, Page, chromium } from 'playwright';
import axios from 'axios';
import { URLValidator } from './url-validator';
import { HardenedPlaywright } from './hardened-playwright';
import { ContentValidator } from './content-validator';

// Define the normalized output format
export interface ExtractionTrace {
  url_fetched: boolean;
  fetch_method: 'html' | 'js';
  article_root_selector: string;
  paragraphs_found: number;
  content_length: number;
  fallback_used: boolean;
  failure_reason?: string;
  extraction_failed?: boolean;
  content_quality_score?: number;
  content_quality_reasons?: string[];
  is_listing_page?: boolean;
  is_contact_page?: boolean;
  is_advertisement?: boolean;
}

export interface NewsArticle {
  source: string;
  url: string;
  title: string;
  description: string;
  content: string;
  image: string;
  author: string;
  published_at: string;
  category: string;
  language: string;
  extraction_trace: ExtractionTrace;
  extraction_failed: boolean;
}

export interface NewsAgentResult {
  articles: NewsArticle[];
  success: boolean;
  method: 'rss' | 'sitemap' | 'scraping' | 'extraction';
  error?: string;
}

export interface NewsAgentConfig {
  url: string;
  maxConcurrency?: number;
  cacheTimeout?: number;
  userAgent?: string;
  respectRobotsTxt?: boolean;
}

// Cache for storing fetched articles
class SimpleCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  get(key: string, ttlMs: number): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export class UniversalNewsAgent {
  private config: NewsAgentConfig;
  private cache: SimpleCache;
  private parser: Parser;
  private browser: Browser | null = null;
  private urlValidator: URLValidator;
  private playwright: HardenedPlaywright;
  private contentValidator: ContentValidator;

  constructor(config: NewsAgentConfig) {
    this.config = {
      maxConcurrency: 5,
      cacheTimeout: 3600000,
      userAgent: 'News-Agent/1.0',
      respectRobotsTxt: true,
      ...config
    };
    this.cache = new SimpleCache();
    this.parser = new Parser();
    this.urlValidator = new URLValidator(config.url);
    this.playwright = new HardenedPlaywright({
      baseUrl: config.url,
      timeout: 15000,
      maxRetries: 1,
      userAgent: this.config.userAgent
    });
    this.contentValidator = new ContentValidator({
      minContentLength: 300,
      minParagraphs: 3,
      qualityScoreThreshold: 60
    });
  }

  /**
   * Main method to fetch news from any source using the priority flow:
   * RSS → Sitemap → Homepage Scraping → Article Extraction
   */
  async fetchNews(): Promise<NewsAgentResult> {
    // 1. Try RSS discovery first
    const rssResult = await this.discoverAndFetchRSS();
    if (rssResult.success && rssResult.articles.length > 0) {
      return rssResult;
    }

    // 2. Try sitemap discovery
    const sitemapResult = await this.discoverAndFetchSitemap();
    if (sitemapResult.success && sitemapResult.articles.length > 0) {
      return sitemapResult;
    }

    // 3. Fallback to homepage scraping
    const scrapingResult = await this.scrapeHomepage();
    if (scrapingResult.success && scrapingResult.articles.length > 0) {
      return scrapingResult;
    }

    // 4. Last resort: try direct extraction from the provided URL
    const extractionResult = await this.extractDirectly(this.config.url);
    return extractionResult;
  }

  /**
   * 1️⃣ RSS DISCOVERY
   */
  private async discoverAndFetchRSS(): Promise<NewsAgentResult> {
    try {
      // Try common RSS paths
      const commonPaths = [
        '/feed',
        '/rss',
        '/rss.xml',
        '/feed.xml',
        '/atom.xml',
        '/feed/rss',
        '/feeds/rss'
      ];

      const baseUrl = this.config.url.replace(/\/$/, ''); // Remove trailing slash
      
      // Try common paths first
      for (const path of commonPaths) {
        try {
          const feedUrl = `${baseUrl}${path}`;
          const result = await this.fetchRSSFeed(feedUrl);
          
          if (result.success && result.articles.length > 0) {
            return result;
          }
        } catch (error) {
          // Continue to next path
          continue;
        }
      }

      // Try to discover RSS from HTML if common paths fail
      const html = await this.fetchWithRetry(this.config.url);
      const rssLinks = this.extractRssLinksFromHtml(html);
      
      for (const rssLink of rssLinks) {
        try {
          const absoluteUrl = new URL(rssLink, this.config.url).href;
          const result = await this.fetchRSSFeed(absoluteUrl);
          
          if (result.success && result.articles.length > 0) {
            return result;
          }
        } catch (error) {
          continue;
        }
      }

      return {
        articles: [],
        success: false,
        method: 'rss',
        error: 'No RSS feeds found'
      };
    } catch (error) {
      return {
        articles: [],
        success: false,
        method: 'rss',
        error: error instanceof Error ? error.message : 'Unknown error during RSS discovery'
      };
    }
  }

  private async fetchRSSFeed(feedUrl: string): Promise<NewsAgentResult> {
    try {
      const feedData = await this.parser.parseURL(feedUrl);

      if (!feedData || !feedData.items) {
        return {
          articles: [],
          success: false,
          method: 'rss',
          error: 'No feed data found'
        };
      }

      // Extract article URLs from RSS feed for page-level extraction
      const articleUrls: string[] = [];
      for (const item of feedData.items) {
        const url = item.link || item.guid;
        if (url && url.startsWith('http')) {
          const validation = this.urlValidator.validate(url);
          if (validation.valid) {
            articleUrls.push(url);
          } else if (validation.type === 'external') {
            console.log(`🔒 Ignored external URL from RSS: ${url}`);
          }
        }
      }

      if (articleUrls.length === 0) {
        return {
          articles: [],
          success: false,
          method: 'rss',
          error: 'No article URLs found in feed'
        };
      }

      // Extract articles from the discovered URLs (NOT RSS as article)
      return await this.extractArticlesFromUrls(articleUrls);
    } catch (error) {
      return {
        articles: [],
        success: false,
        method: 'rss',
        error: error instanceof Error ? error.message : 'Unknown error parsing RSS feed'
      };
    }
  }

  private extractRssLinksFromHtml(html: string): string[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const links = document.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"]');
    return Array.from(links).map(link => link.getAttribute('href') || '').filter(href => href.length > 0);
  }

  private extractImageFromDescription(description: string): string {
    if (!description) return '';
    
    // Look for image URLs in the description
    const imgRegex = /<img[^>]+src="?([^"\s]+)"?\s*\/?>/gi;
    const matches = [...description.matchAll(imgRegex)];
    
    if (matches.length > 0) {
      const srcMatch = matches[0][1];
      return srcMatch;
    }
    
    return '';
  }

  /**
   * 2️⃣ SITEMAP DISCOVERY
   */
  private async discoverAndFetchSitemap(): Promise<NewsAgentResult> {
    try {
      const baseUrl = this.config.url.replace(/\/$/, '');
      const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemap-index.xml`,
        `${baseUrl}/sitemap_news.xml`,
        `${baseUrl}/sitemap-news.xml`,
        `${baseUrl}/post-sitemap.xml`,
        `${baseUrl}/page-sitemap.xml`
      ];

      let sitemapContent = null;
      let sitemapUrl = '';

      // Try to find a working sitemap
      for (const url of sitemapUrls) {
        try {
          const response = await this.fetchWithRetry(url, { headers: { 'User-Agent': this.config.userAgent } });
          if (response) {
            sitemapContent = response;
            sitemapUrl = url;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!sitemapContent) {
        return {
          articles: [],
          success: false,
          method: 'sitemap',
          error: 'No sitemap found'
        };
      }

      // Parse sitemap XML
      const urls = await this.parseSitemap(sitemapContent);
      
      if (urls.length === 0) {
        return {
          articles: [],
          success: false,
          method: 'sitemap',
          error: 'No URLs found in sitemap'
        };
      }

      // Extract articles from the sitemap URLs
      return await this.extractArticlesFromUrls(urls);
    } catch (error) {
      return {
        articles: [],
        success: false,
        method: 'sitemap',
        error: error instanceof Error ? error.message : 'Unknown error during sitemap discovery'
      };
    }
  }

  private async parseSitemap(sitemapContent: string): Promise<string[]> {
    const dom = new JSDOM(sitemapContent, { contentType: 'text/xml' });
    const document = dom.window.document;
    
    // Check if it's a sitemap index
    const sitemapElements = document.querySelectorAll('sitemapindex > sitemap');
    
    if (sitemapElements.length > 0) {
      // It's a sitemap index, need to fetch individual sitemaps
      const allUrls: string[] = [];
      
      for (const sitemapEl of Array.from(sitemapElements)) {
        const loc = sitemapEl.querySelector('loc');
        if (loc?.textContent) {
          try {
            const sitemapUrl = loc.textContent.trim();
            const response = await this.fetchWithRetry(sitemapUrl, { headers: { 'User-Agent': this.config.userAgent } });
            
            if (response) {
              const nestedUrls = await this.parseSitemap(response);
              allUrls.push(...nestedUrls);
            }
          } catch (e) {
            // Skip invalid sitemaps
            continue;
          }
        }
      }
      
      return allUrls;
    } else {
      // Regular sitemap with URLs
      const urlElements = document.querySelectorAll('urlset > url');
      const urls: string[] = [];
      
      for (const urlEl of Array.from(urlElements)) {
        const loc = urlEl.querySelector('loc');
        if (loc?.textContent) {
          const url = loc.textContent.trim();
          // Filter out non-article URLs
          if (this.isArticleUrl(url)) {
            urls.push(url);
          }
        }
      }
      
      return urls;
    }
  }

  private isArticleUrl(url: string): boolean {
    const result = this.urlValidator.validate(url);
    return result.valid && result.type === 'article';
  }

  private isSameDomain(url: string): boolean {
    try {
      const targetUrl = new URL(this.config.url);
      const sourceUrl = new URL(url);
      
      // Must have same hostname (ignoring www. prefix)
      const targetHost = targetUrl.hostname.replace(/^www\./, '');
      const sourceHost = sourceUrl.hostname.replace(/^www\./, '');
      
      return targetHost === sourceHost;
    } catch {
      return false;
    }
  }

  /**
   * 3️⃣ HOMEPAGE SCRAPING
   */
  private async scrapeHomepage(): Promise<NewsAgentResult> {
    try {
      // First try with regular fetch
      let html = await this.fetchWithRetry(this.config.url);
      let isJavaScriptRendered = false;
      
      // Check if content is loaded via JavaScript by looking for common indicators
      if (this.containsJavaScriptIndicators(html)) {
        // Use Playwright for JavaScript-rendered content
        html = await this.fetchWithPlaywright(this.config.url);
        isJavaScriptRendered = true;
      }
      
      // Extract article links from the homepage
      const articleUrls = this.extractArticleUrlsFromHtml(html, this.config.url);
      
      if (articleUrls.length === 0) {
        return {
          articles: [],
          success: false,
          method: 'scraping',
          error: 'No article links found on homepage'
        };
      }
      
      // Extract articles from the found URLs
      return await this.extractArticlesFromUrls(articleUrls);
    } catch (error) {
      return {
        articles: [],
        success: false,
        method: 'scraping',
        error: error instanceof Error ? error.message : 'Unknown error during homepage scraping'
      };
    }
  }

  private containsJavaScriptIndicators(html: string): boolean {
    // Check for common indicators that content is loaded via JavaScript
    const jsIndicators = [
      'window.__INITIAL_STATE__',
      'window.__PRELOADED_STATE__',
      'window.APP_DATA',
      'id="app"',
      'id="root"',
      'data-reactroot',
      'id="__next"'
    ];
    
    return jsIndicators.some(indicator => html.includes(indicator));
  }

  private extractArticleUrlsFromHtml(html: string, baseUrl: string): string[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const links = document.querySelectorAll('a[href]');
    const urls: string[] = [];
    
    for (const link of Array.from(links)) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          // Convert relative URLs to absolute
          const absoluteUrl = new URL(href, baseUrl).href;
          
          // Filter for article-like URLs
          if (this.isArticleUrl(absoluteUrl)) {
            urls.push(absoluteUrl);
          }
        } catch (e) {
          // Skip invalid URLs
          continue;
        }
      }
    }
    
    // Remove duplicates and return
    return [...new Set(urls)];
  }

  /**
    * 4️⃣ ARTICLE EXTRACTION
   */
  private async extractArticlesFromUrls(urls: string[]): Promise<NewsAgentResult> {
    const concurrencyLimit = this.config.maxConcurrency || 3;
    const articles: NewsArticle[] = [];

    const articleUrls = urls.filter(url => {
      const classification = this.urlValidator.classify(url);
      if (!classification.shouldExtract) {
        console.log(`🔒 Skipping non-article URL: ${url} (type: ${classification.type})`);
        return false;
      }
      return true;
    });

    if (articleUrls.length === 0) {
      return {
        articles: [],
        success: false,
        method: 'extraction',
        error: 'No valid article URLs found after filtering'
      };
    }

    console.log(`📰 Processing ${articleUrls.length} article URLs (filtered from ${urls.length} total)`);

    for (let i = 0; i < articleUrls.length; i += concurrencyLimit) {
      const batch = articleUrls.slice(i, i + concurrencyLimit);

      await this.randomDelay(500, 1000);

      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          await this.randomDelay(100, 300);
          return await this.extractSingleArticleWithEnforcedExtraction(url);
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          articles.push(result.value);
        }
      }
    }

    return {
      articles,
      success: articles.length > 0,
      method: 'extraction'
    };
  }

  private async extractSingleArticle(url: string): Promise<NewsArticle | null> {
    try {
      // Check cache first
      const cacheKey = `article_${url}`;
      const cached = this.cache.get(cacheKey, this.config.cacheTimeout!);
      if (cached) {
        return cached;
      }

      // Try regular extraction first
      let articleData = await this.extractWithArticleExtractor(url);

      // If that fails, try with Playwright
      if (!articleData) {
        articleData = await this.extractWithPlaywright(url);
      }

      if (!articleData) {
        return null;
      }

      // Normalize the extracted data
      const normalizedArticle: NewsArticle = {
        source: this.extractDomain(url),
        url: articleData.url || url,
        title: articleData.title || 'Untitled',
        description: articleData.description || '',
        content: articleData.content || '',
        image: articleData.image || '',
        author: articleData.author || '',
        published_at: articleData.published ? new Date(articleData.published).toISOString() : new Date().toISOString(),
        category: '',
        language: 'en',
        extraction_trace: {
          url_fetched: true,
          fetch_method: 'html',
          article_root_selector: 'article-extractor',
          paragraphs_found: (articleData.content || '').split(/\n\n+/).length,
          content_length: (articleData.content || '').length,
          fallback_used: false
        },
        extraction_failed: false
      };

      // Cache the result
      this.cache.set(cacheKey, normalizedArticle, this.config.cacheTimeout!);

      return normalizedArticle;
    } catch (error) {
      console.error(`Error extracting article from ${url}:`, error);
      return null;
    }
  }

  private async extractSingleArticleWithEnforcedExtraction(url: string): Promise<NewsArticle | null> {
    try {
      const trace: ExtractionTrace = {
        url_fetched: false,
        fetch_method: 'html',
        article_root_selector: '',
        paragraphs_found: 0,
        content_length: 0,
        fallback_used: false
      };

      const cacheKey = `article_${url}`;
      const cached = this.cache.get(cacheKey, this.config.cacheTimeout!);
      if (cached) {
        if (cached.content && cached.description && cached.content.length >= 300) {
          const qualityResult = this.contentValidator.validate(cached.content, cached.title, url);
          if (qualityResult.isValid && qualityResult.hasRealArticleContent) {
            return cached;
          }
        }
      }

      const classification = this.urlValidator.classify(url);
      if (classification.type === 'listing' || classification.type === 'category') {
        trace.failure_reason = 'LISTING_PAGE_DETECTED';
        trace.is_listing_page = true;
        trace.extraction_failed = true;

        return {
          source: this.extractDomain(url),
          url: url,
          title: 'Listing Page - Not Extractable',
          description: 'This URL is a listing/category page, not an article',
          content: '',
          image: '',
          author: '',
          published_at: new Date().toISOString(),
          category: '',
          language: 'en',
          extraction_trace: trace,
          extraction_failed: true
        };
      }

      let articleData = await this.extractWithArticleExtractor(url);
      let htmlContent: string | null = null;

      if (!articleData || !articleData.content || articleData.content.length < 200) {
        htmlContent = await this.fetchWithRetry(url).catch(() => null);
        
        if (htmlContent) {
          const cfCheck = await this.checkCloudflare(url);
          
          if (cfCheck.isProtected) {
            trace.fallback_used = true;
            htmlContent = await this.playwright.fetchWithRetry(url);
          }

          if (htmlContent) {
            articleData = this.extractFromHTMLContent(htmlContent, url);
          }
        }
      }

      if (!articleData || !articleData.content || articleData.content.length < 200) {
        trace.failure_reason = 'All extraction methods failed';
        trace.extraction_failed = true;

        return {
          source: this.extractDomain(url),
          url: url,
          title: 'Extraction Failed',
          description: 'Could not extract article content',
          content: '',
          image: '',
          author: '',
          published_at: new Date().toISOString(),
          category: '',
          language: 'en',
          extraction_trace: trace,
          extraction_failed: true
        };
      }

      const enhancedContent = await this.extractEnhancedContentFromPage(url, trace);
      if (enhancedContent) {
        articleData = { ...articleData, ...enhancedContent };
      }

      const normalizedArticle: NewsArticle = {
        source: this.extractDomain(url),
        url: articleData?.url || url,
        title: articleData?.title || await this.extractTitleFromPage(url) || 'Untitled',
        description: articleData?.description || await this.extractDescriptionFromPage(url) || '',
        content: articleData?.content || await this.extractContentFromPage(url) || '',
        image: articleData?.image || await this.extractImageFromPage(url) || '',
        author: articleData?.author || await this.extractAuthorFromPage(url) || '',
        published_at: this.safeDate(articleData?.published) || await this.extractDateFromPage(url),
        category: await this.extractCategoryFromPage(url) || '',
        language: 'en',
        extraction_trace: trace,
        extraction_failed: false
      };

      const finalQuality = this.contentValidator.validate(normalizedArticle.content, normalizedArticle.title, url);
      trace.content_quality_score = finalQuality.score;
      trace.content_quality_reasons = finalQuality.reasons;
      trace.is_listing_page = finalQuality.isListingPage;
      trace.is_contact_page = finalQuality.isContactPage;
      trace.is_advertisement = finalQuality.isAdvertisement;

      if (!finalQuality.hasRealArticleContent) {
        trace.failure_reason = `FINAL_VALIDATION_FAILED: ${finalQuality.reasons.join('; ')}`;
        trace.extraction_failed = true;

        const failedArticle: NewsArticle = {
          ...normalizedArticle,
          extraction_trace: trace,
          extraction_failed: true
        };

        this.cache.set(cacheKey, failedArticle, this.config.cacheTimeout!);
        return failedArticle;
      }

      const isValid = this.validateHardRequirements(normalizedArticle);
      if (!isValid) {
        trace.failure_reason = 'Hard validation failed: content too short, insufficient paragraphs, or missing required fields';
        trace.extraction_failed = true;

        const failedArticle: NewsArticle = {
          ...normalizedArticle,
          extraction_trace: trace,
          extraction_failed: true
        };

        this.cache.set(cacheKey, failedArticle, this.config.cacheTimeout!);
        return failedArticle;
      }

      trace.extraction_failed = false;
      this.cache.set(cacheKey, normalizedArticle, this.config.cacheTimeout!);

      return normalizedArticle;
    } catch (error) {
      console.error(`Error extracting article from ${url}:`, error);

      const trace: ExtractionTrace = {
        url_fetched: false,
        fetch_method: 'html',
        article_root_selector: '',
        paragraphs_found: 0,
        content_length: 0,
        fallback_used: false,
        failure_reason: `Error during extraction: ${(error as Error).message}`,
        extraction_failed: true
      };

      return {
        source: this.extractDomain(url),
        url: url,
        title: 'Extraction Error',
        description: 'Error occurred during extraction',
        content: '',
        image: '',
        author: '',
        published_at: new Date().toISOString(),
        category: '',
        language: 'en',
        extraction_trace: trace,
        extraction_failed: true
      };
    }
  }

  private extractFromHTMLContent(html: string, url: string): any {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      let title = '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) title = ogTitle;
      else {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.textContent?.trim() || '';
        else {
          const titleTag = document.querySelector('title');
          if (titleTag) title = titleTag.textContent?.trim() || '';
        }
      }

      let description = '';
      const descMeta = document.querySelector('meta[name="description"]')?.getAttribute('content');
      if (descMeta) description = descMeta;
      else {
        const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
        if (ogDesc) description = ogDesc;
      }

      const articleSelectors = [
        'article',
        '[class*="article"]',
        '[class*="post"]',
        '[class*="news-content"]',
        '[class*="entry-content"]',
        '.single-post',
        '.post-content',
        '.article-body',
        'main'
      ];

      let contentElement = null;
      for (const selector of articleSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          contentElement = el;
          break;
        }
      }

      let content = '';
      const paragraphs = contentElement ? contentElement.querySelectorAll('p') : document.querySelectorAll('p');
      const contentParts: string[] = [];
      
      for (const p of Array.from(paragraphs) as Element[]) {
        const text = p.textContent?.trim() || '';
        if (text.length > 30 && !this.isGarbageText(text)) {
          contentParts.push(text);
        }
      }
      content = contentParts.join('\n\n');

      let image = '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage) image = ogImage;

      let author = '';
      const authorMeta = document.querySelector('meta[name="author"]')?.getAttribute('content');
      if (authorMeta) author = authorMeta;

      let published = '';
      const pubDateMeta = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
      if (pubDateMeta) published = pubDateMeta;

      return {
        url,
        title: title || undefined,
        description: description || undefined,
        content: content || undefined,
        image: image || undefined,
        author: author || undefined,
        published: published || undefined
      };
    } catch {
      return null;
    }
  }

  private isGarbageText(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    const garbagePatterns = [
      'advertisement',
      'copyright',
      'all rights reserved',
      'powered by',
      'developed by',
      'designed by',
      'contact us',
      'about us',
      'privacy policy',
      'terms of service',
      'subscribe to our',
      'follow us on',
      'share this',
      'loading...',
      'cookie',
      'this site uses',
      'javascript must be enabled'
    ];

    if (garbagePatterns.some(p => lowerText.includes(p))) {
      return true;
    }

    if (text.length < 30) return true;

    if (/^\d+$/.test(text.replace(/\s/g, ''))) return true;

    return false;
  }

  private hasRequiredFields(articleData: any): boolean {
    return !!(articleData.content && articleData.content.length > 100 && articleData.description);
  }

  private async extractEnhancedContentFromPage(url: string, trace: ExtractionTrace): Promise<any> {
    try {
      trace.url_fetched = true;
      trace.fetch_method = 'html';

      let html: string;
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          // ESCALATE TO PLAYWRIGHT
          trace.fallback_used = true;
          trace.fetch_method = 'js';
          trace.failure_reason = 'BLOCKED_BY_CLOUDFLARE';
          
          html = await this.fetchWithPlaywright(url);
        } else {
          throw error;
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // ARTCLE ROOT DETECTION (HEURISTIC-BASED)
      let articleRoot = null;
      let selectorUsed = '';

      // Try multiple selectors in order of preference
      const selectors = [
        'article',
        '[class*="content"]',
        '[class*="article"]',
        '[class*="post"]',
        '[class*="story"]',
        '[class*="news"]',
        '.single-post',
        '.post-content',
        '.entry-content',
        '.article-body',
        '.story-body',
        '#content',
        'main'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Check if this element has characteristics of an article
          const h1Count = element.querySelectorAll('h1').length;
          const pCount = element.querySelectorAll('p').length;
          const textLength = element.textContent?.trim().length || 0;
          const linkDensity = this.calculateLinkDensity(element);

          // Prefer elements with h1, many paragraphs, substantial text, low link density
          if ((h1Count > 0 || pCount >= 2) && textLength > 100 && linkDensity < 0.5) {
            articleRoot = element;
            selectorUsed = selector;
            break;
          }
        }
      }

      // If no good candidate found, try to find the element with most text content
      if (!articleRoot) {
        const allDivs = document.querySelectorAll('div, section, article, main');
        let maxTextLength = 0;

        for (const el of Array.from(allDivs)) {
          const textLength = el.textContent?.trim().length || 0;
          const pCount = el.querySelectorAll('p').length;
          const linkDensity = this.calculateLinkDensity(el);

          if (textLength > maxTextLength && pCount >= 1 && linkDensity < 0.5) {
            maxTextLength = textLength;
            articleRoot = el;
            selectorUsed = el.tagName.toLowerCase() + (el.className ? `.${el.className.split(' ')[0]}` : '');
          }
        }
      }

      if (!articleRoot) {
        // Fallback to body if no article root found
        articleRoot = document.body;
        selectorUsed = 'body';
      }

      trace.article_root_selector = selectorUsed;

      // EXTRACT CONTENT FROM ARTICLE ROOT
      const paragraphs = articleRoot.querySelectorAll('p');
      const contentParts: string[] = [];
      let validParagraphs = 0;

      for (const p of Array.from(paragraphs)) {
        const text = p.textContent?.trim() || '';

        // Filter out non-content elements
        if (this.isValidContentParagraph(text, p)) {
          contentParts.push(text);
          validParagraphs++;
        }
      }

      trace.paragraphs_found = validParagraphs;
      const content = contentParts.join('\n\n');
      trace.content_length = content.length;

      // EXTRACT OTHER FIELDS FROM ARTICLE ROOT
      let title = '';
      const h1 = articleRoot.querySelector('h1');
      if (h1) title = h1.textContent?.trim() || '';

      let description = '';
      if (contentParts.length > 0) {
        // Use first substantial paragraph as description if meta description is not available
        description = contentParts[0].substring(0, 200) + '...';
      }

      let image = '';
      // Look for images inside the article root
      const img = articleRoot.querySelector('img');
      if (img) {
        const src = img.getAttribute('src');
        if (src && !this.isAdOrTrackingImage(src)) {
          image = src;
        }
      }

      // Look for figure images
      const figureImg = articleRoot.querySelector('figure img');
      if (figureImg && !image) {
        const src = figureImg.getAttribute('src');
        if (src && !this.isAdOrTrackingImage(src)) {
          image = src;
        }
      }

      // Try to find author
      let author = '';
      const authorSelectors = ['.author', '.byline', '[rel="author"]', '.article-author'];
      for (const sel of authorSelectors) {
        const authorEl = articleRoot.querySelector(sel);
        if (authorEl) {
          author = authorEl.textContent?.trim() || '';
          break;
        }
      }

      // Try to find date
      let published = '';
      const dateSelectors = ['time', '.date', '.publish-date', '.published'];
      for (const sel of dateSelectors) {
        const dateEl = articleRoot.querySelector(sel);
        if (dateEl) {
          const dateTime = dateEl.getAttribute('datetime');
          if (dateTime) {
            published = new Date(dateTime).toISOString();
          } else {
            const text = dateEl.textContent?.trim();
            if (text) {
              published = new Date(text).toISOString();
            }
          }
          break;
        }
      }

      return {
        title: title || undefined,
        description: description || undefined,
        content: content || undefined,
        image: image || undefined,
        author: author || undefined,
        published: published || undefined
      };
    } catch (error) {
      console.error(`Error in enhanced content extraction for ${url}:`, error);
      return null;
    }
  }

  private isValidContentParagraph(text: string, element: Element): boolean {
    if (!text || text.length < 20) return false;

    const lowerText = text.toLowerCase();

    // Filter out navigation, ads, and other non-content elements
    const nonContentPatterns = [
      'advertisement',
      'ad ', ' ad', 'ads',
      'related', 'more', 'similar',
      'subscribe', 'sign up',
      'copyright', 'all rights reserved',
      'share this', 'tweet', 'facebook',
      'comments', 'comment',
      'tags:', 'tagged',
      'previous', 'next', 'back',
      'menu', 'navigation'
    ];

    for (const pattern of nonContentPatterns) {
      if (lowerText.includes(pattern)) {
        return false;
      }
    }

    // Check if element has classes that suggest it's not content
    const classList = element.getAttribute('class') || '';
    const nonContentClasses = ['ad', 'advertisement', 'nav', 'menu', 'sidebar', 'footer', 'header', 'share', 'social'];
    for (const cls of nonContentClasses) {
      if (classList.toLowerCase().includes(cls)) {
        return false;
      }
    }

    return true;
  }

  private calculateLinkDensity(element: Element): number {
    const textLength = element.textContent?.trim().length || 1;
    const links = element.querySelectorAll('a');
    let linkCharCount = 0;

    for (const link of Array.from(links)) {
      linkCharCount += link.textContent?.length || 0;
    }

    return linkCharCount / textLength;
  }

  private isAdOrTrackingImage(src: string): boolean {
    const adPatterns = [
      'ads', 'advertisement', 'banner', 'sponsor',
      'tracking', 'pixel', 'beacon', 'promo',
      'widget', 'thumb', 'icon', 'logo'
    ];

    const lowerSrc = src.toLowerCase();
    return adPatterns.some(pattern => lowerSrc.includes(pattern));
  }

  private validateHardRequirements(article: NewsArticle): boolean {
    // HARD VALIDATION GATE - Reject RSS-style selectors
    const invalidSelectors = ['rss', 'feed', 'xml', 'sitemap'];
    const hasInvalidSelector = invalidSelectors.some(sel => 
      article.extraction_trace.article_root_selector.toLowerCase().includes(sel)
    );
    
    if (hasInvalidSelector) {
      article.extraction_trace.failure_reason = 'RSS_USED_AS_ARTICLE_SOURCE';
      article.extraction_trace.extraction_failed = true;
      return false;
    }

    // Hard validation gate
    return (
      article.content.length >= 300 &&
      article.extraction_trace.paragraphs_found >= 3 &&
      article.title.trim() !== '' &&
      (article.image.trim() !== '' || article.description.length > 50) &&
      article.extraction_trace.url_fetched === true
    );
  }

  private async extractTitleFromPage(url: string): Promise<string> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          html = await this.fetchWithPlaywright(url);
        } else {
          return '';
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) return ogTitle;

      const h1 = document.querySelector('h1');
      if (h1) return h1.textContent?.trim() || '';

      const titleTag = document.querySelector('title');
      if (titleTag) return titleTag.textContent?.trim() || '';

      return '';
    } catch (error) {
      return '';
    }
  }

  private async extractDescriptionFromPage(url: string): Promise<string> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          html = await this.fetchWithPlaywright(url);
        } else {
          return '';
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const descMeta = document.querySelector('meta[name="description"]')?.getAttribute('content');
      if (descMeta) return descMeta;

      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
      if (ogDesc) return ogDesc;

      // Find first meaningful paragraph
      const paragraphs = document.querySelectorAll('p');
      for (const p of Array.from(paragraphs)) {
        const text = p.textContent?.trim() || '';
        if (text.length > 50 && !text.toLowerCase().includes('advertisement')) {
          return text;
        }
      }

      return '';
    } catch (error) {
      return '';
    }
  }

  private async extractContentFromPage(url: string): Promise<string> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          html = await this.fetchWithPlaywright(url);
        } else {
          return '';
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Look for article tag first
      let contentElement = document.querySelector('article');
      if (!contentElement) {
        // Look for common content containers
        contentElement = document.querySelector('div.content') ||
                         document.querySelector('div.article-content') ||
                         document.querySelector('div.post-content') ||
                         document.querySelector('div.entry-content') ||
                         document.querySelector('div.story-body') ||
                         document.querySelector('.article-body') ||
                         document.querySelector('.post-body') ||
                         document.querySelector('#content') ||
                         document.querySelector('.content');
      }

      if (contentElement) {
        // Extract text from content element, excluding ads and related content
        const paragraphs = contentElement.querySelectorAll('p');
        const contentParts: string[] = [];
        for (const p of Array.from(paragraphs)) {
          const text = p.textContent?.trim() || '';
          // Skip if it looks like an ad or navigation
          if (!text.toLowerCase().includes('advertisement') &&
              !text.toLowerCase().includes('related') &&
              !text.toLowerCase().includes('subscribe') &&
              text.length > 10) {
            contentParts.push(text);
          }
        }
        return contentParts.join('\n\n');
      } else {
        // Fallback: get all paragraphs from body
        const paragraphs = document.querySelectorAll('body p');
        const contentParts: string[] = [];
        for (const p of Array.from(paragraphs)) {
          const text = p.textContent?.trim() || '';
          if (text.length > 50 &&
              !text.toLowerCase().includes('advertisement') &&
              !text.toLowerCase().includes('copyright') &&
              !text.toLowerCase().includes('all rights reserved')) {
            contentParts.push(text);
          }
        }
        return contentParts.join('\n\n');
      }
    } catch (error) {
      return '';
    }
  }

  private async extractImageFromPage(url: string): Promise<string> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          html = await this.fetchWithPlaywright(url);
        } else {
          return '';
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage) return ogImage;

      // Look for first image in article content
      const articleElement = document.querySelector('article');
      if (articleElement) {
        const img = articleElement.querySelector('img');
        if (img) return img.getAttribute('src') || '';
      }

      // Look for first image in body
      const img = document.querySelector('body img');
      if (img) return img.getAttribute('src') || '';

      return '';
    } catch (error) {
      return '';
    }
  }

  private async extractAuthorFromPage(url: string): Promise<string> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          html = await this.fetchWithPlaywright(url);
        } else {
          return '';
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const authorMeta = document.querySelector('meta[name="author"]')?.getAttribute('content');
      if (authorMeta) return authorMeta;

      const articleAuthor = document.querySelector('[rel="author"], .author, .byline, .article-author');
      if (articleAuthor) return articleAuthor.textContent?.trim() || '';

      return '';
    } catch (error) {
      return '';
    }
  }

  private async extractDateFromPage(url: string): Promise<string> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          html = await this.fetchWithPlaywright(url);
        } else {
          return new Date().toISOString();
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const pubDateMeta = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
                         document.querySelector('meta[name="publishdate"]')?.getAttribute('content') ||
                         document.querySelector('meta[name="pubdate"]')?.getAttribute('content');
      if (pubDateMeta) return new Date(pubDateMeta).toISOString();

      const timeElement = document.querySelector('time, .publish-date, .date');
      if (timeElement) {
        const dateTime = timeElement.getAttribute('datetime');
        if (dateTime) return new Date(dateTime).toISOString();
        const textContent = timeElement.textContent?.trim();
        if (textContent) return new Date(textContent).toISOString();
      }

      return new Date().toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  private async extractCategoryFromPage(url: string): Promise<string> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          html = await this.fetchWithPlaywright(url);
        } else {
          return '';
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Look for category in meta tags
      const categoryMeta = document.querySelector('meta[property="article:section"]')?.getAttribute('content') ||
                          document.querySelector('meta[name="category"]')?.getAttribute('content');
      if (categoryMeta) return categoryMeta;

      // Look for breadcrumb or category elements
      const categoryElement = document.querySelector('.category, .section, .breadcrumb, .tags');
      if (categoryElement) return categoryElement.textContent?.trim() || '';

      return '';
    } catch (error) {
      return '';
    }
  }

  private async extractWithArticleExtractor(url: string) {
    try {
      // First, check if page is accessible
      const html = await this.fetchWithRetry(url);
      
      // Detect Cloudflare protection
      if (this.isCloudflareProtected(html)) {
        console.log(`Cloudflare protection detected for ${url}, skipping HTTP extraction`);
        return null;
      }
      
      const result = await extract(url, {
        descriptionLengthThreshold: 180,
        contentLengthThreshold: 200
      });
      
      return result;
    } catch (error) {
      console.error(`Article extractor failed for ${url}:`, error);
      return null;
    }
  }

  private isCloudflareProtected(html: string): boolean {
    const cfPatterns = [
      'cf-mitigated',
      'Just a moment',
      'cdn-cgi/challenge',
      'Enable JavaScript',
      'Checking your browser before accessing',
      'DDoS protection',
      'Cloudflare Ray ID',
      '_cf_chl_opt',
      'challenge-platform',
      'captcha',
      'JSCHK'
    ];
    
    return cfPatterns.some(pattern => html.includes(pattern));
  }

  private isCloudflareError(error: any, html?: string): boolean {
    const status = error?.response?.status;
    const headers = error?.response?.headers || {};
    
    return (
      status === 403 &&
      (
        headers?.['cf-mitigated'] ||
        (html && this.isCloudflareProtected(html))
      )
    );
  }

  async checkCloudflare(url: string): Promise<{ isProtected: boolean; challenge?: string }> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        validateStatus: () => true
      });

      const headers = response.headers;

      if (headers['cf-mitigated'] === 'true') {
        return { isProtected: true, challenge: 'cf-mitigated' };
      }

      if (headers['server']?.includes('cloudflare')) {
        if (response.status === 403 || response.status === 503) {
          return { isProtected: true, challenge: `status-${response.status}` };
        }
      }

      return { isProtected: false };
    } catch {
      return { isProtected: true, challenge: 'connection-failed' };
    }
  }

  private async fetchWithRetry(url: string, options: any = {}, retries = 1): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          ...options.headers
        },
        timeout: 10000,
        ...options
      });
      
      return response.data;
    } catch (error: any) {
      if (this.isCloudflareError(error, error.response?.data)) {
        throw new Error('BLOCKED_BY_CLOUDFLARE');
      }
      throw error;
    }
  }

  private async extractFromArticlePage(url: string): Promise<any> {
    try {
      let html: string;
      
      try {
        html = await this.fetchWithRetry(url);
      } catch (error: any) {
        if (error.message === 'BLOCKED_BY_CLOUDFLARE') {
          // ESCALATE TO PLAYWRIGHT
          html = await this.fetchWithPlaywright(url);
        } else {
          throw error;
        }
      }
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Extract title
      let title = '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) title = ogTitle;
      else {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.textContent?.trim() || '';
        else {
          const titleTag = document.querySelector('title');
          if (titleTag) title = titleTag.textContent?.trim() || '';
        }
      }

      // Extract description
      let description = '';
      const descMeta = document.querySelector('meta[name="description"]')?.getAttribute('content');
      if (descMeta) description = descMeta;
      else {
        const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
        if (ogDesc) description = ogDesc;
        else {
          // Find first meaningful paragraph
          const paragraphs = document.querySelectorAll('p');
          for (const p of Array.from(paragraphs)) {
            const text = p.textContent?.trim() || '';
            if (text.length > 50 && !text.toLowerCase().includes('advertisement')) {
              description = text;
              break;
            }
          }
        }
      }

      // Extract content
      let content = '';
      // Look for article tag first
      let contentElement = document.querySelector('article');
      if (!contentElement) {
        // Look for common content containers
        contentElement = document.querySelector('div.content') ||
                         document.querySelector('div.article-content') ||
                         document.querySelector('div.post-content') ||
                         document.querySelector('div.entry-content') ||
                         document.querySelector('div.story-body') ||
                         document.querySelector('.article-body') ||
                         document.querySelector('.post-body') ||
                         document.querySelector('#content') ||
                         document.querySelector('.content');
      }

      if (contentElement) {
        // Extract text from content element, excluding ads and related content
        const paragraphs = contentElement.querySelectorAll('p');
        const contentParts: string[] = [];
        for (const p of Array.from(paragraphs)) {
          const text = p.textContent?.trim() || '';
          // Skip if it looks like an ad or navigation
          if (!text.toLowerCase().includes('advertisement') &&
              !text.toLowerCase().includes('related') &&
              !text.toLowerCase().includes('subscribe') &&
              text.length > 10) {
            contentParts.push(text);
          }
        }
        content = contentParts.join('\n\n');
      } else {
        // Fallback: get all paragraphs from body
        const paragraphs = document.querySelectorAll('body p');
        const contentParts: string[] = [];
        for (const p of Array.from(paragraphs)) {
          const text = p.textContent?.trim() || '';
          if (text.length > 50 &&
              !text.toLowerCase().includes('advertisement') &&
              !text.toLowerCase().includes('copyright') &&
              !text.toLowerCase().includes('all rights reserved')) {
            contentParts.push(text);
          }
        }
        content = contentParts.join('\n\n');
      }

      // Extract image
      let image = '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage) image = ogImage;
      else {
        // Look for first image in article content
        if (contentElement) {
          const img = contentElement.querySelector('img');
          if (img) image = img.getAttribute('src') || '';
        }
        if (!image) {
          // Look for first image in body
          const img = document.querySelector('body img');
          if (img) image = img.getAttribute('src') || '';
        }
      }

      // Extract author
      let author = '';
      const authorMeta = document.querySelector('meta[name="author"]')?.getAttribute('content');
      if (authorMeta) author = authorMeta;
      else {
        const articleAuthor = document.querySelector('[rel="author"], .author, .byline, .article-author');
        if (articleAuthor) author = articleAuthor.textContent?.trim() || '';
      }

      // Extract publication date
      let published = '';
      const pubDateMeta = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
                         document.querySelector('meta[name="publishdate"]')?.getAttribute('content') ||
                         document.querySelector('meta[name="pubdate"]')?.getAttribute('content');
      if (pubDateMeta) published = pubDateMeta;
      else {
        const timeElement = document.querySelector('time, .publish-date, .date');
        if (timeElement) published = timeElement.getAttribute('datetime') || timeElement.textContent?.trim() || '';
      }

      return {
        title: title || undefined,
        description: description || undefined,
        content: content || undefined,
        image: image || undefined,
        author: author || undefined,
        published: published || undefined
      };
    } catch (error) {
      console.error(`Error extracting from article page ${url}:`, error);
      return null;
    }
  }

  private async extractWithPlaywright(url: string) {
    let page: Page | null = null;
    try {
      if (!this.browser) {
        this.browser = await chromium.launch();
      }
      
      page = await this.browser.newPage();
      
      // Set a realistic user agent and headers
      await page.setExtraHTTPHeaders({ 
        'User-Agent': this.config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      
      // Use domcontentloaded instead of networkidle for Cloudflare pages
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000  // Increased to 60s
      });
      
      // Wait for content selectors
      try {
        await page.waitForSelector('article, main, [class*="content"], [class*="article"], [class*="post"], h1, .single-post, .post-content', {
          timeout: 30000  // 30s wait
        });
      } catch {
        // Continue anyway
      }
      
      // Additional wait for dynamic content
      await page.waitForTimeout(5000);
      
      // Extract content using the article extractor on the rendered page
      const content = await page.content();
      const result = await extract(content, {
        descriptionLengthThreshold: 180,
        contentLengthThreshold: 200
      });
      
      return result;
    } catch (error) {
      console.error(`Playwright extraction failed for ${url}:`, error);
      
      // If browser is closed, reinitialize
      if (this.browser && !this.browser.isConnected()) {
        this.browser = null;
      }
      
      return null;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  private async extractDirectly(url: string): Promise<NewsAgentResult> {
    try {
      const article = await this.extractSingleArticle(url);
      
      if (article) {
        return {
          articles: [article],
          success: true,
          method: 'extraction'
        };
      }
      
      return {
        articles: [],
        success: false,
        method: 'extraction',
        error: 'Could not extract content from the provided URL'
      };
    } catch (error) {
      return {
        articles: [],
        success: false,
        method: 'extraction',
        error: error instanceof Error ? error.message : 'Unknown error during direct extraction'
      };
    }
  }

  /**
   * Utility methods
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
  }

  private async fetchWithPlaywright(url: string): Promise<string> {
    let page: Page | null = null;
    try {
      if (!this.browser) {
        this.browser = await chromium.launch();
      }
      
      page = await this.browser.newPage();
      
      // Set a realistic user agent and headers
      await page.setExtraHTTPHeaders({ 
        'User-Agent': this.config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      
      // Use domcontentloaded instead of networkidle for Cloudflare pages
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000  // Increased to 60s
      });
      
      // Wait for Cloudflare challenge to complete
      try {
        await page.waitForSelector('article, main, [class*="content"], [class*="article"], [class*="post"], h1, .single-post, .post-content', {
          timeout: 30000  // 30s wait for content
        });
      } catch {
        // Continue anyway - challenge may still be resolving
      }
      
      // Additional wait for dynamic content
      await page.waitForTimeout(5000);
      
      const content = await page.content();
      
      return content;
    } catch (error) {
      // If browser is closed, reinitialize
      if (this.browser && !this.browser.isConnected()) {
        this.browser = null;
      }
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return this.delay(delay);
  }

  private safeDate(dateValue: string | undefined | null): string | undefined {
    if (!dateValue) return undefined;
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    await this.playwright.cleanup();
  }
}