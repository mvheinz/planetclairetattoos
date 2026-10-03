// Löschprotokoll nach einer Wiederherstellung erneut anwenden (LOESCHKONZEPT §3.6, ARCHITEKTUR §6.10/§10.5,
// DATENMODELL §6.27): pnpm retention:replay [--now=<ISO>] [--yes-production]
// Wendet alle Einträge aus `deletion-log` (Reihenfolge `executedAt`) auf noch vorhandene IDs an und führt danach alle
// Löschjobs einmal aus. Auf einer als Produktion markierten Datenbank bzw. mit APP_ENV=production nur mit
// `--yes-production` (ARCHITEKTUR §4.8).
import 'dotenv/config'

import { databaseNameFromUrl, isProductionDatabase } from '../src/lib/db/guard'
import { withClient } from './lib/pg'

export interface ReplayArgs {
  now?: Date
  yesProduction: boolean
}

export function parseReplayArgs(argv: readonly string[]): ReplayArgs {
  const nowArg = argv.find((a) => a.startsWith('--now='))
  let now: Date | undefined
  if (nowArg) {
    now = new Date(nowArg.slice('--now='.length))
    if (Number.isNaN(now.getTime())) throw new Error(`--now ist kein gültiges Datum: ${nowArg}`)
  }
  const unknown = argv.filter(
    (a) => a.startsWith('--') && !a.startsWith('--now=') && a !== '--yes-production',
  )
  if (unknown.length) throw new Error(`Unbekannte Option: ${unknown.join(', ')}`)
  return { now, yesProduction: argv.includes('--yes-production') }
}

/** `null` = erlaubt; sonst die Ablehnung (Produktion ohne `--yes-production`). */
export function replayBlockedReason(input: {
  appEnv: string
  databaseName: string
  isProductionMarked: boolean
  yesProduction: boolean
}): string | null {
  if (input.yesProduction) return null
  if (input.appEnv === 'production')
    return 'APP_ENV=production – retention:replay nur mit --yes-production.'
  if (input.isProductionMarked)
    return `Datenbank ${input.databaseName} ist als Produktion markiert – retention:replay nur mit --yes-production.`
  return null
}

async function main(): Promise<void> {
  const args = parseReplayArgs(process.argv.slice(2))
  const { getEnv } = await import('../src/lib/env')
  const env = getEnv()
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
  const databaseName = databaseNameFromUrl(url)
  const reason = await withClient(url, async (c) =>
    replayBlockedReason({
      appEnv: env.APP_ENV,
      databaseName,
      isProductionMarked: await isProductionDatabase(c),
      yesProduction: args.yesProduction,
    }),
  )
  if (reason) throw new Error(reason)
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { replayDeletionLog } = await import('../src/lib/retention/replay')
  const payload = await getPayload({ config })
  try {
    const res = await replayDeletionLog(payload, { now: args.now ?? new Date() })
    console.log(
      `retention:replay: ${res.entries} Einträge geprüft, ${res.reapplied} erneut angewendet, ${res.failed} Fehler; ` +
        `Löschjobs: ${Object.entries(res.jobs)
          .map(([t, n]) => `${t}=${n}`)
          .join(', ')}`,
    )
    if (res.failed > 0) process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

if (process.argv[1]?.endsWith('retention-replay.ts')) {
  main().then(
    () => process.exit(process.exitCode ?? 0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
