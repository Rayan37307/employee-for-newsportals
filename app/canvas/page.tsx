'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Plus,
    FileText,
    Eye,
    Settings,
    Clock
} from 'lucide-react'

interface Template {
    id: string
    name: string
    description: string | null
    category: string
    thumbnail: string | null
    isPublic: boolean
    isSystem: boolean
    createdAt: string
    user: {
        name: string | null
        email: string | null
    }
}

const canvasTemplates = [
    {
        id: 'square',
        name: 'Square (1:1)',
        description: 'Perfect for Instagram posts',
        ratio: '1:1',
        width: 1080,
        height: 1080,
        icon: '⬜'
    },
    {
        id: 'story',
        name: 'Story (9:16)',
        description: 'Ideal for Instagram/Facebook stories',
        ratio: '9:16',
        width: 1080,
        height: 1920,
        icon: '📱'
    },
    {
        id: 'landscape',
        name: 'Landscape (16:9)',
        description: 'Great for YouTube thumbnails',
        ratio: '16:9',
        width: 1920,
        height: 1080,
        icon: '📺'
    },
    {
        id: 'banner',
        name: 'Banner (3:1)',
        description: 'Perfect for website headers',
        ratio: '3:1',
        width: 1200,
        height: 400,
        icon: '🎨'
    }
]

export default function CanvasWelcomePage() {
    const router = useRouter()
    const [recentTemplates, setRecentTemplates] = useState<Template[]>([])
    const [loading, setLoading] = useState(true)
    const [showCustomDialog, setShowCustomDialog] = useState(false)
    const [customWidth, setCustomWidth] = useState('1200')
    const [customHeight, setCustomHeight] = useState('630')

    useEffect(() => {
        fetchRecentTemplates()
    }, [])

    const fetchRecentTemplates = async () => {
        try {
            const response = await fetch('/api/templates?limit=6')
            const data = await response.json()
            setRecentTemplates(data)
        } catch (error) {
            console.error('Error fetching recent templates:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateCanvas = (template: typeof canvasTemplates[0]) => {
        router.push(`/canvas/editor?width=${template.width}&height=${template.height}&name=${encodeURIComponent(template.name)}`)
    }

    const handleCreateCustomCanvas = () => {
        const width = parseInt(customWidth)
        const height = parseInt(customHeight)

        if (width < 100 || height < 100 || width > 4000 || height > 4000) {
            alert('Dimensions must be between 100 and 4000 pixels')
            return
        }

        router.push(`/canvas/editor?width=${width}&height=${height}&name=${encodeURIComponent('Custom Canvas')}`)
        setShowCustomDialog(false)
    }

    const handleEditTemplate = (template: Template) => {
        // For now, just create a new canvas with the template loaded
        // In the future, we can pass the template ID to load it
        router.push(`/canvas/editor?template=${template.id}&name=${encodeURIComponent(template.name)}`)
    }

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold mb-4">Create Your Canvas</h1>
                        <p className="text-xl text-muted-foreground">
                            Choose a template or create a custom canvas to design your news cards
                        </p>
                    </div>

                    {/* Canvas Templates */}
                    <div className="mb-16">
                        <h2 className="text-2xl font-semibold mb-8">Choose a Template</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {canvasTemplates.map((template) => (
                                <div
                                    key={template.id}
                                    className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                                    onClick={() => handleCreateCanvas(template)}
                                >
                                    <div className="text-4xl mb-4 text-center">{template.icon}</div>
                                    <h3 className="font-semibold mb-2">{template.name}</h3>
                                    <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                                    <div className="text-xs text-muted-foreground mb-4">
                                        {template.width} × {template.height}px ({template.ratio})
                                    </div>
                                    <Button className="w-full group-hover:bg-primary/90">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create
                                    </Button>
                                </div>
                            ))}

                            {/* Custom Size */}
                            <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
                                <DialogTrigger asChild>
                                    <div className="bg-card border-2 border-dashed border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[200px] group">
                                        <Settings className="w-12 h-12 text-muted-foreground mb-4 group-hover:text-primary" />
                                        <h3 className="font-semibold mb-2">Custom Size</h3>
                                        <p className="text-sm text-muted-foreground text-center">Create a canvas with your own dimensions</p>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Custom Canvas Size</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="width">Width (px)</Label>
                                                <Input
                                                    id="width"
                                                    type="number"
                                                    value={customWidth}
                                                    onChange={(e) => setCustomWidth(e.target.value)}
                                                    min="100"
                                                    max="4000"
                                                    placeholder="1200"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="height">Height (px)</Label>
                                                <Input
                                                    id="height"
                                                    type="number"
                                                    value={customHeight}
                                                    onChange={(e) => setCustomHeight(e.target.value)}
                                                    min="100"
                                                    max="4000"
                                                    placeholder="630"
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={handleCreateCustomCanvas} className="w-full">
                                            Create Custom Canvas
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    {/* Recent Works */}
                    <div>
                        <div className="flex items-center gap-2 mb-8">
                            <Clock className="w-6 h-6" />
                            <h2 className="text-2xl font-semibold">Recent Templates</h2>
                        </div>

                        {loading ? (
                            <div className="text-center py-12 text-muted-foreground">
                                Loading recent templates...
                            </div>
                        ) : recentTemplates.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
                                <p className="text-muted-foreground mb-6">
                                    Create your first template to see it here
                                </p>
                                <Button onClick={() => router.push('/canvas/editor')}>
                                    Create Template
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {recentTemplates.map((template) => (
                                    <div
                                        key={template.id}
                                        className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                                    >
                                        {/* Thumbnail */}
                                        <div className="aspect-video bg-muted flex items-center justify-center relative">
                                            {template.thumbnail ? (
                                                <img
                                                    src={template.thumbnail}
                                                    alt={template.name}
                                                    className="w-full h-full object-cover"
                                                    width={300}
                                                    height={200}
                                                />
                                            ) : (
                                                <FileText className="w-16 h-16 text-muted-foreground" />
                                            )}

                                            {/* Overlay on hover */}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleEditTemplate(template)}
                                                >
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    Open
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold truncate">{template.name}</h3>
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {template.description || 'No description'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                                        {template.category.replace('_', ' ')}
                                                    </span>
                                                    {template.isSystem && (
                                                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500">
                                                            System
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(template.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}