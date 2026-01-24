import { NextRequest, NextResponse } from 'next/server';
import { getLatestNews } from '@/lib/bangladesh-guardian-agent';
import prisma from '@/lib/db';
import { generateCardImage } from '@/lib/card-generator-puppeteer';
import { compositeImage, getImagePlaceholder } from '@/lib/image-processor';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sourceId } = await params;
    const logPrefix = `[SourceFetch/${sourceId}]`;

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    // Since we're Bangladesh Guardian only, fetch directly from Bangladesh Guardian
    const newsItems = await getLatestNews();

    if (!newsItems || newsItems.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch news from Bangladesh Guardian' }, { status: 500 });
    }

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
          image: item.image || null,
          date: new Date().toISOString(),
          content: item.description || ''
        });
      }
    }

    return NextResponse.json({
      success: true,
      items: processedItems,
      count: processedItems.length
    });
  } catch (error) {
    console.error('Error fetching news from Bangladesh Guardian:', error);
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

    // Since we're Bangladesh Guardian only, fetch directly from Bangladesh Guardian
    const newsItems = await getLatestNews();

    if (!newsItems || newsItems.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch news from Bangladesh Guardian' }, { status: 500 });
    }

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
              { category: { in: ['BREAKING_NEWS', 'CUSTOM'] } },
              { name: { contains: 'news', mode: 'insensitive' } },
              { name: { contains: 'card', mode: 'insensitive' } }
            ]
          }
        });

        if (template) {
          // Use image from the article data
          const imageBuffer = item.image ? Buffer.from(item.image.replace(/^data:image\/\w+;base64,/, ''), 'base64') : null;

          // Prepare the data for the template (simplified mapping)
          const mappedData = {
            title: item.title,
            date: new Date().toISOString().split('T')[0],
            subtitle: item.description || '',
            image: item.image || '',
          };

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
              }
            });

            processedCount++;
            console.log(`${logPrefix} SUCCESS: Card generated (processed=${processedCount})`);
          } catch (genError) {
            const errorMessage = genError instanceof Error ? genError.message : 'Unknown error';
            console.error(`[Sources][Fetch] ERROR: ${errorMessage}`);
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
    console.error('Error processing news from Bangladesh Guardian:', error);
    return NextResponse.json(
      { error: 'Failed to process news', details: (error as Error).message },
      { status: 500 }
    );
  }
}