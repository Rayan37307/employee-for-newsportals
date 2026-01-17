'use client'

import React, { useState, useRef, Suspense } from 'react'
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
    const width = parseInt(searchParams.get('width') || '1200')
    const height = parseInt(searchParams.get('height') || '630')
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
    } = useCanvas()

    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showImagePicker, setShowImagePicker] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [templateDescription, setTemplateDescription] = useState('')
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }

        // Validate file size (max 5MB)
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

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
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
                            <h1 className="text-lg font-semibold">{canvasName}</h1>
                            <span className="text-sm text-muted-foreground">{width} × {height}px</span>
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
                            width={width}
                            height={height}
                            initialData={templateId ? undefined : undefined} // TODO: Load template data if templateId exists
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
                        </div>

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="flex-1 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTemplate}
                                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

export default function CanvasEditorPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading canvas...</div>}>
            <CanvasEditorContent />
        </Suspense>
    )
}

function ToolButton({
    icon,
    label,
    onClick
}: {
    icon: React.ReactNode
    label: string
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="w-14 h-14 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors flex flex-col items-center justify-center gap-1 group"
            title={label}
        >
            {icon}
            <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {label}
            </span>
        </button>
    )
}