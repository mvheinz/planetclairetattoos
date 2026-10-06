import type { Payload } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getSnippet,
  initLegalSnippets,
  invalidSnippetTokens,
  invalidateLegalSnippets,
  loadLegalSnippets,
  renderSnippetText,
  resetLegalSnippetCache,
  SNIPPET_CACHE_TTL_MS,
  SnippetRenderError,
  snippetTokens,
} from '@/lib/legal/snippets'

const KEY = 'price.shippingNote' as const

const doc = (over: Record<string, unknown>) => ({
  key: KEY,
  version: 1,
  status: 'active',
  validFrom: '2026-01-01T00:00:00Z',
  text: { de: 'Versand {{orderNumber}}', en: 'Shipping {{orderNumber}}' },
  origin: 'lawyer',
  ...over,
})

function fakePayload(docs: unknown[] | Error) {
  return {
    find: vi.fn(async () => {
      if (docs instanceof Error) throw docs
      return { docs }
    }),
  } as unknown as Payload & { find: ReturnType<typeof vi.fn> }
}

let clock = 1_000
describe('R-012 Textbausteine: Speicherstand und Darstellung (Zweige)', () => {
  beforeEach(() => {
    resetLegalSnippetCache()
    clock = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => vi.restoreAllMocks())

  it('Tokens und Prüfung', () => {
    expect(snippetTokens('a {{x}} b {{y}}')).toEqual(['x', 'y'])
    expect(invalidSnippetTokens(KEY, 'ok {{unbekannt}} und {{ offen')).toEqual([
      '{{unbekannt}}',
      '{{…}}',
    ])
    expect(invalidSnippetTokens(KEY, 'sauber')).toEqual([])
  })

  it('Darstellung: unbekannt, ohne Wert, offene Klammer, Erfolg; Fehlertext', () => {
    expect(() => renderSnippetText(KEY, '{{nope}}')).toThrow(/unbekannte Platzhalter/)
    expect(() => renderSnippetText(KEY, '{{orderNumber}}', { orderNumber: '  ' })).toThrow(
      /ohne Wert/,
    )
    expect(() => renderSnippetText(KEY, '{{orderNumber}}', { orderNumber: null })).toThrow(
      SnippetRenderError,
    )
    expect(() => renderSnippetText(KEY, 'offen {{')).toThrow(/unbekannter Schlüssel/)
    expect(renderSnippetText(KEY, 'Nr. {{orderNumber}}', { orderNumber: 5 })).toBe('Nr. 5')
    expect(() => getSnippet('gibt.es.nicht' as never, 'de')).toThrow(SnippetRenderError)
  })

  it('ohne Speicherstand: Arbeitsfassung draft-1', () => {
    const s = getSnippet('price.kleinunternehmerNote', 'de')
    expect(s.version).toBe('draft-1')
    expect(s.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('lädt, sortiert, wählt aktive bzw. zu `at` gültige Fassung; EN-Rückfall auf DE', async () => {
    const payload = fakePayload([
      doc({
        version: 1,
        status: 'superseded',
        validFrom: '2025-01-01T00:00:00Z',
        text: 'nur DE {{orderNumber}}',
      }),
      doc({ version: 2, validFrom: '2026-01-01T00:00:00Z', sha256De: 'abc' }),
      doc({ version: 3, status: 'draft' }),
      doc({ version: 4, status: 'superseded', text: { de: '' } }),
      doc({ version: 5, status: 'superseded', origin: null, text: null }),
      doc({
        key: 'price.tattooNote',
        version: 1,
        status: 'superseded',
        validFrom: '2020-01-01T00:00:00Z',
        text: { de: 'T' },
      }),
    ])
    const map = await loadLegalSnippets(payload)
    expect(map.get(KEY)!.map((s) => s.version)).toEqual([2, 1])
    const now = getSnippet(KEY, 'en', { orderNumber: '5 €' })
    expect(now).toMatchObject({
      version: '2',
      text: 'Shipping 5 €',
      sha256: 'abc',
      origin: 'lawyer',
    })
    const old = getSnippet(KEY, 'en', { orderNumber: '5 €' }, new Date('2025-06-01T00:00:00Z'))
    expect(old).toMatchObject({ version: '1', text: 'nur DE 5 €', origin: 'lawyer' })
    expect(old.sha256).toMatch(/^[0-9a-f]{64}$/)
    // ohne Treffer zu `at` und mit Speicherstand → Rückfall auf Arbeitsfassung
    expect(
      getSnippet(KEY, 'de', { orderNumber: '1' }, new Date('2000-01-01T00:00:00Z')).version,
    ).toBe('draft-1')
    expect(getSnippet('price.tattooNote', 'de').version).toBe('draft-1')
  })

  it('mit `req` wird der Speicherstand nicht übernommen', async () => {
    const payload = fakePayload([doc({})])
    await loadLegalSnippets(payload, { req: {} as never })
    expect(getSnippet(KEY, 'de', { orderNumber: '1' }).version).toBe('draft-1')
  })

  it('veralteter Stand wird im Hintergrund neu gelesen (einmal), Fehler nur protokolliert', async () => {
    const payload = fakePayload([doc({})])
    await loadLegalSnippets(payload)
    expect(payload.find).toHaveBeenCalledTimes(1)
    getSnippet(KEY, 'de', { orderNumber: '1' })
    expect(payload.find).toHaveBeenCalledTimes(1)
    invalidateLegalSnippets()
    getSnippet(KEY, 'de', { orderNumber: '1' })
    getSnippet(KEY, 'de', { orderNumber: '1' })
    expect(payload.find).toHaveBeenCalledTimes(2)
    await new Promise((r) => setTimeout(r, 0))
    clock += SNIPPET_CACHE_TTL_MS + 1
    payload.find.mockRejectedValueOnce(new Error('weg'))
    getSnippet(KEY, 'de', { orderNumber: '1' })
    await new Promise((r) => setTimeout(r, 0))
    expect(payload.find).toHaveBeenCalledTimes(3)
    invalidateLegalSnippets()
    resetLegalSnippetCache()
    invalidateLegalSnippets()
  })

  it('Start: Fehler (Tabelle fehlt) werden nur protokolliert', async () => {
    await expect(
      initLegalSnippets(fakePayload(new Error('Tabelle fehlt'))),
    ).resolves.toBeUndefined()
    await initLegalSnippets(fakePayload([doc({})]))
    expect(getSnippet(KEY, 'de', { orderNumber: '1' }).version).toBe('1')
  })
})
