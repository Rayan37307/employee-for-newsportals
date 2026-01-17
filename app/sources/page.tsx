'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useState, useEffect } from 'react'
import { Plus, Rss, Globe, Trash2, RefreshCw, AlertCircle, CheckCircle2, Database } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NewsSource {
    id: string
    name: string
    type: 'RSS' | 'API' | 'MANUAL' | 'AUTO'
    config: any
    enabled: boolean
    lastFetchedAt: string | null
    lastError: string | null
    createdAt: string
}

export default function SourcesPage() {
    const [sources, setSources] = useState<NewsSource[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // New Source Form State
    const [newSourceName, setNewSourceName] = useState('')
    const [newSourceType, setNewSourceType] = useState<'RSS' | 'API' | 'MANUAL' | 'AUTO'>('AUTO')
    const [newSourceUrl, setNewSourceUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        checkAuth()
        fetchSources()
    }, [])

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/session')
            const data = await res.json()
            setIsAuthenticated(!!data?.user?.email)
        } catch (error) {
            setIsAuthenticated(false)
        }
    }

    const fetchSources = async () => {
        try {
            const res = await fetch('/api/sources')
            if (res.ok) {
                const data = await res.json()
                setSources(data)
            }
        } catch (error) {
            console.error('Failed to fetch sources', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddSource = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const res = await fetch('/api/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSourceName,
                    type: newSourceType,
                    url: newSourceUrl,
                }),
            })

            if (res.status === 401) {
                // Redirect to sign in
                window.location.href = `/auth/signin?callbackUrl=${window.location.pathname}`
                return
            }

            if (res.ok) {
                setShowAddModal(false)
                setNewSourceName('')
                setNewSourceType('AUTO')
                setNewSourceUrl('')
                await fetchSources()
                // Force a small delay and refetch again to ensure data is loaded
                setTimeout(() => fetchSources(), 500)
            } else {
                const data = await res.json()
                setErrorMessage(data.error || data.details || 'Failed to create source')
            }
        } catch (error) {
            console.error(error)
            setErrorMessage('An error occurred')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this source?")) return
        try {
            const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchSources()
            } else {
                alert('Failed to delete source')
            }
        } catch (error) {
            console.error(error)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await fetch(`/api/sources/${id}/fetch`, { method: 'DELETE' }) // Using the fetch route for delete for simplicity if I put DELETE there, wait, I put DELETE in [id]/fetch/route.ts? No, that's wrong. Let me fix the API structure mentally. 
        // Actually standard REST would be DELETE /api/sources/[id]. 
        // My previous write had DELETE in `/api/sources/[id]/fetch/route.ts` which is quirky.
        // I should fix that separation. But for now let's assume I fix it or use it as is.
        // Let's verify where I wrote the DELETE handler.
        // Ah, I wrote it in app/api/sources/[id]/fetch/route.ts. 
        // That URI is `.../fetch`. So DELETE `.../fetch` would work but it is semantic non-sense.
        // I'll fix the backend file location in a moment.

        // For now let's correct the frontend to point to what I will fix.
        await fetch(`/api/sources/${id}`, { method: 'DELETE' })
        fetchSources()
    }
        await fetch(`/api/sources/${id}`, { method: 'DELETE' })
        fetchSources()
    }

    const handleFetchNow = async (id: string) => {
        // Optimistic update or loading state could go here
        const res = await fetch(`/api/sources/${id}/fetch`, { method: 'POST' })
        if (res.ok) {
            const data = await res.json()
            alert(`Fetched ${data.items.length} items successfully!`)
            fetchSources()
        } else {
            alert("Fetch failed")
        }
    }

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">News Sources</h1>
                        <p className="text-muted-foreground mt-2">Manage your automated news sources</p>
                    </div>
                    <button
                        onClick={() => {
                            if (!isAuthenticated) {
                                window.location.href = `/auth/signin?callbackUrl=${window.location.pathname}`
                            } else {
                                setShowAddModal(true)
                                setErrorMessage(null)
                            }
                        }}
                        className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        {isAuthenticated ? 'Add Source' : 'Sign In to Add Source'}
                    </button>
                </div>

                {loading ? (
                    <div>Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sources.map((source) => (
                            <div key={source.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                            {source.type === 'AUTO' ? <Globe className="w-5 h-5" /> : <Rss className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{source.name}</h3>
                                            <p className="text-xs text-muted-foreground capitalize">
                                                {source.type === 'AUTO' ? 'Auto-Detection' : `${source.type} Feed`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${source.lastError ? 'bg-red-500' : 'bg-green-500'}`} />
                                </div>

                                <div className="text-sm text-muted-foreground break-all mb-4">
                                    {source.config?.url}
                                </div>

                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                                    <div className="text-xs text-muted-foreground">
                                        {source.lastFetchedAt ? (
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                {new Date(source.lastFetchedAt).toLocaleTimeString()}
                                            </span>
                                        ) : 'Never fetched'}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleFetchNow(source.id)} className="p-2 rounded-md hover:bg-muted" title="Fetch Now">
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(source.id)} className="p-2 rounded-md hover:bg-red-500/10 text-red-500" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <a href={`/sources/${source.id}/mapping`} className="p-2 rounded-md hover:bg-muted text-blue-500" title="Map Data">
                                            <Database className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Source Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-card p-6 rounded-lg w-full max-w-md border border-border">
                            {!isAuthenticated ? (
                                <>
                                    <h2 className="text-xl font-bold mb-4">Sign In Required</h2>
                                    <p className="text-muted-foreground mb-6">
                                        You need to sign in to create news sources.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowAddModal(false)}
                                            className="flex-1 px-4 py-2 text-sm hover:underline"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => window.location.href = `/auth/signin?callbackUrl=${window.location.pathname}`}
                                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                                        >
                                            Sign In
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-xl font-bold mb-4">Add News Source</h2>
                                    <form onSubmit={handleAddSource}>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Source Type</label>
                                                <Select value={newSourceType} onValueChange={(value: any) => setNewSourceType(value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select source type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="AUTO">Auto-Detection</SelectItem>
                                                        <SelectItem value="RSS">RSS Feed</SelectItem>
                                                        <SelectItem value="API">API Endpoint</SelectItem>
                                                        <SelectItem value="MANUAL">Manual Entry</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Source Name</label>
                                        <input
                                            required
                                            value={newSourceName}
                                            onChange={e => setNewSourceName(e.target.value)}
                                            className="w-full px-3 py-2 rounded-md bg-input border border-border"
                                            placeholder="e.g. BBC Technology"
                                        />
                                    </div>
                                    {errorMessage && (
                                        <div className="p-3 rounded-md bg-red-500/10 text-red-500 text-sm">
                                            {errorMessage}
                                        </div>
                                    )}
                                            <div>
                                                <label className="block text-sm font-medium mb-1">
                                                    {newSourceType === 'RSS' ? 'RSS Feed URL' :
                                                     newSourceType === 'API' ? 'API Endpoint URL' :
                                                     newSourceType === 'AUTO' ? 'Website URL' : 'Source URL'}
                                                </label>
                                                <input
                                                    required
                                                    value={newSourceUrl}
                                                    onChange={e => setNewSourceUrl(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-md bg-input border border-border"
                                                    placeholder={
                                                        newSourceType === 'RSS' ? 'https://feeds.bbci.co.uk/news/technology/rss.xml' :
                                                        newSourceType === 'API' ? 'https://api.example.com/news' :
                                                        newSourceType === 'AUTO' ? 'https://bbc.com/news' : 'Enter source URL'
                                                    }
                                                />
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {newSourceType === 'AUTO' ? "We'll automatically detect RSS feeds or extract articles from this site" :
                                                     newSourceType === 'RSS' ? "Direct URL to RSS/Atom feed" :
                                                     newSourceType === 'API' ? "API endpoint that returns news data in JSON format" :
                                                     "Manual entry - you'll add news items yourself"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 mt-6">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAddModal(false)
                                                    setNewSourceName('')
                                                    setNewSourceType('AUTO')
                                                    setNewSourceUrl('')
                                                }}
                                                className="px-4 py-2 text-sm hover:underline"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                                            >
                                                {isSubmitting ? 'Adding...' : 'Add Source'}
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
