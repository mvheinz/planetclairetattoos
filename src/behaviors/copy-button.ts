import type { BehaviorContext, Unmount } from './types'

// `data-behavior="copy-button"` (DESIGN §9.12, KO-19/KO-20): Knopf „IBAN kopieren“, „Verwendungszweck kopieren“ bzw.
// „Adresse kopieren“. Kopiert `data-copy` in die Zwischenablage und zeigt die Rückmeldung `data-copied-text`
// („Kopiert“) 2 s lang in der zugehörigen Live-Region (`[data-copy-status]` im Knopf bzw. `aria-describedby`); schlägt
// das Kopieren fehl, erscheint `data-copy-failed-text`; mit `data-copy-select="<id>"` wird der Text dieses Elements
// zusätzlich markiert (Rückfall „markieren + Jetzt kopieren“, KONZEPT §9.4). Ohne JS ist der Knopf verborgen (`hidden`) – der Wert steht
// ohnehin als Text daneben. Kein Netz, kein Speicher (auch nicht im Modus `preview`).

export const COPIED_MS = 2000

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  void ctx
  const button = root as HTMLButtonElement
  const doc = button.ownerDocument
  const statusId = button.getAttribute('data-copy-status-id')
  const status = () =>
    (statusId ? doc.getElementById(statusId) : null) ??
    button.querySelector<HTMLElement>('[data-copy-status]')
  let timer: ReturnType<typeof setTimeout> | null = null
  let active = true

  const say = (text: string) => {
    const region = status()
    if (!region) return
    region.textContent = text
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      region.textContent = ''
    }, COPIED_MS)
  }

  /** Rückfall: den sichtbaren Wert markieren, damit er sich von Hand kopieren lässt. */
  const selectFallback = () => {
    const id = button.getAttribute('data-copy-select')
    const target = id ? doc.getElementById(id) : null
    const selection = doc.defaultView?.getSelection()
    if (!target || !selection) return
    const range = doc.createRange()
    range.selectNodeContents(target)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const onClick = async () => {
    const value = button.getAttribute('data-copy') ?? ''
    const clipboard = doc.defaultView?.navigator.clipboard
    let ok = false
    try {
      if (clipboard && value) {
        await clipboard.writeText(value)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!active) return
    if (!ok) selectFallback()
    say(
      ok
        ? (button.getAttribute('data-copied-text') ?? '')
        : (button.getAttribute('data-copy-failed-text') ?? ''),
    )
  }

  const listener = () => void onClick()
  button.hidden = false
  button.addEventListener('click', listener)
  return () => {
    active = false
    button.removeEventListener('click', listener)
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
}
