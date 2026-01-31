import puppeteer from 'puppeteer';

interface GenerateCardOptions {
    template: any;
    mapping: any;
    newsItem: any;
}

declare global {
    interface Window {
        html2canvas: any;
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

function getCanvasDimensions(canvasData: any): { width: number; height: number } {
    if (canvasData.width && canvasData.height) {
        return { width: canvasData.width, height: canvasData.height };
    }
    
    // Calculate from objects if no explicit dimensions
    const objects = canvasData.objects || [];
    let maxRight = 0;
    let maxBottom = 0;
    
    objects.forEach((obj: any) => {
        const right = (obj.left || 0) + ((obj.width || 0) * (obj.scaleX || 1));
        const bottom = (obj.top || 0) + ((obj.height || 0) * (obj.scaleY || 1));
        maxRight = Math.max(maxRight, right);
        maxBottom = Math.max(maxBottom, bottom);
    });
    
    return { 
        width: Math.max(maxRight + 40, 400), 
        height: Math.max(maxBottom + 40, 420) 
    };
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr || '';
    }
}

/**
 * Generate a card image using HTML-based rendering with puppeteer
 * This mimics the manual card generation approach for consistent results
 */
export async function generateCardImage({ template, mapping, newsItem }: GenerateCardOptions): Promise<Buffer> {
    console.log('[CardGenerator] Generating card for:', newsItem.title?.substring(0, 50));

    const canvasData = typeof template.canvasData === 'string'
        ? JSON.parse(template.canvasData)
        : template.canvasData;

    const { width, height } = getCanvasDimensions(canvasData);
    const objects = canvasData.objects || [];
    const backgroundColor = canvasData.backgroundColor || '#ffffff';
    const backgroundImage = canvasData.backgroundImage;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const customFonts = await getCustomFonts();
    console.log('[CardGenerator] Custom fonts:', customFonts.length);

    // Build font face CSS
    const fontFaceCSS = customFonts.map(font => `
        @font-face {
            font-family: '${font.family}';
            src: url('${font.fileUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
    `).join('\n');

    // Process background image URL
    let bgImageUrl = '';
    if (backgroundImage?.src) {
        if (backgroundImage.src.startsWith('data:')) {
            bgImageUrl = backgroundImage.src;
        } else {
            bgImageUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(backgroundImage.src)}`;
        }
    }

    // Build HTML elements
    let elementsHTML = '';
    
    objects.forEach((obj: any) => {
        const type = (obj.type || '').toLowerCase();
        const dynamicField = obj.dynamicField || 'none';
        
        // Calculate position accounting for origin
        let left = obj.left || 0;
        let top = obj.top || 0;
        
        if (obj.originX === 'center') {
            left = left - ((obj.width || 0) * (obj.scaleX || 1)) / 2;
        }
        if (obj.originY === 'center') {
            top = top - ((obj.height || 0) * (obj.scaleY || 1)) / 2;
        }

        // Handle dynamic text replacement
        let text = obj.text || '';
        if (dynamicField === 'title') {
            text = newsItem.title || '';
        } else if (dynamicField === 'date') {
            text = newsItem.date || newsItem.publishedAt ? formatDate(newsItem.date || newsItem.publishedAt) : '';
        } else if (['description', 'subtitle'].includes(dynamicField)) {
            text = newsItem.description || '';
        } else if (dynamicField === 'author') {
            text = newsItem.author || '';
        } else if (dynamicField === 'category') {
            text = newsItem.category || '';
        }

        if (type === 'itext' || type === 'text' || type === 'i-text') {
            const objWidth = (obj.width || 200) * (obj.scaleX || 1);
            const objHeight = (obj.height || 50) * (obj.scaleY || 1);
            const fontSize = (obj.fontSize || 24) * (obj.scaleX || 1);
            const lineHeight = obj.lineHeight || 1.2;
            
            elementsHTML += `
                <div style="
                    position: absolute;
                    left: ${left}px;
                    top: ${top - (fontSize * 0.2)}px;
                    width: ${objWidth}px;
                    height: ${objHeight}px;
                    font-size: ${fontSize}px;
                    color: ${obj.fill || '#000000'};
                    font-family: ${obj.fontFamily || 'Arial, sans-serif'};
                    font-weight: ${obj.fontWeight || 'normal'};
                    font-style: ${obj.fontStyle || 'normal'};
                    line-height: ${lineHeight};
                    white-space: pre-wrap;
                    word-break: break-word;
                    text-align: ${obj.textAlign || 'left'};
                    text-decoration: ${obj.underline ? 'underline' : obj.linethrough ? 'line-through' : 'none'};
                    padding: 0;
                    margin: 0;
                    overflow: hidden;
                ">${text}</div>
            `;
        } else if (type === 'rect') {
            const rectWidth = (obj.width || 100) * (obj.scaleX || 1);
            const rectHeight = (obj.height || 100) * (obj.scaleY || 1);
            const borderRadius = (obj.rx || 0) > 0 ? `${(obj.rx || 0) * (obj.scaleX || 1)}px` : '0';
            
            if (dynamicField === 'image' && newsItem.image) {
                // Image replacement
                elementsHTML += `
                    <img src="${baseUrl}/api/image-proxy?url=${encodeURIComponent(newsItem.image)}" 
                         style="
                            position: absolute;
                            left: ${left}px;
                            top: ${top}px;
                            width: ${rectWidth}px;
                            height: ${rectHeight}px;
                            object-fit: cover;
                            border-radius: ${borderRadius};
                         "
                         crossorigin="anonymous"
                    />
                `;
            } else {
                // Regular rectangle
                elementsHTML += `
                    <div style="
                        position: absolute;
                        left: ${left}px;
                        top: ${top}px;
                        width: ${rectWidth}px;
                        height: ${rectHeight}px;
                        background-color: ${obj.fill || 'transparent'};
                        border: ${obj.strokeWidth > 0 ? `${Math.max(1, (obj.strokeWidth || 1) * (obj.scaleX || 1))}px solid ${obj.stroke || '#000000'}` : 'none'};
                        border-radius: ${borderRadius};
                    "></div>
                `;
            }
        } else if (type === 'circle') {
            const radius = (obj.radius || 25) * (obj.scaleX || 1);
            
            if (dynamicField === 'image' && newsItem.image) {
                // Circle image replacement
                elementsHTML += `
                    <img src="${baseUrl}/api/image-proxy?url=${encodeURIComponent(newsItem.image)}" 
                         style="
                            position: absolute;
                            left: ${left - radius}px;
                            top: ${top - radius}px;
                            width: ${radius * 2}px;
                            height: ${radius * 2}px;
                            object-fit: cover;
                            border-radius: 50%;
                         "
                         crossorigin="anonymous"
                    />
                `;
            } else {
                // Regular circle
                elementsHTML += `
                    <div style="
                        position: absolute;
                        left: ${left - radius}px;
                        top: ${top - radius}px;
                        width: ${radius * 2}px;
                        height: ${radius * 2}px;
                        background-color: ${obj.fill || '#e0e0e0'};
                        border: ${obj.strokeWidth > 0 ? `${obj.strokeWidth}px solid ${obj.stroke || '#000000'}` : 'none'};
                        border-radius: 50%;
                    "></div>
                `;
            }
        } else if (type === 'image' || type === 'fabric-image') {
            const imgWidth = (obj.width || 100) * (obj.scaleX || 1);
            const imgHeight = (obj.height || 100) * (obj.scaleY || 1);
            const imageSrc = obj._imageSrc || obj.src;
            
            if (imageSrc) {
                let src = imageSrc;
                if (!imageSrc.startsWith('data:')) {
                    src = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(imageSrc)}`;
                }
                
                elementsHTML += `
                    <img src="${src}" 
                         style="
                            position: absolute;
                            left: ${left}px;
                            top: ${top}px;
                            width: ${imgWidth}px;
                            height: ${imgHeight}px;
                            object-fit: cover;
                         "
                         crossorigin="anonymous"
                    />
                `;
            }
        }
    });

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <style>
        ${fontFaceCSS}
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            width: ${width}px; 
            height: ${height}px; 
            overflow: hidden;
            background-color: ${backgroundColor};
            ${bgImageUrl ? `
            background-image: url('${bgImageUrl}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            ` : ''}
        }
    </style>
</head>
<body>
    ${elementsHTML}
</body>
</html>`;

    // Save HTML for debugging
    const fs = require('fs');
    fs.writeFileSync('./debug-card-gen.html', htmlContent);

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=VizDisplayCompositor',
                '--force-device-scale-factor=1',
            ],
        });

        const page = await browser.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);
        
        // Small delay to ensure rendering is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Take screenshot
        const screenshot = await page.screenshot({
            type: 'png',
            fullPage: false,
        });

        return Buffer.from(screenshot);
    } catch (error) {
        console.error('Error generating card with Puppeteer:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
