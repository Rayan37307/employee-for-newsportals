'use client'

import { CanvasEditor } from './canvas-editor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import * as fabric from 'fabric'

interface PreviewModalProps {
    isOpen: boolean
    onClose: () => void
    template: any
    mapping: any
    rssItem: any
    socialCaptionField?: string
}

export function PreviewModal({ isOpen, onClose, template, mapping, rssItem, socialCaptionField }: PreviewModalProps) {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null)
    const [generatedCaption, setGeneratedCaption] = useState('')

    // Generate caption when inputs change
    useEffect(() => {
        if (rssItem && socialCaptionField && rssItem[socialCaptionField]) {
            setGeneratedCaption(String(rssItem[socialCaptionField]))
        } else {
            setGeneratedCaption('')
        }
    }, [rssItem, socialCaptionField])

    const getCanvasData = () => {
        if (!template || !template.canvasData) return null
        let canvasData = template.canvasData
        if (typeof canvasData === 'string') {
            try {
                canvasData = JSON.parse(canvasData)
            } catch (e) {
                console.error('Failed to parse (Preview)', e)
                return null
            }
        }
        return canvasData
    }

    const handleCanvasReady = (loadedCanvas: fabric.Canvas) => {
        setCanvas(loadedCanvas)

        try {
            // Apply Mappings
            const objects = loadedCanvas.getObjects()
            console.log('Preview: applying mappings to', objects.length, 'objects')

            objects.forEach((obj, idx) => {
                const mappedField = mapping[idx]
                if (mappedField && rssItem && rssItem[mappedField]) {
                    const newValue = String(rssItem[mappedField])

                    // Text objects
                    if (obj.type && obj.type.toLowerCase().includes('text')) {
                        // @ts-ignore
                        obj.set('text', newValue)
                    }
                }
            })

            loadedCanvas.requestRenderAll()
        } catch (error) {
            console.error('Error rendering preview:', error)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-[90vw] h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Preview Generated Card</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-6">
                    {/* Visual Card Preview */}
                    <div className="border rounded-lg overflow-hidden bg-gray-100 flex justify-center items-center p-4">
                        <div className="scale-75 origin-top">
                            <CanvasEditor
                                width={1200}
                                height={630}
                                readOnly={true}
                                initialData={getCanvasData()}
                                onCanvasReady={handleCanvasReady}
                            />
                        </div>
                    </div>

                    {/* Social Post Preview */}
                    <div className="bg-card border rounded-lg p-4">
                        <h3 className="font-semibold mb-2 text-sm text-muted-foreground">Social Application Post Preview</h3>
                        <div className="p-4 bg-muted/30 rounded border border-dashed border-border">
                            <div className="text-sm font-medium mb-1">
                                {rssItem?.title || 'No Title'}
                            </div>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {generatedCaption || 'No caption configured'}
                            </div>
                            {/* Simulated link preview card usually shown on social media */}
                            <div className="mt-3 border rounded bg-white overflow-hidden max-w-sm opacity-60">
                                <div className="h-32 bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                    [Generated Image Will Be Here]
                                </div>
                                <div className="p-2 text-xs">
                                    <div className="font-bold truncate">{rssItem?.title}</div>
                                    <div className="text-gray-500 truncate">{rssItem?.link}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
