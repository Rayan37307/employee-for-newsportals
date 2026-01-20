import { NextResponse } from 'next/server'
import axios from 'axios'
import { load } from 'cheerio'

function isProbablyLogo(url: string): boolean {
  if (!url) return true
  const lowered = url.toLowerCase()
  const bannedKeywords = ['logo', 'favicon', 'sprite', 'placeholder', 'default', 'avatar']
  return bannedKeywords.some(k => lowered.includes(k))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const articleUrl = searchParams.get('url')

  if (!articleUrl) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 })
  }

  try {
    const response = await axios.get(articleUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' 
      },
      timeout: 15000
    })

    const $ = load(response.data)

    // Try meta tags
    const metaImage = $('meta[property="og:image"], meta[name="twitter:image"]').attr('content')
    if (metaImage && !isProbablyLogo(metaImage)) {
      return NextResponse.json({ image: metaImage })
    }

    // Try JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]')
    for (const script of jsonLdScripts) {
      try {
        const jsonData = JSON.parse($(script).text())
        if (jsonData && typeof jsonData === 'object') {
          let imageUrl: string | null = null
          
          if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
              if (item.image) {
                imageUrl = typeof item.image === 'string' ? item.image : item.image.url
                break
              }
            }
          } else if (jsonData.image) {
            imageUrl = typeof jsonData.image === 'string' ? jsonData.image : jsonData.image.url
          }
          
          if (imageUrl && !isProbablyLogo(imageUrl)) {
            return NextResponse.json({ image: imageUrl })
          }
        }
      } catch {
        continue
      }
    }

    // Try in-article images
    const imgElements = $('img')
    for (const img of imgElements) {
      const src = $(img).attr('src') || 
                 $(img).attr('data-src') || 
                 $(img).attr('data-original') ||
                 $(img).attr('srcset')?.split(',')[0]?.split(' ')[0]
      
      if (!src) continue
      
      if (!isProbablyLogo(src)) {
        return NextResponse.json({ image: src })
      }
    }

    return NextResponse.json({ image: null })

  } catch (error) {
    console.error('Error fetching article image:', error)
    return NextResponse.json({ image: null, error: 'Failed to fetch image' })
  }
}
