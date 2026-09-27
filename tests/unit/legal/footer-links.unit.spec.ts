import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CONFORMITY_ROUTE,
  LEGAL_LINKS,
  MENU_MAIN,
  WITHDRAWAL_ROUTE,
} from '@/components/layout/navItems'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import { getRoute } from '@/lib/routes/paths'

// P2.10 Fußbereich: Pflichtlinks (R-011) und „Vertrag widerrufen“ (R-090) als Konstanten DE/EN.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

describe('R-090 „Vertrag widerrufen“', () => {
  it('R-090 Wortlaut DE/EN exakt (Konstante aus src/lib/legal/constants.ts)', () => {
    expect(WITHDRAWAL_LINK_LABEL).toEqual({
      de: 'Vertrag widerrufen',
      en: 'Withdraw from contract here',
    })
    expect(Object.isFrozen(WITHDRAWAL_LINK_LABEL)).toBe(true)
  })

  it('R-090 Ziel ist R26: /de/vertrag-widerrufen bzw. /en/withdraw-from-contract', () => {
    expect(WITHDRAWAL_ROUTE).toBe('R26')
    expect(localizedPath(WITHDRAWAL_ROUTE, 'de')).toBe('/de/vertrag-widerrufen')
    expect(localizedPath(WITHDRAWAL_ROUTE, 'en')).toBe('/en/withdraw-from-contract')
    expect(getRoute('R26').status).toBe('live')
  })

  it('R-090 Fuß- und Menü-Link nutzen die Konstante (kein freier Text), Routentitel stimmt überein', () => {
    for (const file of [
      'src/components/layout/LegalFooter.tsx',
      'src/components/layout/MenuOverlay.tsx',
    ]) {
      expect(read(file), file).toContain('WITHDRAWAL_LINK_LABEL[locale]')
    }
    expect(de.common.routes.R26).toBe(WITHDRAWAL_LINK_LABEL.de)
    expect(en.common.routes.R26).toBe(WITHDRAWAL_LINK_LABEL.en)
  })
})

describe('R-011 Pflichtlinks', () => {
  it('R-011 Impressum, Datenschutz, AGB, Widerrufsbelehrung, Versand & Zahlung, Kontakt – alle live', () => {
    expect(LEGAL_LINKS).toEqual(['R21', 'R22', 'R23', 'R24', 'R25', 'R20'])
    expect(LEGAL_LINKS.map((id) => localizedPath(id, 'de'))).toEqual([
      '/de/impressum',
      '/de/datenschutz',
      '/de/agb',
      '/de/widerrufsbelehrung',
      '/de/versand-und-zahlung',
      '/de/kontakt',
    ])
    expect(LEGAL_LINKS.map((id) => localizedPath(id, 'en'))).toEqual([
      '/en/legal-notice',
      '/en/privacy',
      '/en/terms',
      '/en/right-of-withdrawal',
      '/en/shipping-and-payment',
      '/en/contact',
    ])
    for (const id of [...LEGAL_LINKS, CONFORMITY_ROUTE]) expect(getRoute(id).status).toBe('live')
    expect(MENU_MAIN).toEqual(['R01', 'R02', 'R05', 'R10', 'R11', 'R19', 'R20'])
  })

  it('R-011 LegalFooter ist Server-HTML ohne Client-Code und ohne Animation', () => {
    const src = read('src/components/layout/LegalFooter.tsx')
    expect(src).not.toMatch(/['"]use client['"]/)
    const css = read('src/components/layout/SiteFooter.module.css')
    expect(css).not.toMatch(/transition|animation|@keyframes/)
  })
})
