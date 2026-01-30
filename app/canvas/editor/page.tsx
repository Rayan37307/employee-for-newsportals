'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

import { DashboardLayout } from '@/components/dashboard-layout'
import { CanvasEditor, useCanvas } from '@/components/canvas-editor'
import { PropertiesPanel } from '@/components/properties-panel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Type,
  Square,
  Image as ImageIcon,
  Download,
  Upload,
  Trash2,
  Save,
  Layers,
  ArrowDown,
  ArrowUp
} from 'lucide-react'
import { useFonts } from '@/hooks/use-fonts'

export default function CanvasEditorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
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
    sendBackward,
    bringForward,
    setBackgroundImage,
    clearBackgroundImage,
  } = useCanvas()

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [showBgImagePicker, setShowBgImagePicker] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [templateName, setTemplateName] = useState(canvasName)
  const [templateDescription, setTemplateDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [canvasWidth, setCanvasWidth] = useState(urlWidth)
  const [canvasHeight, setCanvasHeight] = useState(urlHeight)
  const [initialData, setInitialData] = useState<any>(null)
  const [dynamicDataValues, setDynamicDataValues] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)
  const { fonts, fetchFonts, uploadFont } = useFonts()

  // Load template if templateId is provided
  useEffect(() => {
    const loadTemplate = async () => {
      if (!templateId) {
        setLoading(false);
        return;
      }

      try {
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

          // Set canvas dimensions from template
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

  useEffect(() => {
    fetchFonts()
  }, [fetchFonts])

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

    try {
      await uploadFont(file, name)
      await fetchFonts()
    } catch (error) {
      console.error('Error uploading font:', error)
      alert('Failed to upload font')
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
        addImage(dataUrl);
        setShowImagePicker(false)
      }
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleBgImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (dataUrl && canvas) {
        setBackgroundImage(dataUrl)
        if (bgFileInputRef.current) {
          bgFileInputRef.current.value = ''
        }
      }
    }
    reader.readAsDataURL(file)
  }

  const handleClearBgImage = () => {
    if (canvas) {
      clearBackgroundImage()
    }
  }

  const handleExportImage = (dynamicData?: Record<string, any>) => {
    // Use the hook's exportToImage function which handles dynamic field replacement
    const dataUrl = exportToImage(dynamicData)
    if (dataUrl) {
      const link = document.createElement('a')
      link.download = 'news-card.png'
      link.href = dataUrl
      link.click()
    }
  }

  const handleDynamicDataChange = (field: string, value: string) => {
    setDynamicDataValues(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleExportWithData = () => {
    handleExportImage(dynamicDataValues)
    setShowExportModal(false)
    // Reset dynamic data values after export
    setDynamicDataValues({})
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

    if (!canvas) {
      alert('Canvas not ready')
      return
    }

    // Get canvas data using the hook's exportToJSON function which properly handles dynamic fields
    const canvasData = exportToJSON()
    if (!canvasData) {
      alert('Failed to get canvas data')
      return
    }
    canvasData.width = canvasWidth
    canvasData.height = canvasHeight

    // Generate thumbnail by exporting current canvas
    const thumbnail = canvas.toDataURL({ format: 'png', quality: 0.8 })

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
        setTemplateName(canvasName) // Reset to default name
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
          <button
            onClick={addText}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
            title="Add Text"
          >
            <Type className="w-5 h-5" />
            <span className="text-[10px] mt-1 group-hover:text-foreground">Text</span>
          </button>
          
          <button
            onClick={addRectangle}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
            title="Add Rectangle"
          >
            <Square className="w-5 h-5" />
            <span className="text-[10px] mt-1 group-hover:text-foreground">Rect</span>
          </button>
          
          <button
            onClick={addCircle}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
            title="Add Circle"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="8" strokeWidth="2" />
            </svg>
            <span className="text-[10px] mt-1 group-hover:text-foreground">Circle</span>
          </button>

          <Dialog open={showImagePicker} onOpenChange={setShowImagePicker}>
            <DialogTrigger asChild>
              <div>
                <button
                  className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
                  title="Add Image"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[10px] mt-1 group-hover:text-foreground">Image</span>
                </button>
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

          <Dialog open={showBgImagePicker} onOpenChange={setShowBgImagePicker}>
            <DialogTrigger asChild>
              <div>
                <button
                  className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
                  title="Set Background Image"
                  onClick={() => setShowBgImagePicker(true)}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[10px] mt-1 group-hover:text-foreground">BG</span>
                </button>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Set Background Image</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4">
                <div className="text-sm text-muted-foreground text-center">
                  Select an image to use as background.
                </div>
                <input
                  ref={bgFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBgImageUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => bgFileInputRef.current?.click()}
                  className="w-full"
                >
                  Choose Image File
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearBgImage}
                  className="w-full"
                >
                  Remove Background
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="h-px w-12 bg-border my-2" />

          <button
            onClick={deleteSelected}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
            title="Delete Selected"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-[10px] mt-1 group-hover:text-foreground">Delete</span>
          </button>
          
          <button
            onClick={clearCanvas}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
            title="Clear Canvas"
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px] mt-1 group-hover:text-foreground">Clear</span>
          </button>

          <div className="h-px w-12 bg-border my-2" />

          <button
            onClick={sendBackward}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
            title="Send Backward"
          >
            <ArrowDown className="w-5 h-5" />
            <span className="text-[10px] mt-1 group-hover:text-foreground">Back</span>
          </button>
          
          <button
            onClick={bringForward}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-muted transition-colors group"
            title="Bring Forward"
          >
            <ArrowUp className="w-5 h-5" />
            <span className="text-[10px] mt-1 group-hover:text-foreground">Front</span>
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Toolbar */}
          <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">{templateName}</h1>
              <span className="text-sm text-muted-foreground">{canvasWidth} × {canvasHeight}px</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Use the hook's exportToImage function which handles dynamic field replacement
                  const dataUrl = exportToImage()
                  if (dataUrl) {
                    const link = document.createElement('a')
                    link.download = 'canvas.png'
                    link.href = dataUrl
                    link.click()
                  }
                }}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PNG
              </button>
              
              <button
                onClick={() => {
                  if (canvas) {
                    const json = canvas.toJSON(['dynamicField', 'fallbackValue'])
                    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
                    const link = document.createElement('a')
                    link.download = 'template.json'
                    link.href = URL.createObjectURL(blob)
                    link.click()
                  }
                }}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Export JSON
              </button>
              
              <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export with Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>Export with Dynamic Data</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Enter values for dynamic fields to populate before exporting.
                    </div>

                    {canvas && (
                      <>
                        {canvas.getObjects().map((obj: any, index: number) => {
                          const dynamicField = obj.dynamicField
                          if (dynamicField && dynamicField !== 'none' && (obj.type === 'i-text' || obj.type === 'text')) {
                            return (
                              <div key={index} className="space-y-2">
                                <Label>
                                  {dynamicField.charAt(0).toUpperCase() + dynamicField.slice(1)}
                                  {dynamicField !== 'none' && obj.fallbackValue && ` (fallback: ${obj.fallbackValue})`}
                                </Label>
                                <Input
                                  value={dynamicDataValues[dynamicField] || ''}
                                  onChange={(e) => handleDynamicDataChange(dynamicField, e.target.value)}
                                  placeholder={`Enter ${dynamicField}...`}
                                />
                              </div>
                            )
                          }
                          return null
                        })}
                      </>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowExportModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleExportWithData}
                      >
                        Export with Data
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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
              customFonts={fonts}
              onCanvasReady={setCanvas}
            />
          </div>
        </div>

        {/* Right Properties Panel */}
        <PropertiesPanel 
          canvas={canvas}
          customFonts={fonts}
          onFontUpload={handleFontUpload}
        />
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
      )}
    </DashboardLayout>
  )
}