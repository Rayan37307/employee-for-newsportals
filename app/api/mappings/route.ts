import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

// GET /api/mappings - List data mappings
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const sourceId = searchParams.get('sourceId')
        const templateId = searchParams.get('templateId')

        const mappings = await prisma.dataMapping.findMany({
            where: {
                ...(sourceId && { newsSourceId: sourceId }),
                ...(templateId && { templateId: templateId }),
            },
            include: {
                newsSource: { select: { name: true } },
                template: { select: { name: true } }
            }
        })

        return NextResponse.json(mappings)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 })
    }
}

// POST /api/mappings - Create or Update mapping
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser()
        const userId = user?.id || (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id || ''

        const body = await request.json()
        const { sourceId, templateId, mappings } = body

        if (!sourceId || !templateId || !mappings) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Check if mapping already exists
        const existing = await prisma.dataMapping.findFirst({
            where: {
                newsSourceId: sourceId,
                templateId: templateId,
            }
        })

        if (existing) {
            // Update
            const updated = await prisma.dataMapping.update({
                where: { id: existing.id },
                data: { sourceFields: mappings } // Storing as JSON
            })
            return NextResponse.json(updated)
        } else {
            // Create
            const created = await prisma.dataMapping.create({
                data: {
                    newsSourceId: sourceId,
                    templateId: templateId,
                    sourceFields: mappings,
                    userId
                }
            })
            return NextResponse.json(created)
        }

    } catch (error) {
        console.error('Mapping error:', error)
        return NextResponse.json({ error: 'Failed to save mapping' }, { status: 500 })
    }
}
