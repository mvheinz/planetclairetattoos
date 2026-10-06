import type { Payload, PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notifyAdmin = vi.fn()
vi.mock('@/lib/email/notifyAdmin', () => ({
  notifyAdmin: (...args: unknown[]) => notifyAdmin(...args),
}))

import {
  complianceOverview,
  isComplianceDocPurpose,
  runComplianceDocsReview,
} from '@/lib/legal/complianceDocs'

const NOW = new Date('2040-01-15T10:00:00Z')

function fakePayload(data: {
  products?: unknown[]
  uploads?: unknown[]
  declarations?: unknown[]
}) {
  const find = vi.fn(async ({ collection }: { collection: string; where?: unknown }) => ({
    docs:
      collection === 'products'
        ? (data.products ?? [])
        : collection === 'private-uploads'
          ? (data.uploads ?? [])
          : (data.declarations ?? []),
  }))
  return { payload: { find } as unknown as Payload, find }
}

describe('P5.13 Produktsicherheits-Unterlagen (Zweige)', () => {
  beforeEach(() => notifyAdmin.mockReset())

  it('L-24 Zwecke erkennen', () => {
    expect(isComplianceDocPurpose('lab_report')).toBe(true)
    expect(isComplianceDocPurpose('commission_image')).toBe(false)
    expect(isComplianceDocPurpose(undefined)).toBe(false)
  })

  it('L-24 Frist 10 Jahre nach dem letzten Inverkehrbringen; im Verkauf läuft sie nicht; Seed-Filter', async () => {
    const { payload, find } = fakePayload({
      products: [
        { id: 1, category: 'keramik', status: 'sold', soldAt: '2026-01-10T00:00:00Z' },
        {
          id: 2,
          category: 'keramik',
          status: 'archived',
          archivedAt: '2028-02-01T00:00:00Z',
          firstPublishedAt: '2027-01-01T00:00:00Z',
        },
        {
          id: 3,
          category: 'schmuck',
          status: 'available',
          firstPublishedAt: '2039-01-01T00:00:00Z',
        },
        { id: 4, category: 'textil', status: 'draft', soldAt: 'kaputt' },
        { id: 5, category: 'gibt-es-nicht', status: 'sold', soldAt: '2026-01-10T00:00:00Z' },
      ],
      uploads: [
        {
          id: 10,
          purpose: 'technical_file',
          filename: 'a.pdf',
          url: '/f/a.pdf',
          relatedProduct: { id: 1 },
          seed: true,
        },
        {
          id: 11,
          purpose: 'lab_report',
          filename: 'b.pdf',
          documentVersion: 'v2',
          complianceCategory: 'schmuck',
          documentDate: '2030-01-01',
          note: 'n',
        },
        { id: 12, purpose: 'nickel_evidence', filename: null },
        { id: 13, purpose: 'supplier_document', filename: 'c.pdf', relatedDeclaration: 4 },
        { id: 14, purpose: 'supplier_document', filename: 'd.pdf' },
        { id: 15, purpose: 'commission_image', filename: 'x.jpg' },
      ],
      declarations: [
        { id: 20, name: 'Erklärung', validFrom: '2030-01-01', notes: 'ok', seed: true },
        { id: 21, name: '' },
      ],
    })
    const o = await complianceOverview(payload, NOW, { includeSeed: false })
    // `includeSeed: false` filtert in der Abfrage nach Seed
    expect(JSON.stringify(find.mock.calls[0]![0].where)).toContain('not_equals')
    const keramik = o.categories.find((c) => c.category === 'keramik')!
    expect(keramik.pieces).toBe(2)
    expect(keramik.onMarket).toBe(false)
    expect(keramik.lastPlacedAt).toBe('2028-02-01T00:00:00.000Z')
    expect(keramik.keepUntil).toMatch(/^2038-02/)
    expect(keramik.missingTechnicalFile).toBe(false)
    const schmuck = o.categories.find((c) => c.category === 'schmuck')!
    expect(schmuck.onMarket).toBe(true)
    expect(schmuck.keepUntil).toBeNull()
    expect(schmuck.lastPlacedAt).toBeNull()
    expect(schmuck.missingTechnicalFile).toBe(true)
    const textil = o.categories.find((c) => c.category === 'textil')!
    expect(textil.keepUntil).toBeNull()
    expect(o.uncategorized.map((d) => d.id)).toEqual([14])
    const byId = (id: number) => keramik.documents.find((d) => d.id === id)!
    expect(byId(10)).toMatchObject({ deletable: true, seed: true, title: 'a.pdf' })
    expect(byId(13).category).toBe('keramik')
    const b = schmuck.documents.find((d) => d.id === 11)!
    expect(b).toMatchObject({
      title: 'b.pdf (v2)',
      documentVersion: 'v2',
      note: 'n',
      deletable: false,
    })
    expect(schmuck.documents.find((d) => d.id === 12)!.title).toBe('#12')
    expect(schmuck.documents.find((d) => d.id === 12)!.category).toBe('schmuck')
    expect(
      keramik.documents.find((d) => d.kind === 'conformity_declaration' && d.id === 21)!.title,
    ).toBe('#21')
    expect(keramik.documents.find((d) => d.id === 20)).toMatchObject({
      seed: true,
      documentDate: '2030-01-01',
      note: 'ok',
    })
    expect(o.uncategorized.some((d) => d.id === 15)).toBe(false)
    const all = await complianceOverview(payload, NOW, { includeSeed: true })
    expect(all.categories).toHaveLength(o.categories.length)
    expect(JSON.stringify(find.mock.calls.at(-3)![0].where)).toBe('{}')
  })

  it('A16 ohne Befund keine Mail', async () => {
    const { payload } = fakePayload({})
    const req = { payload } as unknown as PayloadRequest
    const res = await runComplianceDocsReview(req, NOW, '2040-01')
    expect(res).toEqual({ sent: false, missingCategories: [], deletable: 0 })
    expect(notifyAdmin).not.toHaveBeenCalled()
  })

  it('A16 Befund → Mail mit Idempotenz-Schlüssel je Monat; queued/nicht queued', async () => {
    const { payload } = fakePayload({
      products: [
        { id: 1, category: 'keramik', status: 'sold', soldAt: '2026-01-10T00:00:00Z' },
        { id: 2, category: 'schmuck', status: 'available' },
      ],
      uploads: [{ id: 10, purpose: 'technical_file', filename: 'a.pdf', relatedProduct: 1 }],
    })
    const req = { payload } as unknown as PayloadRequest
    notifyAdmin.mockResolvedValueOnce({ status: 'queued' })
    const res = await runComplianceDocsReview(req, NOW, '2040-01')
    expect(res).toEqual({ sent: true, missingCategories: ['schmuck'], deletable: 1 })
    const [, template, data, opts] = notifyAdmin.mock.calls[0]!
    expect(template).toBe('admin_compliance_docs_review')
    expect(data.missingCategories).toHaveLength(1)
    expect(data.documents[0]).toMatchObject({ kind: 'technical_file', deletable: true })
    expect(opts.idempotencyKey).toBe('admin_compliance_docs_review:2040-01:monthly')
    notifyAdmin.mockResolvedValueOnce({ status: 'skipped' })
    expect((await runComplianceDocsReview(req, NOW, '2040-02')).sent).toBe(false)
    notifyAdmin.mockResolvedValueOnce({})
    expect((await runComplianceDocsReview(req, NOW, '2040-03')).sent).toBe(false)
  })
})
