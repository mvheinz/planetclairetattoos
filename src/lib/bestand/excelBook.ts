import ExcelJS from 'exceljs'

import { findListId, loadWorkbook, readTables, writeHeader } from '@/lib/pflege/workbook'

import { BESTAND_COLUMNS, rowOf, type CellValue } from './excel'
import type { BestandProduct } from './schema'

// Excel-Datei der Bestandsliste (U-85, U-89, PLAN P18.1) mit exceljs: Blatt „Anleitung“ (mit Listen-Nr.) und Blatt
// „Bestand“ (eine Zeile je Stück, kleines Foto, Auswahllisten, Spalten nur zum Lesen grau). Lesen über
// `src/lib/pflege/workbook.ts`: Tabelle und Spalten über die Überschriften (Numbers darf umbenennen und verschieben).

export const BESTAND_SHEET = 'Bestand'
export const GUIDE_SHEET = 'Anleitung'

const GUIDE = [
  'So bearbeitest du deine Bestandsliste',
  '',
  '1. Öffne das Blatt „Bestand“ (unten). Jede Zeile ist ein Stück, links die Nummer und ein kleines Foto.',
  '2. Ändere einfach die Zellen, die nicht stimmen: Name, Preis, Maße, Gewicht, Material, Größe, Fasern … Einen Text bitte nicht mit „-“ oder „=“ beginnen (sonst zeigt die Tabelle einen Fehler).',
  '3. Graue Spalten (Nr., Foto, „Bitte prüfen“) sind nur zum Lesen – dort bitte nichts ändern.',
  '4. „Deine Notiz“: alles, was du mir sagen möchtest (z. B. „Preis noch unsicher“).',
  '5. „Verkauft“: Hast du ein Stück verkauft, trag das Datum ein (z. B. 11.10.2026) – gern mit Preis und kurzer Notiz, z. B. „11.10.2026 35 € Markt“. Ohne Datum: „ja“ davor, z. B. „ja an Freundin“. Leer oder „noch da“ = nicht verkauft.',
  '6. Englische Texte musst du nicht anfassen: Änderst du nur das Deutsche, passe ich das Englische an.',
  '7. Zeilen bitte nicht löschen. Neue Stücke bitte nicht hier eintragen, sondern mit Fotos im Chat schicken.',
  '8. Fertig? Datei als Excel sichern und zurückschicken (Anleitung fürs iPad liegt bei).',
  '9. Ich übernehme nur, was du geändert hast. Hat sich dasselbe Feld inzwischen anders geändert, frage ich nach.',
]

const GREY = 'FFEDEBE4'
const HEAD = 'FF1C1A17'
const PAPER = 'FFF8F9EC'

export interface BookInput {
  products: readonly BestandProduct[]
  /** Vorschaubild je Stück (JPEG, ≈ 120 × 150 px). */
  thumbs: ReadonlyMap<string, Buffer>
  /** Stand (Anzeige), z. B. „11.10.2026“. */
  date: string
  /** Listen-Nr. des gemerkten Stands (U-89 a). */
  listId: string
}

export async function buildBestandBook(input: BookInput): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Planet Claire'
  wb.created = new Date(0)
  wb.modified = new Date(0)
  wb.title = `Bestandsliste ${input.listId}`
  wb.subject = input.listId

  const guide = wb.addWorksheet(GUIDE_SHEET, { properties: { tabColor: { argb: 'FF0F4C4F' } } })
  guide.getColumn(1).width = 110
  GUIDE.forEach((line, i) => {
    const cell = guide.getCell(i + 1, 1)
    cell.value = line
    cell.alignment = { wrapText: true, vertical: 'top' }
    if (i === 0) cell.font = { bold: true, size: 16 }
  })
  guide.getCell(GUIDE.length + 2, 1).value =
    `Stand: ${input.date} · ${input.products.length} Stücke`
  guide.getCell(GUIDE.length + 3, 1).value = `Listen-Nr.: ${input.listId} (bitte nicht ändern)`

  const ws = wb.addWorksheet(BESTAND_SHEET, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
    properties: { defaultRowHeight: 20 },
  })
  ws.columns = BESTAND_COLUMNS.map((c) => ({ key: c.key, width: c.width }))
  writeHeader(
    ws,
    BESTAND_COLUMNS.map((c) =>
      c.key === 'nr' ? { ...c, hint: `${c.hint ?? ''} Liste ${input.listId}`.trim() } : c,
    ),
    { head: HEAD, text: PAPER },
  )

  const sorted = [...input.products].sort((a, b) => a.itemNumber - b.itemNumber)
  sorted.forEach((p, r) => {
    const values = rowOf(p)
    const row = ws.getRow(r + 2)
    row.height = 64
    BESTAND_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      const v = values[c.key]
      cell.value = v === undefined || v === '' ? null : (v as ExcelJS.CellValue)
      cell.alignment = { vertical: 'top', wrapText: !!c.wrap }
      if (c.numFmt) cell.numFmt = c.numFmt
      if (c.readOnly) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } }
      if (c.list)
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${c.list.join(',')}"`],
          showErrorMessage: false,
        }
    })
    const thumb = input.thumbs.get(p.key)
    if (thumb) {
      const id = wb.addImage({ buffer: thumb as unknown as ExcelJS.Buffer, extension: 'jpeg' })
      const col = BESTAND_COLUMNS.findIndex((c) => c.key === 'foto')
      ws.addImage(id, {
        tl: { col: col + 0.1, row: r + 1 + 0.05 },
        ext: { width: 64, height: 80 },
        editAs: 'oneCell',
      })
    }
  })
  return wb
}

/** Zeilen der Bestandsliste und die Listen-Nr. (aus der Datei oder dem Dateinamen). */
export async function readBestandBook(
  buffer: Buffer,
  fileName?: string,
): Promise<{ rows: Record<string, CellValue>[]; listId: string | null }> {
  const wb = await loadWorkbook(buffer)
  const rows = readTables(wb, BESTAND_COLUMNS, 'nr', 'Bestandsliste').map((r) => r.values)
  return { rows, listId: findListId(wb, fileName) }
}
