
import { NextResponse } from 'next/server'
import { processScheduledPosts } from '@/lib/scheduler'

// Prevent long execution timeout if possible (Vercel has limits)
export const maxDuration = 60; // 60 seconds

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const results = await processScheduledPosts()

        return NextResponse.json({ success: true, processed: results.length, results })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
