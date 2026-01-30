'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CanvasEditor as FabricCanvasEditor, useCanvas as useFabricCanvas } from '@/components/fabric-canvas-editor'
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
    const [isReady, setIsReady] = useState(false)
    const isMounted = useRef(true)
    const containerRef = useRef<HTMLDivElement>(null)

    return (
        <div ref={containerRef} className="relative bg-muted rounded-lg p-8 overflow-auto">
            <div className="inline-block shadow-xl">
                <FabricCanvasEditor
                    width={width}
                    height={height}
                    readOnly={readOnly}
                    initialData={initialData}
                    customFonts={customFonts}
                    onCanvasReady={(canvas) => {
                        if (onCanvasReady && isMounted.current) {
                            onCanvasReady(canvas);
                        }
                        setIsReady(true);
                    }}
                />
            </div>
        </div>
    )
}

export { useCanvas } from './fabric-canvas-editor';

