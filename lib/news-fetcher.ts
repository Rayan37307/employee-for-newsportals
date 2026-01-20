import { JSDOM } from 'jsdom';

/**
 * Bangladesh Guardian News Fetcher
 * Fetches latest news from Bangladesh Guardian website
 */
export interface NewsArticle {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  image?: string;
}

export interface ScrapingResult {
  articles: NewsArticle[];
  error?: string;
}

/**
 * Fetch news using JSDOM for static content
 */
export async function fetchNewsWithJSDOM(): Promise<ScrapingResult> {
  try {
    // Using a more reliable fetch approach
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch('https://www.bangladeshguardian.com/latest', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    const dom = new JSDOM(html);
    const document = dom.window.document;

    const articles: NewsArticle[] = [];
    const articleElements = document.querySelectorAll('.LatestNews');

    for (let i = 0; i < articleElements.length; i++) {
      const el = articleElements[i];

      // Get link
      const linkEl = el.querySelector('a');
      let link = '';
      if (linkEl && linkEl.getAttribute('href')) {
        link = linkEl.getAttribute('href')!;
        if (link.startsWith('/')) {
          link = 'https://www.bangladeshguardian.com' + link;
        }
      }

      // Get title
      const titleEl = el.querySelector('h3.Title');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';

      // Get description if available
      const descEl = el.querySelector('p.Description');
      const description = descEl ? descEl.textContent?.trim() || '' : '';

      if (title && link) {
        articles.push({
          title,
          link,
          description
        });
      }
    }

    return { articles };
  } catch (error) {
    console.error('Error fetching news with JSDOM:', error);
    return { articles: [], error: (error as Error).message };
  }
}

/**
 * Alternative fetch method using a proxy or different approach if direct fetch fails
 */
export async function fetchNewsWithAlternativeMethod(): Promise<ScrapingResult> {
  try {
    // This could be implemented with a different approach if needed
    // For example, using a proxy service or different headers
    console.log('Using alternative method to fetch news...');

    // For now, returning an empty result
    return { articles: [] };
  } catch (error) {
    console.error('Error in alternative news fetch method:', error);
    return { articles: [], error: (error as Error).message };
  }
}

/**
 * Main function to fetch news with fallback methods
 */
export async function fetchLatestNews(): Promise<ScrapingResult> {
  // Try JSDOM first (faster)
  let result = await fetchNewsWithJSDOM();

  // If JSDOM fails or returns no articles, try alternative method
  if (!result.articles.length || result.error) {
    console.log('JSDOM failed, trying alternative method...');
    result = await fetchNewsWithAlternativeMethod();
  }

  return result;
}

/**
 * Sanitize text to mask sensitive words
 */
export function sanitizeText(text: string): string {
  if (!text) return text;

  // Define replacements for sensitive words
  const replacements: { [key: string]: string } = {
    // Kill family
    '\\bkill\\b': 'Ki*ll',
    '\\bkills\\b': 'Ki*lls',
    '\\bkilled\\b': 'Kil*led',
    // Murder family
    '\\bmurder\\b': 'Mu*rder',
    '\\bmurders\\b': 'Mu*rders',
    '\\bmurdered\\b': 'Mur*dered',
    // Assassinate family
    '\\bassassinate\\b': 'As*sa*ssinate',
    '\\bassassinates\\b': 'As*sa*ssinates',
    '\\bassassinated\\b': 'As*sa*ssinated',
    // Stab family
    '\\bstab\\b': 'St*ab',
    '\\bstabs\\b': 'St*abs',
    '\\bstabbed\\b': 'St*abbed',
    // Slaughter family
    '\\bslaughter\\b': 'Sl*aughter',
    '\\bslaughters\\b': 'Sl*aughters',
    '\\bslaughtered\\b': 'Sl*aughtered',
    // Rape family
    '\\brape\\b': 'Ra*pe',
    '\\brapes\\b': 'Ra*pes',
    '\\braped\\b': 'Ra*ped',
    // Geo/political
    '\\bgaza\\b': 'Ga*za',
    '\\bisrael\\b': 'Isr*ael',
    '\\bpalestine\\b': 'Pa*le*stine',
  };

  let sanitized = text;
  for (const [pattern, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(pattern, 'gi');
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}

/**
 * Fetch image from an article URL
 */
export async function fetchArticleImage(articleUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Try to find the main image in the article
    // Look for og:image meta tag first
    const ogImage = document.querySelector('meta[property="og:image"], meta[name="og:image"]');
    if (ogImage) {
      return ogImage.getAttribute('content') || null;
    }

    // Look for twitter:image meta tag
    const twitterImage = document.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]');
    if (twitterImage) {
      return twitterImage.getAttribute('content') || null;
    }

    // Look for image in the article content
    const imgTags = document.querySelectorAll('img');
    for (let i = 0; i < imgTags.length; i++) {
      const img = imgTags[i];
      const src = img.getAttribute('src');
      if (src) {
        // Skip common logo/image placeholders
        const lowerSrc = src.toLowerCase();
        if (!lowerSrc.includes('logo') && !lowerSrc.includes('icon') && !lowerSrc.includes('avatar')) {
          // Return absolute URL if it's a relative one
          if (src.startsWith('//')) {
            return `https:${src}`;
          } else if (src.startsWith('/')) {
            const url = new URL(articleUrl);
            return `${url.origin}${src}`;
          }
          return src;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching image from ${articleUrl}:`, error);
    return null;
  }
}