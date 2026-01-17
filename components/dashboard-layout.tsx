'use client'

import { ReactNode, useState } from 'react'
import {
    LayoutDashboard,
    Palette,
    FileText,
    Rss,
    History,
    BarChart3,
    Menu,
    X,
    Settings
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Canvas', href: '/canvas', icon: Palette },
    { name: 'Templates', href: '/templates', icon: FileText },
    { name: 'Sources', href: '/sources', icon: Rss },
    { name: 'History', href: '/history', icon: History },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()

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
                            <p className="text-sm font-medium truncate">User</p>
                            <p className="text-xs text-muted-foreground truncate">user@example.com</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden text-muted-foreground hover:text-foreground"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-4">
                        {/* Notifications, User Menu, etc. will go here */}
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
