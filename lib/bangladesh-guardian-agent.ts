import * as puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import { load } from 'cheerio';

// Configuration
const BASE_URL = "https://www.bangladeshguardian.com";

// Interface for news articles
export interface NewsItem {
  title: string;
  link: string;
  description?: string;
  image?: string;
  date?: string;
}

/**
 * Sanitize text to mask sensitive words
 */
export function sanitizeText(text: string): string {
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
 * Generate today's sitemap URL
 */
function getTodaySitemapUrl(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `https://www.bangladeshguardian.com/english-sitemap/sitemap-daily-${year}-${month}-${day}.xml`;
}

/**
 * Fetch title from article page
 */
async function fetchArticleTitle(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = load(response.data);

    // Try og:title first, then title tag
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) return ogTitle.trim();

    const titleTag = $('title').text().trim();
    if (titleTag) return titleTag.split('|')[0].split('-')[0].trim();

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch complete article data from article page
 */
async function fetchArticleData(url: string): Promise<{
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  date: string | null;
} | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = load(response.data);

    // Extract title
    let title = null;
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) {
      title = ogTitle.trim();
    } else {
      const titleTag = $('title').text().trim();
      if (titleTag) {
        title = titleTag.split('|')[0].split('-')[0].trim();
      }
      else {
        const h1 = $('h1').first().text().trim();
        if (h1) title = h1;
      }
    }

    // Extract description
    let description = null;
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc) {
      description = ogDesc.trim();
    } else {
      const metaDesc = $('meta[name="description"]').attr('content');
      if (metaDesc) {
        description = metaDesc.trim();
      } else {
        // Get first paragraph
        const firstP = $('p').first().text().trim();
        if (firstP && firstP.length > 50) {
          description = firstP.substring(0, 200) + '...';
        }
      }
    }

    // Extract image
    let image = null;
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      image = ogImage.trim();
    }

    // Extract date
    let date = null;
    const publishedTime = $('meta[property="article:published_time"]').attr('content');
    if (publishedTime) {
      date = publishedTime.trim();
    } else {
      // Look for time elements or date strings
      const timeEl = $('time').attr('datetime');
      if (timeEl) {
        date = timeEl.trim();
      }
    }

    return {
      url,
      title,
      description,
      image,
      date
    };
  } catch (error) {
    console.error(`Error fetching article data from ${url}:`, error);
    return null;
  }
}

/**
 * Fetch a single article by its URL
 */
export async function getArticleByUrl(url: string) {
  try {
    const articleData = await fetchArticleData(url);

    if (!articleData) {
      return null;
    }

    // Format the article data to match the expected structure
    return {
      title: articleData.title ? sanitizeText(articleData.title) : null,
      link: articleData.url,
      description: articleData.description ? sanitizeText(articleData.description) : null,
      image: articleData.image || null,
      date: articleData.date || null,
      content: articleData.description || null, // Using description as content if available
      author: null, // Author is not extracted in the current implementation
      publishedAt: articleData.date || null,
      category: null // Category is not extracted in the current implementation
    };
  } catch (error) {
    console.error(`Error getting article by URL ${url}:`, error);
    return null;
  }
}

/**
 * Fetch the latest news from Bangladesh Guardian by scraping /latest/ page
 */
export async function getLatestNews(): Promise<NewsItem[]> {
  console.log('🔍 Checking for latest news from Bangladesh Guardian...');

  let browser;
  try {
    // Launch Puppeteer
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Navigate to the /latest/ page
    const latestUrl = `${BASE_URL}/latest/`;
    console.log(`  Navigating to ${latestUrl} with Puppeteer...`);

    await page.goto(latestUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for a common element that indicates content has loaded
    // This is a heuristic and might need adjustment
    await page.waitForSelector('article', { timeout: 15000 }).catch(() => {
        console.warn('  Puppeteer: "article" selector not found within timeout. Continuing anyway.');
    });

    const html = await page.content();
    // Save HTML to a temporary file for inspection
    const fs = require('fs');
    fs.writeFileSync('./temp-bg-latest.html', html);
    console.log('  Saved rendered HTML to ./temp-bg-latest.html');
    const $ = load(html);
    const articles: NewsItem[] = [];

    // Extract article links from the page
    // Look for article links based on the actual Bangladesh Guardian structure
    const articleLinks: string[] = [];

    // Specific selectors for Bangladesh Guardian articles
    const selectors = [
      '.LatestNews a[href]',  // Main article containers
      '.TopHomeSection a[href]',  // Top section articles
      '.Latest-container a[href]'  // Latest container articles
    ];

    for (const selector of selectors) {
      $(selector).each((index, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, BASE_URL).href;
          // Filter for article URLs (contain numbers or specific patterns)
          if ((/\/\d+/.test(fullUrl) || /\d+$/.test(href)) && fullUrl.includes(BASE_URL)) {
            articleLinks.push(fullUrl);
          }
        }
      });
    }

    // Remove duplicates
    const uniqueLinks = [...new Set(articleLinks)];
    console.log(`  Found ${uniqueLinks.length} article links on /latest/ page`);

    // Fetch details for first 20 articles (with concurrency limit)
    const concurrency = 3;
    for (let i = 0; i < Math.min(uniqueLinks.length, 20); i += concurrency) {
      const batch = uniqueLinks.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(async (url) => {
        try {
          const articleData = await fetchArticleData(url);
          return articleData;
        } catch (error) {
          console.error(`Error fetching ${url}:`, error);
          return null;
        }
      }));

      for (const articleData of results) {
        if (articleData && articleData.title) {
          articles.push({
            title: sanitizeText(articleData.title),
            link: articleData.url,
            description: articleData.description || undefined,
            image: articleData.image || undefined,
            date: articleData.date || undefined
          });
        }
      }

      console.log(`  Processed ${Math.min(i + concurrency, uniqueLinks.length)}/${Math.min(uniqueLinks.length, 20)}`);
    }

    console.log(`📰 Found ${articles.length} articles from Bangladesh Guardian`);
    return articles;

  } catch (error) {
    console.error('❌ Error fetching /latest/ page with Puppeteer:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}