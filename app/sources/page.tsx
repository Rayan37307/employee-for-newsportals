'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Newspaper,
  RefreshCw,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react'

export default function NewsSourcesPage() {
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [status, setStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle')

  const fetchNews = async () => {
    setLoading(true)
    setStatus('fetching')
    
    try {
      const response = await fetch('/api/bangladesh-guardian', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setStatus('success')
        setLastFetched(new Date())
      } else {
        setStatus('error')
      }
    } catch (error) {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">News Source</h1>
            <p className="text-muted-foreground">
              Bangladesh Guardian news integration
            </p>
          </div>
          <Button 
            onClick={fetchNews} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Fetch News
              </>
            )}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Newspaper className="h-8 w-8 text-blue-600" />
                <div>
                  <CardTitle>Bangladesh Guardian</CardTitle>
                  <CardDescription>
                    Latest news from Bangladesh Guardian
                  </CardDescription>
                </div>
              </div>
              <Badge variant={status === 'success' ? 'default' : 'secondary'}>
                {status === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
                {status === 'fetching' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                {status === 'idle' && <Clock className="h-3 w-3 mr-1" />}
                {status === 'error' && <Clock className="h-3 w-3 mr-1" />}
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Source URL:</span>
                <a 
                  href="https://www.bangladeshguardian.com/latest" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  https://www.bangladeshguardian.com/latest
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              
              {lastFetched && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last fetched:</span>
                  <span>{lastFetched.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline">Web Scraping</Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="text-green-600">Active</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About Bangladesh Guardian Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This system automatically fetches the latest news articles from Bangladesh Guardian's 
                latest news page and generates social media cards using your templates.
              </p>
              <p>
                The integration includes content sanitization to filter sensitive words and 
                automatic image extraction from articles.
              </p>
              <p>
                Click "Fetch News" above to manually trigger a news fetch, or use the 
                auto-pilot feature for automated fetching and card generation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}