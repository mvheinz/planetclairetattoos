import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CellValue } from '@/lib/pflege/cells'
import { makeSnapshot, snapshotSchema, type ListSnapshot } from '@/lib/pflege/snapshot'
import { applyTextRows, TEXT_COLUMNS, textRow } from '@/lib/texte/excel'
import { buildTexteBook, readTexteWorkbook, sheetListIds } from '@/lib/texte/excelBook'
import { FALLBACK_ONLY_PREFIXES, TEXT_SHEETS, textEntries } from '@/lib/texte/model'
import { loadTextData } from '@/lib/texte/sources'
import { SAFER_TATTOO_URL } from '@/lib/tattoo/links'

import { importTexte } from '../../../scripts/pflege/texte'

// V-36 (U-93, P20.6): Texte-Liste aufgeräumt – keine Zeilen, die nirgends erscheinen; Fundort in Juttas Worten; das
// Wichtigste vorne; der Rückweg verträgt Zeilen, die es nicht mehr gibt („entfällt“ statt Fehler), und gleicht Blätter
// mit eigener Listen-Nr. mit ihrer Liste ab. Grundlage ist auch der gemerkte Stand der Liste, die Jutta gerade hat.

const root = path.resolve(import.meta.dirname, '../../..')
const data = await loadTextData(root)
const entries = textEntries(data)
const byId = new Map(entries.map((e) => [e.id, e]))
const JUTTAS_LIST = 'T-2026-10-12-7bc103'
const juttasList = snapshotSchema.parse(
  JSON.parse(
    await readFile(path.join(root, 'content/pflege/stand', `${JUTTAS_LIST}.json`), 'utf8'),
  ),
) as ListSnapshot

type Page = { key: string; layout: Record<string, unknown>[] }
const page = (key: string) => (data.pages as unknown as Page[]).find((p) => p.key === key)!
const blocks = (key: string, type: string) =>
  page(key).layout.filter((b) => b.blockType === type) as Record<string, unknown>[]

describe('Texte-Liste aufgeräumt (V-36)', () => {
  it('Ersatztexte, die die Seite nie zeigt, stehen nicht in der Liste – die Seiten haben die Blöcke wirklich', () => {
    for (const prefix of FALLBACK_ONLY_PREFIXES)
      expect(
        entries.some((e) => e.id.startsWith(`m:${prefix}`)),
        prefix,
      ).toBe(false)
    // Auftragsarbeiten: Schritte mit Überschrift und Formular mit Überschrift/Einleitung (sonst Ersatztext)
    const cSteps = blocks('commissions', 'processSteps')[0]!
    expect(cSteps.heading).toBeTruthy()
    expect((cSteps.steps as unknown[]).length).toBeGreaterThan(0)
    const form = blocks('commissions', 'commissionForm')[0]!
    expect(form.heading && form.intro).toBeTruthy()
    // Tattoo: Ablauf-Schritte mit Überschrift
    const tSteps = blocks('tattoo', 'processSteps')[0]!
    expect(tSteps.heading).toBeTruthy()
    expect((tSteps.steps as unknown[]).length).toBe(5)
    // Aftercare: Einleitung (Text), Warnzeichen (Hinweis-Kasten) und der Link stehen in der Seite
    expect(blocks('tattoo_aftercare', 'richText').length).toBeGreaterThan(0)
    expect(blocks('tattoo_aftercare', 'callout').length).toBeGreaterThan(0)
    expect(JSON.stringify(page('tattoo_aftercare').layout)).toContain(SAFER_TATTOO_URL)
    // Rückfall-Texte bleiben im Code (Seite ohne Block) – nur nicht in der Liste
    expect(
      (data.messages.de as { commission: { formHeading?: string } }).commission.formHeading,
    ).toBeTruthy()
  })

  it('Seite „Tattoo“ ohne die Blöcke, die keine Tattoo-Seite zeigte (Hinweis ab 18, Kontakt-Kasten)', () => {
    expect(blocks('tattoo', 'callout')).toEqual([])
    expect(blocks('tattoo', 'contactLinks')).toEqual([])
    expect(entries.some((e) => e.id.startsWith('seite:tattoo:') && /emailSubject/.test(e.id))).toBe(
      false,
    )
    // „Tattoos erst ab 18.“ kommt weiter aus den festen Texten (R16)
    expect(byId.get('m:tattoo.process.ageHint')?.de).toBe('Tattoos erst ab 18.')
  })

  it('Fundort in Juttas Worten', () => {
    expect(byId.get('seite:home:layout.1.content')?.where).toBe('Startseite – Text unter Koko')
    expect(byId.get('seite:home:layout.2.link.label')?.where).toBe(
      'Startseite – Station „Keramik“ › Link-Text',
    )
    expect(byId.get('seite:commissions:layout.0.steps.1.text')?.where).toBe(
      'Auftragsarbeiten – Schritte › Schritt 2 › Text',
    )
    expect(byId.get('seite:home:seo.metaTitle')?.where).toBe('Startseite – Titel bei Google')
    expect(byId.get('faq:FAQ01:answer')?.where).toBe(
      'Fragen – „Ab wie vielen Jahren tätowierst du?“ › Antwort',
    )
    expect(byId.get('m:home.tour.heading')?.where).toBe(
      'Startseite – Tour-Tafel (Markttermine) › Überschrift',
    )
    expect(byId.get('kat:keramik:intro')?.where).toBe('Shop – Kategorie „Keramik“ › Einleitung')
    // keine technischen Block-Nummern mehr
    for (const e of entries) expect(e.where, e.id).not.toMatch(/Block \d|Seite „/)
  })

  it('das Wichtigste vorne: je Blatt erst Seitentexte, Kategorien, Fragen, dann feste Programmtexte', () => {
    for (const sheet of TEXT_SHEETS) {
      const ids = entries.filter((e) => e.sheet === sheet).map((e) => e.id)
      const firstFixed = ids.findIndex((id) => id.startsWith('m:'))
      if (firstFixed < 0) continue
      expect(
        ids.slice(firstFixed).some((id) => !id.startsWith('m:')),
        sheet,
      ).toBe(false)
    }
    expect(entries.filter((e) => e.sheet === 'Startseite')[0]!.id).toBe(
      'seite:home:layout.0.heading',
    )
  })
})

/** Zeilen so, wie Jutta sie in ihrer Liste hat (gemerkter Stand). */
const rowsOf = (s: ListSnapshot): Record<string, CellValue>[] =>
  Object.values(s.rows).map((r) => ({ ...r }))

describe('Rückweg mit Juttas Liste T-2026-10-12-7bc103 (V-36)', () => {
  it('die Liste gibt es (wird nicht von Hand geändert); sie enthält entfallene Zeilen', () => {
    expect(juttasList.id).toBe(JUTTAS_LIST)
    const gone = Object.keys(juttasList.rows).filter((id) => !byId.has(id))
    expect(gone).toEqual(expect.arrayContaining(['m:commission.steps.1.title']))
    expect(gone).toEqual(expect.arrayContaining(['seite:tattoo:layout.7.emailSubject']))
  })

  it('unverändert zurück: keine Änderung, kein Fehler; entfallene Zeilen nur gezählt', () => {
    const { updates, report } = applyTextRows(entries, rowsOf(juttasList), {
      base: juttasList.rows,
      consumed: juttasList.consumed,
    })
    expect(updates).toEqual([])
    expect(report.problems).toEqual([])
    expect(report.dropped).toEqual([])
    expect(report.notes.some((n) => /Zeilen entfallen/.test(n))).toBe(true)
  })

  it('geänderte entfallene Zeile → „entfällt“ (kein Fehler); Änderung einer echten Zeile wird übernommen', () => {
    const rows = rowsOf(juttasList)
    const gone = rows.find((r) => r.id === 'm:commission.steps.1.title')!
    gone.de = 'Erst fragen'
    const live = rows.find((r) => r.id === 'seite:home:layout.1.content')!
    live.de = `${String(live.de)} Neu.`
    const { updates, report } = applyTextRows(entries, rows, {
      base: juttasList.rows,
      consumed: juttasList.consumed,
    })
    expect(report.problems).toEqual([])
    expect(report.dropped).toHaveLength(1)
    expect(report.dropped[0]).toMatch(/entfällt – dieser Text erscheint nicht mehr auf der Seite/)
    // Die Änderung der echten Zeile zählt nur, wenn der Text seit der Liste nicht anders geändert wurde.
    const current = byId.get('seite:home:layout.1.content')!.de
    const base = juttasList.rows['seite:home:layout.1.content']!.de
    if (current === base)
      expect(updates).toEqual([
        { id: 'seite:home:layout.1.content', lang: 'de', value: `${String(base)} Neu.` },
      ])
    else expect(report.conflicts.length + updates.length).toBe(1)
  })
})

describe('Abgleich nach Listen-Nr. über mehrere Blätter (V-36)', () => {
  it('jedes Bereichs-Blatt trägt die Listen-Nr.; ein Blatt einer älteren Liste wird mit seiner Liste abgeglichen', async () => {
    const current = new Map(entries.map((e) => [e.id, textRow(e)]))
    const listA = makeSnapshot('texte', new Date('2026-10-20T10:00:00Z'), current)
    // Liste B (älter): ein Text der Shop-Seite stand damals anders
    const shopText = entries.find((e) => e.sheet === 'Shop' && e.id.startsWith('seite:'))!
    const older = new Map(current)
    older.set(shopText.id, { ...textRow(shopText), de: 'Alter Shop-Text' })
    const listB = makeSnapshot('texte', new Date('2026-10-05T10:00:00Z'), older)
    expect(listB.id).not.toBe(listA.id)

    const wb = await buildTexteBook({ entries, date: '20.10.2026', listId: listA.id })
    const tags = sheetListIds(wb)
    for (const sheet of TEXT_SHEETS) expect(tags.get(sheet)).toBe(listA.id)
    // Jutta kopiert das Shop-Blatt aus ihrer älteren Liste B in diese Datei (unverändert, also mit dem alten Text)
    const shop = wb.getWorksheet('Shop')!
    shop.getRow(1).getCell(TEXT_COLUMNS.length + 1).value = `Listen-Nr. ${listB.id}`
    const de = TEXT_COLUMNS.findIndex((c) => c.key === 'de') + 1
    const idCol = TEXT_COLUMNS.findIndex((c) => c.key === 'id') + 1
    shop.eachRow((row) => {
      if (row.getCell(idCol).value === shopText.id) row.getCell(de).value = 'Alter Shop-Text'
    })
    const read = readTexteWorkbook(wb)
    expect(new Set(read.rowListIds)).toEqual(new Set([listA.id, listB.id]))

    const result = await importTexte(root, wb, listA, async (id) =>
      id === listB.id ? listB : null,
    )
    // gegen Liste B ist der alte Text unverändert → nichts zurückgesetzt (gegen Liste A wäre es eine Änderung)
    expect(result.write).toBeNull()
    expect(result.report.changes).toEqual([])
    expect(result.report.problems).toEqual([])
    expect(result.report.notes[0]).toMatch(/Blätter aus 2 Listen/)
    expect(result.others?.map((s) => s.id)).toEqual([listB.id])
  })
})
