import { extract } from '@extractus/article-extractor';
import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
import { chromium, Browser, Page } from 'playwright';
import axios from 'axios';

// Define the normalized output format
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

  constructor(config: NewsAgentConfig) {
    this.config = {
      maxConcurrency: 3,
      cacheTimeout: 3600000, // 1 hour default
      userAgent: 'News-Agent/1.0',
      respectRobotsTxt: true,
      ...config
    };
    this.cache = new SimpleCache();
    this.parser = new Parser();
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

      const articles: NewsArticle[] = feedData.items.map((item: any) => ({
        source: feedData.title || this.extractDomain(this.config.url),
        url: item.link || item.guid || '',
        title: item.title || 'Untitled',
        description: item.contentSnippet || item.description || item.summary || '',
        content: item.content || item['content:encoded'] || item.description || '',
        image: item.enclosure?.url || this.extractImageFromDescription(item.description) || '',
        author: item.creator || item.author || item['dc:creator'] || '',
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        category: item.categories?.[0] || '',
        language: feedData.language || 'en'
      }));

      return {
        articles,
        success: true,
        method: 'rss'
      };
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
    // Filter out non-article URLs
    const excludePatterns = [
      '/search', '/archives', '/all_tags', '/all_writers',
      '/privacy-policy', '/terms-conditions', '/converter',
      '/about-us', '/namaz', '/contact', '/login', '/register',
      '/admin', '/wp-admin', '/wp-login.php', '/cart', '/checkout'
    ];
    
    const includePatterns = [
      '/news/', '/article/', '/story/', '/post/', '/blog/',
      '/press/', '/media/', '/updates/'
    ];
    
    // If it matches include patterns, it's likely an article
    if (includePatterns.some(pattern => url.includes(pattern))) {
      return true;
    }
    
    // If it matches exclude patterns, it's not an article
    if (excludePatterns.some(pattern => url.includes(pattern))) {
      return false;
    }
    
    // Default to true for URLs that don't match exclusion patterns
    return true;
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
    // Limit concurrent requests to prevent overwhelming the server
    const concurrencyLimit = this.config.maxConcurrency || 3;
    const articles: NewsArticle[] = [];

    // Process URLs in batches to respect concurrency limits
    for (let i = 0; i < urls.length; i += concurrencyLimit) {
      const batch = urls.slice(i, i + concurrencyLimit);

      // Add random delay between batches to be respectful
      await this.randomDelay(1000, 3000);

      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          // Add random delay between requests in the batch
          await this.randomDelay(200, 800);
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
        category: '', // Category is not reliably available from article extractor
        language: 'en' // Language is not reliably available from article extractor
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
      // Check cache first
      const cacheKey = `article_${url}`;
      const cached = this.cache.get(cacheKey, this.config.cacheTimeout!);
      if (cached) {
        // Validate that cached version has required fields
        if (cached.content && cached.description) {
          return cached;
        }
      }

      // First, try to get basic metadata from the URL
      let articleData = await this.extractWithArticleExtractor(url);

      // If basic extraction fails or doesn't have required fields, force extraction from the page
      if (!articleData || !this.hasRequiredFields(articleData)) {
        // Extract directly from the article page HTML
        articleData = await this.extractFromArticlePage(url);
      }

      // If still missing required fields, try with Playwright
      if (!articleData || !this.hasRequiredFields(articleData)) {
        articleData = await this.extractWithPlaywright(url);
      }

      if (!articleData) {
        return null;
      }

      // Ensure we have at least minimal content by extracting from the page if needed
      if (!articleData || !articleData.content || (articleData.content && articleData.content.length < 200)) {
        const pageContent = await this.extractFromArticlePage(url);
        if (pageContent && pageContent.content && pageContent.content.length > (articleData?.content?.length || 0)) {
          articleData = { ...(articleData || {}), ...pageContent };
        }
      }

      // Normalize the extracted data
      const normalizedArticle: NewsArticle = {
        source: this.extractDomain(url),
        url: articleData?.url || url,
        title: articleData?.title || await this.extractTitleFromPage(url) || 'Untitled',
        description: articleData?.description || await this.extractDescriptionFromPage(url) || '',
        content: articleData?.content || await this.extractContentFromPage(url) || '',
        image: articleData?.image || await this.extractImageFromPage(url) || '',
        author: articleData?.author || await this.extractAuthorFromPage(url) || '',
        published_at: articleData?.published ? new Date(articleData.published).toISOString() : await this.extractDateFromPage(url),
        category: await this.extractCategoryFromPage(url) || '',  // category and language are not in articleData
        language: 'en'  // language is not in articleData
      };

      // Validate that we have the required fields
      if (!normalizedArticle.content || !normalizedArticle.description) {
        console.warn(`Incomplete extraction for ${url}, missing content or description`);
      }

      // Cache the result
      this.cache.set(cacheKey, normalizedArticle, this.config.cacheTimeout!);

      return normalizedArticle;
    } catch (error) {
      console.error(`Error extracting article from ${url}:`, error);
      return null;
    }
  }

  private hasRequiredFields(articleData: any): boolean {
    return !!(articleData.content && articleData.content.length > 100 && articleData.description);
  }

  private async extractFromArticlePage(url: string): Promise<any> {
    try {
      const html = await this.fetchWithRetry(url);
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

  private async extractTitleFromPage(url: string): Promise<string> {
    try {
      const html = await this.fetchWithRetry(url);
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
      const html = await this.fetchWithRetry(url);
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
      const html = await this.fetchWithRetry(url);
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
      const html = await this.fetchWithRetry(url);
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
      const html = await this.fetchWithRetry(url);
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
      const html = await this.fetchWithRetry(url);
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
      const html = await this.fetchWithRetry(url);
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

  private async extractWithPlaywright(url: string) {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch();
      }
      
      const page = await this.browser.newPage();
      
      // Set a realistic user agent
      await page.setExtraHTTPHeaders({ 'User-Agent': this.config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
      
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      
      // Extract content using the article extractor on the rendered page
      const content = await page.content();
      const result = await extract(content, {
        descriptionLengthThreshold: 180,
        contentLengthThreshold: 200
      });
      
      await page.close();
      
      return result;
    } catch (error) {
      console.error(`Playwright extraction failed for ${url}:`, error);
      return null;
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

  private async fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
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
          timeout: 15000,
          ...options
        });
        
        return response.data;
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        
        // Exponential backoff
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
    
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
  }

  private async fetchWithPlaywright(url: string): Promise<string> {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch();
      }
      
      const page = await this.browser.newPage();
      
      // Set a realistic user agent
      await page.setExtraHTTPHeaders({ 'User-Agent': this.config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
      
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      
      const content = await page.content();
      await page.close();
      
      return content;
    } catch (error) {
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return this.delay(delay);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}