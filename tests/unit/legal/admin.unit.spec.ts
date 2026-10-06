import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  execute: vi.fn(),
  writeAudit: vi.fn(),
  setDates: vi.fn(),
  activateText: vi.fn(),
  activateSnippet: vi.fn(),
  checkText: vi.fn(),
  checkSnippet: vi.fn(),
  states: vi.fn(),
  renderContent: vi.fn(),
  tokenValues: vi.fn(),
}))

vi.mock('@/lib/jobs/runLog', () => ({ poolDb: () => ({ execute: m.execute }) }))
vi.mock('@/lib/audit', () => ({ writeAudit: (...a: unknown[]) => m.writeAudit(...a) }))
vi.mock('@/lib/payload/transaction', () => ({
  inTransaction: async (_req: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/legal/review', async (orig) => ({
  ...(await orig<typeof import('@/lib/legal/review')>()),
  setLegalReviewDates: (...a: unknown[]) => m.setDates(...a),
  loadLegalReviewStates: (...a: unknown[]) => m.states(...a),
}))
vi.mock('@/lib/legal/activate', () => ({
  activateLegalText: (...a: unknown[]) => m.activateText(...a),
  activateLegalSnippet: (...a: unknown[]) => m.activateSnippet(...a),
  checkLegalText: (...a: unknown[]) => m.checkText(...a),
  checkLegalSnippet: (...a: unknown[]) => m.checkSnippet(...a),
}))
vi.mock('@/lib/legal/render', async (orig) => ({
  ...(await orig<typeof import('@/lib/legal/render')>()),
  loadLegalTokenValues: (...a: unknown[]) => m.tokenValues(...a),
  renderLegalContent: (...a: unknown[]) => m.renderContent(...a),
}))

import { TransitionError } from '@/lib/commerce/transitionError'
import {
  LegalAdminError,
  confirmLegalReview,
  legalTextOrderCounts,
  loadLegalSnippetsOverview,
  loadLegalTextsOverview,
  parseLegalSnippetInput,
  parseLegalTextInput,
  parseValidFrom,
  previewLegalSnippet,
  previewLegalText,
  publishLegalSnippet,
  publishLegalText,
} from '@/lib/legal/admin'
import { LegalRenderError } from '@/lib/legal/render'

const NOW = new Date('2026-10-05T10:00:00Z')

function makeReq(find: (a: { collection: string }) => unknown = () => ({ docs: [] })) {
  const create = vi.fn(async () => ({ id: 31, version: 4 }))
  const update = vi.fn(async () => ({}))
  const count = vi.fn(async () => ({ totalDocs: 1 }))
  return {
    req: {
      context: {},
      payload: { find: vi.fn(async (a: { collection: string }) => find(a)), create, update, count },
    } as unknown as PayloadRequest,
    create,
    update,
    count,
  }
}

describe('PLAN P6.4 Rechtstexte-Verwaltung (Zweige)', () => {
  beforeEach(() => {
    for (const f of Object.values(m)) f.mockReset()
    m.checkText.mockResolvedValue({ errors: [] })
    m.checkSnippet.mockResolvedValue({ errors: [] })
    m.tokenValues.mockResolvedValue({ shopName: 'Planet Claire' })
    m.renderContent.mockImplementation((c: unknown) => ({ content: c }))
    m.activateText.mockResolvedValue({ status: 'active' })
    m.activateSnippet.mockResolvedValue({ status: 'scheduled' })
  })

  it('parseValidFrom: leer, Tag, heute, Zeitpunkt, ungültig', () => {
    expect(parseValidFrom(null)).toBeNull()
    expect(parseValidFrom('')).toBeNull()
    expect(parseValidFrom(undefined)).toBeNull()
    expect(parseValidFrom('2026-10-05', NOW)).toBeNull()
    expect(parseValidFrom('2026-10-05')).toBeInstanceOf(Date)
    expect(parseValidFrom('2026-11-01', NOW)!.toISOString()).toMatch(/^2026-10-31T2[23]:00/)
    expect(parseValidFrom('2026-11-01T10:00:00Z')!.toISOString()).toBe('2026-11-01T10:00:00.000Z')
    expect(() => parseValidFrom('kein datum')).toThrow(LegalAdminError)
    expect(() => parseValidFrom('2026-13-45')).toThrow(LegalAdminError)
  })

  it('parseLegalTextInput: Fehlerfälle und gültige Eingabe', () => {
    const ok = { type: 'impressum', de: '<p>x</p>', origin: 'lawyer' }
    expect(() => parseLegalTextInput({ ...ok, type: 'x' })).toThrow('Unbekannter Rechtstext')
    expect(() => parseLegalTextInput({ ...ok, de: '  ' })).toThrow('deutschen Text')
    expect(() => parseLegalTextInput({ ...ok, de: 5 })).toThrow('deutschen Text')
    expect(() => parseLegalTextInput({ ...ok, de: 'x'.repeat(400_001) })).toThrow('zu lang')
    expect(() => parseLegalTextInput({ ...ok, en: 'x'.repeat(400_001) })).toThrow('englische')
    expect(() => parseLegalTextInput({ ...ok, origin: 'placeholder' })).toThrow('Herkunft')
    expect(() => parseLegalTextInput({ ...ok, validFrom: 'nein' })).toThrow('Datum')
    const full = parseLegalTextInput({
      ...ok,
      format: 'text',
      en: '<p>y</p>',
      sourceNote: ' Kanzlei ',
      changeNote: 5,
      validFrom: '2026-12-01',
    })
    expect(full).toMatchObject({
      format: 'text',
      en: '<p>y</p>',
      sourceNote: 'Kanzlei',
      changeNote: null,
      validFrom: '2026-12-01',
    })
    expect(parseLegalTextInput({ ...ok, en: '  ' })).toMatchObject({
      format: 'html',
      en: null,
      validFrom: null,
    })
  })

  it('parseLegalSnippetInput: Fehlerfälle und gültige Eingabe', () => {
    const key = 'price.shippingNote'
    const ok = { key, de: ' Text ', origin: 'draft' }
    expect(() => parseLegalSnippetInput({ ...ok, key: 'x' })).toThrow('Unbekannter Baustein')
    expect(() => parseLegalSnippetInput({ ...ok, de: '' })).toThrow('deutschen Text')
    expect(() => parseLegalSnippetInput({ ...ok, de: 'x'.repeat(2001) })).toThrow('zu lang')
    expect(() => parseLegalSnippetInput({ ...ok, en: 'x'.repeat(2001) })).toThrow('englische')
    expect(() => parseLegalSnippetInput({ ...ok, origin: 'x' })).toThrow('Herkunft')
    expect(
      parseLegalSnippetInput({ ...ok, en: ' EN ', changeNote: 'c', validFrom: '2026-12-01' }),
    ).toMatchObject({
      de: 'Text',
      en: 'EN',
      changeNote: 'c',
      validFrom: '2026-12-01',
    })
    expect(parseLegalSnippetInput(ok)).toMatchObject({ en: null, validFrom: null })
  })

  it('Bestellungen je Fassung', async () => {
    const r = makeReq()
    m.execute.mockResolvedValue({ rows: [{ id: '3', n: '2' }] })
    expect((await legalTextOrderCounts(r.req)).get(3)).toBe(2)
  })

  it('Übersicht der Texte und Bausteine', async () => {
    const r = makeReq(({ collection }) =>
      collection === 'legal-texts'
        ? {
            docs: [
              {
                id: 1,
                type: 'impressum',
                version: 2,
                status: 'active',
                validFrom: '2026-01-01T00:00:00Z',
                activatedAt: '2026-01-02T00:00:00Z',
                origin: 'lawyer',
                versionLabel: 'v2 Kanzlei',
              },
              {
                id: 2,
                type: 'impressum',
                version: 1,
                status: 'superseded',
                validFrom: '2025-01-01T00:00:00Z',
              },
            ],
          }
        : {
            docs: [
              {
                id: 5,
                key: 'price.shippingNote',
                version: 1,
                status: 'active',
                validFrom: '2026-01-01',
                origin: null,
              },
              {
                id: 6,
                key: 'price.shippingNote',
                version: 2,
                status: 'scheduled',
                validFrom: '2027-01-01',
              },
              {
                id: 7,
                key: 'price.shippingNote',
                version: 0,
                status: 'superseded',
                validFrom: '2025-01-01',
              },
            ],
          },
    )
    m.execute.mockResolvedValue({ rows: [{ id: 1, n: 3 }] })
    m.states.mockResolvedValue([{ type: 'impressum', lastReviewedAt: '2026-02-01', due: true }])
    const texts = await loadLegalTextsOverview(r.req, NOW)
    const imp = texts.find((t) => t.type === 'impressum')!
    expect(imp.active).toMatchObject({ id: 1, orderCount: 3, versionLabel: 'v2 Kanzlei' })
    expect(imp.ageDays).toBeGreaterThan(200)
    expect(imp).toMatchObject({ reviewDue: true, lastReviewedAt: '2026-02-01' })
    expect(imp.versions[0]).toMatchObject({
      id: 2,
      versionLabel: 'v1',
      origin: 'draft',
      orderCount: 0,
    })
    const other = texts.find((t) => t.type === 'datenschutz')!
    expect(other).toMatchObject({
      active: null,
      ageDays: null,
      reviewDue: false,
      lastReviewedAt: null,
    })
    const snippets = await loadLegalSnippetsOverview(r.req)
    const row = snippets.find((s) => s.key === 'price.shippingNote')!
    expect(row).toMatchObject({
      scheduled: 1,
      superseded: 1,
      active: { id: 5, origin: 'draft', activatedAt: null },
    })
    expect(snippets.find((s) => s.key !== 'price.shippingNote')!.active).toBeNull()
  })

  it('Vorschau Rechtstext: Fehlerliste, Rendern, Platzhalter bleiben bei Render-Fehler', async () => {
    const r = makeReq()
    const input = {
      type: 'impressum' as const,
      format: 'html' as const,
      de: '<p>Hallo</p>',
      en: '<p>Hi</p>',
      origin: 'draft' as const,
    }
    m.checkText.mockResolvedValue({ errors: ['Fehler A'] })
    const p = await previewLegalText(r.req, { ...input, validFrom: '2026-12-01' }, NOW)
    expect(p.errors).toEqual(['Fehler A'])
    expect(p.scheduled).toBe(true)
    expect(p.html.de).toContain('Hallo')
    expect(p.html.en).toContain('Hi')
    m.renderContent.mockImplementationOnce(() => {
      throw new LegalRenderError(['x'], [])
    })
    const bad = await previewLegalText(r.req, { ...input, en: null }, NOW)
    expect(bad.html.de).toContain('Hallo')
    expect(bad.html.en).toBeUndefined()
    expect(bad.scheduled).toBe(false)
    m.renderContent.mockImplementationOnce(() => {
      throw new Error('anderer Fehler')
    })
    await expect(previewLegalText(r.req, input, NOW)).rejects.toThrow('anderer Fehler')
    await expect(
      previewLegalText(r.req, { ...input, de: '<script>x</script>' }, NOW),
    ).rejects.toThrow('nichts übrig')
    const past = await previewLegalText(r.req, { ...input, validFrom: '2020-01-01T00:00:00Z' }, NOW)
    expect(past.errors[0]).toContain('Vergangenheit')
  })

  it('Vorschau Baustein: Platzhalter, Kontext-Platzhalter, HTML-Escaping', async () => {
    const r = makeReq()
    m.tokenValues.mockResolvedValue({ shopName: 'Planet Claire', empty: '  ' })
    const p = await previewLegalSnippet(
      r.req,
      {
        key: 'price.shippingNote',
        de: 'A <b> {{shopName}} {{unbekannt}}\nZeile',
        en: 'EN {{shopName}}',
        origin: 'draft',
        validFrom: '2026-12-01',
      },
      NOW,
    )
    expect(p.html.de).toBe('<p>A &lt;b&gt; Planet Claire {{unbekannt}}<br>Zeile</p>')
    expect(p.html.en).toContain('Planet Claire')
    expect(p.scheduled).toBe(true)
    const only = await previewLegalSnippet(
      r.req,
      { key: 'price.shippingNote', de: 'x', origin: 'draft' },
      NOW,
    )
    expect(only.html.en).toBeUndefined()
    expect(only.scheduled).toBe(false)
  })

  it('Veröffentlichen: Vergangenheit → 422; DE und EN; Baustein mit und ohne EN', async () => {
    const r = makeReq()
    const text = {
      type: 'impressum' as const,
      format: 'html' as const,
      de: '<p>Hallo</p>',
      origin: 'lawyer' as const,
    }
    await expect(
      publishLegalText(r.req, { ...text, validFrom: '2020-01-01T00:00:00Z' }, NOW),
    ).rejects.toMatchObject({ status: 422 })
    const a = await publishLegalText(r.req, text, NOW)
    expect(a).toMatchObject({ status: 'active', version: 4, validFrom: NOW.toISOString() })
    expect(r.update).not.toHaveBeenCalled()
    await publishLegalText(
      r.req,
      { ...text, en: '<p>Hi</p>', sourceNote: 's', changeNote: 'c' },
      NOW,
    )
    expect(r.update).toHaveBeenCalledTimes(1)
    await expect(
      publishLegalText(r.req, { ...text, de: '<script>x</script>' }, NOW),
    ).rejects.toBeInstanceOf(LegalAdminError)

    const snip = { key: 'price.shippingNote' as const, de: 'Text', origin: 'draft' as const }
    await expect(
      publishLegalSnippet(r.req, { ...snip, validFrom: '2020-01-01T00:00:00Z' }, NOW),
    ).rejects.toMatchObject({ status: 422 })
    const s = await publishLegalSnippet(r.req, snip, NOW)
    expect(s).toMatchObject({ status: 'scheduled', version: 4 })
    await publishLegalSnippet(r.req, { ...snip, en: 'Text EN', changeNote: 'c' }, NOW)
    expect(r.update).toHaveBeenCalledTimes(2)
  })

  it('Prüfung bestätigen: unbekannt, ohne aktive Fassung, Erfolg mit Audit', async () => {
    const r = makeReq()
    await expect(confirmLegalReview(r.req, 'x' as never, NOW)).rejects.toBeInstanceOf(
      LegalAdminError,
    )
    r.count.mockResolvedValueOnce({ totalDocs: 0 })
    await expect(confirmLegalReview(r.req, 'impressum', NOW)).rejects.toBeInstanceOf(
      TransitionError,
    )
    const res = await confirmLegalReview(r.req, 'impressum', NOW)
    expect(res).toEqual({ type: 'impressum', reviewedAt: NOW.toISOString() })
    expect(m.setDates).toHaveBeenCalledWith(r.req, ['impressum'], 'reviewedAt', NOW)
    expect(m.writeAudit.mock.calls[0]![1]).toMatchObject({ action: 'legal_review_confirmed' })
  })
})
