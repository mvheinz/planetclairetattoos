// Bestandsliste für die Pflege per Excel (U-85, U-86, U-89; PLAN P18.1): Ausgeben aus `content/bestand/products.json`
// (mit kleinen Fotos) und Zurückspielen in dieselbe Datei. Aufruf über `scripts/pflege/index.ts`.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type ExcelJS from 'exceljs'
import sharp from 'sharp'

import {
  applyRows,
  BESTAND_COLUMNS,
  rowOf,
  sameFor,
  snapshotRowsOf,
} from '../../src/lib/bestand/excel'
import { buildBestandBook } from '../../src/lib/bestand/excelBook'
import { keepValid } from '../../src/lib/bestand/excelRepo'
import {
  BESTAND_DIR,
  BESTAND_FILE,
  bestandPhotoPath,
  bestandSchema,
  loadBestand,
} from '../../src/lib/bestand/schema'
import { num, str } from '../../src/lib/pflege/cells'
import { recordConsumed, type PflegeReport } from '../../src/lib/pflege/merge'
import { makeSnapshot, type ListSnapshot } from '../../src/lib/pflege/snapshot'
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
  /** Übernommene Werte im gemerkten Stand festhalten (nach dem Schreiben bzw. wenn nichts zu schreiben war). */
  record: (snapshot: ListSnapshot) => number
  /** Weitere gemerkte Stände (Blätter mit eigener Listen-Nr., V-36) – werden ebenso festgehalten. */
  others?: ListSnapshot[]
}

export async function exportBestand(
  root: string,
  now: Date,
  dateLabel: string,
): Promise<ExportResult> {
  const products = [...(await loadBestand(root))].sort((a, b) => a.itemNumber - b.itemNumber)
  const snapshot = makeSnapshot('bestand', now, snapshotRowsOf(products))
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
  snapshot: ListSnapshot | null,
  clock: { year: number; today: string },
): Promise<ImportResult> {
  const { year, today } = clock
  const products = await loadBestand(root)
  const rows = readTables(wb, BESTAND_COLUMNS, 'nr', 'Bestandsliste').map((r) => r.values)
  const applied = applyRows(products, rows, {
    year,
    today,
    base: snapshot?.rows ?? null,
    consumed: snapshot?.consumed,
  })
  const report = applied.report
  const { products: next, ok } = keepValid(products, applied.products, report)
  const record = (s: ListSnapshot) =>
    recordConsumed(
      s,
      rows.flatMap((r) => (num(r.nr) === null ? [] : [[str(r.nr), r] as const])),
      new Map(next.map((p) => [String(p.itemNumber), rowOf(p)])),
      (column) => sameFor(column, { year, today }),
    )
  if (!ok) {
    for (const i of bestandSchema.safeParse(next).error?.issues ?? [])
      report.problems.push(
        `Ergebnis wäre ungültig (${i.path.join('.')}: ${i.message}) – nichts geschrieben.`,
      )
    return { report, write: null, invalid: true, record: () => 0 }
  }
  if (report.changes.length === 0) return { report, write: null, invalid: false, record }
  const file = path.join(root, BESTAND_DIR, BESTAND_FILE)
  return {
    report,
    invalid: false,
    record,
    // `next` statt `valid.data`: Reihenfolge der Felder bleibt wie in der Datei (kleiner Diff)
    write: async () => {
      await writeFile(file, await formatJson(root, file, next))
      return path.relative(root, file)
    },
  }
}
