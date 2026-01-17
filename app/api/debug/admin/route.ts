import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const user = await getCurrentUser()
        const userId = user?.id || 'dev-user-id'

        const updated = await db.user.update({
            where: { id: userId },
            data: { role: 'ADMIN' }
        })

        return NextResponse.json(updated)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
