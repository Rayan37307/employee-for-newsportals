import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getCurrentUser } from '@/lib/session'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    let userId = 'anonymous-user'
    try {
      const user = await getCurrentUser()
      if (user) {
        userId = user.id
      }
    } catch (error) {
      console.log('No authenticated user, uploading as anonymous')
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const filename = `card-${fileId}.png`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')

    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, filename), buffer)

    const url = `/uploads/${filename}`

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
