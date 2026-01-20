'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { DashboardLayout } from '@/components/dashboard-layout'
import { CanvasEditor, useCanvas } from '@/components/canvas-editor'
import { PropertiesPanel } from '@/components/properties-panel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
    Type,
    Square,
    Circle,
    Image as ImageIcon,
    Download,
    Upload,
    Trash2,
    Save,
    Layers
} from 'lucide-react'

function CanvasEditorContent() {
    const searchParams = useSearchParams()
    const urlWidth = parseInt(searchParams.get('width') || '1200')
    const urlHeight = parseInt(searchParams.get('height') || '630')
    const canvasName = searchParams.get('name') || 'Canvas'
    const templateId = searchParams.get('template')

    const {
        canvas,
        setCanvas,
        addText,
        addRectangle,
        addCircle,
        addImage,
        deleteSelected,
        clearCanvas,
        exportToImage,
        exportToJSON,
        loadFromJSON,
    } = useCanvas()

    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showImagePicker, setShowImagePicker] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [templateDescription, setTemplateDescription] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [canvasWidth, setCanvasWidth] = useState(urlWidth)
    const [canvasHeight, setCanvasHeight] = useState(urlHeight)
    const [initialData, setInitialData] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load template if templateId is provided
    useEffect(() => {
        const loadTemplate = async () => {
            if (!templateId) return

            try {
                setLoading(true)
                const response = await fetch(`/api/templates/${templateId}`)
                if (response.ok) {
                    const template = await response.json()
                    
                    // Parse canvasData
                    let canvasData = template.canvasData
                    if (typeof canvasData === 'string') {
                        canvasData = JSON.parse(canvasData)
                    }

                    // Extract canvas dimensions from template
                    const templateWidth = canvasData.width || urlWidth
                    const templateHeight = canvasData.height || urlHeight

                    // Set canvas dimensions from template (before setting initialData)
                    setCanvasWidth(templateWidth)
                    setCanvasHeight(templateHeight)
                    
                    // Update URL with correct dimensions
                    const newUrl = new URL(window.location.href)
                    newUrl.searchParams.set('width', String(templateWidth))
                    newUrl.searchParams.set('height', String(templateHeight))
                    window.history.replaceState({}, '', newUrl.toString())

                    // Set initial data for canvas
                    setInitialData(canvasData)
                    setTemplateName(template.name)
                    setTemplateDescription(template.description || '')
                }
            } catch (error) {
                console.error('Error loading template:', error)
                alert('Failed to load template')
            } finally {
                setLoading(false)
            }
        }

        loadTemplate()
    }, [templateId])

    const handleExportImage = () => {
        const dataUrl = exportToImage()
        if (dataUrl) {
            const link = document.createElement('a')
            link.download = 'news-card.png'
            link.href = dataUrl
            link.click()
        }
    }

    const handleExportJSON = () => {
        const json = exportToJSON()
        if (json) {
            const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
            const link = document.createElement('a')
            link.download = 'template.json'
            link.href = URL.createObjectURL(blob)
            link.click()
        }
    }

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            alert('Please enter a template name')
            return
        }

        const canvasData = exportToJSON()
        if (!canvasData) {
            alert('No canvas data to save')
            return
        }

        // Ensure width and height are in the saved data
        // Use the actual canvas dimensions
        const actualWidth = canvas ? (canvas.getWidth ? canvas.getWidth() : canvasWidth) : canvasWidth
        const actualHeight = canvas ? (canvas.getHeight ? canvas.getHeight() : canvasHeight) : canvasHeight
        
        canvasData.width = actualWidth
        canvasData.height = actualHeight

        const thumbnail = exportToImage()

        try {
            setSaving(true)
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: templateName,
                    description: templateDescription,
                    category: 'CUSTOM',
                    canvasData,
                    thumbnail,
                    isPublic: false,
                }),
            })

            if (response.ok) {
                alert('Template saved successfully!')
                setShowSaveModal(false)
                setTemplateName('')
                setTemplateDescription('')
            } else {
                const error = await response.json()
                alert(`Failed to save template: ${error.error}`)
            }
        } catch (error) {
            console.error('Error saving template:', error)
            alert('Failed to save template')
        } finally {
            setSaving(false)
        }
    }

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB')
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string
            if (dataUrl) {
                addImage(dataUrl)
                setShowImagePicker(false)
            }
        }
        reader.readAsDataURL(file)

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p>Loading template...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="flex h-full">
                {/* Left Toolbar */}
                <div className="w-20 border-r border-border bg-card flex flex-col items-center gap-2 py-4">
                    <ToolButton
                        icon={<Type className="w-5 h-5" />}
                        label="Text"
                        onClick={() => addText()}
                    />
                    <ToolButton
                        icon={<Square className="w-5 h-5" />}
                        label="Rectangle"
                        onClick={() => addRectangle()}
                    />
                    <ToolButton
                        icon={<Circle className="w-5 h-5" />}
                        label="Circle"
                        onClick={() => addCircle()}
                    />
                    <Dialog open={showImagePicker} onOpenChange={setShowImagePicker}>
                        <DialogTrigger asChild>
                            <div>
                                <ToolButton
                                    icon={<ImageIcon className="w-5 h-5" />}
                                    label="Image"
                                    onClick={() => setShowImagePicker(true)}
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Upload Image</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center gap-4">
                                <div className="text-sm text-muted-foreground text-center">
                                    Select an image file to add to your canvas. Maximum size: 5MB.
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full"
                                >
                                    Choose Image File
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <div className="h-px w-12 bg-border my-2" />

                    <ToolButton
                        icon={<Trash2 className="w-5 h-5" />}
                        label="Delete"
                        onClick={() => deleteSelected()}
                    />
                    <ToolButton
                        icon={<Layers className="w-5 h-5" />}
                        label="Clear"
                        onClick={() => {
                            if (confirm('Clear entire canvas?')) {
                                clearCanvas()
                            }
                        }}
                    />
                </div>

                {/* Canvas Area */}
                <div className="flex-1 flex flex-col">
                    {/* Top Toolbar */}
                    <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h1 className="text-lg font-semibold">{templateName || canvasName}</h1>
                            <span className="text-sm text-muted-foreground">{canvasWidth} × {canvasHeight}px</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportJSON}
                                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Export JSON
                            </button>
                            <button
                                onClick={handleExportImage}
                                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Export PNG
                            </button>
                            <button
                                onClick={() => setShowSaveModal(true)}
                                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save Template
                            </button>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 p-8 overflow-auto flex items-center justify-center">
                        <CanvasEditor
                            width={canvasWidth}
                            height={canvasHeight}
                            initialData={initialData}
                            onCanvasReady={setCanvas}
                        />
                    </div>
                </div>

                {/* Right Properties Panel */}
                <PropertiesPanel canvas={canvas} />
            </div>

            {/* Save Template Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-semibold mb-4">Save Template</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Template Name</label>
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="Enter template name"
                                    className="w-full px-3 py-2 rounded-lg bg-input border border-border"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                                <textarea
                                    value={templateDescription}
                                    onChange={(e) => setTemplateDescription(e.target.value)}
                                    placeholder="Enter description"
                                    className="w-full px-3 py-2 rounded-lg bg-input border border-border"
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowSaveModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveTemplate}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Template'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors"
            title={label}
        >
            {icon}
            <span className="text-[10px] mt-1">{label}</span>
        </button>
    )
}

export default function CanvasEditorPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p>Loading editor...</p>
                    </div>
                </div>
            </DashboardLayout>
        }>
            <CanvasEditorContent />
        </Suspense>
    )
}
