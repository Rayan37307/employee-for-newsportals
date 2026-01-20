'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  RotateCcw,
  Newspaper,
  Rss,
  Palette,
  Activity,
  Clock,
  ExternalLink,
  CheckCircle,
  Loader2,
  CreditCard
} from 'lucide-react'

interface Article {
  id: string
  title: string
  sanitizedTitle: string
  link: string
  image: string | null
  content: string
  description: string
  author: string
  publishedAt: string
  category: string
  isNew: boolean
}

interface PostedLink {
  id: string
  url: string
  title: string
  source: string
  postedAt: string
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [postedLinks, setPostedLinks] = useState<PostedLink[]>([])
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    fetchPostedLinks()
  }, [])

  const fetchPostedLinks = async () => {
    try {
      const response = await fetch('/api/bangladesh-guardian', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setPostedLinks(data.links || [])
      }
    } catch (error) {
      console.error('Error fetching posted links:', error)
    }
  }

  const fetchNews = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/bangladesh-guardian')
      const data = await response.json()

      if (data.success) {
        if (data.articles && data.articles.length > 0) {
          setArticles(data.articles)
          setLastChecked(new Date())
        }
        await fetchPostedLinks()
        console.log(data.message)
      }
    } catch (error) {
      console.error('Error fetching news:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown date'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (!content) return ''
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Bangladesh Guardian</h1>
                <p className="text-muted-foreground mt-2">
                  Automated news fetching and card generation
                </p>
              </div>

              {/* Fetch Control */}
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-5 h-5 ${loading ? 'text-yellow-500 animate-pulse' : 'text-green-500'}`} />
                    <span className="font-medium">News Fetcher</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchNews}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Fetching...' : 'Check Now'}
                  </Button>
                </div>
                {lastChecked && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last checked: {lastChecked.toLocaleTimeString()}
                  </p>
                )}
              </Card>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Posted Articles"
              value={postedLinks.length.toString()}
              subtitle="Total posted to database"
              gradient="from-blue-500 to-cyan-500"
              icon={<CheckCircle className="w-6 h-6" />}
            />
            <StatCard
              title="New Articles"
              value={articles.length.toString()}
              subtitle="Available to post"
              gradient="from-green-500 to-emerald-500"
              icon={<Newspaper className="w-6 h-6" />}
            />
            <StatCard
              title="Active Sources"
              value="1"
              subtitle="Bangladesh Guardian"
              gradient="from-orange-500 to-red-500"
              icon={<Rss className="w-6 h-6" />}
            />
            <StatCard
              title="Templates"
              value="0"
              subtitle="Available for cards"
              gradient="from-purple-500 to-pink-500"
              icon={<Palette className="w-6 h-6" />}
            />
          </div>

          {/* Generate Cards Button */}
          <Card className="mb-8 border-primary/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Generate News Cards</h3>
                  <p className="text-muted-foreground">
                    Create cards from Bangladesh Guardian articles using your templates
                  </p>
                </div>
                <a
                  href="/cards"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Generate Cards
                </a>
              </div>
            </CardContent>
          </Card>

          {/* New Articles Section */}
          {articles.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5" />
                  New Articles ({articles.length})
                </CardTitle>
                <CardDescription>
                  Articles ready to be posted. Content is sanitized and images are extracted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {articles.map((article, index) => (
                    <div 
                      key={article.id || index}
                      className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex gap-4">
                        {/* Image */}
                        {article.image && (
                          <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                            <img 
                              src={article.image} 
                              alt={article.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {article.category || 'General'}
                            </Badge>
                            {article.publishedAt && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(article.publishedAt)}
                              </span>
                            )}
                          </div>
                          
                          <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                            {article.sanitizedTitle}
                          </h3>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {truncateContent(article.description)}
                          </p>
                          
                          <a 
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Original
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Posted Articles History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Posted Articles ({postedLinks.length})
              </CardTitle>
              <CardDescription>
                Articles that have been fetched and saved to the database
              </CardDescription>
            </CardHeader>
            <CardContent>
              {postedLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No articles posted yet</p>
                  <p className="text-sm">Click "Check Now" to fetch the latest articles</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {postedLinks.slice(0, 10).map((link, index) => (
                    <div 
                      key={link.id || index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {link.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {link.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(link.postedAt)}
                        </span>
                        <a 
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-background rounded"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                  
                  {postedLinks.length > 10 && (
                    <p className="text-center text-sm text-muted-foreground pt-2">
                      And {postedLinks.length - 10} more articles...
                    </p>
                  )}
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
  gradient,
  icon
}: {
  title: string
  value: string
  subtitle: string
  gradient: string
  icon: React.ReactNode
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
