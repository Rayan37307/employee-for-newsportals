import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'
import { getAutopilotRuns } from '@/lib/services/autopilot-service'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const runs = await getAutopilotRuns(user.id, 20)

    return NextResponse.json({ runs })
  } catch (error) {
    console.error('Error fetching autopilot runs:', error)
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }
}
