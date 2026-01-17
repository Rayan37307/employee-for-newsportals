'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useEffect, useState } from 'react'
import { Plus, FileText, Eye, Trash2, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

const categories = [
    { value: 'ALL', label: 'All Templates' },
    { value: 'BREAKING_NEWS', label: 'Breaking News' },
    { value: 'ANALYSIS', label: 'Analysis' },
    { value: 'OPINION', label: 'Opinion' },
    { value: 'PHOTO_STORY', label: 'Photo Story' },
    { value: 'INFOGRAPHIC', label: 'Infographic' },
    { value: 'QUOTE', label: 'Quote' },
    { value: 'CUSTOM', label: 'Custom' },
]

export default function TemplatesPage() {
    const router = useRouter()
    const [templates, setTemplates] = useState<Template[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState('ALL')
    const [showPublicOnly, setShowPublicOnly] = useState(false)

    useEffect(() => {
        fetchTemplates()
    }, [selectedCategory, showPublicOnly])

    const fetchTemplates = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (selectedCategory !== 'ALL') {
                params.append('category', selectedCategory)
            }
            if (showPublicOnly) {
                params.append('public', 'true')
            }

            const response = await fetch(`/api/templates?${params}`)
            const data = await response.json()
            setTemplates(data)
        } catch (error) {
            console.error('Error fetching templates:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return

        try {
            const response = await fetch(`/api/templates/${id}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                fetchTemplates()
            } else {
                alert('Failed to delete template')
            }
        } catch (error) {
            console.error('Error deleting template:', error)
            alert('Failed to delete template')
        }
    }

    const handleDuplicate = async (id: string) => {
        // TODO: Implement template duplication
        alert('Duplicate functionality coming soon')
    }

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold">Templates</h1>
                            <p className="text-muted-foreground mt-2">
                                Browse and manage your news card templates
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/canvas')}
                            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Create Template
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-4 mb-8">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-4 py-2 rounded-lg bg-card border border-border"
                        >
                            {categories.map((cat) => (
                                <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                </option>
                            ))}
                        </select>

                        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showPublicOnly}
                                onChange={(e) => setShowPublicOnly(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm">Public templates only</span>
                        </label>
                    </div>

                    {/* Templates Grid */}
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Loading templates...
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                            <p className="text-muted-foreground mb-6">
                                Create your first template to get started
                            </p>
                            <button
                                onClick={() => router.push('/canvas')}
                                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Create Template
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map((template) => (
                                <TemplateCard
                                    key={template.id}
                                    template={template}
                                    onDelete={handleDelete}
                                    onDuplicate={handleDuplicate}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}

function TemplateCard({
    template,
    onDelete,
    onDuplicate,
}: {
    template: Template
    onDelete: (id: string) => void
    onDuplicate: (id: string) => void
}) {
    const router = useRouter()

    return (
        <div className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group">
            {/* Thumbnail */}
            <div className="aspect-video bg-muted flex items-center justify-center relative">
                {template.thumbnail ? (
                    <img
                        src={template.thumbnail}
                        alt={template.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <FileText className="w-16 h-16 text-muted-foreground" />
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                        onClick={() => router.push(`/canvas?template=${template.id}`)}
                        className="px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition-colors flex items-center gap-2"
                    >
                        <Eye className="w-4 h-4" />
                        Use Template
                    </button>
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
                        {template.isPublic && (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
                                Public
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onDuplicate(template.id)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Duplicate"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        {!template.isSystem && (
                            <button
                                onClick={() => onDelete(template.id)}
                                className="p-2 rounded-lg hover:bg-error/10 hover:text-error transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="text-xs text-muted-foreground mt-2">
                    By {template.user.name || template.user.email}
                </div>
            </div>
        </div>
    )
}
