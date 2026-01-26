
import { createCanvas, loadImage } from 'canvas'
import * as fabric from 'fabric'
import { JSDOM } from 'jsdom'

interface GenerateCardOptions {
    template: any
    mapping: any
    newsItem: any
}

export async function generateCardImage({ template, mapping, newsItem }: GenerateCardOptions): Promise<Buffer> {
    const canvasData = typeof template.canvasData === 'string'
        ? JSON.parse(template.canvasData)
        : template.canvasData

    // Shim JSDOM for Fabric if needed
    if (!global.document) {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost',
            pretendToBeVisual: true,
            runScripts: 'dangerously'
        })
        // @ts-ignore
        global.window = dom.window
        // @ts-ignore
        global.document = dom.window.document
        // @ts-ignore
        global.HTMLElement = dom.window.HTMLElement
        // @ts-ignore
        global.Element = dom.window.Element
        // @ts-ignore
        global.Node = dom.window.Node
        // @ts-ignore
        global.navigator = dom.window.navigator
    }

    // Create a static canvas (no interactivity needed)
    const width = canvasData.width || 1200
    const height = canvasData.height || 630

    // Node-canvas integration:
    // @ts-ignore
    const nodeCanvasEl = createCanvas(width, height)
    // @ts-ignore
    const canvas = new fabric.StaticCanvas(nodeCanvasEl, { width, height })

    // Handle background image
    if (canvasData.backgroundImage && canvasData.backgroundImage.src) {
        try {
            console.log('[CardGenerator] DEBUG: Loading background image')
            // @ts-ignore
            const bgImg = await fabric.FabricImage.fromURL(canvasData.backgroundImage.src)
            
            // Calculate scale to cover entire canvas
            const scaleX = width / bgImg.width!
            const scaleY = height / bgImg.height!
            const scale = Math.max(scaleX, scaleY)
            
            // Calculate position to center
            const scaledWidth = bgImg.width! * scale
            const scaledHeight = bgImg.height! * scale
            const left = (width - scaledWidth) / 2
            const top = (height - scaledHeight) / 2
            
            ;(canvas as any).backgroundImage = bgImg
            bgImg.set({
                scaleX: scale,
                scaleY: scale,
                left: left,
                top: top,
                originX: 'left',
                originY: 'top',
            })
            
            console.log('[CardGenerator] DEBUG: Background image loaded:', {
                originalSize: `${bgImg.width}x${bgImg.height}`,
                scaledSize: `${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}`
            })
        } catch (error) {
            console.error('[CardGenerator] ERROR loading background image:', error)
            // Fallback to solid color
            canvas.backgroundColor = '#ffffff'
        }
    } else {
        canvas.backgroundColor = canvasData.backgroundColor || '#ffffff'
    }

    // Load data
    await canvas.loadFromJSON(canvasData)

    console.log('[CardGenerator] DEBUG: Canvas loaded from JSON')
    console.log('[CardGenerator] DEBUG: canvasData keys:', Object.keys(canvasData))
    console.log('[CardGenerator] DEBUG: canvasData.objects count:', canvasData.objects?.length || 0)

    // Check if dynamicField is preserved in the raw JSON
    if (canvasData.objects && canvasData.objects.length > 0) {
        console.log('[CardGenerator] DEBUG: First 3 raw objects from canvasData:')
        canvasData.objects.slice(0, 3).forEach((obj: any, idx: number) => {
            console.log(`  Object ${idx}: type=${obj.type}, dynamicField=${obj.dynamicField}, customProperties=${Object.keys(obj).filter(k => !['type', 'version', 'originX', 'originY', 'left', 'top', 'width', 'height', 'fill', 'stroke'].includes(k))}`)
        })
    }

    // CRITICAL FIX: Fabric.js doesn't preserve custom properties during JSON serialization
    // We must manually restore dynamicField from the original JSON data
    if (canvasData.objects && Array.isArray(canvasData.objects)) {
        const loadedObjects = canvas.getObjects()
        console.log('[CardGenerator] DEBUG: Restoring dynamicField properties to', loadedObjects.length, 'objects')
        loadedObjects.forEach((obj: fabric.FabricObject, index: number) => {
            if (canvasData.objects[index]) {
                if (canvasData.objects[index].dynamicField !== undefined) {
                    (obj as any).dynamicField = canvasData.objects[index].dynamicField
                    console.log(`[CardGenerator] DEBUG: Restored dynamicField="${canvasData.objects[index].dynamicField}" to object ${index} (type=${obj.type})`)
                }
                if (canvasData.objects[index].fallbackValue !== undefined) {
                    (obj as any).fallbackValue = canvasData.objects[index].fallbackValue
                }
            }
        })
    }

    // Apply Mappings based on dynamic field assignments
    const objects = canvas.getObjects()
    console.log('[CardGenerator] DEBUG: Total objects loaded from canvas:', objects.length)

    for (const obj of objects) {
        const dynamicField = (obj as any).dynamicField || 'none'
        console.log(`[CardGenerator] DEBUG: Object type=${obj.type}, dynamicField="${dynamicField}", has dynamicField prop=${(obj as any).hasOwnProperty('dynamicField')}`)

        if (dynamicField && dynamicField !== 'none' && newsItem && newsItem[dynamicField]) {
            const newValue = String(newsItem[dynamicField])
            console.log(`[CardGenerator] DEBUG: Found dynamicField="${dynamicField}", newValue=${newValue.substring(0, 100)}${newValue.length > 100 ? '...' : ''}`)

            // Handle text objects
            const objType = obj.type?.toLowerCase();
            if (objType && (objType.includes('text') || objType === 'itext' || objType === 'text')) {
                console.log('[CardGenerator] DEBUG: Handling as text object')
                const textObj = obj as fabric.IText
                textObj.set({ text: newValue })
                
                console.log('[CardGenerator] DEBUG: Text updated, position maintained:', {
                    left: textObj.left,
                    top: textObj.top,
                    width: textObj.width,
                    height: textObj.height
                })
            }
            // Handle image objects (regular images on canvas)
            else if ((obj.type === 'image' || obj.type === 'fabric-image' || obj.type === 'Image') && (obj as any)._imageSrc) {
                console.log('[CardGenerator] DEBUG: Handling as image object')
                try {
                    let imageSrc = (obj as any)._imageSrc
                    let imageDataUrl = imageSrc

                    if (!imageSrc.startsWith('data:image')) {
                        // Fetch URL and convert to data URL
                        const response = await fetch(imageSrc)
                        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
                        const arrayBuffer = await response.arrayBuffer()
                        const buffer = Buffer.from(arrayBuffer)
                        const mimeType = response.headers.get('content-type') || 'image/jpeg'
                        imageDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
                    }

                    const img = await loadImage(imageDataUrl)
                    
                    // @ts-ignore
                    const fabricImage = new fabric.FabricImage(img, {
                        left: obj.left,
                        top: obj.top,
                        scaleX: obj.scaleX || 1,
                        scaleY: obj.scaleY || 1,
                        angle: obj.angle || 0,
                        originX: obj.originX || 'left',
                        originY: obj.originY || 'top',
                    })

                    canvas.remove(obj)
                    canvas.add(fabricImage)
                    console.log('[CardGenerator] DEBUG: Image object restored successfully')
                } catch (error) {
                    console.error('[CardGenerator] ERROR handling image object:', error)
                }
            }
            // Handle image placeholders (rectangles with image dynamic field)
            else if ((obj.type === 'rect' || obj.type === 'Rect') && dynamicField === 'image' && newValue) {
                console.log('[CardGenerator] DEBUG: Handling as image placeholder (rect with image dynamicField)')
                try {
                    // Handle data URLs (base64) from autopilot service
                    let imageDataUrl = newValue;

                    if (newValue.startsWith('data:image')) {
                        // Already a data URL, use it directly
                        imageDataUrl = newValue;
                    } else {
                        // It's a URL, fetch it and convert to data URL
                        const response = await fetch(newValue);
                        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const mimeType = response.headers.get('content-type') || 'image/jpeg';
                        imageDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
                    }

                    // Create an Image from the data URL using node-canvas
                    const img = await loadImage(imageDataUrl);

                    // Scale image to fit the rectangle while maintaining aspect ratio
                    const scaleX = obj.width ? obj.width / img.width : 1;
                    const scaleY = obj.height ? obj.height / img.height : 1;
                    const scale = Math.min(scaleX, scaleY);

                    // Create fabric Image from the node-canvas image
                    // @ts-ignore
                    const fabricImage = new fabric.FabricImage(img, {
                        left: obj.left,
                        top: obj.top,
                        scaleX: scale,
                        scaleY: scale,
                        originX: 'left',
                        originY: 'top',
                    });

                    // Replace the rectangle with the image
                    canvas.remove(obj);
                    canvas.add(fabricImage);
                } catch (error) {
                    console.error('[CardGenerator] ERROR replacing image placeholder:', error);
                    // Fallback: just change the placeholder appearance
                    (obj as fabric.Rect).set({
                        fill: '#f0f0f0',
                        stroke: '#ccc',
                        strokeWidth: 1
                    });
                }
            }
        }
    }

    // Render
    canvas.renderAll()

    // Export to Buffer (PNG)
    // @ts-ignore
    const lower = canvas.lowerCanvasEl

    if (lower && typeof (lower as any).toBuffer === 'function') {
        return (lower as any).toBuffer('image/png')
    }

    if (nodeCanvasEl && typeof (nodeCanvasEl as any).toBuffer === 'function') {
        return (nodeCanvasEl as any).toBuffer('image/png')
    }

    throw new Error('Could not export canvas buffer')
}
