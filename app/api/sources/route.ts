import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

// GET /api/sources - List all sources
export async function GET() {
    try {
        const user = await getCurrentUser()
        // For development, we might not always have a user
        const userId = user?.id

        const sources = await prisma.newsSource.findMany({
            where: userId ? { userId } : {},
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json(sources)
    } catch (error) {
        console.error('Error fetching sources:', error)
        return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
    }
}

// POST /api/sources - Create new source
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser()

        if (!user) {
            return NextResponse.json({ error: 'Authentication required. Please sign in to create sources.' }, { status: 401 })
        }

        const body = await request.json()
        const { name, type, url, category } = body

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
        }

        // Configure based on type
        let config = {}
        if (type === 'RSS') {
            if (!url) return NextResponse.json({ error: 'RSS URL is required' }, { status: 400 })
            config = { url, category }
        } else if (type === 'AUTO') {
            if (!url) return NextResponse.json({ error: 'Website URL is required' }, { status: 400 })
            config = { url, usePuppeteer: false }
        } else if (type === 'MANUAL') {
            config = {}
        } else if (type === 'API') {
            if (!url) return NextResponse.json({ error: 'API endpoint URL is required' }, { status: 400 })
            config = { endpoint: url }
        } else if (type === 'BANGLADESH_GUARDIAN') {
            config = { url: 'https://www.bangladeshguardian.com/latest' }
        }

        console.log('Creating source:', { name, type, config, userId: user.id })

        const source = await prisma.newsSource.create({
            data: {
                name,
                type,
                config,
                userId: user.id,
                updateFrequency: 60,
            },
        })

        console.log('Source created:', source.id)
        return NextResponse.json(source, { status: 201 })
    } catch (error) {
        console.error('Error creating source:', error)
        return NextResponse.json({ 
            error: 'Failed to create source',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
