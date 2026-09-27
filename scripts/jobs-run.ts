// Einen Task sofort ausführen (ARCHITEKTUR §9.6 Nr. 7, Anhang A.3): pnpm jobs:run <task> [--now=<ISO>]
// Nur Slugs aus ARCHITEKTUR Anhang A.3; noch nicht umgesetzte Tasks brechen mit Hinweis auf ihre Phase ab.
import 'dotenv/config'

import { TASK_SLUGS } from '../src/jobs/index'
import { assertRunnableTask } from '../src/lib/jobs/runTask'

export function parseJobsRunArgs(argv: string[]): { task: string; now?: Date } {
  const positional = argv.filter((a) => !a.startsWith('--'))
  const nowArg = argv.find((a) => a.startsWith('--now='))
  const task = positional[0]
  if (!task) {
    throw new Error(`Aufruf: pnpm jobs:run <task> [--now=<ISO>]\nTasks: ${TASK_SLUGS.join(', ')}`)
  }
  let now: Date | undefined
  if (nowArg) {
    now = new Date(nowArg.slice('--now='.length))
    if (Number.isNaN(now.getTime())) throw new Error(`--now ist kein gültiges Datum: ${nowArg}`)
  }
  return { task, now }
}

async function main(): Promise<void> {
  const { task, now } = parseJobsRunArgs(process.argv.slice(2))
  assertRunnableTask(task) // prüft vor dem DB-Zugriff
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { runTaskNow } = await import('../src/lib/jobs/runTask')
  const payload = await getPayload({ config })
  try {
    const result = await runTaskNow(payload, task, { now })
    console.log(`jobs:run ${result.task}: ${result.ran} Job(s) ausgeführt`)
  } finally {
    await payload.destroy()
  }
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
