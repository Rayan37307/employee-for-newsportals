'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MapPin,
  Newspaper,
  Palette,
  Plus,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'

interface NewsSource {
  id: string
  name: string
  type: string
  config: any
  createdAt: string
}

interface Template {
  id: string
  name: string
  description: string | null
  category: string
  createdAt: string
}

interface DataMapping {
  id: string
  newsSourceId: string
  templateId: string
  sourceFields: any
  createdAt: string
}

export default function DataMappingPage() {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [mappings, setMappings] = useState<DataMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch sources
      const sourcesResponse = await fetch('/api/sources')
      if (!sourcesResponse.ok) throw new Error('Failed to fetch sources')
      const sourcesData = await sourcesResponse.json()
      setSources(sourcesData)

      // Fetch templates
      const templatesResponse = await fetch('/api/templates')
      if (!templatesResponse.ok) throw new Error('Failed to fetch templates')
      const templatesData = await templatesResponse.json()
      setTemplates(templatesData)

      // Fetch mappings
      const mappingsResponse = await fetch('/api/mappings')
      if (!mappingsResponse.ok) throw new Error('Failed to fetch mappings')
      const mappingsData = await mappingsResponse.json()
      setMappings(mappingsData)

      setError(null)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load sources, templates, or mappings')
    } finally {
      setLoading(false)
    }
  }

  const createMapping = async (sourceId: string, templateId: string) => {
    try {
      // Create a default mapping
      const defaultMapping = {
        title: 'title',      // Maps to newsItem.title
        date: 'date',        // Maps to newsItem.date
        subtitle: 'description', // Maps to newsItem.description
        image: 'image'       // Maps to newsItem.image
      }

      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          templateId,
          mappings: defaultMapping
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create mapping')
      }

      const newMapping = await response.json()
      setMappings([...mappings, newMapping])
    } catch (err) {
      console.error('Error creating mapping:', err)
      alert(`Error creating mapping: ${(err as Error).message}`)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Data Mapping</h1>
            <p className="text-muted-foreground mt-2">
              Connect news sources to templates with field mappings
            </p>
          </div>

          {error && (
            <Card className="mb-6">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium">Error loading data</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading data mappings...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sources */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5" />
                    News Sources
                  </CardTitle>
                  <CardDescription>
                    Available news sources to fetch from
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sources.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No news sources configured. Add a source first.
                      </p>
                    ) : (
                      sources.map((source) => (
                        <div key={source.id} className="p-3 border rounded-lg">
                          <h3 className="font-medium">{source.name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">{source.type}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Templates
                  </CardTitle>
                  <CardDescription>
                    Available templates to use for cards
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {templates.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No templates available. Create a template first.
                      </p>
                    ) : (
                      templates.map((template) => (
                        <div key={template.id} className="p-3 border rounded-lg">
                          <h3 className="font-medium">{template.name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">{template.category}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Mappings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Data Mappings
                  </CardTitle>
                  <CardDescription>
                    Connections between sources and templates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mappings.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No data mappings created yet.
                      </p>
                    ) : (
                      mappings.map((mapping) => {
                        const source = sources.find(s => s.id === mapping.newsSourceId)
                        const template = templates.find(t => t.id === mapping.templateId)
                        
                        return (
                          <div key={mapping.id} className="p-3 border rounded-lg">
                            <h3 className="font-medium">{source?.name || 'Unknown Source'} → {template?.name || 'Unknown Template'}</h3>
                            <div className="mt-2 text-xs text-muted-foreground">
                              <p>Title: {mapping.sourceFields?.title || 'Not mapped'}</p>
                              <p>Date: {mapping.sourceFields?.date || 'Not mapped'}</p>
                              <p>Image: {mapping.sourceFields?.image || 'Not mapped'}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                    
                    <Button 
                      className="w-full mt-4"
                      onClick={() => {
                        if (sources.length > 0 && templates.length > 0) {
                          createMapping(sources[0].id, templates[0].id)
                        } else {
                          alert('You need at least one source and one template to create a mapping')
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Mapping
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}