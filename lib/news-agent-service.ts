import { NewsArticle } from './universal-news-agent';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import { load } from 'cheerio';

// Configuration
const NEWS_URL = "https://www.bangladeshguardian.com/latest";
const CHECK_INTERVAL = 300000; // 5 minutes in milliseconds

// Interface for news articles
export interface NewsItem {
  title: string;
  link: string;
  description?: string;
  image?: string;
  date?: string;
}

export interface NewsAgentConfig {
  url?: string;
  checkInterval?: number;
  postedLinksFile?: string;
}

export class NewsAgentService {
  private config: NewsAgentConfig;
  private postedLinks: Set<string> = new Set();
  private imageCache: Map<string, Buffer> = new Map();
  private autopilotEnabled: boolean = false;
  private autopilotInterval: NodeJS.Timeout | null = null;

  constructor(config?: NewsAgentConfig) {
    this.config = {
      url: NEWS_URL,
      checkInterval: CHECK_INTERVAL,
      postedLinksFile: 'posted_links.json',
      ...config
    };
  }

  /**
   * Sanitize text to mask sensitive words
   */
  private sanitizeText(text: string): string {
    if (!text) return text;
    
    const replacements = {
      // Kill family
      kill: 'Ki*ll',
      kills: 'Ki*lls',
      killed: 'Kil*led',
      // Murder family
      murder: 'Mu*rder',
      murders: 'Mu*rders',
      murdered: 'Mur*dered',
      // Assassinate family
      assassinate: 'As*sa*ssinate',
      assassinates: 'As*sa*ssinates',
      assassinated: 'As*sa*ssinated',
      // Stab family
      stab: 'St*ab',
      stabs: 'St*abs',
      stabbed: 'St*abbed',
      // Slaughter family
      slaughter: 'Sl*aughter',
      slaughters: 'Sl*aughters',
      slaughtered: 'Sl*aughtered',
      // Rape family
      rape: 'Ra*pe',
      rapes: 'Ra*pes',
      raped: 'Ra*ped',
      // Geo/political
      gaza: 'Ga*za',
      israel: 'Isr*ael',
      palestine: 'Pa*le*stine',
    };

    let sanitized = text;
    for (const [pattern, replacement] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      sanitized = sanitized.replace(regex, replacement);
    }
    return sanitized;
  }

  /**
   * Fetch the latest news from Bangladesh Guardian
   */
  async getLatestNews(): Promise<NewsItem[]> {
    console.log('🔍 Checking for latest news...');
    
    try {
      // Try requests + Cheerio first (faster)
      const response = await axios.get(this.config.url!, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' 
        },
        timeout: 15000
      });
      
      const $ = load(response.data);
      const articles: NewsItem[] = [];
      
      $('.LatestNews').each((index, element) => {
        try {
          const linkElement = $(element).find('a');
          const link = linkElement.attr('href');
          
          if (!link) return;
          
          const fullLink = link.startsWith('/') 
            ? `https://www.bangladeshguardian.com${link}`
            : link;
            
          const titleElement = $(element).find('h3.Title');
          const title = titleElement.text().trim();
          
          if (title && fullLink) {
            articles.push({
              title: this.sanitizeText(title),
              link: fullLink
            });
          }
        } catch (error) {
          console.error('Error parsing article:', error);
        }
      });
      
      console.log(`📰 Found ${articles.length} articles`);
      return articles;
    } catch (error) {
      console.error('❌ Error fetching news:', error);
      return [];
    }
  }

  /**
   * Fetch article image from the article page
   */
  async fetchArticleImage(articleUrl: string): Promise<Buffer | null> {
    try {
      // Check cache first
      if (this.imageCache.has(articleUrl)) {
        console.log(`Using cached image for: ${articleUrl}`);
        return this.imageCache.get(articleUrl)!;
      }

      console.log(`Fetching image from: ${articleUrl}`);

      const response = await axios.get(articleUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' 
        },
        timeout: 15000
      });

      const $ = load(response.data);

      // 1. Try meta tags (og:image, twitter:image)
      const metaImage = $('meta[property="og:image"], meta[name="twitter:image"]').attr('content');
      if (metaImage) {
        const imageUrl = new URL(metaImage, articleUrl).href;
        const imageBuffer = await this.downloadImage(imageUrl);
        if (imageBuffer) {
          this.imageCache.set(articleUrl, imageBuffer);
          return imageBuffer;
        }
      }

      // 2. Try JSON-LD
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonData = JSON.parse($(jsonLdScripts[i]).text());
          if (jsonData && typeof jsonData === 'object') {
            let imageUrl = null;
            
            if (Array.isArray(jsonData)) {
              for (const item of jsonData) {
                if (item.image) {
                  imageUrl = typeof item.image === 'string' ? item.image : item.image.url;
                  break;
                }
              }
            } else if (jsonData.image) {
              imageUrl = typeof jsonData.image === 'string' ? jsonData.image : jsonData.image.url;
            }
            
            if (imageUrl) {
              const fullImageUrl = new URL(imageUrl, articleUrl).href;
              const imageBuffer = await this.downloadImage(fullImageUrl);
              if (imageBuffer) {
                this.imageCache.set(articleUrl, imageBuffer);
                return imageBuffer;
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON
          continue;
        }
      }

      // 3. Try in-article images
      const imgElements = $('img');
      for (let i = 0; i < imgElements.length; i++) {
        const img = $(imgElements[i]);
        const src = img.attr('src') || 
                   img.attr('data-src') || 
                   img.attr('data-original') ||
                   img.attr('srcset')?.split(',')[0]?.split(' ')[0];
        
        if (!src) continue;
        
        const fullSrc = new URL(src, articleUrl).href;
        
        // Skip logos and small images
        if (this.isProbablyLogo(fullSrc)) continue;
        
        const imageBuffer = await this.downloadImage(fullSrc);
        if (imageBuffer) {
          this.imageCache.set(articleUrl, imageBuffer);
          return imageBuffer;
        }
      }

      console.log('No suitable image found');
      return null;
    } catch (error) {
      console.error(`Error fetching image from ${articleUrl}:`, error);
      return null;
    }
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000
      });
      
      if (response.status === 200) {
        const buffer = Buffer.from(response.data);
        
        // Validate image dimensions (minimum 400x250)
        // Note: For a full implementation, we would need to check actual dimensions
        // For now, we'll just return the buffer
        
        return buffer;
      }
      
      return null;
    } catch (error) {
      console.error(`Error downloading image from ${url}:`, error);
      return null;
    }
  }

  /**
   * Check if URL is probably a logo
   */
  private isProbablyLogo(url: string): boolean {
    if (!url) return true;
    const lowered = url.toLowerCase();
    const bannedKeywords = [
      'logo',
      'favicon',
      'sprite',
      'placeholder',
      'default',
      'avatar',
    ];
    return bannedKeywords.some(k => lowered.includes(k));
  }

  /**
   * Process and generate news cards
   */
  async processNews(): Promise<NewsItem[]> {
    const newsArticles = await this.getLatestNews();
    
    if (!newsArticles.length) {
      console.log('No articles to process');
      return [];
    }

    const newArticles: NewsItem[] = [];
    
    for (const article of newsArticles) {
      // Skip if already processed
      if (this.postedLinks.has(article.link)) {
        continue;
      }

      console.log(`🆕 New article: ${article.title.substring(0, 60)}...`);

      // Add to posted links to avoid duplicates
      this.postedLinks.add(article.link);
      newArticles.push(article);
    }

    if (newArticles.length > 0) {
      console.log(`🎉 Found ${newArticles.length} new articles!`);
    } else {
      console.log('📰 No new articles to process');
    }

    return newArticles;
  }

  /**
   * Start autopilot mode
   */
  startAutopilot(onNewNews: (news: NewsItem[]) => Promise<void>): void {
    if (this.autopilotEnabled) {
      console.log('Autopilot is already running');
      return;
    }

    this.autopilotEnabled = true;
    console.log('🚀 Starting autopilot mode...');
    
    const checkForNews = async () => {
      try {
        console.log('🔄 Starting news check cycle...');
        const newArticles = await this.processNews();
        
        if (newArticles.length > 0) {
          await onNewNews(newArticles);
        }
      } catch (error) {
        console.error('❌ Error in autopilot cycle:', error);
      }
    };

    // Run immediately
    checkForNews();

    // Then run periodically
    this.autopilotInterval = setInterval(checkForNews, this.config.checkInterval);
  }

  /**
   * Stop autopilot mode
   */
  stopAutopilot(): void {
    if (this.autopilotInterval) {
      clearInterval(this.autopilotInterval);
      this.autopilotInterval = null;
    }
    this.autopilotEnabled = false;
    console.log('🛑 Stopped autopilot mode');
  }

  /**
   * Check if autopilot is running
   */
  isAutopilotRunning(): boolean {
    return this.autopilotEnabled;
  }

  /**
   * Add a link to the posted links set
   */
  addPostedLink(link: string): void {
    this.postedLinks.add(link);
  }

  /**
   * Get all posted links
   */
  getPostedLinks(): Set<string> {
    return new Set(this.postedLinks);
  }
}