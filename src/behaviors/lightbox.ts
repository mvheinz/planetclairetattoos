import type { BehaviorContext, Unmount } from './types'

// `data-behavior="lightbox"` (DESIGN KO-09): Tipp/Klick auf ein Foto (`a[data-zoom-src]`, ohne JavaScript ein Link auf
// die Datei) öffnet `<dialog data-lightbox>` im Vollbild mit der größten vorhandenen Größe. Klick (Maus) bzw. Doppeltipp
// schaltet 1× ↔ 2× an der Position, Ziehen verschiebt das vergrößerte Bild, Wischen (1×) und Pfeiltasten wechseln das
// Foto, Pinch-Zoom bleibt nativ. Schließen: „Schließen“, `Esc`, Zurück-Taste des Browsers (`history.pushState` beim
// Öffnen); danach Fokus zurück aufs auslösende Foto. Öffnet ohne Animation. Kein Netz, kein Speicher.

export const SWIPE_PX = 50
export const TAP_PX = 10
export const DOUBLE_TAP_MS = 300

type DialogLike = HTMLElement & { open?: boolean; showModal?: () => void; close?: () => void }

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const win = doc.defaultView
  const dialog = root.querySelector<DialogLike>('[data-lightbox]')
  const stage = dialog?.querySelector<HTMLElement>('[data-lightbox-stage]')
  if (!dialog || !stage || !win) return () => {}
  // Das Vollbild-`<img>` entsteht hier und hängt erst beim Öffnen mit `src` im Dialog (ein `<img>` ohne `src` wäre ein
  // kaputtes Bild, auch in der Vorschau-Datei).
  const img = doc.createElement('img')
  img.setAttribute('data-lightbox-img', '')
  img.className = stage.getAttribute('data-img-class') ?? ''
  img.draggable = false
  img.alt = ''
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-zoom-src]'))
  const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]')
  // Optionale Bildunterschrift im Vollbild (Tattoo-Galerie R15): Text aus `data-zoom-caption` des Links.
  const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]')
  const closeBtn = dialog.querySelector<HTMLElement>('[data-lightbox-close]')
  let index = 0
  let trigger: HTMLElement | null = null
  let pushed = false
  let zoomed = false
  let ox = 0
  let oy = 0
  let start: { x: number; y: number; ox: number; oy: number } | null = null
  let lastTap = 0

  const isOpen = () => dialog.open === true || dialog.hasAttribute('open')

  const applyZoom = () => {
    img.style.transform = zoomed ? `translate(${ox}px, ${oy}px) scale(2)` : ''
    stage.toggleAttribute('data-zoomed', zoomed)
  }
  const resetZoom = () => {
    zoomed = false
    ox = oy = 0
    applyZoom()
  }
  const toggleZoom = (x: number, y: number) => {
    if (zoomed) return resetZoom()
    const r = img.getBoundingClientRect()
    const px = r.width ? ((x - r.left) / r.width) * 100 : 50
    const py = r.height ? ((y - r.top) / r.height) * 100 : 50
    img.style.transformOrigin = `${Math.min(100, Math.max(0, px))}% ${Math.min(100, Math.max(0, py))}%`
    zoomed = true
    applyZoom()
  }

  const show = (i: number) => {
    index = (i + links.length) % links.length
    const link = links[index]!
    const thumb = link.querySelector('img')
    // Vorschau-Datei: kein Server – das bereits eingebettete Foto der Leiste (Blob-URL) statt der Zoom-Größe.
    const preview = ctx.mode === 'preview'
    img.src = (preview ? thumb?.currentSrc || thumb?.src : link.getAttribute('data-zoom-src')) ?? ''
    for (const [attr, name] of [
      ['width', 'data-zoom-w'],
      ['height', 'data-zoom-h'],
    ] as const) {
      const v = preview ? null : link.getAttribute(name)
      if (v) img.setAttribute(attr, v)
      else img.removeAttribute(attr)
    }
    img.alt = thumb?.alt ?? ''
    if (!img.isConnected) stage.append(img)
    if (counter) counter.textContent = links.length > 1 ? `${index + 1} / ${links.length}` : ''
    if (caption) caption.textContent = link.getAttribute('data-zoom-caption') ?? ''
    resetZoom()
  }

  const open = (i: number, from: HTMLElement) => {
    trigger = from
    show(i)
    if (!isOpen()) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    closeBtn?.focus()
    try {
      win.history.pushState({ pcLightbox: true }, '')
      pushed = true
    } catch {
      pushed = false
    }
  }

  const finish = (restoreFocus = true) => {
    if (isOpen()) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    resetZoom()
    if (restoreFocus) trigger?.focus()
  }
  const close = () => {
    if (pushed) {
      pushed = false
      win.history.back()
    }
    finish()
  }

  const onLink = (e: Event) => {
    e.preventDefault()
    const link = e.currentTarget as HTMLAnchorElement
    open(links.indexOf(link), link)
  }
  const onCancel = (e: Event) => {
    e.preventDefault()
    close()
  }
  const onPop = () => {
    if (!pushed && !isOpen()) return
    pushed = false
    finish()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      show(index + (e.key === 'ArrowLeft' ? -1 : 1))
    }
  }
  const onDown = (e: PointerEvent) => {
    start = { x: e.clientX, y: e.clientY, ox, oy }
    if (zoomed) stage.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!start || !zoomed) return
    ox = start.ox + e.clientX - start.x
    oy = start.oy + e.clientY - start.y
    applyZoom()
  }
  const onUp = (e: PointerEvent) => {
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    start = null
    if (!zoomed && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      show(index + (dx < 0 ? 1 : -1))
      return
    }
    if (Math.abs(dx) > TAP_PX || Math.abs(dy) > TAP_PX || (!zoomed && e.target !== img)) return
    const now = e.timeStamp
    if (e.pointerType === 'mouse' || now - lastTap < DOUBLE_TAP_MS) {
      lastTap = 0
      toggleZoom(e.clientX, e.clientY)
    } else lastTap = now
  }

  for (const l of links) l.addEventListener('click', onLink)
  closeBtn?.addEventListener('click', close)
  dialog.addEventListener('cancel', onCancel)
  dialog.addEventListener('keydown', onKey)
  stage.addEventListener('pointerdown', onDown)
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerup', onUp)
  win.addEventListener('popstate', onPop)

  return () => {
    for (const l of links) l.removeEventListener('click', onLink)
    closeBtn?.removeEventListener('click', close)
    dialog.removeEventListener('cancel', onCancel)
    dialog.removeEventListener('keydown', onKey)
    stage.removeEventListener('pointerdown', onDown)
    stage.removeEventListener('pointermove', onMove)
    stage.removeEventListener('pointerup', onUp)
    win.removeEventListener('popstate', onPop)
    pushed = false
    if (isOpen()) finish(false)
    img.remove()
  }
}
