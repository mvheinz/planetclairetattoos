import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  displayPhase,
  normalizePhase,
  phaseFromPlan,
  resolvePhase,
} from '../../../scripts/preview-export/phase'

const plan = (p1: boolean, p2: boolean, p10 = false) => `# PLAN

## Überblick
- [ ] kein Phasen-Häkchen

## P0 – Fundament
- [x] **P0.1 Gerüst**

## P1 – Datenmodell
### Aufgaben
- [${p1 ? 'x' : ' '}] **P1.1 Collections**
### Phasen-Abnahme
- [${p1 ? 'x' : ' '}] CI grün

## P2 – Designsystem
- [${p2 ? 'x' : ' '}] **P2.1 Tokens**

## P10 – Qualität
- [${p10 ? 'x' : ' '}] **P10.1 Prüfung**

## P11 – Go-live
- [ ] **P11.1 Start**
`

describe('Vorschau-Export: Phasen-Kennung (ARCHITEKTUR §14.9)', () => {
  it('Plan mit abgehakter P1 → p1', () => {
    expect(phaseFromPlan(plan(true, false))).toBe('p1')
  })

  it('P1 offen → p0; P1–P10 abgehakt → p10 (P11 bleibt offen)', () => {
    expect(phaseFromPlan(plan(false, false))).toBe('p0')
    expect(phaseFromPlan(plan(true, true, true))).toBe('p10')
  })

  it('offenes „CI grün“ hält die Phase offen', () => {
    expect(phaseFromPlan(plan(true, false).replace('- [x] CI grün', '- [ ] CI grün'))).toBe('p0')
  })

  it('PREVIEW_PHASE (aus CI) hat Vorrang, sonst PLAN.md, sonst px – nie der Branch-Name', () => {
    expect(resolvePhase({ env: 'P3', plan: plan(true, false) })).toBe('p3')
    expect(resolvePhase({ env: '', plan: plan(true, false) })).toBe('p1')
    expect(resolvePhase({ env: 'claude/relaxed-goodall-extssm', plan: null })).toBe('px')
    expect(resolvePhase({ env: undefined, plan: 'kein Plan' })).toBe('px')
    expect(normalizePhase(' p12 ')).toBe('p12')
    expect(normalizePhase('phase2')).toBeNull()
    expect(displayPhase('p3')).toBe('P3')
  })

  it('liest die echte PLAN.md', () => {
    expect(phaseFromPlan(readFileSync('PLAN.md', 'utf8'))).toMatch(/^p\d{1,2}$/)
  })
})

describe('Vorschau-Export: Verwaltungs-Ansichten je Phase (ARCHITEKTUR §14.7)', () => {
  it('KONZEPT §7.3–§7.15 vollständig; in P2 nur Anmeldung, Liste und Formular', async () => {
    const { ADMIN_VIEWS } = await import('../../../scripts/preview-export/adminViews')
    const { viewsToCapture } = await import('../../../scripts/preview-export/adminShots')
    const refs = ADMIN_VIEWS.map((v) => v.ref)
    for (let i = 3; i <= 15; i++) expect(refs).toContain(`KONZEPT §7.${i}`)
    expect(new Set(ADMIN_VIEWS.map((v) => v.key)).size).toBe(ADMIN_VIEWS.length)
    expect(viewsToCapture(ADMIN_VIEWS, 'p2').map((v) => v.key)).toEqual([
      'login',
      'products-list',
      'products-form',
    ])
    expect(viewsToCapture(ADMIN_VIEWS, 'px').map((v) => v.key)).toHaveLength(3)
    expect(viewsToCapture(ADMIN_VIEWS, 'p4').some((v) => v.key === 'heute')).toBe(true)
    expect(viewsToCapture(ADMIN_VIEWS, 'p5').some((v) => v.key === 'tattoo')).toBe(false)
    // P5: alle Registry-Ansichten der Phase 5 samt Einstellungs-Unterseiten, ohne Detailansichten mit ID
    const p5 = viewsToCapture(ADMIN_VIEWS, 'p5').map((v) => v.key)
    for (const key of [
      'heute',
      'export',
      'versand',
      'system',
      'umsatz-waechter',
      'produktsicherheit',
    ])
      expect(p5).toContain(key)
    expect(p5).not.toContain('bestellung')
  })
})
