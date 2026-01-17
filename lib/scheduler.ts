
import db from '@/lib/db'
import { generateCardImage } from '@/lib/card-generator'
import { publishToFacebook } from '@/lib/social-publisher'

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
        try {
            console.log(`[Scheduler] Processing post ${post.id}`)

            const { newsCard, socialAccount } = post
            if (!newsCard || !socialAccount) {
                throw new Error('Missing NewsCard or SocialAccount')
            }

            // 1. Regenerate Image (ensure fresh data/mapping)
            // @ts-ignore
            const newsItem = newsCard.sourceData
            // @ts-ignore
            const mapping = newsCard.dataMapping?.sourceFields

            if (!newsItem || !newsCard.template || !mapping) {
                throw new Error('Missing source data or template')
            }

            const imageBuffer = await generateCardImage({
                template: newsCard.template,
                mapping: mapping,
                newsItem: newsItem
            })

            // 2. Publish
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

            results.push({ id: post.id, status: 'SUCCESS', platformId: result.id })

        } catch (e: any) {
            console.error(`[Scheduler] Failed post ${post.id}:`, e)

            await db.post.update({
                where: { id: post.id },
                data: { status: 'FAILED' } // Store error message if we had a field?
            })

            results.push({ id: post.id, status: 'FAILED', error: e.message })
        }
    }

    return results
}
