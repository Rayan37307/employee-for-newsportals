import { NextResponse } from 'next/server';
import { chromium, Browser, Page } from 'playwright';
import prisma from '@/lib/db';

const NEWS_URL = 'https://www.bangladeshguardian.com/latest';

interface Article {
  title: string;
  link: string;
}

interface ProcessedArticle {
  id?: string;
  title: string;
  sanitizedTitle: string;
  link: string;
  image: string | null;
  content: string;
  description: string;
  author: string;
  publishedAt: string;
  category: string;
  isNew: boolean;
}

function sanitizeText(text: string): string {
  if (!text) return text;
  
  const replacements: Record<string, string> = {
    '\\bkill\\b': 'Ki*ll',
    '\\bkills\\b': 'Ki*lls',
    '\\bkilled\\b': 'Kil*led',
    '\\bmurder\\b': 'Mu*rder',
    '\\bmurders\\b': 'Mu*rders',
    '\\bmurdered\\b': 'Mur*dered',
    '\\bassassinate\\b': 'As*sa*ssinate',
    '\\bassassinates\\b': 'As*sa*ssinates',
    '\\bassassinated\\b': 'As*sa*ssinated',
    '\\bstab\\b': 'St*ab',
    '\\bstabs\\b': 'St*abs',
    '\\bstabbed\\b': 'St*abbed',
    '\\bslaughter\\b': 'Sl*aughter',
    '\\bslaughters\\b': 'Sl*aughters',
    '\\bslaughtered\\b': 'Sl*aughtered',
    '\\brape\\b': 'Ra*pe',
    '\\brapes\\b': 'Ra*pes',
    '\\braped\\b': 'Ra*ped',
    '\\bgaza\\b': 'Ga*za',
    '\\bisrael\\b': 'Isr*ael',
    '\\bpalestine\\b': 'Pa*le*stine',
  };

  let sanitized = text;
  for (const [pattern, replacement] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), replacement);
  }
  return sanitized;
}

function isProbablyLogo(url: string): boolean {
  if (!url) return true;
  const lowered = url.toLowerCase();
  const bannedKeywords = ['logo', 'favicon', 'sprite', 'placeholder', 'default', 'avatar'];
  return bannedKeywords.some(k => lowered.includes(k));
}

async function extractArticleDetails(page: Page, articleUrl: string): Promise<{
  image: string | null;
  content: string;
  description: string;
  author: string;
  publishedAt: string;
  category: string;
}> {
  try {
    await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const details = await page.evaluate((url: string) => {
      const result: {
        image: string | null;
        content: string;
        description: string;
        author: string;
        publishedAt: string;
        category: string;
      } = {
        image: null,
        content: '',
        description: '',
        author: '',
        publishedAt: '',
        category: ''
      };

      // Image
      const imgSelectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'script[type="application/ld+json"]'
      ];
      
      for (const selector of imgSelectors) {
        if (result.image) break;
        const el = document.querySelector(selector);
        if (selector.includes('ld+json') && el) {
          try {
            const data = JSON.parse(el.textContent || '{}');
            if (data.image) {
              result.image = typeof data.image === 'string' ? data.image : data.image.url;
            }
            if (data.datePublished) result.publishedAt = data.datePublished;
            if (data.author) result.author = typeof data.author === 'string' ? data.author : data.author.name || '';
          } catch {}
        } else if (el) {
          const attr = el.getAttribute('content');
          if (attr) result.image = attr;
        }
      }

      // Description
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
      if (metaDesc) result.description = metaDesc;
      
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
      if (ogDesc && !result.description) result.description = ogDesc;

      // Published At
      const pubDateMeta = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
      if (pubDateMeta) result.publishedAt = pubDateMeta;
      
      const timeEl = document.querySelector('time[datetime]');
      if (timeEl && !result.publishedAt) {
        result.publishedAt = timeEl.getAttribute('datetime') || '';
      }

      // Author
      const authorMeta = document.querySelector('meta[name="author"]')?.getAttribute('content');
      if (authorMeta) result.author = authorMeta;
      
      const authorEl = document.querySelector('[rel="author"], .author, .byline, .article-author, [class*="author"]');
      if (authorEl && !result.author) {
        result.author = authorEl.textContent?.trim() || '';
      }

      // Category - from URL path
      const urlParts = url.split('/');
      const possibleCategory = urlParts[urlParts.length - 2];
      const validCategories = ['national', 'international', 'country', 'sports', 'politics', 'business', 'entertainment', 'technology', 'opinion', 'fact-check', 'law-court'];
      if (validCategories.includes(possibleCategory)) {
        result.category = possibleCategory.charAt(0).toUpperCase() + possibleCategory.slice(1);
      }

      // Content
      const allParagraphs = document.querySelectorAll('p');
      const contentParts: string[] = [];
      allParagraphs.forEach((p) => {
        const text = p.textContent?.trim() || '';
        if (text.length > 50 && 
            !text.toLowerCase().includes('advertisement') &&
            !text.toLowerCase().includes('subscribe') &&
            !text.toLowerCase().includes('copyright') &&
            !text.toLowerCase().includes('follow us') &&
            !text.toLowerCase().includes('share this') &&
            !text.toLowerCase().includes('related') &&
            !text.toLowerCase().includes('loading')) {
          contentParts.push(text);
        }
      });
      
      result.content = contentParts.join('\n\n');

      if (!result.content || result.content.length < 100) {
        const allTextElements = document.querySelectorAll('div, section, article, main');
        const textChunks: string[] = [];
        allTextElements.forEach((el) => {
          const text = el.textContent?.trim() || '';
          if (text.length > 100 && text.length < 2000 && !text.includes('Loading')) {
            textChunks.push(text);
          }
        });
        if (textChunks.length > 0) {
          textChunks.sort((a, b) => b.length - a.length);
          result.content = textChunks[0];
        }
      }

      if (!result.content && result.description) {
        result.content = result.description;
      }

      return result;
    }, articleUrl);

    if (details.image && !isProbablyLogo(details.image)) {
      try {
        details.image = new URL(details.image, articleUrl).href;
      } catch {
        details.image = null;
      }
    } else {
      details.image = null;
    }

    return details;
  } catch (error) {
    console.error(`Error extracting details from ${articleUrl}:`, error);
    return {
      image: null,
      content: '',
      description: '',
      author: '',
      publishedAt: '',
      category: ''
    };
  }
}

export async function GET() {
  let browser: Browser | null = null;
  
  try {
    console.log('🔍 Checking for latest news from Bangladesh Guardian...');
    
    // Get already posted links from database
    const postedLinks = await prisma.postedLink.findMany({
      where: { source: 'bangladesh_guardian' },
      select: { url: true }
    });
    
    const postedUrls = new Set(postedLinks.map(p => p.url));
    console.log(`📋 Found ${postedUrls.size} previously posted links`);
    
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(NEWS_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const articles: Article[] = await page.evaluate(() => {
      const results: Article[] = [];
      const allLinks = document.querySelectorAll('a[href]');
      const seenUrls = new Set<string>();
      
      allLinks.forEach((link) => {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim();
        
        if (href.includes('bangladeshguardian.com') && 
            href.match(/\/\d+$/) &&
            !href.includes('/latest') &&
            !href.includes('/category') &&
            !href.includes('/search') &&
            !href.includes('/page') &&
            text && 
            text.length > 15 &&
            text.length < 200 &&
            !seenUrls.has(href)) {
          
          seenUrls.add(href);
          results.push({ title: text, link: href });
        }
      });
      
      return results;
    });
    
    console.log(`📰 Found ${articles.length} articles on page`);
    
    // Filter out already posted articles
    const newArticles = articles.filter(a => !postedUrls.has(a.link));
    console.log(`🆕 ${newArticles.length} new articles (not yet posted)`);
    
    if (newArticles.length === 0) {
      await browser.close();
      return NextResponse.json({
        success: true,
        message: 'No new articles',
        count: 0,
        articles: []
      });
    }
    
    // Extract details for new articles
    const processedArticles: ProcessedArticle[] = [];
    
    for (const article of newArticles) {
      console.log(`📄 Extracting: ${article.title.substring(0, 40)}...`);
      
      const details = await extractArticleDetails(page, article.link);
      
      // Save to database as posted
      const savedLink = await prisma.postedLink.create({
        data: {
          url: article.link,
          title: article.title,
          source: 'bangladesh_guardian'
        }
      });
      
      processedArticles.push({
        id: savedLink.id,
        title: article.title,
        sanitizedTitle: sanitizeText(article.title),
        link: article.link,
        image: details.image,
        content: sanitizeText(details.content),
        description: sanitizeText(details.description),
        author: details.author,
        publishedAt: details.publishedAt,
        category: details.category,
        isNew: true
      });
      
      // Small delay between processing to avoid overwhelming
      await page.waitForTimeout(500);
    }
    
    await browser.close();
    
    return NextResponse.json({
      success: true,
      message: `Posted ${processedArticles.length} new article(s)`,
      count: processedArticles.length,
      articles: processedArticles
    });
    
  } catch (error) {
    console.error('❌ Error fetching news:', error);
    if (browser) await browser.close();
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch news',
      articles: []
    }, { status: 500 });
  }
}

// Get all posted links
export async function POST() {
  try {
    const postedLinks = await prisma.postedLink.findMany({
      where: { source: 'bangladesh_guardian' },
      orderBy: { postedAt: 'desc' },
      take: 100
    });
    
    return NextResponse.json({
      success: true,
      count: postedLinks.length,
      links: postedLinks
    });
    
  } catch (error) {
    console.error('❌ Error fetching posted links:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch posted links',
      links: []
    }, { status: 500 });
  }
}
