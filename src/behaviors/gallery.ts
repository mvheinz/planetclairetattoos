import { getMotion } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="gallery"` (DESIGN KO-09): Scroll-Snap-Leiste `[data-gallery-track]` mit Folien
// `[data-gallery-slide]`. Aktuelles Foto aus der Scroll-Position → Punkte, Zähler „2 / 5“ und Miniaturen
// (`aria-current`). Knöpfe „vorheriges/nächstes Foto“ und Miniaturen werden sichtbar (ohne JavaScript `hidden`);
// Pfeiltasten, Pos1/Ende auf der Leiste wechseln das Foto. Der Zähler ist `aria-live="polite"` nur nach Knopf/Taste,
// nicht beim Wischen. Reduzierte Bewegung: Sprung ohne weiches Scrollen. Kein Netz, kein Speicher.

/** Index des Fotos, das die Leiste zeigt (auf 0 … count − 1 begrenzt). */
export function indexFromScroll(scrollLeft: number, slideWidth: number, count: number): number {
  if (count < 1 || !(slideWidth > 0)) return 0
  return Math.min(count - 1, Math.max(0, Math.round(Math.abs(scrollLeft) / slideWidth)))
}

export function mount(root: Element, _ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const q = <T extends Element>(s: string) => root.querySelector<T>(s)
  const track = q<HTMLElement>('[data-gallery-track]')
  if (!track) return () => {}
  const slides = Array.from(track.querySelectorAll<HTMLElement>('[data-gallery-slide]'))
  const count = slides.length
  const prev = q<HTMLButtonElement>('[data-gallery-prev]')
  const next = q<HTMLButtonElement>('[data-gallery-next]')
  const thumbsList = q<HTMLElement>('[data-gallery-thumbs]')
  const thumbs = Array.from(root.querySelectorAll<HTMLElement>('[data-gallery-thumb]'))
  const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-gallery-dot]'))
  const counter = q<HTMLElement>('[data-gallery-counter]')
  const shown = [prev, next, thumbsList].filter((el): el is HTMLElement => !!el)
  let current = -1
  // Ziel eines Knopf-/Tastendrucks: Zwischenstände des weichen Scrollens nicht anzeigen und nicht ansagen.
  let pending = -1

  const render = (i: number) => {
    if (i === current) return
    current = i
    if (counter) counter.textContent = `${i + 1} / ${count}`
    dots.forEach((d, k) => d.toggleAttribute('data-active', k === i))
    thumbs.forEach((t, k) =>
      k === i ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current'),
    )
    // `aria-disabled` statt `disabled`: der Fokus bleibt am Knopf (Tastatur), `go` begrenzt ohnehin.
    prev?.setAttribute('aria-disabled', String(i === 0))
    next?.setAttribute('aria-disabled', String(i === count - 1))
    root.setAttribute('data-gallery-index', String(i))
  }

  const go = (i: number, announce: boolean) => {
    const target = Math.min(count - 1, Math.max(0, i))
    if (announce) counter?.setAttribute('aria-live', 'polite')
    if (indexFromScroll(track.scrollLeft, track.clientWidth, count) !== target) pending = target
    track.scrollTo?.({
      left: target * track.clientWidth,
      behavior: getMotion(root.ownerDocument) === 'reduced' ? 'auto' : 'smooth',
    })
    render(target)
  }

  const onScroll = () => {
    const i = indexFromScroll(track.scrollLeft, track.clientWidth, count)
    if (pending >= 0) {
      if (i === pending) pending = -1
      return
    }
    if (i === current) return
    counter?.removeAttribute('aria-live')
    render(i)
  }
  const onPointer = () => {
    pending = -1
  }
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: count - 1,
    }
    if (!(e.key in map) || e.target !== track) return
    e.preventDefault()
    go(map[e.key]!, true)
  }
  const onPrev = () => go(current - 1, true)
  const onNext = () => go(current + 1, true)
  const onThumb = (e: Event) => {
    const i = Number((e.currentTarget as HTMLElement).getAttribute('data-gallery-thumb'))
    go(i, true)
  }

  for (const el of shown) el.hidden = false
  track.addEventListener('scroll', onScroll, { passive: true })
  track.addEventListener('keydown', onKey)
  track.addEventListener('pointerdown', onPointer)
  prev?.addEventListener('click', onPrev)
  next?.addEventListener('click', onNext)
  for (const t of thumbs) t.addEventListener('click', onThumb)
  render(indexFromScroll(track.scrollLeft, track.clientWidth, count))

  return () => {
    track.removeEventListener('scroll', onScroll)
    track.removeEventListener('keydown', onKey)
    track.removeEventListener('pointerdown', onPointer)
    prev?.removeEventListener('click', onPrev)
    next?.removeEventListener('click', onNext)
    for (const t of thumbs) t.removeEventListener('click', onThumb)
    for (const el of shown) el.hidden = true
    counter?.removeAttribute('aria-live')
  }
}
