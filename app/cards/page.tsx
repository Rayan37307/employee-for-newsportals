'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Image as ImageIcon,
  Download,
  Plus,
  Newspaper,
  FileText,
  CheckCircle,
  Eye,
  AlertCircle
} from 'lucide-react'
import html2canvas from 'html2canvas'
import { useFonts, Font } from '@/hooks/use-fonts'

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
}

interface Template {
  id: string
  name: string
  description: string | null
  category: string
  thumbnail: string | null
  canvasData: any
}

interface GeneratedCard {
  id: string
  imageUrl: string
  status: string
  templateName: string
  sourceTitle: string
  createdAt: string
}

function getCanvasDimensions(canvasData: any): { width: number; height: number } {
  if (canvasData.width && canvasData.height) {
    return { width: canvasData.width, height: canvasData.height }
  }
  
  const objects = canvasData.objects || []
  if (objects.length > 0) {
    let maxRight = 0
    let maxBottom = 0
    
    for (const obj of objects) {
      const left = obj.left || 0
      const top = obj.top || 0
      const width = (obj.width || 200) * (obj.scaleX || 1)
      const height = (obj.height || 100) * (obj.scaleY || 1)
      
      if (obj.originX === 'center') {
        maxRight = Math.max(maxRight, left + width / 2)
      } else {
        maxRight = Math.max(maxRight, left + width)
      }
      
      if (obj.originY === 'center') {
        maxBottom = Math.max(maxBottom, top + height / 2)
      } else {
        maxBottom = Math.max(maxBottom, top + height)
      }
    }
    
    return { 
      width: Math.max(maxRight + 40, 400), 
      height: Math.max(maxBottom + 40, 300) 
    }
  }
  
  return { width: 800, height: 420 }
}

function getFontFaceStyles(fonts: Font[]): string {
  if (fonts.length === 0) return ''
  
  return fonts.map(font => `
    @font-face {
      font-family: '${font.family}';
      src: url('${font.fileUrl}') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `).join('\n')
}

export default function CardsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [cards, setCards] = useState<GeneratedCard[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null)
  const [generatedCard, setGeneratedCard] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('create')
  const [error, setError] = useState<string | null>(null)
  const cardPreviewRef = useRef<HTMLDivElement>(null)
  const captureContainerRef = useRef<HTMLDivElement>(null)
  const { fonts, fetchFonts } = useFonts()

  useEffect(() => {
    fetchArticles()
    fetchTemplates()
    fetchCards()
    fetchFonts()
  }, [])

  // Clear previewArticle when selected article changes
  useEffect(() => {
    if (selectedArticle) {
      console.log(`[CardsPage] Selected article changed to: ${selectedArticle}`)
      setPreviewArticle(null)
    }
  }, [selectedArticle])

  const fetchArticles = async () => {
    try {
      // Get list of posted links
      const response = await fetch('/api/bangladesh-guardian', { method: 'POST' })
      const data = await response.json()
      
      if (data.success && data.links) {
        // Just store the links, we'll fetch full data when needed
        const articleList: Article[] = data.links.map((link: any) => ({
          id: link.id,
          title: link.title,
          sanitizedTitle: link.title,
          link: link.url,
          image: null,
          content: '',
          description: '',
          author: '',
          publishedAt: link.postedAt,
          category: 'National'
        }))
        setArticles(articleList)
      }
    } catch (error) {
      console.error('Error fetching articles:', error)
    }
  }

  // Fetch full article data including content and image
  const fetchFullArticleData = async (article: Article): Promise<Article> => {
    console.log(`[CardsPage][FetchFullArticle] START: ${article.title?.substring(0, 40)}`)
    
    // If we already have content, return as is
    if (article.description && article.content && article.image) {
      console.log(`[CardsPage][FetchFullArticle] SKIP: Article already has full data`)
      return article
    }
    
    try {
      // Fetch article image
      let imageUrl = article.image
      console.log(`[CardsPage][FetchFullArticle] Initial image: ${imageUrl ? 'present' : 'null'}`)
      
      if (!imageUrl) {
        console.log(`[CardsPage][FetchFullArticle] Fetching image from API: ${article.link.substring(0, 60)}...`)
        const imageResponse = await fetch(`/api/bangladesh-guardian/image?url=${encodeURIComponent(article.link)}`)
        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          console.log(`[CardsPage][FetchFullArticle] Image API response: ${imageData.image ? 'found' : 'null'}`)
          imageUrl = imageData.image
        } else {
          console.warn(`[CardsPage][FetchFullArticle] Image API failed: status=${imageResponse.status}`)
        }
      }

      // Fetch article content using the main API
      console.log(`[CardsPage][FetchFullArticle] Fetching article content...`)
      const response = await fetch('/api/bangladesh-guardian')
      const data = await response.json()
      
      if (data.success && data.articles) {
        // Find matching article
        const fullArticle = data.articles.find((a: any) => a.link === article.link)
        if (fullArticle) {
          console.log(`[CardsPage][FetchFullArticle] Found full article: title=${fullArticle.title?.substring(0, 40)}, image=${fullArticle.image ? 'present' : 'null'}`)
          return {
            ...article,
            image: fullArticle.image || imageUrl,
            content: fullArticle.content || article.content,
            description: fullArticle.description || article.description,
            author: fullArticle.author || article.author,
            publishedAt: fullArticle.publishedAt || article.publishedAt,
            category: fullArticle.category || article.category
          }
        }
      }
      
      return { ...article, image: imageUrl }
    } catch (error) {
      console.error('Error fetching full article data:', error)
      return article
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/cards')
      const data = await response.json()
      if (data.success) {
        setCards(data.cards)
      }
    } catch (error) {
      console.error('Error fetching cards:', error)
    }
  }

  const handleDownloadCard = async (imageUrl: string, title: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `card-${title.substring(0, 30).replace(/[^a-z0-9]/gi, '-')}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading card:', error)
      window.open(imageUrl, '_blank')
    }
  }

  const handleGenerateCard = async () => {
    if (!selectedArticle || !selectedTemplate) {
      setError('Please select both an article and a template')
      return
    }

    const article = articles.find(a => a.id === selectedArticle)
    const template = templates.find(t => t.id === selectedTemplate)
    if (!article || !template) return

    console.log(`[CardsPage][Generate] START: article=${article.title?.substring(0, 40)}, template=${template.name}`)

    setGenerating(true)
    setError(null)
    setGeneratedCard(null)

    try {
      // Fetch full article data
      console.log(`[CardsPage][Generate] Fetching full article data...`)
      const fullArticle = await fetchFullArticleData(article)
      console.log(`[CardsPage][Generate] Full article data:`, {
        title: fullArticle.title?.substring(0, 40),
        description: fullArticle.description ? 'present' : 'N/A',
        image: fullArticle.image ? 'present' : 'N/A'
      })

      // Update preview with full article data (including image)
      console.log(`[CardsPage][Generate] Updating preview article...`)
      setPreviewArticle(fullArticle)

      // Wait for preview to render with new data
      await new Promise(resolve => setTimeout(resolve, 100))

      if (!cardPreviewRef.current) {
        throw new Error('Card preview not found')
      }

      // Get the actual card dimensions
      const canvasData = typeof template.canvasData === 'string' 
        ? JSON.parse(template.canvasData) 
        : template.canvasData
      const { width, height } = getCanvasDimensions(canvasData)

      console.log(`[CardsPage][Generate] Capturing card: ${width}x${height}`)

      // Create a temporary container for capturing at full size
      const captureContainer = document.createElement('div')
      captureContainer.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: ${width}px;
        height: ${height}px;
        background-color: ${canvasData.backgroundColor || '#ffffff'};
        overflow: hidden;
      `

      // Clone the preview content
      const previewClone = cardPreviewRef.current.cloneNode(true) as HTMLElement
      previewClone.style.transform = 'none'
      previewClone.style.position = 'absolute'
      previewClone.style.left = '0'
      previewClone.style.top = '0'
      captureContainer.appendChild(previewClone)
      document.body.appendChild(captureContainer)

      // Capture at full size
      const canvas = await html2canvas(captureContainer, {
        width: width,
        height: height,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        windowWidth: width,
        windowHeight: height,
      })

      // Clean up
      document.body.removeChild(captureContainer)

      const imageUrl = canvas.toDataURL('image/png')

      const saveResponse = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: fullArticle,
          templateId: selectedTemplate,
          imageUrl
        })
      })

      const data = await saveResponse.json()
      
      if (data.success) {
        setGeneratedCard(data.card)
        fetchCards()
      } else {
        setError(data.error || 'Failed to save card')
      }
    } catch (error) {
      console.error('Error generating card:', error)
      setError('Failed to generate card. Check console for details.')
    } finally {
      setGenerating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const renderCardPreview = () => {
    const template = templates.find(t => t.id === selectedTemplate)
    const article = previewArticle || articles.find(a => a.id === selectedArticle)
    
    if (!template || !article) return null

    const canvasData = typeof template.canvasData === 'string' 
      ? JSON.parse(template.canvasData) 
      : template.canvasData

    const { width, height } = getCanvasDimensions(canvasData)
    const objects = canvasData.objects || []
    const backgroundImage = canvasData.backgroundImage
    const backgroundColor = canvasData.backgroundColor || '#ffffff'

    const fontFaceStyles = getFontFaceStyles(fonts)

    // Calculate background style for proper cover fit
    let bgStyle: React.CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      position: 'relative',
      backgroundColor: backgroundColor,
      overflow: 'hidden',
      border: '1px solid #e0e0e0',
    }

    if (backgroundImage?.src) {
      bgStyle.backgroundImage = `url(${backgroundImage.src})`
      bgStyle.backgroundSize = 'cover'
      bgStyle.backgroundPosition = 'center'
      bgStyle.backgroundRepeat = 'no-repeat'
    }

    return (
      <>
        <style>{fontFaceStyles}</style>
        <div 
          ref={cardPreviewRef}
          style={bgStyle}
        >
        {objects.map((obj: any, index: number) => {
          const type = (obj.type || '').toLowerCase()
          const dynamicField = obj.dynamicField || 'none'
          
          console.log(`Object ${index}: type=${type}, dynamicField=${dynamicField}, text=${obj.text || 'N/A'}`)
          console.log('  Article sanitizedTitle:', article.sanitizedTitle || article.title)
          console.log('  Article description:', article.description ? article.description.substring(0, 50) + '...' : 'N/A')
          console.log('  Article image:', article.image || 'N/A')
          
          let left = obj.left || 0
          let top = obj.top || 0
          
          if (obj.originX === 'center') {
            left = left - ((obj.width || 0) * (obj.scaleX || 1)) / 2
          }
          if (obj.originY === 'center') {
            top = top - ((obj.height || 0) * (obj.scaleY || 1)) / 2
          }

          if (type === 'itext' || type === 'text' || type === 'i-text') {
            let text = obj.text || ''
            
            if (dynamicField === 'title') {
              text = article.sanitizedTitle || article.title
            } else if (dynamicField === 'date') {
              text = article.publishedAt 
                ? formatDate(article.publishedAt)
                : ''
            } else if (['subtitle', 'description', 'description_1', 'description'].includes(dynamicField)) {
              text = article.description ? article.description : ''
            } else if (dynamicField === 'author') {
              text = article.author || ''
            } else if (dynamicField === 'category') {
              text = article.category || ''
            }

            const objWidth = (obj.width || 200) * (obj.scaleX || 1)
            const objHeight = (obj.height || 50) * (obj.scaleY || 1)
            const fontSize = obj.fontSize || 24
            const fontSizeScaled = fontSize * (obj.scaleX || 1)
            const lineHeight = obj.lineHeight || 1.2

            console.log(`  Text obj: width=${obj.width}, scaleX=${obj.scaleX}, calculatedWidth=${objWidth}, fontSize=${fontSize}, scaledFontSize=${fontSizeScaled}`)

            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: left,
                  top: top,
                  width: objWidth,
                  fontSize: `${fontSizeScaled}px`,
                  color: obj.fill || '#000000',
                  fontFamily: obj.fontFamily || 'Arial, sans-serif',
                  fontWeight: obj.fontWeight || 'normal',
                  fontStyle: obj.fontStyle || 'normal',
                  lineHeight: lineHeight,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  textAlign: obj.textAlign || 'left',
                  textDecoration: obj.underline ? 'underline' : 
                                 obj.linethrough ? 'line-through' : 'none',
                }}
              >
                {text}
              </div>
            )
          }
          
          if (type === 'rect') {
            const rectWidth = (obj.width || 100) * (obj.scaleX || 1)
            const rectHeight = (obj.height || 100) * (obj.scaleY || 1)
            
            if (dynamicField === 'image' && article.image) {
              return (
                <img
                  key={index}
                  src={article.image}
                  alt="Article"
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    left: left,
                    top: top,
                    width: rectWidth,
                    height: rectHeight,
                    objectFit: 'cover',
                  }}
                />
              )
            }
            
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: left,
                  top: top,
                  width: rectWidth,
                  height: rectHeight,
                  backgroundColor: obj.fill || '#e0e0e0',
                  border: obj.strokeWidth > 0 ? `${Math.max(1, (obj.strokeWidth || 1) * (obj.scaleX || 1))}px solid ${obj.stroke || '#000000'}` : 'none',
                  borderRadius: (obj.rx || 0) > 0 ? `${obj.rx * (obj.scaleX || 1)}px` : '0',
                }}
              />
            )
          }
          
          if (type === 'circle') {
            const radius = (obj.radius || 25) * (obj.scaleX || 1)
            
            if (dynamicField === 'image' && article.image) {
              return (
                <img
                  key={index}
                  src={article.image}
                  alt="Article"
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    left: left - radius,
                    top: top - radius,
                    width: radius * 2,
                    height: radius * 2,
                    objectFit: 'cover',
                    borderRadius: '50%',
                  }}
                />
              )
            }
            
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: left - radius,
                  top: top - radius,
                  width: radius * 2,
                  height: radius * 2,
                  backgroundColor: obj.fill || '#e0e0e0',
                  border: obj.strokeWidth > 0 ? `${obj.strokeWidth}px solid ${obj.stroke || '#000000'}` : 'none',
                  borderRadius: '50%',
                }}
              />
            )
          }
          
          // Handle image objects
          if (type === 'image' || type === 'fabric-image') {
            const imgWidth = (obj.width || 100) * (obj.scaleX || 1)
            const imgHeight = (obj.height || 100) * (obj.scaleY || 1)
            
            // Check if there's a saved image src
            const imageSrc = obj._imageSrc || obj.src
            
            if (imageSrc) {
              return (
                <img
                  key={index}
                  src={imageSrc}
                  alt="Canvas image"
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    left: left,
                    top: top,
                    width: imgWidth,
                    height: imgHeight,
                    objectFit: 'cover',
                  }}
                />
              )
            }
            
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: left,
                  top: top,
                  width: imgWidth,
                  height: imgHeight,
                  backgroundColor: '#e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="text-xs text-gray-500">Image</span>
              </div>
            )
          }
          
          return null
        })}
      </div>
      </>
    )
  }

  const selectedArticleData = articles.find(a => a.id === selectedArticle)
  const selectedTemplateData = templates.find(t => t.id === selectedTemplate)

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">News Cards</h1>
            <p className="text-muted-foreground mt-2">
              Generate cards from Bangladesh Guardian articles using your templates
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="flex gap-4 mb-8">
            <Button
              variant={activeTab === 'create' ? 'default' : 'outline'}
              onClick={() => setActiveTab('create')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Card
            </Button>
            <Button
              variant={activeTab === 'view' ? 'default' : 'outline'}
              onClick={() => setActiveTab('view')}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Cards ({cards.length})
            </Button>
          </div>

          {activeTab === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Newspaper className="w-5 h-5" />
                      Select Article
                    </CardTitle>
                    <CardDescription>
                      Choose an article from Bangladesh Guardian
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedArticle} onValueChange={setSelectedArticle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an article" />
                      </SelectTrigger>
                      <SelectContent>
                        {articles.map((article) => (
                          <SelectItem key={article.id} value={article.id}>
                            <div className="max-w-[300px] truncate">
                              {article.title}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedArticleData && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <h4 className="font-medium text-sm mb-1 line-clamp-2">
                          {selectedArticleData.title}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {selectedArticleData.category}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Select Template
                    </CardTitle>
                    <CardDescription>
                      Choose a template for your card
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => {
                          const canvasData = typeof template.canvasData === 'string' 
                            ? JSON.parse(template.canvasData) 
                            : template.canvasData
                          const { width, height } = getCanvasDimensions(canvasData)
                          return (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} ({width}×{height})
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>

                    {selectedTemplateData && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <h4 className="font-medium text-sm">{selectedTemplateData.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {selectedTemplateData.category}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleGenerateCard}
                      disabled={generating || !selectedArticle || !selectedTemplate}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5 mr-2" />
                          Generate Card
                        </>
                      )}
                    </Button>

                    {generatedCard && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 mb-2">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium text-sm">Card Generated!</span>
                        </div>
                        <Button 
                          className="w-full"
                          onClick={() => handleDownloadCard(
                            generatedCard.imageUrl,
                            selectedArticleData?.title || 'card'
                          )}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Card
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Preview
                  </CardTitle>
                  <CardDescription>
                    Full size preview - Card will be generated at this size
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div 
                    className="flex items-center justify-center bg-muted rounded-lg p-4 overflow-auto"
                    style={{ maxHeight: '500px' }}
                  >
                    {selectedArticle && selectedTemplate ? (
                      <div className="overflow-auto" style={{ maxWidth: '100%' }}>
                        {renderCardPreview()}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Select an article and template to preview</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'view' && (
            <div>
              {cards.length === 0 ? (
                <div className="text-center py-16">
                  <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No cards yet</h3>
                  <p className="text-muted-foreground">
                    Create your first card using the Create tab
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cards.map((card) => (
                    <Card key={card.id} className="overflow-hidden">
                      <div className="aspect-video bg-muted flex items-center justify-center p-4">
                        {card.imageUrl ? (
                          <img 
                            src={card.imageUrl} 
                            alt="Card preview"
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        ) : (
                          <ImageIcon className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h4 className="font-medium text-sm mb-1 line-clamp-1">
                          {card.sourceTitle}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Template: {card.templateName}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant={card.status === 'GENERATED' ? 'default' : 'secondary'}>
                            {card.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(card.createdAt)}
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full mt-3"
                          onClick={() => handleDownloadCard(card.imageUrl, card.sourceTitle)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
