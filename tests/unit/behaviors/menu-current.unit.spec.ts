// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { mount, syncCurrentPage } from '@/behaviors/menu'

// Das Menü (KO-03) steht als statisches, nicht hydriertes HTML im Dialog (P7, TBT). Was von der aktuellen Seite abhängt,
// setzt das Modul `menu`: `aria-current="page"` am Hauptlink der Route aus `<body data-route>` und das Ziel des
// Sprachlinks aus dem Sprachumschalter im Fuß.

const MENU = `
  <a href="#fussnavigation" aria-controls="menu" data-menu-trigger="">Menü</a>
  <dialog id="menu" data-behavior="menu">
    <ul>
      <li data-menu-item=""><a href="/de" data-route-id="R01" data-menu-close="">Start</a></li>
      <li data-menu-item=""><a href="/de/shop" data-route-id="R02" data-menu-close="">Shop</a></li>
    </ul>
    <ul data-language-switcher=""><li lang="de"><span aria-current="true">Deutsch</span></li>
      <li lang="en"><a href="/en" hreflang="en">English</a></li></ul>
  </dialog>
  <footer><ul data-language-switcher=""><li lang="en"><a href="/en/shop" hreflang="en">English</a></li></ul></footer>`

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('data-route')
})

describe('Menü: aktuelle Seite im statischen Menü (KO-03, P7)', () => {
  it('KO-03 aria-current="page" am Hauptlink der aktuellen Route, Sprachlink wie im Fuß', () => {
    document.body.setAttribute('data-route', 'R02')
    document.body.innerHTML = MENU
    const dialog = document.getElementById('menu')!
    syncCurrentPage(dialog)
    expect(dialog.querySelector('[data-route-id="R02"]')!.getAttribute('aria-current')).toBe('page')
    expect(dialog.querySelector('[data-route-id="R01"]')!.hasAttribute('aria-current')).toBe(false)
    expect(dialog.querySelector('a[hreflang="en"]')!.getAttribute('href')).toBe('/en/shop')
  })

  it('KO-03 ohne Registry-Route (404) kein aria-current; ohne Fuß-Umschalter bleibt die Startseite', () => {
    document.body.setAttribute('data-route', 'R28')
    document.body.innerHTML = MENU
    document.querySelector('footer')!.remove()
    const dialog = document.getElementById('menu')!
    syncCurrentPage(dialog)
    expect(dialog.querySelectorAll('[aria-current="page"]')).toHaveLength(0)
    expect(dialog.querySelector('a[hreflang="en"]')!.getAttribute('href')).toBe('/en')
  })

  it('KO-03 mount gleicht ab und jedes Öffnen gleicht erneut ab (Route geändert)', () => {
    document.body.setAttribute('data-route', 'R01')
    document.body.innerHTML = MENU
    const dialog = document.getElementById('menu')!
    const unmount = mount(dialog)
    expect(dialog.querySelector('[data-route-id="R01"]')!.getAttribute('aria-current')).toBe('page')
    document.body.setAttribute('data-route', 'R02')
    ;(document.querySelector('[data-menu-trigger]') as HTMLElement).click()
    expect(dialog.querySelector('[data-route-id="R02"]')!.getAttribute('aria-current')).toBe('page')
    expect(dialog.querySelector('[data-route-id="R01"]')!.hasAttribute('aria-current')).toBe(false)
    unmount()
  })
})
