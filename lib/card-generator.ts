
// import * as fabric from 'fabric'
// import { JSDOM } from 'jsdom'
// import { createCanvas } from 'canvas'

interface GenerateCardOptions {
    template: any
    mapping: any
    newsItem: any
}

export async function generateCardImage({ template, mapping, newsItem }: GenerateCardOptions): Promise<Buffer> {
    try {
        // Dynamic imports to handle environments without native dependencies
        const { JSDOM } = require('jsdom')
        const { createCanvas } = require('canvas')
        const fabricModule = require('fabric')
        // Handle different export structures (CommonJS vs ESM interop)
        const fabric = fabricModule.fabric || fabricModule

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
        objects.forEach((obj: any, idx: number) => {
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
        // @ts-ignore
        const lower = canvas.lowerCanvasEl

        if (lower && typeof (lower as any).toBuffer === 'function') {
            return (lower as any).toBuffer('image/png')
        }

        if (nodeCanvasEl && typeof (nodeCanvasEl as any).toBuffer === 'function') {
            return (nodeCanvasEl as any).toBuffer('image/png')
        }

        throw new Error('Could not export canvas buffer')

    } catch (e: any) {
        console.warn('[CardGenerator] Native dependencies missing or failed, returning mock buffer:', e.message)
        // Return 1x1 transparent PNG
        return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64')
    }
}
