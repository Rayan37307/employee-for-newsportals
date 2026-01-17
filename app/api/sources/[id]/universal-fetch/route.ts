import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { UniversalNewsAgent } from '@/lib/universal-news-agent';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();

    // Check if source exists
    const source = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Check ownership (unless admin)
    if (user?.role !== 'ADMIN' && source.userId !== user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Use Universal News Agent directly to get the full data structure
    const config = source.config as any;
    const agent = new UniversalNewsAgent({
      url: config.url || config.rssUrl || config.endpoint || '',
      maxConcurrency: 3,
      cacheTimeout: 3600000, // 1 hour
      userAgent: 'News-Agent/1.0'
    });

    const result = await agent.fetchNews();
    await agent.cleanup();

    // Return the raw Universal News Agent result
    return NextResponse.json({
      success: result.success,
      method: result.method,
      error: result.error,
      rawArticles: result.articles, // This contains the full Universal News Agent format
      sampleItem: result.articles.length > 0 ? result.articles[0] : null
    });
  } catch (error) {
    console.error('Error in universal news agent API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch news', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}