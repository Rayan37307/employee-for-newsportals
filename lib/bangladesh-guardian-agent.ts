import { JSDOM } from 'jsdom';
import axios from 'axios';
import { load } from 'cheerio';

// Configuration
const NEWS_URL = "https://www.bangladeshguardian.com/latest";

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
 * Fetch the latest news from Bangladesh Guardian
 */
export async function getLatestNews(): Promise<NewsItem[]> {
  console.log('🔍 Checking for latest news...');
  
  try {
    // Try requests + Cheerio first (faster)
    const response = await axios.get(NEWS_URL, {
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
            title: sanitizeText(title),
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