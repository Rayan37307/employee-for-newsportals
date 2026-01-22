import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'

const ALLOWED_FONT_TYPES = [
  'font/ttf',
  'application/font-ttf',
  'application/x-font-ttf',
  'application/octet-stream',
]
const MAX_FONT_SIZE = 10 * 1024 * 1024

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userOnly = searchParams.get('user') === 'true'

    const fonts = await prisma.font.findMany({
      where: userOnly ? {} : {},
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(fonts)
  } catch (error) {
    console.error('Error fetching fonts:', error)
    return NextResponse.json({ error: 'Failed to fetch fonts' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Font ID is required' }, { status: 400 })
    }

    const font = await prisma.font.findUnique({
      where: { id },
    })

    if (!font) {
      return NextResponse.json({ error: 'Font not found' }, { status: 404 })
    }

    const fontsDir = path.join(process.cwd(), 'public', 'fonts')
    const filePath = path.join(fontsDir, font.filename)

    try {
      await unlink(filePath)
    } catch (error) {
      console.warn('Could not delete font file:', error)
    }

    await prisma.font.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting font:', error)
    return NextResponse.json({ error: 'Failed to delete font' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Font file is required' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'Font name is required' }, { status: 400 })
    }

    if (!ALLOWED_FONT_TYPES.includes(file.type) && !file.name.endsWith('.ttf')) {
      return NextResponse.json({ error: 'Only .ttf font files are allowed' }, { status: 400 })
    }

    if (file.size > MAX_FONT_SIZE) {
      return NextResponse.json({ error: 'Font file size must be less than 10MB' }, { status: 400 })
    }

    let userId = 'anonymous-user'
    try {
      const user = await getCurrentUser()
      if (user) {
        userId = user.id
      }
    } catch (error) {
      console.log('No authenticated user, creating anonymous font')
    }

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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fontId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const filename = `${fontId}-${file.name}`
    const fontsDir = path.join(process.cwd(), 'public', 'fonts')
    
    await mkdir(fontsDir, { recursive: true })
    await writeFile(path.join(fontsDir, filename), buffer)

    const fontFamily = `CustomFont_${fontId}`

    const font = await prisma.font.create({
      data: {
        name,
        family: fontFamily,
        filename,
        fileUrl: `/fonts/${filename}`,
        userId,
      },
    })

    return NextResponse.json(font, { status: 201 })
  } catch (error) {
    console.error('Error uploading font:', error)
    return NextResponse.json({ error: 'Failed to upload font' }, { status: 500 })
  }
}
