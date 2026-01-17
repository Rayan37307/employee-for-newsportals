import { extract } from '@extractus/article-extractor'
import Parser from 'rss-parser'
import { JSDOM } from 'jsdom'
import { Page, Browser } from 'playwright'
import { UniversalNewsAgent, NewsArticle } from './universal-news-agent';

export interface NewsItem {
  title: string
  content?: string
  summary?: string
  description?: string
  url: string
  publishedAt?: Date
  published_at?: string
  author?: string
  image?: string
  category?: string
  language?: string
  source?: string
  tags?: string[]
}

export interface NewsSourceResult {
  items: NewsItem[]
  success: boolean
  method: 'rss' | 'extraction' | 'scraping' | 'api'
  error?: string
}

export abstract class NewsSourceHandler {
  abstract canHandle(type: string, config: any): boolean
  abstract fetch(config: any): Promise<NewsSourceResult>
}

// RSS Handler
export class RSSHandler extends NewsSourceHandler {
  private parser = new Parser()

  canHandle(type: string, config: any): boolean {
    return type === 'RSS' || (type === 'AUTO' && config.rssUrl)
  }

  async fetch(config: any): Promise<NewsSourceResult> {
    try {
      const feedData = await this.parser.parseURL(config.url || config.rssUrl)

      if (!feedData || !feedData.items) {
        return {
          items: [],
          success: false,
          method: 'rss',
          error: 'No feed data found'
        }
      }

      const items: NewsItem[] = feedData.items.map((item: any) => ({
        title: item.title || 'Untitled',
        content: item.content || item.contentSnippet,
        summary: item.contentSnippet || item.summary,
        url: item.link || item.guid,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        author: item.creator || item.author,
        image: item.enclosure?.url,
        tags: item.categories || []
      }))

      return {
        items,
        success: true,
        method: 'rss'
      }
    } catch (error) {
      return {
        items: [],
        success: false,
        method: 'rss',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Article Extraction Handler
export class ArticleExtractionHandler extends NewsSourceHandler {
  canHandle(type: string, config: any): boolean {
    return type === 'AUTO' || type === 'EXTRACTION'
  }

  async fetch(config: any): Promise<NewsSourceResult> {
    try {
      // Extract articles from the main page
      const article = await extract(config.url, {
        words: 0, // No word limit
        descriptionLengthThreshold: 180,
        contentLengthThreshold: 200,
        useReadability: true,
        ...config.options
      })

      if (!article) {
          const scraper = new WebScraperHandler();
          return scraper.fetch(config);
      }

      const item: NewsItem = {
        title: article.title || 'Untitled',
        content: article.content,
        summary: article.description,
        url: article.url || config.url,
        publishedAt: article.published ? new Date(article.published) : undefined,
        author: article.author,
        image: article.image,
      }

      return {
        items: [item],
        success: true,
        method: 'extraction'
      }
    } catch (error) {
      return {
        items: [],
        success: false,
        method: 'extraction',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Sitemap Handler
export class SitemapHandler extends NewsSourceHandler {
  canHandle(type: string, config: any): boolean {
    return type === 'AUTO' || type === 'SITEMAP'
  }

  async fetch(config: any): Promise<NewsSourceResult> {
    try {
      const baseUrl = config.url.replace(/\/$/, '')
      const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/english-sitemap.xml`,
        `${baseUrl}/english-sitemap/sitemap-daily-${this.getTodayDate()}.xml`,
      ]

      let sitemapUrl = null
      let sitemapContent = null

      // Try to find a working sitemap
      for (const url of sitemapUrls) {
        try {
          const response = await fetch(url, {
            headers: { 'User-Agent': 'News-Agent/1.0' }
          })
          if (response.ok) {
            sitemapContent = await response.text()
            sitemapUrl = url
            break
          }
        } catch (e) {
          continue
        }
      }

      if (!sitemapContent) {
        return {
          items: [],
          success: false,
          method: 'scraping',
          error: 'No sitemap found'
        }
      }

      // Parse sitemap XML
      const dom = new JSDOM(sitemapContent, { contentType: 'text/xml' })
      const xml = dom.window.document
      const urlElements = xml.querySelectorAll('urlset > url, sitemapindex > sitemap')

      // If it's a sitemap index, follow it
      if (xml.querySelector('sitemapindex')) {
        const sitemapLocs = xml.querySelectorAll('sitemap loc')
        let items: NewsItem[] = []
        for (const sitemapLoc of Array.from(sitemapLocs)) {
            if (sitemapLoc?.textContent) {
                const response = await fetch(sitemapLoc.textContent.trim(), {
                    headers: { 'User-Agent': 'News-Agent/1.0' }
                })
                if (response.ok) {
                    sitemapContent = await response.text()
                    const indexDom = new JSDOM(sitemapContent, { contentType: 'text/xml' })
                    const indexXml = indexDom.window.document
                    const urls = indexXml.querySelectorAll('urlset > url')
                    const result = await this.parseSitemapUrls(urls)
                    items = items.concat(result.items)
                }
            }
        }
        return {
            items,
            success: true,
            method: 'scraping'
        }
      }
      // Parse sitemap URLs
      const articles = await this.parseSitemapUrls(urlElements)
      if(articles.items.length === 0){
        return {
          items: [],
          success: false,
          method: 'scraping',
          error: 'No article URLs found in sitemap'
        }
      }
      const webScraperHandler = new WebScraperHandler();
      const result = await webScraperHandler.fetch({url: articles.items[0].url})
      return {
        items: result.items,
        success: true,
        method: 'scraping'
      }
    } catch (error) {
      return {
        items: [],
        success: false,
        method: 'scraping',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private getTodayDate(): string {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private async parseSitemapUrls(urlElements: NodeListOf<Element>): Promise<NewsSourceResult> {
    const items: NewsItem[] = []

    for (const urlElement of Array.from(urlElements).slice(0, 10)) { // Limit to 10 items
      const loc = urlElement.querySelector('loc')
      const lastmod = urlElement.querySelector('lastmod')
      const imageCaption = urlElement.querySelector('image\\:caption caption')

      if (loc?.textContent) {
        const url = loc.textContent.trim()

        // Skip non-article URLs
        if (this.isArticleUrl(url)) {
            items.push({
                title: this.extractTitleFromUrl(url),
                summary: imageCaption?.textContent?.trim() || undefined,
                url: url,
                publishedAt: lastmod?.textContent ? new Date(lastmod.textContent) : undefined,
                image: this.extractImageFromUrl(urlElement)
            })
        }
      }
    }

    if (items.length === 0) {
      return {
        items: [],
        success: false,
        method: 'scraping',
        error: 'No article URLs found in sitemap'
      }
    }

    return {
      items,
      success: true,
      method: 'scraping'
    }
  }

  private isArticleUrl(url: string): boolean {
    // Filter out non-article URLs
    const excludePatterns = [
      '/search', '/archives', '/all_tags', '/all_writers',
      '/privacy-policy', '/terms-conditions', '/converter',
      '/about-us', '/namaz', '/contact'
    ]
    return !excludePatterns.some(pattern => url.includes(pattern)) &&
           !url.match(/-\d{8}$/) // Exclude date archive URLs
  }

  private extractTitleFromUrl(url: string): string {
    // Try to extract title from URL or use last segment
    const segments = url.split('/')
    const lastSegment = segments[segments.length - 1]
    // If it's just a number, we can't extract title from URL
    if (lastSegment.match(/^\d+$/)) {
      return 'Article'
    }
    // Convert slug to title case
    return lastSegment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  private extractImageFromUrl(urlElement: Element): string | undefined {
    const imageLoc = urlElement.querySelector('image\\:loc image:loc')
    return imageLoc?.textContent?.trim()
  }
}

// RSS Discovery Handler
export class RSSDiscoveryHandler extends NewsSourceHandler {
  canHandle(type: string, config: any): boolean {
    return type === 'AUTO'
  }

  async fetch(config: any): Promise<NewsSourceResult> {
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
      ]

      const baseUrl = config.url.replace(/\/$/, '') // Remove trailing slash

      for (const path of commonPaths) {
        try {
          const feedUrl = `${baseUrl}${path}`
          const rssHandler = new RSSHandler()
          const result = await rssHandler.fetch({ url: feedUrl })

          if (result.success && result.items.length > 0) {
            return result
          }
        } catch (error) {
          // Continue to next path
          continue
        }
      }

      // Try Feedsearch.dev API as fallback
      try {
        const response = await fetch(`https://feedsearch.dev/api/v1/search?url=${encodeURIComponent(config.url)}`, {
          headers: {
            'User-Agent': 'News-Agent/1.0'
          }
        })

        if (response.ok) {
          const feedData = await response.json()

          if (feedData?.feeds?.length > 0) {
            const feedUrl = feedData.feeds[0].url
            const rssHandler = new RSSHandler()
            return await rssHandler.fetch({ url: feedUrl })
          }
        }
      } catch (apiError) {
        // API failed, continue
      }

      return {
        items: [],
        success: false,
        method: 'rss',
        error: 'No RSS feeds found'
      }
    } catch (error) {
      return {
        items: [],
        success: false,
        method: 'rss',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export class WebScraperHandler extends NewsSourceHandler {
    canHandle(type: string, config: any): boolean {
        return type === 'SCRAPE';
    }

    async fetch(config: any): Promise<NewsSourceResult> {
        const browser = await PlaywrightBrowser.getBrowser();
        const page = await browser.newPage();
        try {
            await page.goto(config.url, { waitUntil: 'networkidle' });
            const links = await getLinks(page, config.url);
            const items: NewsItem[] = [];
            for (const link of links) {
                try {
                    const articlePage = await browser.newPage();
                    await articlePage.goto(link, { waitUntil: 'networkidle' });
                    const content = await articlePage.content();
                    if(!content) continue;
                    const article = await extract(content);
                    if (!article) continue;
                    let articles = [];
                    if(Array.isArray(article)){
                        articles = article;
                    } else {
                        articles.push(article);
                    }

                    for(const art of articles){
                        items.push({
                            title: art.title || 'Untitled',
                            content: art.content || '',
                            summary: art.description || '',
                            url: art.url || link,
                            publishedAt: art.published ? new Date(art.published) : undefined,
                            author: art.author || '',
                            image: art.image || '',
                            tags: []
                        });
                    }

                    await articlePage.close();
                } catch (e: any) {
                    console.error(`Error scraping ${link}: ${e.message}`);
                }
            }
            return {
                items,
                success: true,
                method: 'scraping',
            };
        } catch (e: any) {
            return {
                items: [],
                success: false,
                method: 'scraping',
                error: e.message,
            };
        } finally {
            await page.close();
        }
    }
}
class PlaywrightBrowser {
    private static browser: Browser;

    static async getBrowser() {
        if (!this.browser) {
            const { chromium } = require('playwright');
            this.browser = await chromium.launch();
        }
        return this.browser;
    }

    static async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Universal News Agent Handler
export class UniversalNewsHandler extends NewsSourceHandler {
  canHandle(type: string, config: any): boolean {
    return type === 'UNIVERSAL_AGENT' || type === 'AUTO';
  }

  async fetch(config: any): Promise<NewsSourceResult> {
    try {
      const agent = new UniversalNewsAgent({
        url: config.url || config.rssUrl,
        maxConcurrency: config.maxConcurrency || 3,
        cacheTimeout: config.cacheTimeout || 3600000,
        userAgent: config.userAgent || 'News-Agent/1.0'
      });

      const result = await agent.fetchNews();
      await agent.cleanup();

      if (!result.success) {
        return {
          items: [],
          success: false,
          method: 'api',
          error: result.error || 'Universal agent failed to fetch news'
        };
      }

      // Convert NewsArticle to NewsItem
      const items: NewsItem[] = result.articles.map((article: NewsArticle) => ({
        title: article.title,
        content: article.content,
        description: article.description,
        summary: article.description,
        url: article.url,
        publishedAt: new Date(article.published_at),
        published_at: article.published_at,
        author: article.author,
        image: article.image,
        category: article.category,
        language: article.language,
        source: article.source,
        tags: [article.category].filter(Boolean) // Convert category to tags array
      }));

      return {
        items,
        success: true,
        method: result.method === 'sitemap' ? 'scraping' : result.method
      };
    } catch (error) {
      return {
        items: [],
        success: false,
        method: 'api',
        error: error instanceof Error ? error.message : 'Unknown error in universal agent'
      };
    }
  }
}

async function getLinks(page: Page, baseUrl: string) {
    const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors.map(anchor => anchor.href);
    });
    return links.map(link => getAbsoluteUrl(link, baseUrl)).filter(link => link.startsWith(baseUrl));
}

function getAbsoluteUrl(url: string, baseUrl: string) {
    try {
        return new URL(url, baseUrl).href;
    } catch (e) {
        return '';
    }
}

// Main News Source Manager
export class NewsSourceManager {
  private handlers: NewsSourceHandler[] = []

  constructor() {
    this.handlers = [
      new RSSHandler(),
      new RSSDiscoveryHandler(),
      new SitemapHandler(),
      new ArticleExtractionHandler(),
      new WebScraperHandler(),
      new UniversalNewsHandler()
    ]
  }

  async fetchNewsSource(type: string, config: any): Promise<NewsSourceResult> {
    // Try RSS first if AUTO
    if (type === 'AUTO') {
      // 1. Try RSS discovery
      const rssDiscovery = this.handlers.find(h => h instanceof RSSDiscoveryHandler)
      if (rssDiscovery) {
        const rssResult = await rssDiscovery.fetch(config)
        if (rssResult.success && rssResult.items.length > 0) {
          return rssResult
        }
      }

      // 2. Try sitemap parsing
      const sitemap = this.handlers.find(h => h instanceof SitemapHandler)
      if (sitemap) {
        const sitemapResult = await sitemap.fetch(config)
        if (sitemapResult.success && sitemapResult.items.length > 0) {
          return sitemapResult
        }
      }

      // 3. Try article extraction
      const extraction = this.handlers.find(h => h instanceof ArticleExtractionHandler)
      if (extraction) {
        const extractionResult = await extraction.fetch(config)
        if (extractionResult.success && extractionResult.items.length > 0) {
          return extractionResult
        }
      }
    }

    if(type === 'SCRAPE'){
        const scraper = this.handlers.find(h => h instanceof WebScraperHandler)
        if(scraper){
            return scraper.fetch(config)
        }
    }

    if(type === 'UNIVERSAL_AGENT'){
        const universalHandler = this.handlers.find(h => h instanceof UniversalNewsHandler)
        if(universalHandler){
            return universalHandler.fetch(config)
        }
    }

    // Try specific handlers
    for (const handler of this.handlers) {
      if (handler.canHandle(type, config)) {
        const result = await handler.fetch(config)
        if (result.success) {
          return result
        }
      }
    }

    return {
      items: [],
      success: false,
      method: 'api',
      error: 'No suitable handler found or all handlers failed'
    }
  }
}