import { createTranslator } from 'next-intl'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'

// P18.5: Der Dialog „Widerrufsbelehrung“ an der Kasse enthält wie R24 das Muster-Widerrufsformular (eigener Abschnitt),
// den PDF-Download und einen Link auf die ganze Seite; die Belehrung verweist auf das Formular „im Abschnitt darunter
// und als PDF-Download“ (R-095, Art. 246a § 1 Abs. 2 EGBGB). Datenquelle und Rich-Text sind hier ersetzt.

type View = { state: 'ok' | 'unavailable'; type: string; hasPdf?: boolean; germanOnly?: boolean }
const views = vi.hoisted(() => ({ form: null as View | null }))

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: 'de' | 'en'; namespace: string }) =>
    createTranslator({
      locale,
      messages: locale === 'de' ? de : en,
      namespace: namespace as never,
    }),
}))
vi.mock('@/lib/data/legal', () => ({
  getLegalText: async (type: string) =>
    type === 'widerrufsformular'
      ? views.form
      : { state: 'ok', type, hasPdf: true, germanOnly: false, content: { type } },
}))
vi.mock('@/components/content/RichTextContent', () => ({
  RichTextContent: ({ data }: { data: { type?: string } }) =>
    React.createElement('div', { 'data-rich': data?.type ?? 'form' }),
}))
vi.mock('@/lib/legal/snippets', () => ({
  getSnippet: (key: string) => ({
    text:
      key === 'checkout.legalNotice'
        ? 'Es gelten unsere AGB. Hier findest du die Widerrufsbelehrung und die Datenschutzerklärung.'
        : 'Rücksendekosten trägst du.',
  }),
}))

const { LegalNotice } = await import('@/components/checkout/LegalNotice')

async function html(locale: 'de' | 'en') {
  return renderToStaticMarkup(await LegalNotice({ locale }))
}

/** Inhalt des Dialogs eines Typs (bis zum schließenden `</dialog>`). */
const dialogOf = (markup: string, type: string) => {
  const start = markup.indexOf(`data-legal-dialog-panel="${type}"`)
  expect(start, type).toBeGreaterThan(-1)
  return markup.slice(start, markup.indexOf('</dialog>', start))
}

describe('Kasse: Dialog „Widerrufsbelehrung“ mit Muster-Widerrufsformular (P18.5)', () => {
  beforeEach(() => {
    views.form = {
      state: 'ok',
      type: 'widerrufsformular',
      hasPdf: true,
      germanOnly: false,
      content: { type: 'widerrufsformular' },
    } as View
  })

  it('DE: Formular als eigener Abschnitt unter der Belehrung, PDF als Download, Link auf R24 im neuen Tab', async () => {
    const dialog = dialogOf(await html('de'), 'widerrufsbelehrung')
    const belehrung = dialog.indexOf('data-rich="widerrufsbelehrung"')
    const form = dialog.indexOf('data-legal-dialog-form="widerrufsformular"')
    expect(belehrung).toBeGreaterThan(-1)
    expect(form).toBeGreaterThan(belehrung)
    expect(dialog).toContain('aria-label="Muster-Widerrufsformular"')
    expect(dialog).toContain('data-rich="widerrufsformular"')
    expect(dialog).toMatch(
      /<a href="\/api\/legal\/widerrufsformular\.pdf\?locale=de"[^>]*download=""[^>]*>Muster-Widerrufsformular als PDF herunterladen<\/a>/,
    )
    expect(dialog).toMatch(
      /<a href="\/de\/widerrufsbelehrung"[^>]*target="_blank" rel="noopener"[^>]*>Widerrufsbelehrung und Formular als eigene Seite öffnen \(neuer Tab\)<\/a>/,
    )
  })

  it('EN: englische Beschriftungen und Pfade', async () => {
    const dialog = dialogOf(await html('en'), 'widerrufsbelehrung')
    expect(dialog).toContain('aria-label="Model withdrawal form"')
    expect(dialog).toContain('/api/legal/widerrufsformular.pdf?locale=en')
    expect(dialog).toContain('Download the model withdrawal form as PDF')
    expect(dialog).toContain('href="/en/right-of-withdrawal"')
  })

  it('nur im Dialog der Widerrufsbelehrung, nicht bei AGB und Datenschutz', async () => {
    const markup = await html('de')
    for (const type of ['agb', 'datenschutz'])
      expect(dialogOf(markup, type), type).not.toContain('data-legal-dialog-form')
    expect(markup.match(/data-legal-dialog-form=/g)).toHaveLength(1)
  })

  it('ohne darstellbares Formular: Hinweis und Link auf die Seite statt eines leeren Abschnitts', async () => {
    views.form = { state: 'unavailable', type: 'widerrufsformular' }
    const dialog = dialogOf(await html('de'), 'widerrufsbelehrung')
    expect(dialog).toContain('Das Muster-Widerrufsformular ist gerade nicht verfügbar.')
    expect(dialog).not.toContain('widerrufsformular.pdf')
    expect(dialog).toContain('href="/de/widerrufsbelehrung"')
  })
})
