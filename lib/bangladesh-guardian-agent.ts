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
      } else {
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
 * Fetch the latest news from Bangladesh Guardian by scraping /latest/ page
 */
export async function getLatestNews(): Promise<NewsItem[]> {
  console.log('🔍 Checking for latest news from Bangladesh Guardian...');

  try {
    // Fetch the /latest/ page
    const latestUrl = `${BASE_URL}/latest/`;
    console.log(`  Fetching ${latestUrl}...`);

    const response = await axios.get(latestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    const $ = load(response.data);
    const articles: NewsItem[] = [];

    // Extract article links from the page
    // Look for article links - typically in h2, h3 tags or article containers
    const articleLinks: string[] = [];

    // Common selectors for article links on news sites
    const selectors = [
      'article a[href]',
      'h2 a[href]',
      'h3 a[href]',
      '.post-title a[href]',
      '.entry-title a[href]',
      '.article-title a[href]',
      '.news-item a[href]'
    ];

    for (const selector of selectors) {
      $(selector).each((index, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, BASE_URL).href;
          // Filter for article URLs (contain numbers or specific patterns)
          if (/\/\d+/.test(fullUrl) && fullUrl.includes(BASE_URL)) {
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
    console.error('❌ Error fetching /latest/ page:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Fetch article image from the article page
 */
export async function fetchArticleImage(articleUrl: string): Promise<Buffer | null> {
  console.log(`[BangladeshGuardian][ImageFetch] START: ${articleUrl.substring(0, 80)}`);

  try {
    console.log(`[BangladeshGuardian][ImageFetch] Fetching article page...`);

    const response = await axios.get(articleUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' 
      },
      timeout: 15000
    });

    console.log(`[BangladeshGuardian][ImageFetch] Page fetched: status=${response.status}, size=${response.data.length} bytes`);

    const $ = load(response.data);

    // 1. Try meta tags (og:image, twitter:image)
    const metaImage = $('meta[property="og:image"], meta[name="twitter:image"]').attr('content');
    console.log(`[BangladeshGuardian][ImageFetch] Meta og:image check: ${metaImage ? 'found' : 'not found'}`);

    if (metaImage) {
      const imageUrl = new URL(metaImage, articleUrl).href;
      console.log(`[BangladeshGuardian][ImageFetch] Meta image URL: ${imageUrl.substring(0, 80)}`);
      const imageBuffer = await downloadImage(imageUrl);
      if (imageBuffer) {
        console.log(`[BangladeshGuardian][ImageFetch] SUCCESS: Downloaded from meta tag (${imageBuffer.length} bytes)`);
        return imageBuffer;
      } else {
        console.warn(`[BangladeshGuardian][ImageFetch] WARNING: Meta image download failed`);
      }
    }

    // 2. Try JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]');
    console.log(`[BangladeshGuardian][ImageFetch] JSON-LD scripts found: ${jsonLdScripts.length}`);

    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const jsonData = JSON.parse($(jsonLdScripts[i]).text());
        if (jsonData && typeof jsonData === 'object') {
          let imageUrl = null;
          
          if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
              if (item.image) {
                imageUrl = typeof item.image === 'string' ? item.image : item.image.url;
                console.log(`[BangladeshGuardian][ImageFetch] JSON-LD array image found: ${String(imageUrl).substring(0, 60)}`);
                break;
              }
            }
          } else if (jsonData.image) {
            imageUrl = typeof jsonData.image === 'string' ? jsonData.image : jsonData.image.url;
            console.log(`[BangladeshGuardian][ImageFetch] JSON-LD image found: ${String(imageUrl).substring(0, 60)}`);
          }
          
          if (imageUrl) {
            const fullImageUrl = new URL(imageUrl, articleUrl).href;
            const imageBuffer = await downloadImage(fullImageUrl);
            if (imageBuffer) {
              console.log(`[BangladeshGuardian][ImageFetch] SUCCESS: Downloaded from JSON-LD (${imageBuffer.length} bytes)`);
              return imageBuffer;
            } else {
              console.warn(`[BangladeshGuardian][ImageFetch] WARNING: JSON-LD image download failed`);
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
    console.log(`[BangladeshGuardian][ImageFetch] <img> elements found: ${imgElements.length}`);

    for (let i = 0; i < imgElements.length; i++) {
      const img = $(imgElements[i]);
      const src = img.attr('src') || 
                 img.attr('data-src') || 
                 img.attr('data-original') ||
                 img.attr('srcset')?.split(',')[0]?.split(' ')[0];
      
      if (!src) continue;
      
      const fullSrc = new URL(src, articleUrl).href;
      console.log(`[BangladeshGuardian][ImageFetch] Checking img[${i}]: ${fullSrc.substring(0, 60)}`);
      
      // Skip logos and small images
      if (isProbablyLogo(fullSrc)) {
        console.log(`[BangladeshGuardian][ImageFetch] Skipping (probable logo): ${fullSrc.substring(0, 40)}`);
        continue;
      }
      
      const imageBuffer = await downloadImage(fullSrc);
      if (imageBuffer) {
        console.log(`[BangladeshGuardian][ImageFetch] SUCCESS: Downloaded from <img> element (${imageBuffer.length} bytes)`);
        return imageBuffer;
      }
    }

    console.warn(`[BangladeshGuardian][ImageFetch] WARNING: No suitable image found - returning null`);
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BangladeshGuardian][ImageFetch] ERROR: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      console.error(`[BangladeshGuardian][ImageFetch] Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }
    return null;
  }
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  console.log(`[BangladeshGuardian][Download] START: ${url.substring(0, 80)}`);

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    
    console.log(`[BangladeshGuardian][Download] Response: status=${response.status}, size=${response.data.byteLength} bytes`);

    if (response.status === 200) {
      const buffer = Buffer.from(response.data);
      console.log(`[BangladeshGuardian][Download] SUCCESS: ${buffer.length} bytes`);
      return buffer;
    }
    
    console.warn(`[BangladeshGuardian][Download] WARNING: Unexpected status ${response.status} - returning null`);
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStatus = axios.isAxiosError(error) ? ` (status ${error.response?.status})` : '';
    console.error(`[BangladeshGuardian][Download] ERROR: ${errorMessage}${errorStatus}`);
    return null;
  }
}

/**
 * Check if URL is probably a logo
 */
function isProbablyLogo(url: string): boolean {
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