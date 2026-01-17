
import { processScheduledPosts } from '../lib/scheduler'
import db from '../lib/db'

async function main() {
    console.log('--- Setting up Test Data ---')
    // Ensure we have dependencies
    const uniqueSuffix = Date.now().toString()

    // User
    const user = await db.user.upsert({
        where: { email: 'scheduler-test@example.com' },
        update: {},
        create: { email: 'scheduler-test@example.com', name: 'Scheduler Tester' }
    })

    // 1. Source (using upsert or create with unique name if needed, but Manual is fine)
    const source = await db.newsSource.create({
        data: {
            name: `Test Source ${uniqueSuffix}`,
            type: 'MANUAL',
            userId: user.id,
            config: {}
        }
    })

    // 2. Template
    const template = await db.template.create({
        data: {
            name: `Test Template ${uniqueSuffix}`,
            canvasData: JSON.stringify({ version: '5.3.0', objects: [] }),
            userId: user.id
        }
    })

    // 3. Mapping
    const mapping = await db.dataMapping.create({
        data: {
            newsSourceId: source.id,
            templateId: template.id,
            userId: user.id,
            sourceFields: { title: 'T', _social_caption_field: 'title' }
        }
    })

    // 4. Social Account (Unique pageId)
    const socialAccount = await db.socialAccount.create({
        data: {
            platform: 'FACEBOOK',
            pageId: `123-${uniqueSuffix}`,
            pageName: 'Test Page',
            accessToken: 'mock-token',
            userId: user.id
        }
    })

    console.log('--- Creating Queued Post ---')
    try {
        const post = await db.post.create({
            data: {
                content: 'Scheduled Content',
                status: 'QUEUED',
                socialAccount: { connect: { id: socialAccount.id } },
                scheduledFor: new Date(Date.now() - 1000),
                newsCard: {
                    create: {
                        status: 'QUEUED',
                        template: { connect: { id: template.id } },
                        dataMapping: { connect: { id: mapping.id } },
                        sourceData: { title: 'News Item Title' },
                        imageUrl: 'pending'
                    }
                }
            }
        })

        console.log(`Created Post ${post.id} with status QUEUED`)

        console.log('--- Running Scheduler ---')
        const results = await processScheduledPosts()
        console.log('Scheduler Results:', results)

        // Verify
        const updated = await db.post.findUnique({ where: { id: post.id } })
        console.log('Updated Post Status:', updated?.status)

        if (updated?.status === 'POSTED' || updated?.status === 'FAILED') {
            console.log('SUCCESS: Scheduler processed the post.')
        } else {
            console.log('FAILURE: Post status not updated.')
            process.exit(1)
        }

    } catch (e) {
        console.error('Test Failed:', e)
    } finally {
        // Cleanup based on IDs created in this run
        // (If crash options above prevent getting here, data remains, but uniqueSuffix prevents collision next time)
        if (socialAccount) await db.socialAccount.delete({ where: { id: socialAccount.id } }).catch(() => { })
        if (mapping) await db.dataMapping.delete({ where: { id: mapping.id } }).catch(() => { })
        if (template) await db.template.delete({ where: { id: template.id } }).catch(() => { })
        if (source) await db.newsSource.delete({ where: { id: source.id } }).catch(() => { })
        // Keep user
    }
}

main().catch(console.error)
