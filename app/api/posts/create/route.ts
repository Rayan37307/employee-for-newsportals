
import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { generateCardImage } from '@/lib/card-generator-puppeteer'
import { compositeImage, getImagePlaceholder } from '@/lib/image-processor'
import { publishToFacebook } from '@/lib/social-publisher'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        // if (!user) {
        //    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        // }
        // Dev fallback
        const userId = user?.id || 'dev-user-id'

        const body = await req.json()
        const { newsCardId, socialAccountId } = body
        // Or we might accept sourceId, templateId, newsItemId to generate on the fly
        // Let's assume we "generate and post" in one go for "Autopilot" style.
        // But the previous plan said /api/posts/create accepts sourceId, templateId, newsItemId.

        // Let's implement the flexible "Generate and Post" flow.

        const { sourceId, templateId, newsItemId, socialAccountId: targetSocialAccountId } = body

        if (!sourceId || !templateId || !newsItemId || !targetSocialAccountId) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        // 1. Fetch Data
        const source = await db.newsSource.findUnique({ where: { id: sourceId } })
        const template = await db.template.findUnique({ where: { id: templateId } })
        const mapping = await db.dataMapping.findFirst({
            where: { newsSourceId: sourceId, templateId: templateId }
        })
        const socialAccount = await db.socialAccount.findUnique({ where: { id: targetSocialAccountId } })

        if (!source || !template || !mapping || !socialAccount) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
        }

        // 2. We need the actual News Item. 
        // We don't store NewsItem in DB (only source config).
        // Except we might check 'lastFetchedAt' logic or just fetch again?
        // Or the frontend passes the entire 'item' object?
        // Ideally we should persist fetched items for history, but for now we might fetch or expect item data.
        // Or if we implemented storing NewsItems?
        // Phase 4: Fetch Source -> stores in memory? No, we didn't implement storing Items in DB in Phase 4?
        // "Fetch logic" in Phase 4 just returned JSON.
        // The implementation_plan said "Implement fetching logic".
        // Let's check 'app/api/sources/[id]/fetch/route.ts'.
        // If it returns items, we can pass the specific item data in the body or refetch.
        // Passing item data in body is easiest for MVP.

        let { newsItem, scheduledFor } = body
        if (!newsItem) {
            return NextResponse.json({ error: 'Missing newsItem data' }, { status: 400 })
        }

        // 2.5 Scheduling Logic
        if (scheduledFor) {
            const date = new Date(scheduledFor)
            if (date > new Date()) {
                // Determine caption for storage
                // @ts-ignore
                const captionField = mapping.sourceFields._social_caption_field
                const caption = (captionField && newsItem[captionField]) ? String(newsItem[captionField]) : (newsItem.title || 'Breaking News')

                // Create Queued Records
                const newsCard = await db.newsCard.create({
                    data: {
                        imageUrl: 'https://placeholder.com/pending.png',
                        status: 'QUEUED',
                        sourceData: newsItem,
                        templateId: template.id,
                        dataMappingId: mapping.id,
                        posts: {
                            create: {
                                socialAccountId: socialAccount.id,
                                content: caption,
                                status: 'QUEUED',
                                scheduledFor: date
                            }
                        }
                    }
                })
                return NextResponse.json({ success: true, message: 'Scheduled', post: newsCard })
            }
        }


        // 3. Generate Image
        let imageBuffer = await generateCardImage({
            template: template,
            mapping: mapping.sourceFields,
            newsItem: newsItem
        })

        // 3.5 Composite image if available
        if (newsItem.image) {
            const canvasData = typeof template.canvasData === 'string'
                ? JSON.parse(template.canvasData)
                : template.canvasData;
            const placeholder = getImagePlaceholder(canvasData);

            if (placeholder) {
                imageBuffer = await compositeImage(imageBuffer, {
                    imageUrl: newsItem.image,
                    placeholderX: placeholder.x,
                    placeholderY: placeholder.y,
                    placeholderWidth: Math.round(placeholder.width),
                    placeholderHeight: Math.round(placeholder.height)
                });
            }
        }

        // 4. Construct Caption
        // Check mapping for caption field
        let caption = ''
        // @ts-ignore
        const captionField = mapping.sourceFields._social_caption_field
        if (captionField && newsItem[captionField]) {
            caption = String(newsItem[captionField])
        } else {
            caption = newsItem.title || 'Breaking News'
        }

        // 5. Publish
        const result = await publishToFacebook({
            pageId: socialAccount.pageId, // fixed field name
            accessToken: socialAccount.accessToken,
            caption: caption,
            imageBuffer: imageBuffer
        })

        // 6. Save Post Record
        // We need a NewsCard record first?
        const newsCard = await db.newsCard.create({
            data: {
                imageUrl: 'https://placeholder.com/image.png', // We don't have storage yet, using placeholder or maybe base64?
                // Ideally upload to S3/Cloudinary.
                // For MVP, if we post directly, we might not have a public URL unless FB gives one.
                // FB returns post_id.
                status: 'POSTED',
                sourceData: newsItem,
                templateId: template.id,
                dataMappingId: mapping.id,
                posts: {
                    create: {
                        socialAccountId: socialAccount.id,
                        content: caption,
                        status: 'POSTED',
                        platformPostId: result.postId || result.id,
                        platformUrl: `https://facebook.com/${result.postId || result.id}`,
                        postedAt: new Date()
                    }
                }
            }
        })

        return NextResponse.json({ success: true, post: newsCard })

    } catch (error: any) {
        console.error('Posting Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to post' }, { status: 500 })
    }
}
