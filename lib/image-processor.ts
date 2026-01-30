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

async function fetchImage(imageUrl: string, timeout: number = 10000): Promise<Buffer | null> {
    const logPrefix = '[ImageProcessor][Fetch]';

    if (!imageUrl) {
        console.warn(`${logPrefix} WARNING: imageUrl is empty/null - returning null`);
        return null;
    }

    const isDataUrl = imageUrl.startsWith('data:image');
    const sourceType = isDataUrl ? 'dataurl' : 'url';
    const truncatedUrl = isDataUrl ? `${imageUrl.substring(0, 50)}...` : imageUrl.substring(0, 80);

    console.log(`${logPrefix} Attempting to fetch image (type=${sourceType}, url=${truncatedUrl})`);

    try {
        if (isDataUrl) {
            const parts = imageUrl.split(',');
            if (parts.length < 2) {
                console.warn(`${logPrefix} WARNING: Invalid data URL format (no comma separator) - returning null`);
                return null;
            }

            const base64Data = parts[1];
            if (!base64Data) {
                console.warn(`${logPrefix} WARNING: Invalid data URL (no base64 content) - returning null`);
                return null;
            }

            try {
                const buffer = Buffer.from(base64Data, 'base64');
                console.log(`${logPrefix} SUCCESS: Decoded data URL (size=${buffer.length} bytes)`);
                return buffer;
            } catch (decodeError) {
                const errorMessage = decodeError instanceof Error ? decodeError.message : 'Unknown decode error';
                console.error(`${logPrefix} ERROR: Base64 decode failed - ${errorMessage} - returning null`);
                return null;
            }
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            console.log(`${logPrefix} Fetching external URL (timeout=${timeout}ms)`);

            // Check if the image URL is external and needs proxying
            let fetchUrl = imageUrl;
            try {
                const urlObj = new URL(imageUrl);
                // If the image is from an external domain, use the proxy
                if (urlObj.hostname !== new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname &&
                    urlObj.hostname !== 'localhost' &&
                    !urlObj.hostname.endsWith('vercel.app') &&
                    !urlObj.hostname.endsWith('newsagent.com')) {
                    fetchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
                }
            } catch (e) {
                // If URL parsing fails, treat as external and use proxy
                fetchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
            }

            const response = await fetch(fetchUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'NewsAgent/1.0',
                    'Accept': 'image/*',
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`${logPrefix} ERROR: HTTP ${response.status} ${response.statusText} - returning null`);
                return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            console.log(`${logPrefix} SUCCESS: Downloaded external image (size=${buffer.length} bytes)`);
            return buffer;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`${logPrefix} ERROR: ${errorMessage} - returning null`);
        if (errorStack) {
            console.error(`${logPrefix} Stack: ${errorStack.split('\n').slice(0, 3).join('\n')}`);
        }
        return null;
    }
}

export async function compositeImage(
    cardBuffer: Buffer,
    options: ImageProcessingOptions
): Promise<Buffer> {
    const logPrefix = '[ImageProcessor][Composite]';
    const { imageUrl, placeholderX, placeholderY, placeholderWidth, placeholderHeight } = options;

    console.log(`${logPrefix} START: imageUrl=${imageUrl ? (imageUrl.startsWith('data:') ? 'dataurl' : imageUrl.substring(0, 60)) : 'null'}, position=(${placeholderX}, ${placeholderY}), size=${placeholderWidth}x${placeholderHeight}`);
    console.log(`${logPrefix} Input card buffer: ${cardBuffer.length} bytes`);

    const imageBuffer = await fetchImage(imageUrl);

    if (!imageBuffer) {
        console.warn(`${logPrefix} WARNING: fetchImage returned null - returning original card buffer (no image composited)`);
        return cardBuffer;
    }

    console.log(`${logPrefix} Image buffer received: ${imageBuffer.length} bytes`);

    try {
        console.log(`${logPrefix} Extracting image metadata with sharp...`);
        const metadata = await sharp(imageBuffer).metadata();
        console.log(`${logPrefix} Source image metadata: ${metadata.width}x${metadata.height}, format=${metadata.format || 'unknown'}`);

        console.log(`${logPrefix} Resizing image to fit placeholder (${placeholderWidth}x${placeholderHeight}, fit=cover, position=center)...`);
        const processedImageBuffer = await sharp(imageBuffer)
            .resize({
                width: placeholderWidth,
                height: placeholderHeight,
                fit: 'cover',
                position: 'center'
            })
            .png()
            .toBuffer();

        console.log(`${logPrefix} Resized image buffer: ${processedImageBuffer.length} bytes`);

        console.log(`${logPrefix} Compositing onto card at position (${placeholderX}, ${placeholderY})...`);
        const resultBuffer = await sharp(cardBuffer)
            .composite([{
                input: processedImageBuffer,
                top: Math.round(placeholderY),
                left: Math.round(placeholderX),
                blend: 'over'
            }])
            .png()
            .toBuffer();

        console.log(`${logPrefix} SUCCESS: Composited image (output=${resultBuffer.length} bytes, delta=${resultBuffer.length - cardBuffer.length} bytes)`);
        return resultBuffer;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`${logPrefix} ERROR: ${errorMessage}`);
        if (errorStack) {
            console.error(`${logPrefix} Stack: ${errorStack.split('\n').slice(0, 5).join('\n')}`);
        }
        console.warn(`${logPrefix} WARNING: Returning original card buffer (sharp processing failed)`);
        return cardBuffer;
    }
}

export function validateImage(imageUrl: string): { valid: boolean; type: string; size?: number; error?: string } {
    const logPrefix = '[ImageProcessor][Validate]';

    if (!imageUrl) {
        console.warn(`${logPrefix} WARNING: imageUrl is empty/null`);
        return { valid: false, type: 'empty', error: 'imageUrl is empty or null' };
    }

    console.log(`${logPrefix} Validating: ${imageUrl.startsWith('data:') ? 'dataurl' : imageUrl.substring(0, 60)}`);

    try {
        if (imageUrl.startsWith('data:image')) {
            const parts = imageUrl.split(',');
            if (parts.length !== 2) {
                const error = 'Invalid data URL format (expected 2 parts)';
                console.warn(`${logPrefix} INVALID: ${error}`);
                return { valid: false, type: 'dataurl', error };
            }

            const base64Data = parts[1];
            const size = Buffer.byteLength(base64Data, 'base64');
            const sizeKB = (size / 1024).toFixed(2);

            const maxSize = 10 * 1024 * 1024;
            if (size > maxSize) {
                const error = `Image too large: ${(size / 1024 / 1024).toFixed(2)}MB (max: ${maxSize / 1024 / 1024}MB)`;
                console.warn(`${logPrefix} INVALID: ${error}`);
                return { valid: false, type: 'dataurl', size, error };
            }

            console.log(`${logPrefix} VALID: dataurl (size=${sizeKB}KB)`);
            return { valid: true, type: 'dataurl', size };
        } else {
            try {
                new URL(imageUrl);
                console.log(`${logPrefix} VALID: url`);
                return { valid: true, type: 'url' };
            } catch {
                const error = 'Invalid URL format';
                console.warn(`${logPrefix} INVALID: ${error}`);
                return { valid: false, type: 'url', error };
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${logPrefix} ERROR: ${errorMessage}`);
        return { valid: false, type: 'unknown', error: errorMessage };
    }
}

export function getImagePlaceholder(canvasData: any): { x: number; y: number; width: number; height: number } | null {
    const logPrefix = '[ImageProcessor][Placeholder]';

    if (!canvasData) {
        console.warn(`${logPrefix} WARNING: canvasData is null/undefined`);
        return null;
    }

    if (!canvasData.objects) {
        console.warn(`${logPrefix} WARNING: canvasData.objects is null/undefined`);
        return null;
    }

    if (!Array.isArray(canvasData.objects)) {
        console.warn(`${logPrefix} WARNING: canvasData.objects is not an array (type=${typeof canvasData.objects})`);
        return null;
    }

    const objectCount = canvasData.objects.length;
    console.log(`${logPrefix} Scanning ${objectCount} canvas objects for image placeholder...`);

    if (objectCount === 0) {
        console.warn(`${logPrefix} WARNING: No objects in canvasData - returning null`);
        return null;
    }

    for (let i = 0; i < canvasData.objects.length; i++) {
        const obj = canvasData.objects[i];
        const objType = obj.type || 'unknown';
        const dynamicField = obj.dynamicField || 'none';
        const hasImageField = dynamicField === 'image';
        const isRect = objType === 'Rect' || objType === 'rect';

        console.log(`${logPrefix} Object ${i}: type=${objType}, dynamicField=${dynamicField}, isImagePlaceholder=${hasImageField && isRect}`);

        if (hasImageField && isRect) {
            const width = (obj.width || 100) * (obj.scaleX || 1);
            const height = (obj.height || 100) * (obj.scaleY || 1);
            const x = obj.left || 0;
            const y = obj.top || 0;

            console.log(`${logPrefix} FOUND: Image placeholder at (${x}, ${y}) size ${width}x${height}`);
            return { x, y, width, height };
        }
    }

    console.warn(`${logPrefix} WARNING: No image placeholder found (looking for dynamicField='image' + type='Rect')`);
    console.log(`${logPrefix} Hint: Ensure template has a rectangle with dynamicField='image' property`);
    return null;
}
