import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  docs: new Map<number, Record<string, unknown>>(),
  sections: new Map<string, { section: string } | null>(),
  files: new Map<string, Buffer | null>(),
  stored: new Map<number, { filename?: string; prefix?: string } | null>(),
}))

vi.mock('@/lib/payload/localReq', () => ({
  preservingReq: async (_req: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/storage/read', () => ({
  readStoredFile: async (_c: string, filename: string) => state.files.get(filename) ?? null,
}))
vi.mock('@/lib/legal/pdf', () => ({
  loadLegalTextAll: async (_req: unknown, id: number) => state.docs.get(id),
  renderLegalSection: async (_req: unknown, doc: { id: number }, locale: string) =>
    state.sections.get(`${doc.id}:${locale}`) ?? null,
  renderLegalPdf: async (o: { title: string; author: string }) => ({
    data: Buffer.from(`${o.title}|${o.author}`),
  }),
}))

import { AttachmentNotReadyError } from '@/lib/email/errors'
import { buildLegalAttachments, legalAttachmentInfo } from '@/lib/legal/attachments'

function req(legalName: string | null = 'Jutta') {
  return {
    payload: {
      findByID: vi.fn(async ({ id }: { id: number }) => state.stored.get(id) ?? null),
      findGlobal: vi.fn(async () => ({ business: legalName ? { legalName } : {} })),
    },
  } as unknown as PayloadRequest
}

const order = (locale: 'de' | 'en', versions: Record<string, unknown> | null) =>
  ({ id: 9, locale, legalTextVersions: versions }) as never
const full = { agb: 1, widerrufsbelehrung: { id: 2 }, widerrufsformular: '3' }

describe('AK-6-02 Rechtstext-Anhänge (Zweige)', () => {
  beforeEach(() => {
    state.docs.clear()
    state.sections.clear()
    state.files.clear()
    state.stored.clear()
    state.docs.set(1, { id: 1, version: 4, pdfDe: 11, pdfEn: { id: 12 }, validFrom: '2026-01-01' })
    state.docs.set(2, {
      id: 2,
      version: 5,
      validFrom: '2026-02-01',
      activatedAt: '2026-03-01T00:00:00Z',
      content: { de: { root: {} }, en: { root: {} } },
    })
    state.docs.set(3, { id: 3, version: 6, validFrom: '2026-02-15', content: {} })
    state.stored.set(11, { filename: 'agb.pdf' })
    state.stored.set(12, { filename: 'agb-en.pdf' })
    state.files.set('agb.pdf', Buffer.from('AGB'))
    state.files.set('agb-en.pdf', Buffer.from('AGB-EN'))
    state.sections.set('2:de', { section: 'B' })
    state.sections.set('3:de', { section: 'F' })
    state.sections.set('2:en', { section: 'B-en' })
  })

  it('fehlende Fassungen → Fehler (build und info)', async () => {
    await expect(buildLegalAttachments(req(), order('de', null))).rejects.toThrow(
      /Fassungen fehlen/,
    )
    await expect(
      buildLegalAttachments(req(), order('de', { agb: 1, widerrufsbelehrung: 2 })),
    ).rejects.toThrow(/Fassungen fehlen/)
    await expect(legalAttachmentInfo(req(), order('de', { agb: 1 }))).rejects.toThrow(/fehlen/)
    await expect(legalAttachmentInfo(req(), order('de', null))).rejects.toThrow(/fehlen/)
  })

  it('DE: AGB-PDF und gebündelte Belehrung; Formular ohne DE-Teil bleibt nicht bereit', async () => {
    const out = await buildLegalAttachments(req(), order('de', full))
    expect(out.map((a) => a.filename)).toEqual([
      'AGB_v4.pdf',
      'Widerrufsbelehrung-und-Formular_v5.pdf',
    ])
    expect(out[0]!.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(out[1]!.content.toString()).toContain(
      'Widerrufsbelehrung und Muster-Widerrufsformular|Jutta',
    )
    state.sections.delete('3:de')
    await expect(buildLegalAttachments(req(), order('de', full))).rejects.toBeInstanceOf(
      AttachmentNotReadyError,
    )
  })

  it('Autor-Rückfall ohne Firmennamen', async () => {
    const out = await buildLegalAttachments(req(null), order('de', full))
    expect(out[1]!.content.toString()).toContain('|planetclairetattoos.com')
  })

  it('fehlendes gespeichertes PDF → AttachmentNotReadyError (kein Verweis, keine Datei, kein Dateiname)', async () => {
    state.docs.set(1, { id: 1, version: 4, validFrom: '2026-01-01' })
    await expect(buildLegalAttachments(req(), order('de', full))).rejects.toBeInstanceOf(
      AttachmentNotReadyError,
    )
    state.docs.set(1, { id: 1, version: 4, pdfDe: 11, validFrom: '2026-01-01' })
    state.stored.set(11, { filename: undefined })
    await expect(buildLegalAttachments(req(), order('de', full))).rejects.toBeInstanceOf(
      AttachmentNotReadyError,
    )
    state.stored.set(11, null)
    await expect(buildLegalAttachments(req(), order('de', full))).rejects.toBeInstanceOf(
      AttachmentNotReadyError,
    )
  })

  it('EN: zusätzlich AGB_EN und englische Belehrung (Formular fällt auf DE zurück)', async () => {
    const out = await buildLegalAttachments(req(), order('en', full))
    expect(out.map((a) => a.filename)).toEqual([
      'AGB_v4.pdf',
      'Widerrufsbelehrung-und-Formular_v5.pdf',
      'AGB_v4_EN.pdf',
      'Widerrufsbelehrung-und-Formular_v5_EN.pdf',
    ])
    expect(out[3]!.content.toString()).toContain('Right of withdrawal')
  })

  it('EN: ohne EN-PDF und ohne EN-Inhalt nur die deutschen Dateien; EN-PDF verwiesen aber nicht gespeichert → Fehler', async () => {
    state.docs.set(1, { id: 1, version: 4, pdfDe: 11, validFrom: '2026-01-01' })
    state.docs.set(2, { id: 2, version: 5, validFrom: '2026-02-01', content: { de: { root: {} } } })
    const out = await buildLegalAttachments(req(), order('en', full))
    expect(out).toHaveLength(2)
    state.docs.set(1, { id: 1, version: 4, pdfDe: 11, pdfEn: 12, validFrom: '2026-01-01' })
    state.files.delete('agb-en.pdf')
    await expect(buildLegalAttachments(req(), order('en', full))).rejects.toBeInstanceOf(
      AttachmentNotReadyError,
    )
  })

  it('legalAttachmentInfo: Dateinamen und Fassungsdaten (DE und EN)', async () => {
    const de = await legalAttachmentInfo(req(), order('de', full))
    expect(de.files).toEqual(['AGB_v4.pdf', 'Widerrufsbelehrung-und-Formular_v5.pdf'])
    expect(de.agb).toEqual({ version: 4, date: '2026-01-01T00:00:00.000Z' })
    expect(de.withdrawal).toEqual({ version: 5, date: '2026-03-01T00:00:00.000Z' })
    const en = await legalAttachmentInfo(req(), order('en', full))
    expect(en.files).toHaveLength(4)
    state.docs.set(1, { id: 1, version: 4, validFrom: '2026-01-01' })
    state.docs.set(2, { id: 2, version: 5, validFrom: '2026-02-01', content: null })
    expect((await legalAttachmentInfo(req(), order('en', full))).files).toHaveLength(2)
  })
})
