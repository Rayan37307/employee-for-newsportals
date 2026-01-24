
import db from '@/lib/db'
import { generateCardImage } from '@/lib/card-generator-puppeteer'
import { compositeImage, getImagePlaceholder } from '@/lib/image-processor'
import { publishToFacebook } from '@/lib/social-publisher'
import { runAutopilot } from './services/autopilot-service'

export async function processScheduledPosts() {
    const now = new Date()
    const posts = await db.post.findMany({
        where: {
            status: 'QUEUED',
            scheduledFor: { lte: now }
        },
        include: {
            socialAccount: true,
            newsCard: {
                include: {
                    template: true,
                    dataMapping: true
                }
            }
        },
        take: 10 // Process in batches
    })

    console.log(`[Scheduler] Found ${posts.length} due posts`)
    const results = []

    for (const post of posts) {
        const logPrefix = '[Scheduler][Image]';
        try {
            console.log(`${logPrefix} Processing post ${post.id}`);

            const { newsCard, socialAccount } = post
            if (!newsCard || !socialAccount) {
                throw new Error('Missing NewsCard or SocialAccount')
            }

            // 1. Regenerate Image (ensure fresh data/mapping)
            const newsItem = newsCard.sourceData as { image?: string; title?: string; description?: string; date?: string; author?: string; category?: string } || {}
            const mapping = (newsCard.dataMapping?.sourceFields as Record<string, string>) || {}

            if (!newsItem || !newsCard.template || !mapping) {
                throw new Error('Missing source data or template')
            }

            console.log(`${logPrefix} Generating card for scheduled post...`);
            let imageBuffer = await generateCardImage({
                template: newsCard.template,
                mapping: mapping,
                newsItem: newsItem
            });
            console.log(`${logPrefix} Base card generated: ${imageBuffer.length} bytes`);

            // Composite image if available in the news item
            if (newsItem.image) {
                console.log(`${logPrefix} Image present: ${newsItem.image.startsWith('data:') ? 'dataurl' : newsItem.image.substring(0, 60)}`);
                const canvasData = typeof newsCard.template.canvasData === 'string'
                    ? JSON.parse(newsCard.template.canvasData)
                    : newsCard.template.canvasData;

                console.log(`${logPrefix} Searching for placeholder...`);
                const placeholder = getImagePlaceholder(canvasData);

                if (placeholder) {
                    console.log(`${logPrefix} Placeholder found: (${placeholder.x}, ${placeholder.y}) size ${placeholder.width}x${placeholder.height}`);
                    console.log(`${logPrefix} Starting compositing...`);
                    imageBuffer = await compositeImage(imageBuffer, {
                        imageUrl: newsItem.image,
                        placeholderX: placeholder.x,
                        placeholderY: placeholder.y,
                        placeholderWidth: Math.round(placeholder.width),
                        placeholderHeight: Math.round(placeholder.height)
                    });
                    console.log(`${logPrefix} Compositing complete: ${imageBuffer.length} bytes`);
                } else {
                    console.warn(`${logPrefix} WARNING: No placeholder found - skipping compositing`);
                }
            } else {
                console.log(`${logPrefix} INFO: No image in newsItem - skipping compositing`);
            }

            // 2. Publish
            console.log(`${logPrefix} Publishing to Facebook...`);
            const result = await publishToFacebook({
                pageId: socialAccount.pageId,
                accessToken: socialAccount.accessToken,
                caption: post.content, // Use content stored in Post (or regenerate?)
                imageBuffer: imageBuffer
            })

            // 3. Update Status
            await db.post.update({
                where: { id: post.id },
                data: {
                    status: 'POSTED',
                    postedAt: new Date(),
                    platformPostId: result.postId || result.id,
                    platformUrl: `https://facebook.com/${result.postId || result.id}`
                }
            })

            // Also update NewsCard status
            await db.newsCard.update({
                where: { id: newsCard.id },
                data: { status: 'POSTED' }
            })

            console.log(`${logPrefix} SUCCESS: Post ${post.id} published`);
            results.push({ id: post.id, status: 'SUCCESS', platformId: result.id })

        } catch (e: any) {
            const errorMessage = e.message || 'Unknown error';
            console.error(`${logPrefix} ERROR: Post ${post.id} failed - ${errorMessage}`);
            console.error(`${logPrefix} Stack: ${e.stack?.split('\n').slice(0, 3).join('\n') || 'N/A'}`);

            await db.post.update({
                where: { id: post.id },
                data: { status: 'FAILED' } // Store error message if we had a field?
            })

            results.push({ id: post.id, status: 'FAILED', error: errorMessage })
        }
    }

    return results
}

export async function processAutopilotRuns() {
    console.log('[Scheduler][Autopilot] Processing autopilot runs...')
    
    const now = new Date()
    
    const settings = await db.autopilotSettings.findMany({
        where: {
            isEnabled: true,
            OR: [
                { lastRunAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } }, // More than 15 mins ago
                { lastRunAt: null } // Never run
            ]
        }
    })

    console.log(`[Scheduler][Autopilot] Found ${settings.length} enabled users to process`)

    const results = []

    for (const setting of settings) {
        try {
            console.log(`[Scheduler][Autopilot] Running autopilot for user ${setting.userId}`)
            
            const result = await runAutopilot(setting.userId)
            
            results.push({
                userId: setting.userId,
                success: result.success,
                newsFound: result.newsFound,
                cardsCreated: result.cardsCreated,
                errors: result.errors
            })

            console.log(`[Scheduler][Autopilot] Completed for user ${setting.userId}: ${result.cardsCreated} cards created`)
        } catch (e: any) {
            console.error(`[Scheduler][Autopilot] Error for user ${setting.userId}: ${e.message}`)
            results.push({
                userId: setting.userId,
                success: false,
                error: e.message
            })
        }
    }

    return results
}
