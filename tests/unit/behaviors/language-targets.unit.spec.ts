// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { mount, syncLanguageTargets } from '@/behaviors/language-targets'

// P13.8 (U-47): Auf Kategorie- und Stückseiten (Slug je Sprache verschieden) setzt das Modul das Ziel der Sprachlinks
// („DE | EN“ in der Kopfleiste, Umschalter im Fuß) aus den hreflang-Alternativen der Seite.

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
})

const BODY = `
  <header><a href="/en" hreflang="en" data-header-language="">DE | EN</a></header>
  <article data-behavior="language-targets"></article>
  <footer><ul data-language-switcher=""><li lang="en"><a href="/en" hreflang="en">English</a></li></ul></footer>`

describe('U-47 Sprachlinks aus den hreflang-Alternativen', () => {
  it('Kopf und Fuß bekommen das Gegenstück des Stücks; ohne Alternativen bleibt das Ziel', () => {
    document.body.innerHTML = BODY
    expect(syncLanguageTargets(document)).toBe(0)
    expect(document.querySelector('[data-header-language]')!.getAttribute('href')).toBe('/en')
    document.head.innerHTML = `
      <link rel="alternate" hreflang="de" href="https://planetclairetattoos.com/de/shop/901-schale-langohr-wuschel">
      <link rel="alternate" hreflang="en" href="https://planetclairetattoos.com/en/shop/901-bowl-long-ears-fluff">`
    expect(syncLanguageTargets(document)).toBe(2)
    expect(document.querySelector('[data-header-language]')!.getAttribute('href')).toBe(
      '/en/shop/901-bowl-long-ears-fluff',
    )
    expect(document.querySelector('footer a[hreflang="en"]')!.getAttribute('href')).toBe(
      '/en/shop/901-bowl-long-ears-fluff',
    )
    expect(syncLanguageTargets(document)).toBe(0)
  })

  it('mount gleicht in der App ab, in der Vorschau-Datei nicht', () => {
    document.head.innerHTML = `<link rel="alternate" hreflang="en" href="https://planetclairetattoos.com/en/shop/category/ceramics">`
    document.body.innerHTML = BODY
    const root = document.querySelector('[data-behavior="language-targets"]')!
    mount(root, { mode: 'preview' })()
    expect(document.querySelector('[data-header-language]')!.getAttribute('href')).toBe('/en')
    mount(root, { mode: 'app' })()
    expect(document.querySelector('[data-header-language]')!.getAttribute('href')).toBe(
      '/en/shop/category/ceramics',
    )
  })
})
