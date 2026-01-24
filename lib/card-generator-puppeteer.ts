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
 * Image compositing is handled separately by the sharp-based image processor.
 */
export async function generateCardImage({ template, mapping, newsItem }: GenerateCardOptions): Promise<Buffer> {
    const canvasData = typeof template.canvasData === 'string'
        ? JSON.parse(template.canvasData)
        : template.canvasData;

    const width = canvasData.width || 1200;
    const height = canvasData.height || 630;

    const customFonts = await getCustomFonts();
    
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
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"></script>
    <style>
        ${fontFaceCSS}
        body { margin: 0; padding: 0; }
        canvas { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    <script>
        const newsItem = ${newsItemJson};
        const customFontFamilies = ${fontFamilies};
        
        window.canvasResult = null;
        
        const canvas = new fabric.Canvas('canvas', {
            width: ${width},
            height: ${height},
            backgroundColor: '${canvasData.backgroundColor || '#ffffff'}',
            renderOnAddRemove: false
        });

        // Handle background image - supports any image format (PNG, JPG, WEBP, GIF, etc.)
        const bgImageData = ${JSON.stringify(canvasData)}.backgroundImage;
        if (bgImageData && bgImageData.src) {
            const bgImgUrl = bgImageData.src;
            console.log('[CardGenerator] Loading background image:', bgImgUrl.substring(0, 100));
            
            // Create background image with proper scaling (cover mode)
            fabric.FabricImage.fromURL(bgImgUrl).then(function(bgImg: any) {
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
            }).catch(function(err: Error) {
                console.error('[CardGenerator] Error loading background image:', err.message);
                // Fallback to solid color
                canvas.backgroundColor = '${canvasData.backgroundColor || '#ffffff'}';
            });
        } else {
            canvas.backgroundColor = '${canvasData.backgroundColor || '#ffffff'}';
        }

        canvas.loadFromJSON(${JSON.stringify(canvasData)}, function() {
            console.log('Canvas loaded, objects:', canvas.getObjects().length);
            
            // Restore image objects from saved src
            const loadedObjects = canvas.getObjects()
            loadedObjects.forEach(function(obj: any, idx: number) {
                const dynamicField = obj.dynamicField;
                
                // Restore image objects
                if ((obj.type === 'image' || obj.type === 'fabric-image' || obj.type === 'Image') && obj._imageSrc) {
                    console.log('[CardGenerator] Restoring image object from src:', obj._imageSrc.substring(0, 100))
                    fabric.FabricImage.fromURL(obj._imageSrc).then(function(newImg: any) {
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
                    }).catch(function(err: Error) {
                        console.error('[CardGenerator] Error restoring image:', err.message)
                    })
                }
                
                if (dynamicField && dynamicField !== 'none' && dynamicField !== 'image') {
                    const newValue = newsItem[dynamicField];
                    if (newValue && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'IText')) {
                        // Store original position BEFORE any changes
                        const originalLeft = obj.left;
                        const originalTop = obj.top;
                        const originalFontSize = obj.fontSize;
                        
                        console.log('BEFORE update:', { left: originalLeft, top: originalTop, fontSize: originalFontSize });
                        
                        // Update text content
                        obj.set('text', String(newValue));
                        
                        // Force immediate recalculation
                        obj.initDimensions();
                        
                        // Apply aggressive positioning fix with text baseline adjustment
                        obj.set({
                            left: originalLeft,
                            top: originalTop - 35, // Increased upward adjustment
                            originX: 'left',
                            originY: 'top',
                            textAlign: obj.textAlign || 'left',
                            textBaseline: 'top' // Explicitly set text baseline
                        });
                        
                        // Force another dimension recalculation after positioning
                        obj.initDimensions();
                        
                        // Final coordinate update
                        obj.setCoords();
                        
                        // One more render to ensure everything is settled
                        canvas.renderAll();
                        
                        console.log('AFTER update:', { 
                            left: obj.left, 
                            top: obj.top, 
                            fontSize: obj.fontSize,
                            textHeight: obj.height,
                            adjustment: -35,
                            textBaseline: obj.textBaseline
                        });
                        console.log('Updated text: ' + dynamicField + ' = ' + String(newValue).substring(0, 50));
                    }
                }
                
                if (obj.fontFamily && customFontFamilies.includes(obj.fontFamily)) {
                    console.log('Using custom font:', obj.fontFamily);
                }
            });
            
            canvas.renderAll();
            console.log('Canvas rendered');
            
            // Add a longer delay to ensure all text is properly rendered before capture
            setTimeout(function() {
                try {
                    // Force multiple renders to ensure everything is settled
                    canvas.renderAll();
                    canvas.renderAll(); // Double render for safety
                    
                    const dataUrl = canvas.toDataURL({
                        format: 'png',
                        quality: 1,
                        multiplier: 1
                    });
                    console.log('Data URL generated:', dataUrl.length);
                    window.canvasResult = dataUrl;
                } catch (err) {
                    console.error('toDataURL error:', err);
                    window.canvasResult = 'ERROR:' + String(err);
                }
            }, 1000); // Increased to 1000ms delay for rendering
        });
    </script>
</body>
</html>`;

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/google-chrome-stable',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        
        // Capture console logs from the page
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        
        // Wait for the canvas result (40 second timeout to account for longer rendering delay)
        await page.waitForFunction(
            () => window.canvasResult !== null,
            { timeout: 40000 }
        );
        
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
