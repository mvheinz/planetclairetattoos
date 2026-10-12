import ExcelJS from 'exceljs'

import type { CellValue } from '@/lib/pflege/cells'
import { LIST_ID_PATTERN } from '@/lib/pflege/snapshot'
import {
  findListId,
  loadWorkbook,
  plainValue,
  readTables,
  writeHeader,
} from '@/lib/pflege/workbook'

import { TEXT_COLUMNS, textRow } from './excel'
import { TEXT_SHEETS, type TextEntry } from './model'

// Excel-Datei der Texte-Liste (U-87, U-89): Blatt „Anleitung“ (mit Listen-Nr.) und ein Blatt je Bereich (Startseite,
// Shop, …). Spalten: Wo, Deutsch, Englisch, Deine Notiz, Kennung. Rechtlich vorgegebene Zeilen grau. Seit V-36 steht
// die Listen-Nr. zusätzlich rechts in der Kopfzeile **jedes** Bereichs-Blatts: Schickt Jutta nur ein Blatt zurück oder
// kopiert sie Blätter aus verschiedenen Listen in eine Datei, gleicht der Rückweg jedes Blatt mit seiner eigenen Liste ab.

const GREY = 'FFEDEBE4'
const HEAD = 'FF1C1A17'
const PAPER = 'FFF8F9EC'

const GUIDE = [
  'So korrigierst du die Texte deiner Seite',
  '',
  '1. Unten gibt es ein Blatt je Bereich: Startseite, Shop, Tattoo, Seiten, Fragen, Kasse & Bestellung, E-Mails, Allgemein.',
  '2. In der Spalte „Deutsch“ korrigierst du einfach den Text. „Wo auf der Seite“ zeigt dir, wo er steht. Einen Text bitte nicht mit „-“ oder „=“ beginnen (sonst zeigt die Tabelle einen Fehler).',
  '3. Englisch musst du nicht anfassen: Änderst du nur das Deutsche, schreibe ich das Englische passend dazu.',
  '4. Zeichen in geschweiften Klammern wie {name} oder {count, plural, …} und Markierungen wie <link>…</link> bitte genau so stehen lassen – dort setzt die Seite Namen, Zahlen oder Links ein.',
  '5. Graue Zeilen sind rechtlich vorgegeben und nur zum Lesen. Die Rechtstexte selbst stehen nicht in dieser Liste – die kommen von der Kanzlei.',
  '6. „Deine Notiz“: Wünsche, die sich nicht mit einer Korrektur erledigen lassen (z. B. „hier fehlt ein Satz zu …“).',
  '7. Spalte „Kennung“ bitte nicht ändern, Zeilen bitte nicht löschen. Oben in jedem Blatt stehen die wichtigsten Texte (Seiten, Kategorien, Fragen), darunter die festen Programmtexte.',
  '8. Fertig? Datei als Excel sichern und zurückschicken. Ich übernehme nur, was du geändert hast.',
]

export interface TextBookInput {
  entries: readonly TextEntry[]
  date: string
  listId: string
}

/** Grobe Zeilenhöhe für umbrochenen Text (Excel berechnet sie beim Öffnen nicht immer selbst). */
function rowHeight(e: TextEntry): number {
  const lines = Math.max(
    ...[e.de, e.en].map((t) =>
      t.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 62)), 0),
    ),
    Math.ceil(e.where.length / 34),
  )
  return Math.min(409, Math.max(20, lines * 15 + 5))
}

export async function buildTexteBook(input: TextBookInput): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Planet Claire'
  wb.created = new Date(0)
  wb.modified = new Date(0)
  wb.title = `Webseitentexte ${input.listId}`
  wb.subject = input.listId

  const guide = wb.addWorksheet('Anleitung', { properties: { tabColor: { argb: 'FF0F4C4F' } } })
  guide.getColumn(1).width = 110
  GUIDE.forEach((line, i) => {
    const cell = guide.getCell(i + 1, 1)
    cell.value = line
    cell.alignment = { wrapText: true, vertical: 'top' }
    if (i === 0) cell.font = { bold: true, size: 16 }
  })
  const counts = TEXT_SHEETS.map(
    (s) => `${s}: ${input.entries.filter((e) => e.sheet === s).length}`,
  )
  guide.getCell(GUIDE.length + 2, 1).value =
    `Stand: ${input.date} · ${input.entries.length} Texte (${counts.join(', ')})`
  guide.getCell(GUIDE.length + 3, 1).value = `Listen-Nr.: ${input.listId} (bitte nicht ändern)`

  for (const sheet of TEXT_SHEETS) {
    const list = input.entries.filter((e) => e.sheet === sheet)
    if (!list.length) continue
    const ws = wb.addWorksheet(sheet, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })
    ws.columns = TEXT_COLUMNS.map((c) => ({ key: c.key, width: c.width }))
    writeHeader(
      ws,
      TEXT_COLUMNS.map((c) => (c.key === 'id' ? { ...c, hint: `Liste ${input.listId}` } : c)),
      { head: HEAD, text: PAPER },
    )
    // Listen-Nr. je Blatt (V-36), rechts neben der Kopfzeile – gehört zu keiner Spalte
    const tag = ws.getRow(1).getCell(TEXT_COLUMNS.length + 1)
    tag.value = `Listen-Nr. ${input.listId}`
    tag.font = { size: 8, color: { argb: 'FF6B6B6B' } }
    ws.getColumn(TEXT_COLUMNS.length + 1).width = 26
    list.forEach((e, r) => {
      const row = ws.getRow(r + 2)
      const values = textRow(e)
      row.height = rowHeight(e)
      TEXT_COLUMNS.forEach((c, i) => {
        const cell = row.getCell(i + 1)
        const v = values[c.key]
        cell.value = v === undefined || v === '' ? null : (v as ExcelJS.CellValue)
        cell.alignment = { vertical: 'top', wrapText: !!c.wrap }
        if (c.readOnly || (e.locked && (c.key === 'de' || c.key === 'en')))
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } }
        if (c.key === 'id') cell.font = { size: 8, color: { argb: 'FF6B6B6B' } }
      })
      if (e.locked) row.getCell(1).note = e.locked
    })
  }
  return wb
}

/** Zeilen aller Bereichs-Blätter und die Listen-Nr. */
export async function readTexteBook(
  buffer: Buffer,
  fileName?: string,
): Promise<ReturnType<typeof readTexteWorkbook>> {
  const wb = await loadWorkbook(buffer)
  return readTexteWorkbook(wb, fileName)
}

export function readTexteWorkbook(
  wb: ExcelJS.Workbook,
  fileName?: string,
): {
  rows: Record<string, CellValue>[]
  listId: string | null
  /** Listen-Nr. je Zeile (Blatt mit eigener Nummer, sonst die der Datei; V-36). */
  rowListIds: (string | null)[]
} {
  const tables = readTables(wb, TEXT_COLUMNS, 'id', 'Texte-Liste')
  const listId = findListId(wb, fileName)
  const bySheet = sheetListIds(wb)
  return {
    rows: tables.map((r) => r.values),
    listId,
    rowListIds: tables.map((r) => bySheet.get(r.sheet) ?? listId),
  }
}

/** Listen-Nr., die ein Blatt selbst trägt (erste Zeilen), je Blattname. */
export function sheetListIds(wb: ExcelJS.Workbook): Map<string, string> {
  const out = new Map<string, string>()
  for (const ws of wb.worksheets) {
    const last = Math.min(ws.rowCount, 3)
    for (let r = 1; r <= last && !out.has(ws.name); r++)
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        if (out.has(ws.name)) return
        const m = LIST_ID_PATTERN.exec(String(plainValue(cell.value) ?? ''))
        if (m) out.set(ws.name, m[0])
      })
  }
  return out
}
