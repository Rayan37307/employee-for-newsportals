import db from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const user = await getCurrentUser()
        const userId = user?.id || 'dev-user-id' // Fallback for dev

        const accounts = await db.socialAccount.findMany({
            where: { userId }
        })

        return NextResponse.json(accounts)
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        let userId = user?.id

        if (!userId) {
            userId = 'dev-user-id'
            await db.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: 'dev-social@example.com',
                    name: 'Developer'
                }
            })
        }

        const body = await req.json()
        const { platform, platformAccountId, accessToken, name } = body

        if (!platform || !platformAccountId || !accessToken) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const account = await db.socialAccount.create({
            data: {
                userId,
                platform, // 'FACEBOOK', 'TWITTER', etc.
                pageId: platformAccountId, // Map 'platformAccountId' from body to 'pageId' in schema
                pageName: name || `${platform} Account`,
                accessToken,
                refreshToken: '',
                isActive: true
            }
        })

        return NextResponse.json(account)
    } catch (error: any) {
        console.error(error)
        return NextResponse.json({ error: error.message || 'Failed to create account' }, { status: 500 })
    }
}
