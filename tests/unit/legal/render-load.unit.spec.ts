import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const snippet = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('@/lib/env', () => ({ getEnv: () => ({ NEXT_PUBLIC_SITE_URL: 'https://example.test/' }) }))
vi.mock('@/lib/legal/snippets', () => ({ getSnippet: (...a: unknown[]) => snippet.fn(...a) }))
vi.mock('@/lib/payload/localReq', () => ({
  preservingReq: async (_req: unknown, fn: () => unknown) => fn(),
}))

import {
  activeReturnCostsNote,
  buildLegalTokenValues,
  legalPlainText,
  LegalRenderError,
  loadLegalTokenValues,
  renderLegalContent,
  type LexicalContent,
} from '@/lib/legal/render'

const para = (...texts: string[]): LexicalContent => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', children: texts.map((text) => ({ type: 'text', text })) }],
  },
})

describe('R-012 Renderer: Werte laden, Klartext, Mehrzeiler (Zweige)', () => {
  beforeEach(() => snippet.fn.mockReset())

  it('Baustein-Rückfall: Text oder null bei Fehler', () => {
    snippet.fn.mockReturnValueOnce({ text: 'Rücksendekosten trägst du.' })
    expect(activeReturnCostsNote('de')).toBe('Rücksendekosten trägst du.')
    snippet.fn.mockImplementationOnce(() => {
      throw new Error('nicht darstellbar')
    })
    expect(activeReturnCostsNote('en')).toBeNull()
  })

  it('Werte laden: Hinweis aus Aufruf oder aktivem Baustein; Website ohne Schrägstrich', async () => {
    const findGlobal = vi.fn(async () => ({
      business: { legalName: 'Jutta', tradeName: 'Planet Claire' },
      payment: { prepaymentDays: 7 },
    }))
    const req = { payload: { findGlobal } } as unknown as PayloadRequest
    snippet.fn.mockReturnValue({ text: 'aus Baustein' })
    const a = await loadLegalTokenValues(req, 'de')
    expect(a).toMatchObject({
      name: 'Jutta, Planet Claire',
      siteUrl: 'https://example.test',
      vorkasseDays: '7',
      returnCostsNote: 'aus Baustein',
    })
    const b = await loadLegalTokenValues(req, 'en', { returnCostsNote: null })
    expect(b.returnCostsNote).toBeNull()
    const c = await loadLegalTokenValues(req, 'de', { returnCostsNote: 'explizit' })
    expect(c.returnCostsNote).toBe('explizit')
  })

  it('Werte ohne Einstellungen und ohne Website-Adresse', () => {
    const v = buildLegalTokenValues({ settings: {}, siteUrl: '', locale: 'de' })
    expect(v).toMatchObject({
      name: undefined,
      wIdNr: '',
      ustIdNr: '',
      withdrawalUrl: undefined,
      vorkasseDays: undefined,
    })
    const only = buildLegalTokenValues({
      settings: { business: { legalName: 'Jutta' } },
      siteUrl: 'https://x.test',
      locale: 'de',
    })
    expect(only.name).toBe('Jutta')
  })

  it('Klartext: leer, Zeilenumbruch, Überschrift, Liste; Mehrzeiler werden Umbrüche', () => {
    expect(legalPlainText(null)).toBe('')
    expect(legalPlainText(undefined)).toBe('')
    const doc: LexicalContent = {
      root: {
        type: 'root',
        children: [
          { type: 'heading', children: [{ type: 'text', text: 'Titel' }] },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'a' },
              { type: 'linebreak' },
              { type: 'text', text: 'b' },
            ],
          },
          {
            type: 'list',
            children: [{ type: 'listitem', children: [{ type: 'text', text: 'Punkt' }] }],
          },
          { type: 'horizontalrule' },
          { type: 'paragraph' },
        ],
      },
    }
    expect(legalPlainText(doc)).toBe('Titel\na\nb\nPunkt')
    const r = renderLegalContent(para('Tabelle:\n{{name}}\n\nEnde'), { name: 'X' })
    expect(r.plainText).toBe('Tabelle:\nX\n\nEnde')
    const lines = renderLegalContent(para('{{shippingTable}}'), {
      shippingTable: 'Zeile 1\nZeile 2',
    })
    expect(lines.plainText).toBe('Zeile 1\nZeile 2')
    expect(() => renderLegalContent(para('{{xyz}} und {{name}}'), {})).toThrow(LegalRenderError)
    expect(() => renderLegalContent(para('offen {{'), {})).toThrow(/Klammern/)
  })
})
