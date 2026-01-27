import { NewsArticle } from './news-fetcher';
import prisma from './db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a news card from an article and template
 */
export async function generateNewsCardFromArticle(
  article: NewsArticle,
  templateId: string
): Promise<{ success: boolean; cardId?: string; imageUrl?: string; error?: string }> {
  try {
    // Get the template from the database
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Prepare dynamic data for the canvas based on the article
    const dynamicData = prepareDynamicData(article, null);

    // In a real implementation, we would:
    // 1. Create a canvas instance on the server
    // 2. Load the template canvas data
    // 3. Apply the dynamic data to the canvas
    // 4. Export the canvas as an image
    // 5. Save the image to storage
    // 6. Create a record in the news_cards table

    // For now, we'll simulate this process and return a mock result
    const cardId = uuidv4();

    // Create a record in the news_cards table
    const newsCard = await prisma.newsCard.create({
      data: {
        id: cardId,
        status: 'GENERATED',
        sourceData: {
          title: article.title,
          link: article.link,
          description: article.description || '',
          pubDate: article.pubDate || new Date().toISOString(),
          image: article.image || ''
        },
        templateId: templateId,
      }
    });

    // In a real implementation, we would generate the actual image here
    // For now, we'll return a success response
    return {
      success: true,
      cardId: newsCard.id,
      imageUrl: `/api/news-card/${newsCard.id}/image` // Placeholder URL
    };
  } catch (error) {
    console.error('Error generating news card:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Prepares dynamic data for the canvas based on the article and data mapping
 */
function prepareDynamicData(article: NewsArticle, sourceFields?: any) {
  // Default mapping if no specific mapping is provided
  const defaultMapping = {
    title: article.title,
    date: new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    subtitle: article.description || '',
    image: article.image || ''
  };

  if (!sourceFields) {
    return defaultMapping;
  }

  // Apply custom mapping if provided
  const mappedData: any = {};
  
  // Map title
  if (sourceFields.title) {
    mappedData.title = getNestedValue(article, sourceFields.title) || defaultMapping.title;
  } else {
    mappedData.title = defaultMapping.title;
  }

  // Map date
  if (sourceFields.date) {
    mappedData.date = getNestedValue(article, sourceFields.date) || defaultMapping.date;
  } else {
    mappedData.date = defaultMapping.date;
  }

  // Map subtitle
  if (sourceFields.subtitle) {
    mappedData.subtitle = getNestedValue(article, sourceFields.subtitle) || defaultMapping.subtitle;
  } else {
    mappedData.subtitle = defaultMapping.subtitle;
  }

  // Map image
  if (sourceFields.image) {
    mappedData.image = getNestedValue(article, sourceFields.image) || defaultMapping.image;
  } else {
    mappedData.image = defaultMapping.image;
  }

  return mappedData;
}

/**
 * Helper function to get nested values from an object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Processes new articles and generates news cards
 */
export async function processNewArticles() {
  try {
    // For now, we'll use the Bangladesh Guardian agent directly
    // In a real implementation, you would have a more flexible system

    // Fetch latest news from Bangladesh Guardian
    const { getLatestNews } = await import('./bangladesh-guardian-agent');
    const articles = await getLatestNews();

    // Get all available templates
    const templates = await prisma.template.findMany();

    if (templates.length === 0) {
      console.warn('No templates found, skipping card generation');
      return;
    }

    // Use the first template for all articles (in a real implementation, you'd have logic to match articles to templates)
    const defaultTemplate = templates[0];

    // Process each article
    for (const article of articles) {
      // Check if this article has already been processed
      const existingCard = await prisma.newsCard.findFirst({
        where: {
          sourceData: {
            path: ['link'],
            string_contains: article.link
          }
        }
      });

      if (existingCard) {
        continue; // Skip if already processed
      }

      // Generate a news card for this article using the default template
      const cardResult = await generateNewsCardFromArticle(
        article,
        defaultTemplate.id
      );

      if (!cardResult.success) {
        console.error(`Error generating card for article ${article.title}:`, cardResult.error);
      } else {
        console.log(`Generated news card for article: ${article.title}`);
      }
    }
  } catch (error) {
    console.error('Error processing new articles:', error);
    throw error;
  }
}