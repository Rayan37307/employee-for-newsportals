import { NextResponse } from 'next/server'
import { processAutopilotRuns } from '@/lib/scheduler'

export const maxDuration = 60

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const results = await processAutopilotRuns()

        return NextResponse.json({ 
            success: true, 
            processed: results.length, 
            results 
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
