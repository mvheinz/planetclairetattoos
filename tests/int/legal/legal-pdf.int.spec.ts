import { createHash } from 'node:crypto'

import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { activateLegalText } from '@/lib/legal/activate'
import { buildLegalAttachments } from '@/lib/legal/attachments'
import { LEGAL_PDF_CACHE_CONTROL, legalPdfResponse } from '@/lib/legal/download'
import { issueLegalTextPdfs } from '@/lib/legal/pdf'
import { LegalRenderError } from '@/lib/legal/render'
import type { Order } from '@/payload-types'

import { createOrder, deleteCommerce, orderData } from '../helpers/commerce'
import { pdfText, readDocument } from '../helpers/invoices'
import { deleteLegalTexts, lexical } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P4.12 – Rechtstext-PDFs (DATENMODELL §6.12; R-002, R-012, DM-LEG-02, DM-LEG-04) und Download-Routen.

const NOW = '2026-10-01T10:00:00.000Z'
const LATER = '2026-11-01T10:00:00.000Z'
const SITE = 'http://localhost:3000'

let payload: Payload
let productId: number
let orderNr = 960

async function draft(
  type: string,
  content: Record<string, unknown>,
  data: Record<string, unknown> = {},
  now = NOW,
) {
  return payload.create({
    collection: 'legal-texts',
    locale: 'de',
    data: { type, validFrom: now, origin: 'draft', content, ...data } as never,
    overrideAccess: true,
    context: { now },
  })
}

async function addEn(id: number, content: Record<string, unknown>) {
  await payload.update({
    collection: 'legal-texts',
    id,
    locale: 'en',
    data: { content } as never,
    overrideAccess: true,
    context: { now: NOW },
  })
}

/** Aktivieren wie die Verwaltung, dann den eingereihten PDF-Job direkt ausführen. */
async function activateWithPdf(id: number, now = NOW) {
  const req = await createLocalReq({ context: { now } }, payload)
  const res = await activateLegalText(req, id, {})
  expect(res.pdfJobId).not.toBeNull()
  const runReq = await createLocalReq({ context: { now } }, payload)
  await payload.jobs.runByID({ id: res.pdfJobId!, req: runReq })
  return payload.findByID({ collection: 'legal-texts', id, depth: 0, overrideAccess: true })
}

const docText = async (id: unknown) => pdfText(await readDocument(payload, id as number))

async function get(path: string): Promise<Response> {
  const url = new URL(`${SITE}/api/legal/${path}`)
  const segments = url.pathname.replace('/api/legal/', '').split('/')
  return legalPdfResponse(payload, segments, url.searchParams.get('locale'), new Date(LATER))
}

const texts: Record<string, number> = {}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await deleteLegalTexts(payload)
  const fx = await createProductFixtures(payload)
  productId = (await createProduct(payload, completeProduct('keramik', 985, fx))).id as number
  // v1 aller Bestelltexte (Platzhalter-Herkunft), AGB mit EN-Übersetzung
  const specs: [string, string[]][] = [
    ['agb', ['§ 1 Geltungsbereich', 'Anbieterin: {{name}}, {{street}}, {{postalCode}} {{city}}']],
    ['widerrufsbelehrung', ['Widerrufsrecht', 'Widerruf über {{withdrawalUrl}}']],
    ['widerrufsformular', ['Muster-Widerrufsformular', 'An {{name}}, {{email}}']],
    ['datenschutz', ['Datenschutz', 'Verantwortlich: {{name}}']],
    ['versand-zahlung', ['Versand', 'Lieferzeit: {{deliveryTime}}']],
  ]
  for (const [type, paragraphs] of specs) {
    const d = await draft(type, lexical(...paragraphs), { origin: 'placeholder' })
    if (type === 'agb' || type === 'widerrufsbelehrung') {
      await addEn(d.id, lexical('Terms v1 EN', 'Provider: {{name}} – {{withdrawalUrl}}'))
    }
    await activateWithPdf(d.id)
    texts[type] = d.id
  }
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await deleteLegalTexts(payload)
})

describe('Rechtstext-PDFs (P4.12)', () => {
  it('jede aktive Fassung hat ein PDF (documents, legal_text_pdf) mit SHA-256; Tokens ersetzt und eingefroren', async () => {
    const agb = await payload.findByID({
      collection: 'legal-texts',
      id: texts.agb!,
      depth: 0,
      overrideAccess: true,
    })
    expect(agb.pdfDe).toBeTruthy()
    expect(agb.pdfEn).toBeTruthy()
    expect(agb.contentSha256De).toMatch(/^[0-9a-f]{64}$/)
    expect(agb.contentSha256En).toMatch(/^[0-9a-f]{64}$/)
    const doc = await payload.findByID({
      collection: 'documents',
      id: agb.pdfDe as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(doc).toMatchObject({ kind: 'legal_text_pdf', language: 'de' })
    const file = await readDocument(payload, doc.id)
    expect(doc.sha256).toBe(createHash('sha256').update(file).digest('hex'))
    const text = await pdfText(file)
    expect(text).toContain('AGB')
    expect(text).toContain('v1 · gültig ab 01.10.2026')
    expect(text).not.toMatch(/\{\{|\}\}/)
    const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
    expect(text).toContain(settings.business.street)
    const en = await docText(agb.pdfEn)
    expect(en).toContain('Terms and conditions')
    expect(en).toContain(`${SITE}/en/withdraw-from-contract`)

    // Für alle fünf Bestelltexte existiert ein PDF
    for (const id of Object.values(texts)) {
      const t = await payload.findByID({ collection: 'legal-texts', id, depth: 0 })
      expect(t.pdfDe, t.type).toBeTruthy()
    }
  })

  it('R-002 Fassungen mit origin ≠ lawyer tragen oben „PLATZHALTER – nicht rechtsverbindlich“, Kanzleifassungen nicht', async () => {
    const agb = await payload.findByID({ collection: 'legal-texts', id: texts.agb!, depth: 0 })
    expect(await docText(agb.pdfDe)).toContain('PLATZHALTER – nicht rechtsverbindlich')
    expect(await docText(agb.pdfEn)).toContain('PLACEHOLDER – not legally binding')
    const lawyer = await draft('impressum', lexical('Impressum', '{{name}}'), { origin: 'lawyer' })
    const active = await activateWithPdf(lawyer.id)
    const text = await docText(active.pdfDe)
    expect(text).toContain('Impressum')
    expect(text).not.toContain('PLATZHALTER')
  })

  it('DM-LEG-04 {{unknown}}, {{business.street}} oder {{STEUERNUMMER}} → Render-Fehler, kein PDF', async () => {
    for (const bad of ['{{unknown}}', '{{business.street}}', '{{STEUERNUMMER}}']) {
      // Aktivieren ist gesperrt …
      const d = await draft('versand-zahlung', lexical(`Text ${bad}`))
      const req = await createLocalReq({ context: { now: NOW } }, payload)
      await expect(activateLegalText(req, d.id, {})).rejects.toThrow(/Platzhalter/)
      // … und auch der PDF-Renderer selbst lehnt ab (Seed-Fassung direkt aktiv angelegt)
      const seeded = await payload.create({
        collection: 'legal-texts',
        locale: 'de',
        data: {
          type: 'datenschutz',
          version: 90 + bad.length,
          status: 'superseded',
          validFrom: '2026-01-01T00:00:00.000Z',
          origin: 'placeholder',
          content: lexical(`Text ${bad}`),
        } as never,
        overrideAccess: true,
        context: { seed: true },
      })
      const before = await payload.count({ collection: 'documents', overrideAccess: true })
      const r = await createLocalReq({ context: { now: NOW } }, payload)
      await expect(issueLegalTextPdfs(r, seeded.id)).rejects.toBeInstanceOf(LegalRenderError)
      const after = await payload.count({ collection: 'documents', overrideAccess: true })
      expect(after.totalDocs).toBe(before.totalDocs)
      const reread = await payload.findByID({ collection: 'legal-texts', id: seeded.id, depth: 0 })
      expect(reread.pdfDe).toBeFalsy()
    }
  })

  it('DM-LEG-02 Bündel-PDF enthält beide Texte der Bestellfassung; nach neuer Fassung bekommt die alte Bestellung weiter die alten PDFs', async () => {
    const order = (await createOrder(
      payload,
      orderData(++orderNr, [{ id: productId, itemNumber: 985 }], {
        legalTextVersions: {
          agb: texts.agb,
          widerrufsbelehrung: texts.widerrufsbelehrung,
          widerrufsformular: texts.widerrufsformular,
          datenschutz: texts.datenschutz,
          versandZahlung: texts['versand-zahlung'],
        },
      }),
    )) as Order
    const req = await createLocalReq({}, payload)
    const first = await buildLegalAttachments(req, order)
    expect(first.map((a) => a.filename)).toEqual([
      'AGB_v1.pdf',
      'Widerrufsbelehrung-und-Formular_v1.pdf',
    ])
    const bundle = await pdfText(first[1]!.content)
    expect(bundle).toContain('Widerrufsbelehrung')
    expect(bundle).toContain('Muster-Widerrufsformular')
    expect(bundle).toContain(`${SITE}/de/vertrag-widerrufen`)
    expect(bundle).toContain('PLATZHALTER – nicht rechtsverbindlich')

    // deterministisch: gleiche Fassungen → gleiche Datei
    const again = await buildLegalAttachments(await createLocalReq({}, payload), order)
    expect(again.map((a) => a.sha256)).toEqual(first.map((a) => a.sha256))

    // neue AGB v2 und Belehrung v2 aktivieren
    const agb2 = await draft('agb', lexical('§ 1 Neue AGB Fassung zwei', '{{name}}'), {}, LATER)
    await activateWithPdf(agb2.id, LATER)
    const bel2 = await draft('widerrufsbelehrung', lexical('Belehrung Fassung zwei'), {}, LATER)
    await activateWithPdf(bel2.id, LATER)
    const after = await buildLegalAttachments(await createLocalReq({}, payload), order)
    expect(after.map((a) => a.filename)).toEqual([
      'AGB_v1.pdf',
      'Widerrufsbelehrung-und-Formular_v1.pdf',
    ])
    expect(after[0]!.sha256).toBe(first[0]!.sha256)
    expect(await pdfText(after[0]!.content)).not.toContain('Fassung zwei')
    expect(await pdfText(after[1]!.content)).not.toContain('Fassung zwei')

    // EN-Bestellung: zusätzlich die vorhandenen EN-Fassungen
    const enOrder = { ...order, locale: 'en' as const }
    const en = await buildLegalAttachments(await createLocalReq({}, payload), enOrder)
    expect(en.map((a) => a.filename)).toEqual([
      'AGB_v1.pdf',
      'Widerrufsbelehrung-und-Formular_v1.pdf',
      'AGB_v1_EN.pdf',
      'Widerrufsbelehrung-und-Formular_v1_EN.pdf',
    ])
    expect(await pdfText(en[3]!.content)).toContain('Right of withdrawal')
  })

  it('Download-Routen: 200 für aktive/abgelöste Fassungen (Cache-Control), 404 für Entwürfe und unbekannte Typen', async () => {
    const current = await get('agb.pdf?locale=de')
    expect(current.status).toBe(200)
    expect(current.headers.get('content-type')).toBe('application/pdf')
    expect(current.headers.get('cache-control')).toBe(LEGAL_PDF_CACHE_CONTROL)
    expect(await pdfText(Buffer.from(await current.arrayBuffer()))).toContain('Neue AGB')

    const superseded = await get(`agb/${texts.agb}.pdf`)
    expect(superseded.status).toBe(200)
    expect(await pdfText(Buffer.from(await superseded.arrayBuffer()))).not.toContain('Neue AGB')
    const en = await get(`agb/${texts.agb}.pdf?locale=en`)
    expect(await pdfText(Buffer.from(await en.arrayBuffer()))).toContain('Terms v1 EN')
    // EN ohne EN-PDF → deutsches PDF
    const enFallback = await get('versand-zahlung.pdf?locale=en')
    expect(enFallback.status).toBe(200)

    const d = await draft('impressum', lexical('Entwurf'), {}, LATER)
    expect((await get(`impressum/${d.id}.pdf`)).status).toBe(404)
    expect((await get(`agb/${d.id}.pdf`)).status).toBe(404) // falscher Typ
    expect((await get('unbekannt.pdf')).status).toBe(404)
    expect((await get('agb.pdf?locale=fr')).status).toBe(404)
    expect((await get('agb/abc.pdf')).status).toBe(404)
    expect((await get('agb/1/2.pdf')).status).toBe(404)
  })
})
