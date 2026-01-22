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

        canvas.loadFromJSON(${JSON.stringify(canvasData)}, function() {
            console.log('Canvas loaded, objects:', canvas.getObjects().length);
            
            canvas.getObjects().forEach(function(obj, idx) {
                const dynamicField = obj.dynamicField;
                if (dynamicField && dynamicField !== 'none' && dynamicField !== 'image') {
                    const newValue = newsItem[dynamicField];
                    if (newValue && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'IText')) {
                        // Ensure text object has proper width for wrapping
                        const textWidth = obj.width || 200;
                        obj.set('text', String(newValue));
                        obj.set('width', textWidth);
                        console.log('Updated text: ' + dynamicField + ' = ' + String(newValue).substring(0, 50));
                    }
                }
                
                if (obj.fontFamily && customFontFamilies.includes(obj.fontFamily)) {
                    console.log('Using custom font:', obj.fontFamily);
                }
            });
            
            canvas.renderAll();
            console.log('Canvas rendered');
            
            try {
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
        
        // Wait for the canvas result (30 second timeout for text-only rendering)
        await page.waitForFunction(
            () => window.canvasResult !== null,
            { timeout: 30000 }
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
