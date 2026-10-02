import { beforeAll, describe, expect, it } from 'vitest'

import { getEnv } from '@/lib/env'
import { productLabelData } from '@/lib/pdf/packingDocs'
import { createLocalReq } from 'payload'

import { resetAdmin } from '../helpers/admin'
import { pdfText, TEST_BUSINESS } from '../helpers/invoices'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.12 – Etikett und Beileger je Stück (R-203, GPSR Art. 9): Objektnummer, Name, Postanschrift, E-Mail,
// Warnhinweise, bei Deko-Keramik „Nur Deko – nicht für Lebensmittel“, QR-Code zur kanonischen Produktseite.

const NUMBERS = [983, 984]
const h = shopHarness({ start: '2026-09-20T08:00:00.000Z', numbers: NUMBERS, tag: 'gpsr-label' })
let token: string

const SAFETY = 'Handgemacht: Kanten und Glasur können unregelmäßig sein. Zerbrechlich.'

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.76'))
})

const label = (id: number, auth = true) =>
  rest('GET', `/products/${id}/label.pdf`, undefined, auth ? { authorization: `JWT ${token}` } : {})

describe('GPSR-Etikett (P5.12)', () => {
  it('R-203 Etikett einer Deko-Keramik enthält Objektnummer, Name, Anschrift, E-Mail, Warnhinweis und „Nur Deko – nicht für Lebensmittel“', async () => {
    const id = await h.piece(983, { foodContact: 'deko', safetyWarnings: SAFETY })
    const res = await label(id)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    const text = await pdfText(Buffer.from(await res.arrayBuffer()))
    for (const needle of [
      'Nr. 983',
      TEST_BUSINESS.legalName,
      TEST_BUSINESS.street,
      `${TEST_BUSINESS.postalCode} ${TEST_BUSINESS.city}`,
      TEST_BUSINESS.email,
      SAFETY,
      'Nur Deko – nicht für Lebensmittel',
    ]) {
      expect(text, needle).toContain(needle)
    }
    expect(text).not.toContain('€')
  })

  it('R-203 QR-Code und Link zeigen auf die kanonische Produktseite; ohne Anmeldung 403', async () => {
    const id = await h.piece(984, { foodContact: 'deko', safetyWarnings: SAFETY })
    const req = await createLocalReq({}, h.payload)
    const data = await productLabelData(req, id)
    const site = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    expect(data?.productUrl).toMatch(
      new RegExp(`^${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/de/shop/984-`),
    )
    expect(data?.qr.startsWith('data:image/png;base64,')).toBe(true)
    expect(data?.insert.decoOnly).toBe(true)
    expect((await label(id, false)).status).toBe(403)
    expect((await label(999_999_999)).status).toBe(404)
  })
})
