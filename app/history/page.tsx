'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useState, useEffect } from 'react'
import { ExternalLink, CheckCircle, XCircle, Clock, AlertCircle, Download } from 'lucide-react'
import { format } from 'date-fns'

export default function HistoryPage() {
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/posts').then(res => res.json()).then(data => {
            setPosts(Array.isArray(data) ? data : [])
            setLoading(false)
        })
    }, [])

    const handleExport = () => {
        if (posts.length === 0) return

        const headers = ['Date', 'Content', 'Platform', 'Account', 'Status', 'URL']
        const csv = [
            headers.join(','),
            ...posts.map(p => [
                new Date(p.createdAt).toISOString(),
                `"${(p.content || '').replace(/"/g, '""')}"`,
                p.socialAccount?.platform || 'Unknown',
                p.socialAccount?.pageName || 'Unknown',
                p.status,
                p.platformUrl || ''
            ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `posts-history-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'POSTED': return <CheckCircle className="w-4 h-4 text-green-500" />
            case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />
            case 'QUEUED': return <Clock className="w-4 h-4 text-amber-500" />
            default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />
        }
    }

    return (
        <DashboardLayout>
            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">Post History</h1>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                        disabled={posts.length === 0}
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Content</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Platform</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading history...</td>
                                </tr>
                            ) : posts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No posts found.</td>
                                </tr>
                            ) : (
                                posts.map((post) => (
                                    <tr key={post.id} className="hover:bg-muted/30">
                                        <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                                            {format(new Date(post.createdAt), 'MMM d, h:mm a')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-medium line-clamp-1">{post.content}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm capitalize">
                                            {post.socialAccount.platform.toLowerCase()}
                                            <span className="text-muted-foreground ml-1">({post.socialAccount.pageName})</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(post.status)}
                                                <span className="text-sm capitalize">{post.status.toLowerCase()}</span>
                                            </div>
                                            {post.status === 'FAILED' && post.errorMessage && (
                                                <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={post.errorMessage}>
                                                    {post.errorMessage}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {post.platformUrl && (
                                                <a
                                                    href={post.platformUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                                                >
                                                    View <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    )
}
