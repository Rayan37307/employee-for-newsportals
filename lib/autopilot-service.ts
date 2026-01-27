import { getLatestNews } from '@/lib/bangladesh-guardian-agent';
import { generateCardImage } from '@/lib/card-generator-puppeteer';
import { compositeImage, getImagePlaceholder } from '@/lib/image-processor';
import prisma from '@/lib/db';

class AutopilotService {
  private autopilotEnabled: boolean = false;
  private autopilotInterval: NodeJS.Timeout | null = null;

  async startAutopilot(): Promise<void> {
    if (this.autopilotEnabled) {
      console.log('Autopilot is already running');
      return;
    }

    this.autopilotEnabled = true;
    console.log('🚀 Starting autopilot mode for Bangladesh Guardian...');

    const processNews = async () => {
      try {
        console.log('🔄 Starting news check cycle...');
        const newsItems = await getLatestNews();

        for (const newsItem of newsItems) {
          // Check if this news item has already been processed
          const existingCard = await prisma.newsCard.findFirst({
            where: {
              sourceData: { path: ['link'], string_contains: newsItem.link }
            }
          });

          if (!existingCard) {
            // Find a template to use for this news item
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
              // Use empty mapping since dataMapping model was removed
              let mapping: { sourceFields: Record<string, string> } | null = null;

              // Fetch image for the article
              let imageBuffer = null;
              const logPrefix = '[Autopilot][Image]';
              console.log(`${logPrefix} Fetching image for: ${newsItem.title.substring(0, 50)}...`);

              try {
                // Use the image from the newsItem if available
                if (newsItem.image) {
                  const imageResponse = await fetch(newsItem.image);
                  if (imageResponse.ok) {
                    imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                    console.log(`${logPrefix} SUCCESS: Fetched article image (${imageBuffer.length} bytes)`);
                  } else {
                    console.log(`${logPrefix} INFO: No image found for article (fetch returned ${imageResponse.status})`);
                  }
                } else {
                  console.log(`${logPrefix} INFO: No image URL available in news item`);
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`${logPrefix} ERROR: Failed to fetch image - ${errorMessage}`);
              }

              // Prepare the data for the template based on the mapping
              let mappedData: Record<string, any> = {};

              try {
                // Generate a news card using the template
                console.log(`${logPrefix} Generating card base (text only)...`);
                let cardBuffer = await generateCardImage({
                  template,
                  mapping: mappedData,
                  newsItem: {
                    ...newsItem,
                    image: imageBuffer ? `data:image/jpeg;base64,${imageBuffer.toString('base64')}` : null
                  }
                });
                console.log(`${logPrefix} Card base generated: ${cardBuffer.length} bytes`);

                // If we have an image, composite it onto the card
                if (imageBuffer) {
                  const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
                  const canvasData = typeof template.canvasData === 'string'
                    ? JSON.parse(template.canvasData)
                    : template.canvasData;

                  console.log(`${logPrefix} Searching for image placeholder in template...`);
                  const placeholder = getImagePlaceholder(canvasData);

                  if (placeholder) {
                    console.log(`${logPrefix} Placeholder found: (${placeholder.x}, ${placeholder.y}) size ${placeholder.width}x${placeholder.height}`);
                    console.log(`${logPrefix} Starting image compositing...`);
                    cardBuffer = await compositeImage(cardBuffer, {
                      imageUrl: imageDataUrl,
                      placeholderX: placeholder.x,
                      placeholderY: placeholder.y,
                      placeholderWidth: Math.round(placeholder.width),
                      placeholderHeight: Math.round(placeholder.height)
                    });
                    console.log(`${logPrefix} Image compositing complete: ${cardBuffer.length} bytes`);
                  } else {
                    console.warn(`${logPrefix} WARNING: No image placeholder found in template - skipping image compositing`);
                    console.log(`${logPrefix} Hint: Add a rectangle with dynamicField='image' to the template`);
                  }
                } else {
                  console.log(`${logPrefix} INFO: No image buffer available - skipping compositing`);
                }

                // Save the generated news card
                await prisma.newsCard.create({
                  data: {
                    imageUrl: `data:image/png;base64,${cardBuffer.toString('base64')}`,
                    status: 'GENERATED',
                    sourceData: {
                      ...newsItem,
                      image: imageBuffer ? `data:image/jpeg;base64,${imageBuffer.toString('base64')}` : null
                    },
                    templateId: template.id,
                  }
                });

                console.log(`${logPrefix} SUCCESS: Generated and saved news card for: ${newsItem.title.substring(0, 50)}...`);
              } catch (genError) {
                const errorMessage = genError instanceof Error ? genError.message : 'Unknown error';
                const errorStack = genError instanceof Error ? genError.stack : '';
                console.error(`${logPrefix} ERROR: Failed to generate card - ${errorMessage}`);
                if (errorStack) {
                  console.error(`${logPrefix} Stack: ${errorStack.split('\n').slice(0, 3).join('\n')}`);
                }
              }
            } else {
              console.log('No suitable template found for news item');
            }
          }
        }
      } catch (error) {
        console.error('❌ Error in autopilot cycle:', error);
      }
    };

    // Run immediately
    await processNews();

    // Then run periodically
    this.autopilotInterval = setInterval(processNews, 300000); // Every 5 minutes
  }

  async stopAutopilot(): Promise<void> {
    if (this.autopilotInterval) {
      clearInterval(this.autopilotInterval);
      this.autopilotInterval = null;
    }
    this.autopilotEnabled = false;
    console.log('🛑 Stopped autopilot mode');
  }

  isAutopilotRunning(): boolean {
    return this.autopilotEnabled;
  }
}

export const autopilotService = new AutopilotService();