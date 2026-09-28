import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import config from '../../../playwright.visual.config'

// P2.24 Visuelle Regression (ARCHITEKTUR §7.6, T-12): Rahmen der Konfiguration. Die Bilder selbst entstehen nur in CI.

describe('T-12 playwright.visual.config.ts', () => {
  it('Chromium desktop 1440×900 und mobile 390×844, reduzierte Bewegung, maxDiffPixelRatio 0,01', () => {
    const projects = Object.fromEntries(config.projects!.map((p) => [p.name, p.use!]))
    expect(Object.keys(projects)).toEqual(['desktop', 'mobile'])
    expect(projects.desktop!.viewport).toEqual({ width: 1440, height: 900 })
    expect(projects.mobile!.viewport).toEqual({ width: 390, height: 844 })
    for (const p of config.projects!)
      expect(p.use!.browserName ?? p.use!.defaultBrowserType, p.name).toBe('chromium')
    expect(config.use!.contextOptions).toMatchObject({ reducedMotion: 'reduce' })
    expect(config.expect!.toHaveScreenshot).toMatchObject({ maxDiffPixelRatio: 0.01 })
  })

  it('Referenzen je Plattform unter tests/visual/__screenshots__ (nur *-linux.png), Specs *.visual.spec.ts', () => {
    expect(config.testDir).toBe('./tests/visual')
    expect(config.testMatch).toBe('**/*.visual.spec.ts')
    expect(config.snapshotPathTemplate).toMatch(
      /^\{testDir\}\/__screenshots__\/.*-\{platform\}\{ext\}$/,
    )
    expect(readFileSync('tests/visual/helpers.ts', 'utf8')).toMatch(/process\.platform !== 'linux'/)
  })

  it('Umfang P2: R01, Impressum, R26, 404, 500, Kopf, offenes Menü, Fuß; feste Uhr und Schriften', () => {
    const pages = readFileSync('tests/visual/pages.visual.spec.ts', 'utf8')
    for (const id of ['R01', 'R21', 'R26']) expect(pages).toContain(`localizedPath('${id}'`)
    expect(pages).toMatch(/status: 404/)
    expect(pages).toMatch(/__fehler-test/)
    const shell = readFileSync('tests/visual/shell.visual.spec.ts', 'utf8')
    for (const name of ['kopf.png', 'menue-offen.png', 'fuss.png']) expect(shell).toContain(name)
    const helpers = readFileSync('tests/visual/helpers.ts', 'utf8')
    expect(helpers).toMatch(/clock\.setFixedTime/)
    expect(helpers).toMatch(/document\.fonts\.ready/)
  })
})
