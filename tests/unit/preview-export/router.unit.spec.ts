// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BEHAVIOR_NAMES } from '../../../src/behaviors'
import { groupRoutes, fillTemplate } from '../../../src/preview-runtime/banner'
import { STATIC_BEHAVIORS } from '../../../src/preview-runtime/main'
import {
  createRouter,
  parseHash,
  selectTemplate,
  type Router,
} from '../../../src/preview-runtime/router'

describe('Vorschau-Laufzeit: Hash-Router (KONZEPT §12.5 Nr. 6, ARCHITEKTUR §14.6)', () => {
  it('zerlegt Hash in Route (mit Query) und Anker; leer → /de', () => {
    expect(parseHash('')).toEqual({ route: '/de', anchor: '' })
    expect(parseHash('#')).toEqual({ route: '/de', anchor: '' })
    expect(parseHash('#/de/shop?available=1')).toEqual({
      route: '/de/shop?available=1',
      anchor: '',
    })
    expect(parseHash('#/de/tattoo/flash#f-012')).toEqual({
      route: '/de/tattoo/flash',
      anchor: 'f-012',
    })
    expect(parseHash('#/en/')).toEqual({ route: '/en', anchor: '' })
  })

  it('unbekannte Route → 404 der Sprache; Zusatzseiten in der aktuellen Sprache', () => {
    const t = [
      { route: '/de', lang: 'de' },
      { route: '/de/__404', lang: 'de' },
      { route: '/en/__404', lang: 'en' },
      { route: '/vorschau/verwaltung', lang: 'de' },
      { route: '/vorschau/verwaltung', lang: 'en' },
    ]
    expect(selectTemplate(t, '/en/gibts-nicht', 'de')).toMatchObject({
      template: { route: '/en/__404' },
      lang: 'en',
      found: false,
    })
    expect(selectTemplate(t, '/vorschau/verwaltung', 'en')).toMatchObject({
      template: { lang: 'en' },
      lang: 'en',
    })
    expect(selectTemplate(t, '/de', 'en')).toMatchObject({ lang: 'de', found: true })
  })

  describe('createRouter', () => {
    let router: Router | null = null
    afterEach(() => {
      router?.destroy()
      router = null
      document.body.innerHTML = ''
      window.location.hash = ''
    })

    const setup = () => {
      document.body.innerHTML = `
        <div id="pv-root"></div>
        <template data-route="/de" data-lang="de" data-title="Start" data-leash-key="R01" data-body='{"data-preset":"journey","data-route":"R01"}'><main><h1>Planet Claire</h1><div data-behavior="menu"></div></main></template>
        <template data-route="/en" data-lang="en" data-title="Home" data-leash-key="R01" data-body='{"data-preset":"journey"}'><main><h1>Planet Claire EN</h1><p id="kontakt">k</p></main></template>
        <template data-route="/de/__404" data-lang="de" data-title="404" data-leash-key="R28" data-body='{"data-preset":"lost","data-route":"R28"}'><main><h1>Weg</h1></main></template>`
      const root = document.getElementById('pv-root')!
      const mounts: string[] = []
      const cleanups: string[] = []
      const langs: string[] = []
      window.scrollTo = vi.fn()
      router = createRouter({
        doc: document,
        root,
        onLang: (l) => langs.push(l),
        onMount: (_r, info) => {
          mounts.push(`${info.route}:${info.leashKey}`)
          return () => cleanups.push(info.route)
        },
      })
      return { root, mounts, cleanups, langs }
    }

    it('leerer Hash → #/de, Template geklont, Titel, lang und <body>-Attribute gesetzt', () => {
      const { root, mounts } = setup()
      router!.start()
      expect(window.location.hash).toBe('#/de')
      expect(root.querySelector('h1')!.textContent).toBe('Planet Claire')
      expect(document.title).toBe('Start')
      expect(document.documentElement.lang).toBe('de')
      expect(document.body.getAttribute('data-preset')).toBe('journey')
      expect(document.body.getAttribute('data-route')).toBe('R01')
      expect(mounts).toEqual(['/de:R01'])
    })

    it('Wechsel: alte Seite aufräumen, neue einhängen, Fokus auf H1, alte <body>-Attribute weg', () => {
      const { root, mounts, cleanups, langs } = setup()
      router!.start()
      window.location.hash = '#/en'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      expect(cleanups).toEqual(['/de'])
      expect(mounts).toEqual(['/de:R01', '/en:R01'])
      expect(document.documentElement.lang).toBe('en')
      expect(document.body.hasAttribute('data-route')).toBe(false)
      const h1 = root.querySelector('h1')!
      expect(h1.getAttribute('tabindex')).toBe('-1')
      expect(document.activeElement).toBe(h1)
      expect(langs).toEqual(['de', 'en'])
    })

    it('unbekannte Route → 404-Template, Anker auf derselben Seite hängt nicht neu ein', () => {
      const { root, mounts } = setup()
      window.location.hash = '#/de/gibts-nicht'
      router!.start()
      expect(root.querySelector('h1')!.textContent).toBe('Weg')
      expect(mounts).toEqual(['/de/gibts-nicht:R28'])
      window.location.hash = '#/de/gibts-nicht#oben'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      expect(mounts).toHaveLength(1)
    })
  })
})

describe('Vorschau-Laufzeit: Banner', () => {
  it('Gruppen in fester Reihenfolge, nur die aktuelle Sprache', () => {
    const groups = groupRoutes(
      [
        { route: '/de/impressum', lang: 'de', title: 'Impressum', group: 'legal', built: true },
        { route: '/de', lang: 'de', title: 'Start', group: 'start', built: true },
        { route: '/en', lang: 'en', title: 'Home', group: 'start', built: true },
        { route: '/de/shop', lang: 'de', title: 'Shop', group: 'shop', built: false },
      ],
      'de',
    )
    expect(groups.map(([g, r]) => `${g}:${r.length}`)).toEqual(['start:1', 'shop:1', 'legal:1'])
    expect(fillTemplate('Stand {date}, Phase {phase}.', { date: '28.09.2026', phase: 'P2' })).toBe(
      'Stand 28.09.2026, Phase P2.',
    )
  })
})

describe('Vorschau-Laufzeit: statisches Register', () => {
  it('enthält jedes Verhaltensmodul (keine dynamischen Importe in der Einzeldatei)', () => {
    expect(Object.keys(STATIC_BEHAVIORS).sort()).toEqual([...BEHAVIOR_NAMES].sort())
  })
})
