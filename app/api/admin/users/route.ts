import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const user = await getCurrentUser()
        // Check admin role
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const users = await db.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                _count: {
                    select: { socialAccounts: true }
                }
            },
            take: 50
        })

        return NextResponse.json(users)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
