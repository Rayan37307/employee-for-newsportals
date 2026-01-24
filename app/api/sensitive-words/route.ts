import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    const words = await prisma.sensitiveWord.findMany({
      where: {
        userId: user.id,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { word: 'asc' },
    })

    return NextResponse.json(words)
  } catch (error) {
    console.error('Error fetching sensitive words:', error)
    return NextResponse.json({ error: 'Failed to fetch words' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { word } = body

    if (!word || typeof word !== 'string') {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    // Check if word already exists
    const existing = await prisma.sensitiveWord.findFirst({
      where: {
        word: word.toLowerCase().trim(),
        userId: user.id,
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Word already exists' }, { status: 400 })
    }

    const sensitiveWord = await prisma.sensitiveWord.create({
      data: {
        word: word.toLowerCase().trim(),
        userId: user.id,
      },
    })

    return NextResponse.json(sensitiveWord, { status: 201 })
  } catch (error) {
    console.error('Error creating sensitive word:', error)
    return NextResponse.json({ error: 'Failed to create word' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    await prisma.sensitiveWord.delete({
      where: { id, userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sensitive word:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
