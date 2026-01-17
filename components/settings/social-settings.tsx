'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Facebook, CheckCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface SocialAccount {
    id: string
    platform: string
    name: string
    platformAccountId: string // pageId from DB will be mapped to this in API or we should check API response type
}

export function SocialSettings() {
    // API returns { pageId, pageName, platform ... }
    // But page.tsx was typing it as platformAccountId.
    // Let's check API response type in SocialAccount.
    // API GET returns prisma objects: id, platform, pageId, pageName.
    // So interface should match.

    // Adjusted interface
    interface SocialAccountData {
        id: string
        platform: string
        pageId: string
        pageName: string
    }

    const [accounts, setAccounts] = useState<SocialAccountData[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddOpen, setIsAddOpen] = useState(false)

    // Form state
    const [platform, setPlatform] = useState('FACEBOOK')
    const [pageId, setPageId] = useState('')
    const [accessToken, setAccessToken] = useState('')
    const [name, setName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        loadAccounts()
    }, [])

    const loadAccounts = async () => {
        try {
            const res = await fetch('/api/social/accounts')
            const data = await res.json()
            setAccounts(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleAddAccount = async () => {
        if (!pageId || !accessToken) return
        setIsSubmitting(true)
        try {
            const res = await fetch('/api/social/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform,
                    platformAccountId: pageId,
                    accessToken,
                    name: name || `${platform} Page`
                })
            })
            if (res.ok) {
                setIsAddOpen(false)
                setPageId('')
                setAccessToken('')
                setName('')
                loadAccounts()
            } else {
                const err = await res.json()
                alert('Failed to add account: ' + (err.error || 'Unknown error'))
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold">Social Accounts</h2>
                    <p className="text-sm text-muted-foreground">Manage your connected social media pages.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Connect Account
                        </button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Connect Social Account</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Platform</label>
                                <select
                                    className="w-full px-3 py-2 rounded-md bg-input border border-border"
                                    value={platform}
                                    onChange={(e) => setPlatform(e.target.value)}
                                >
                                    <option value="FACEBOOK">Facebook Page</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Page Name (Visual Identifier)</label>
                                <input
                                    className="w-full px-3 py-2 rounded-md bg-input border border-border"
                                    placeholder="e.g. My News Page"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Page ID (Facebook)</label>
                                <input
                                    className="w-full px-3 py-2 rounded-md bg-input border border-border"
                                    placeholder="1234567890"
                                    value={pageId}
                                    onChange={(e) => setPageId(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Page Access Token</label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 rounded-md bg-input border border-border"
                                    placeholder="EAA..."
                                    value={accessToken}
                                    onChange={(e) => setAccessToken(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Paste your long-lived Page Access Token here.
                                </p>
                            </div>
                            <button
                                onClick={handleAddAccount}
                                disabled={isSubmitting || !pageId || !accessToken}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Connecting...' : 'Connect Page'}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-sm text-muted-foreground">Loading accounts...</div>
                ) : accounts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        No social accounts connected. Connect a page to start posting.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {accounts.map(account => (
                            <div key={account.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Facebook className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            {account.pageName || 'Unnamed Page'}
                                            <CheckCircle className="w-3 h-3 text-green-500" />
                                        </div>
                                        <div className="text-xs text-muted-foreground">ID: {account.pageId}</div>
                                        <div className="text-xs text-muted-foreground capitalize">{account.platform.toLowerCase()}</div>
                                    </div>
                                </div>
                                <button className="text-red-500 hover:bg-red-50 p-2 rounded">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
