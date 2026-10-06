// Startklar-Prüfung auf der Kommandozeile (PLAN P10.14, R-210, KONZEPT §7.16): pnpm check:golive [--json]
// Nutzt dieselbe Prüffunktion wie die Verwaltungsansicht „Startklar“ und die Sperre „Shop öffnen“
// (`src/lib/golive`). Endet mit Code 1, solange ein Punkt rot ist; Code 2 bei einem Fehler beim Prüfen.
import 'dotenv/config'

export function parseGoliveArgs(argv: string[]): { json: boolean } {
  const unknown = argv.filter((a) => a !== '--json')
  if (unknown.length)
    throw new Error(`Unbekannte Option: ${unknown.join(', ')}\nAufruf: pnpm check:golive [--json]`)
  return { json: argv.includes('--json') }
}

async function main(): Promise<number> {
  const { json } = parseGoliveArgs(process.argv.slice(2))
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { runGoliveCheck } = await import('../src/lib/golive/collect')
  const { goliveSummaryLines } = await import('../src/lib/golive/checks')
  const payload = await getPayload({ config })
  try {
    const report = await runGoliveCheck(payload, new Date())
    if (json) console.log(JSON.stringify(report, null, 2))
    else {
      console.log(goliveSummaryLines(report).join('\n'))
      const open = report.checks.filter((c) => !c.ok).length
      console.log(
        report.ready
          ? '\ncheck:golive: alles startklar.'
          : `\ncheck:golive: NICHT startklar – ${open} von ${report.checks.length} Punkten offen.`,
      )
    }
    return report.ready ? 0 : 1
  } finally {
    await payload.destroy()
  }
}

if (process.argv[1]?.endsWith('check-golive.ts')) {
  main().then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(2)
    },
  )
}
