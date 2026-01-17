import { DashboardLayout } from '@/components/dashboard-layout'

export default function DashboardPage() {
    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold">Dashboard</h1>
                        <p className="text-muted-foreground mt-2">
                            Welcome to your news card automation platform
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            title="Total Cards"
                            value="0"
                            subtitle="Generated this month"
                            gradient="from-purple-500 to-pink-500"
                        />
                        <StatCard
                            title="Active Sources"
                            value="0"
                            subtitle="News sources configured"
                            gradient="from-blue-500 to-cyan-500"
                        />
                        <StatCard
                            title="Posts Scheduled"
                            value="0"
                            subtitle="Ready to publish"
                            gradient="from-green-500 to-emerald-500"
                        />
                        <StatCard
                            title="Templates"
                            value="0"
                            subtitle="Design templates ready"
                            gradient="from-orange-500 to-red-500"
                        />
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <QuickActionCard
                            title="Create News Card"
                            description="Design a new news card from scratch or use a template"
                            action="Open Canvas"
                            href="/canvas"
                        />
                        <QuickActionCard
                            title="Add News Source"
                            description="Configure RSS feeds or API connections for automated content"
                            action="Add Source"
                            href="/sources"
                        />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}

function StatCard({
    title,
    value,
    subtitle,
    gradient
}: {
    title: string
    value: string
    subtitle: string
    gradient: string
}) {
    return (
        <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} mb-4 flex items-center justify-center`}>
                <span className="text-2xl font-bold text-white">{value}</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
    )
}

function QuickActionCard({
    title,
    description,
    action,
    href,
}: {
    title: string
    description: string
    action: string
    href: string
}) {
    return (
        <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-muted-foreground mb-4">{description}</p>
            <a
                href={href}
                className="inline-flex items-center justify-center px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
                {action}
            </a>
        </div>
    )
}
