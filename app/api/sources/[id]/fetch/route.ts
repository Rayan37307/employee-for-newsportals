import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser()

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

        if (source.type !== 'RSS') {
            return NextResponse.json({ error: 'Only RSS sources are currently supported' }, { status: 400 })
        }

        const config = source.config as { url: string }
        if (!config.url) {
            return NextResponse.json({ error: 'Invalid configuration: URL missing' }, { status: 500 })
        }

        try {
            const feed = await parser.parseURL(config.url)

            // Update source status
            const updatedSource = await prisma.newsSource.update({
                where: { id: params.id },
                data: {
                    lastFetchedAt: new Date(),
                    lastError: null,
                }
            })

            return NextResponse.json({
                source: updatedSource,
                items: feed.items.slice(0, 5)
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
            return NextResponse.json({ error: 'Failed to fetch RSS feed' }, { status: 502 })
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
