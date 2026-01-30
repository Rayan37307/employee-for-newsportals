import { HTMLOnlyTemplate, TemplateElement, DynamicField } from '@/components/html-canvas-editor';
import { createCanvas, loadImage, registerFont } from 'canvas';
import * as fs from 'fs';

/**
 * Draws a rounded rectangle using the canvas API
 */
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

interface GenerateCardOptions {
  template: HTMLOnlyTemplate;
  newsItem: any; // The news data to populate the template
}

/**
 * Generates a card image using HTML/CSS approach on the server side
 * This function creates a canvas representation of the template populated with news data
 */
export async function generateCardImage({ template, newsItem }: GenerateCardOptions): Promise<Buffer> {
  // Create a node-canvas
  const canvas = createCanvas(template.width, template.height);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = template.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, template.width, template.height);

  // Process each element in the template
  for (const element of template.elements) {
    if (element.dynamicField && element.dynamicField !== 'none') {
      // Get the value for this dynamic field from the news item
      const value = newsItem[element.dynamicField] || element.fallbackValue || '';

      if (element.type === 'text' && value) {
        // Draw text element
        ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
        ctx.fillStyle = element.fill || '#000000';
        ctx.textAlign = 'left';

        // Set text baseline to top to match HTML/CSS rendering behavior
        ctx.textBaseline = 'top';

        // Apply transformations
        ctx.save();
        ctx.translate(element.x, element.y);
        if (element.rotation) {
          ctx.rotate((element.rotation * Math.PI) / 180);
        }

        // Draw the text - adjust Y position to account for text baseline
        ctx.fillText(String(value), 0, 0);
        ctx.restore();
      }
      else if (element.type === 'rect' && element.dynamicField === 'image' && value) {
        try {
          // Check if the image URL is external and needs proxying
          let imageUrl = value as string;

          try {
            const urlObj = new URL(value as string);
            const hostname = urlObj.hostname;

            // Check if the image is from an external domain
            const isExternal = hostname !== 'localhost' &&
                              !hostname.endsWith('.vercel.app') &&
                              !hostname.endsWith('.newsagent.com') &&
                              hostname !== (process.env.NEXT_PUBLIC_APP_HOSTNAME || '');

            if (isExternal) {
              // Use the image proxy to avoid CORS issues
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
              imageUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(value as string)}`;
            }
          } catch (e) {
            // If URL parsing fails, treat as external and use proxy
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            imageUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(value as string)}`;
          }

          // Load the image from the URL (potentially through proxy)
          const img = await loadImage(imageUrl);

          // Calculate the destination dimensions, preserving aspect ratio
          const elementWidth = element.width || 0;
          const elementHeight = element.height || 0;

          // Calculate scale to fit image within the rectangle while maintaining aspect ratio
          const scaleX = elementWidth / img.width;
          const scaleY = elementHeight / img.height;
          const scale = Math.min(scaleX, scaleY);

          const drawWidth = img.width * scale;
          const drawHeight = img.height * scale;

          // Center the image in the rectangle
          const offsetX = element.x + (elementWidth - drawWidth) / 2;
          const offsetY = element.y + (elementHeight - drawHeight) / 2;

          // Draw the image
          ctx.drawImage(
            img,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
          );
        } catch (error) {
          console.error(`Error loading image for element ${element.id}:`, error);
          // Draw a placeholder rectangle instead
          ctx.fillStyle = '#e0e0e0';
          ctx.fillRect(element.x, element.y, element.width || 0, element.height || 0);

          ctx.strokeStyle = '#cccccc';
          ctx.lineWidth = 1;
          ctx.strokeRect(element.x, element.y, element.width || 0, element.height || 0);
        }
      }
      else if (element.type === 'rect') {
        // Draw a rectangle with optional border radius
        const x = element.x;
        const y = element.y;
        const width = element.width || 0;
        const height = element.height || 0;
        const radius = element.rx || 0; // Use rx for border radius

        if (radius > 0) {
          // Draw a rounded rectangle
          drawRoundedRect(ctx, x, y, width, height, radius);
        } else {
          // Draw a regular rectangle
          ctx.fillStyle = element.fill || '#000000';
          ctx.fillRect(x, y, width, height);
        }
      }
    } else {
      // Static elements (not dynamic)
      if (element.type === 'text' && element.text) {
        ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
        ctx.fillStyle = element.fill || '#000000';
        ctx.textAlign = 'left';

        ctx.save();
        ctx.translate(element.x, element.y);
        if (element.rotation) {
          ctx.rotate((element.rotation * Math.PI) / 180);
        }

        ctx.fillText(element.text, 0, 0);
        ctx.restore();
      }
      else if (element.type === 'rect') {
        const x = element.x;
        const y = element.y;
        const width = element.width || 0;
        const height = element.height || 0;
        const radius = element.rx || 0; // Use rx for border radius

        if (radius > 0) {
          // Draw a rounded rectangle
          drawRoundedRect(ctx, x, y, width, height, radius);
        } else {
          // Draw a regular rectangle
          ctx.fillStyle = element.fill || '#000000';
          ctx.fillRect(x, y, width, height);
        }
      }
    }
  }

  // Return the canvas as a buffer
  return canvas.toBuffer('image/png');
}

/**
 * Updates a template with dynamic data for preview purposes
 * This is used in the client-side preview
 */
export function updateTemplateWithDynamicData(
  template: KonvaTemplate, 
  data: Record<string, any>
): KonvaTemplate {
  const updatedElements = template.elements.map(element => {
    if (element.dynamicField && element.dynamicField !== 'none') {
      const value = data[element.dynamicField] || element.fallbackValue;
      
      if (element.type === 'text' && value) {
        return { ...element, text: String(value) };
      } else if (element.type === 'rect' && element.dynamicField === 'image' && value) {
        return { ...element, src: String(value) };
      }
    }
    return element;
  });
  
  return {
    ...template,
    elements: updatedElements
  };
}

/**
 * Gets the bounding box of a template (the area covered by all elements)
 */
export function getTemplateBoundingBox(template: KonvaTemplate): { 
  minX: number; 
  minY: number; 
  maxX: number; 
  maxY: number 
} {
  if (template.elements.length === 0) {
    return { minX: 0, minY: 0, maxX: template.width, maxY: template.height };
  }
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (const element of template.elements) {
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    
    if (element.type === 'text') {
      // For text, we can only estimate the width based on font size and text length
      maxX = Math.max(maxX, element.x + (element.text?.length || 0) * (element.fontSize || 16) * 0.6);
      maxY = Math.max(maxY, element.y + (element.fontSize || 16));
    } else {
      maxX = Math.max(maxX, element.x + (element.width || 0));
      maxY = Math.max(maxY, element.y + (element.height || 0));
    }
  }
  
  // Ensure the bounding box fits within the template dimensions
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(template.width, maxX);
  maxY = Math.min(template.height, maxY);
  
  return { minX, minY, maxX, maxY };
}