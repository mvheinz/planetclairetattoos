import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BESTAND_COLUMNS } from '@/lib/bestand/excel'
import { PFLEGE_STAND_DIR } from '@/lib/pflege/repoStore'
import { TEXT_COLUMNS } from '@/lib/texte/excel'

import { runExport, runImport } from '../../../scripts/pflege/index'

// U-89 (P18.1/P18.2): der ganze Weg in einem Arbeitsordner – Listen ausgeben (Stand gemerkt), in „Numbers“ ändern
// (Blatt umbenannt, anderer Dateiname), zurückspielen (Datei geschrieben, Bericht), zweites Zurückspielen ändert nichts,
// ohne gemerkten Stand nur mit Freigabe.

const repo = path.resolve(import.meta.dirname, '../../..')
const NOW = new Date('2026-10-11T10:00:00Z')
const FILES = [
  'content/bestand/products.json',
  'src/i18n/messages/de.json',
  'src/i18n/messages/en.json',
  'src/globals/siteTexts.defaults.json',
  'content/seed/data/pages.json',
  'content/seed/data/faqs.json',
  'content/seed/data/base.json',
  '.prettierignore',
  '.prettierrc.json',
]
const quiet = () => {}

let root = ''
let exported: { file: string; listId: string }[] = []

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'pflege-'))
  for (const f of FILES) {
    await mkdir(path.dirname(path.join(root, f)), { recursive: true })
    await cp(path.join(repo, f), path.join(root, f))
  }
  await symlink(path.join(repo, 'content/bestand/fotos'), path.join(root, 'content/bestand/fotos'))
  exported = await runExport(root, ['bestand', 'texte'], NOW, quiet)
}, 60_000)

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})

const read = (f: string) => readFile(path.join(root, f), 'utf8')

/** Liste öffnen, ändern und unter neuem Namen sichern (wie „Kopie senden → Excel“ aus Numbers). */
async function edit(
  source: string,
  name: string,
  change: (wb: ExcelJS.Workbook) => void,
): Promise<string> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(source)
  change(wb)
  const out = path.join(root, name)
  await wb.xlsx.writeFile(out)
  return out
}

function setByKey(
  ws: ExcelJS.Worksheet,
  keyCol: number,
  key: string | number,
  col: number,
  value: ExcelJS.CellValue,
) {
  ws.eachRow((row) => {
    if (row.getCell(keyCol).value === key) row.getCell(col).value = value
  })
}

const bcol = (k: string) => BESTAND_COLUMNS.findIndex((c) => c.key === k) + 1
const tcol = (k: string) => TEXT_COLUMNS.findIndex((c) => c.key === k) + 1

describe('Pflege per Excel – ganzer Weg (U-89)', () => {
  it('Ausgeben: zwei Listen mit Listen-Nr., Stand gemerkt', async () => {
    expect(exported.map((e) => path.basename(e.file))).toEqual(
      exported.map(
        (e) => `planet-claire-${e.listId.startsWith('B') ? 'bestand' : 'texte'}-${e.listId}.xlsx`,
      ),
    )
    expect(exported[0]!.listId).toMatch(/^B-2026-10-11-/)
    expect(exported[1]!.listId).toMatch(/^T-2026-10-11-/)
    for (const { listId } of exported)
      expect(JSON.parse(await read(path.join(PFLEGE_STAND_DIR, `${listId}.json`))).id).toBe(listId)
  })

  it('Bestand: Änderung und „Verkauft“ übernommen, zweites Zurückspielen ändert nichts', async () => {
    const before = JSON.parse(await read('content/bestand/products.json')) as {
      itemNumber: number
      priceCents: number
      sold?: unknown
    }[]
    const [a, b] = before
    const file = await edit(exported[0]!.file, 'Bestand bearbeitet.xlsx', (wb) => {
      const ws = wb.getWorksheet('Bestand')!
      ws.name = 'Bestand – Tabelle 1'
      setByKey(ws, bcol('nr'), a!.itemNumber, bcol('preis'), 61)
      setByKey(ws, bcol('nr'), b!.itemNumber, bcol('verkauft'), '11.10.2026 40 € Markt')
    })
    const first = await runImport(root, file, { dry: false, withoutBase: false }, NOW, quiet)
    expect(first.exit).toBe(0)
    expect(first.written).toBe('content/bestand/products.json')
    const after = JSON.parse(await read('content/bestand/products.json')) as typeof before
    expect(after[0]!.priceCents).toBe(6100)
    expect(after[1]!.sold).toEqual({ date: '2026-10-11', priceCents: 4000, note: 'Markt' })
    expect(after.slice(2)).toEqual(before.slice(2))
    const report = await readFile(first.report, 'utf8')
    expect(report).toMatch(/## Übernommen \(2\)/)
    expect(report).toContain(exported[0]!.listId)

    const second = await runImport(root, file, { dry: false, withoutBase: false }, NOW, quiet)
    expect(second.written).toBeNull()
    expect(await readFile(second.report, 'utf8')).toMatch(/## Übernommen \(0\)/)
  })

  it('Listen-Nr. fehlt in der Datei: erst Exit 3, mit --liste= gegen den richtigen Stand übernommen', async () => {
    const before = JSON.parse(await read('content/bestand/products.json')) as {
      itemNumber: number
      weightGrams: number
    }[]
    const third = before[2]!
    const file = await edit(exported[0]!.file, 'ohne-nummer.xlsx', (wb) => {
      wb.removeWorksheet(wb.getWorksheet('Anleitung')!.id)
      wb.subject = ''
      wb.title = ''
      const ws = wb.getWorksheet('Bestand')!
      ws.getRow(1).getCell(bcol('nr')).note = ''
      setByKey(ws, bcol('nr'), third.itemNumber, bcol('gewicht'), third.weightGrams + 7)
    })
    const blocked = await runImport(root, file, { dry: false, withoutBase: false }, NOW, quiet)
    expect(blocked.exit).toBe(3)
    expect(await readFile(blocked.report, 'utf8')).toMatch(/Keine Listen-Nr\. gefunden/)
    const ok = await runImport(
      root,
      file,
      { dry: false, withoutBase: false, listId: exported[0]!.listId },
      NOW,
      quiet,
    )
    expect(ok.exit).toBe(0)
    const after = JSON.parse(await read('content/bestand/products.json')) as typeof before
    expect(after[2]!.weightGrams).toBe(third.weightGrams + 7)
    // die Änderungen aus der ersten Liste (Preis, Verkauft) setzt das Original nicht zurück
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2))
    const report = await readFile(ok.report, 'utf8')
    expect(report).toMatch(/von Hand angegeben/)
    expect(report).toMatch(/Übernommenes in der Liste .* vermerkt/)
  })

  it('Texte: nur die geänderte Zeile ändert sich in der Datei; Englisch zum Nachziehen im Bericht', async () => {
    const before = await read('content/seed/data/pages.json')
    const file = await edit(exported[1]!.file, 'texte.xlsx', (wb) => {
      setByKey(
        wb.getWorksheet('Startseite')!,
        tcol('id'),
        'seite:home:layout.0.heading',
        tcol('de'),
        'Ein kleiner Planet, auf dem alles genau einmal vorkommt',
      )
    })
    const res = await runImport(root, file, { dry: false, withoutBase: false }, NOW, quiet)
    expect(res.exit).toBe(0)
    expect(res.written).toBe('content/seed/data/pages.json')
    const after = await read('content/seed/data/pages.json')
    const changed = after.split('\n').filter((l, i) => l !== before.split('\n')[i])
    expect(changed).toEqual([
      '          "de": "Ein kleiner Planet, auf dem alles genau einmal vorkommt",',
    ])
    expect(await readFile(res.report, 'utf8')).toMatch(/## Englisch zu ergänzen \(1\)/)
  })

  it('ohne gemerkten Stand: nichts geschrieben (Exit 3), mit Freigabe geschrieben', async () => {
    const listId = exported[1]!.listId
    await unlink(path.join(root, PFLEGE_STAND_DIR, `${listId}.json`))
    const before = await read('src/globals/siteTexts.defaults.json')
    const file = await edit(exported[1]!.file, 'ohne-stand.xlsx', (wb) => {
      setByKey(
        wb.getWorksheet('E-Mails')!,
        tcol('id'),
        'st:emails.signature',
        tcol('de'),
        'Aus meinen Händen, in Berlin.',
      )
    })
    const blocked = await runImport(root, file, { dry: false, withoutBase: false }, NOW, quiet)
    expect(blocked.exit).toBe(3)
    expect(blocked.written).toBeNull()
    expect(await read('src/globals/siteTexts.defaults.json')).toBe(before)
    expect(await readFile(blocked.report, 'utf8')).toMatch(/--ohne-stand/)
    const ok = await runImport(root, file, { dry: false, withoutBase: true }, NOW, quiet)
    expect(ok.exit).toBe(0)
    // ohne Stand zählt jeder Unterschied: auch die Startseiten-Überschrift von oben wird auf den alten Text gesetzt
    expect(ok.written?.split(', ').sort()).toEqual([
      'content/seed/data/pages.json',
      'src/globals/siteTexts.defaults.json',
    ])
    expect(JSON.parse(await read('src/globals/siteTexts.defaults.json')).emails.signature.de).toBe(
      'Aus meinen Händen, in Berlin.',
    )
  })

  it('keine Excel-Datei: verständlicher Fehler', async () => {
    const bad = path.join(root, 'liste.numbers')
    await cp(path.join(root, '.prettierrc.json'), bad)
    await expect(
      runImport(root, bad, { dry: true, withoutBase: false }, NOW, quiet),
    ).rejects.toThrow(/keine Excel-Datei/)
  })
})
