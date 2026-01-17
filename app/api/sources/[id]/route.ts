import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

// DELETE /api/sources/[id] - Delete a source
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        await prisma.newsSource.delete({
            where: { id: params.id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
    }
}
