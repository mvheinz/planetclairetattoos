// Bestandsliste für die Pflege per Excel (U-85, U-86, U-89; PLAN P18.1): Ausgeben aus `content/bestand/products.json`
// (mit kleinen Fotos) und Zurückspielen in dieselbe Datei. Aufruf über `scripts/pflege/index.ts`.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type ExcelJS from 'exceljs'
import sharp from 'sharp'

import { applyRows, BESTAND_COLUMNS, rowOf } from '../../src/lib/bestand/excel'
import { buildBestandBook } from '../../src/lib/bestand/excelBook'
import { keepValid } from '../../src/lib/bestand/excelRepo'
import {
  BESTAND_DIR,
  BESTAND_FILE,
  bestandPhotoPath,
  bestandSchema,
  loadBestand,
} from '../../src/lib/bestand/schema'
import type { PflegeReport } from '../../src/lib/pflege/merge'
import { makeSnapshot, type ListSnapshot, type SnapshotRows } from '../../src/lib/pflege/snapshot'
import { readTables } from '../../src/lib/pflege/workbook'

import { formatJson } from './formatJson'

export interface ExportResult {
  book: ExcelJS.Workbook
  snapshot: ListSnapshot
  summary: string
}

export interface ImportResult {
  report: PflegeReport
  /** Schreibt das Ergebnis (nur aufrufen, wenn freigegeben); `null` = nichts zu schreiben. */
  write: (() => Promise<string>) | null
  /** Ergebnis ungültig – nichts schreiben (Meldungen stehen in `report.problems`). */
  invalid: boolean
}

export async function exportBestand(
  root: string,
  now: Date,
  dateLabel: string,
): Promise<ExportResult> {
  const products = [...(await loadBestand(root))].sort((a, b) => a.itemNumber - b.itemNumber)
  const snapshot = makeSnapshot(
    'bestand',
    now,
    new Map(products.map((p) => [String(p.itemNumber), rowOf(p)])),
  )
  const thumbs = new Map<string, Buffer>()
  for (const p of products) {
    const first = p.images[0]
    if (!first) continue
    thumbs.set(
      p.key,
      await sharp(await readFile(bestandPhotoPath(root, first.file)))
        .resize(128, 160, { fit: 'cover' })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer(),
    )
  }
  const book = await buildBestandBook({ products, thumbs, date: dateLabel, listId: snapshot.id })
  return { book, snapshot, summary: `${products.length} Stücke` }
}

export async function importBestand(
  root: string,
  wb: ExcelJS.Workbook,
  base: SnapshotRows | null,
  year: number,
): Promise<ImportResult> {
  const products = await loadBestand(root)
  const rows = readTables(wb, BESTAND_COLUMNS, 'nr', 'Bestandsliste').map((r) => r.values)
  const applied = applyRows(products, rows, { year, base })
  const report = applied.report
  const { products: next, ok } = keepValid(products, applied.products, report)
  if (!ok) {
    for (const i of bestandSchema.safeParse(next).error?.issues ?? [])
      report.problems.push(
        `Ergebnis wäre ungültig (${i.path.join('.')}: ${i.message}) – nichts geschrieben.`,
      )
    return { report, write: null, invalid: true }
  }
  if (report.changes.length === 0) return { report, write: null, invalid: false }
  const file = path.join(root, BESTAND_DIR, BESTAND_FILE)
  return {
    report,
    invalid: false,
    // `next` statt `valid.data`: Reihenfolge der Felder bleibt wie in der Datei (kleiner Diff)
    write: async () => {
      await writeFile(file, await formatJson(root, file, next))
      return path.relative(root, file)
    },
  }
}
