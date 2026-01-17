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
        // Helper to ensure we have a developer user if auth is bypassed
        let userId = user?.id
        if (!userId) {
            // Development fallback: find or create dev user
            const devUser = await prisma.user.upsert({
                where: { email: 'dev@example.com' },
                update: {},
                create: {
                    email: 'dev@example.com',
                    name: 'Developer',
                    role: 'ADMIN'
                }
            })
            userId = devUser.id
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
        }

        const source = await prisma.newsSource.create({
            data: {
                name,
                type,
                config,
                userId,
                // Default update frequency 60 mins
                updateFrequency: 60,
            },
        })

        return NextResponse.json(source, { status: 201 })
    } catch (error) {
        console.error('Error creating source:', error)
        return NextResponse.json({ error: 'Failed to create source' }, { status: 500 })
    }
}
