// Fehlende Zahlungs-Ereignisse nachholen (ARCHITEKTUR §3.5/§11, DATENMODELL §8.8, PLAN P4.16):
// pnpm payments:reconcile [--since=<ISO>] – holt die Ereignisse seit `since` (Standard: 3 Tage) über `listEventsSince`
// und verarbeitet sie mit `processPaymentEvent` (bereits verarbeitete bleiben unverändert, Idempotenz über die Event-ID).
import 'dotenv/config'

export const DEFAULT_RECONCILE_DAYS = 3

export function parseReconcileArgs(argv: string[], now: Date): { since: Date } {
  const arg = argv.find((a) => a.startsWith('--since='))
  if (!arg) return { since: new Date(now.getTime() - DEFAULT_RECONCILE_DAYS * 86_400_000) }
  const since = new Date(arg.slice('--since='.length))
  if (Number.isNaN(since.getTime())) throw new Error(`--since ist kein gültiges Datum: ${arg}`)
  return { since }
}

async function main(): Promise<void> {
  const { since } = parseReconcileArgs(process.argv.slice(2), new Date())
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { getPaymentsAdapter } = await import('../src/lib/payments/index')
  const { processPaymentEvent } = await import('../src/lib/payments/processPaymentEvent')
  const payload = await getPayload({ config })
  const counts: Record<string, number> = {}
  let failed = 0
  try {
    const payments = getPaymentsAdapter()
    const events = await payments.listEventsSince(since)
    for (const event of events) {
      try {
        const r = await processPaymentEvent(event, { payload, payments })
        counts[r.status] = (counts[r.status] ?? 0) + 1
      } catch {
        failed++
      }
    }
    console.log(
      `payments:reconcile seit ${since.toISOString()}: ${events.length} Ereignis(se) – ` +
        Object.entries(counts)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ') +
        (failed ? `, fehlgeschlagen ${failed}` : ''),
    )
  } finally {
    await payload.destroy()
  }
  if (failed > 0) process.exitCode = 1
}

if (process.argv[1]?.endsWith('payments-reconcile.ts')) {
  main().then(
    () => process.exit(process.exitCode ?? 0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
