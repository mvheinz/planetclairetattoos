import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Flaky-Wächter (`pnpm ci:flaky`, ARCHITEKTUR §7.2, PLAN P10.2): liest den JSON-Bericht von Playwright
// (`test-results/report.json`, in CI zusätzlich zum HTML-Bericht) und meldet jeden Test, der erst im Wiederholungslauf
// bestand („flaky“). Ein Volllauf zählt für das Phasenende nur ohne solche Tests; `unexpected > 0` meldet Playwright selbst.
// Exit 1 bei mindestens einem flaky-Test; fehlt der Bericht (Lauf vorher abgebrochen), Exit 0 mit Hinweis.

interface Spec {
  title: string
  file?: string
  tests?: { status?: string; projectName?: string }[]
}
interface Suite {
  title?: string
  file?: string
  specs?: Spec[]
  suites?: Suite[]
}
export interface Report {
  suites?: Suite[]
  stats?: { flaky?: number }
}

/** Alle Tests mit Status `flaky` (Datei › Titel [Projekt]). */
export function flakyTests(report: Report): string[] {
  const out: string[] = []
  const walk = (s: Suite, file: string) => {
    const f = s.file ?? file
    for (const spec of s.specs ?? [])
      for (const t of spec.tests ?? [])
        if (t.status === 'flaky')
          out.push(`${spec.file ?? f} › ${spec.title}${t.projectName ? ` [${t.projectName}]` : ''}`)
    for (const c of s.suites ?? []) walk(c, f)
  }
  for (const s of report.suites ?? []) walk(s, '')
  return out
}

function main(): number {
  const file = process.argv[2] ?? 'test-results/report.json'
  if (!existsSync(file)) {
    console.log(`FLAKY_STATUS=unbekannt (kein Bericht ${file})`)
    return 0
  }
  const flaky = flakyTests(JSON.parse(readFileSync(file, 'utf8')) as Report)
  console.log(`FLAKY_ANZAHL=${flaky.length}`)
  for (const t of flaky) console.log(`flaky: ${t}`)
  return flaky.length ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
