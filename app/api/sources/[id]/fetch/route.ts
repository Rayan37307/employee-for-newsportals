import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'
import { NewsSourceManager } from '@/lib/news-source-manager'

// POST /api/sources/[id]/fetch - Trigger a fetch
export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const user = await getCurrentUser()

        // Check if source exists
        const source = await prisma.newsSource.findUnique({
            where: { id: params.id },
        })

        if (!source) {
            return NextResponse.json({ error: 'Source not found' }, { status: 404 })
        }

        // Check ownership (unless admin)
        if (user?.role !== 'ADMIN' && source.userId !== user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const manager = new NewsSourceManager()
        const config = source.config as any

        // Add the source URL if not present
        if (!config.url && source.type === 'AUTO') {
            config.url = config.endpoint || config.rssUrl // Fallback for different config formats
        }

        try {
            const result = await manager.fetchNewsSource(source.type, config)

            // Update source status
            const updateData: any = {
                lastFetchedAt: new Date(),
            }

            if (result.success) {
                updateData.lastError = null
            } else {
                updateData.lastError = result.error || 'Unknown error'
            }

            const updatedSource = await prisma.newsSource.update({
                where: { id: params.id },
                data: updateData
            })

            return NextResponse.json({
                source: updatedSource,
                items: result.items.slice(0, 10), // Return up to 10 items
                method: result.method,
                success: result.success,
                error: result.error
            })

        } catch (fetchError: any) {
            console.error('Fetch error:', fetchError)
            await prisma.newsSource.update({
                where: { id: params.id },
                data: {
                    lastError: fetchError.message || 'Unknown error',
                    lastFetchedAt: new Date()
                }
            })
            return NextResponse.json({
                error: 'Failed to fetch news source',
                details: fetchError.message
            }, { status: 502 })
        }

    } catch (error: any) {
        console.error('Error processing fetch request:', error)
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message,
            stack: error.stack
        }, { status: 500 })
    }
}
