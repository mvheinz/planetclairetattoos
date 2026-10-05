// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { mount } from '@/behaviors/lost'

// R2-04-01 (MI-11): `lost` wartet auf `data-leash-drawn` der Linien-Ebene des eigenen Inhalts – nicht auf die erste Ebene
// der Seite (auf der QA-Bühne gibt es zusätzlich die der Seitenhülle).

afterEach(() => {
  document.body.innerHTML = ''
})

describe('lost: Linien-Ebene', () => {
  it('R2-04-01: nimmt die nächste Ebene oberhalb des Inhalts, nicht die erste der Seite', async () => {
    document.body.innerHTML =
      '<div id="shell"><div data-leash-layer id="outer"></div>' +
      '<div id="stage"><div data-leash-layer data-leash-drawn id="inner"></div>' +
      '<div data-behavior="lost"><span data-leash-anchor="start"></span><svg data-lost-end></svg>' +
      '<div class="coco" data-lost-coco data-boil="off"></div></div></div></div>'
    const root = document.querySelector('[data-behavior="lost"]')!
    const coco = root.querySelector<HTMLElement>('[data-lost-coco]')!
    // jsdom hat keine Web Animations: Stub, der die Aufrufe zählt.
    let started = 0
    for (const el of document.querySelectorAll<HTMLElement>('*'))
      el.animate = (() => {
        started++
        return { cancel() {}, onfinish: null } as unknown as Animation
      }) as typeof el.animate
    document.documentElement.removeAttribute('data-motion')
    const off = mount(root)
    expect(started).toBeGreaterThan(0)
    expect(coco.getAttribute('data-running')).toBe('')
    off()
  })
})
