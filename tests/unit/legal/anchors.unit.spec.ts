import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { anchorAssigner, PRIVACY_ANCHORS, privacyAnchorFor } from '@/lib/legal/anchors'

// P6.5: Anker-IDs der Datenschutzerklärung (KANZLEI-BRIEFING §11.10) aus den Überschriften der Platzhalter-Gliederung.

type Base = { legalTexts: { type: string; sections: { heading: string }[] }[] }
const base = JSON.parse(readFileSync(path.resolve('content/seed/data/base.json'), 'utf8')) as Base

describe('Anker der Datenschutzerklärung', () => {
  it('jede Überschrift der Platzhalter-Gliederung bekommt genau ihren Anker (alle 19, in Reihenfolge)', () => {
    const headings = base.legalTexts.find((t) => t.type === 'datenschutz')!.sections
    const assign = anchorAssigner(privacyAnchorFor)
    expect(headings.map((s) => assign(s.heading, 'h2'))).toEqual([...PRIVACY_ANCHORS])
  })

  it('englische Überschriften, nur h2, keine doppelten IDs', () => {
    expect(privacyAnchorFor('Your rights')).toBe('rechte')
    expect(privacyAnchorFor('Transfers to third countries')).toBe('drittland')
    expect(privacyAnchorFor('Right to lodge a complaint')).toBe('beschwerde')
    expect(privacyAnchorFor('Processing of your order')).toBe('bestellung')
    const assign = anchorAssigner(privacyAnchorFor)
    expect(assign('Hosting', 'h3')).toBeUndefined()
    expect(assign('Hosting', 'h2')).toBe('hosting')
    expect(assign('Hosting (Fortsetzung)', 'h2')).toBeUndefined()
  })
})
