import { extract } from '@extractus/article-extractor'
import Parser from 'rss-parser'

export interface NewsItem {
  title: string
  content?: string
  summary?: string
  url: string
  publishedAt?: Date
  author?: string
  image?: string
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
      const articles = await extract(config.url, {
        words: 0, // No word limit
        descriptionLengthThreshold: 180,
        contentLengthThreshold: 200,
        useReadability: true,
        ...config.options
      })

      if (!articles || !Array.isArray(articles)) {
        return {
          items: [],
          success: false,
          method: 'extraction',
          error: 'No articles extracted'
        }
      }

      const items: NewsItem[] = articles.map((article: any) => ({
        title: article.title || 'Untitled',
        content: article.content,
        summary: article.description,
        url: article.url || config.url,
        publishedAt: article.published ? new Date(article.published) : undefined,
        author: article.author,
        image: article.image,
        tags: article.tags || []
      }))

      return {
        items,
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

// Main News Source Manager
export class NewsSourceManager {
  private handlers: NewsSourceHandler[] = []

  constructor() {
    this.handlers = [
      new RSSHandler(),
      new RSSDiscoveryHandler(),
      new ArticleExtractionHandler()
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

      // 2. Try article extraction
      const extraction = this.handlers.find(h => h instanceof ArticleExtractionHandler)
      if (extraction) {
        const extractionResult = await extraction.fetch(config)
        if (extractionResult.success && extractionResult.items.length > 0) {
          return extractionResult
        }
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