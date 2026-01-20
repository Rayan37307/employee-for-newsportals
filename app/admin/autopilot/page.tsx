'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { 
  Activity, 
  RotateCcw, 
  Clock, 
  TrendingUp, 
  Newspaper, 
  Rss,
  AlertTriangle
} from 'lucide-react'

export default function AutopilotPage() {
  const [autopilotEnabled, setAutopilotEnabled] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [stats, setStats] = useState({
    totalCards: 0,
    activeSources: 0,
    postsScheduled: 0,
    templates: 0
  })
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching autopilot status
    const fetchAutopilotStatus = async () => {
      try {
        const response = await fetch('/api/news-agent?action=autopilot-status')
        const result = await response.json()
        
        if (result.success) {
          setAutopilotEnabled(result.isRunning)
        }
      } catch (error) {
        console.error('Error fetching autopilot status:', error)
      }
      
      // Simulate stats
      setStats({
        totalCards: 12,
        activeSources: 3,
        postsScheduled: 5,
        templates: 8
      })
      
      setLoading(false)
    }
    
    fetchAutopilotStatus()
  }, [])

  const toggleAutopilot = async () => {
    try {
      const response = await fetch('/api/news-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: autopilotEnabled ? 'stop-autopilot' : 'start-autopilot' 
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setAutopilotEnabled(!autopilotEnabled)
        addLog(`Autopilot ${autopilotEnabled ? 'stopped' : 'started'}`)
        
        if (!autopilotEnabled) {
          setLastChecked(new Date())
        }
      } else {
        console.error('Failed to toggle autopilot:', result.error)
        addLog(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error toggling autopilot:', error)
      addLog(`Error: ${(error as Error).message}`)
    }
  }

  const forceCheck = async () => {
    try {
      const response = await fetch('/api/news-agent?action=fetch-news', {
        method: 'GET'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setLastChecked(new Date())
        addLog(`Manual check completed: ${result.news.length} articles found`)
      } else {
        addLog(`Manual check failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error during manual check:', error)
      addLog(`Manual check error: ${(error as Error).message}`)
    }
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]) // Keep last 20 logs
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Autopilot Manager</h1>
            <p className="text-muted-foreground mt-2">
              Control and monitor the automatic news card generation system
            </p>
          </div>

          {/* Autopilot Control Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Autopilot Control
              </CardTitle>
              <CardDescription>
                Enable or disable automatic news fetching and card generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${autopilotEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <div>
                    <p className="font-medium">
                      {autopilotEnabled ? 'Autopilot Active' : 'Autopilot Inactive'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {autopilotEnabled 
                        ? 'Automatically fetching news and generating cards' 
                        : 'Manual mode - generate cards on demand'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={autopilotEnabled}
                    onCheckedChange={toggleAutopilot}
                  />
                  <Badge variant={autopilotEnabled ? 'default' : 'secondary'}>
                    {autopilotEnabled ? 'RUNNING' : 'STOPPED'}
                  </Badge>
                </div>
              </div>
              
              <div className="mt-4 flex gap-3">
                <Button 
                  onClick={toggleAutopilot}
                  className="flex items-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  {autopilotEnabled ? 'Stop Autopilot' : 'Start Autopilot'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={forceCheck}
                  disabled={autopilotEnabled}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Check Now
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Cards Generated"
              value={stats.totalCards.toString()}
              subtitle="Cards created in autopilot mode"
              icon={<Newspaper className="w-6 h-6" />}
              gradient="from-purple-500 to-pink-500"
            />
            <StatCard
              title="Active Sources"
              value={stats.activeSources.toString()}
              subtitle="News sources being monitored"
              icon={<Rss className="w-6 h-6" />}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard
              title="Posts Scheduled"
              value={stats.postsScheduled.toString()}
              subtitle="Ready to publish"
              icon={<TrendingUp className="w-6 h-6" />}
              gradient="from-green-500 to-emerald-500"
            />
            <StatCard
              title="Templates Available"
              value={stats.templates.toString()}
              subtitle="Design templates ready"
              icon={<Newspaper className="w-6 h-6" />}
              gradient="from-orange-500 to-red-500"
            />
          </div>

          {/* Status Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current State</span>
                    <Badge variant={autopilotEnabled ? 'default' : 'secondary'}>
                      {autopilotEnabled ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Next Check</span>
                    <span className="text-sm">
                      {autopilotEnabled ? 'In ~5 minutes' : 'Manual only'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last Check</span>
                    <span className="text-sm">
                      {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Monitored</span>
                    <span className="text-sm font-medium">{stats.activeSources}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Target Site</span>
                    <span className="text-sm">Bangladesh Guardian</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Check Interval</span>
                    <span className="text-sm">Every 5 minutes</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="text-sm font-medium">98%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Time</span>
                    <span className="text-sm">2.4s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Errors</span>
                    <span className="text-sm">2</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Activity Log
              </CardTitle>
              <CardDescription>
                Recent activity from the autopilot system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No activity logs yet</p>
                  <p className="text-sm">Start autopilot to see activity here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div 
                      key={index} 
                      className="text-sm p-3 bg-muted rounded-lg font-mono"
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  gradient: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} mb-4 flex items-center justify-center text-white`}>
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}