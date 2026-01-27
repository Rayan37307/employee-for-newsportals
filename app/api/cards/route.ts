import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

// POST - Create a new card with pre-generated image
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { article, templateId, imageUrl } = body

    if (!article || !templateId || !imageUrl) {
      return NextResponse.json(
        { error: 'Article, templateId, and imageUrl are required' },
        { status: 400 }
      )
    }

    // Fetch the template to get its name
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Save the generated card with the pre-generated image
    const newsCard = await prisma.newsCard.create({
      data: {
        imageUrl,
        status: 'GENERATED',
        sourceData: article,
        templateId: template.id
      }
    })

    return NextResponse.json({
      success: true,
      card: {
        id: newsCard.id,
        imageUrl: newsCard.imageUrl,
        status: newsCard.status,
        createdAt: newsCard.createdAt
      }
    })

  } catch (error) {
    console.error('Error creating card:', error)
    return NextResponse.json(
      { error: 'Failed to create card' },
      { status: 500 }
    )
  }
}

// GET - List all generated cards
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    const cards = await prisma.newsCard.findMany({
      where: {
        ...(status && { status: status as any })
      },
      include: {
        template: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      count: cards.length,
      cards: cards.map(card => ({
        id: card.id,
        imageUrl: card.imageUrl,
        status: card.status,
        templateName: card.template.name,
        sourceTitle: (card.sourceData as any)?.title || 'Unknown',
        createdAt: card.createdAt
      }))
    })

  } catch (error) {
    console.error('Error fetching cards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 }
    )
  }
}
