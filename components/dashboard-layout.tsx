'use client'

import { ReactNode, useState, useEffect } from 'react'
import {
    LayoutDashboard,
    Palette,
    FileText,
    Rss,
    History,
    BarChart3,
    Menu,
    X,
    Settings,
    Bell,
    Check,
    CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Canvas', href: '/canvas', icon: Palette },
    { name: 'Cards', href: '/cards', icon: CreditCard },
    { name: 'Templates', href: '/templates', icon: FileText },
    { name: 'Sources', href: '/sources', icon: Rss },
    { name: 'History', href: '/history', icon: History },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [showNotif, setShowNotif] = useState(false)
    const [notifications, setNotifications] = useState<any[]>([])
    const [user, setUser] = useState<{ name?: string | null; email?: string | null } | null>(null)
    const pathname = usePathname()

    useEffect(() => {
        loadNotifications()
        loadUser()
    }, [])

    const loadNotifications = async () => {
        try {
            const res = await fetch('/api/notifications')
            if (res.ok) {
                setNotifications(await res.json())
            }
        } catch (e) {
            console.error(e)
        }
    }

    const loadUser = async () => {
        try {
            const res = await fetch('/api/auth/session')
            if (res.ok) {
                const data = await res.json()
                setUser(data?.user || null)
            }
        } catch (e) {
            console.error(e)
        }
    }

    const markRead = async (id: string) => {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        } catch (e) {
            console.error(e)
        }
    }

    const unreadCount = notifications.filter((n: any) => !n.read).length

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r border-border
          transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                {/* Logo */}
                <div className="flex h-16 items-center justify-between px-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <span className="text-white font-bold text-lg">N</span>
                        </div>
                        <span className="font-semibold text-lg">News Agent</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-1 p-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }
                `}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>

                {/* User Section at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.name || 'Guest'}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email || 'Sign in to continue'}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 relative">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden text-muted-foreground hover:text-foreground"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex-1 flex justify-end items-center gap-4">
                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotif(!showNotif)}
                                className="p-2 text-muted-foreground hover:text-foreground relative"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-card" />
                                )}
                            </button>

                            {showNotif && (
                                <>
                                    <div
                                        className="fixed inset-0 z-30"
                                        onClick={() => setShowNotif(false)}
                                    />
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-40 overflow-hidden">
                                        <div className="p-3 border-b border-border font-semibold text-sm flex justify-between items-center">
                                            Notifications
                                            {unreadCount > 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{unreadCount} New</span>}
                                        </div>
                                        <div className="max-h-96 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-4 text-center text-muted-foreground text-sm">No notifications</div>
                                            ) : (
                                                notifications.map(n => (
                                                    <div
                                                        key={n.id}
                                                        className={`p-3 border-b border-border hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div>
                                                                <p className="text-sm font-medium">{n.title}</p>
                                                                <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                                                            </div>
                                                            {!n.read && (
                                                                <button
                                                                    onClick={() => markRead(n.id)}
                                                                    className="text-primary hover:text-primary/80"
                                                                    title="Mark as read"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto bg-background">
                    {children}
                </main>
            </div>
        </div>
    )
}
