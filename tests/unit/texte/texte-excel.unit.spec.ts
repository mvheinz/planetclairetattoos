import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { emptyReport } from '@/lib/pflege/merge'
import { makeSnapshot, type SnapshotRows } from '@/lib/pflege/snapshot'
import { applyTextRows, TEXT_COLUMNS, textRow } from '@/lib/texte/excel'
import { buildTexteBook, readTexteBook } from '@/lib/texte/excelBook'
import { setText, TEXT_SHEETS, textEntries, type TextEntry, type TextFile } from '@/lib/texte/model'
import { checkPlaceholders, signatureOf } from '@/lib/texte/placeholders'
import { loadTextData, serialize, TEXT_FILES } from '@/lib/texte/sources'

import { formatJson } from '../../../scripts/pflege/formatJson'

// P18.2 (U-87, U-89): alle Webseitentexte als Excel – Rundweg ohne Änderung ändert nichts, nur geänderte Zellen
// zählen, Platzhalter und Verbotsliste geprüft, rechtlich vorgegebene Texte nur zum Lesen, gemerkter Stand wie P18.1.

const root = path.resolve(import.meta.dirname, '../../..')
const data = await loadTextData(root)
const entries = textEntries(data)
const byId = new Map(entries.map((e) => [e.id, e]))
const NOW = new Date('2026-10-11T10:00:00Z')
const SNAP = makeSnapshot('texte', NOW, new Map(entries.map((e) => [e.id, textRow(e)])))
const BASE: SnapshotRows = SNAP.rows

const col = (key: string) => TEXT_COLUMNS.findIndex((c) => c.key === key) + 1

async function roundTrip(edit?: (wb: ExcelJS.Workbook) => void, list = entries) {
  const wb = await buildTexteBook({ entries: list, date: '11.10.2026', listId: SNAP.id })
  if (edit) edit(wb)
  return readTexteBook(Buffer.from(await wb.xlsx.writeBuffer()))
}

/** Zelle einer Kennung in der Mappe setzen. */
function setCell(wb: ExcelJS.Workbook, id: string, key: 'de' | 'en' | 'notiz', value: string) {
  for (const ws of wb.worksheets)
    ws.eachRow((row) => {
      if (row.getCell(col('id')).value === id) row.getCell(col(key)).value = value
    })
}

const apply = (
  rows: Parameters<typeof applyTextRows>[1],
  base: SnapshotRows | null = BASE,
  list = entries,
) => applyTextRows(list, rows, { base })

const find = (pred: (e: TextEntry) => boolean) => {
  const e = entries.find(pred)
  expect(e).toBeDefined()
  return e!
}

describe('Texte-Liste: Inhalt (P18.2)', () => {
  it('alle Bereiche, eindeutige Kennungen, keine Rechtstexte/Technik, Pflichtwörter nur zum Lesen', () => {
    expect(entries.length).toBeGreaterThan(1000)
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length)
    expect(new Set(entries.map((e) => e.sheet))).toEqual(new Set(TEXT_SHEETS))
    for (const prefix of [
      'm:legal.',
      'm:withdraw.',
      'm:privacyExport.',
      'm:qa.',
      'm:previewExport.',
    ])
      expect(
        entries.some((e) => e.id.startsWith(prefix)),
        prefix,
      ).toBe(false)
    expect(entries.some((e) => /slug/.test(e.id))).toBe(false)
    expect(entries.some((e) => e.id.startsWith('seite:withdrawal:'))).toBe(false)
    expect(byId.get('m:footer.withdraw')?.locked).toBeTruthy()
    expect(byId.get('m:common.routes.R21')?.locked).toBeTruthy() // Impressum
    expect(byId.get('m:home.tour.heading')).toMatchObject({ sheet: 'Startseite', de: 'on Tour' })
    expect(byId.get('st:emails.signature')).toMatchObject({ sheet: 'E-Mails', maxLength: 600 })
    // von den Standardtexten der Verwaltung zeigt die Seite nur die beiden Mail-Bausteine
    expect(entries.filter((e) => e.id.startsWith('st:')).map((e) => e.id)).toEqual([
      'st:emails.signature',
      'st:emails.inquiryResponseTime',
    ])
    for (const prefix of [
      'm:shop.warranty.',
      'm:shippingPayment.',
      'm:email.withdrawalReceipt.',
      'm:email.privacyAccessResponse.',
      'm:email.disputeVsbg.',
      'm:email.inquiryReceipt.responseTime',
    ])
      expect(
        entries.some((e) => e.id.startsWith(prefix)),
        prefix,
      ).toBe(false)
    expect(byId.get('m:shop.badges.decorative')?.locked).toBeTruthy()
    expect(byId.get('m:checkout.legalLinks.agb')?.locked).toBeTruthy()
    // Regeln aus dem Schema der Verwaltung
    expect(byId.get('kat:keramik:name')?.maxLength).toBe(40)
    expect(byId.get('seite:home:layout.0.subheading')?.maxLength).toBe(300)
    expect(byId.get('faq:FAQ01:question')?.maxLength).toBe(200)
    expect(byId.get('einst:shipping.deliveryTimeText')?.maxLength).toBe(60)
    expect(byId.get('einst:shipping.deliveryTimeText')?.validate?.('ca. 3 Werktage')).not.toBe(true)
    expect(byId.get('seite:home:layout.0.heading')?.where).toBe(
      'Seite „Startseite“ › Block 1 (Kopf) › Überschrift',
    )
    for (const e of entries) {
      expect(e.de, e.id).not.toBe('')
      expect(e.en, e.id).not.toBe('')
    }
  })

  it('Rundweg ohne Änderung: keine Änderung, keine Meldung (mit und ohne gemerkten Stand)', async () => {
    const { rows, listId } = await roundTrip()
    expect(listId).toBe(SNAP.id)
    expect(rows).toHaveLength(entries.length)
    for (const base of [BASE, null]) {
      const { updates, report } = apply(rows, base)
      expect(updates).toEqual([])
      expect(report).toEqual(emptyReport())
    }
  })

  it('Dateien ohne Änderung werden byte-gleich wieder geschrieben (kleiner Diff)', async () => {
    for (const [f, rel] of Object.entries(TEXT_FILES)) {
      const file = path.join(root, rel)
      expect(await formatJson(root, file, serialize(data, f as TextFile)), rel).toBe(
        await readFile(file, 'utf8'),
      )
    }
  })
})

describe('Texte-Liste: Rückweg', () => {
  it('Deutsch geändert → übernommen, Englisch zum Nachziehen; Englisch geändert → übernommen', async () => {
    const page = byId.get('seite:home:layout.0.heading')!
    const faq = find((e) => e.id.startsWith('faq:') && e.id.endsWith(':answer'))
    const st = byId.get('st:emails.inquiryResponseTime')!
    const { rows } = await roundTrip((wb) => {
      setCell(wb, page.id, 'de', 'Ein kleiner Planet, auf dem alles einmal vorkommt')
      setCell(wb, faq.id, 'en', `${faq.en} Thanks!`)
      setCell(wb, st.id, 'de', 'Aus meinen Händen, in Berlin.')
      setCell(wb, st.id, 'notiz', 'Englisch bitte kürzer')
    })
    const { updates, report } = apply(rows)
    expect(updates).toEqual(
      [
        { id: page.id, lang: 'de', value: 'Ein kleiner Planet, auf dem alles einmal vorkommt' },
        { id: st.id, lang: 'de', value: 'Aus meinen Händen, in Berlin.' },
        { id: faq.id, lang: 'en', value: `${faq.en} Thanks!` },
      ].sort(
        (a, b) => entries.findIndex((e) => e.id === a.id) - entries.findIndex((e) => e.id === b.id),
      ),
    )
    expect(report.problems).toEqual([])
    expect(report.changes).toHaveLength(3)
    expect(report.englishTodo).toEqual(
      [page, st]
        .sort((a, b) => entries.indexOf(a) - entries.indexOf(b))
        .map((e) => `${e.where} – Kennung ${e.id}`),
    )
    expect(report.ownerNotes).toEqual([`${st.where}: Englisch bitte kürzer`])
    // Zurückschreiben per Kennung
    const copy = structuredClone({ ...data, siteTextFields: undefined, fieldRule: undefined })
    const d = { ...copy, siteTextFields: data.siteTextFields }
    expect(setText(d, page.id, 'de', 'X')).toBe('pages')
    expect(setText(d, faq.id, 'en', 'Y')).toBe('faqs')
    expect(setText(d, st.id, 'de', 'Z')).toBe('siteTexts')
    expect(setText(d, 'm:home.tour.heading', 'en', 'on tour')).toBe('messages.en')
    expect(setText(d, 'kat:keramik:intro', 'de', 'Ton.')).toBe('base')
    expect(setText(d, 'einst:pickup.instructions', 'de', 'Abholung.')).toBe('base')
    expect(setText(d, 'm:gibt.es.nicht', 'de', 'X')).toBeNull()
    expect(textEntries(d).find((e) => e.id === page.id)?.de).toBe('X')
    expect(textEntries(data).find((e) => e.id === page.id)?.de).toBe(page.de) // Original unverändert
  })

  it('Platzhalter, Länge, Pflicht, Verbotsliste und Lese-Zeilen werden geprüft', async () => {
    const pickup = byId.get('m:shop.product.shipping.pickup')!
    const plural = byId.get('m:cart.notes.reserved')!
    const tag = byId.get('m:shop.product.shipping.noRate')!
    const short = byId.get('kat:keramik:name')!
    const any = find((e) => e.id.startsWith('m:home.') && !/[{<]/.test(e.de))
    const { rows } = await roundTrip((wb) => {
      setCell(wb, pickup.id, 'de', 'Abholung möglich')
      setCell(wb, plural.id, 'de', '{items} ist gerade reserviert.')
      setCell(wb, tag.id, 'de', 'Versandkosten: siehe Versand & Zahlung')
      setCell(wb, 'einst:shipping.deliveryTimeText', 'de', 'ca. 3 Werktage')
      setCell(wb, 'm:cart.empty.text', 'de', 'Jetzt mit Gutschein!')
      setCell(wb, short.id, 'de', 'x'.repeat(60))
      setCell(wb, any.id, 'de', '')
      setCell(wb, 'm:footer.withdraw', 'de', 'Widerrufen')
      setCell(wb, 'seite:home:layout.0.subheading', 'de', 'Alle Preise inkl. MwSt.')
    })
    const { updates, report } = apply(rows)
    expect(updates).toEqual([])
    const text = report.problems.join('\n')
    expect(text).toMatch(/Platzhalter \{city\} fehlt/)
    expect(text).toMatch(/Platzhalter \{count\} fehlt/)
    expect(text).toMatch(/Markierungen <link>…<\/link> bitte unverändert lassen/)
    expect(text).toMatch(/höchstens 40 Zeichen \(jetzt 60\)/)
    expect(text).toMatch(/Lieferzeit .* „ca\. 3 Werktage“ – .*nicht übernommen/)
    expect(text).toMatch(/verbotene Formulierung \(V-30/)
    expect(text).toMatch(/darf nicht leer sein/)
    expect(text).toMatch(/rechtlich vorgegeben – nur zum Lesen/)
    expect(text).toMatch(/verbotene Formulierung \(V-02/)
    expect(report.problems).toHaveLength(9)
  })

  it('gemerkter Stand: ältere Liste setzt nichts zurück; gleiche Zelle hier und dort = Rückfrage; zweimal = nichts', async () => {
    const a = byId.get('m:cart.empty.title')!
    const b = byId.get('m:cart.empty.text')!
    const { rows } = await roundTrip((wb) => setCell(wb, b.id, 'de', 'Einzelstück'))
    // inzwischen anders geändert: a (Jutta hat a nicht angefasst) und b (Jutta hat b geändert)
    const current = entries.map((e) =>
      e.id === a.id ? { ...e, de: 'Neu inzwischen' } : e.id === b.id ? { ...e, de: 'Einmalig' } : e,
    )
    const { updates, report } = apply(rows, BASE, current)
    expect(updates).toEqual([])
    expect(report.conflicts).toEqual([
      `${b.where} (Deutsch): in deiner Liste „Einzelstück“, inzwischen „Einmalig“. Was gilt?`,
    ])
    // ohne Konflikt: übernehmen, dann zweites Zurückspielen ändert nichts mehr
    const first = apply(rows)
    expect(first.updates).toEqual([{ id: b.id, lang: 'de', value: 'Einzelstück' }])
    const after = entries.map((e) => (e.id === b.id ? { ...e, de: 'Einzelstück' } : e))
    expect(apply(rows, BASE, after).updates).toEqual([])
  })

  it('Numbers: Blätter umbenannt, neue Zeile ohne Kennung, unbekannte Kennung, fehlende Zeilen', async () => {
    const { rows } = await roundTrip((wb) => {
      for (const ws of wb.worksheets) ws.name = `${ws.name} – Tabelle 1`
      const ws = wb.worksheets[1]!
      const extra = ws.getRow(ws.rowCount + 1)
      extra.getCell(col('de')).value = 'Ganz neuer Satz für die Startseite'
      ws.getRow(2).getCell(col('id')).value = 'm:gibt.es.nicht'
    })
    const { updates, report } = apply(rows)
    expect(updates).toEqual([])
    expect(report.newEntries).toEqual([
      'Neuer Text „Ganz neuer Satz für die Startseite“ – bitte sagen, wo er hingehört.',
    ])
    expect(report.problems).toEqual([
      'Kennung „m:gibt.es.nicht“ gibt es nicht (mehr) – Zeile nicht übernommen.',
    ])
    expect(report.notes).toEqual(['1 Texte stehen nicht in der Liste – sie bleiben, wie sie sind.'])
  })
})

describe('Texte-Liste: Prüfung (U-89)', () => {
  it('Kennung nicht im gemerkten Stand, Fehlerzelle, Englisch geleert → gemeldet, Englisch nachziehen', async () => {
    const a = byId.get('m:cart.empty.title')!
    const b = byId.get('m:cart.empty.text')!
    const c = byId.get('m:cart.empty.action')!
    const { rows } = await roundTrip((wb) => {
      setCell(wb, a.id, 'de', 'Neu')
      setCell(wb, b.id, 'de', 'Einzelstück')
      setCell(wb, b.id, 'en', '')
      for (const ws of wb.worksheets)
        ws.eachRow((row) => {
          if (row.getCell(col('id')).value === c.id)
            row.getCell(col('de')).value = {
              formula: '-leer',
              result: { error: '#NAME?' },
            } as ExcelJS.CellValue
        })
    })
    const base = structuredClone(BASE)
    delete base[a.id]
    const { updates, report } = apply(rows, base)
    expect(updates).toEqual([{ id: b.id, lang: 'de', value: 'Einzelstück' }])
    expect(report.problems).toHaveLength(3)
    expect(report.problems).toEqual(
      expect.arrayContaining([
        `${a.where}: stand nicht in dieser Liste, als sie ausgegeben wurde – nicht übernommen, bitte klären.`,
        `${b.where} (Englisch): „“ – darf nicht leer sein; nicht übernommen.`,
        expect.stringMatching(/\(Deutsch\): die Zelle zeigt einen Fehler \(#NAME\?\)/),
      ]),
    )
    expect(report.englishTodo).toEqual([`${b.where} – Kennung ${b.id}`])
  })
})

describe('Platzhalter', () => {
  it('erkennt Argumente, Mehrzahl-Fälle und Markierungen', () => {
    expect(
      signatureOf('Hallo {name}, du hast {count, plural, one {# Stück} other {# Stücke}}'),
    ).toEqual({
      args: ['count:plural', 'name:argument'],
      cases: ['count:one', 'count:other'],
      tags: [],
    })
    expect(signatureOf('siehe <link>Versand</link>')).toEqual({
      args: [],
      cases: [],
      tags: ['link@0'],
    })
    // was die Seite nicht lesen könnte (gleicher Parser wie next-intl)
    for (const broken of ['kaputt {name', '</link>x<link>', 'Tolle <Stücke> hier', 'Coco {time.}'])
      expect(signatureOf(broken), broken).toBeNull()
    expect(checkPlaceholders('Coco hütet {time}', "Coco hütet '{time}'")).toMatch(/\{time\} fehlt/)
  })

  it('erlaubt Umstellen, verbietet Entfernen, Umbenennen und neue Fälle', () => {
    const o = '{items} {count, plural, one {ist} other {sind}} reserviert.'
    expect(
      checkPlaceholders(
        o,
        'Gerade reserviert: {items} – {count, plural, one {ist} other {sind}} weg.',
      ),
    ).toBeNull()
    expect(checkPlaceholders(o, '{items} sind reserviert.')).toMatch(/\{count\} fehlt/)
    expect(checkPlaceholders(o, '{dinge} {count, plural, one {ist} other {sind}}')).toMatch(
      /\{items\} fehlt/,
    )
    expect(
      checkPlaceholders(o, '{items} {count, plural, one {ist} few {sind} other {sind}}'),
    ).toMatch(/Mehrzahl/)
    expect(checkPlaceholders('Text', 'Text mit {neu}')).toMatch(/unbekannter Platzhalter \{neu\}/)
    expect(checkPlaceholders('siehe <link>x</link>', 'siehe x')).toMatch(/<link>…<\/link>/)
  })
})
