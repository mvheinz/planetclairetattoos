// Pflege per Excel (U-85–U-89, PLAN P18): Listen für Jutta ausgeben und ihre bearbeiteten Listen zurückspielen.
//   pnpm pflege:export [bestand|texte]          → dist/pflege/planet-claire-<art>-<Tag>.xlsx + gemerkter Stand
//   pnpm pflege:import <datei.xlsx> [--trocken] [--ohne-stand]
// Der gemerkte Stand liegt in content/pflege/stand/<Listen-Nr.>.json und **muss committet werden** (die nächste Sitzung
// braucht ihn). Zurückspielen übernimmt nur, was Jutta gegenüber diesem Stand geändert hat; Rückfragen, ungültige Werte
// und Englisch zum Nachziehen stehen im Bericht dist/pflege/bericht-<Listen-Nr.>.md. Ohne gemerkten Stand wird nur mit
// `--ohne-stand` geschrieben (dann zählt jeder Unterschied zum jetzigen Stand). Ablauf: docs/RUNBOOK.md.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type ExcelJS from 'exceljs'

import { reportMarkdown } from '../../src/lib/pflege/merge'
import { loadSnapshot, saveSnapshot, snapshotIdsOn } from '../../src/lib/pflege/repoStore'
import { berlinDay, parseListId, type ListKind } from '../../src/lib/pflege/snapshot'
import { findListId, loadWorkbook } from '../../src/lib/pflege/workbook'

import { exportBestand, importBestand, type ExportResult, type ImportResult } from './bestand'
import { exportTexte, importTexte } from './texte'

export const PFLEGE_OUT = path.join('dist', 'pflege')

const HANDLERS: Record<
  ListKind,
  {
    title: string
    export: (root: string, now: Date, dateLabel: string) => Promise<ExportResult>
    import: (
      root: string,
      wb: ExcelJS.Workbook,
      base: Parameters<typeof importBestand>[2],
      year: number,
    ) => Promise<ImportResult>
  }
> = {
  bestand: { title: 'Bestandsliste', export: exportBestand, import: importBestand },
  texte: {
    title: 'Webseitentexte',
    export: exportTexte,
    import: (root, wb, base) => importTexte(root, wb, base),
  },
}

const germanDate = (d: Date) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(d)

export async function runExport(
  root: string,
  kinds: readonly ListKind[],
  now: Date,
  log: (line: string) => void = console.log,
): Promise<{ file: string; listId: string }[]> {
  const out = path.join(root, PFLEGE_OUT)
  await mkdir(out, { recursive: true })
  const files: { file: string; listId: string }[] = []
  for (const kind of kinds) {
    const { book, snapshot, summary } = await HANDLERS[kind].export(root, now, germanDate(now))
    const stand = await saveSnapshot(root, snapshot)
    const file = path.join(out, `planet-claire-${kind}-${berlinDay(now)}.xlsx`)
    await book.xlsx.writeFile(file)
    files.push({ file, listId: snapshot.id })
    log(
      `${path.relative(root, file)} – ${summary}, Listen-Nr. ${snapshot.id}\n  Stand: ${path.relative(root, stand)} (bitte committen)`,
    )
  }
  return files
}

/** Art der Liste aus der Listen-Nr. oder aus den Überschriften. */
function detectKind(wb: ExcelJS.Workbook, listId: string | null): ListKind {
  if (listId) return parseListId(listId)!.kind
  const headers = wb.worksheets.flatMap((ws) =>
    [1, 2, 3].map((r) => ws.getRow(r).values?.toString() ?? ''),
  )
  return headers.some((h) => /Kennung/.test(h)) ? 'texte' : 'bestand'
}

export async function runImport(
  root: string,
  file: string,
  flags: { dry: boolean; withoutBase: boolean },
  now: Date,
  log: (line: string) => void = console.log,
): Promise<{ exit: number; report: string; written: string | null }> {
  const wb = await loadWorkbook(await readFile(file))
  let listId = findListId(wb, path.basename(file))
  const kind = detectKind(wb, listId)
  const notes: string[] = []
  if (!listId) {
    // Dateiname mit Tag (planet-claire-bestand-2026-10-11.xlsx) und genau eine Liste an dem Tag: diese
    const day = /(\d{4}-\d{2}-\d{2})/.exec(path.basename(file))?.[1]
    const ids = day ? await snapshotIdsOn(root, kind, day) : []
    if (ids.length === 1) {
      listId = ids[0]!
      notes.push(
        `Listen-Nr. nicht in der Datei – über das Datum im Dateinamen zugeordnet (${listId}).`,
      )
    }
  }
  const snapshot = listId ? await loadSnapshot(root, listId) : null
  if (!snapshot)
    notes.push(
      listId
        ? `Zur Listen-Nr. ${listId} ist kein Stand gemerkt – verglichen mit dem jetzigen Stand.`
        : 'Keine Listen-Nr. gefunden – verglichen mit dem jetzigen Stand.',
    )
  if (snapshot && snapshot.kind !== kind)
    throw new Error(`Listen-Nr. ${listId} passt nicht zur Liste.`)
  const year = Number(berlinDay(now).slice(0, 4))
  const result = await HANDLERS[kind].import(root, wb, snapshot?.rows ?? null, year)
  result.report.notes.unshift(...notes)

  let written: string | null = null
  let exit = 0
  if (result.invalid) exit = 1
  else if (!snapshot && !flags.withoutBase && result.write) {
    result.report.notes.push(
      'Nichts geschrieben: Ohne gemerkten Stand könnte eine ältere Liste neuere Änderungen zurücksetzen. Bericht prüfen und mit `--ohne-stand` übernehmen.',
    )
    exit = 3
  } else if (flags.dry) result.report.notes.push('Probelauf (`--trocken`) – nichts geschrieben.')
  else if (result.write) written = await result.write()

  const md = reportMarkdown(
    `${HANDLERS[kind].title} zurückgespielt`,
    `Datei: ${path.basename(file)} · Listen-Nr. ${listId ?? 'unbekannt'} · ${germanDate(now)}${written ? ` · geschrieben: ${written}` : ''}`,
    result.report,
  )
  const out = path.join(root, PFLEGE_OUT, `bericht-${listId ?? path.basename(file, '.xlsx')}.md`)
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, md)
  log(md)
  log(`Bericht: ${path.relative(root, out)}`)
  return { exit, report: out, written }
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, ...rest] = argv.filter((a) => a !== '--')
  const root = process.cwd()
  const now = new Date()
  if (command === 'export') {
    const kinds = rest.filter((a): a is ListKind => a in HANDLERS)
    await runExport(root, kinds.length ? kinds : ['bestand', 'texte'], now)
  } else if (command === 'import' && rest.some((a) => !a.startsWith('--'))) {
    const file = path.resolve(rest.find((a) => !a.startsWith('--'))!)
    const flags = { dry: rest.includes('--trocken'), withoutBase: rest.includes('--ohne-stand') }
    process.exitCode = (await runImport(root, file, flags, now)).exit
  } else {
    console.error(
      'Aufruf: pnpm pflege:export [bestand|texte]  |  pnpm pflege:import <datei.xlsx> [--trocken] [--ohne-stand]',
    )
    process.exitCode = 2
  }
}

// Nur als Befehl ausführen, nicht beim Import im Test
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}
