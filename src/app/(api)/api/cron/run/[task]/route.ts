import { handleRunTask } from '@/lib/jobs/tick'

// Einen Task sofort ausführen (ARCHITEKTUR §2.5): Bearer CRON_SECRET oder Admin-Sitzung; nur Slugs aus Anhang A.3.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ task: string }> },
): Promise<Response> {
  const { task } = await params
  return handleRunTask(request, task)
}
