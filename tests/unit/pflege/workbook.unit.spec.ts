import ExcelJS from 'exceljs'
import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'

import { str, UNREADABLE } from '@/lib/pflege/cells'
import { loadWorkbook, readTables, tableScore, zipEntries } from '@/lib/pflege/workbook'

// U-89 b: Dateien von Jutta (Numbers/Excel) robust lesen – nur echtes xlsx, Grenzen gegen übergroße Dateien,
// Häkchen und Datum lesbar, Fehlerzellen und verbundene Zellen ändern nichts.

const COLUMNS = [
  { key: 'id', header: 'Kennung' },
  { key: 'de', header: 'Deutsch' },
  { key: 'ok', header: 'Häkchen' },
] as const

async function book(fill: (ws: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Tabelle 1')
  ws.getRow(1).values = ['Kennung', 'Deutsch', 'Häkchen']
  fill(ws)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('Datei prüfen (loadWorkbook)', () => {
  it('liest xlsx und kennt das Inhaltsverzeichnis', async () => {
    const buf = await book((ws) => ws.addRow(['a', 'Text', true]))
    expect(zipEntries(buf).map((e) => e.name)).toContain('xl/workbook.xml')
    const wb = await loadWorkbook(buf)
    expect(tableScore(wb, COLUMNS, 'id')).toBe(3)
  })

  it('lehnt Nicht-Excel ab: Text, Numbers-Datei (ZIP ohne xl/workbook.xml), zu groß', async () => {
    await expect(loadWorkbook(Buffer.from('Kennung;Deutsch\na;b'))).rejects.toThrow(
      /keine Excel-Datei .*Exportieren/,
    )
    const numbers = Buffer.from(
      zipSync({ 'Index/Document.iwa': strToU8('x'), 'Metadata/Properties.plist': strToU8('y') }),
    )
    await expect(loadWorkbook(numbers)).rejects.toThrow(/keine Excel-Datei/)
    const big = Buffer.alloc(26 * 1024 * 1024)
    big[0] = 0x50
    big[1] = 0x4b
    await expect(loadWorkbook(big)).rejects.toThrow(/zu groß/)
  })
})

describe('Zellen lesen (readTables)', () => {
  it('Häkchen, Datum, Fehlerzelle und verbundene Zellen', async () => {
    const buf = await book((ws) => {
      ws.addRow(['a', 'Text', true])
      ws.addRow(['b', { formula: '-x', result: { error: '#NAME?' } } as ExcelJS.CellValue, false])
      ws.addRow(['c', 'links', 'rechts'])
      ws.mergeCells(4, 2, 4, 3)
      ws.addRow([null, null, false]) // nur ein leeres Häkchen: keine Zeile
    })
    const rows = readTables(await loadWorkbook(buf), COLUMNS, 'id', 'Testliste')
    expect(rows.map((r) => r.values.id)).toEqual(['a', 'b', 'c'])
    expect(str(rows[0]!.values.ok)).toBe('ja')
    expect(str(rows[1]!.values.ok)).toBe('')
    expect('de' in rows[1]!.values).toBe(false)
    expect(rows[1]!.values[UNREADABLE]?.de).toMatch(/#NAME\?/)
    expect(rows[2]!.values.de).toBe('links')
    expect('ok' in rows[2]!.values).toBe(false)
    expect(rows[2]!.values[UNREADABLE]?.ok).toMatch(/verbundene Zelle/)
    expect(str(new Date(Date.UTC(2026, 9, 11)))).toBe('11.10.2026')
  })
})
