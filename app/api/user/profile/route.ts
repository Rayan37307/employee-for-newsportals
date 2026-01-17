import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { name } = body

        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

        const updated = await db.user.update({
            where: { id: user.id },
            data: { name }
        })

        return NextResponse.json(updated)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
