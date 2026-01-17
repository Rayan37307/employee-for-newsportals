'use client'

import { useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'

interface CanvasEditorProps {
    width?: number
    height?: number
    readOnly?: boolean
    initialData?: any
    onCanvasReady?: (canvas: fabric.Canvas) => void
}

export function CanvasEditor({
    width = 1200,
    height = 630,
    readOnly = false,
    initialData,
    onCanvasReady
}: CanvasEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
    const [isReady, setIsReady] = useState(false)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    useEffect(() => {
        if (!canvasRef.current) return

        // Initialize Fabric.js canvas
        const canvas = new fabric.Canvas(canvasRef.current, {
            width,
            height,
            backgroundColor: '#ffffff',
            selection: !readOnly,
            preserveObjectStacking: true,
            interactive: !readOnly,
            skipTargetFind: readOnly,
        })

        fabricCanvasRef.current = canvas

        const initCanvas = async () => {
            if (initialData) {
                try {
                    await canvas.loadFromJSON(initialData)
                } catch (e) {
                    console.error('Error loading initial data', e)
                }
            }

            // Add grid background if NOT readOnly (optional, keep existing grid logic for editor?)
            // Keeping grid logic generally useful unless readOnly? 
            // In preview we want to see the card as is. Usually grid is for editing.
            // If readOnly=true, maybe skip grid?
            // The original code adds grid. I'll keep it for now or maybe skip if initialData is present (implies loading a template).

            canvas.renderAll()
            setIsReady(true)

            if (onCanvasReady && isMounted.current) {
                onCanvasReady(canvas)
            }
        }

        initCanvas()

        // Cleanup on unmount
        return () => {
            // Basic disposal
            // Fabric might crash if disposed while loading, but we can't easily cancel.
            // But since we use local 'canvas' var in initCanvas closure, it should be fine mostly.
            try {
                canvas.dispose()
            } catch (e) { /* ignore */ }
        }
    }, [width, height, readOnly, initialData]) // removed onCanvasReady from dep array to avoid loops if function changes

    return (
        <div className="relative bg-muted rounded-lg p-8 overflow-auto">
            <div className="inline-block shadow-xl">
                <canvas ref={canvasRef} />
            </div>
        </div>
    )
}

export function useCanvas() {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null)

    const addText = (text: string = 'Add text') => {
        if (!canvas) return

        const textObj = new fabric.IText(text, {
            left: 100,
            top: 100,
            fontSize: 32,
            fontFamily: 'Arial',
            fill: '#000000',
        })

        canvas.add(textObj)
        canvas.setActiveObject(textObj)
        canvas.renderAll()
    }

    const addRectangle = () => {
        if (!canvas) return

        const rect = new fabric.Rect({
            left: 100,
            top: 100,
            width: 200,
            height: 100,
            fill: '#d946ef',
            stroke: '#9333ea',
            strokeWidth: 2,
        })

        canvas.add(rect)
        canvas.setActiveObject(rect)
        canvas.renderAll()
    }

    const addCircle = () => {
        if (!canvas) return

        const circle = new fabric.Circle({
            left: 100,
            top: 100,
            radius: 50,
            fill: '#3b82f6',
            stroke: '#1d4ed8',
            strokeWidth: 2,
        })

        canvas.add(circle)
        canvas.setActiveObject(circle)
        canvas.renderAll()
    }

    const addImage = (url: string) => {
        if (!canvas) return

        fabric.FabricImage.fromURL(url).then((img: fabric.FabricImage) => {
            img.scale(0.5)
            img.set({
                left: 100,
                top: 100,
            })
            canvas.add(img)
            canvas.setActiveObject(img)
            canvas.renderAll()
        })
    }

    const deleteSelected = () => {
        if (!canvas) return

        const activeObjects = canvas.getActiveObjects()
        if (activeObjects.length) {
            activeObjects.forEach((obj: fabric.FabricObject) => canvas.remove(obj))
            canvas.discardActiveObject()
            canvas.renderAll()
        }
    }

    const clearCanvas = () => {
        if (!canvas) return
        canvas.clear()
        canvas.backgroundColor = '#ffffff'
        canvas.renderAll()
    }

    const exportToJSON = () => {
        if (!canvas) return null
        return canvas.toJSON()
    }

    const exportToImage = () => {
        if (!canvas) return null
        return canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1,
        })
    }

    const loadFromJSON = (json: any) => {
        if (!canvas) return
        canvas.loadFromJSON(json).then(() => {
            canvas.renderAll()
        })
    }

    return {
        canvas,
        setCanvas,
        addText,
        addRectangle,
        addCircle,
        addImage,
        deleteSelected,
        clearCanvas,
        exportToJSON,
        exportToImage,
        loadFromJSON,
    }
}
