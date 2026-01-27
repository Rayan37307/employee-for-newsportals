import { NextResponse } from 'next/server';
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


export async function GET() {
  console.log('🔍 Checking for latest news from Bangladesh Guardian...');

  // Get already posted links from database
  const postedLinks = await prisma.postedLink.findMany({
    where: { source: 'bangladesh_guardian' },
    select: { url: true }
  });

  const postedUrls = new Set(postedLinks.map(p => p.url));
  console.log(`📋 Found ${postedUrls.size} previously posted links`);

  // Use the working agent directly instead of Playwright
  console.log('🔄 Using the working bangladesh-guardian-agent...');
  try {
    const { getLatestNews } = await import('@/lib/bangladesh-guardian-agent');
    const newsItems = await getLatestNews();

    console.log(`✅ Successfully found ${newsItems.length} articles`);

    // Convert to expected format
    const articles = newsItems.map(item => ({
      title: item.title,
      link: item.link
    }));

    // Filter out already posted articles
    const newArticles = articles.filter(a => !postedUrls.has(a.link));
    console.log(`🆕 ${newArticles.length} new articles (not yet posted)`);

    if (newArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new articles',
        count: 0,
        articles: []
      });
    }

    // Process articles (simplified for fallback)
    const processedArticles: ProcessedArticle[] = [];

    for (const article of newArticles) {
      const newsItem = newsItems.find(item => item.link === article.link);
      if (newsItem) {
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
          image: newsItem.image || null,
          content: sanitizeText(newsItem.description || ''),
          description: sanitizeText(newsItem.description || ''),
          author: '', // NewsItem doesn't have author
          publishedAt: newsItem.date || new Date().toISOString(),
          category: 'news', // Default category
          isNew: true
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Found ${processedArticles.length} new articles`,
      count: processedArticles.length,
      articles: processedArticles
    });

  } catch (error) {
    console.error('❌ Bangladesh Guardian agent failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch news from Bangladesh Guardian',
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
