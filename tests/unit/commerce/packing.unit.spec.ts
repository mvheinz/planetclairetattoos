import { describe, expect, it } from 'vitest'

import {
  checklistState,
  cleanComponents,
  defaultTemplateFor,
  euroLabel,
  packagingForOrder,
  packagingRecorded,
  packagingTemplates,
  packingChecklist,
  packingHints,
  shippingClassesOf,
  withdrawnBeforeShipping,
  type PackagingSettings,
  type PackingOrderLike,
} from '@/lib/commerce/packing'

// P5.10/P5.11 – reine Regeln der Karte „Zu packen“ (KONZEPT §7.6, DATENMODELL §6.8.8, E-47, R-100, R-101, R-201):
// Hinweise, Checkliste je Versandklasse, Verpackungs-Vorlagen und Vorbelegung. Die DB-Seite (Endpunkte, Speichern)
// prüfen `tests/int/legal/packing-hints.int.spec.ts` und `tests/int/orders/pack-order.int.spec.ts`.

const order = (over: Partial<PackingOrderLike> = {}): PackingOrderLike => ({
  status: 'paid',
  shippingClass: 'paket_klein',
  subtotalCents: 4_500,
  items: [{ shippingClass: 'paket_klein' }],
  ...over,
})

const SETTINGS: PackagingSettings = {
  packaging: {
    templates: [
      {
        key: 'karton-s',
        name: 'Karton S',
        components: [
          { material: 'paper_cardboard', grams: 180 },
          { material: 'plastic', grams: 0 },
          { material: 'glass', grams: 10 },
        ],
      },
      { key: 'ohne-name', name: '', components: [] },
      { key: null, name: 'Ohne Schlüssel' },
      { key: 'brief', name: 'Briefumschlag', components: null },
    ],
    defaultsByShippingClass: [
      { shippingClass: 'paket_klein', templateKey: 'karton-s' },
      { shippingClass: 'keramik', templateKey: 'gibt-es-nicht' },
    ],
  },
}

describe('Packen – Hinweise und Versandklassen (P5.10)', () => {
  it('euroLabel: ganze Euro ohne Komma, sonst mit zwei Nachkommastellen', () => {
    expect(euroLabel(50_000)).toBe('500 €')
    expect(euroLabel(50_050)).toBe('500,50 €')
    expect(euroLabel(2_505)).toBe('25,05 €')
  })

  it('Versandklassen: höchste zuerst, ohne nur_abholung und ohne leere Werte; fehlende Positionen sind erlaubt', () => {
    expect(
      shippingClassesOf({
        shippingClass: 'keramik',
        items: [
          { shippingClass: 'brief' },
          { shippingClass: 'nur_abholung' },
          { shippingClass: null },
          {},
        ],
      }),
    ).toEqual(['keramik', 'brief'])
    expect(shippingClassesOf({ shippingClass: 'nur_abholung', items: null })).toEqual([])
    expect(shippingClassesOf({ shippingClass: null })).toEqual([])
  })

  it('Widerruf vor dem Versand nur aus paid oder packed', () => {
    for (const from of ['paid', 'packed']) {
      expect(
        withdrawnBeforeShipping(
          order({ status: 'withdrawal_received', statusBeforeWithdrawal: from }),
        ),
      ).toBe(true)
    }
    expect(
      withdrawnBeforeShipping(
        order({ status: 'withdrawal_received', statusBeforeWithdrawal: 'shipped' }),
      ),
    ).toBe(false)
    expect(withdrawnBeforeShipping(order({ statusBeforeWithdrawal: 'paid' }))).toBe(false)
  })

  it('Hinweise: Widerruf, Keramik, Versicherung (Standard 500 € bzw. eigener Wert), Brief > 25 €, E-Mail an DHL', () => {
    const all = packingHints(
      order({
        status: 'withdrawal_received',
        statusBeforeWithdrawal: 'packed',
        shippingClass: 'brief',
        items: [{ shippingClass: 'keramik' }],
        subtotalCents: 60_000,
        carrierEmailConsent: true,
      }),
    )
    expect(all.map((h) => h.key)).toEqual([
      'withdrawal',
      'ceramic',
      'insurance',
      'letter',
      'carrierEmail',
    ])
    expect(all.find((h) => h.key === 'insurance')?.text).toBe(
      'Warenwert > 500 € – Transportversicherung buchen',
    )
    expect(all.find((h) => h.key === 'letter')?.text).toBe(
      'Brief über 25 € – Einschreiben haftet nur bis 25 €',
    )
    expect(all.at(-1)).toEqual({ key: 'carrierEmail', text: 'E-Mail an DHL: ja', tone: 'info' })

    const own = packingHints(order({ subtotalCents: 30_050 }), { insuranceThresholdCents: 30_000 })
    expect(own.map((h) => h.text)).toEqual([
      'Warenwert > 300 € – Transportversicherung buchen',
      'E-Mail an DHL: nein',
    ])
    const nullThreshold = packingHints(order({ subtotalCents: 50_000 }), {
      insuranceThresholdCents: null,
    })
    expect(nullThreshold.map((h) => h.key)).toEqual(['carrierEmail'])
    // Brief bis 25 € ohne Haftungshinweis; widerrufene Einwilligung → „nein“
    const letter = packingHints(
      order({
        shippingClass: 'brief',
        items: [],
        subtotalCents: 2_500,
        carrierEmailConsent: true,
        carrierEmailConsentRevokedAt: '2026-10-01T10:00:00.000Z',
      }),
    )
    expect(letter.map((h) => h.text)).toEqual(['E-Mail an DHL: nein'])
  })
})

describe('Verpackungs-Checkliste (P5.11)', () => {
  it('Punkte je Versandklasse (höchste zuerst) plus gemeinsame Punkte, ohne Doppelungen und leere Texte; Häkchen aus dem Stand', () => {
    const list = packingChecklist(
      {
        shippingClass: 'keramik',
        items: [{ shippingClass: 'brief' }],
        packingChecklistState: {
          'Karton in Karton': true,
          'zwei Fotos vor dem Zukleben': false,
          Fremd: 'ja',
        },
      },
      {
        packingChecklists: [
          { shippingClass: 'brief', items: [{ text: 'Pappe zur Versteifung' }, { text: '  ' }] },
          {
            shippingClass: 'keramik',
            items: [{ text: ' Karton in Karton ' }, { text: null }, { text: 'karton in karton' }],
          },
          { shippingClass: 'paket_klein', items: null },
        ],
      },
    )
    expect(list).toEqual([
      { key: 'Karton in Karton', text: 'Karton in Karton', done: true },
      { key: 'Pappe zur Versteifung', text: 'Pappe zur Versteifung', done: false },
      {
        key: 'Packzettel mit Beileger je Stück einlegen',
        text: 'Packzettel mit Beileger je Stück einlegen',
        done: false,
      },
      { key: 'zwei Fotos vor dem Zukleben', text: 'zwei Fotos vor dem Zukleben', done: false },
    ])
  })

  it('ohne Einstellungen nur die gemeinsamen Punkte', () => {
    expect(packingChecklist({ shippingClass: 'paket_klein' }, {}).map((i) => i.text)).toEqual([
      'Packzettel mit Beileger je Stück einlegen',
      'zwei Fotos vor dem Zukleben',
    ])
    expect(
      packingChecklist({ shippingClass: 'paket_klein' }, { packingChecklists: null }),
    ).toHaveLength(2)
  })

  it('checklistState: nur Wahrheitswerte mit Schlüssel 1–200 Zeichen; andere Formen → leer', () => {
    for (const v of [null, undefined, 'x', 3, [true], []]) expect(checklistState(v)).toEqual({})
    expect(
      checklistState({ a: true, b: false, c: 'true', '': true, ['x'.repeat(201)]: true }),
    ).toEqual({ a: true, b: false })
  })
})

describe('Verpackungsmengen (E-47, R-201)', () => {
  it('cleanComponents: nur bekannte Materialien mit ganzen Gramm 1–10 000', () => {
    expect(cleanComponents('x')).toEqual([])
    expect(
      cleanComponents([
        null,
        { material: 'paper_cardboard', grams: '25' },
        { material: 'plastic', grams: 10_001 },
        { material: 'plastic', grams: 2.5 },
        { material: 'other', grams: 10_000 },
        { material: 'wood', grams: 5 },
      ]),
    ).toEqual([
      { material: 'paper_cardboard', grams: 25 },
      { material: 'other', grams: 10_000 },
    ])
  })

  it('Vorlagen nur mit Schlüssel und Namen; Standard je Versandklasse, unbekannte Vorlage → null', () => {
    expect(packagingTemplates({})).toEqual([])
    expect(packagingTemplates({ packaging: null })).toEqual([])
    expect(packagingTemplates(SETTINGS)).toEqual([
      {
        key: 'karton-s',
        name: 'Karton S',
        components: [{ material: 'paper_cardboard', grams: 180 }],
      },
      { key: 'brief', name: 'Briefumschlag', components: [] },
    ])
    expect(defaultTemplateFor('paket_klein', SETTINGS)?.key).toBe('karton-s')
    expect(defaultTemplateFor('keramik', SETTINGS)).toBeNull()
    expect(defaultTemplateFor('brief', SETTINGS)).toBeNull()
    expect(defaultTemplateFor(null, {})).toBeNull()
  })

  it('packagingForOrder: erfasste Verpackung hat Vorrang, sonst Vorbelegung aus der Standard-Vorlage', () => {
    const recorded = packagingForOrder(
      {
        shippingClass: 'paket_klein',
        packaging: {
          templateKey: 'eigen',
          templateName: 'Eigene',
          components: [{ material: 'plastic', grams: 12 }],
          recordedAt: '2026-10-01T10:00:00.000Z',
        },
      },
      SETTINGS,
    )
    expect(recorded).toEqual({
      templateKey: 'eigen',
      templateName: 'Eigene',
      components: [{ material: 'plastic', grams: 12 }],
      recorded: true,
    })
    const recordedWithoutNames = packagingForOrder(
      {
        packaging: {
          components: [{ material: 'other', grams: 3 }],
          recordedAt: '2026-10-01T10:00:00.000Z',
        },
      },
      {},
    )
    expect(recordedWithoutNames).toMatchObject({
      templateKey: null,
      templateName: null,
      recorded: true,
    })
    // erfasst, aber ohne gültige Bestandteile → Vorbelegung
    expect(
      packagingForOrder(
        {
          shippingClass: 'paket_klein',
          packaging: { components: [], recordedAt: '2026-10-01T10:00:00.000Z' },
        },
        SETTINGS,
      ),
    ).toEqual({
      templateKey: 'karton-s',
      templateName: 'Karton S',
      components: [{ material: 'paper_cardboard', grams: 180 }],
      recorded: false,
    })
    expect(packagingForOrder({ shippingClass: 'keramik', packaging: null }, SETTINGS)).toEqual({
      templateKey: null,
      templateName: null,
      components: [],
      recorded: false,
    })
  })

  it('packagingRecorded: Zeitpunkt, Vorlage und mindestens ein gültiger Bestandteil', () => {
    const ok = {
      templateKey: 'karton-s',
      components: [{ material: 'paper_cardboard', grams: 180 }],
      recordedAt: '2026-10-01T10:00:00.000Z',
    }
    expect(packagingRecorded(ok)).toBe(true)
    expect(packagingRecorded(null)).toBe(false)
    expect(packagingRecorded(undefined)).toBe(false)
    expect(packagingRecorded({ ...ok, recordedAt: null })).toBe(false)
    expect(packagingRecorded({ ...ok, templateKey: null })).toBe(false)
    expect(packagingRecorded({ ...ok, components: [{ material: 'x', grams: 1 }] })).toBe(false)
  })
})
