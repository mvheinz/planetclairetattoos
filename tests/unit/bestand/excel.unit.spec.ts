import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import {
  applyRows,
  BESTAND_COLUMNS,
  parseFibers,
  parseSold,
  rowOf,
  sameFor,
  snapshotRowsOf,
  soldText,
  type CellValue,
} from '@/lib/bestand/excel'
import { buildBestandBook, BESTAND_SHEET, readBestandBook } from '@/lib/bestand/excelBook'
import { keepValid } from '@/lib/bestand/excelRepo'
import { bestandSchema, loadBestand, type BestandProduct } from '@/lib/bestand/schema'
import type { SheetRow } from '@/lib/pflege/cells'
import { emptyReport, recordConsumed } from '@/lib/pflege/merge'
import { makeSnapshot, type ConsumedCells, type SnapshotRows } from '@/lib/pflege/snapshot'

// P18.1 (U-85, U-86, U-89): Bestandsliste als Excel – Rundweg ohne Änderung ändert nichts, geänderte Zellen werden
// übernommen, ungültige gemeldet, „Verkauft“ wird zum Markt-Verkauf; gemerkter Stand (Listen-Nr.): ältere Listen setzen
// nichts zurück, gleiche Zelle hier und dort geändert = Rückfrage; Numbers-Varianten werden gelesen.

const products = await loadBestand()
const byKey = (list: readonly BestandProduct[], key: string) => list.find((p) => p.key === key)!
const NOW = new Date('2026-10-11T10:00:00Z')

const snapshotOf = (list: readonly BestandProduct[]) =>
  makeSnapshot('bestand', NOW, snapshotRowsOf(list))
const SNAP = snapshotOf(products)
const BASE: SnapshotRows = SNAP.rows

const book = (list: readonly BestandProduct[] = products, listId = SNAP.id) =>
  buildBestandBook({ products: list, thumbs: new Map(), date: '11.10.2026', listId })

async function roundTrip(
  edit?: (ws: ExcelJS.Worksheet) => void,
  list: readonly BestandProduct[] = products,
) {
  const wb = await book(list)
  if (edit) edit(wb.getWorksheet(BESTAND_SHEET)!)
  return readBestandBook(Buffer.from(await wb.xlsx.writeBuffer()))
}

const col = (key: string) => BESTAND_COLUMNS.findIndex((c) => c.key === key) + 1
const rowFor = (ws: ExcelJS.Worksheet, nr: number) => {
  let found: ExcelJS.Row | null = null
  ws.eachRow((row) => {
    if (row.getCell(col('nr')).value === nr) found = row
  })
  return found!
}
const apply = (
  rows: SheetRow[],
  base: SnapshotRows | null = BASE,
  list = products,
  consumed?: ConsumedCells,
) => applyRows(list, rows, { year: 2026, base, consumed })

/** Wie `pflege:import` nach dem Schreiben: Übernommenes im Stand vermerken; gibt `consumed` zurück. */
function recorded(rows: SheetRow[], next: readonly BestandProduct[]): ConsumedCells {
  const snap = structuredClone(SNAP)
  recordConsumed(
    snap,
    rows.map((r) => [String(r.nr), r] as const),
    new Map(next.map((p) => [String(p.itemNumber), rowOf(p)])),
    (c: string) => sameFor(c, 2026),
  )
  return snap.consumed ?? {}
}

describe('Bestandsliste als Excel (P18.1)', () => {
  it('Blätter „Anleitung“ und „Bestand“, eine Zeile je Stück, „Verkauft“ und „ins Archiv“ am Ende, Listen-Nr. in der Datei', async () => {
    const wb = await book()
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Anleitung', 'Bestand'])
    const ws = wb.getWorksheet(BESTAND_SHEET)!
    expect(ws.rowCount).toBe(products.length + 1)
    expect(ws.getRow(1).getCell(col('verkauft')).value).toBe('Verkauft')
    expect(ws.getRow(1).getCell(col('insArchiv')).value).toBe('ins Archiv')
    // U-86 / V-11: „Verkauft“ und danach „ins Archiv“ am Ende
    expect(BESTAND_COLUMNS.slice(-2).map((c) => c.key)).toEqual(['verkauft', 'insArchiv'])
    const { listId } = await roundTrip()
    expect(listId).toBe(SNAP.id)
    expect(SNAP.id).toMatch(/^B-2026-10-11-[0-9a-f]{6}$/)
  })

  it('V-11 „ins Archiv“: nie vorangekreuzt; „ja“ nur bei verkauften Stücken, bleibt beim Ändern von „Verkauft“', async () => {
    // keine Zeile der ausgegebenen Liste ist angekreuzt
    expect(products.every((p) => rowOf(p).insArchiv === '')).toBe(true)
    const [bowl, cup] = products.filter((p) => p.category === 'keramik' && !p.sold)
    const { rows } = await roundTrip((ws) => {
      const b = rowFor(ws, bowl!.itemNumber)
      b.getCell(col('verkauft')).value = '11.10.2026 Markt'
      b.getCell(col('insArchiv')).value = 'ja'
      // nicht verkauft → Häkchen gilt nicht
      rowFor(ws, cup!.itemNumber).getCell(col('insArchiv')).value = 'ja'
    })
    const { products: next, report } = apply(rows)
    expect(byKey(next, bowl!.key).sold).toEqual({
      date: '2026-10-11',
      note: 'Markt',
      archive: true,
    })
    expect(byKey(next, cup!.key).sold).toBeUndefined()
    expect(report.problems).toEqual([
      `Nr. ${cup!.itemNumber}: ins Archiv „ja“ – gilt nur für verkaufte Stücke (Spalte „Verkauft“); nicht übernommen.`,
    ])
    expect(bestandSchema.safeParse(next).success).toBe(true)

    // Datum ändern: Häkchen bleibt; Häkchen entfernen: nicht mehr im Archiv; Unsinn wird gemeldet
    const snap = makeSnapshot('bestand', NOW, snapshotRowsOf(next))
    const again = await roundTrip((ws) => {
      rowFor(ws, bowl!.itemNumber).getCell(col('verkauft')).value = '12.10.2026 Markt'
    }, next)
    const moved = applyRows(next, again.rows, { year: 2026, base: snap.rows }).products
    expect(byKey(moved, bowl!.key).sold?.archive).toBe(true)
    const off = await roundTrip((ws) => {
      rowFor(ws, bowl!.itemNumber).getCell(col('insArchiv')).value = ''
    }, next)
    expect(
      byKey(applyRows(next, off.rows, { year: 2026, base: snap.rows }).products, bowl!.key).sold,
    ).toEqual({ date: '2026-10-11', note: 'Markt' })
    const odd = await roundTrip((ws) => {
      rowFor(ws, bowl!.itemNumber).getCell(col('insArchiv')).value = 'vielleicht'
    }, next)
    const oddReport = applyRows(next, odd.rows, { year: 2026, base: snap.rows }).report
    expect(oddReport.problems).toEqual([
      `Nr. ${bowl!.itemNumber}: ins Archiv „vielleicht“ – „ja“ oder leer lassen; nicht übernommen.`,
    ])
  })

  it('Rundweg ohne Änderung: keine Änderung, keine Meldung (mit und ohne gemerkten Stand)', async () => {
    const { rows } = await roundTrip()
    expect(rows).toHaveLength(products.length)
    for (const base of [BASE, null]) {
      const { products: next, report } = apply(rows, base)
      expect(report).toEqual(emptyReport())
      expect(next).toEqual(products)
    }
  })

  it('geänderte Zellen werden übernommen, Englisch zum Nachziehen gemeldet, Ergebnis bleibt gültig', async () => {
    const shirt = products.find((p) => p.category === 'textil')!
    const bowl = products.find((p) => p.category === 'keramik')!
    const chain = products.find((p) => p.category === 'schmuck')!
    const { rows } = await roundTrip((ws) => {
      const s = rowFor(ws, shirt.itemNumber)
      s.getCell(col('preis')).value = '49,50'
      s.getCell(col('fasern')).value = '60 % Baumwolle, 40 % Polyester'
      s.getCell(col('groesse')).value = 'M'
      s.getCell(col('zustand')).value = 'gut'
      const b = rowFor(ws, bowl.itemNumber)
      b.getCell(col('titleDe')).value = 'Schale „Neuer Name“'
      b.getCell(col('breite')).value = 12.5
      b.getCell(col('verkauft')).value = '11.10.2026 35 € Markt Kreuzberg'
      b.getCell(col('notiz')).value = 'Glasur nochmal anschauen'
      const c = rowFor(ws, chain.itemNumber)
      c.getCell(col('metall')).value = 'Edelstahl'
    })
    const { products: next, report } = apply(rows)
    const s = byKey(next, shirt.key)
    expect(s.priceCents).toBe(4950)
    expect(s.fiberComposition).toEqual([
      { component: 'main', fiber: 'cotton', percent: 60 },
      { component: 'main', fiber: 'polyester', percent: 40 },
    ])
    expect(s.sizeLabel).toEqual({ de: 'M', en: 'M' })
    expect(s.condition).toBe('good')
    const b = byKey(next, bowl.key)
    expect(b.title).toEqual({ de: 'Schale „Neuer Name“', en: bowl.title.en })
    expect(b.dimensions.widthCm).toBe(12.5)
    expect(b.sold).toEqual({ date: '2026-10-11', priceCents: 3500, note: 'Markt Kreuzberg' })
    expect(b.ownerNote).toBe('Glasur nochmal anschauen')
    expect(byKey(next, chain.key).metalPartsMaterial).toEqual({ de: 'Edelstahl' })
    expect(report.problems).toEqual([])
    expect(report.conflicts).toEqual([])
    expect(report.changes.length).toBe(9)
    expect(report.englishTodo).toEqual([
      `Nr. ${bowl.itemNumber}: Name (Deutsch geändert)`,
      `Nr. ${chain.itemNumber}: Metallteile (Deutsch geändert, Englisch fehlt)`,
    ])
    expect(bestandSchema.safeParse(next).success).toBe(true)
    // Original unverändert
    expect(byKey(products, bowl.key).sold).toBeUndefined()
  })

  it('ungültige Werte, Kategorie-Wechsel, Lese-Spalten, unbekannte Nummer, neue und fehlende Zeilen werden gemeldet', async () => {
    const [a, b, c] = products
    const { rows: all } = await roundTrip((ws) => {
      const r = rowFor(ws, a!.itemNumber)
      r.getCell(col('preis')).value = 'teuer'
      r.getCell(col('kategorie')).value = 'Schmuck'
      r.getCell(col('pruefen')).value = 'erledigt'
      rowFor(ws, b!.itemNumber).getCell(col('titleEn')).value = ''
      rowFor(ws, c!.itemNumber).getCell(col('nr')).value = 999
      const extra = ws.getRow(ws.rowCount + 1)
      extra.getCell(col('titleDe')).value = 'Neue Tasse'
      extra.getCell(col('preis')).value = 30
    })
    const rows = all.filter((r) => r.nr !== products[3]!.itemNumber)
    const { products: next, report } = apply(rows)
    expect(next).toEqual(products)
    const text = report.problems.join('\n')
    expect(text).toMatch(new RegExp(`Nr. ${a!.itemNumber}: Preis „teuer“`))
    expect(text).toMatch(/Kategorie .* nicht automatisch übernommen/)
    expect(text).toMatch(/„Bitte prüfen“ ist nur zum Lesen/)
    expect(text).toMatch(
      new RegExp(`Nr. ${b!.itemNumber}: Name \\(Englisch\\) „“ – darf nicht leer sein`),
    )
    expect(text).toMatch(/Nr. 999 gibt es im Bestand nicht/)
    expect(text).toMatch(new RegExp(`Nr. ${c!.itemNumber} fehlt in der Liste`))
    expect(text).toMatch(new RegExp(`Nr. ${products[3]!.itemNumber} fehlt in der Liste`))
    expect(report.newEntries).toEqual([
      'Neues Stück „Neue Tasse“, 30 € – bitte mit Fotos anlegen lassen.',
    ])
  })

  it('Name zu kurz oder doppelt: nur dieses Stück bleibt beim alten Stand', async () => {
    const [a, b] = products
    const { rows } = await roundTrip((ws) => {
      rowFor(ws, a!.itemNumber).getCell(col('titleDe')).value = 'ab'
      const r = rowFor(ws, b!.itemNumber)
      r.getCell(col('titleDe')).value = products[2]!.title.de
      r.getCell(col('preis')).value = 77
    })
    const applied = apply(rows)
    expect(applied.report.problems.join('\n')).toMatch(
      /Name \(Deutsch\) „ab“ – bitte 3–120 Zeichen/,
    )
    const { products: next, ok } = keepValid(products, applied.products, applied.report)
    expect(ok).toBe(true)
    expect(byKey(next, b!.key)).toEqual(b)
    expect(applied.report.problems.join('\n')).toMatch(
      new RegExp(
        `Nr. ${b!.itemNumber}: Änderungen an diesem Stück nicht übernommen – den Namen .* hat schon Nr. ${products[2]!.itemNumber}`,
      ),
    )
    expect(applied.report.changes.some((c) => c.startsWith(`Nr. ${b!.itemNumber}:`))).toBe(false)
  })
})

describe('Gemerkter Stand (U-89 a)', () => {
  const p = products[4]!
  const q = products[6]!

  it('ältere Liste setzt inzwischen geänderte Werte nicht zurück; Juttas Änderung an anderer Stelle gilt', async () => {
    const { rows } = await roundTrip((ws) => {
      rowFor(ws, q.itemNumber).getCell(col('gewicht')).value = 321
    })
    // inzwischen (nach dem Ausgeben) geändert: Preis von p
    const current = products.map((x) =>
      x.key === p.key ? { ...x, priceCents: x.priceCents + 500 } : x,
    )
    const { products: next, report } = apply(rows, BASE, current)
    expect(byKey(next, p.key).priceCents).toBe(p.priceCents + 500) // nicht zurückgesetzt
    expect(byKey(next, q.key).weightGrams).toBe(321)
    expect(report.conflicts).toEqual([])
    // ohne gemerkten Stand würde die alte Liste den Preis zurücksetzen – deshalb nur mit Freigabe (CLI)
    expect(byKey(apply(rows, null, current).products, p.key).priceCents).toBe(p.priceCents)
  })

  it('dieselbe Zelle hier und dort geändert: nichts überschrieben, Rückfrage', async () => {
    const { rows } = await roundTrip((ws) => {
      rowFor(ws, p.itemNumber).getCell(col('preis')).value = 60
    })
    const current = products.map((x) => (x.key === p.key ? { ...x, priceCents: 5500 } : x))
    const { products: next, report } = apply(rows, BASE, current)
    expect(byKey(next, p.key).priceCents).toBe(5500)
    expect(report.conflicts).toEqual([
      `Nr. ${p.itemNumber}: Preis (€) – in deiner Liste „60“, inzwischen „55“. Was gilt?`,
    ])
    expect(report.changes).toEqual([])
  })

  it('dieselbe Liste zweimal zurückspielen ändert beim zweiten Mal nichts', async () => {
    const { rows } = await roundTrip((ws) => {
      rowFor(ws, p.itemNumber).getCell(col('preis')).value = 61
      rowFor(ws, q.itemNumber).getCell(col('verkauft')).value = 'ja'
    })
    const first = apply(rows)
    expect(first.report.changes).toHaveLength(2)
    const second = apply(rows, BASE, first.products)
    expect(second.report).toEqual(emptyReport())
    expect(second.products).toEqual(first.products)
  })

  it('Stück nach dem Ausgeben neu hinzugekommen: fehlt nicht in der Liste', async () => {
    const { rows } = await roundTrip(undefined, products.slice(1))
    const base = snapshotOf(products.slice(1)).rows
    const { report } = apply(rows, base)
    expect(report).toEqual(emptyReport())
  })
})

describe('Zweites Zurückspielen und Korrekturen (U-89 c, Prüfung)', () => {
  const shirt = products.find((p) => p.category === 'textil')!
  const bowl = products.find((p) => p.category === 'keramik')!

  it('Datum, Häkchen, „100% Baumwolle“, „Nein“, 12,34 cm: zweimal zurückgespielt ändert nichts und fragt nichts', async () => {
    const { rows } = await roundTrip((ws) => {
      const s = rowFor(ws, shirt.itemNumber)
      s.getCell(col('verkauft')).value = new Date(Date.UTC(2026, 9, 11))
      s.getCell(col('fasern')).value = '100% Baumwolle'
      s.getCell(col('secondHand')).value = 'Nein'
      s.getCell(col('zustand')).value = 'GUT'
      const b = rowFor(ws, bowl.itemNumber)
      b.getCell(col('breite')).value = 12.34
      b.getCell(col('verkauft')).value = true
      b.getCell(col('preis')).value = 49.999
    })
    const first = apply(rows)
    expect(first.report.problems).toEqual([])
    expect(byKey(first.products, shirt.key).sold).toEqual({ date: '2026-10-11' })
    expect(byKey(first.products, bowl.key).sold).toEqual({})
    expect(byKey(first.products, bowl.key).dimensions.widthCm).toBe(12.3)
    const second = apply(rows, BASE, first.products, recorded(rows, first.products))
    expect(second.report).toEqual(emptyReport())
    // auch ohne fortgeschriebenen Stand keine Rückfrage (gleiche Bedeutung = keine Änderung)
    expect(apply(rows, BASE, first.products).report.conflicts).toEqual([])
  })

  it('später korrigiert, dann dieselbe Liste noch einmal geschickt: die Korrektur bleibt', async () => {
    const { rows } = await roundTrip((ws) => {
      rowFor(ws, bowl.itemNumber).getCell(col('preis')).value = 99
      rowFor(ws, bowl.itemNumber).getCell(col('verkauft')).value = 'ja'
    })
    const first = apply(rows)
    const consumed = recorded(rows, first.products)
    const corrected = first.products.map((p) => {
      if (p.key !== bowl.key) return p
      const { sold: _sold, ...rest } = p
      return { ...rest, priceCents: bowl.priceCents }
    })
    const again = apply(rows, BASE, corrected, consumed)
    expect(again.report).toEqual(emptyReport())
    expect(byKey(again.products, bowl.key)).toEqual(byKey(corrected, bowl.key))
    // das unbearbeitete Original derselben Liste setzt die Übernahme nicht zurück
    const { rows: original } = await roundTrip()
    const fromOriginal = apply(original, BASE, first.products, consumed)
    expect(fromOriginal.report).toEqual(emptyReport())
    // eine neue Änderung in derselben Liste gilt weiter
    const { rows: edited } = await roundTrip((ws) => {
      rowFor(ws, bowl.itemNumber).getCell(col('preis')).value = 80
    })
    expect(byKey(apply(edited, BASE, corrected, consumed).products, bowl.key).priceCents).toBe(8000)
  })

  it('Fehlerzelle (#NAME?) und verbundene Zellen ändern nichts und werden gemeldet', async () => {
    const { rows } = await roundTrip((ws) => {
      const r = rowFor(ws, bowl.itemNumber)
      r.getCell(col('abweichung')).value = {
        formula: '-kleiner Kratzer',
        result: { error: '#NAME?' },
      } as ExcelJS.CellValue
      ws.mergeCells(r.number, col('titleDe'), r.number, col('titleEn'))
    })
    const { products: next, report } = apply(rows)
    expect(next).toEqual(products)
    expect(report.problems).toEqual([
      expect.stringMatching(/Name \(Englisch\) – verbundene Zelle/),
      expect.stringMatching(/Macke \/ Abweichung – die Zelle zeigt einen Fehler \(#NAME\?\)/),
    ])
  })

  it('Nummer nicht im gemerkten Stand oder inzwischen anderes Stück: Zeile nicht angewendet', async () => {
    const { rows } = await roundTrip((ws) => {
      rowFor(ws, bowl.itemNumber).getCell(col('preis')).value = 30
      rowFor(ws, shirt.itemNumber).getCell(col('verkauft')).value = 'ja'
    })
    const base = structuredClone(BASE)
    delete base[String(bowl.itemNumber)]
    base[String(shirt.itemNumber)]!._key = 'B999'
    const { products: next, report } = apply(rows, base)
    expect(next).toEqual(products)
    expect(report.problems).toEqual([
      `Nr. ${shirt.itemNumber} gehörte beim Ausgeben der Liste zu einem anderen Stück – Zeile nicht übernommen, bitte klären.`,
      `Nr. ${bowl.itemNumber} stand nicht in dieser Liste, als sie ausgegeben wurde – Zeile nicht übernommen, bitte klären.`,
    ])
  })

  it('Rechtsliste: verbotene Formulierung, unbelegte Aussage, fremde Marke werden nicht übernommen', async () => {
    const chain = products.find((p) => p.category === 'schmuck')!
    const { rows } = await roundTrip((ws) => {
      rowFor(ws, bowl.itemNumber).getCell(col('beschreibungDe')).value = 'Nachhaltig gebrannt.'
      rowFor(ws, shirt.itemNumber).getCell(col('titleDe')).value = 'Tanktop „Disney“'
      rowFor(ws, chain.itemNumber).getCell(col('metall')).value = 'Edelstahl, nickelfrei'
      rowFor(ws, bowl.itemNumber).getCell(col('notiz')).value = 'Kein Umtausch'
    })
    const { products: next, report } = apply(rows)
    expect(next).toEqual(products)
    const text = report.problems.join('\n')
    expect(text).toMatch(/Beschreibung \(Deutsch\) .* verbotene Formulierung \(V-14/)
    expect(text).toMatch(/Name \(Deutsch\) .* „Disney“ – solche Aussagen bzw\. fremde Marken/)
    expect(text).toMatch(/Metallteile .* „nickelfrei“/)
    expect(text).toMatch(/Deine Notiz .* verbotene Formulierung \(V-08/)
  })

  it('„Verkauft“ bleibt, auch wenn eine andere Zelle das Stück ungültig macht', async () => {
    const [a, b] = products
    const { rows } = await roundTrip((ws) => {
      const r = rowFor(ws, b!.itemNumber)
      r.getCell(col('titleDe')).value = a!.title.de
      r.getCell(col('verkauft')).value = '11.10.2026 Markt'
    })
    const applied = apply(rows)
    const { products: next, ok } = keepValid(products, applied.products, applied.report)
    expect(ok).toBe(true)
    expect(byKey(next, b!.key).title).toEqual(b!.title)
    expect(byKey(next, b!.key).sold).toEqual({ date: '2026-10-11', note: 'Markt' })
    expect(applied.report.changes).toEqual([
      `Nr. ${b!.itemNumber}: Verkauft „–“ → „11.10.2026 Markt“`,
    ])
    expect(applied.report.problems.join('\n')).toMatch(/„Verkauft“ und „Deine Notiz“ schon/)
  })

  it('Englisch nachziehen genau dann, wenn das Deutsche geschrieben wurde und das Englische nicht', async () => {
    const [a, b] = products
    const { rows } = await roundTrip((ws) => {
      const r = rowFor(ws, a!.itemNumber)
      r.getCell(col('titleDe')).value = 'Tanktop „Neuer Name“'
      r.getCell(col('titleEn')).value = ''
      rowFor(ws, b!.itemNumber).getCell(col('titleDe')).value = 'Ab'
    })
    const { report } = apply(rows)
    expect(report.englishTodo).toEqual([`Nr. ${a!.itemNumber}: Name (Deutsch geändert)`])
  })

  it('alle Maße geleert: nichts übernommen, keine Änderungszeilen', async () => {
    const { rows } = await roundTrip((ws) => {
      const r = rowFor(ws, bowl.itemNumber)
      for (const k of ['breite', 'hoehe', 'tiefe', 'durchmesser']) r.getCell(col(k)).value = null
    })
    const { products: next, report } = apply(rows)
    expect(next).toEqual(products)
    expect(report.changes).toEqual([])
    expect(report.problems).toEqual([
      `Nr. ${bowl.itemNumber}: mindestens ein Maß ist Pflicht – alle Maße leer gelassen, alte Werte bleiben.`,
    ])
  })
})

describe('Numbers-Varianten (U-89 b)', () => {
  it('Blatt umbenannt, Anleitung entfernt, Spalten verschoben, Kopfzeile tiefer, Listen-Nr. nur im Dateinamen', async () => {
    const p = products[5]!
    const wb = await book()
    wb.removeWorksheet(wb.getWorksheet('Anleitung')!.id)
    const ws = wb.getWorksheet(BESTAND_SHEET)!
    ws.name = 'Bestand – Tabelle 1'
    ws.getRow(1).getCell(col('nr')).note = '' // Kommentar geht in Numbers verloren
    wb.subject = ''
    wb.title = ''
    ws.spliceColumns(col('foto'), 1) // Foto-Spalte entfernt
    ws.spliceColumns(2, 0, ['Leer']) // leere Spalte eingefügt
    ws.spliceRows(1, 0, ['Meine Liste'], []) // Titel und Leerzeile über der Kopfzeile
    const header = ws.getRow(3).values as CellValue[]
    const preisCol = header.findIndex((v) => v === 'Preis (€)')
    expect(preisCol).toBeGreaterThan(0)
    ws.eachRow((row) => {
      if (row.getCell(1).value === p.itemNumber) row.getCell(preisCol).value = 99
    })
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    const read = await readBestandBook(buf, `planet-claire-bestand ${SNAP.id}.xlsx`)
    expect(read.listId).toBe(SNAP.id)
    const { products: next, report } = apply(read.rows)
    expect(byKey(next, p.key).priceCents).toBe(9900)
    expect(report.problems).toEqual([])
    expect(report.changes).toHaveLength(1)
  })

  it('keine Bestandsliste in der Datei: verständlicher Fehler; andere Formate abgelehnt', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Tabelle 1').getCell('A1').value = 'Hallo'
    await expect(readBestandBook(Buffer.from(await wb.xlsx.writeBuffer()))).rejects.toThrow(
      /keine Bestandsliste .*Spalte „Nr\.“/,
    )
    await expect(readBestandBook(Buffer.from('Nr.;Preis\n1;2'))).rejects.toThrow(
      /keine Excel-Datei/,
    )
  })
})

describe('Spalte „Verkauft“ (U-86)', () => {
  it('Datum, „ja“, Preis, Notiz, leer', () => {
    expect(parseSold(null, 2026)).toEqual({ sold: null })
    expect(parseSold('nein', 2026)).toEqual({ sold: null })
    expect(parseSold('ja', 2026)).toEqual({ sold: {} })
    expect(parseSold('x Markt', 2026)).toEqual({ sold: { note: 'Markt' } })
    expect(parseSold('11.10.', 2026)).toEqual({ sold: { date: '2026-10-11' } })
    expect(parseSold('3.9.26 – Flohmarkt', 2026)).toEqual({
      sold: { date: '2026-09-03', note: 'Flohmarkt' },
    })
    expect(parseSold('11.10. 35,50 € Mauerpark', 2026)).toEqual({
      sold: { date: '2026-10-11', priceCents: 3550, note: 'Mauerpark' },
    })
    expect(parseSold('ja, 40 Euro', 2026)).toEqual({ sold: { priceCents: 4000 } })
    expect(parseSold(new Date(Date.UTC(2026, 9, 11)), 2026)).toEqual({
      sold: { date: '2026-10-11' },
    })
    expect(parseSold('an Freundin', 2026)).toEqual({
      error: expect.stringMatching(/„ja“ voranstellen/),
    })
    expect(parseSold('ja – an Freundin', 2026)).toEqual({ sold: { note: 'an Freundin' } })
    for (const notSold of [
      'noch da',
      'Nein.',
      '-',
      '–',
      '0',
      'nicht verkauft',
      'reserviert für Anna',
      'offen',
    ])
      expect(parseSold(notSold, 2026), notSold).toEqual({ sold: null })
    expect(parseSold(0, 2026)).toEqual({ sold: null })
    // „20.12.“ im Januar eingetragen = Dezember davor; ausdrücklich in der Zukunft = Fehler
    expect(parseSold('20.12. Wintermarkt', { year: 2027, today: '2027-01-10' })).toEqual({
      sold: { date: '2026-12-20', note: 'Wintermarkt' },
    })
    expect(parseSold('11.10.2026', { year: 2026, today: '2026-10-01' })).toEqual({
      error: expect.stringMatching(/Zukunft/),
    })
    expect(parseSold(new Date(Date.UTC(2026, 9, 11)), { year: 2026, today: '2026-10-01' })).toEqual(
      {
        error: expect.stringMatching(/Zukunft/),
      },
    )
    expect(parseSold('31.02.2026', 2026)).toEqual({ error: expect.stringMatching(/gibt es nicht/) })
    expect(parseSold('11.10.35 € Markt', 2026)).toEqual({
      sold: { date: '2026-10-11', priceCents: 3500, note: 'Markt' },
    })
    expect(parseSold('11.10.202', 2026)).toEqual({ error: expect.stringMatching(/bitte prüfen/) })
    expect(parseSold('1.1.2027', 2026)).toEqual({ error: expect.stringMatching(/Zukunft/) })
    expect(parseSold(35, 2026)).toEqual({ error: expect.stringMatching(/„ja 35 €“/) })
    expect(parseSold(false, 2026)).toEqual({ sold: null })
    expect(parseSold(true, 2026)).toEqual({ sold: {} })
  })

  it('Anzeige und Rückweg passen zusammen', () => {
    for (const sold of [
      { date: '2026-10-11' },
      { date: '2026-10-11', priceCents: 3550, note: 'Mauerpark' },
      { priceCents: 4000 },
      { note: 'an Freundin' },
      {},
    ])
      expect(parseSold(soldText(sold), 2026)).toEqual({ sold })
  })
})

describe('Fasern als Text', () => {
  it('liest Prozent und amtliche Namen (DE/EN), Teile mit Doppelpunkt, prüft 100 %', () => {
    expect(parseFibers('100 % Baumwolle')).toEqual({
      rows: [{ component: 'main', fiber: 'cotton', percent: 100 }],
    })
    expect(parseFibers('Baumwolle 100%')).toEqual({
      rows: [{ component: 'main', fiber: 'cotton', percent: 100 }],
    })
    expect(parseFibers('100 % cotton; Futter: 100 % Polyester')).toEqual({
      rows: [
        { component: 'main', fiber: 'cotton', percent: 100 },
        { component: 'lining', fiber: 'polyester', percent: 100 },
      ],
    })
    expect(parseFibers('80 % Baumwolle')).toEqual({ error: expect.stringMatching(/80 %/) })
    expect(parseFibers('100 % Zauberwolle')).toEqual({
      error: expect.stringMatching(/keine amtliche/),
    })
  })

  it('jede Zeile hat für jede Spalte einen Wert (auch leer)', () => {
    for (const p of products)
      expect(Object.keys(rowOf(p)).sort()).toEqual(BESTAND_COLUMNS.map((c) => c.key).sort())
  })
})
