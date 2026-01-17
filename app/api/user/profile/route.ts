import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()

        // Zod validation
        const { userProfileSchema } = await import('@/lib/validation')
        const validation = userProfileSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 })
        }

        const { name } = validation.data

        const updated = await db.user.update({
            where: { id: user.id },
            data: { name }
        })

        return NextResponse.json(updated)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
