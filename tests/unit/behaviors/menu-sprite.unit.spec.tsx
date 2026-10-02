// @vitest-environment jsdom
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { activateSpriteUses, mount } from '@/behaviors/menu'
import { Coco } from '@/components/Coco'
import { COCO_SPRITE_HREF } from '@/leash/cocoSprite'

// Coco im geschlossenen Menü (DESIGN KO-03): Das Sprite gehört nicht in den Pfad bis zum ersten Bild – sonst zählt
// Lighthouse den Abruf auf jeder Seite zum LCP (R04 im P5-Phasenlauf). SSR-Markup ohne `href`, das Menü-Modul setzt es.

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Coco deferSprite + Menü-Modul (LCP R04, P5)', () => {
  it('Coco ohne deferSprite verweist sofort auf das Sprite', () => {
    const html = renderToStaticMarkup(<Coco pose="kopfschief" size="m" />)
    expect(html).toContain(`href="${COCO_SPRITE_HREF}#`)
    expect(html).not.toContain('data-href')
  })

  it('Coco mit deferSprite: <use data-href>, kein href im SSR-Markup', () => {
    const html = renderToStaticMarkup(<Coco pose="kopfschief" size="m" deferSprite />)
    expect(html.match(/<use /g)).toHaveLength(3)
    expect(html.match(/ data-href="/g)).toHaveLength(3)
    expect(html).not.toMatch(/<use[^>]* href="/)
  })

  it('activateSpriteUses setzt href aus data-href und entfernt data-href', () => {
    document.body.innerHTML = renderToStaticMarkup(<Coco pose="kopfschief" size="m" deferSprite />)
    expect(activateSpriteUses(document.body)).toBe(3)
    const uses = [...document.querySelectorAll('use')]
    expect(uses.every((u) => u.getAttribute('href')?.startsWith(`${COCO_SPRITE_HREF}#coco-`))).toBe(
      true,
    )
    expect(document.querySelector('use[data-href]')).toBeNull()
    expect(activateSpriteUses(document.body)).toBe(0)
  })

  it('mount des Menü-Moduls lädt Coco im Menü (nach dem ersten Bild)', () => {
    document.body.innerHTML = `<dialog id="menu" data-behavior="menu"><div data-coco-slot="">${renderToStaticMarkup(
      <Coco pose="kopfschief" size="m" deferSprite />,
    )}</div></dialog>`
    const dialog = document.getElementById('menu')!
    const unmount = mount(dialog)
    expect(dialog.querySelector('use[data-href]')).toBeNull()
    expect(dialog.querySelectorAll('use[href]')).toHaveLength(3)
    unmount()
  })
})
