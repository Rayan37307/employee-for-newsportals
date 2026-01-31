import prisma from '@/lib/db'
import { generateCardImage } from '@/lib/card-generator-puppeteer'
import { deserializeTemplate } from '@/lib/template-utils'
import { checkForSensitiveContent } from '@/lib/sensitive-content'

export interface AutopilotResult {
  success: boolean
  newsFound: number
  cardsCreated: number
  skipped: number
  errors: string[]
  runId: string
}

interface ArticleData {
  title?: string
  description?: string
  content?: string
  author?: string
  publishedAt?: string
  image?: string
  category?: string
  link?: string
  sanitizedTitle?: string
}

interface NewsAgentResult {
  articles: ArticleData[]
}

export async function runAutopilot(userId: string): Promise<AutopilotResult> {
  const result: AutopilotResult = {
    success: true,
    newsFound: 0,
    cardsCreated: 0,
    skipped: 0,
    errors: [],
    runId: '',
  }

  // Create run record
  const run = await prisma.autopilotRun.create({
    data: {
      userId,
      status: 'RUNNING',
    },
  })
  result.runId = run.id

  // Get autopilot settings
  const settings = await prisma.autopilotSettings.findFirst({
    where: { userId, isEnabled: true },
  })

  if (!settings) {
    result.errors.push('Autopilot is not enabled')
    result.success = false
    await completeRun(run.id, result)
    return result
  }

  // Check if template is selected
  if (!settings.templateId) {
    result.errors.push('No template selected for autopilot')
    result.success = false
    await completeRun(run.id, result)
    return result
  }

  // Get template
  const template = await prisma.template.findFirst({
    where: { id: settings.templateId, userId },
  })

  if (!template) {
    result.errors.push('Selected template not found')
    result.success = false
    await completeRun(run.id, result)
    return result
  }

  // Get sensitive words if filtering enabled
  let sensitiveWords: string[] = []
  if (settings.sensitiveFilter) {
    const words = await prisma.sensitiveWord.findMany({
      where: { userId, isActive: true },
      select: { word: true },
    })
    sensitiveWords = words.map((w: { word: string }) => w.word)
  }

   // Use empty mapping since dataMapping model was removed
   const dataMapping = null;

  try {
    // Get autopilot settings
    const settings = await prisma.autopilotSettings.findFirst({
      where: { userId, isEnabled: true },
    })

    if (!settings) {
      result.errors.push('Autopilot is not enabled')
      result.success = false
      await completeRun(run.id, result)
      return result
    }

    // Check if template is selected
    if (!settings.templateId) {
      result.errors.push('No template selected for autopilot')
      result.success = false
      await completeRun(run.id, result)
      return result
    }

    // Get template
    const template = await prisma.template.findFirst({
      where: { id: settings.templateId, userId },
    })

    if (!template) {
      result.errors.push('Selected template not found')
      result.success = false
      await completeRun(run.id, result)
      return result
    }

    // Get sensitive words if filtering enabled
    let sensitiveWords: string[] = []
    if (settings.sensitiveFilter) {
      const words = await prisma.sensitiveWord.findMany({
        where: { userId, isActive: true },
        select: { word: true },
      })
      sensitiveWords = words.map((w: { word: string }) => w.word)
    }

     // Use empty mapping since dataMapping model was removed
     const dataMapping = null;

     // Get news from Bangladesh Guardian
     let newsArticles: ArticleData[] = []

     try {
       const { getLatestNews } = await import('@/lib/bangladesh-guardian-agent')
       const articles = await getLatestNews()

       newsArticles = articles.map((article: any) => ({
         title: article.title,
         description: article.description,
         content: '',
         author: 'Bangladesh Guardian',
         publishedAt: article.date || new Date().toISOString(),
         image: article.image,
         category: 'News',
         link: article.link,
         sanitizedTitle: article.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
       }))
     } catch (error) {
       const errorMsg = `Failed to fetch from Bangladesh Guardian: ${error}`
       result.errors.push(errorMsg)
       console.error('[Autopilot] Error fetching from BG:', error)
     }

    result.newsFound = newsArticles.length

    // Process each article
    for (const article of newsArticles) {
      try {
        // Check for sensitive content
        if (settings.sensitiveFilter && sensitiveWords.length > 0) {
          const titleToCheck = article.title || article.sanitizedTitle || ''
          const isSensitive = checkForSensitiveContent(titleToCheck, sensitiveWords)
          
          if (isSensitive) {
            console.log(`[Autopilot] Skipping sensitive content: ${titleToCheck.substring(0, 50)}...`)
            result.skipped++
            continue
          }
        }

        // Check for duplicates using link
        const articleLink = article.link || ''
        if (articleLink) {
          const existingCard = await prisma.newsCard.findFirst({
            where: {
              templateId: settings.templateId!,
              sourceData: {
                path: ['link'],
                equals: articleLink,
              },
            },
          })

          if (existingCard) {
            console.log(`[Autopilot] Duplicate found, skipping: ${article.title?.substring(0, 50)}...`)
            result.skipped++
            continue
          }
        }

        // Check using sanitized title as alternative
        if (article.sanitizedTitle) {
          const existingByTitle = await prisma.newsCard.findFirst({
            where: {
              templateId: settings.templateId!,
              sourceData: {
                path: ['sanitizedTitle'],
                equals: article.sanitizedTitle,
              },
            },
          })

          if (existingByTitle) {
            console.log(`[Autopilot] Duplicate by title found, skipping: ${article.sanitizedTitle.substring(0, 50)}...`)
            result.skipped++
            continue
          }
        }

        // Generate card
        if (settings.generateCards) {
          console.log(`[Autopilot] Generating card for: ${article.title?.substring(0, 50)}...`)
          console.log(`[Autopilot] Using template ID: ${template.id}, name: ${template.name}`)

          const mapping = dataMapping
            ? { sourceFields: (dataMapping as any).sourceFields as Record<string, string> }
            : {}

          console.log(`[Autopilot] Article data:`, {
            title: article.title?.substring(0, 50),
            description: article.description?.substring(0, 50),
            image: article.image?.substring(0, 50)
          })

          const imageBuffer = await generateCardImage({
            template,
            mapping,
            newsItem: article,
          })

          // Upload image - convert Buffer to Blob properly
          const uint8Array = new Uint8Array(imageBuffer)
          const blob = new Blob([uint8Array], { type: 'image/png' })
          const formData = new FormData()
          formData.append('file', blob, 'card.png')

          const uploadResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/upload`, {
            method: 'POST',
            body: formData,
          })

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload card image')
          }

          const { url } = await uploadResponse.json()

          // Create card
          await prisma.newsCard.create({
            data: {
              imageUrl: url,
              status: 'GENERATED',
              sourceData: article as any,
              templateId: settings.templateId!,
            },
          })

          result.cardsCreated++

          // Send notification
          if (settings.notifyOnNewCard) {
            await prisma.notification.create({
              data: {
                userId,
                title: 'New Card Generated',
                message: `Card created for: ${article.title?.substring(0, 60)}...`,
                link: '/cards',
              },
            })
          }
        }
      } catch (error) {
        const errorMsg = `Error processing article: ${error}`
        result.errors.push(errorMsg)
        console.error('[Autopilot] Error processing article:', error)
      }
    }

    // Update settings with last run time
    await prisma.autopilotSettings.update({
      where: { userId: settings.userId },
      data: { lastRunAt: new Date(), lastError: null },
    })

    await completeRun(run.id, result)
    return result
  } catch (error) {
    const errorMsg = `Autopilot run failed: ${error}`
    result.errors.push(errorMsg)
    result.success = false
    console.error('[Autopilot] Fatal error:', error)
    
    // Update settings with error
    const settings = await prisma.autopilotSettings.findFirst({
      where: { userId },
    })
    if (settings) {
      await prisma.autopilotSettings.update({
        where: { userId: settings.userId },
        data: { lastError: String(error) },
      })
    }
    
    await completeRun(run.id, result)
    return result
  }
}

async function completeRun(runId: string, result: AutopilotResult) {
  await prisma.autopilotRun.update({
    where: { id: runId },
    data: {
      status: result.success ? 'COMPLETED' : 'FAILED',
      completedAt: new Date(),
      newsFound: result.newsFound,
      cardsCreated: result.cardsCreated,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    },
  })
}

export async function getAutopilotRuns(userId: string, limit = 10) {
  return prisma.autopilotRun.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

export async function getAutopilotStats(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [todayRuns, totalCards, recentRuns] = await Promise.all([
    prisma.autopilotRun.count({
      where: {
        userId,
        startedAt: { gte: today },
        status: 'COMPLETED',
      },
    }),
    prisma.newsCard.count({
      where: {
        template: { userId },
        createdAt: { gte: today },
      },
    }),
    prisma.autopilotRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        newsFound: true,
        cardsCreated: true,
        skipped: true,
        errors: true,
      },
    }),
  ])

  return {
    todayRuns,
    totalCardsToday: totalCards,
    recentRuns,
  }
}
