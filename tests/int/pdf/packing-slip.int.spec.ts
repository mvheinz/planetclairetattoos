import { beforeAll, describe, expect, it } from 'vitest'

import { PACKING_COMMON_ITEMS } from '@/lib/commerce/packing'
import type { Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData } from '../helpers/commerce'
import { pdfText, TEST_BUSINESS } from '../helpers/invoices'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.12 – Packzettel (KONZEPT §7.6): A4 ohne Preise – Bestellnummer, Datum, Empfänger:in, Positionen mit `Nr.`, Titel
// und Lagerort, Verpackungs-Checkliste, Beileger je Stück (Herstellerin aus `settings.business`, Warn- und
// Pflegehinweise; bei EN-Bestellungen zusätzlich EN), Platz für eine Karte. Kein „€“, kein V-02-Treffer.

const NUMBERS = [980, 981, 982]
const h = shopHarness({ start: '2026-09-20T08:00:00.000Z', numbers: NUMBERS, tag: 'packing-slip' })
let token: string
let seq = 0

const SAFETY_DE = 'Handgemacht: Kanten können unregelmäßig sein. Zerbrechlich.'
const SAFETY_EN = 'Handmade: edges may be irregular. Fragile.'
const V02 =
  /inkl\.?\s*(MwSt|USt|Mehrwertsteuer|Umsatzsteuer)|zzgl\.?\s*(MwSt|USt)|\bMwSt\b|incl\.?\s*VAT|VAT included/i

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.75'))
})

async function order(nr: number, overrides: Record<string, unknown> = {}): Promise<Order> {
  const id = await h.piece(nr, { storageLocation: `Regal B${nr}`, safetyWarnings: SAFETY_DE })
  await h.payload.update({
    collection: 'products',
    id,
    locale: 'en',
    data: { title: `Test piece ${nr}`, safetyWarnings: SAFETY_EN } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  return (await createOrder(
    h.payload,
    orderData(98_200 + ++seq, [{ id, itemNumber: nr, priceCents: 12_345 }], {
      timestamps: { placedAt: '2026-09-27T10:00:00.000Z' },
      ...overrides,
    }),
  )) as Order
}

async function slip(orderId: number, auth = true) {
  return rest(
    'GET',
    `/orders/${orderId}/packing-slip.pdf`,
    undefined,
    auth ? { authorization: `JWT ${token}` } : {},
  )
}

describe('Packzettel (P5.12)', () => {
  it('nur Verwaltung: ohne Anmeldung 403, unbekannte Bestellung 404', async () => {
    const o = await order(980)
    expect((await slip(o.id, false)).status).toBe(403)
    expect((await slip(999_999_999)).status).toBe(404)
  })

  it('Packzettel-Text enthält alle Pflichtangaben und kein „€“; im Kleinunternehmer-Modus kein V-02-Treffer', async () => {
    const o = await order(981)
    const res = await slip(o.id)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('cache-control')).toContain('no-store')
    const text = await pdfText(Buffer.from(await res.arrayBuffer()))
    for (const needle of [
      'Packzettel',
      o.orderNumber,
      '27.09.2026',
      'Erika Beispiel',
      'Musterstraße 1',
      '10115 Berlin',
      'Nr. 981',
      'Teststück 981',
      'Lagerort: Regal B981',
      'Verpackungs-Checkliste',
      'Hohlräume mit Papier füllen',
      ...PACKING_COMMON_ITEMS,
      'Herstellerin',
      TEST_BUSINESS.legalName,
      TEST_BUSINESS.street,
      `${TEST_BUSINESS.postalCode} ${TEST_BUSINESS.city}`,
      TEST_BUSINESS.email,
      'Warn- und Sicherheitshinweise',
      SAFETY_DE,
      'Nur Deko – nicht für Lebensmittel',
      'Platz für eine handschriftliche Karte',
    ]) {
      expect(text, needle).toContain(needle)
    }
    expect(text).not.toContain('€')
    expect(text).not.toMatch(/123,45|12345|8,90/)
    expect(text).not.toMatch(V02)
    // keine Kunden-E-Mail auf dem Zettel
    expect(text.toLowerCase()).not.toContain('erika@example.com')
    // EN-Hinweise nur bei EN-Bestellungen
    expect(text).not.toContain(SAFETY_EN)
  })

  it('EN-Bestellung: Beileger zusätzlich mit den EN-Hinweisen', async () => {
    const o = await order(982, { locale: 'en' })
    const text = await pdfText(Buffer.from(await (await slip(o.id)).arrayBuffer()))
    for (const needle of [
      'Manufacturer',
      'Warnings and safety information',
      SAFETY_EN,
      'Decoration only – not for food use',
      'Herstellerin',
      SAFETY_DE,
    ]) {
      expect(text, needle).toContain(needle)
    }
    expect(text).not.toContain('€')
  })
})
