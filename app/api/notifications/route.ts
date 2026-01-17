import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json([], { status: 401 })

        // Use user.id or fallback
        const userId = user.id || 'dev-user-id'

        const notifications = await db.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        })

        return NextResponse.json(notifications)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// Dev helper to create notification
export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        const userId = user?.id || 'dev-user-id'
        const body = await req.json()

        const notif = await db.notification.create({
            data: {
                userId,
                title: body.title || 'New Notification',
                message: body.message || 'Something happened',
                link: body.link
            }
        })
        return NextResponse.json(notif)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
