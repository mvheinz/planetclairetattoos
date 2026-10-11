import ExcelJS from 'exceljs'

import { fold, type CellValue } from './cells'
import { LIST_ID_PATTERN } from './snapshot'

// Excel-Dateien lesen, die Jutta mit Numbers oder Excel bearbeitet hat (U-89 b). Numbers benennt Blätter beim Export
// manchmal um („Bestand – Tabelle 1“), lässt Kommentare, Auswahllisten oder ausgeblendete Blätter weg und darf Spalten
// verschieben. Deshalb: Tabellen über ihre **Überschriften** finden (in den ersten Zeilen jedes Blatts), Spalten über die
// Überschrift zuordnen und die Listen-Nr. überall suchen (Zellen, Kommentare, Dateieigenschaften, Dateiname).

export interface TableColumn {
  key: string
  header: string
  /** Weitere Schreibweisen der Überschrift (ältere Listen, Englisch). */
  aliases?: readonly string[]
}

export interface TableRow {
  /** Blattname und Zeilennummer (für Meldungen). */
  sheet: string
  row: number
  values: Record<string, CellValue>
}

/** Zellwert normalisieren: Rich-Text → Text, Formel → Ergebnis, Link → Text, Fehler → null. */
export function plainValue(v: ExcelJS.CellValue | undefined): CellValue {
  if (v === null || v === undefined) return null
  if (v instanceof Date || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')
    return v
  if (typeof v === 'object') {
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('')
    if ('formula' in v || 'sharedFormula' in v)
      return plainValue((v as { result?: ExcelJS.CellValue }).result ?? null)
    if ('text' in v) {
      const t = (v as { text?: unknown }).text
      if (typeof t === 'string') return t
      if (t && typeof t === 'object' && 'richText' in t)
        return plainValue(t as ExcelJS.CellRichTextValue)
    }
    if ('error' in v) return null
  }
  return String(v)
}

const SCAN_ROWS = 10

/** Je Blatt die Kopfzeile mit den meisten bekannten Überschriften (muss `required` enthalten). */
function headerOf(
  ws: ExcelJS.Worksheet,
  columns: readonly TableColumn[],
  required: string,
): { row: number; cols: Map<number, string> } | null {
  const byText = new Map<string, string>()
  for (const c of columns)
    for (const h of [c.header, ...(c.aliases ?? [])]) byText.set(fold(h), c.key)
  let best: { row: number; cols: Map<number, string> } | null = null
  const last = Math.min(ws.rowCount, SCAN_ROWS)
  for (let r = 1; r <= last; r++) {
    const cols = new Map<number, string>()
    const taken = new Set<string>()
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const key = byText.get(fold(String(plainValue(cell.value) ?? '')))
      if (key && !taken.has(key)) {
        cols.set(col, key)
        taken.add(key)
      }
    })
    if (taken.has(required) && (!best || cols.size > best.cols.size)) best = { row: r, cols }
  }
  return best
}

/**
 * Alle Tabellen der Mappe mit diesen Überschriften lesen (jede Zeile unter der Kopfzeile, leere Zeilen übersprungen).
 * Ohne passende Tabelle: Fehler mit Erklärung für Jutta.
 */
export function readTables(
  wb: ExcelJS.Workbook,
  columns: readonly TableColumn[],
  required: string,
  what: string,
): TableRow[] {
  const rows: TableRow[] = []
  let found = false
  for (const ws of wb.worksheets) {
    const head = headerOf(ws, columns, required)
    if (!head || head.cols.size < 2) continue
    found = true
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      if (r <= head.row) return
      const values: Record<string, CellValue> = {}
      for (const [col, key] of head.cols) values[key] = plainValue(row.getCell(col).value)
      if (Object.values(values).some((v) => v !== null && String(v).trim() !== ''))
        rows.push({ sheet: ws.name, row: r, values })
    })
  }
  if (!found) {
    const header = columns.find((c) => c.key === required)?.header ?? required
    throw new Error(
      `In der Datei steht keine ${what} (Spalte „${header}“ nicht gefunden) – bitte die Überschriften nicht ändern.`,
    )
  }
  return rows
}

function noteText(note: ExcelJS.Cell['note']): string {
  if (!note) return ''
  if (typeof note === 'string') return note
  return (note.texts ?? []).map((t) => t.text).join('')
}

/** Listen-Nr. in der Mappe (Zellen und Kommentare der ersten Zeilen, Dateieigenschaften) oder im Dateinamen. */
export function findListId(wb: ExcelJS.Workbook, fileName?: string): string | null {
  for (const ws of wb.worksheets) {
    const last = Math.min(ws.rowCount, 60)
    for (let r = 1; r <= last; r++) {
      let hit: string | null = null
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        if (hit) return
        const m =
          LIST_ID_PATTERN.exec(String(plainValue(cell.value) ?? '')) ??
          LIST_ID_PATTERN.exec(noteText(cell.note))
        if (m) hit = m[0]
      })
      if (hit) return hit
    }
  }
  for (const v of [wb.subject, wb.keywords, wb.title, wb.description, fileName]) {
    const m = v ? LIST_ID_PATTERN.exec(v) : null
    if (m) return m[0]
  }
  return null
}

/** Datei laden (xlsx). Andere Formate (z. B. .numbers, .csv) mit verständlicher Meldung ablehnen. */
export async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  // xlsx ist ein ZIP-Archiv („PK“ am Anfang)
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(
      'Die Datei ist keine Excel-Datei (.xlsx). In Numbers bitte „Teilen → Exportieren → Excel“ wählen.',
    )
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  return wb
}

/** Kopfzeile schreiben: dunkel, fett, mit Hinweisen als Kommentar. */
export function writeHeader(
  ws: ExcelJS.Worksheet,
  columns: readonly (TableColumn & { hint?: string; width?: number })[],
  colors: { head: string; text: string },
): void {
  const header = ws.getRow(1)
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: colors.text } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.head } }
    cell.alignment = { wrapText: true, vertical: 'middle' }
    if (c.hint) cell.note = c.hint
  })
  header.height = 34
}
