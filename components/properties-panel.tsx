'use client'

import { useEffect, useState, useRef } from 'react'
import * as fabric from 'fabric'
import { DynamicField } from './canvas-editor'
import { Font } from '@/hooks/use-fonts'

interface PropertiesPanelProps {
    canvas: fabric.Canvas | null
    customFonts?: Font[]
    onFontUpload?: (file: File, name: string) => Promise<void>
}

export function PropertiesPanel({ canvas, customFonts = [], onFontUpload }: PropertiesPanelProps) {
    const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null)
    const [properties, setProperties] = useState<{
        left: number
        top: number
        width: number | string
        height: number
        angle: number
        fill: string
        stroke: string
        strokeWidth: number
        opacity: number
        fontSize: number
        fontFamily: string
        fontWeight: string
        textAlign: string
        dynamicField: DynamicField
        fallbackValue: string
    }>({
        left: 0,
        top: 0,
        width: '',
        height: 0,
        angle: 0,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 0,
        opacity: 1,
        fontSize: 20,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        textAlign: 'left',
        dynamicField: 'none' as DynamicField,
        fallbackValue: '',
    })
    const [uploading, setUploading] = useState(false)
    const [fontName, setFontName] = useState('')
    const [showFontUpload, setShowFontUpload] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFontUpload = async (file: File, name: string) => {
        if (!file || !name) return

        if (!file.name.endsWith('.ttf')) {
            alert('Please select a .ttf font file')
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('Font file size must be less than 10MB')
            return
        }

        setUploading(true)
        setUploadSuccess(false)
        try {
            if (onFontUpload) {
                await onFontUpload(file, name)
                setFontName('')
                setShowFontUpload(false)
                setUploadSuccess(true)
                setTimeout(() => setUploadSuccess(false), 3000)
            }
        } catch (error) {
            console.error('Error uploading font:', error)
            alert('Failed to upload font')
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const updateProperties = (obj: fabric.FabricObject) => {
        const newProps: Record<string, any> = {
            left: Math.round(obj.left || 0),
            top: Math.round(obj.top || 0),
            angle: Math.round(obj.angle || 0),
            opacity: obj.opacity || 1,
            dynamicField: (obj as any).dynamicField || 'none',
            fallbackValue: (obj as any).fallbackValue || '',
        }

        // Type-specific properties
        if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'triangle') {
            newProps.width = Math.round((obj.width || 0) * (obj.scaleX || 1))
            newProps.height = Math.round((obj.height || 0) * (obj.scaleY || 1))
            newProps.fill = (obj as any).fill || '#000000'
            newProps.stroke = (obj as any).stroke || '#000000'
            newProps.strokeWidth = (obj as any).strokeWidth || 0
        }

        if (obj.type === 'i-text' || obj.type === 'text') {
            const textObj = obj as fabric.IText
            newProps.fontSize = textObj.fontSize || 20
            newProps.fontFamily = textObj.fontFamily || 'Arial'
            newProps.fontWeight = textObj.fontWeight || 'normal'
            newProps.textAlign = textObj.textAlign || 'left'
            newProps.fill = textObj.fill as string || '#000000'
            // Get width for text wrapping (fabric uses width property for i-text)
            newProps.width = textObj.width || ''
        }

        setProperties(prev => ({ ...prev, ...newProps }))
    }

    const handlePropertyChange = (key: string, value: any) => {
        if (!selectedObject || !canvas) return

        // Check if canvas is ready
        const canvasEl = canvas.getElement()
        if (!canvasEl || canvasEl.width === 0 || canvasEl.height === 0 || !canvas.contextContainer) {
            console.warn('Canvas not ready for rendering')
            return
        }

        const updates: Record<string, any> = { [key]: value }
        const isText = selectedObject.type === 'i-text' || selectedObject.type === 'text'

        // Handle scaled dimensions for shapes
        if (key === 'width' && selectedObject.scaleX && !isText) {
            const origWidth = selectedObject.width || 0
            updates.scaleX = value / origWidth
        } else if (key === 'height' && selectedObject.scaleY && !isText) {
            const origHeight = selectedObject.height || 0
            updates.scaleY = value / origHeight
        } else if (key === 'width' && isText) {
            // For text width, allow empty string while typing
            // Only apply safe width constraint when value is valid
            const parsedValue = parseInt(String(value))
            if (value === '' || isNaN(parsedValue)) {
                // Allow empty while typing, don't update canvas yet
                ;(selectedObject as fabric.IText).set({ width: selectedObject.width || 200 })
            } else {
                // Apply safe width (minimum 1)
                const safeWidth = Math.max(1, parsedValue)
                ;(selectedObject as fabric.IText).set({ width: safeWidth })
            }
        }

        if (key === 'dynamicField') {
            selectedObject.set('dynamicField', value)
        }

        if (key === 'fallbackValue') {
            selectedObject.set('fallbackValue', value)
        }

        if (key !== 'width' || !isText) {
            selectedObject.set(updates)
        }
        
        try {
            canvas.requestRenderAll()
        } catch (e) {
            console.warn('Canvas render failed:', e)
        }
        
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            try {
                if (canvasEl && canvasEl.width > 0 && canvasEl.height > 0) {
                    canvas.renderAll()
                }
            } catch (e) {
                console.warn('Canvas renderAll failed:', e)
            }
        }, 10)
        
        updateProperties(selectedObject)
    }

    useEffect(() => {
        if (!canvas) return

        const handleSelection = () => {
            const active = canvas.getActiveObject()
            if (active) {
                setSelectedObject(active)
                updateProperties(active)
            } else {
                setSelectedObject(null)
            }
        }

        const handleObjectModified = () => {
            const active = canvas.getActiveObject()
            if (active) {
                updateProperties(active)
            }
        }

        canvas.on('selection:created', handleSelection)
        canvas.on('selection:updated', handleSelection)
        canvas.on('selection:cleared', () => setSelectedObject(null))
        canvas.on('object:modified', handleObjectModified)
        canvas.on('object:scaling', handleObjectModified)
        canvas.on('object:rotating', handleObjectModified)
        canvas.on('object:moving', handleObjectModified)

        return () => {
            canvas.off('selection:created', handleSelection)
            canvas.off('selection:updated', handleSelection)
            canvas.off('selection:cleared')
            canvas.off('object:modified', handleObjectModified)
            canvas.off('object:scaling', handleObjectModified)
            canvas.off('object:rotating', handleObjectModified)
            canvas.off('object:moving', handleObjectModified)
        }
    }, [canvas])

    if (!selectedObject) {
        return (
            <div className="w-80 border-l border-border bg-card p-6">
                <h2 className="font-semibold mb-4">Properties</h2>
                <p className="text-sm text-muted-foreground">
                    Select an element to edit its properties
                </p>
            </div>
        )
    }

    const isText = selectedObject.type === 'i-text' || selectedObject.type === 'text'
    const isShape = selectedObject.type === 'rect' || selectedObject.type === 'circle' || selectedObject.type === 'triangle'

    return (
        <div className="w-80 border-l border-border bg-card p-6 overflow-auto">
            <h2 className="font-semibold mb-4">Properties</h2>
            <div className="text-xs text-muted-foreground mb-4">
                {selectedObject.type}
            </div>

            <div className="space-y-4">
                {/* Dynamic Field Mapping */}
                <div>
                    <label className="text-sm font-medium mb-2 block">Dynamic Field</label>
                    <select
                        value={properties.dynamicField}
                        onChange={(e) => handlePropertyChange('dynamicField', e.target.value as DynamicField)}
                        className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                    >
                        <option value="none">None (Static)</option>
                        <option value="title">Title</option>
                        <option value="date">Date</option>
                        <option value="description">Description</option>
                        <option value="category">Category</option>
                        <option value="author">Author</option>
                        <option value="image">Image (shapes only)</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                        Link this element to dynamic content from Bangladesh Guardian
                    </p>
                </div>

                {/* Fallback Value (when dynamic field is set) */}
                {properties.dynamicField !== 'none' && (
                    <div>
                        <label className="text-sm font-medium mb-2 block">Fallback Value</label>
                        <input
                            type="text"
                            value={properties.fallbackValue}
                            onChange={(e) => handlePropertyChange('fallbackValue', e.target.value)}
                            placeholder="Default value if dynamic data is unavailable"
                            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                        />
                    </div>
                )}

                {/* Layer Controls */}
                <div>
                    <label className="text-sm font-medium mb-2 block">Layer Order</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                if (canvas && selectedObject) {
                                    ;(canvas as any).sendObjectToBack(selectedObject)
                                    canvas.renderAll()
                                }
                            }}
                            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm flex items-center justify-center gap-1"
                        >
                            <span>To Back</span>
                        </button>
                        <button
                            onClick={() => {
                                if (canvas && selectedObject) {
                                    ;(canvas as any).sendObjectBackwards(selectedObject)
                                    canvas.renderAll()
                                }
                            }}
                            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm flex items-center justify-center gap-1"
                        >
                            <span>Backward</span>
                        </button>
                        <button
                            onClick={() => {
                                if (canvas && selectedObject) {
                                    ;(canvas as any).bringObjectForward(selectedObject)
                                    canvas.renderAll()
                                }
                            }}
                            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm flex items-center justify-center gap-1"
                        >
                            <span>Forward</span>
                        </button>
                        <button
                            onClick={() => {
                                if (canvas && selectedObject) {
                                    ;(canvas as any).bringObjectToFront(selectedObject)
                                    canvas.renderAll()
                                }
                            }}
                            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm flex items-center justify-center gap-1"
                        >
                            <span>To Front</span>
                        </button>
                    </div>
                </div>

                {/* Position */}
                <div>
                    <label className="text-sm font-medium mb-2 block">Position</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-muted-foreground">X</label>
                            <input
                                type="number"
                                value={properties.left}
                                onChange={(e) => handlePropertyChange('left', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Y</label>
                            <input
                                type="number"
                                value={properties.top}
                                onChange={(e) => handlePropertyChange('top', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Size (for shapes) */}
                {isShape && (
                    <div>
                        <label className="text-sm font-medium mb-2 block">Size</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-muted-foreground">Width</label>
                                <input
                                    type="number"
                                    value={properties.width}
                                    onChange={(e) => handlePropertyChange('width', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Height</label>
                                <input
                                    type="number"
                                    value={properties.height}
                                    onChange={(e) => handlePropertyChange('height', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Rotation */}
                <div>
                    <label className="text-sm font-medium mb-2 block">
                        Rotation: {properties.angle}°
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        value={properties.angle}
                        onChange={(e) => handlePropertyChange('angle', parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>

                {/* Opacity */}
                <div>
                    <label className="text-sm font-medium mb-2 block">
                        Opacity: {Math.round(properties.opacity * 100)}%
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={properties.opacity * 100}
                        onChange={(e) => handlePropertyChange('opacity', parseInt(e.target.value) / 100)}
                        className="w-full"
                    />
                </div>

                {/* Fill Color */}
                {(isShape || isText) && (
                    <div>
                        <label className="text-sm font-medium mb-2 block">Fill Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={properties.fill}
                                onChange={(e) => handlePropertyChange('fill', e.target.value)}
                                className="w-12 h-10 rounded cursor-pointer"
                            />
                            <input
                                type="text"
                                value={properties.fill}
                                onChange={(e) => handlePropertyChange('fill', e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono"
                            />
                        </div>
                    </div>
                )}

                {/* Stroke (for shapes) */}
                {isShape && (
                    <>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Stroke Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={properties.stroke}
                                    onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                                    className="w-12 h-10 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={properties.stroke}
                                    onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Stroke Width</label>
                            <input
                                type="number"
                                value={properties.strokeWidth}
                                onChange={(e) => handlePropertyChange('strokeWidth', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                            />
                        </div>
                    </>
                )}

                {/* Text properties */}
                {isText && (
                    <>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Width (for text wrapping)</label>
                            <input
                                type="number"
                                value={properties.width}
                                onChange={(e) => handlePropertyChange('width', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                                placeholder="Text wrap width"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Set width to enable text wrapping
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Font Size</label>
                            <input
                                type="number"
                                value={properties.fontSize}
                                onChange={(e) => handlePropertyChange('fontSize', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Font Family</label>
                            <select
                                value={properties.fontFamily}
                                onChange={(e) => handlePropertyChange('fontFamily', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                            >
                                <optgroup label="System Fonts">
                                    <option>Arial</option>
                                    <option>Helvetica</option>
                                    <option>Times New Roman</option>
                                    <option>Courier New</option>
                                    <option>Georgia</option>
                                    <option>Verdana</option>
                                </optgroup>
                                {customFonts.length > 0 && (
                                    <optgroup label="Custom Fonts">
                                        {customFonts.map((font) => (
                                            <option key={font.id} value={font.family}>
                                                {font.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                            
                            {!showFontUpload ? (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setShowFontUpload(true)}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <span>+ Upload Custom Font</span>
                                    </button>
                                    {uploadSuccess && (
                                        <div className="text-xs text-green-600 flex items-center gap-1">
                                            <span>✓ Font uploaded successfully!</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-2 p-3 bg-muted rounded-lg space-y-2 border border-border">
                                    <div className="text-xs font-medium text-muted-foreground">Upload .ttf font file</div>
                                    <input
                                        type="text"
                                        value={fontName}
                                        onChange={(e) => setFontName(e.target.value)}
                                        placeholder="Font display name"
                                        className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs"
                                    />
                                    <div className="relative">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".ttf"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file && fontName) {
                                                    handleFontUpload(file, fontName)
                                                }
                                            }}
                                            className="w-full text-xs file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                        />
                                    </div>
                                    {uploading && (
                                        <p className="text-xs text-muted-foreground">Uploading...</p>
                                    )}
                                    <button
                                        onClick={() => {
                                            setShowFontUpload(false)
                                            setFontName('')
                                        }}
                                        className="w-full px-2 py-1 text-xs bg-secondary rounded hover:bg-secondary/80"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Font Weight</label>
                            <select
                                value={properties.fontWeight}
                                onChange={(e) => handlePropertyChange('fontWeight', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                            >
                                <option value="normal">Normal</option>
                                <option value="bold">Bold</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Text Align</label>
                            <div className="flex gap-1 p-1 bg-input rounded-lg">
                                {['left', 'center', 'right'].map((align) => (
                                    <button
                                        key={align}
                                        onClick={() => handlePropertyChange('textAlign', align)}
                                        className={`flex-1 py-2 px-3 rounded text-sm capitalize transition-colors ${
                                            properties.textAlign === align
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                        }`}
                                    >
                                        {align}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
