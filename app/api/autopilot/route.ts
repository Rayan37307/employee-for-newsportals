import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let settings = await prisma.autopilotSettings.findFirst({
      where: { userId: user.id },
    })

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.autopilotSettings.create({
        data: {
          userId: user.id,
          isEnabled: false,
          checkInterval: 15,
          generateCards: true,
          sensitiveFilter: true,
          notifyOnNewCard: true,
        },
      })
    }

    // Get template options
    const templates = await prisma.template.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ settings, templates })
  } catch (error) {
    console.error('Error fetching autopilot settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      isEnabled,
      templateId,
      checkInterval,
      generateCards,
      sensitiveFilter,
      notifyOnNewCard,
    } = body

    // Validate template if provided
    if (templateId) {
      const template = await prisma.template.findFirst({
        where: { id: templateId, userId: user.id },
      })
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
    }

    const settings = await prisma.autopilotSettings.upsert({
      where: { userId: user.id },
      update: {
        isEnabled,
        templateId: templateId || null,
        checkInterval: checkInterval || 15,
        generateCards,
        sensitiveFilter,
        notifyOnNewCard,
      },
      create: {
        userId: user.id,
        isEnabled,
        templateId: templateId || null,
        checkInterval: checkInterval || 15,
        generateCards,
        sensitiveFilter,
        notifyOnNewCard,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating autopilot settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
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

    await prisma.autopilotSettings.delete({
      where: { id, userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting autopilot settings:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
