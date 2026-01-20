import { getLatestNews, fetchArticleImage } from '@/lib/bangladesh-guardian-agent';
import { generateCardImage } from '@/lib/card-generator';
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

              // Fetch image for the article
              let imageBuffer = null;
              try {
                imageBuffer = await fetchArticleImage(newsItem.link);
              } catch (error) {
                console.error(`Failed to fetch image for ${newsItem.link}:`, error);
              }

              // Prepare the data for the template based on the mapping
              let mappedData: Record<string, any> = {};

              if (mapping) {
                // Use the mapping to transform the news item
                for (const [templateField, sourceField] of Object.entries(mapping.sourceFields)) {
                  if (sourceField && newsItem[sourceField as keyof typeof newsItem]) {
                    mappedData[templateField] = newsItem[sourceField as keyof typeof newsItem];
                  } else {
                    // Use fallback or default values
                    if (templateField === 'date') {
                      mappedData[templateField] = new Date().toISOString().split('T')[0];
                    } else if (templateField === 'title') {
                      mappedData[templateField] = newsItem.title || 'Untitled';
                    } else if (templateField === 'image') {
                      mappedData[templateField] = imageBuffer ? `data:image/jpeg;base64,${imageBuffer.toString('base64')}` : '';
                    } else {
                      mappedData[templateField] = newsItem[sourceField as keyof typeof newsItem] || '';
                    }
                  }
                }
              } else {
                // Fallback mapping if no specific mapping exists
                mappedData = {
                  title: newsItem.title,
                  date: new Date().toISOString().split('T')[0],
                  subtitle: newsItem.description || '',
                  image: imageBuffer ? `data:image/jpeg;base64,${imageBuffer.toString('base64')}` : '',
                };
              }

              try {
                // Generate a news card using the template
                const cardBuffer = await generateCardImage({
                  template,
                  mapping: mappedData,
                  newsItem: {
                    ...newsItem,
                    image: imageBuffer ? `data:image/jpeg;base64,${imageBuffer.toString('base64')}` : null
                  }
                });

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
                    dataMappingId: mapping?.id || null,
                  }
                });

                console.log(`✅ Generated news card for: ${newsItem.title.substring(0, 50)}...`);
              } catch (genError) {
                console.error(`❌ Failed to generate card for ${newsItem.title}:`, genError);
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