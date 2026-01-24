'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { 
  AlertCircle, 
  CheckCircle, 
  Play, 
  Settings, 
  Shield, 
  RefreshCw, 
  Clock, 
  Plus, 
  Trash2,
  Check,
  XCircle,
  Loader2,
  Info
} from 'lucide-react'

interface RunData {
  id: string
  status: string
  startedAt: Date | string
  completedAt: Date | string | null
  newsFound: number
  cardsCreated: number
  skipped: number
  errors: string | null
}

interface SensitiveWord {
  id: string
  word: string
  isActive: boolean
}

interface Template {
  id: string
  name: string
  category: string
}

interface InitialDataSettings {
  id: string
  isEnabled: boolean
  templateId: string | null
  checkInterval: number
  generateCards: boolean
  sensitiveFilter: boolean
  notifyOnNewCard: boolean
  lastRunAt: Date | string | null
  lastError: string | null
  userId: string
  createdAt?: Date | string
  updatedAt?: Date | string
}

interface InitialData {
  settings: InitialDataSettings | null
  stats: {
    todayRuns: number
    totalCardsToday: number
    recentRuns: RunData[]
  }
  recentRuns: RunData[]
  templates: Template[]
  sensitiveWords: SensitiveWord[]
}

interface AutopilotDashboardProps {
  initialData: InitialData
  userId: string
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

export function AutopilotDashboard({ initialData, userId }: AutopilotDashboardProps) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substring(7)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }

  const refreshData = async () => {
    setLoading(true)
    try {
      const [settingsRes, runsRes] = await Promise.all([
        fetch('/api/autopilot'),
        fetch('/api/autopilot/runs'),
      ])
      if (settingsRes.ok && runsRes.ok) {
        const [settings, runsData] = await Promise.all([settingsRes.json(), runsRes.json()])
        setData(prev => ({
          ...prev,
          settings,
          recentRuns: runsData.runs,
        }))
        addToast('success', 'Data refreshed')
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
      addToast('error', 'Failed to refresh data')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (updates: Partial<InitialData['settings']>) => {
    setSavingSettings(true)
    try {
      const response = await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (response.ok) {
        const newSettings = await response.json()
        setData(prev => ({
          ...prev,
          settings: newSettings,
        }))
        addToast('success', 'Settings saved')
      } else {
        addToast('error', 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      addToast('error', 'Error saving settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const runAutopilotNow = async () => {
    setRunning(true)
    try {
      const response = await fetch('/api/autopilot/run', {
        method: 'POST',
      })
      if (response.ok) {
        const result = await response.json()
        addToast('success', `Run complete! Found ${result.newsFound} news, created ${result.cardsCreated} cards`)
        refreshData()
      } else {
        const error = await response.json()
        addToast('error', error.error || 'Failed to run autopilot')
      }
    } catch (error) {
      console.error('Error running autopilot:', error)
      addToast('error', 'Failed to run autopilot')
    } finally {
      setRunning(false)
    }
  }

  const addSensitiveWord = async () => {
    if (!newWord.trim()) return
    
    try {
      const response = await fetch('/api/sensitive-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord }),
      })
      if (response.ok) {
        const word = await response.json()
        setData(prev => ({
          ...prev,
          sensitiveWords: [...prev.sensitiveWords, word],
        }))
        setNewWord('')
        addToast('success', `Added "${word.word}" to filter`)
      } else {
        addToast('error', 'Failed to add word')
      }
    } catch (error) {
      console.error('Error adding word:', error)
      addToast('error', 'Error adding word')
    }
  }

  const removeSensitiveWord = async (id: string) => {
    try {
      await fetch(`/api/sensitive-words?id=${id}`, { method: 'DELETE' })
      setData(prev => ({
        ...prev,
        sensitiveWords: prev.sensitiveWords.filter(w => w.id !== id),
      }))
      addToast('success', 'Word removed from filter')
    } catch (error) {
      console.error('Error removing word:', error)
      addToast('error', 'Error removing word')
    }
  }

  const getRunDuration = (started: Date | string, completed: Date | string | null) => {
    if (!completed) return null
    const start = new Date(started).getTime()
    const end = new Date(completed).getTime()
    const seconds = Math.round((end - start) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'RUNNING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right ${
                toast.type === 'success' ? 'bg-green-500 text-white' :
                toast.type === 'error' ? 'bg-red-500 text-white' :
                'bg-blue-500 text-white'
              }`}
            >
              {toast.type === 'success' && <Check className="w-4 h-4" />}
              {toast.type === 'error' && <XCircle className="w-4 h-4" />}
              {toast.type === 'info' && <Info className="w-4 h-4" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          ))}
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Autopilot</h1>
              <p className="text-muted-foreground mt-2">
                Automatically generate cards from news sources
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refreshData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={runAutopilotNow} disabled={running} variant="default">
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Now
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className={data.settings?.isEnabled ? 'border-green-200 bg-green-50/50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {data.settings?.isEnabled ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-green-600 font-medium">Enabled</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-gray-500">Disabled</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Today's Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.stats.todayRuns}</div>
                <p className="text-xs text-muted-foreground">Completed runs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cards Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.stats.totalCardsToday}</div>
                <p className="text-xs text-muted-foreground">Cards generated</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Last Run</CardTitle>
              </CardHeader>
              <CardContent>
                {data.settings?.lastRunAt ? (
                  <div className="text-sm">
                    {new Date(data.settings.lastRunAt).toLocaleString()}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Error Alert */}
          {data.settings?.lastError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Last run error: {data.settings.lastError}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Autopilot Settings
                </CardTitle>
                <CardDescription>
                  Configure how autopilot works
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Enable Autopilot</div>
                    <div className="text-sm text-muted-foreground">
                      Turn on automatic card generation
                    </div>
                  </div>
                  <Switch
                    checked={data.settings?.isEnabled || false}
                    onCheckedChange={(checked) => saveSettings({ isEnabled: checked })}
                    disabled={savingSettings}
                  />
                </div>

                {data.settings?.isEnabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select
                        value={data.settings?.templateId || ''}
                        onValueChange={(value) => saveSettings({ templateId: value || null })}
                        disabled={savingSettings}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Check Interval (minutes)</Label>
                      <Select
                        value={String(data.settings?.checkInterval || 15)}
                        onValueChange={(value) => saveSettings({ checkInterval: parseInt(value) })}
                        disabled={savingSettings}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Generate Cards</div>
                        <div className="text-sm text-muted-foreground">
                          Automatically create cards when new news found
                        </div>
                      </div>
                      <Switch
                        checked={data.settings?.generateCards || false}
                        onCheckedChange={(checked) => saveSettings({ generateCards: checked })}
                        disabled={savingSettings}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <div>
                          <div className="font-medium">Sensitive Filter</div>
                          <div className="text-sm text-muted-foreground">
                            Skip news with sensitive content
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={data.settings?.sensitiveFilter || false}
                        onCheckedChange={(checked) => saveSettings({ sensitiveFilter: checked })}
                        disabled={savingSettings}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Notifications</div>
                        <div className="text-sm text-muted-foreground">
                          Get notified when new cards are created
                        </div>
                      </div>
                      <Switch
                        checked={data.settings?.notifyOnNewCard || false}
                        onCheckedChange={(checked) => saveSettings({ notifyOnNewCard: checked })}
                        disabled={savingSettings}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sensitive Words */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Sensitive Words
                </CardTitle>
                <CardDescription>
                  Words that will be filtered out
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="Add a word to filter"
                    onKeyDown={(e) => e.key === 'Enter' && addSensitiveWord()}
                  />
                  <Button onClick={addSensitiveWord} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {data.sensitiveWords.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No sensitive words added yet
                    </p>
                  ) : (
                    data.sensitiveWords.map((word) => (
                      <div
                        key={word.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      >
                        <span className="text-sm">{word.word}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSensitiveWord(word.id)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Runs */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>
                History of autopilot runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentRuns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No autopilot runs yet. Click "Run Now" to start.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(run.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                run.status === 'COMPLETED'
                                  ? 'default'
                                  : run.status === 'FAILED'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {run.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(run.startedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {run.newsFound} news found
                            {run.cardsCreated > 0 && ` • ${run.cardsCreated} cards created`}
                            {run.skipped > 0 && ` • ${run.skipped} skipped`}
                            {run.errors && ` • Error occurred`}
                          </div>
                        </div>
                      </div>
                      {run.completedAt && (
                        <div className="text-xs text-muted-foreground">
                          Duration: {getRunDuration(run.startedAt, run.completedAt)}
                        </div>
                      )}
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
