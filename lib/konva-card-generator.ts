import { HTMLOnlyTemplate } from '@/components/html-canvas-editor';
import { generateCardImage } from '@/lib/konva-export-util'; // Keeping the name for consistency

interface GenerateCardOptions {
  template: HTMLOnlyTemplate;
  mapping: any;
  newsItem: any;
}

/**
 * Generate a card image using HTML/CSS approach instead of Fabric.js
 * This replaces the previous Puppeteer-based implementation
 */
export async function generateCardImageNew({ template, mapping, newsItem }: GenerateCardOptions): Promise<Buffer> {
  try {
    // Generate the card image using the HTML-based approach
    const cardBuffer = await generateCardImage({
      template,
      newsItem
    });

    return cardBuffer;
  } catch (error) {
    console.error('Error generating card with HTML approach:', error);
    throw error;
  }
}