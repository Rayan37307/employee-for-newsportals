'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { BarChart3, TrendingUp, Users, Share2 } from 'lucide-react'

// Mock components since we don't have Recharts installed in this turn's context
function StatCard({ title, value, change, icon: Icon }: any) {
    return (
        <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{title}</span>
                <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className={`text-xs mt-1 ${change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                {change} from last month
            </div>
        </div>
    )
}

export default function AnalyticsPage() {
    return (
        <DashboardLayout>
            <div className="p-8 max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Analytics Overview</h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard title="Total Impressions" value="12,543" change="+12.5%" icon={TrendingUp} />
                    <StatCard title="Engagement Rate" value="4.2%" change="+0.8%" icon={Users} />
                    <StatCard title="Total Shares" value="342" change="+24%" icon={Share2} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Placeholder Charts */}
                    <div className="bg-card border border-border rounded-lg p-6 h-80 flex flex-col items-center justify-center text-muted-foreground">
                        <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
                        <p>Engagement History Chart</p>
                        <p className="text-sm opacity-50">(Requires Recharts library)</p>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-6 h-80 flex flex-col items-center justify-center text-muted-foreground">
                        <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                        <p>Follower Growth Chart</p>
                        <p className="text-sm opacity-50">(Requires Recharts library)</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
