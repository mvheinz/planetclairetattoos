// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { FreshStamp } from '@/components/shop/FreshStamp'
import { NumberLookup } from '@/components/shop/NumberLookup'

// V-60 (U-93, P20.3): Nummernfeld „Nr. aus dem Post“ als reines GET-Formular (ohne JavaScript, kein Cookie, Sprache der
// Seite am Knopf) und Stempel „frisch im Shop“ (KO-06a).

afterEach(cleanup)

describe('NumberLookup (V-60)', () => {
  it('GET /nr mit Feld `nummer`; die Sprache reist mit dem Knopf, kein verstecktes Feld', () => {
    const { container } = render(<NumberLookup locale="en" id="shop-nr" variant="shop" />)
    const form = container.querySelector('form')!
    expect(form.getAttribute('action')).toBe('/nr')
    expect(form.getAttribute('method')).toBe('get')
    expect(form.getAttribute('data-nr-lookup')).toBe('shop')
    const input = form.querySelector<HTMLInputElement>('input#shop-nr')!
    expect(input.name).toBe('nummer')
    expect(input.required).toBe(true)
    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.getAttribute('pattern')).toBeNull() // „Nr. 115“ darf man tippen
    expect(form.querySelector('label[for="shop-nr"]')!.textContent).toBe('No. from the post')
    expect(input.placeholder).toBe('e.g. 115')
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(button.name).toBe('locale')
    expect(button.value).toBe('en')
    expect(button.textContent).toContain('Show')
    expect(form.querySelectorAll('input[type="hidden"]')).toHaveLength(0)
    // genau ein Eingabefeld und ein Knopf (Tab-Reihenfolge im Menü bleibt einfach)
    expect(form.querySelectorAll('input, button, select, textarea')).toHaveLength(2)
  })

  it('DE-Texte; 404-Variante mit eigenen Texten, ohne Platzhalter, mit ihrem Daten-Attribut', () => {
    const de = render(<NumberLookup locale="de" id="menu-nr" variant="menu" />).container
    expect(de.querySelector('label')!.textContent).toBe('Nr. aus dem Post')
    expect(de.querySelector('button')!.textContent).toContain('Zeigen')
    expect(de.querySelector<HTMLButtonElement>('button')!.value).toBe('de')
    cleanup()
    const nf = render(
      <NumberLookup
        locale="de"
        id="nr-nummer"
        variant="notFound"
        label="Ein bestimmtes Stück im Kopf? Nummer eingeben"
        submit="Stück suchen"
        data={{ 'data-number-form': '' }}
      />,
    ).container
    const form = nf.querySelector('form')!
    expect(form.hasAttribute('data-number-form')).toBe(true)
    expect(form.querySelector('label')!.textContent).toBe(
      'Ein bestimmtes Stück im Kopf? Nummer eingeben',
    )
    expect(form.querySelector('input')!.hasAttribute('placeholder')).toBe(false)
  })
})

describe('FreshStamp (KO-06a)', () => {
  it('Karte: dekorativ, gezeichneter Rahmen, „frisch“/„im Shop“, Drehung +4…+8°', () => {
    const el = render(<FreshStamp itemNumber={115} locale="de" />).container.firstElementChild!
    expect(el.getAttribute('data-fresh-stamp')).toBe('card')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.querySelectorAll('svg path').length).toBeGreaterThanOrEqual(3)
    expect(el.textContent).toBe('frischim Shop')
    const angle = Number(el.getAttribute('data-angle'))
    expect(angle).toBeGreaterThanOrEqual(4)
    expect(angle).toBeLessThanOrEqual(8)
    expect((el as HTMLElement).style.getPropertyValue('--fresh-angle')).toBe(`${angle}deg`)
  })

  it('Produktseite: nicht versteckt, voller Text für Screenreader (EN)', () => {
    const el = render(<FreshStamp itemNumber={115} locale="en" size="page" />).container
      .firstElementChild!
    expect(el.getAttribute('aria-hidden')).toBeNull()
    expect(el.querySelector('.u-sr-only')!.textContent).toBe('fresh in the shop')
  })
})
