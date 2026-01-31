import puppeteer from 'puppeteer';

interface GenerateCardOptions {
    template: any;
    mapping: any;
    newsItem: any;
}

declare global {
    interface Window {
        canvasResult: string | null;
    }
}

async function getCustomFonts(): Promise<{ name: string; family: string; fileUrl: string }[]> {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/fonts`);
        if (!response.ok) return [];
        const fonts = await response.json();
        return fonts.map((font: any) => ({
            ...font,
            fileUrl: `${baseUrl}${font.fileUrl}`,
        }));
    } catch (error) {
        console.error('Error fetching custom fonts:', error);
        return [];
    }
}

/**
 * Generate a card image with text replacements only.
 * Image compositing is handled separately by sharp-based image processor.
 */
export async function generateCardImage({ template, mapping, newsItem }: GenerateCardOptions): Promise<Buffer> {
    console.log('[CardGenerator] generateCardImage called');
    console.log('[CardGenerator] Template ID:', template.id);
    console.log('[CardGenerator] News item:', newsItem.title?.substring(0, 50));

    const canvasData = typeof template.canvasData === 'string'
        ? JSON.parse(template.canvasData)
        : template.canvasData;

    const width = canvasData.width || 1200;
    const height = canvasData.height || 630;

    const customFonts = await getCustomFonts();
    console.log('[CardGenerator] Custom fonts:', customFonts.length);

    const fontFaceCSS = customFonts.map(font => {
        return `@font-face {
            font-family: '${font.family}';
            src: url('${font.fileUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
        }`;
    }).join('\n');

    const newsItemJson = JSON.stringify(newsItem);

    const fontFamilies = JSON.stringify(customFonts.map(f => f.family));

    const canvasDataJson = JSON.stringify(canvasData);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js" onerror="console.error('Fabric.js failed to load')"></script>
    <style>
        ${fontFaceCSS}
        body { margin: 0; padding: 0; }
        canvas { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    <script>
        // Global error handler
        window.onerror = function(msg, url, line, col, error) {
            console.error('[CardGenerator] JavaScript Error:', msg, 'at', url, 'line', line);
            return false;
        };

        console.log('[CardGenerator] Script starting...');

        // Check if fabric.js loaded
        if (typeof fabric === 'undefined') {
            console.error('[CardGenerator] ERROR: fabric.js not loaded!');
            window.canvasResult = 'ERROR: fabric.js not loaded';
        } else {
            console.log('[CardGenerator] fabric.js loaded successfully');
        }

        const newsItem = ${newsItemJson};
        const customFontFamilies = ${fontFamilies};
        const canvasData = ${canvasDataJson};

        window.canvasResult = null;

        // Font loading and readiness detection
        function waitForFonts() {
            console.log('[CardGenerator] waitForFonts called');
            if ('fonts' in document) {
                return document.fonts.ready.catch(() => {
                    console.warn('[CardGenerator] Font loading failed, continuing anyway');
                });
            } else {
                // Fallback for browsers that don't support font loading API
                console.log('[CardGenerator] Font API not supported, using fallback');
                return new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Initialize canvas after fonts are loaded
        console.log('[CardGenerator] Calling waitForFonts...');
        waitForFonts().then(() => {
            console.log('[CardGenerator] Fonts loaded, creating canvas...');
            const canvas = new fabric.Canvas('canvas', {
                width: ${width},
                height: ${height},
                backgroundColor: '${canvasData.backgroundColor || '#ffffff'}',
                renderOnAddRemove: false
            });
            console.log('[CardGenerator] Canvas created, loading canvasData JSON...');

            // Handle background image - supports any image format (PNG, JPG, WEBP, GIF, etc.)
            const bgImageData = canvasData.backgroundImage;
            if (bgImageData && bgImageData.src) {
                let bgImgUrl = bgImageData.src;

                // Check if image URL is external and needs proxying
                try {
                    const urlObj = new URL(bgImageData.src);
                    // If image is from an external domain, use proxy
                    if (urlObj.hostname !== window.location.hostname &&
                        urlObj.hostname !== 'localhost' &&
                        !urlObj.hostname.endsWith('vercel.app') &&
                        !urlObj.hostname.endsWith('newsagent.com')) {
                        bgImgUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(bgImageData.src);
                    }
                } catch (e) {
                    // If URL parsing fails, treat as external and use proxy
                    bgImgUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(bgImageData.src);
                }

                console.log('[CardGenerator] Loading background image:', bgImgUrl.substring(0, 100));

                // Create background image with proper scaling (cover mode)
                fabric.Image.fromURL(bgImgUrl, function(bgImg) {
                    const canvasWidth = ${width};
                    const canvasHeight = ${height};

                    // Calculate scale to cover entire canvas
                    const scaleX = canvasWidth / bgImg.width;
                    const scaleY = canvasHeight / bgImg.height;
                    const scale = Math.max(scaleX, scaleY);

                    // Calculate position to center
                    const scaledWidth = bgImg.width * scale;
                    const scaledHeight = bgImg.height * scale;
                    const left = (canvasWidth - scaledWidth) / 2;
                    const top = (canvasHeight - scaledHeight) / 2;

                    canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas), {
                        scaleX: scale,
                        scaleY: scale,
                        left: left,
                        top: top,
                        originX: 'left',
                        originY: 'top',
                    });
                    console.log('[CardGenerator] Background image loaded:', {
                        originalSize: bgImg.width + 'x' + bgImg.height,
                        scaledSize: scaledWidth.toFixed(0) + 'x' + scaledHeight.toFixed(0)
                    });
                });
            } else {
                canvas.backgroundColor = '${canvasData.backgroundColor || '#ffffff'}';
            }

            console.log('[CardGenerator] Calling loadFromJSON...');
            canvas.loadFromJSON(canvasData, function() {
                console.log('[CardGenerator] Canvas loaded, objects:', canvas.getObjects().length);

                // Restore image objects from saved src
                const loadedObjects = canvas.getObjects()
                loadedObjects.forEach(function(obj, idx) {
                    const dynamicField = obj.dynamicField;

                    // Restore image objects
                    if ((obj.type === 'image' || obj.type === 'fabric-image' || obj.type === 'Image') && obj._imageSrc) {
                        // Check if image URL is external and needs proxying
                        let imageSrc = obj._imageSrc;
                        try {
                            const urlObj = new URL(obj._imageSrc);
                            // If image is from an external domain, use proxy
                            if (urlObj.hostname !== window.location.hostname &&
                                urlObj.hostname !== 'localhost' &&
                                !urlObj.hostname.endsWith('vercel.app') &&
                                !urlObj.hostname.endsWith('newsagent.com')) {
                                imageSrc = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(obj._imageSrc);
                            }
                        } catch (e) {
                            // If URL parsing fails, treat as external and use proxy
                            imageSrc = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(obj._imageSrc);
                        }

                        console.log('[CardGenerator] Restoring image object from src:', imageSrc.substring(0, 100))
                            fabric.Image.fromURL(imageSrc, function(newImg) {
                            newImg.set({
                                left: obj.left,
                                top: obj.top,
                                scaleX: obj.scaleX || 1,
                                scaleY: obj.scaleY || 1,
                                angle: obj.angle || 0,
                                originX: obj.originX || 'left',
                                originY: obj.originY || 'top',
                            })
                            const objIndex = canvas.getObjects().indexOf(obj)
                            canvas.remove(obj)
                            canvas.add(newImg)
                            canvas.renderAll()
                            console.log('[CardGenerator] Image object restored')
                        })
                    }

                    if (dynamicField && dynamicField !== 'none' && dynamicField !== 'image') {
                        const newValue = newsItem[dynamicField];
                        if (newValue && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'IText')) {
                            // Store original position BEFORE any changes
                            const originalLeft = obj.left;
                            const originalTop = obj.top;
                            const originalFontSize = obj.fontSize;
                            const originalOriginX = obj.originX || 'left';
                            const originalOriginY = obj.originY || 'top';

                            console.log('BEFORE update:', { left: originalLeft, top: originalTop, fontSize: originalFontSize });

                            // Update text content
                            obj.set('text', String(newValue));

                            // Apply proper text configuration for consistent rendering
                            // Set originY to 'top' to match HTML/CSS behavior
                            obj.set({
                                originX: originalOriginX,  // Preserve original originX
                                originY: 'top',  // Use top as origin to match HTML/CSS rendering
                                textAlign: obj.textAlign || 'left'
                            });

                            // Force recalculation of text dimensions
                            obj.initDimensions();

                            // Important: preserve original positioning after text change
                            // Compensate for any baseline shifts by using the original position
                            obj.set({
                                left: originalLeft,
                                top: originalTop,
                                originX: originalOriginX,
                                originY: 'top'  // Consistently use top origin
                            });

                            // Update coordinates after position adjustment
                            obj.setCoords();

                            console.log('AFTER update:', {
                                left: obj.left,
                                top: obj.top,
                                fontSize: obj.fontSize
                            });
                            console.log('Updated text: ' + dynamicField + ' = ' + String(newValue).substring(0, 50));
                        }
                    }

                    if (obj.fontFamily && customFontFamilies.includes(obj.fontFamily)) {
                        console.log('Using custom font:', obj.fontFamily);
                    }
                });

                // Perform final layout calculations and renders
                canvas.calcOffset();
                canvas.renderAll();

                // Ensure all objects are properly positioned and rendered
                canvas.getObjects().forEach(obj => {
                    obj.setCoords();
                });
                canvas.renderAll();

                // Handle image replacement in rectangles marked as dynamicField='image'
                const objectsForImageReplacement = canvas.getObjects();
                let imageReplaced = false;

                for (let i = 0; i < objectsForImageReplacement.length; i++) {
                    const obj = objectsForImageReplacement[i];
                    const dynamicField = obj.dynamicField;

                    if (obj.type.toLowerCase() === 'rect' && dynamicField === 'image' && newsItem.image) {
                        // Check if image URL is external and needs proxying
                        let imageUrl = newsItem.image;
                        try {
                            const urlObj = new URL(newsItem.image);
                            // If image is from an external domain, use proxy
                            if (urlObj.hostname !== window.location.hostname &&
                                urlObj.hostname !== 'localhost' &&
                                !urlObj.hostname.endsWith('vercel.app') &&
                                !urlObj.hostname.endsWith('newsagent.com')) {
                                imageUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(newsItem.image);
                            }
                        } catch (e) {
                            // If URL parsing fails, treat as external and use proxy
                            imageUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(newsItem.image);
                        }

                        // Create a new image object to replace rectangle
                        fabric.Image.fromURL(imageUrl, function(img) {
                            // Scale the image to fit the rectangle while maintaining aspect ratio
                            const scaleX = obj.width / img.width;
                            const scaleY = obj.height / img.height;
                            const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

                            img.set({
                                left: obj.left,
                                top: obj.top,
                                scaleX: scale,
                                scaleY: scale,
                                originX: obj.originX || 'left',
                                originY: obj.originY || 'top',
                            });

                            canvas.remove(obj);
                            canvas.add(img);
                            canvas.renderAll();
                            imageReplaced = true;
                        }, {
                            crossOrigin: 'anonymous'
                        });
                    }
                    }

                // Use requestAnimationFrame to ensure render completion
                requestAnimationFrame(() => {
                    canvas.requestRenderAll();

                    // Use another rAF to ensure everything is settled
                    requestAnimationFrame(() => {
                        canvas.requestRenderAll();

                        // Capture the image after ensuring all layouts are complete
                        try {
                            const dataUrl = canvas.toDataURL({
                                format: 'png',
                                multiplier: 1
                            });
                            console.log('[CardGenerator] Data URL generated:', dataUrl.length);
                            window.canvasResult = dataUrl;
                        } catch (err) {
                            console.error('[CardGenerator] Error generating data URL:', err.message);
                            window.canvasResult = 'ERROR: ' + err.message;
                        }
                    });
                });
            });
        }).catch(error => {
            console.error('Font loading error:', error);
            // Proceed with default fonts if custom font loading fails
            // Initialize canvas after a short delay to ensure fonts are available
            setTimeout(() => {
                const canvas = new fabric.Canvas('canvas', {
                    width: ${width},
                    height: ${height},
                    backgroundColor: '${canvasData.backgroundColor || '#ffffff'}',
                    renderOnAddRemove: false
                });

                // Continue with the same initialization code as above
                const bgImageData = canvasData.backgroundImage;
                if (bgImageData && bgImageData.src) {
                    let bgImgUrl = bgImageData.src;

                    // Check if image URL is external and needs proxying
                    try {
                        const urlObj = new URL(bgImageData.src);
                        // If image is from an external domain, use proxy
                        if (urlObj.hostname !== window.location.hostname &&
                            urlObj.hostname !== 'localhost' &&
                            !urlObj.hostname.endsWith('vercel.app') &&
                            !urlObj.hostname.endsWith('newsagent.com')) {
                            bgImgUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(bgImageData.src);
                        }
                    } catch (e) {
                        // If URL parsing fails, treat as external and use proxy
                        bgImgUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(bgImageData.src);
                    }

                    console.log('[CardGenerator] Loading background image:', bgImgUrl.substring(0, 100));

                    fabric.Image.fromURL(bgImgUrl, function(bgImg) {
                        const canvasWidth = ${width};
                        const canvasHeight = ${height};

                        const scaleX = canvasWidth / bgImg.width;
                        const scaleY = canvasHeight / bgImg.height;
                        const scale = Math.max(scaleX, scaleY);

                        const scaledWidth = bgImg.width * scale;
                        const scaledHeight = bgImg.height * scale;
                        const left = (canvasWidth - scaledWidth) / 2;
                        const top = (canvasHeight - scaledHeight) / 2;

                        canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas), {
                            scaleX: scale,
                            scaleY: scale,
                            left: left,
                            top: top,
                            originX: 'left',
                            originY: 'top',
                        });
                    });
                } else {
                    canvas.backgroundColor = '${canvasData.backgroundColor || '#ffffff'}';
                }

                canvas.loadFromJSON(canvasData, function() {
                    console.log('[CardGenerator] Canvas JSON loaded successfully');
                    const loadedObjects = canvas.getObjects()
                    console.log('[CardGenerator] Found', loadedObjects.length, 'objects to process');
                    loadedObjects.forEach(function(obj, idx) {
                        const dynamicField = obj.dynamicField;

                        if ((obj.type === 'image' || obj.type === 'fabric-image' || obj.type === 'Image') && obj._imageSrc) {
                            // Check if image URL is external and needs proxying
                            let imageSrc = obj._imageSrc;
                            try {
                                const urlObj = new URL(obj._imageSrc);
                                // If image is from an external domain, use proxy
                                if (urlObj.hostname !== window.location.hostname &&
                                    urlObj.hostname !== 'localhost' &&
                                    !urlObj.hostname.endsWith('vercel.app') &&
                                    !urlObj.hostname.endsWith('newsagent.com')) {
                                    imageSrc = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(obj._imageSrc);
                                }
                            } catch (e) {
                                // If URL parsing fails, treat as external and use proxy
                                imageSrc = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(obj._imageSrc);
                            }

                        fabric.Image.fromURL(imageSrc, function(newImg) {
                                newImg.set({
                                    left: obj.left,
                                    top: obj.top,
                                    scaleX: obj.scaleX || 1,
                                    scaleY: obj.scaleY || 1,
                                    angle: obj.angle || 0,
                                    originX: obj.originX || 'left',
                                    originY: obj.originY || 'top',
                                })
                                const objIndex = canvas.getObjects().indexOf(obj)
                                canvas.remove(obj)
                                canvas.add(newImg)
                                canvas.renderAll()
                            })
                        }

                        if (dynamicField && dynamicField !== 'none' && dynamicField !== 'image') {
                            const newValue = newsItem[dynamicField];
                            if (newValue && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'IText')) {
                                const originalLeft = obj.left;
                                const originalOriginX = obj.originX || 'left';
                                const originalOriginY = obj.originY || 'top';

                                // Calculate original visual position before changing text
                                const originalTop = obj.top;

                                obj.set('text', String(newValue));

                                // Apply proper text configuration for consistent rendering
                                // Set originY to 'top' to match HTML/CSS behavior
                                obj.set({
                                    originX: originalOriginX,  // Preserve original originX
                                    originY: 'top',  // Use top as origin to match HTML/CSS rendering
                                    textAlign: obj.textAlign || 'left'
                                });

                                // Force recalculation of text dimensions
                                obj.initDimensions();

                                // Important: preserve original positioning after text change
                                // Compensate for any baseline shifts by using the original position
                                obj.set({
                                    left: originalLeft,
                                    top: originalTop,
                                    originX: originalOriginX,
                                    originY: 'top'  // Consistently use top origin
                                });

                                // Update coordinates after position adjustment
                                obj.setCoords();
                            }
                        }

                        if (obj.fontFamily && customFontFamilies.includes(obj.fontFamily)) {
                            console.log('Using custom font:', obj.fontFamily);
                        }
                    });

                    // Perform final layout calculations and renders
                    canvas.calcOffset();
                    canvas.renderAll();

                    // Ensure all objects are properly positioned and rendered
                    canvas.getObjects().forEach(obj => {
                        obj.setCoords();
                    });
                    canvas.renderAll();

                    // Handle image replacement in rectangles marked as dynamicField='image'
                    const objectsForImageReplacement = canvas.getObjects();
                    const imagePromises = [];

                    for (let i = 0; i < objectsForImageReplacement.length; i++) {
                        const obj = objectsForImageReplacement[i];
                        const dynamicField = obj.dynamicField;

                        if (obj.type.toLowerCase() === 'rect' && dynamicField === 'image' && newsItem.image) {
                            // Check if image URL is external and needs proxying
                            let imageUrl = newsItem.image;
                            try {
                                const urlObj = new URL(newsItem.image);
                                // If image is from an external domain, use proxy
                                if (urlObj.hostname !== window.location.hostname &&
                                    urlObj.hostname !== 'localhost' &&
                                    !urlObj.hostname.endsWith('vercel.app') &&
                                    !urlObj.hostname.endsWith('newsagent.com')) {
                                    imageUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(newsItem.image);
                                }
                            } catch (e) {
                                // If URL parsing fails, treat as external and use proxy
                                imageUrl = window.location.origin + '/api/image-proxy?url=' + encodeURIComponent(newsItem.image);
                            }

                            // Create a promise for each image replacement
                            const imagePromise = new Promise((resolve) => {
                                // Create a new image object to replace rectangle
                                fabric.Image.fromURL(imageUrl, function(img) {
                                    // Scale the image to fit the rectangle while maintaining aspect ratio
                                    const scaleX = obj.width / img.width;
                                    const scaleY = obj.height / img.height;
                                    const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

                                    img.set({
                                        left: obj.left,
                                        top: obj.top,
                                        scaleX: scale,
                                        scaleY: scale,
                                        originX: obj.originX || 'left',
                                        originY: obj.originY || 'top',
                                    });

                                    canvas.remove(obj);
                                    canvas.add(img);
                                    canvas.renderAll();
                                    resolve(true);
                                }, {
                                    crossOrigin: 'anonymous'
                                });
                            });

                            imagePromises.push(imagePromise);
                        }
                    }

                    // Wait for all image replacements to complete, then render final canvas
                    Promise.all(imagePromises).then(() => {
                        // Ensure all objects are properly positioned after image replacements
                        canvas.getObjects().forEach(obj => {
                            obj.setCoords();
                        });

                        canvas.renderAll();

                        // Use multiple requestAnimationFrame calls to ensure everything is settled
                        requestAnimationFrame(() => {
                            canvas.requestRenderAll();

                            requestAnimationFrame(() => {
                                canvas.requestRenderAll();

                                try {
                                    const dataUrl = canvas.toDataURL({
                                        format: 'png',
                                        multiplier: 1
                                    });
                                    window.canvasResult = dataUrl;
                                } catch (err) {
                                    console.error('[CardGenerator] Error converting canvas to dataURL:', err.message);
                                    window.canvasResult = 'ERROR: Failed to convert canvas to image: ' + err.message;
                                }
                            });
                        });
                    }).catch(function(err) {
                        console.error('[CardGenerator] Error in image promise chain:', err.message);
                        // Try to render anyway with whatever we have
                        try {
                            canvas.renderAll();
                            const dataUrl = canvas.toDataURL({
                                format: 'png',
                                multiplier: 1
                            });
                            window.canvasResult = dataUrl;
                        } catch (fallbackErr) {
                            console.error('[CardGenerator] Fallback also failed:', fallbackErr.message);
                            window.canvasResult = 'ERROR: Canvas rendering failed: ' + err.message + ' | Fallback: ' + fallbackErr.message;
                        }
                    });
                }, function(err) {
                    // loadFromJSON error callback
                    console.error('[CardGenerator] Error loading canvas JSON:', err.message);
                    window.canvasResult = 'ERROR: Failed to load canvas JSON: ' + err.message;
                });
            }, 500);
        });
    </script>
</body>
</html>`;

    // Save HTML for debugging
    const fs = require('fs');
    fs.writeFileSync('./debug-card-gen.html', htmlContent);
    console.log('[CardGenerator] Saved HTML to debug-card-gen.html for debugging');

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            // Use executablePath that works in different environments
            ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=VizDisplayCompositor',
                '--force-device-scale-factor=1',
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=VizDisplayCompositor'
            ],
            // Add fallback options if executable path is not found
            ...(process.env.NODE_ENV === 'development' && {
                headless: 'shell' // Use shell mode in development for better compatibility
            })
        });

        const page = await browser.newPage();

        // Capture console logs from page
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        // Capture page errors
        page.on('pageerror', (error: any) => {
            console.error('PAGE ERROR:', error?.message || 'Unknown error');
        });

        // Capture request failures
        page.on('requestfailed', request => {
            console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText);
        });

        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

        // Safety timeout: if canvasResult is not set within 35 seconds, set an error
        const safetyTimeout = setTimeout(() => {
            if (typeof window !== 'undefined' && !window.canvasResult) {
                console.error('[CardGenerator] Safety timeout reached, canvas rendering took too long');
                page.evaluate(() => {
                    window.canvasResult = 'ERROR: Rendering timeout - canvas did not complete within 35 seconds';
                });
            }
        }, 35000);

        // Wait for the canvas result (40 second timeout to account for longer rendering delay)
        await page.waitForFunction(
            () => window.canvasResult !== null,
            { timeout: 40000 }
        );

        clearTimeout(safetyTimeout);

        const result = await page.evaluate(() => window.canvasResult);

        if (result && typeof result === 'string' && result.startsWith('data:image/png;base64,')) {
            const base64Data = result.split(',')[1];
            return Buffer.from(base64Data, 'base64');
        }

        if (result && typeof result === 'string' && result.startsWith('ERROR:')) {
            throw new Error(result);
        }

        throw new Error('Failed to generate canvas image');
    } catch (error) {
        console.error('Error generating card with Puppeteer:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
