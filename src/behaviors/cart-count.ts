import { getMotion } from '../leash/motion'
import { cartCountFromCookies, findCartCookie } from '../lib/commerce/cartCookie'

import {
  CART_CHANGE_EVENT,
  type BehaviorContext,
  type CartChangeDetail,
  type Unmount,
} from './types'

// `data-behavior="cart-count"` (KO-02, DESIGN §9.12): Korb-Anzahl im Kopf. Liest `pc_cart` nur, wenn das Cookie
// existiert, und setzt nie etwas (ARCHITEKTUR §8.7, R-130). Ändert sich die Anzahl, hüpft die Zahl (MI-07:
// scale 1 → 1.25 → 1, 240 ms `--ease-stamp`; bei reduzierter Bewegung wechselt sie sofort).
// Markup: `<a data-behavior="cart-count">Korb <span data-cart-count hidden></span></a>`.
// Änderungen melden andere Module (z. B. `add-to-cart`) mit dem Ereignis `CART_CHANGE_EVENT` am `document`; im
// Modus `preview` trägt es die neue Anzahl (`detail.count`, nur im Speicher), in der App wird das Cookie neu gelesen.

export { CART_CHANGE_EVENT, type CartChangeDetail }

const BOUNCE_MS = 240
const FALLBACK_EASE = 'ease-out'

/** Anzahl im Speicher der Vorschau (bleibt über Seitenwechsel innerhalb der Vorschau-Datei erhalten). */
let previewCount = 0

function readAppCount(doc: Document): number {
  const cookies = doc.cookie
  return findCartCookie(cookies) === null ? 0 : cartCountFromCookies(cookies)
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const target = (root.querySelector('[data-cart-count]') ?? root) as HTMLElement
  let animation: Animation | null = null
  let current = -1

  const render = (count: number, bounce: boolean) => {
    if (count === current) return
    const changed = current >= 0
    current = count
    target.textContent = count > 0 ? String(count) : ''
    target.hidden = count === 0
    root.setAttribute('data-count', String(count))
    if (!bounce || !changed || count === 0 || getMotion(doc) === 'reduced') return
    if (typeof target.animate !== 'function') return
    animation?.cancel()
    const stampEasing =
      doc.defaultView
        ?.getComputedStyle(doc.documentElement)
        .getPropertyValue('--ease-stamp')
        .trim() || FALLBACK_EASE
    animation = target.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: BOUNCE_MS, easing: stampEasing },
    )
    animation.onfinish = () => {
      animation = null
    }
  }

  const onChange = (event: Event) => {
    if (ctx.mode === 'preview') {
      const next = (event as CustomEvent<CartChangeDetail>).detail?.count
      if (typeof next === 'number' && Number.isSafeInteger(next) && next >= 0) previewCount = next
      render(previewCount, true)
    } else {
      render(readAppCount(doc), true)
    }
  }

  render(ctx.mode === 'preview' ? previewCount : readAppCount(doc), false)
  doc.addEventListener(CART_CHANGE_EVENT, onChange)

  return () => {
    doc.removeEventListener(CART_CHANGE_EVENT, onChange)
    animation?.cancel()
    animation = null
  }
}
