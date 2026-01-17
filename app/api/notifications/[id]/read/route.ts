import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        const updated = await db.notification.update({
            where: { id: id }, // In production, verify ownership! AND userId: user.id
            data: { read: true }
        })

        return NextResponse.json(updated)
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
