import { NextRequest, NextResponse } from 'next/server';
import { getLatestNews } from '@/lib/bangladesh-guardian-agent';
import prisma from '@/lib/db';
import { generateCardImage } from '@/lib/card-generator-puppeteer';
import { compositeImage, getImagePlaceholder } from '@/lib/image-processor';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sourceId } = await params;

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    // Fetch the source to get its type and configuration
    const source = await prisma.newsSource.findUnique({
      where: { id: sourceId }
    });

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Import the universal news agent to handle different source types
    const { UniversalNewsAgent } = await import('@/lib/universal-news-agent');

    // Create agent with source config
    const agent = new UniversalNewsAgent({
      url: source.config.url || source.config.endpoint,
      maxConcurrency: 3,
      cacheTimeout: 3600000,
      userAgent: 'News-Agent/1.0'
    });

    // Fetch news based on source type and configuration
    const result = await agent.fetchNews();
    await agent.cleanup();

    if (!result.success || result.articles.length === 0) {
      return NextResponse.json({ error: result.error || 'Failed to fetch news from source' }, { status: 500 });
    }

    // Filter valid articles
    const validArticles = result.articles.filter((article: any) => {
      return !article.extraction_failed &&
             !article.extraction_trace?.is_listing_page &&
             !article.extraction_trace?.is_contact_page &&
             !article.extraction_trace?.is_advertisement &&
             (article.extraction_trace?.content_quality_score || 100) >= 60;
    });

    // Map articles to news items format expected by the rest of the code
    const newsItems = validArticles.map((article: any) => ({
      title: article.title,
      content: article.content,
      description: article.description,
      summary: article.description,
      link: article.url,
      publishedAt: new Date(article.published_at),
      published_at: article.published_at,
      author: article.author,
      image: article.image,
      category: article.category,
      source: article.source
    }));

    // Process each news item to extract content
    const processedItems = [];
    for (const item of newsItems) {
      // Skip if already processed recently (prevent duplicates)
      const existingCard = await prisma.newsCard.findFirst({
        where: {
          sourceData: { path: ['link'], string_contains: item.link }
        }
      });

      if (!existingCard) {
        processedItems.push({
          ...item,
          image: item.image || null, // Use image from the article data
          date: new Date().toISOString(),
          content: item.content || '' // Use content from the article data
        });
      }
    }

    return NextResponse.json({
      success: true,
      items: processedItems,
      count: processedItems.length
    });
  } catch (error) {
    console.error('Error fetching news from source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sourceId } = await params;

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    // Fetch the source to get its type and configuration
    const source = await prisma.newsSource.findUnique({
      where: { id: sourceId }
    });

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Import the universal news agent to handle different source types
    const { UniversalNewsAgent } = await import('@/lib/universal-news-agent');

    // Create agent with source config
    const agent = new UniversalNewsAgent({
      url: source.config.url || source.config.endpoint,
      maxConcurrency: 3,
      cacheTimeout: 3600000,
      userAgent: 'News-Agent/1.0'
    });

    // Fetch news based on source type and configuration
    const result = await agent.fetchNews();
    await agent.cleanup();

    if (!result.success || result.articles.length === 0) {
      return NextResponse.json({ error: result.error || 'Failed to fetch news from source' }, { status: 500 });
    }

    // Filter valid articles
    const validArticles = result.articles.filter((article: any) => {
      return !article.extraction_failed &&
             !article.extraction_trace?.is_listing_page &&
             !article.extraction_trace?.is_contact_page &&
             !article.extraction_trace?.is_advertisement &&
             (article.extraction_trace?.content_quality_score || 100) >= 60;
    });

    // Map articles to news items format expected by the rest of the code
    const newsItems = validArticles.map((article: any) => ({
      title: article.title,
      content: article.content,
      description: article.description,
      summary: article.description,
      link: article.url,
      publishedAt: new Date(article.published_at),
      published_at: article.published_at,
      author: article.author,
      image: article.image,
      category: article.category,
      source: article.source
    }));

    // Process each news item to generate cards
    let processedCount = 0;
    for (const item of newsItems) {
      // Skip if already processed recently (prevent duplicates)
      const existingCard = await prisma.newsCard.findFirst({
        where: {
          sourceData: { path: ['link'], string_contains: item.link }
        }
      });

      if (!existingCard) {
        // Find a template to use for this item
        const template = await prisma.template.findFirst({
          where: {
            OR: [
              { category: { contains: 'NEWS', mode: 'insensitive' } },
              { name: { contains: 'news', mode: 'insensitive' } },
              { name: { contains: 'card', mode: 'insensitive' } }
            ]
          }
        });

        if (template) {
          // Find the data mapping for this template
          const mapping = await prisma.dataMapping.findFirst({
            where: { templateId: template.id }
          });

          // Use image from the article data
          const imageBuffer = item.image ? Buffer.from(item.image.replace(/^data:image\/\w+;base64,/, ''), 'base64') : null;

          // Prepare the data for the template based on the mapping
          let mappedData: Record<string, any> = {};
          
          if (mapping) {
            // Use the mapping to transform the news item
            for (const [templateField, sourceField] of Object.entries(mapping.sourceFields)) {
              if (sourceField && item[sourceField as keyof typeof item]) {
                mappedData[templateField] = item[sourceField as keyof typeof item];
              } else {
                // Use fallback or default values
                if (templateField === 'date') {
                  mappedData[templateField] = new Date().toISOString().split('T')[0];
                } else if (templateField === 'title') {
                  mappedData[templateField] = item.title || 'Untitled';
                } else if (templateField === 'image') {
                  mappedData[templateField] = imageBuffer ? `data:image/jpeg;base64,${imageBuffer.toString('base64')}` : '';
                } else {
                  mappedData[templateField] = item[sourceField as keyof typeof item] || '';
                }
              }
            }
          } else {
            // Fallback mapping if no specific mapping exists
            mappedData = {
              title: item.title,
              date: new Date().toISOString().split('T')[0],
              subtitle: item.description || '',
              image: item.image || '',
            };
          }

            try {
            const logPrefix = '[Sources][Fetch][Image]';
            console.log(`${logPrefix} Processing card for: ${item.title?.substring(0, 30) || 'unknown'}`);

            // Generate the card image (text only)
            console.log(`${logPrefix} Generating base card...`);
            let cardBuffer = await generateCardImage({
              template,
              mapping: mappedData,
              newsItem: item
            });
            console.log(`${logPrefix} Base card generated: ${cardBuffer.length} bytes`);

            // If we have an image, composite it onto the card
            if (item.image) {
              console.log(`${logPrefix} Image present: ${item.image.startsWith('data:') ? 'dataurl' : item.image.substring(0, 60)}`);
              const canvasData = typeof template.canvasData === 'string'
                ? JSON.parse(template.canvasData)
                : template.canvasData;

              console.log(`${logPrefix} Searching for placeholder...`);
              const placeholder = getImagePlaceholder(canvasData);

              if (placeholder) {
                console.log(`${logPrefix} Placeholder found: (${placeholder.x}, ${placeholder.y}) size ${placeholder.width}x${placeholder.height}`);
                console.log(`${logPrefix} Starting compositing...`);
                cardBuffer = await compositeImage(cardBuffer, {
                  imageUrl: item.image,
                  placeholderX: placeholder.x,
                  placeholderY: placeholder.y,
                  placeholderWidth: Math.round(placeholder.width),
                  placeholderHeight: Math.round(placeholder.height)
                });
                console.log(`${logPrefix} Compositing complete: ${cardBuffer.length} bytes`);
              } else {
                console.warn(`${logPrefix} WARNING: No placeholder found - skipping compositing`);
              }
            } else {
              console.log(`${logPrefix} INFO: No image in item - skipping compositing`);
            }

            // Save the generated card to the database
            await prisma.newsCard.create({
              data: {
                imageUrl: `data:image/png;base64,${cardBuffer.toString('base64')}`, // Store as base64
                status: 'GENERATED',
                sourceData: {
                  ...item,
                  image: item.image || null
                },
                templateId: template.id,
                dataMappingId: mapping?.id || null,
              }
            });

            processedCount++;
            console.log(`${logPrefix} SUCCESS: Card generated (id=${mapping?.id || 'none'}, processed=${processedCount})`);
          } catch (genError) {
            const errorMessage = genError instanceof Error ? genError.message : 'Unknown error';
            console.error(`${logPrefix} ERROR: ${errorMessage}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${processedCount} news cards generated`,
      processedCount
    });
  } catch (error) {
    console.error('Error processing news from source:', error);
    return NextResponse.json(
      { error: 'Failed to process news', details: (error as Error).message },
      { status: 500 }
    );
  }
}