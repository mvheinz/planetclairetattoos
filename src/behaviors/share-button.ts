import { COPIED_MS } from './copy-button'
import type { BehaviorContext, Unmount } from './types'

// `data-behavior="share-button"` (U-61, P14.12): Knopf „Teilen“ an Stücken und Flash-Motiven. Öffnet das Teilen-Menü des
// Geräts (`navigator.share`, Web Share API – kein Drittanbieter, keine Cookies, kein Netz). Gibt es das nicht (meist
// Desktop) oder in der Vorschau-Datei, bleibt der Knopf verborgen; daneben steht der Rückfall „Link kopieren“ (Modul
// `copy-button`, `[data-share-fallback]`), den dieser Knopf per `data-share-native` am Behälter `[data-share]`
// ausblendet, solange er selbst sichtbar ist. Bricht das Teilen mit einem Fehler ab (nicht durch die Person), wird der
// Link stattdessen kopiert und das in der Live-Region gemeldet. Ohne JavaScript: beide Knöpfe verborgen.

/** Teilen-Menü verfügbar und für diese Daten nutzbar? */
export function canShareNatively(nav: Navigator | undefined, data: ShareData): boolean {
  if (!nav || typeof nav.share !== 'function') return false
  if (typeof nav.canShare === 'function') {
    try {
      return nav.canShare(data)
    } catch {
      return false
    }
  }
  return true
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const button = root as HTMLButtonElement
  const doc = button.ownerDocument
  const win = doc.defaultView
  const url = button.getAttribute('data-share-url') ?? ''
  const data: ShareData = {
    url,
    title: button.getAttribute('data-share-title') ?? undefined,
    text: button.getAttribute('data-share-text') ?? undefined,
  }
  // Vorschau-Datei (file://): nie das System-Menü – dort hilft nur „Link kopieren“.
  if (ctx.mode === 'preview' || !url || !canShareNatively(win?.navigator, data)) return () => {}

  const wrap = button.closest('[data-share]')
  const statusId = button.getAttribute('data-copy-status-id')
  let timer: ReturnType<typeof setTimeout> | null = null
  let active = true

  const say = (text: string) => {
    const region = statusId ? doc.getElementById(statusId) : null
    if (!region) return
    region.textContent = text
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      region.textContent = ''
    }, COPIED_MS)
  }

  const onClick = async () => {
    try {
      await win!.navigator.share(data)
    } catch (err) {
      if (!active || (err as { name?: string } | null)?.name === 'AbortError') return
      let ok = false
      try {
        await win!.navigator.clipboard.writeText(url)
        ok = true
      } catch {
        ok = false
      }
      if (!active) return
      say(
        ok
          ? (button.getAttribute('data-copied-text') ?? '')
          : (button.getAttribute('data-copy-failed-text') ?? ''),
      )
    }
  }

  const listener = () => void onClick()
  button.hidden = false
  wrap?.setAttribute('data-share-native', '')
  button.addEventListener('click', listener)
  return () => {
    active = false
    button.removeEventListener('click', listener)
    button.hidden = true
    wrap?.removeAttribute('data-share-native')
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
}
