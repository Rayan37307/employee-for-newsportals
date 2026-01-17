'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useEffect, useState } from 'react'
import { Check, Shield, ShieldAlert } from 'lucide-react'

export default function AdminPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch('/api/admin/users')
            .then(async res => {
                if (res.status === 403) throw new Error('Access Denied: Admins Only')
                if (!res.ok) throw new Error('Failed to fetch')
                return res.json()
            })
            .then(data => setUsers(data))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    if (error) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-full text-red-500">
                    <ShieldAlert className="w-16 h-16 mb-4" />
                    <h1 className="text-2xl font-bold">Access Denied</h1>
                    <p className="text-muted-foreground mt-2">{error}</p>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <Shield className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Admin Console</h1>
                        <p className="text-muted-foreground">System Overview & User Management</p>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-muted/30">
                        <h2 className="font-semibold">Registered Users</h2>
                    </div>
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">User</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Role</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Joined</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Stats</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr>
                            ) : users.map(user => (
                                <tr key={user.id} className="hover:bg-muted/30">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium">{user.name || 'No Name'}</p>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs px-2 py-1 rounded-full ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">
                                        {user._count?.posts} posts · {user._count?.socialAccounts} accounts
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    )
}
