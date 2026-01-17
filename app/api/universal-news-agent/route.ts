import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { UniversalNewsAgent } from '@/lib/universal-news-agent';

export async function POST(req: NextRequest) {
  try {
    const { url, maxConcurrency = 3, cacheTimeout = 3600000 } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const agent = new UniversalNewsAgent({
      url,
      maxConcurrency,
      cacheTimeout,
      userAgent: 'News-Agent/1.0'
    });

    const result = await agent.fetchNews();
    
    await agent.cleanup();

    return NextResponse.json(result);
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

export async function GET() {
  return NextResponse.json({ 
    message: 'Universal News Agent API - POST to this endpoint with a URL to fetch news' 
  });
}