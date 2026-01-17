import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

// GET /api/templates - List all templates
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const isPublic = searchParams.get('public') === 'true'

    const templates = await prisma.template.findMany({
      where: {
        ...(category && category !== 'ALL' && { category: category as any }),
        ...(isPublic ? { OR: [{ isPublic: true }, { isSystem: true }] } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/templates - Create new template
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, category, canvasData, thumbnail, isPublic } = body

    if (!name || !canvasData) {
      return NextResponse.json({ error: 'Name and canvas data are required' }, { status: 400 })
    }

    //Try to get user, but create template even without authentication for development
    let userId = 'anonymous-user'
    try {
      const user = await getCurrentUser()
      if (user) {
        userId = user.id
      }
    } catch (error) {
      console.log('No authenticated user, creating anonymous template')
    }

    // Create anonymous user if doesn't exist
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'anonymous@dev.local',
        name: 'Development User',
        role: 'USER',
      },
    })

    const template = await prisma.template.create({
      data: {
        name,
        description,
        category: category || 'CUSTOM',
        canvasData,
        thumbnail,
        isPublic: isPublic || false,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
