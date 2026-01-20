'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Plus,
  Newspaper,
  Rss,
  Globe,
  Settings,
  RefreshCw
} from 'lucide-react'

interface NewsSource {
  id: string
  name: string
  type: string
  config: any
  createdAt: string
}

export default function NewsSourcesPage() {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [loading, setLoading] = useState(false)
  const [newSource, setNewSource] = useState({
    name: 'Bangladesh Guardian',
    url: 'https://www.bangladeshguardian.com/latest'
  })

  const addSource = async () => {
    if (!newSource.name || !newSource.url) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSource.name,
          type: 'BANGLADESH_GUARDIAN',
          url: newSource.url,
          category: 'NEWS'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add source')
      }

      const source = await response.json()
      setSources([...sources, source])
      setNewSource({ name: '', url: '' })
    } catch (err) {
      console.error('Error adding source:', err)
      alert(`Error adding source: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchNews = async (sourceId: string) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch news')
      }

      alert('News fetched successfully!')
    } catch (err) {
      console.error('Error fetching news:', err)
      alert(`Error fetching news: ${(err as Error).message}`)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">News Sources</h1>
            <p className="text-muted-foreground mt-2">
              Manage your news sources for automatic fetching
            </p>
          </div>

          {/* Add Source Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add News Source
              </CardTitle>
              <CardDescription>
                Configure a new source to fetch news from
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Source Name</Label>
                  <Input
                    id="name"
                    value={newSource.name}
                    onChange={(e) => setNewSource({...newSource, name: e.target.value})}
                    placeholder="e.g., Bangladesh Guardian"
                  />
                </div>

                <div>
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={newSource.url}
                    onChange={(e) => setNewSource({...newSource, url: e.target.value})}
                    placeholder="e.g., https://www.bangladeshguardian.com/latest"
                  />
                </div>
              </div>
              
              <Button 
                className="mt-6 w-full md:w-auto" 
                onClick={addSource}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Source
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Configured Sources
              </CardTitle>
              <CardDescription>
                Your configured news sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sources.length === 0 ? (
                <div className="text-center py-8">
                  <Newspaper className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No news sources configured yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a source to begin fetching news
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{source.name}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="capitalize">{source.type}</span>
                          <span>{source.config.url}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => fetchNews(source.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Fetch Now
                        </Button>
                      </div>
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