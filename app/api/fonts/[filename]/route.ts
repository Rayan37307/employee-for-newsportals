import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { readFile } from 'fs/promises'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params
        
        if (!filename || filename.includes('..')) {
            return new NextResponse('Invalid filename', { status: 400 })
        }

        const fontsDir = path.join(process.cwd(), 'public', 'fonts')
        const filePath = path.join(fontsDir, filename)

        const file = await readFile(filePath)
        
        return new NextResponse(file, {
            headers: {
                'Content-Type': 'font/ttf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch (error) {
        console.error('Error serving font file:', error)
        return new NextResponse('Font not found', { status: 404 })
    }
}
