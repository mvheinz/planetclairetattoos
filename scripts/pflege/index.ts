// Pflege per Excel (U-85–U-89, PLAN P18): Listen für Jutta ausgeben und ihre bearbeiteten Listen zurückspielen.
//   pnpm pflege:export [bestand|texte]          → dist/pflege/planet-claire-<art>-<Listen-Nr.>.xlsx + gemerkter Stand
//   pnpm pflege:import <datei.xlsx> [--trocken] [--ohne-stand] [--liste=<Listen-Nr.>]
// Der gemerkte Stand liegt in content/pflege/stand/<Listen-Nr.>.json und **muss committet werden** (die nächste Sitzung
// braucht ihn). Zurückspielen übernimmt nur, was Jutta gegenüber diesem Stand geändert hat; Rückfragen, ungültige Werte
// und Englisch zum Nachziehen stehen im Bericht dist/pflege/bericht-<Listen-Nr.>.md. Ohne gemerkten Stand wird nur mit
// `--ohne-stand` geschrieben (dann zählt jeder Unterschied zum jetzigen Stand); fehlt die Listen-Nr. in der Datei, kann
// sie die Sitzung nach Prüfung mit `--liste=` angeben. Ablauf: docs/RUNBOOK.md.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type ExcelJS from 'exceljs'

import { reportMarkdown } from '../../src/lib/pflege/merge'
import { BESTAND_COLUMNS } from '../../src/lib/bestand/excel'
import { loadSnapshot, PFLEGE_STAND_DIR, saveSnapshot } from '../../src/lib/pflege/repoStore'
import {
  berlinDay,
  parseListId,
  type ListKind,
  type ListSnapshot,
} from '../../src/lib/pflege/snapshot'
import { findListId, loadWorkbook, tableScore } from '../../src/lib/pflege/workbook'
import { TEXT_COLUMNS } from '../../src/lib/texte/excel'

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
      snapshot: ListSnapshot | null,
      clock: { year: number; today: string },
    ) => Promise<ImportResult>
  }
> = {
  bestand: { title: 'Bestandsliste', export: exportBestand, import: importBestand },
  texte: {
    title: 'Webseitentexte',
    export: exportTexte,
    import: (root, wb, snapshot) => importTexte(root, wb, snapshot),
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
    // Listen-Nr. im Dateinamen: bleibt beim Export aus Numbers erhalten (dritte Fundstelle neben Blatt und Kommentar)
    const file = path.join(out, `planet-claire-${kind}-${snapshot.id}.xlsx`)
    await book.xlsx.writeFile(file)
    files.push({ file, listId: snapshot.id })
    log(
      `${path.relative(root, file)} – ${summary}, Listen-Nr. ${snapshot.id}\n  Stand: ${path.relative(root, stand)} (bitte committen)`,
    )
  }
  return files
}

/** Art der Liste aus den Überschriften (wie beim Lesen der Tabellen); keine passt → verständlicher Fehler. */
export function detectKind(wb: ExcelJS.Workbook): ListKind {
  const bestand = tableScore(wb, BESTAND_COLUMNS, 'nr')
  const texte = tableScore(wb, TEXT_COLUMNS, 'id')
  if (bestand < 2 && texte < 2)
    throw new Error(
      'In der Datei steht weder die Bestandsliste noch die Texte-Liste – bitte die Überschriften nicht ändern.',
    )
  return texte > bestand ? 'texte' : 'bestand'
}

export async function runImport(
  root: string,
  file: string,
  flags: { dry: boolean; withoutBase: boolean; listId?: string },
  now: Date,
  log: (line: string) => void = console.log,
): Promise<{ exit: number; report: string; written: string | null }> {
  const wb = await loadWorkbook(await readFile(file))
  const kind = detectKind(wb)
  const notes: string[] = []
  const found = findListId(wb, path.basename(file))
  if (flags.listId && !parseListId(flags.listId))
    throw new Error(`--liste=${flags.listId} ist keine Listen-Nr.`)
  if (flags.listId && found && found !== flags.listId)
    throw new Error(`Die Datei trägt die Listen-Nr. ${found}, nicht ${flags.listId}.`)
  const listId = found ?? flags.listId ?? null
  if (!found && flags.listId)
    notes.push(`Listen-Nr. nicht in der Datei – von Hand angegeben (${flags.listId}).`)
  if (listId && parseListId(listId)!.kind !== kind)
    throw new Error(`Listen-Nr. ${listId} gehört zu einer anderen Liste.`)
  const snapshot = listId ? await loadSnapshot(root, listId) : null
  if (!snapshot)
    notes.push(
      listId
        ? `Zur Listen-Nr. ${listId} ist kein Stand gemerkt – verglichen mit dem jetzigen Stand.`
        : 'Keine Listen-Nr. gefunden – verglichen mit dem jetzigen Stand.',
    )
  const today = berlinDay(now)
  const result = await HANDLERS[kind].import(root, wb, snapshot, {
    year: Number(today.slice(0, 4)),
    today,
  })
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
  else {
    if (result.write) written = await result.write()
    // Übernommenes festhalten: dieselbe Liste noch einmal geschickt ändert nichts mehr (U-89 c)
    if (snapshot) {
      const n = result.record(snapshot)
      if (n > 0) {
        await saveSnapshot(root, snapshot)
        result.report.notes.push(
          `Übernommenes in der Liste ${snapshot.id} vermerkt (${n} Zellen) – \`${path.join(PFLEGE_STAND_DIR, `${snapshot.id}.json`)}\` bitte mit committen.`,
        )
      }
    }
  }

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
    const listId = rest.find((a) => a.startsWith('--liste='))?.slice('--liste='.length)
    const flags = {
      dry: rest.includes('--trocken'),
      withoutBase: rest.includes('--ohne-stand'),
      ...(listId ? { listId } : {}),
    }
    process.exitCode = (await runImport(root, file, flags, now)).exit
  } else {
    console.error(
      'Aufruf: pnpm pflege:export [bestand|texte]  |  pnpm pflege:import <datei.xlsx> [--trocken] [--ohne-stand] [--liste=<Listen-Nr.>]',
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
