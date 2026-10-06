import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  seedMode: false,
  active: null as Record<string, unknown> | null,
  version: null as Record<string, unknown> | null,
  files: {} as Record<number, Record<string, unknown> | null>,
  data: null as Buffer | null,
}))
vi.mock('@/lib/env', () => ({ seedPreviewModeActive: () => state.seedMode }))
vi.mock('@/lib/storage/read', () => ({ readStoredFile: async () => state.data }))
vi.mock('@/lib/legal/getActive', () => ({ getActiveLegalText: async () => state.active }))

import { legalPdfResponse, parseLegalPdfPath } from '@/lib/legal/download'

const NOW = new Date('2026-10-05T10:00:00Z')
const payload = {
  findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) =>
    collection === 'legal-texts' ? state.version : (state.files[id] ?? null),
  ),
} as unknown as Payload

const doc = (over: Record<string, unknown> = {}) => ({
  id: 4,
  type: 'impressum',
  version: 3,
  status: 'active',
  pdfDe: 10,
  pdfEn: { id: 11 },
  ...over,
})

describe('R-015 öffentliche Rechtstext-PDFs (Zweige)', () => {
  beforeEach(() => {
    state.seedMode = false
    state.active = doc()
    state.version = doc()
    state.files = { 10: { filename: 'de.pdf' }, 11: { filename: 'en.pdf', prefix: 'p' } }
    state.data = Buffer.from('%PDF')
  })

  it('Pfad und Sprache', () => {
    expect(parseLegalPdfPath(['impressum.pdf'], null)).toEqual({
      kind: 'current',
      type: 'impressum',
      locale: 'de',
    })
    expect(parseLegalPdfPath(['impressum.pdf'], 'en')).toMatchObject({ locale: 'en' })
    expect(parseLegalPdfPath(['impressum.pdf'], 'fr')).toBeNull()
    expect(parseLegalPdfPath(['unbekannt.pdf'], null)).toBeNull()
    expect(parseLegalPdfPath(['impressum'], null)).toBeNull()
    expect(parseLegalPdfPath([], null)).toBeNull()
    expect(parseLegalPdfPath(['impressum', '12.pdf'], null)).toEqual({
      kind: 'version',
      type: 'impressum',
      id: 12,
      locale: 'de',
    })
    expect(parseLegalPdfPath(['unbekannt', '12.pdf'], null)).toBeNull()
    expect(parseLegalPdfPath(['impressum', '0.pdf'], null)).toBeNull()
    expect(parseLegalPdfPath(['a', 'b', 'c'], null)).toBeNull()
  })

  it('liefert DE-PDF, EN-PDF und Fassung nach ID', async () => {
    const de = await legalPdfResponse(payload, ['impressum.pdf'], null, NOW)
    expect(de.status).toBe(200)
    expect(de.headers.get('content-disposition')).toContain('impressum_v3.pdf')
    const en = await legalPdfResponse(payload, ['impressum.pdf'], 'en', NOW)
    expect(en.headers.get('content-disposition')).toContain('impressum_v3_en.pdf')
    const byId = await legalPdfResponse(payload, ['impressum', '4.pdf'], null, NOW)
    expect(byId.status).toBe(200)
    expect(byId.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('EN ohne EN-PDF → deutsches PDF', async () => {
    state.active = doc({ pdfEn: null })
    const res = await legalPdfResponse(payload, ['impressum.pdf'], 'en', NOW)
    expect(res.headers.get('content-disposition')).toContain('impressum_v3.pdf')
  })

  it('404: ungültiger Pfad, kein Text, Entwurf, Typ passt nicht, Beispieldaten, ohne PDF/Datei/Inhalt', async () => {
    const is404 = async (segs: string[]) =>
      (await legalPdfResponse(payload, segs, null, NOW)).status === 404
    expect(await is404(['x'])).toBe(true)
    state.active = null
    expect(await is404(['impressum.pdf'])).toBe(true)
    state.active = doc({ status: 'draft' })
    expect(await is404(['impressum.pdf'])).toBe(true)
    state.active = doc()
    state.version = doc({ type: 'agb' })
    expect(await is404(['impressum', '4.pdf'])).toBe(true)
    state.version = null
    expect(await is404(['impressum', '4.pdf'])).toBe(true)
    state.active = doc({ seed: true })
    expect(await is404(['impressum.pdf'])).toBe(true)
    state.seedMode = true
    expect(await is404(['impressum.pdf'])).toBe(false)
    state.active = doc({ pdfDe: null, pdfEn: null })
    expect(await is404(['impressum.pdf'])).toBe(true)
    state.active = doc()
    state.files[10] = { filename: null }
    expect(await is404(['impressum.pdf'])).toBe(true)
    state.files[10] = null
    expect(await is404(['impressum.pdf'])).toBe(true)
    state.files[10] = { filename: 'de.pdf' }
    state.data = null
    expect(await is404(['impressum.pdf'])).toBe(true)
  })
})
