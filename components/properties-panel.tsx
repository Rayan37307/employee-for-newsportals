'use client'

import { useEffect, useState } from 'react'
import * as fabric from 'fabric'
import { DynamicField } from './canvas-editor'

interface PropertiesPanelProps {
    canvas: fabric.Canvas | null
}

export function PropertiesPanel({ canvas }: PropertiesPanelProps) {
    const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null)
    const [properties, setProperties] = useState({
        left: 0,
        top: 0,
        width: 0,
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

    const updateProperties = (obj: fabric.FabricObject) => {
        const newProps: any = {
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
        }

        setProperties(prev => ({ ...prev, ...newProps }))
    }

    const handlePropertyChange = (key: string, value: any) => {
        if (!selectedObject || !canvas) return

        const updates: any = { [key]: value }

        // Handle scaled dimensions
        if (key === 'width' && selectedObject.scaleX) {
            const origWidth = selectedObject.width || 0
            updates.scaleX = value / origWidth
        } else if (key === 'height' && selectedObject.scaleY) {
            const origHeight = selectedObject.height || 0
            updates.scaleY = value / origHeight
        }

        // Handle dynamic field assignment
        if (key === 'dynamicField') {
            (selectedObject as any).dynamicField = value;
        }

        if (key === 'fallbackValue') {
            (selectedObject as any).fallbackValue = value;
        }

        selectedObject.set(updates)
        canvas.renderAll()
        updateProperties(selectedObject)
    }

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
                                <option>Arial</option>
                                <option>Helvetica</option>
                                <option>Times New Roman</option>
                                <option>Courier New</option>
                                <option>Georgia</option>
                                <option>Verdana</option>
                            </select>
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
                            <select
                                value={properties.textAlign}
                                onChange={(e) => handlePropertyChange('textAlign', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                            >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
