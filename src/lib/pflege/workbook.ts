import ExcelJS from 'exceljs'

import { fold, UNREADABLE, type CellValue, type SheetRow } from './cells'
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
  values: SheetRow
}

/** Fehlerwert einer Zelle (`#NAME?` …), auch als Ergebnis einer Formel; sonst `null`. */
export function cellError(v: ExcelJS.CellValue | undefined): string | null {
  if (!v || typeof v !== 'object' || v instanceof Date) return null
  if ('error' in v) return String((v as { error: unknown }).error)
  if ('formula' in v || 'sharedFormula' in v) {
    const r = (v as { result?: ExcelJS.CellValue }).result
    return cellError(r)
  }
  return null
}

/** Zellwert normalisieren: Rich-Text → Text, Formel → Ergebnis, Link → Text, Fehler → null (siehe `cellError`). */
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
export function headerOf(
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
      const values: SheetRow = {}
      const unreadable: Record<string, string> = {}
      for (const [col, key] of head.cols) {
        const cell = row.getCell(col)
        // Verbundene Zellen: exceljs liefert den Wert der ersten Zelle auch für die übrigen – nie übernehmen
        if (cell.isMerged && cell.master !== cell) {
          unreadable[key] = 'verbundene Zelle – bitte die Verbindung aufheben'
          continue
        }
        const error = cellError(cell.value)
        if (error) {
          unreadable[key] =
            `die Zelle zeigt einen Fehler (${error}) – steht am Anfang „-“, „+“ oder „=“? Bitte ohne dieses Zeichen schreiben`
          continue
        }
        values[key] = plainValue(cell.value)
      }
      const filled = Object.values(values).some(
        (v) => v !== null && v !== false && String(v).trim() !== '',
      )
      if (Object.keys(unreadable).length) values[UNREADABLE] = unreadable
      if (filled || Object.keys(unreadable).length) rows.push({ sheet: ws.name, row: r, values })
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

/** Grenzen für hochgeladene Listen (Schutz vor übergroßen oder präparierten Dateien, auch für P19). */
export const XLSX_LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  maxEntries: 5000,
  maxUncompressed: 250 * 1024 * 1024,
}

const NOT_EXCEL =
  'Die Datei ist keine Excel-Datei (.xlsx). In Numbers bitte „···“ → „Exportieren“ → „Excel“ wählen.'

/** Inhaltsverzeichnis des ZIP-Archivs (zentrales Verzeichnis), ohne zu entpacken. */
export function zipEntries(buf: Buffer): { name: string; size: number; packed: number }[] {
  const min = Math.max(0, buf.length - 22 - 0xffff)
  let eocd = -1
  for (let i = buf.length - 22; i >= min; i--)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  if (eocd < 0) throw new Error(NOT_EXCEL)
  const count = buf.readUInt16LE(eocd + 10)
  const cdOffset = buf.readUInt32LE(eocd + 16)
  if (count === 0xffff || cdOffset === 0xffffffff || cdOffset >= buf.length)
    throw new Error(NOT_EXCEL)
  const out: { name: string; size: number; packed: number }[] = []
  let p = cdOffset
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error(NOT_EXCEL)
    const packed = buf.readUInt32LE(p + 20)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    out.push({ name: buf.toString('utf8', p + 46, p + 46 + nameLen), size, packed })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/**
 * Datei laden (xlsx). Andere Formate (.numbers, .csv, PDF …) mit verständlicher Meldung ablehnen; übergroße Dateien und
 * ZIP-Bomben ablehnen, bevor exceljs entpackt.
 */
export async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  // xlsx ist ein ZIP-Archiv („PK“ am Anfang)
  if (buffer.length < 22 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error(NOT_EXCEL)
  if (buffer.length > XLSX_LIMITS.maxBytes)
    throw new Error(
      `Die Datei ist zu groß (${Math.round(buffer.length / 1024 / 1024)} MB, höchstens 25 MB).`,
    )
  const entries = zipEntries(buffer)
  const names = new Set(entries.map((e) => e.name))
  if (!names.has('xl/workbook.xml') || !names.has('[Content_Types].xml')) throw new Error(NOT_EXCEL)
  const total = entries.reduce((n, e) => n + e.size, 0)
  if (
    entries.length > XLSX_LIMITS.maxEntries ||
    total > XLSX_LIMITS.maxUncompressed ||
    entries.some((e) => e.size > 50 * 1024 * 1024 && e.size > e.packed * 200)
  )
    throw new Error(
      'Die Datei ist ungewöhnlich aufgebaut (zu groß entpackt) – bitte neu aus Numbers exportieren.',
    )
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  if (wb.worksheets.length === 0) throw new Error(NOT_EXCEL)
  return wb
}

/** Wie gut passt die Mappe zu diesen Spalten? Höchste Zahl erkannter Überschriften eines Blatts (0 = gar nicht). */
export function tableScore(
  wb: ExcelJS.Workbook,
  columns: readonly TableColumn[],
  required: string,
): number {
  return Math.max(0, ...wb.worksheets.map((ws) => headerOf(ws, columns, required)?.cols.size ?? 0))
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
