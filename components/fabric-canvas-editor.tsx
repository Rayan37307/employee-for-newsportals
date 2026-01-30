'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'
import { Font } from '@/hooks/use-fonts'

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
    customFonts?: Font[]
    onCanvasReady?: (canvas: fabric.Canvas) => void
}

export function CanvasEditor({
    width = 1200,
    height = 630,
    readOnly = false,
    initialData,
    customFonts = [],
    onCanvasReady
}: CanvasEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
    const [isReady, setIsReady] = useState(false)
    const isMounted = useRef(true)
    const containerRef = useRef<HTMLDivElement>(null)
    const fontsLoadedRef = useRef<Set<string>>(new Set())

    const registerCustomFonts = useCallback(async () => {
        if (!customFonts || customFonts.length === 0) return

        for (const font of customFonts) {
            if (fontsLoadedRef.current.has(font.family)) continue

            try {
                const fontFace = new FontFace(font.family, `url(${font.fileUrl})`)
                await fontFace.load()
                document.fonts.add(fontFace)
                fontsLoadedRef.current.add(font.family)
                console.log(`Registered custom font: ${font.name} (${font.family})`)
            } catch (error) {
                console.error(`Failed to register font ${font.name}:`, error)
            }
        }
    }, [customFonts])

    const initCanvas = async () => {
        if (!canvasRef.current) return

        // Wait for canvas element to have dimensions
        if (canvasRef.current.width === 0 || canvasRef.current.height === 0) {
            console.warn('Canvas element has no dimensions, waiting...')
            await new Promise(resolve => setTimeout(resolve, 100))
            if (!canvasRef.current || canvasRef.current.width === 0 || canvasRef.current.height === 0) {
                console.warn('Canvas element still has no dimensions after waiting')
                return
            }
        }

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

        try {
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

            // Set the global canvas instance so the useCanvas hook can access it
            globalCanvasInstance = canvas;

            canvas.renderAll()
            setIsReady(true)

            if (onCanvasReady && isMounted.current) {
                onCanvasReady(canvas)
            }
        } catch (e) {
            console.error('Error initializing canvas:', e)
        }
    }

    useEffect(() => {
        isMounted.current = true
        registerCustomFonts()
        return () => { isMounted.current = false }
    }, [])

    useEffect(() => {
        registerCustomFonts()
    }, [customFonts, registerCustomFonts])

    useEffect(() => {
        isMounted.current = true;
        initCanvas()

        return () => {
            isMounted.current = false;
            if (fabricCanvasRef.current) {
                try {
                    fabricCanvasRef.current.cancelRequested = true;
                    fabricCanvasRef.current.dispose()
                } catch (e) {
                    /* ignore */
                }
                fabricCanvasRef.current = null;
            }
        }
    }, []) // Only run once on mount

    // Function to load initial data into an existing canvas
    const loadInitialDataIntoCanvas = async (canvas: fabric.Canvas, data: any) => {
        // Extend canvas type to include cancelRequested property
        (canvas as any).cancelRequested = (canvas as any).cancelRequested || false;

        if (!canvas || !data || !canvas.contextContainer || (canvas as any).cancelRequested) return;

        try {
            await canvas.loadFromJSON(data);
            // Restore custom properties after loading
            if (data.objects && Array.isArray(data.objects)) {
                for (let index = 0; index < canvas.getObjects().length; index++) {
                    const obj = canvas.getObjects()[index];
                    // Check if canvas is still valid before each operation
                    if (!canvas.contextContainer || (canvas as any).cancelRequested) return;

                    if (data.objects[index]) {
                        // Restore dynamicField
                        if (data.objects[index].dynamicField !== undefined) {
                            (obj as any).dynamicField = data.objects[index].dynamicField
                        }
                        // Restore fallbackValue
                        if (data.objects[index].fallbackValue !== undefined) {
                            (obj as any).fallbackValue = data.objects[index].fallbackValue
                        }
                        // Restore text width for i-text objects (for text wrapping)
                        const objType = obj.type?.toLowerCase()
                        if ((objType === 'i-text' || objType === 'text') && data.objects[index].width !== undefined) {
                            const textObj = obj as fabric.IText
                            textObj.set('width', data.objects[index].width)
                            console.log('[CanvasEditor] Restored text width:', data.objects[index].width)
                        }
                        // Restore image objects from saved src
                        if ((objType === 'image' || objType === 'fabric-image') && data.objects[index]._imageSrc) {
                            const src = data.objects[index]._imageSrc

                            // Check if it's a data URL (starts with 'data:')
                            if (src.startsWith('data:')) {
                                // For data URLs, use directly without proxy
                                console.log('[CanvasEditor] Restoring image from src:', src.substring(0, 100))
                                try {
                                    const newImg = await fabric.FabricImage.fromURL(src)
                                    // Check again if canvas is still valid after async operation
                                    if (!canvas.contextContainer || (canvas as any).cancelRequested) return;

                                    const origObj = obj as fabric.FabricImage
                                    newImg.set({
                                        left: origObj.left,
                                        top: origObj.top,
                                        scaleX: origObj.scaleX,
                                        scaleY: origObj.scaleY,
                                        angle: origObj.angle,
                                        originX: origObj.originX,
                                        originY: origObj.originY,
                                    })
                                    canvas.remove(origObj)
                                    canvas.add(newImg)
                                    if (canvas.contextContainer && !(canvas as any).cancelRequested) canvas.renderAll()
                                } catch (err) {
                                    console.error('[CanvasEditor] Error restoring image:', err)
                                }
                            } else {
                                // For regular URLs, check if external and needs proxying
                                let imageSrc = src;
                                try {
                                    const urlObj = new URL(src);
                                    // If the image is from an external domain, use the proxy
                                    if (urlObj.hostname !== window.location.hostname &&
                                        urlObj.hostname !== 'localhost' &&
                                        !urlObj.hostname.endsWith('vercel.app') &&
                                        !urlObj.hostname.endsWith('newsagent.com')) {
                                        imageSrc = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(src)}`;
                                    }
                                } catch (e) {
                                    // If URL parsing fails, treat as external and use proxy
                                    imageSrc = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(src)}`;
                                }

                                console.log('[CanvasEditor] Restoring image from src:', imageSrc.substring(0, 100))
                                try {
                                    const newImg = await fabric.FabricImage.fromURL(imageSrc)
                                    // Check again if canvas is still valid after async operation
                                    if (!canvas.contextContainer || (canvas as any).cancelRequested) return;

                                    const origObj = obj as fabric.FabricImage
                                    newImg.set({
                                        left: origObj.left,
                                        top: origObj.top,
                                        scaleX: origObj.scaleX,
                                        scaleY: origObj.scaleY,
                                        angle: origObj.angle,
                                        originX: origObj.originX,
                                        originY: origObj.originY,
                                    })
                                    canvas.remove(origObj)
                                    canvas.add(newImg)
                                    if (canvas.contextContainer && !(canvas as any).cancelRequested) canvas.renderAll()
                                } catch (err) {
                                    console.error('[CanvasEditor] Error restoring image:', err)
                                }
                            }
                        }
                    }
                }
            }
            // Restore background image if present
            if (data.backgroundImage && data.backgroundImage.src) {
                const bgSrc = data.backgroundImage.src
                fabric.FabricImage.fromURL(bgSrc).then((bgImg: fabric.FabricImage) => {
                    // Check if canvas is still valid before setting background
                    if (!canvas.contextContainer || (canvas as any).cancelRequested) return;

                    const canvasWidth = data.width || canvas.width || 1200
                    const canvasHeight = data.height || canvas.height || 630

                    const scaleX = canvasWidth / bgImg.width!
                    const scaleY = canvasHeight / bgImg.height!
                    const scale = Math.max(scaleX, scaleY)

                    const scaledWidth = bgImg.width! * scale
                    const scaledHeight = bgImg.height! * scale
                    const left = (canvasWidth - scaledWidth) / 2
                    const top = (canvasHeight - scaledHeight) / 2

                    ;(canvas as any).backgroundImage = bgImg
                    bgImg.set({
                        scaleX: scale,
                        scaleY: scale,
                        left: left,
                        top: top,
                        originX: 'left',
                        originY: 'top',
                    })
                    if (canvas.contextContainer && !(canvas as any).cancelRequested) canvas.renderAll()
                }).catch((error: Error) => {
                    console.error('[CanvasEditor] Error loading background image:', error)
                })
            }
            if (canvas.contextContainer && !(canvas as any).cancelRequested) canvas.renderAll()
        } catch (e) {
            console.error('Error loading initial data into canvas:', e)
        }
    }

    // Separate effect to handle initialData changes after canvas is initialized
    useEffect(() => {
        if (fabricCanvasRef.current && initialData && isReady) {
            // Add a small delay to ensure canvas is fully ready
            setTimeout(() => {
                if (isMounted.current && fabricCanvasRef.current && fabricCanvasRef.current.contextContainer) {
                    // Load the initial data into the existing canvas
                    loadInitialDataIntoCanvas(fabricCanvasRef.current, initialData);
                }
            }, 100);
        }
    }, [initialData, isReady]); // This will run when initialData changes and canvas is ready

    return (
        <div ref={containerRef} className="relative bg-muted rounded-lg p-8 overflow-auto">
            <div className="inline-block shadow-xl">
                <canvas ref={canvasRef} />
            </div>
        </div>
    )
}

// Global variable to store the canvas instance
let globalCanvasInstance: fabric.Canvas | null = null;
let canvasReadyCallbacks: Array<(canvas: fabric.Canvas) => void> = [];

export function useCanvas() {
    const [canvasReady, setCanvasReady] = useState(!!globalCanvasInstance);

    // Function to subscribe to canvas ready state
    const waitForCanvas = (callback: (canvas: fabric.Canvas) => void) => {
        if (globalCanvasInstance) {
            callback(globalCanvasInstance);
        } else {
            canvasReadyCallbacks.push(callback);
        }
    };

    // Function to notify all callbacks when canvas is ready
    const notifyCanvasReady = (canvas: fabric.Canvas) => {
        globalCanvasInstance = canvas;
        setCanvasReady(true);

        // Notify all waiting callbacks
        canvasReadyCallbacks.forEach(callback => callback(canvas));
        canvasReadyCallbacks = []; // Clear the callbacks
    };

    const addText = (text: any = 'Add Text') => {
        waitForCanvas((canvas) => {
            // Ensure text is always a string to prevent "t.split is not a function" error
            // Use 'Add Text' as default if no text is provided
            const textString = String(text ?? 'Add Text');

            const textObj = new fabric.IText(textString, {
                left: 100,
                top: 100,
                fontSize: 32,
                fontFamily: 'Arial',
                fill: '#000000',
                width: 300, // Default width for text wrapping
                dynamicField: 'none',
            })

            canvas.add(textObj)
            canvas.setActiveObject(textObj)
            canvas.renderAll()
        });
    }

    const addRectangle = () => {
        waitForCanvas((canvas) => {
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
        })
    }

    const addCircle = () => {
        waitForCanvas((canvas) => {
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
        })
    }

    const addImage = (url: string) => {
        waitForCanvas((canvas) => {
            // Check if it's a data URL (starts with 'data:')
            if (url.startsWith('data:')) {
                // For data URLs, use directly without proxy
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
            } else {
                // For regular URLs, check if external and needs proxying
                let imageUrl = url;
                try {
                    const urlObj = new URL(url);
                    // If the image is from an external domain, use the proxy
                    if (urlObj.hostname !== window.location.hostname &&
                        urlObj.hostname !== 'localhost' &&
                        !urlObj.hostname.endsWith('vercel.app') &&
                        !urlObj.hostname.endsWith('newsagent.com')) {
                        imageUrl = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(url)}`;
                    }
                } catch (e) {
                    // If URL parsing fails, treat as external and use proxy
                    imageUrl = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(url)}`;
                }

                fabric.FabricImage.fromURL(imageUrl).then((img: fabric.FabricImage) => {
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
        })
    }

    const setBackgroundImage = (url: string) => {
        waitForCanvas((canvas) => {
            // Check if it's a data URL (starts with 'data:')
            if (url.startsWith('data:')) {
                // For data URLs, use directly without proxy
                fabric.FabricImage.fromURL(url).then((img: fabric.FabricImage) => {
                    const canvasWidth = canvas.width || 1200
                    const canvasHeight = canvas.height || 630

                    // Calculate scale to cover entire canvas (like CSS background-size: cover)
                    const scaleX = canvasWidth / img.width!
                    const scaleY = canvasHeight / img.height!
                    const scale = Math.max(scaleX, scaleY)

                    // Calculate position to center the image
                    const scaledWidth = img.width! * scale;
                    const scaledHeight = img.height! * scale;
                    const left = (canvasWidth - scaledWidth) / 2;
                    const top = (canvasHeight - scaledHeight) / 2;

                    // Use the proper Fabric.js method to set background image
                    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                        scaleX: scale,
                        scaleY: scale,
                        left: left,
                        top: top,
                        originX: 'left',
                        originY: 'top',
                    });

                    console.log('[CanvasEditor] Background image set:', {
                        originalSize: `${img.width}x${img.height}`,
                        scaledSize: `${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}`,
                        scale: scale.toFixed(2)
                    });
                }).catch((error: Error) => {
                    console.error('[CanvasEditor] Error loading background image:', error)
                })
            } else {
                // For regular URLs, check if external and needs proxying
                let imageUrl = url;
                try {
                    const urlObj = new URL(url);
                    // If the image is from an external domain, use the proxy
                    if (urlObj.hostname !== window.location.hostname &&
                        urlObj.hostname !== 'localhost' &&
                        !urlObj.hostname.endsWith('vercel.app') &&
                        !urlObj.hostname.endsWith('newsagent.com')) {
                        imageUrl = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(url)}`;
                    }
                } catch (e) {
                    // If URL parsing fails, treat as external and use proxy
                    imageUrl = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(url)}`;
                }

                fabric.FabricImage.fromURL(imageUrl).then((img: fabric.FabricImage) => {
                    const canvasWidth = canvas.width || 1200
                    const canvasHeight = canvas.height || 630

                    // Calculate scale to cover entire canvas (like CSS background-size: cover)
                    const scaleX = canvasWidth / img.width!
                    const scaleY = canvasHeight / img.height!
                    const scale = Math.max(scaleX, scaleY)

                    // Calculate position to center the image
                    const scaledWidth = img.width! * scale;
                    const scaledHeight = img.height! * scale;
                    const left = (canvasWidth - scaledWidth) / 2;
                    const top = (canvasHeight - scaledHeight) / 2;

                    // Use the proper Fabric.js method to set background image
                    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                        scaleX: scale,
                        scaleY: scale,
                        left: left,
                        top: top,
                        originX: 'left',
                        originY: 'top',
                    });

                    console.log('[CanvasEditor] Background image set:', {
                        originalSize: `${img.width}x${img.height}`,
                        scaledSize: `${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}`,
                        scale: scale.toFixed(2)
                    });
                }).catch((error: Error) => {
                    console.error('[CanvasEditor] Error loading background image:', error)
                })
            }
        })
    }

    const clearBackgroundImage = () => {
        waitForCanvas((canvas) => {
            canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
            canvas.backgroundColor = canvas.backgroundColor || '#ffffff'
            canvas.renderAll()
        })
    }

    const deleteSelected = () => {
        waitForCanvas((canvas) => {
            if (!canvas.contextContainer) return

            const activeObjects = canvas.getActiveObjects()
            if (activeObjects.length) {
                activeObjects.forEach((obj: fabric.FabricObject) => canvas.remove(obj))
                canvas.discardActiveObject()
                canvas.renderAll()
            }
        })
    }

    const clearCanvas = () => {
        waitForCanvas((canvas) => {
            if (!canvas.contextContainer) return
            canvas.clear()
            canvas.backgroundColor = '#ffffff'
            canvas.renderAll()
        })
    }

    const exportToJSON = () => {
        if (!globalCanvasInstance) return null

        let result: any = null;

        waitForCanvas((canvas) => {
            const json = canvas.toJSON()

            // Add custom properties to each object
            const objects = canvas.getObjects()
            if (json.objects && Array.isArray(json.objects)) {
                objects.forEach((obj: fabric.Object, index: number) => {
                    if (json.objects[index]) {
                        // Add dynamicField
                        const dynamicField = (obj as any).dynamicField
                        if (dynamicField !== undefined) {
                            json.objects[index].dynamicField = dynamicField
                        } else {
                            json.objects[index].dynamicField = 'none'
                        }

                        // Add fallbackValue
                        const fallbackValue = (obj as any).fallbackValue
                        if (fallbackValue !== undefined) {
                            json.objects[index].fallbackValue = fallbackValue
                        }

                        // Explicitly save width for text objects (for text wrapping)
                        const objType = obj.type?.toLowerCase()
                        if (objType === 'i-text' || objType === 'text') {
                            const textObj = obj as fabric.IText
                            json.objects[index].width = textObj.width
                            console.log('[CanvasEditor] Saving text width:', textObj.width)
                        }

                        // Handle image objects - save src URL
                        if (objType === 'image' || objType === 'fabric-image') {
                            const imgObj = obj as fabric.FabricImage
                            // Get src from the image element
                            const imgElement = imgObj.getElement() as HTMLImageElement
                            if (imgElement && imgElement.src) {
                                json.objects[index]._imageSrc = imgElement.src
                                console.log('[CanvasEditor] Saving image src:', imgElement.src.substring(0, 100))
                            }
                        }
                    }
                })
            }

            // Save background image with proper format detection
            const bgImage = (canvas as any).backgroundImage
            if (bgImage && bgImage.toDataURL) {
                try {
                    // Detect format from data URL or default to PNG
                    const dataUrl = bgImage.toDataURL({ format: 'png', quality: 1 })
                    json.backgroundImage = {
                        type: 'image',
                        src: dataUrl,
                    }
                    console.log('[CanvasEditor] Background image saved, format: PNG')
                } catch (error) {
                    console.warn('[CanvasEditor] Could not save background image:', error)
                }
            }

            json.width = canvas.width
            json.height = canvas.height
            result = json
        });

        return result;
    }

    const exportToImage = (dynamicData?: Record<string, any>) => {
        let result: string | null = null;

        waitForCanvas((canvas) => {
            // Temporarily update canvas with dynamic data if provided
            if (dynamicData) {
                // Store original text values and positions to restore later
                const originalStates: {
                    [key: number]: {
                        text: string,
                        left: number,
                        top: number,
                        width: number,
                        height: number,
                        originX: string,
                        originY: string,
                        scaleX: number,
                        scaleY: number,
                        fontSize: number,
                        charSpacing: number,
                        lineHeight: number
                    }
                } = {}

                canvas.getObjects().forEach((obj: fabric.Object, index: number) => {
                    if (obj.type === 'i-text' || obj.type === 'text') {
                        const textObj = obj as fabric.IText;
                        const dynamicField = (obj as any).dynamicField as DynamicField

                        if (dynamicField && dynamicField !== 'none') {
                            // Store original state including position and dimensions
                            originalStates[index] = {
                                text: textObj.text || '',
                                left: textObj.left || 0,
                                top: textObj.top || 0,
                                width: textObj.width || 0,
                                height: textObj.height || 0,
                                originX: textObj.originX || 'left',
                                originY: textObj.originY || 'top',
                                scaleX: textObj.scaleX || 1,
                                scaleY: textObj.scaleY || 1,
                                fontSize: textObj.fontSize || 0,
                                charSpacing: textObj.charSpacing || 0,
                                lineHeight: textObj.lineHeight || 1.16
                            };

                            const value = dynamicData[dynamicField] || (obj as any).fallbackValue || textObj.text
                            if (value) {
                                // Store the original coordinates and positioning properties
                                const originalLeft = textObj.left;
                                const originalTop = textObj.top;
                                const originalOriginX = textObj.originX || 'left';
                                const originalOriginY = textObj.originY || 'top';

                                // Ensure value is a string to prevent "t.split is not a function" error
                                const stringValue = String(value);

                                // Temporarily set the new text
                                textObj.set({ text: stringValue });

                                // Force recalculation of text dimensions
                                textObj.initDimensions();

                                // Maintain the same visual positioning by keeping the same anchor point
                                // The originX and originY determine how the object is positioned relative to its left/top coordinates
                                textObj.set({
                                    left: originalLeft,
                                    top: originalTop,
                                    originX: originalOriginX,
                                    originY: originalOriginY,
                                    scaleX: originalStates[index].scaleX,
                                    scaleY: originalStates[index].scaleY,
                                    fontSize: originalStates[index].fontSize,
                                    charSpacing: originalStates[index].charSpacing,
                                    lineHeight: originalStates[index].lineHeight
                                });
                            }
                        }
                    }
                })

                // Render the canvas with updated text but preserved positioning
                canvas.renderAll()

                // Capture the image with updated text
                const dataUrl = canvas.toDataURL({
                    format: 'png',
                    quality: 1,
                    multiplier: 1,
                })

                // Restore original text values and positions
                canvas.getObjects().forEach((obj: fabric.Object, index: number) => {
                    if (obj.type === 'i-text' || obj.type === 'text') {
                        const dynamicField = (obj as any).dynamicField as DynamicField
                        if (dynamicField && dynamicField !== 'none' && originalStates[index] !== undefined) {
                            const originalState = originalStates[index];
                            const textObj = obj as fabric.IText;

                            textObj.set({
                                text: originalState.text,
                                left: originalState.left,
                                top: originalState.top,
                                width: originalState.width,
                                height: originalState.height,
                                originX: originalState.originX,
                                originY: originalState.originY,
                                scaleX: originalState.scaleX,
                                scaleY: originalState.scaleY,
                                fontSize: originalState.fontSize,
                                charSpacing: originalState.charSpacing,
                                lineHeight: originalState.lineHeight
                            });
                        }
                    }
                })

                // Restore the canvas to original state
                canvas.renderAll()

                result = dataUrl;
            } else {
                // Original behavior if no dynamic data provided
                result = canvas.toDataURL({
                    format: 'png',
                    quality: 1,
                    multiplier: 1,
                })
            }
        });

        return result;
    }

    const loadFromJSON = (json: any) => {
        waitForCanvas((canvas) => {
            // Handle background image first
            if (json.backgroundImage && json.backgroundImage.src) {
                let bgSrc = json.backgroundImage.src;

                // Check if the image URL is external and needs proxying
                try {
                    const urlObj = new URL(json.backgroundImage.src);
                    // If the image is from an external domain, use the proxy
                    if (urlObj.hostname !== window.location.hostname &&
                        urlObj.hostname !== 'localhost' &&
                        !urlObj.hostname.endsWith('vercel.app') &&
                        !urlObj.hostname.endsWith('newsagent.com')) {
                        bgSrc = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(json.backgroundImage.src)}`;
                    }
                } catch (e) {
                    // If URL parsing fails, treat as external and use proxy
                    bgSrc = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(json.backgroundImage.src)}`;
                }

                fabric.FabricImage.fromURL(bgSrc).then((bgImg: fabric.FabricImage) => {
                    const canvasWidth = json.width || canvas.width || 1200
                    const canvasHeight = json.height || canvas.height || 630

                    const scaleX = canvasWidth / bgImg.width!
                    const scaleY = canvasHeight / bgImg.height!
                    const scale = Math.max(scaleX, scaleY)

                    const scaledWidth = bgImg.width! * scale;
                    const scaledHeight = bgImg.height! * scale;
                    const left = (canvasWidth - scaledWidth) / 2;
                    const top = (canvasHeight - scaledHeight) / 2;

                    // Use the proper Fabric.js method to set background image
                    canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas), {
                        scaleX: scale,
                        scaleY: scale,
                        left: left,
                        top: top,
                        originX: 'left',
                        originY: 'top',
                    });

                    // Now load the rest of the canvas
                    canvas.loadFromJSON(json, async () => {
                        await restoreCustomProperties(canvas, json)
                        canvas.renderAll()
                    })
                }).catch((error: Error) => {
                    console.error('[CanvasEditor] Error loading background image from JSON:', error)
                    // Fallback to loading without background
                    canvas.loadFromJSON(json, async () => {
                        await restoreCustomProperties(canvas, json)
                        canvas.renderAll()
                    })
                })
            } else {
                canvas.loadFromJSON(json, async () => {
                    await restoreCustomProperties(canvas, json)
                    canvas.renderAll()
                })
            }
        })

        const restoreCustomProperties = async (canvas: fabric.Canvas, jsonData: any) => {
            if (jsonData.objects && Array.isArray(jsonData.objects)) {
                // Convert the objects array to promises to handle async operations properly
                const promises = canvas.getObjects().map(async (obj, index) => {
                    if (jsonData.objects[index]) {
                        // Restore dynamicField
                        if (jsonData.objects[index].dynamicField !== undefined) {
                            (obj as any).dynamicField = jsonData.objects[index].dynamicField
                        }
                        // Restore fallbackValue
                        if (jsonData.objects[index].fallbackValue !== undefined) {
                            (obj as any).fallbackValue = jsonData.objects[index].fallbackValue
                        }
                        // Restore text width for i-text objects (for text wrapping)
                        const objType = obj.type?.toLowerCase()
                        if ((objType === 'i-text' || objType === 'text') && jsonData.objects[index].width !== undefined) {
                            const textObj = obj as fabric.IText
                            textObj.set('width', jsonData.objects[index].width)
                            console.log('[CanvasEditor] Restored text width:', jsonData.objects[index].width)
                        }
                        // Restore image objects from saved src
                        if ((objType === 'image' || objType === 'fabric-image') && jsonData.objects[index]._imageSrc) {
                            const src = jsonData.objects[index]._imageSrc

                            // Check if it's a data URL (starts with 'data:')
                            if (src.startsWith('data:')) {
                                // For data URLs, use directly without proxy
                                console.log('[CanvasEditor] Restoring image from src:', src.substring(0, 100))
                                try {
                                    const newImg = await fabric.FabricImage.fromURL(src)
                                    const origObj = obj as fabric.FabricImage
                                    newImg.set({
                                        left: origObj.left,
                                        top: origObj.top,
                                        scaleX: origObj.scaleX,
                                        scaleY: origObj.scaleY,
                                        angle: origObj.angle,
                                        originX: origObj.originX,
                                        originY: origObj.originY,
                                    })
                                    // Replace the object
                                    canvas.remove(origObj)
                                    canvas.add(newImg)
                                } catch (err) {
                                    console.error('[CanvasEditor] Error restoring image:', err)
                                }
                            } else {
                                // For regular URLs, check if external and needs proxying
                                let imageSrc = src;
                                try {
                                    const urlObj = new URL(src);
                                    // If the image is from an external domain, use the proxy
                                    if (urlObj.hostname !== window.location.hostname &&
                                        urlObj.hostname !== 'localhost' &&
                                        !urlObj.hostname.endsWith('vercel.app') &&
                                        !urlObj.hostname.endsWith('newsagent.com')) {
                                        imageSrc = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(src)}`;
                                    }
                                } catch (e) {
                                    // If URL parsing fails, treat as external and use proxy
                                    imageSrc = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(src)}`;
                                }

                                console.log('[CanvasEditor] Restoring image from src:', imageSrc.substring(0, 100))
                                try {
                                    const newImg = await fabric.FabricImage.fromURL(imageSrc)
                                    const origObj = obj as fabric.FabricImage
                                    newImg.set({
                                        left: origObj.left,
                                        top: origObj.top,
                                        scaleX: origObj.scaleX,
                                        scaleY: origObj.scaleY,
                                        angle: origObj.angle,
                                        originX: origObj.originX,
                                        originY: origObj.originY,
                                    })
                                    // Replace the object
                                    canvas.remove(origObj)
                                    canvas.add(newImg)
                                } catch (err) {
                                    console.error('[CanvasEditor] Error restoring image:', err)
                                }
                            }
                        }
                    }
                });

                // Wait for all promises to complete
                await Promise.all(promises);

                // Render all changes at once
                canvas.renderAll();
            }
        }
    }

    const updateWithDynamicData = (data: Record<string, any>) => {
        waitForCanvas((canvas) => {
            canvas.getObjects().forEach((obj: fabric.Object) => {
                const dynamicField = (obj as any).dynamicField as DynamicField

                if (dynamicField && dynamicField !== 'none') {
                    if (obj.type === 'i-text' || obj.type === 'text') {
                        const textObj = obj as fabric.IText
                        const value = data[dynamicField] || (obj as any).fallbackValue || textObj.text

                        if (value) {
                            // Store original position and properties BEFORE any changes
                            const originalLeft = textObj.left;
                            const originalTop = textObj.top;
                            const originalOriginX = textObj.originX || 'left';
                            const originalOriginY = textObj.originY || 'top';

                            // Ensure value is a string to prevent "t.split is not a function" error
                            const stringValue = String(value);

                            // Update text content
                            textObj.set({ text: stringValue });

                            // Apply consistent text configuration
                            textObj.set({
                                originX: originalOriginX,
                                originY: 'top',  // Use top as origin to match HTML/CSS rendering
                                textAlign: textObj.textAlign || 'left'
                            });

                            // Force recalculation of text dimensions
                            textObj.initDimensions();

                            // Preserve original positioning after text change
                            textObj.set({
                                left: originalLeft,
                                top: originalTop,
                                originX: originalOriginX,
                                originY: 'top'  // Consistently use top origin
                            });

                            // Update coordinates after position adjustment
                            textObj.setCoords();
                        }
                    } else if (obj.type === 'rect' || obj.type === 'circle') {
                        if (dynamicField === 'image' && data.image) {
                            // Check if it's a data URL (starts with 'data:')
                            if (data.image.startsWith('data:')) {
                                // For data URLs, use directly without proxy
                                fabric.FabricImage.fromURL(data.image).then((img: fabric.FabricImage) => {
                                    // Simply scale the image to fit the shape's dimensions
                                    const scaleX = (obj.width || 0) / img.width!;
                                    const scaleY = (obj.height || 0) / img.height!;

                                    // Apply the same position and scaling as the original shape
                                    img.set({
                                        left: obj.left,
                                        top: obj.top,
                                        scaleX: scaleX,
                                        scaleY: scaleY,
                                        originX: obj.originX || 'left',
                                        originY: obj.originY || 'top',
                                        angle: obj.angle || 0,
                                    })

                                    canvas.remove(obj)
                                    canvas.add(img)
                                    canvas.renderAll()
                                }).catch(err => {
                                    console.error('Error loading image:', err)
                                })
                            } else {
                                // For regular URLs, check if external and needs proxying
                                let imageUrl = data.image;
                                try {
                                    const urlObj = new URL(data.image);
                                    // If the image is from an external domain, use the proxy
                                    if (urlObj.hostname !== window.location.hostname &&
                                        urlObj.hostname !== 'localhost' &&
                                        !urlObj.hostname.endsWith('vercel.app') &&
                                        !urlObj.hostname.endsWith('newsagent.com')) {
                                        imageUrl = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(data.image)}`;
                                    }
                                } catch (e) {
                                    // If URL parsing fails, treat as external and use proxy
                                    imageUrl = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(data.image)}`;
                                }

                                fabric.FabricImage.fromURL(imageUrl).then((img: fabric.FabricImage) => {
                                    // Simply scale the image to fit the shape's dimensions
                                    const scaleX = (obj.width || 0) / img.width!;
                                    const scaleY = (obj.height || 0) / img.height!;

                                    // Apply the same position and scaling as the original shape
                                    img.set({
                                        left: obj.left,
                                        top: obj.top,
                                        scaleX: scaleX,
                                        scaleY: scaleY,
                                        originX: obj.originX || 'left',
                                        originY: obj.originY || 'top',
                                        angle: obj.angle || 0,
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
                }
            })

            canvas.renderAll()
        })
    }

    const sendToBack = () => {
        waitForCanvas((canvas) => {
            const activeObject = canvas.getActiveObject()
            if (activeObject) {
                (canvas as any).sendObjectToBack(activeObject)
                canvas.renderAll()
            }
        })
    }

    const sendBackward = () => {
        waitForCanvas((canvas) => {
            const activeObject = canvas.getActiveObject()
            if (activeObject) {
                (canvas as any).sendObjectBackwards(activeObject)
                canvas.renderAll()
            }
        })
    }

    const bringForward = () => {
        waitForCanvas((canvas) => {
            const activeObject = canvas.getActiveObject()
            if (activeObject) {
                (canvas as any).bringObjectForward(activeObject)
                canvas.renderAll()
            }
        })
    }

    const bringToFront = () => {
        waitForCanvas((canvas) => {
            const activeObject = canvas.getActiveObject()
            if (activeObject) {
                (canvas as any).bringObjectToFront(activeObject)
                canvas.renderAll()
            }
        })
    }

    // Function to set the global canvas instance
    const setCanvas = (canvas: fabric.Canvas) => {
        notifyCanvasReady(canvas);
    }

    return {
        canvas: globalCanvasInstance,
        canvasReady, // Expose the ready state
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
        setBackgroundImage,
        clearBackgroundImage,
        sendToBack,
        sendBackward,
        bringForward,
        bringToFront,
    }
}

export function getCanvasDimensions(canvasData: any): { width: number; height: number } {
  if (canvasData.width && canvasData.height) {
    return { width: canvasData.width, height: canvasData.height }
  }

  const objects = canvasData.objects || []
  if (objects.length > 0) {
    let maxRight = 0
    let maxBottom = 0

    for (const obj of objects) {
      const left = obj.left || 0
      const top = obj.top || 0
      const width = (obj.width || 200) * (obj.scaleX || 1)
      const height = (obj.height || 100) * (obj.scaleY || 1)

      if (obj.originX === 'center') {
        maxRight = Math.max(maxRight, left + width / 2)
      } else {
        maxRight = Math.max(maxRight, left + width)
      }

      if (obj.originY === 'center') {
        maxBottom = Math.max(maxBottom, top + height / 2)
      } else {
        maxBottom = Math.max(maxBottom, top + height)
      }
    }

    return {
      width: Math.max(maxRight + 40, 400),
      height: Math.max(maxBottom + 40, 300)
    }
  }

  return { width: 800, height: 420 }
}