
import * as fabric from 'fabric'
import { JSDOM } from 'jsdom'
import { createCanvas } from 'canvas'

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
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
        // @ts-ignore
        global.window = dom.window
        // @ts-ignore
        global.document = dom.window.document
    }

    // Create a static canvas (no interactivity needed)
    const width = 1200
    const height = 630

    // Node-canvas integration:
    // @ts-ignore
    const nodeCanvasEl = createCanvas(width, height)
    // @ts-ignore
    const canvas = new fabric.StaticCanvas(nodeCanvasEl, { width, height })

    // Load data
    await canvas.loadFromJSON(canvasData)

    // Apply Mappings
    const objects = canvas.getObjects()
    objects.forEach((obj, idx) => {
        const mappedField = mapping[idx]
        if (mappedField && newsItem && newsItem[mappedField]) {
            const newValue = String(newsItem[mappedField])

            // Text objects
            if (obj.type && obj.type.toLowerCase().includes('text')) {
                // @ts-ignore
                obj.set('text', newValue)
            }
        }
    })

    // Render
    canvas.renderAll()

    // Export to Buffer (PNG)
    // In node-canvas, toBuffer exists on the element, not the Fabric canvas instance wrapper usually.
    // fabric.StaticCanvas stores the lowerCanvasEl.

    // @ts-ignore
    const lower = canvas.lowerCanvasEl

    if (lower && typeof (lower as any).toBuffer === 'function') {
        return (lower as any).toBuffer('image/png')
    }

    // Fallback if we passed nodeCanvasEl, it might BE the element
    if (nodeCanvasEl && typeof (nodeCanvasEl as any).toBuffer === 'function') {
        return (nodeCanvasEl as any).toBuffer('image/png')
    }

    throw new Error('Could not export canvas buffer')
}
