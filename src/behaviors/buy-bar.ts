import type { BehaviorContext, Unmount } from './types'

// `data-behavior="buy-bar"` (DESIGN KO-09a): mobile Kauf-Leiste (nur < 768 px per CSS, nur bei `available`). Sie wird
// eingeblendet, sobald der eigentliche Knopf `#add-to-cart` den Sichtbereich nach oben verlassen hat, und verschwindet,
// wenn er wieder sichtbar ist (IntersectionObserver). Unsichtbar ist sie `inert` (keine Fokusziele). Einblenden per
// CSS-Übergang am Attribut `data-visible` (reduzierte Bewegung: sofort). Kein Netz, kein Speicher.

export const BELOW_PX = 100000

/** Leiste zeigen? Nur wenn der Knopf nicht sichtbar ist und oberhalb des Sichtbereichs liegt. */
export function shouldShowBar(isIntersecting: boolean, top: number): boolean {
  return !isIntersecting && top < 0
}

export function mount(root: Element, _ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const bar = root as HTMLElement
  const target = root.ownerDocument.getElementById('add-to-cart')
  if (!target || typeof IntersectionObserver !== 'function') return () => {}
  const set = (visible: boolean) => {
    bar.toggleAttribute('data-visible', visible)
    bar.inert = !visible
    bar.setAttribute('aria-hidden', String(!visible))
  }
  // Sichtbereich nach unten stark verlängert: „schneidet“ gilt dann für sichtbar und unterhalb – der Wechsel fällt genau
  // dann, wenn der Knopf oben hinausläuft (auch bei einem Sprung von unterhalb nach oberhalb).
  const observer = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1]
      if (e) set(shouldShowBar(e.isIntersecting, e.boundingClientRect.top))
    },
    { rootMargin: `0px 0px ${BELOW_PX}px 0px` },
  )
  set(false)
  bar.hidden = false
  observer.observe(target)
  return () => {
    observer.disconnect()
    set(false)
    bar.hidden = true
  }
}
