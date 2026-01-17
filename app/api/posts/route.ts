import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const user = await getCurrentUser()
        const userId = user?.id || 'dev-user-id'

        const posts = await db.post.findMany({
            where: {
                socialAccount: { userId } // Only posts from user's accounts
            },
            include: {
                socialAccount: true,
                newsCard: {
                    select: { template: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        })

        return NextResponse.json(posts)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
