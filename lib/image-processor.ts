import sharp from 'sharp';

interface ImageProcessingOptions {
    imageUrl: string;
    placeholderX: number;
    placeholderY: number;
    placeholderWidth: number;
    placeholderHeight: number;
}

interface ImageResult {
    success: boolean;
    buffer?: Buffer;
    error?: string;
}

/**
 * Fetch an image from a URL or decode base64 data URL
 * @param imageUrl - External URL or base64 data URL
 * @param timeout - Fetch timeout in milliseconds (default: 10s)
 * @returns Buffer of the image or null if failed
 */
async function fetchImage(imageUrl: string, timeout: number = 10000): Promise<Buffer | null> {
    try {
        if (imageUrl.startsWith('data:image')) {
            // Handle data URL (base64)
            const base64Data = imageUrl.split(',')[1];
            if (!base64Data) {
                throw new Error('Invalid data URL: no base64 content');
            }
            return Buffer.from(base64Data, 'base64');
        } else {
            // Handle external URL with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(imageUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'NewsAgent/1.0',
                    'Accept': 'image/*',
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ImageProcessor] Failed to fetch image: ${errorMessage}`);
        return null;
    }
}

/**
 * Process and composite an image onto a card template
 * @param cardBuffer - The base card PNG buffer
 * @param options - Image processing options
 * @returns The composited card buffer or original if processing fails
 */
export async function compositeImage(
    cardBuffer: Buffer,
    options: ImageProcessingOptions
): Promise<Buffer> {
    const { imageUrl, placeholderX, placeholderY, placeholderWidth, placeholderHeight } = options;

    console.log(`[ImageProcessor] Processing image for placeholder at (${placeholderX}, ${placeholderY}) size ${placeholderWidth}x${placeholderHeight}`);

    // Fetch the image
    const imageBuffer = await fetchImage(imageUrl);
    
    if (!imageBuffer) {
        console.log(`[ImageProcessor] Using template placeholder (no image available)`);
        return cardBuffer;
    }

    try {
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();
        console.log(`[ImageProcessor] Source image: ${metadata.width}x${metadata.height}`);

        // Process the image to fit the placeholder
        // Use cover to maintain aspect ratio and fill the area
        const processedImageBuffer = await sharp(imageBuffer)
            .resize({
                width: placeholderWidth,
                height: placeholderHeight,
                fit: 'cover',
                position: 'center'
            })
            .png()
            .toBuffer();

        // Composite the processed image onto the card
        const resultBuffer = await sharp(cardBuffer)
            .composite([{
                input: processedImageBuffer,
                top: Math.round(placeholderY),
                left: Math.round(placeholderX),
                blend: 'over'
            }])
            .png()
            .toBuffer();

        console.log(`[ImageProcessor] Successfully composited image`);
        return resultBuffer;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ImageProcessor] Failed to process image: ${errorMessage}`);
        console.log(`[ImageProcessor] Using template placeholder`);
        return cardBuffer;
    }
}

/**
 * Check if an image is valid and processable
 * @param imageUrl - The image URL or data URL
 * @returns Object with validity status and info
 */
export function validateImage(imageUrl: string): { valid: boolean; type: string; size?: number; error?: string } {
    try {
        if (imageUrl.startsWith('data:image')) {
            const parts = imageUrl.split(',');
            if (parts.length !== 2) {
                return { valid: false, type: 'dataurl', error: 'Invalid data URL format' };
            }
            const base64Data = parts[1];
            const size = Buffer.byteLength(base64Data, 'base64');
            
            // Check max size (e.g., 10MB)
            const maxSize = 10 * 1024 * 1024;
            if (size > maxSize) {
                return { valid: false, type: 'dataurl', error: `Image too large: ${(size / 1024 / 1024).toFixed(2)}MB (max: ${maxSize / 1024 / 1024}MB)` };
            }
            
            return { valid: true, type: 'dataurl', size };
        } else {
            // Basic URL validation
            try {
                new URL(imageUrl);
                return { valid: true, type: 'url' };
            } catch {
                return { valid: false, type: 'url', error: 'Invalid URL format' };
            }
        }
    } catch (error) {
        return { valid: false, type: 'unknown', error: 'Validation error' };
    }
}

/**
 * Get placeholder position from canvas objects
 * @param canvasData - Parsed canvas JSON data
 * @returns Position and size of the image placeholder, or null if not found
 */
export function getImagePlaceholder(canvasData: any): { x: number; y: number; width: number; height: number } | null {
    if (!canvasData.objects || !Array.isArray(canvasData.objects)) {
        return null;
    }

    for (const obj of canvasData.objects) {
        if (obj.dynamicField === 'image' && (obj.type === 'Rect' || obj.type === 'rect')) {
            // Calculate actual dimensions considering scale
            const width = (obj.width || 100) * (obj.scaleX || 1);
            const height = (obj.height || 100) * (obj.scaleY || 1);
            
            return {
                x: obj.left || 0,
                y: obj.top || 0,
                width: width,
                height: height
            };
        }
    }

    return null;
}
