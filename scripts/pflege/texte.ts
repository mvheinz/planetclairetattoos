// Texte-Liste für die Pflege per Excel (U-87, U-89; PLAN P18.2): Ausgeben aus Sprachdateien, Verwaltungs-Standardtexten
// und Seed-Inhalten; Zurückspielen in dieselben Dateien (mit Prettier formatiert). Aufruf über `scripts/pflege/index.ts`.
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import type ExcelJS from 'exceljs'

import { applyTextRows, textRow } from '../../src/lib/texte/excel'
import { buildTexteBook, readTexteWorkbook } from '../../src/lib/texte/excelBook'
import { setText, textEntries, type TextFile } from '../../src/lib/texte/model'
import { loadTextData, serialize, TEXT_FILES } from '../../src/lib/texte/sources'
import { sameText, str } from '../../src/lib/pflege/cells'
import { recordConsumed } from '../../src/lib/pflege/merge'
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
): Promise<ImportResult> {
  const data = await loadTextData(root)
  const { rows } = readTexteWorkbook(wb)
  const { updates, report } = applyTextRows(textEntries(data), rows, {
    base: snapshot?.rows ?? null,
    consumed: snapshot?.consumed,
  })
  const files = new Set<TextFile>()
  for (const u of updates) {
    const f = setText(data, u.id, u.lang, u.value)
    if (f) files.add(f)
    else report.problems.push(`Kennung „${u.id}“ ließ sich nicht schreiben – nicht übernommen.`)
  }
  // Übernommenes festhalten: Texte nach dem Übernehmen; Notizen gelten als erledigt, sobald sie im Bericht stehen
  const record = (s: ListSnapshot) => {
    const withId = rows.flatMap((r) => (str(r.id) ? [[str(r.id), r] as const] : []))
    const notes = new Map(withId.map(([id, r]) => [id, r.notiz ?? null]))
    const current = new Map(
      textEntries(data).map((e) => [e.id, { ...textRow(e), notiz: notes.get(e.id) ?? '' }]),
    )
    return recordConsumed(s, withId, current, () => sameText)
  }
  if (files.size === 0) return { report, write: null, invalid: false, record }
  return {
    report,
    invalid: false,
    record,
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
