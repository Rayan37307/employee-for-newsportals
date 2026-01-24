import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'
import { runAutopilot } from '@/lib/services/autopilot-service'

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Autopilot] Starting manual run for user:', user.id)
    const result = await runAutopilot(user.id)

    console.log('[Autopilot] Run completed:', result)

    return NextResponse.json({
      success: result.success,
      newsFound: result.newsFound,
      cardsCreated: result.cardsCreated,
      skipped: result.skipped,
      errors: result.errors,
      runId: result.runId,
    })
  } catch (error) {
    console.error('[Autopilot] Error running autopilot:', error)
    return NextResponse.json(
      { error: 'Failed to run autopilot' },
      { status: 500 }
    )
  }
}
