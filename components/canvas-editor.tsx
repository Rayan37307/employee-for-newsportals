'use client'

import { useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'

export type DynamicField = 'title' | 'date' | 'description' | 'category' | 'author' | 'image' | 'none';

export interface DynamicFieldConfig {
  field: DynamicField;
  fallbackValue?: string;
}

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
    const containerRef = useRef<HTMLDivElement>(null)

    const initCanvas = async () => {
        if (!canvasRef.current) return

        if (fabricCanvasRef.current) {
            try {
                fabricCanvasRef.current.dispose()
            } catch (e) {
                console.warn('Error disposing canvas:', e)
            }
            fabricCanvasRef.current = null
        }

        let canvasWidth = width
        let canvasHeight = height
        
        if (initialData && typeof initialData === 'object') {
            if (initialData.width) canvasWidth = initialData.width
            if (initialData.height) canvasHeight = initialData.height
        }

        const canvas = new fabric.Canvas(canvasRef.current, {
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: '#ffffff',
            selection: !readOnly,
            preserveObjectStacking: true,
            interactive: !readOnly,
            skipTargetFind: readOnly,
        })

        fabricCanvasRef.current = canvas

        if (initialData) {
            try {
                await canvas.loadFromJSON(initialData)
                // Restore custom properties after loading
                if (initialData.objects && Array.isArray(initialData.objects)) {
                    canvas.getObjects().forEach((obj, index) => {
                        if (initialData.objects[index]) {
                            if (initialData.objects[index].dynamicField !== undefined) {
                                (obj as any).dynamicField = initialData.objects[index].dynamicField
                            }
                            if (initialData.objects[index].fallbackValue !== undefined) {
                                (obj as any).fallbackValue = initialData.objects[index].fallbackValue
                            }
                        }
                    })
                }
            } catch (e) {
                console.error('Error loading initial data:', e)
            }
        }

        canvas.renderAll()
        setIsReady(true)

        if (onCanvasReady && isMounted.current) {
            onCanvasReady(canvas)
        }
    }

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    useEffect(() => {
        initCanvas()

        return () => {
            if (fabricCanvasRef.current) {
                try {
                    fabricCanvasRef.current.dispose()
                } catch (e) {
                    /* ignore */
                }
            }
        }
    }, [initialData])

    return (
        <div ref={containerRef} className="relative bg-muted rounded-lg p-8 overflow-auto">
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
            dynamicField: 'none',
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
            dynamicField: 'none',
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
            dynamicField: 'none',
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
                dynamicField: 'none',
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
        
        const json = canvas.toJSON()
        
        // Add custom properties to each object
        const objects = canvas.getObjects()
        if (json.objects && Array.isArray(json.objects)) {
            objects.forEach((obj, index) => {
                if (json.objects[index]) {
                    const dynamicField = (obj as any).dynamicField
                    if (dynamicField !== undefined) {
                        json.objects[index].dynamicField = dynamicField
                    } else {
                        json.objects[index].dynamicField = 'none'
                    }
                    
                    const fallbackValue = (obj as any).fallbackValue
                    if (fallbackValue !== undefined) {
                        json.objects[index].fallbackValue = fallbackValue
                    }
                }
            })
        }
        
        json.width = canvas.width
        json.height = canvas.height
        return json
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
            if (json.objects && Array.isArray(json.objects)) {
                canvas.getObjects().forEach((obj, index) => {
                    if (json.objects[index]) {
                        if (json.objects[index].dynamicField !== undefined) {
                            (obj as any).dynamicField = json.objects[index].dynamicField
                        }
                        if (json.objects[index].fallbackValue !== undefined) {
                            (obj as any).fallbackValue = json.objects[index].fallbackValue
                        }
                    }
                })
            }
            canvas.renderAll()
        })
    }

    const updateWithDynamicData = (data: Record<string, any>) => {
        if (!canvas) return

        canvas.getObjects().forEach((obj: fabric.Object) => {
            const dynamicField = (obj as any).dynamicField as DynamicField

            if (dynamicField && dynamicField !== 'none') {
                if (obj.type === 'i-text' || obj.type === 'text') {
                    const textObj = obj as fabric.IText
                    const value = data[dynamicField] || (obj as any).fallbackValue || textObj.text

                    if (value) {
                        textObj.set({ text: value as string })
                    }
                } else if (obj.type === 'rect' || obj.type === 'circle') {
                    if (dynamicField === 'image' && data.image) {
                        fabric.FabricImage.fromURL(data.image).then((img: fabric.FabricImage) => {
                            const scaleX = obj.width ? obj.width / img.width! : 1
                            const scaleY = obj.height ? obj.height / img.height! : 1

                            img.set({
                                left: obj.left,
                                top: obj.top,
                                scaleX: scaleX,
                                scaleY: scaleY,
                                originX: 'left',
                                originY: 'top',
                            })

                            canvas.remove(obj)
                            canvas.add(img)
                            canvas.renderAll()
                        }).catch(err => {
                            console.error('Error loading image:', err)
                        })
                    }
                }
            }
        })

        canvas.renderAll()
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
        updateWithDynamicData,
    }
}
