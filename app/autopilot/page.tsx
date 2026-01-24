import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'
import { redirect } from 'next/navigation'
import { AutopilotDashboard } from './dashboard-client'

async function getAutopilotData(userId: string) {
  const [settings, stats, recentRuns, templates, sensitiveWords] = await Promise.all([
    prisma.autopilotSettings.findUnique({
      where: { userId },
    }),
    import('@/lib/services/autopilot-service').then(m => m.getAutopilotStats(userId)),
    prisma.autopilotRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    prisma.template.findMany({
      where: { userId },
      select: { id: true, name: true, category: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sensitiveWord.findMany({
      where: { userId },
      select: { id: true, word: true, isActive: true },
      orderBy: { word: 'asc' },
    }),
  ])

  // Serialize dates
  const serializedSettings = settings ? {
    ...settings,
    lastRunAt: settings.lastRunAt?.toISOString() || null,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  } : null

  const serializeRun = (run: any) => ({
    id: run.id,
    status: run.status,
    startedAt: run.startedAt?.toISOString() || new Date().toISOString(),
    completedAt: run.completedAt?.toISOString() || null,
    newsFound: run.newsFound || 0,
    cardsCreated: run.cardsCreated || 0,
    skipped: run.skipped || 0,
    errors: run.errors || null,
  })

  const serializedRuns = recentRuns.map(serializeRun)

  const serializedStats = {
    ...stats,
    recentRuns: stats.recentRuns.map(serializeRun),
  }

  return {
    settings: serializedSettings,
    stats: serializedStats,
    recentRuns: serializedRuns,
    templates,
    sensitiveWords,
  }
}

export default async function AutopilotPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  const data = await getAutopilotData(user.id)

  return <AutopilotDashboard initialData={data} userId={user.id} />
}
