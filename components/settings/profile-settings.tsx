'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export function ProfileSettings() {
    const { data: session, update } = useSession()
    const [name, setName] = useState(session?.user?.name || '')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    const handleSave = async () => {
        setLoading(true)
        setMessage('')
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            })
            if (res.ok) {
                setMessage('Profile updated successfully')
                // Update session
                update({ name })
            } else {
                setMessage('Failed to update profile')
            }
        } catch (e) {
            setMessage('Error updating profile')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-card border border-border rounded-lg p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Display Name</label>
                    <input
                        className="w-full px-3 py-2 rounded-md bg-input border border-border"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your Name"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <input
                        className="w-full px-3 py-2 rounded-md bg-muted border border-border text-muted-foreground"
                        value={session?.user?.email || ''}
                        disabled
                        title="Email cannot be changed"
                    />
                </div>
                {message && (
                    <div className={`text-sm ${message.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                        {message}
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    )
}
