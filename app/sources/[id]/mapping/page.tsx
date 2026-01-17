'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Database, Layout } from 'lucide-react'
import { PreviewModal } from '@/components/preview-modal'

// Types
interface NewsSource {
    id: string
    name: string
    config: any
}

interface Template {
    id: string
    name: string
    thumbnail: string | null
    canvasData: any
}

interface Mapping {
    [templateObjectId: string]: string // Maps to 'title', 'description', 'link', 'image', 'pubDate'
}

export default function MappingPage({ params }: { params: Promise<{ id: string }> }) {
    // Unwrap params using use() hook for Next.js 15+ compatibility
    const resolvedParams = use(params)
    const sourceId = resolvedParams.id

    const router = useRouter()

    const [source, setSource] = useState<NewsSource | null>(null)
    const [templates, setTemplates] = useState<Template[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [latestItem, setLatestItem] = useState<any>(null)
    const [mapping, setMapping] = useState<Mapping>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    // RSS Fields available to map
    const rssFields = ['title', 'content', 'contentSnippet', 'link', 'pubDate', 'isoDate']

    useEffect(() => {
        loadData()
    }, [sourceId])

    const loadData = async () => {
        try {
            // 1. Fetch Source Details
            const sourceRes = await fetch(`/api/sources?id=${sourceId}`) // Quick list filter? Or specific endpoint?
            // Actually my GET /api/sources list all. Let's filter or fetch specific if I had endpoint.
            // I don't have GET /api/sources/[id] yet? I have DELETE.
            // Let's just fetch all and find (inefficient but valid for MVP)
            const allSources = await (await fetch('/api/sources')).json()
            const foundSource = allSources.find((s: any) => s.id === sourceId)
            setSource(foundSource)

            // 2. Fetch Latest RSS Item
            const fetchRes = await fetch(`/api/sources/${sourceId}/fetch`, { method: 'POST' })
            if (fetchRes.ok) {
                const fetchData = await fetchRes.json()
                if (fetchData.items && fetchData.items.length > 0) {
                    setLatestItem(fetchData.items[0])
                }
            }

            // 3. Fetch Templates
            const templatesRes = await fetch('/api/templates')
            const templatesData = await templatesRes.json()
            setTemplates(templatesData)

        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleTemplateSelect = async (template: Template) => {
        setSelectedTemplate(template)
        // Try to load existing mapping
        const res = await fetch(`/api/mappings?sourceId=${sourceId}&templateId=${template.id}`)
        const savedMappings = await res.json()
        if (savedMappings.length > 0) {
            setMapping(savedMappings[0].sourceFields)
        } else {
            setMapping({})
        }
    }

    const handleSave = async () => {
        if (!selectedTemplate) return
        setSaving(true)
        try {
            const res = await fetch('/api/mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceId,
                    templateId: selectedTemplate.id,
                    mappings: mapping
                })
            })
            if (res.ok) {
                alert('Mapping saved!')
            } else {
                alert('Failed to save')
            }
        } finally {
            setSaving(false)
        }
    }

    // Extract text and image objects from canvas JSON
    const getCanvasObjects = () => {
        if (!selectedTemplate) return []

        let data = selectedTemplate.canvasData
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data)
            } catch (e) {
                console.error('Failed to parse canvasData', e)
                return []
            }
        }

        const objects = data?.objects || []
        // Debug log
        console.log('Canvas Objects types:', objects.map((o: any) => o.type))

        const allowedTypes = ['i-text', 'text', 'textbox', 'image', 'rect', 'IText', 'Text', 'Textbox', 'Image', 'Rect']
        return objects.filter((o: any) => allowedTypes.includes(o.type) || allowedTypes.includes(o.type?.toLowerCase()))
    }

    if (loading) return <div className="p-8">Loading...</div>

    const mappableObjects = getCanvasObjects()

    return (
        <DashboardLayout>
            <div className="flex flex-col h-screen">
                {/* Header */}
                <div className="border-b border-border p-4 bg-card flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold flex items-center gap-2">
                                <Database className="w-4 h-4 text-blue-500" />
                                {source?.name}
                                <span className="text-muted-foreground">→</span>
                                Data Mapping
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPreviewOpen(true)}
                            disabled={!selectedTemplate || !latestItem}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 hover:bg-blue-700"
                        >
                            <Layout className="w-4 h-4" />
                            Generate Preview
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!selectedTemplate || saving}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Mapping'}
                        </button>
                    </div>
                </div>

                {/* Preview Modal */}
                <PreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    template={selectedTemplate}
                    mapping={mapping}
                    rssItem={latestItem}
                    socialCaptionField={mapping['_social_caption_field']}
                />

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Template Selection & Preview */}
                    <div className="w-1/3 border-r border-border p-4 overflow-y-auto bg-muted/10">
                        <h2 className="font-semibold mb-4 flex items-center gap-2">
                            <Layout className="w-4 h-4" /> Select Template
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {templates.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleTemplateSelect(t)}
                                    className={`cursor-pointer border rounded-lg overflow-hidden transition-all ${selectedTemplate?.id === t.id ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-primary/50'}`}
                                >
                                    <div className="aspect-video bg-white relative">
                                        {t.thumbnail && <img src={t.thumbnail} className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="p-2 text-xs font-medium truncate">{t.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Middle: Mapping Editor */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {!selectedTemplate ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Select a template to begin mapping
                            </div>
                        ) : (
                            <div className="max-w-xl mx-auto">
                                <h2 className="text-xl font-bold mb-6">Map Fields</h2>

                                {/* Debug Info */}
                                <div className="mb-4 p-2 bg-yellow-100 dark:bg-yellow-900/20 text-xs rounded font-mono">
                                    Debug: Found {mappableObjects.length} mappable objects from {mappableObjects.length} total.
                                </div>

                                <div className="space-y-6">
                                    {mappableObjects.map((obj: any, idx: number) => {
                                        // Simple auto-identifier if no ID
                                        const objName = obj.id || `${obj.type} #${idx + 1}`
                                        const objText = obj.text ? `"${obj.text.substring(0, 20)}..."` : ''

                                        return (
                                            <div key={idx} className="bg-card border border-border rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 rounded bg-muted text-xs font-mono">{obj.type}</span>
                                                        <span className="font-medium">{objName}</span>
                                                        {objText && <span className="text-xs text-muted-foreground">{objText}</span>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm text-muted-foreground">Map to:</span>
                                                    <select
                                                        className="flex-1 px-3 py-2 rounded-md bg-input border border-border"
                                                        value={mapping[idx] || ''}
                                                        onChange={(e) => setMapping(prev => ({ ...prev, [idx]: e.target.value }))}
                                                    >
                                                        <option value="">-- Static (No Mapping) --</option>
                                                        {rssFields.map(field => (
                                                            <option key={field} value={field}>RSS Item: {field}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Preview Value */}
                                                {mapping[idx] && latestItem && (
                                                    <div className="mt-2 text-xs text-blue-500 bg-blue-500/10 p-2 rounded">
                                                        Preview: {String(latestItem[mapping[idx]])?.substring(0, 50)}...
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="mt-12 pt-8 border-t border-border">
                                    <h2 className="text-xl font-bold mb-6">Social Post Configuration</h2>
                                    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Post Caption</label>
                                            <div className="flex gap-2 mb-2">
                                                <select
                                                    className="flex-1 px-3 py-2 rounded-md bg-input border border-border"
                                                    value={mapping['_social_caption_field'] || ''}
                                                    onChange={(e) => setMapping(prev => ({ ...prev, '_social_caption_field': e.target.value }))}
                                                >
                                                    <option value="">-- Select Field for Caption --</option>
                                                    {rssFields.map(field => (
                                                        <option key={field} value={field}>RSS Item: {field}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                This field will be used as the caption when posting to social media.
                                                {latestItem && mapping['_social_caption_field'] && (
                                                    <span className="block mt-1 text-blue-500">
                                                        Preview: {String(latestItem[mapping['_social_caption_field']])?.substring(0, 100)}...
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Source Data Debug */}
                    <div className="w-1/4 border-l border-border p-4 text-xs font-mono overflow-y-auto bg-black text-green-400">
                        <h3 className="text-white font-sans font-semibold mb-2">Latest RSS Item</h3>
                        <pre className="whitespace-pre-wrap">
                            {latestItem ? JSON.stringify(latestItem, null, 2) : 'No data fetched'}
                        </pre>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
