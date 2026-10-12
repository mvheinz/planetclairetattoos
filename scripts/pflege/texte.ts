// Texte-Liste für die Pflege per Excel (U-87, U-89; PLAN P18.2): Ausgeben aus Sprachdateien, Verwaltungs-Standardtexten
// und Seed-Inhalten; Zurückspielen in dieselben Dateien (mit Prettier formatiert). Aufruf über `scripts/pflege/index.ts`.
// V-36: Zeilen, die es nicht mehr gibt, „entfallen“ (kein Fehler); Blätter mit eigener Listen-Nr. werden je Liste
// abgeglichen.
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import type ExcelJS from 'exceljs'

import { applyTextRows, textRow, type TextUpdate } from '../../src/lib/texte/excel'
import { buildTexteBook, readTexteWorkbook } from '../../src/lib/texte/excelBook'
import { setText, textEntries, type TextFile } from '../../src/lib/texte/model'
import { loadTextData, serialize, TEXT_FILES } from '../../src/lib/texte/sources'
import { sameText, str } from '../../src/lib/pflege/cells'
import { emptyReport, recordConsumed, type PflegeReport } from '../../src/lib/pflege/merge'
import { loadSnapshot } from '../../src/lib/pflege/repoStore'
import { makeSnapshot, type ListSnapshot } from '../../src/lib/pflege/snapshot'

import type { ExportResult, ImportResult } from './bestand'
import { formatJson } from './formatJson'

export async function exportTexte(
  root: string,
  now: Date,
  dateLabel: string,
): Promise<ExportResult> {
  const entries = textEntries(await loadTextData(root))
  const snapshot = makeSnapshot('texte', now, new Map(entries.map((e) => [e.id, textRow(e)])))
  const book = await buildTexteBook({ entries, date: dateLabel, listId: snapshot.id })
  return { book, snapshot, summary: `${entries.length} Texte` }
}

export async function importTexte(
  root: string,
  wb: ExcelJS.Workbook,
  snapshot: ListSnapshot | null,
  loadOther: (listId: string) => Promise<ListSnapshot | null> = (id) => loadSnapshot(root, id),
): Promise<ImportResult> {
  const data = await loadTextData(root)
  const { rows, rowListIds } = readTexteWorkbook(wb)
  const entries = textEntries(data)
  // V-36: Abgleich nach Listen-Nr. auch über mehrere Blätter – trägt ein Blatt eine andere Listen-Nr. als die Datei,
  // zählt für seine Zeilen der Stand dieser Liste.
  const mainId = snapshot?.id ?? null
  const groupOf = rowListIds.map((id) => id ?? mainId)
  const ids = [...new Set(groupOf)]
  const snapshots = new Map<string | null, ListSnapshot | null>([[mainId, snapshot]])
  const others: ListSnapshot[] = []
  const notes: string[] = []
  for (const id of ids) {
    if (snapshots.has(id) || id === null) continue
    const other = await loadOther(id)
    snapshots.set(id, other)
    if (other) others.push(other)
    else
      notes.push(
        `Zur Listen-Nr. ${id} (ein Blatt der Datei) ist kein Stand gemerkt – verglichen mit dem jetzigen Stand.`,
      )
  }
  const updates: TextUpdate[] = []
  const report = emptyReport()
  const seenIds = new Set<string>()
  for (const id of ids) {
    const groupRows = rows.filter((r, i) => {
      if (groupOf[i] !== id) return false
      const key = str(r.id)
      if (!key) return true
      if (seenIds.has(key)) {
        report.problems.push(
          `Kennung „${key}“ steht in mehreren Blättern – nur die erste Zeile übernommen.`,
        )
        return false
      }
      seenIds.add(key)
      return true
    })
    const snap = snapshots.get(id) ?? null
    const part = applyTextRows(entries, groupRows, {
      base: snap?.rows ?? null,
      consumed: snap?.consumed,
      countMissing: ids.length === 1,
    })
    updates.push(...part.updates)
    for (const k of Object.keys(report) as (keyof PflegeReport)[]) report[k].push(...part.report[k])
  }
  if (ids.length > 1)
    report.notes.unshift(
      `Die Datei enthält Blätter aus ${ids.length} Listen (${ids.map((x) => x ?? 'ohne Nr.').join(', ')}) – jedes Blatt ist mit seiner Liste abgeglichen.`,
      ...notes,
    )
  const files = new Set<TextFile>()
  for (const u of updates) {
    const f = setText(data, u.id, u.lang, u.value)
    if (f) files.add(f)
    else report.problems.push(`Kennung „${u.id}“ ließ sich nicht schreiben – nicht übernommen.`)
  }
  // Übernommenes festhalten: Texte nach dem Übernehmen; Notizen gelten als erledigt, sobald sie im Bericht stehen.
  // Jede Liste nur mit den Zeilen ihrer Blätter.
  const record = (s: ListSnapshot) => {
    const withId = rows.flatMap((r, i) =>
      str(r.id) && (groupOf[i] === s.id || (ids.length === 1 && s.id === mainId))
        ? [[str(r.id), r] as const]
        : [],
    )
    const notesById = new Map(withId.map(([id, r]) => [id, r.notiz ?? null]))
    const current = new Map(
      textEntries(data).map((e) => [e.id, { ...textRow(e), notiz: notesById.get(e.id) ?? '' }]),
    )
    return recordConsumed(s, withId, current, () => sameText)
  }
  if (files.size === 0) return { report, write: null, invalid: false, record, others }
  return {
    report,
    invalid: false,
    record,
    others,
    write: async () => {
      const written: string[] = []
      for (const f of files) {
        const file = path.join(root, TEXT_FILES[f])
        await writeFile(file, await formatJson(root, file, serialize(data, f)))
        written.push(TEXT_FILES[f])
      }
      return written.join(', ')
    },
  }
}
