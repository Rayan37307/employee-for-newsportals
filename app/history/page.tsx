'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Newspaper, 
  Clock, 
  RefreshCw, 
  Eye,
  Download,
  AlertTriangle
} from 'lucide-react'

interface NewsCard {
  id: string
  imageUrl: string | null
  status: 'DRAFT' | 'QUEUED' | 'GENERATED' | 'POSTED' | 'FAILED'
  sourceData: any
  templateId: string
  createdAt: string
  updatedAt: string
}

export default function NewsCardsPage() {
  const [cards, setCards] = useState<NewsCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNewsCards()
  }, [])

  const fetchNewsCards = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/news-cards')
      
      if (!response.ok) {
        throw new Error('Failed to fetch news cards')
      }
      
      const data = await response.json()
      setCards(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching news cards:', err)
      setError('Failed to load news cards')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'GENERATED': return 'bg-green-500'
      case 'QUEUED': return 'bg-yellow-500'
      case 'POSTED': return 'bg-blue-500'
      case 'FAILED': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">News Cards</h1>
                <p className="text-muted-foreground mt-2">
                  View and manage your generated news cards
                </p>
              </div>
              <Button onClick={fetchNewsCards} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {error && (
            <Card className="mb-6">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium">Error loading news cards</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading news cards...</span>
              </div>
            </div>
          ) : cards.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Newspaper className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No news cards yet</h3>
                <p className="text-muted-foreground mb-4">
                  Your generated news cards will appear here. Start autopilot to generate cards automatically.
                </p>
                <Button onClick={fetchNewsCards}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((card) => (
                <Card key={card.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {card.imageUrl ? (
                      <img 
                        src={card.imageUrl} 
                        alt={`News card ${card.id}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Newspaper className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No image available</p>
                      </div>
                    )}
                  </div>
                  
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {card.sourceData?.title || 'Untitled Card'}
                      </CardTitle>
                      <Badge className={`${getStatusColor(card.status)} text-white`}>
                        {card.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-2" />
                        {formatDate(card.createdAt)}
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        {card.imageUrl && (
                          <Button size="sm" variant="outline" className="flex-1">
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </Button>
                        )}
                        {card.imageUrl && (
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}