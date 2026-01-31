import { NextRequest, NextResponse } from 'next/server';
import { generateCardImage } from '@/lib/card-generator-puppeteer';
import { compositeImage, getImagePlaceholder, validateImage } from '@/lib/image-processor';
import prisma from '@/lib/db';
import { getLatestNews, sanitizeText } from '@/lib/bangladesh-guardian-agent';

// In-memory storage for tracking posted links (in production, use database)
const postedLinks = new Set<string>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'fetch-news':
        const news = await getLatestNews();
        return NextResponse.json({ success: true, news });

      default:
        return NextResponse.json({
          error: 'Invalid action. Use ?action=fetch-news'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in news agent API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'generate-card':
          const { templateId, newsItem } = body;
          const logPrefix = '[API][Image]';

          if (!templateId || !newsItem) {
            return NextResponse.json({ error: 'Missing templateId or newsItem' }, { status: 400 });
          }

          console.log(`${logPrefix} generate-card request: templateId=${templateId}, title=${newsItem.title?.substring(0, 30) || 'unknown'}`);

          // Get the template
          const template = await prisma.template.findUnique({
            where: { id: templateId }
          });

          if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
          }

          console.log(`${logPrefix} Template found: ${template.name}`);

          // Use default mapping since dataMapping model was removed
          const mappedData = {
            title: newsItem.title || 'Untitled',
            description: newsItem.description || 'No description available',
            date: newsItem.date || new Date().toISOString().split('T')[0],
            author: newsItem.author || 'Unknown',
            category: newsItem.category || 'General',
            image: newsItem.image || null
          };

          // Generate the card image (with text replacements)
          console.log(`${logPrefix} Generating base card (text only)...`);

          let cardBuffer = await generateCardImage({
            template,
            mapping: mappedData,
            newsItem
          });
          console.log(`${logPrefix} Base card generated: ${cardBuffer.length} bytes`);

          // Get image URL from news item (check multiple possible fields)
          const imageUrl = newsItem.image || newsItem.imageUrl || mappedData.image || '';
          console.log(`${logPrefix} Image source: ${imageUrl ? (imageUrl.startsWith('data:') ? 'dataurl' : imageUrl.substring(0, 60)) : 'none'}`);

          // If we have an image URL, try to composite it onto the card
          if (imageUrl) {
            console.log(`${logPrefix} Validating image...`);
            // Validate the image first
            const validation = validateImage(imageUrl);
            if (!validation.valid) {
              console.warn(`${logPrefix} WARNING: Image validation failed - ${validation.error} - using template placeholder`);
            } else {
              console.log(`${logPrefix} Image validated: type=${validation.type}, size=${validation.size ? (validation.size / 1024).toFixed(2) + 'KB' : 'unknown'}`);

              // Get the template canvas data
              const canvasData = typeof template.canvasData === 'string'
                ? JSON.parse(template.canvasData)
                : template.canvasData;

              console.log(`${logPrefix} Searching for image placeholder in template...`);
              // Find the image placeholder position
              const placeholder = getImagePlaceholder(canvasData);

              if (placeholder) {
                console.log(`${logPrefix} Placeholder found: (${placeholder.x}, ${placeholder.y}) size ${placeholder.width}x${placeholder.height}`);
                console.log(`${logPrefix} Starting image compositing...`);

                // Composite the image using sharp
                cardBuffer = await compositeImage(cardBuffer, {
                  imageUrl: imageUrl,
                  placeholderX: placeholder.x,
                  placeholderY: placeholder.y,
                  placeholderWidth: Math.round(placeholder.width),
                  placeholderHeight: Math.round(placeholder.height)
                });

                console.log(`${logPrefix} Image composition complete: ${cardBuffer.length} bytes`);
              } else {
                console.warn(`${logPrefix} WARNING: No image placeholder found in template - using template placeholder`);
                console.log(`${logPrefix} Hint: Add a rectangle with dynamicField='image' to template ${templateId}`);
              }
            }
          } else {
            console.log(`${logPrefix} INFO: No image URL provided - using template placeholder`);
          }

          // Save the generated card to the database
          const newsCard = await prisma.newsCard.create({
            data: {
              imageUrl: `data:image/png;base64,${cardBuffer.toString('base64')}`, // Store as base64
              status: 'GENERATED',
              sourceData: newsItem,
              templateId: template.id,
            }
          });

          console.log(`${logPrefix} SUCCESS: Card generated and saved (id=${newsCard.id}, size=${cardBuffer.length} bytes)`);

          return NextResponse.json({
            success: true,
            cardId: newsCard.id,
            imageUrl: newsCard.imageUrl
          });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in news agent API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}