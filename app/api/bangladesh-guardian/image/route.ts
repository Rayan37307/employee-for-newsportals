import { NextResponse } from 'next/server'
import axios from 'axios'
import { load } from 'cheerio'

function isProbablyLogo(url: string): boolean {
  if (!url) return true
  const lowered = url.toLowerCase()
  const bannedKeywords = ['logo', 'favicon', 'sprite', 'placeholder', 'default', 'avatar']
  return bannedKeywords.some(k => lowered.includes(k))
}

async function downloadImageAsDataUrl(imageUrl: string): Promise<string | null> {
  console.log(`[BangladeshGuardian][ImageAPI] Downloading image: ${imageUrl.substring(0, 80)}`)
  
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Accept': 'image/*',
      }
    })

    if (response.status !== 200) {
      console.warn(`[BangladeshGuardian][ImageAPI] Image download failed: status=${response.status}`)
      return null
    }

    const contentType = response.headers['content-type'] || 'image/jpeg'
    const buffer = Buffer.from(response.data)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${contentType};base64,${base64}`
    
    console.log(`[BangladeshGuardian][ImageAPI] Image downloaded: ${buffer.length} bytes, type=${contentType}`)
    return dataUrl
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[BangladeshGuardian][ImageAPI] Image download failed: ${errorMessage}`)
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const articleUrl = searchParams.get('url')

  console.log(`[BangladeshGuardian][ImageAPI] Requested URL: ${articleUrl?.substring(0, 80)}`)

  if (!articleUrl) {
    console.warn('[BangladeshGuardian][ImageAPI] ERROR: No URL parameter provided')
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 })
  }

  try {
    console.log(`[BangladeshGuardian][ImageAPI] Fetching article page...`)
    const response = await axios.get(articleUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' 
      },
      timeout: 15000
    })
    console.log(`[BangladeshGuardian][ImageAPI] Page fetched: status=${response.status}, size=${response.data.length} bytes`)

    const $ = load(response.data)

    // Try meta tags
    const metaImage = $('meta[property="og:image"], meta[name="twitter:image"]').attr('content')
    console.log(`[BangladeshGuardian][ImageAPI] Meta og:image: ${metaImage ? 'found' : 'not found'}`)

    if (metaImage && !isProbablyLogo(metaImage)) {
      console.log(`[BangladeshGuardian][ImageAPI] Downloading meta image...`)
      const dataUrl = await downloadImageAsDataUrl(metaImage)
      if (dataUrl) {
        console.log(`[BangladeshGuardian][ImageAPI] SUCCESS: Returning meta image as data URL (${dataUrl.length} chars)`)
        return NextResponse.json({ image: dataUrl })
      }
    }

    // Try JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]')
    console.log(`[BangladeshGuardian][ImageAPI] JSON-LD scripts: ${jsonLdScripts.length}`)

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
            console.log(`[BangladeshGuardian][ImageAPI] Downloading JSON-LD image...`)
            const dataUrl = await downloadImageAsDataUrl(imageUrl)
            if (dataUrl) {
              console.log(`[BangladeshGuardian][ImageAPI] SUCCESS: Returning JSON-LD image as data URL`)
              return NextResponse.json({ image: dataUrl })
            }
          }
        }
      } catch {
        continue
      }
    }

    // Try in-article images
    const imgElements = $('img')
    console.log(`[BangladeshGuardian][ImageAPI] <img> elements: ${imgElements.length}`)

    let checkedCount = 0
    for (const img of imgElements) {
      const src = $(img).attr('src') || 
                 $(img).attr('data-src') || 
                 $(img).attr('data-original') ||
                 $(img).attr('srcset')?.split(',')[0]?.split(' ')[0]
      
      if (!src) continue
      checkedCount++

      if (isProbablyLogo(src)) {
        console.log(`[BangladeshGuardian][ImageAPI] Skipping img[${checkedCount}]: probable logo`)
        continue
      }

      console.log(`[BangladeshGuardian][ImageAPI] Downloading <img> element[${checkedCount}]...`)
      const dataUrl = await downloadImageAsDataUrl(src)
      if (dataUrl) {
        console.log(`[BangladeshGuardian][ImageAPI] SUCCESS: Returning <img> as data URL`)
        return NextResponse.json({ image: dataUrl })
      }
    }

    console.warn('[BangladeshGuardian][ImageAPI] WARNING: No suitable image found - returning null')
    return NextResponse.json({ image: null })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[BangladeshGuardian][ImageAPI] ERROR: ${errorMessage}`)
    return NextResponse.json({ image: null, error: 'Failed to fetch image' })
  }
}
