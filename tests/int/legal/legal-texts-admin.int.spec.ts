import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  confirmLegalReview,
  loadLegalSnippetsOverview,
  loadLegalTextsOverview,
  previewLegalSnippet,
  previewLegalText,
  publishLegalSnippet,
  publishLegalText,
} from '@/lib/legal/admin'
import { legalHtmlToLexical } from '@/lib/legal/htmlToLexical'
import { LEGAL_SNIPPET_REQUIRES_LAWYER } from '@/lib/legal/snippets'

import { adminReq, resetAdmin } from '../helpers/admin'
import { createOrder, deleteCommerce, orderData } from '../helpers/commerce'
import { deleteLegalTexts, ensureLegalTextFixtures } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P6.4 Rechtstexte und Bausteine in der Verwaltung (KONZEPT §7.13): Übersicht mit Bestellzahlen je Fassung, Vorschau
// ohne Speichern, Veröffentlichen (sofort/geplant, danach unveränderlich), „Geprüft, keine Änderung“ (R-014).

let payload: Payload
let req: PayloadRequest
let token: string

const AGB_HTML =
  '<h1>AGB</h1><h2>Geltungsbereich</h2><p>Text folgt von der Kanzlei.</p><script>alert(1)</script>' +
  '<p style="color:red">Zweiter <b>Absatz</b> mit <a href="https://planetclairetattoos.com/de/agb">Link</a>.</p>'

const countTexts = async (where: Record<string, unknown> = {}) =>
  (await payload.count({ collection: 'legal-texts', where: where as never, overrideAccess: true }))
    .totalDocs

const auth = () => ({ Authorization: `JWT ${token}` })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteLegalTexts(payload)
  const admin = await resetAdmin(payload, '198.51.100.64')
  token = admin.token
  req = await adminReq(payload, admin.userId)
  // Fixture analog den Seed-Bestellungen: drei Bestellungen mit `legalTextVersions` = v1 (P8.21 prüft den Bestand).
  await deleteProducts(payload)
  const versions = await ensureLegalTextFixtures(payload)
  const p = await createProduct(
    payload,
    completeProduct('keramik', 985, await createProductFixtures(payload)),
  )
  const item = { id: p.id as number, itemNumber: 985 }
  for (const n of [981, 982, 983]) {
    await createOrder(payload, orderData(n, [item], { legalTextVersions: versions }))
  }
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
  await deleteLegalTexts(payload)
})

describe('Eingabe → Lexical (KANZLEI-BRIEFING §1.2)', () => {
  it('bereinigt, h1 → h2, Skript weg, fett und Link bleiben, Tabellen als Absätze', () => {
    const doc = legalHtmlToLexical(
      `${AGB_HTML}<table><tr><th>Klasse</th><th>Preis</th></tr><tr><td>Brief</td><td>2,50 €</td></tr></table>`,
    )
    const json = JSON.stringify(doc)
    expect(json).not.toContain('alert')
    const kids = doc.root.children as { type: string; tag?: string }[]
    expect(kids.map((k) => k.type)).toEqual([
      'heading',
      'heading',
      'paragraph',
      'paragraph',
      'paragraph',
      'paragraph',
    ])
    expect(kids[0]!.tag).toBe('h2')
    expect(json).toContain('"format":1')
    expect(json).toContain('https://planetclairetattoos.com/de/agb')
    expect(json).toContain('Brief')
    expect(json).toContain(' · ')
  })
})

describe('P6.4 Übersicht', () => {
  it('AK Anzahl Bestellungen je Fassung stimmt mit den Fixture-Bestellungen überein', async () => {
    const rows = await loadLegalTextsOverview(req)
    expect(rows.map((r) => r.type)).toEqual([
      'impressum',
      'datenschutz',
      'agb',
      'widerrufsbelehrung',
      'widerrufsformular',
      'versand-zahlung',
    ])
    const agb = rows.find((r) => r.type === 'agb')!
    expect(agb.active?.version).toBe(1)
    expect(agb.active?.orderCount).toBe(3)
    expect(agb.active?.origin).toBe('placeholder')
    expect(rows.find((r) => r.type === 'impressum')!.active).toBeNull()
    expect(rows.find((r) => r.type === 'versand-zahlung')!.active?.orderCount).toBe(3)
  })

  it('Bausteine nach Schlüssel mit Spalte „Kanzlei ja/nein“ (ANFORDERUNGEN §6)', async () => {
    const rows = await loadLegalSnippetsOverview(req)
    const keys = rows.map((r) => r.key)
    expect(keys).toEqual([...keys].sort())
    for (const r of rows) {
      expect(r.requiresLawyer, r.key).toBe(LEGAL_SNIPPET_REQUIRES_LAWYER.includes(r.key))
    }
    expect(rows.find((r) => r.key === 'product.glassFrame')!.requiresLawyer).toBe(false)
    expect(rows.find((r) => r.key === 'checkout.legalNotice')!.requiresLawyer).toBe(true)
  })
})

describe('P6.4 Vorschau', () => {
  it('R-012 AK Vorschau zeigt Token-Fehler, ohne zu speichern', async () => {
    const before = await countTexts()
    const preview = await previewLegalText(req, {
      type: 'agb',
      format: 'text',
      de: 'Anbieter: {{firma}}\n\nSteuer: {{STEUERNUMMER}}',
      origin: 'draft',
    })
    expect(preview.errors.join(' ')).toMatch(
      /unbekannte Platzhalter: \{\{firma\}\}, \{\{STEUERNUMMER\}\}/,
    )
    expect(preview.html.de).toContain('{{firma}}')
    expect(await countTexts()).toBe(before)

    // Über die Schnittstelle der Verwaltung genauso; ohne Anmeldung 403.
    const body = { type: 'agb', format: 'html', de: '<p>{{nam}}</p>', origin: 'draft' }
    const res = await rest('POST', '/legal-texts/preview-version', body, auth())
    expect(res.status).toBe(200)
    const json = (await res.json()) as { preview: { errors: string[] } }
    expect(json.preview.errors.join(' ')).toContain('{{nam}}')
    expect((await rest('POST', '/legal-texts/preview-version', body)).status).toBe(403)
    expect(await countTexts()).toBe(before)
  })

  it('V-01 Vorschau sperrt OS-Link; fehlerfreie Vorschau rendert HTML', async () => {
    const bad = await previewLegalText(req, {
      type: 'agb',
      format: 'html',
      de: '<p>https://ec.europa.eu/consumers/odr</p>',
      origin: 'draft',
    })
    expect(bad.errors.length).toBeGreaterThan(0)
    const ok = await previewLegalText(req, {
      type: 'agb',
      format: 'html',
      de: AGB_HTML,
      origin: 'lawyer',
    })
    expect(ok.errors).toEqual([])
    expect(ok.html.de).toContain('<h2>AGB</h2>')
    expect(ok.html.de).not.toContain('script')
    expect(ok.scheduled).toBe(false)
  })
})

describe('P6.4 Veröffentlichen', () => {
  it('R-012 AK neue AGB-Version sofort aktiv, alte abgelöst, danach unveränderlich; Bestellzahlen je Fassung', async () => {
    const published = await publishLegalText(req, {
      type: 'agb',
      format: 'html',
      de: AGB_HTML,
      en: '<h2>Scope</h2><p>Text to follow from the law firm.</p>',
      origin: 'draft',
      sourceNote: 'Test',
    })
    expect(published.status).toBe('active')
    expect(published.version).toBe(2)
    expect(published.supersededId).not.toBeNull()

    const doc = await payload.findByID({
      collection: 'legal-texts',
      id: published.id,
      locale: 'all',
      depth: 0,
      overrideAccess: true,
    })
    expect(doc.status).toBe('active')
    expect(JSON.stringify(doc.content)).toContain('Text to follow from the law firm.')

    const rows = await loadLegalTextsOverview(req)
    const agb = rows.find((r) => r.type === 'agb')!
    expect(agb.active).toMatchObject({ version: 2, orderCount: 0, origin: 'draft' })
    expect(agb.versions.map((v) => [v.version, v.status, v.orderCount])).toEqual([
      [1, 'superseded', 3],
    ])

    // Nicht mehr änderbar – weder per REST noch per Local API.
    const patch = await rest(
      'PATCH',
      `/legal-texts/${published.id}`,
      { changeNote: 'nachträglich' },
      auth(),
    )
    expect(patch.status).toBeGreaterThanOrEqual(400)
    await expect(
      payload.update({
        collection: 'legal-texts',
        id: published.id,
        data: { changeNote: 'nachträglich' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/changeNote/)
  })

  it('Veröffentlichen ab Datum → geplant; gesperrte Prüfung legt nichts an (422)', async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
    const scheduled = await publishLegalText(req, {
      type: 'datenschutz',
      format: 'text',
      de: 'Verantwortliche\n\nText folgt von der Kanzlei.',
      origin: 'draft',
      validFrom: tomorrow,
    })
    expect(scheduled.status).toBe('scheduled')
    expect(scheduled.pdfJobId).toBeNull()

    const drafts = await countTexts({ status: { equals: 'draft' } })
    const res = await rest(
      'POST',
      '/legal-texts/publish-version',
      {
        type: 'agb',
        format: 'html',
        de: '<p>Streitbeilegung: https://ec.europa.eu/consumers/odr</p>',
        origin: 'draft',
      },
      auth(),
    )
    expect(res.status).toBe(422)
    expect(await countTexts({ status: { equals: 'draft' } })).toBe(drafts)
    expect(await countTexts({ type: { equals: 'agb' } })).toBe(2)
  })

  it('R-014 „Geprüft, keine Änderung“ setzt reviewedAt und schreibt Audit legal_review_confirmed', async () => {
    const now = new Date()
    const res = await confirmLegalReview(req, 'agb', now)
    expect(res.reviewedAt).toBe(now.toISOString())
    const settings = (await payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
    })) as unknown as { legal: { reviews: { type: string; reviewedAt?: string | null }[] } }
    const row = settings.legal.reviews.find((r) => r.type === 'agb')
    expect(new Date(row!.reviewedAt!).toISOString()).toBe(now.toISOString())
    const audit = await payload.find({
      collection: 'audit-log',
      where: { action: { equals: 'legal_review_confirmed' } },
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
    })
    expect(audit.docs[0]?.entityId).toBe('agb')
    // Ohne aktive Fassung gibt es nichts zu prüfen.
    await expect(confirmLegalReview(req, 'impressum')).rejects.toThrow(/aktive Fassung/)
  })

  it('Bausteine: Vorschau mit Fehlerliste, Veröffentlichen löst die alte Fassung ab', async () => {
    const bad = await previewLegalSnippet(req, {
      key: 'translation.disclaimer',
      de: 'Nur {{unbekannt}} gilt.',
      origin: 'draft',
    })
    expect(bad.errors.join(' ')).toContain('unbekannt')
    const before = await payload.find({
      collection: 'legal-snippets',
      where: {
        and: [{ key: { equals: 'translation.disclaimer' } }, { status: { equals: 'active' } }],
      },
      depth: 0,
      overrideAccess: true,
    })
    const published = await publishLegalSnippet(req, {
      key: 'translation.disclaimer',
      de: 'Verbindlich ist nur die deutsche Fassung.',
      en: 'Only the German version is legally binding.',
      origin: 'draft',
    })
    expect(published.status).toBe('active')
    if (before.docs[0]) expect(published.supersededId).toBe(before.docs[0].id)
    const rows = await loadLegalSnippetsOverview(req)
    expect(rows.find((r) => r.key === 'translation.disclaimer')!.active?.id).toBe(published.id)
  })
})
