import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WithdrawalView, type WithdrawalViewFlow } from '@/components/legal/WithdrawalView'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { WithdrawalFlowState, WithdrawalFormValues } from '@/lib/legal/withdrawalForm'

// R-091/R-092 Widerrufsfunktion R26: Stücke nur im Freitext genannt und keins angehakt → neutraler Hinweis (DE/EN) in
// der Auswahl und in Schritt 2, Zusammenfassung „Stücke aus deiner Angabe“ statt „Ganzer Vertrag“ (so wird gebucht);
// nichts vorab angehakt (V-03), der Bestätigungsknopf bleibt frei.

const flow = (locale: 'de' | 'en'): WithdrawalViewFlow => ({
  locale,
  messages: (locale === 'de' ? de : en).withdraw,
  confirmLabel: locale === 'de' ? 'Widerruf bestätigen' : 'Confirm withdrawal',
  privacyHref: `/${locale}/datenschutz#widerruf`,
  contactEmail: null,
})

const values = (itemsText: string): WithdrawalFormValues => ({
  name: 'Erika Beispiel',
  contractIdentification: 'PC-2026-00017',
  email: 'erika@example.test',
  itemsText,
  reason: '',
})

const html = (part: 'pre' | 'form', state: WithdrawalFlowState, locale: 'de' | 'en' = 'de') =>
  renderToStaticMarkup(<WithdrawalView part={part} state={state} flow={flow(locale)} />)
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

const select = (itemsText: string): WithdrawalFlowState => ({
  step: 'select',
  rev: 1,
  token: 't',
  values: values(itemsText),
  choices: [
    { id: 'a', label: 'Nr. 017 · Tasse' },
    { id: 'b', label: 'Nr. 018 · Schale' },
  ],
  selected: [],
})

const confirm = (
  itemsText: string,
  selectedLabels: string[] = [],
  matched = true,
): WithdrawalFlowState => ({
  step: 'confirm',
  rev: 2,
  token: 't',
  values: values(itemsText),
  selectedLabels,
  matched,
})

describe('R-091 Widerruf: Stücke nur im Freitext', () => {
  it.each(['de', 'en'] as const)(
    'R-091 Auswahl (%s): mit Freitext Hinweis aufs Anhaken statt „ganzer Vertrag“, nichts angehakt',
    (locale) => {
      const m = (locale === 'de' ? de : en).withdraw
      const withText = html('form', select('nur die Tasse'), locale)
      expect(withText).toContain('data-withdraw-from-text')
      expect(withText).toContain(m.selectFromText)
      expect(withText).not.toContain('data-withdraw-whole')
      expect(withText).not.toMatch(/\bchecked\b/)
      const without = html('form', select('  '), locale)
      expect(without).toContain('data-withdraw-whole')
      expect(without).toContain(m.selectWhole)
      expect(without).not.toContain('data-withdraw-from-text')
    },
  )

  it.each(['de', 'en'] as const)(
    'R-092 Schritt 2 (%s): Hinweis und Zusammenfassung wie gebucht; Knopf frei',
    (locale) => {
      const m = (locale === 'de' ? de : en).withdraw
      const pre = html('pre', confirm('nur die Tasse'), locale)
      expect(pre).toContain('data-withdraw-items-hint')
      expect(pre).toContain(m.confirmFromText)
      expect(pre).toContain(m.summaryFromText)
      expect(pre).not.toContain(m.summaryWhole)
      expect(pre).toContain('nur die Tasse')
      const form = html('form', confirm('nur die Tasse'), locale)
      expect(form).toContain('value="confirm"')
      expect(form).not.toMatch(/\bdisabled\b/)

      // ohne Freitext: ganzer Vertrag, kein Hinweis
      const whole = html('pre', confirm(''), locale)
      expect(whole).toContain(m.summaryWhole)
      expect(whole).not.toContain('data-withdraw-items-hint')
      // angehakt (Freitext zusätzlich): die angehakten Stücke, kein Hinweis
      const ticked = html('pre', confirm('nur die Tasse', ['Nr. 017 · Tasse']), locale)
      expect(ticked).toContain('<li>Nr. 017 · Tasse</li>')
      expect(ticked).not.toContain('data-withdraw-items-hint')
      // keine Bestellung gefunden (keine Auswahl möglich): kein Hinweis, keine Zeile „Widerrufene Stücke“
      const unmatched = html('pre', confirm('nur die Tasse', [], false), locale)
      expect(unmatched).not.toContain('data-withdraw-items-hint')
      expect(unmatched).not.toContain(m.summaryItems)
    },
  )

  it('DE/EN: dieselben Schlüssel, Texte ohne Druck und ohne „ganzer Vertrag“ beim Freitext', () => {
    for (const key of ['selectFromText', 'summaryFromText', 'confirmFromText'] as const) {
      expect(de.withdraw[key].length, key).toBeGreaterThan(10)
      expect(en.withdraw[key].length, key).toBeGreaterThan(10)
    }
    expect(de.withdraw.confirmFromText).not.toMatch(/ganze[nr]? Vertrag/)
    expect(en.withdraw.confirmFromText).not.toMatch(/whole contract/)
  })
})
