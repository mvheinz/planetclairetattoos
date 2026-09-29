import { cartFromCookies, findCartCookie } from '../lib/commerce/cartCookie'
import type { AddToCartResponse } from '../lib/commerce/cartCookie'
import { getMotion } from '../leash/motion'

import {
  CART_CHANGE_EVENT,
  PRODUCT_STATE_EVENT,
  SOLD_EVENT,
  type BehaviorContext,
  type ProductStateDetail,
  type SoldEventDetail,
  type Unmount,
} from './types'

// `data-behavior="add-to-cart"` (DESIGN KO-11, KONZEPT §3.4 Nr. 6/§4.2, PLAN P3.11) am Formular „In den Korb“
// (Produktseite und Kauf-Leiste). Ohne JavaScript schickt das Formular die Server-Action ab (303 zurück auf die Seite mit
// `#in-cart` bzw. einer Meldung). Mit JavaScript (Modus `app`) ruft das Modul die Server-Action `ctx.actions.addToCart`
// ohne Seitenwechsel auf; erst der Server setzt `pc_cart`. Ergebnis:
// - Erfolg → Knopf wird zu „Liegt schon in deinem Korb“ + „Zum Korb“ (`[data-in-cart]`), kurze Bestätigung „Liegt im
//   Korb“ (`[data-buy-confirm]`, 3 s), Korb-Anzahl +1 (`CART_CHANGE_EVENT`, MI-07), Coco-Hüpfer MI-01 (Grundfassung).
// - Abgelehnt → aktueller Zustand (reserviert, verkauft mit Stempel-Knall, nicht mehr da, Shop pausiert mit
//   `closedMessage`) bzw. Meldung (`[data-buy-note="<code>"]`: Korb voll, zu viele Versuche, Fehler).
// Beim Binden liest es `pc_cart` (nur lesen, nichts setzen) und zeigt „Liegt schon in deinem Korb“, wenn das Stück schon
// im Korb liegt. Alle Formulare desselben Stücks bleiben gleich (Ereignis `CART_ITEM_EVENT`); `PRODUCT_STATE_EVENT`
// (Modul `product-status`) übernimmt Live-Wechsel; liegt das Stück in der eigenen laufenden Kasse (`reservedByYou`),
// zeigt `[data-in-checkout]` „Du hast es gerade in der Kasse“ + „Zur Kasse“ (P4.7, KONZEPT §3.4 Nr. 6).
// Im Modus `preview`: keine Server-Aufrufe, kein Cookie, kein Speicher –
// nur Anzeige; die Korb-Anzeige zählt die Vorschau-Laufzeit im Speicher (`cartDemo`, Klick auf dieses Formular).

export const CART_ITEM_EVENT = 'pc:cart-item'

export type BuyView =
  'available' | 'in-cart' | 'in-checkout' | 'reserved' | 'sold' | 'gone' | 'closed'
export type BuyNote = Extract<AddToCartResponse, { ok: false }>['code']

export interface CartItemDetail {
  id: string
  view: BuyView
  note?: BuyNote
  message?: string | null
  added?: boolean
}

export const CONFIRM_MS = 3000
/** MI-01: Abspringen 83 ms → Sprung 140 ms hoch, 220 ms runter → Landung 80 ms (DESIGN §11). */
export const HOP_MS = 83 + 140 + 220 + 80
const FALLBACK_UP = 'cubic-bezier(0.15, 0.75, 0.35, 1)'
const FALLBACK_DOWN = 'cubic-bezier(0.55, 0, 0.85, 0.35)'

/** Ergebnis der Server-Action → Anzeige (und ggf. Meldung) für alle Formulare desselben Stücks. */
export function viewFor(res: AddToCartResponse, current: BuyView): Omit<CartItemDetail, 'id'> {
  if (res.ok) return { view: 'in-cart', added: res.added }
  if (res.code === 'shop_closed') return { view: 'closed', note: res.code, message: res.message }
  if (res.code === 'product_unavailable') {
    const state = res.state && res.state !== 'available' ? res.state : 'gone'
    return state === 'gone' ? { view: 'gone', note: res.code } : { view: state }
  }
  return { view: current, note: res.code }
}

/** MI-01 als Keyframes (nur `transform`). */
export function hopKeyframes(up: string, down: string): Keyframe[] {
  const at = (ms: number) => Math.round((ms / HOP_MS) * 1000) / 1000
  return [
    { offset: 0, transform: 'translateY(0) scaleY(1)' },
    { offset: at(83), transform: 'translateY(0) scaleY(0.94)', easing: up },
    { offset: at(223), transform: 'translateY(-14px) scaleY(1)', easing: down },
    { offset: at(443), transform: 'translateY(0) scaleY(1)' },
    { offset: at(483), transform: 'translateY(0) scaleY(0.92)' },
    { offset: 1, transform: 'translateY(0) scaleY(1)' },
  ]
}

/** Stücke im Vorschau-Korb (nur im Speicher, über Seitenwechsel der Vorschau-Datei hinweg). */
const previewCart = new Set<string>()

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const form = root as HTMLFormElement
  const doc = root.ownerDocument
  const win = doc.defaultView
  const id = root.getAttribute('data-product-id') ?? ''
  const scope = root.closest('[data-buy-area], [data-buy-bar]') ?? root.parentElement ?? root
  const button = root.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])')
  const label = button?.querySelector('span') ?? button
  const inCart = scope.querySelector<HTMLElement>('[data-in-cart]')
  const inCheckout = scope.querySelector<HTMLElement>('[data-in-checkout]')
  const soldView = scope.querySelector<HTMLElement>('[data-sold-view]')
  const confirm = scope.querySelector<HTMLElement>('[data-buy-confirm]')
  const notes = Array.from(scope.querySelectorAll<HTMLElement>('[data-buy-note]'))
  const texts = {
    add: root.getAttribute('data-text-add') ?? label?.textContent ?? '',
    reserved: root.getAttribute('data-text-reserved') ?? '',
  }
  let closed = root.hasAttribute('data-closed')
  let view: BuyView = closed
    ? 'closed'
    : scope.getAttribute('data-buy-state') === 'reserved'
      ? 'reserved'
      : 'available'
  let busy = false
  let active = true
  let confirmTimer: ReturnType<typeof setTimeout> | null = null
  let hop: Animation | null = null

  const setDisabled = (disabled: boolean) => {
    if (!button) return
    button.disabled = disabled
    if (disabled) button.setAttribute('aria-disabled', 'true')
    else button.removeAttribute('aria-disabled')
  }

  const showNote = (note: BuyNote | undefined, message?: string | null) => {
    for (const el of notes) {
      const match = el.getAttribute('data-buy-note') === note
      if (match && message) el.textContent = message
      el.hidden = !match
    }
  }

  const render = (next: BuyView) => {
    view = next
    if (next === 'closed') closed = true
    scope.setAttribute('data-buy-state', next)
    const showForm = next !== 'in-cart' && next !== 'in-checkout' && next !== 'sold'
    form.hidden = !showForm
    if (inCart) inCart.hidden = next !== 'in-cart'
    if (inCheckout) inCheckout.hidden = next !== 'in-checkout'
    if (soldView) soldView.hidden = next !== 'sold'
    if (label)
      label.textContent = next === 'reserved' && texts.reserved ? texts.reserved : texts.add
    setDisabled(next !== 'available' || closed)
  }

  const showConfirm = () => {
    if (!confirm) return
    confirm.hidden = false
    if (confirmTimer) clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
      confirmTimer = null
      confirm.hidden = true
    }, CONFIRM_MS)
  }

  const bounceCoco = () => {
    if (getMotion(doc) === 'reduced') return
    const el = doc.querySelector<HTMLElement>(
      '[data-leash-coco] .coco__hop, [data-product-coco] .coco__hop',
    )
    if (!el || typeof el.animate !== 'function') return
    const style = win?.getComputedStyle(doc.documentElement)
    const up = style?.getPropertyValue('--ease-hop-up').trim() || FALLBACK_UP
    const down = style?.getPropertyValue('--ease-hop-down').trim() || FALLBACK_DOWN
    hop?.cancel()
    hop = el.animate(hopKeyframes(up, down), { duration: HOP_MS })
    hop.onfinish = () => {
      hop = null
    }
  }

  /** Anzeige für alle Formulare desselben Stücks (auch dieses). */
  const onItem = (event: Event) => {
    const d = (event as CustomEvent<CartItemDetail>).detail
    if (!d || d.id !== id) return
    const hadFocus = !!doc.activeElement && root.contains(doc.activeElement)
    render(d.view)
    showNote(d.note, d.message)
    if (d.view === 'in-cart' && d.added) showConfirm()
    if (hadFocus && d.view === 'in-cart')
      (inCart?.matches('a') ? inCart : inCart?.querySelector<HTMLElement>('a'))?.focus()
  }

  const broadcast = (detail: Omit<CartItemDetail, 'id'>) =>
    doc.dispatchEvent(
      new CustomEvent<CartItemDetail>(CART_ITEM_EVENT, { detail: { id, ...detail } }),
    )

  const handle = (res: AddToCartResponse) => {
    const next = viewFor(res, view)
    broadcast(next)
    if (next.view === 'sold')
      doc.dispatchEvent(new CustomEvent<SoldEventDetail>(SOLD_EVENT, { detail: { id } }))
    // Meldung ohne eigenen Platz (Kauf-Leiste): zum Kaufbereich blättern, dort steht sie.
    if (next.note && notes.length === 0)
      doc.getElementById('add-to-cart')?.scrollIntoView({ block: 'center' })
    if (next.added) {
      if (ctx.mode === 'app') doc.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail: {} }))
      bounceCoco()
    }
  }

  const add = () => {
    if (busy || view !== 'available' || closed) return
    if (ctx.mode === 'preview') {
      previewCart.add(id)
      handle({ ok: true, added: true, count: previewCart.size, state: 'available' })
      return
    }
    const action = ctx.actions?.addToCart
    // Ohne hereingereichte Action: normales Absenden (Weg ohne JavaScript, 303).
    if (!action) return form.submit()
    const data = new FormData(form)
    data.set('via', 'script')
    busy = true
    button?.setAttribute('aria-busy', 'true')
    action(data)
      .then((res) => {
        if (active) handle(res)
      })
      .catch(() => {
        if (active) broadcast({ view, note: 'invalid' })
      })
      .finally(() => {
        busy = false
        button?.removeAttribute('aria-busy')
      })
  }

  const onSubmit = (event: Event) => {
    event.preventDefault()
    add()
  }
  const onClick = (event: Event) => {
    // Vorschau: den Klick selbst abfangen (die Vorschau-Laufzeit verhindert das Absenden und zählt den Korb).
    if (!(event.target as Element | null)?.closest?.('button')) return
    event.preventDefault()
    add()
  }

  const onState = (event: Event) => {
    const d = (event as CustomEvent<ProductStateDetail>).detail
    if (!d || d.id !== id) return
    const inBasket = view === 'in-cart'
    if (d.reservedByYou) render('in-checkout')
    else if (d.state === 'available') render(inBasket ? 'in-cart' : closed ? 'closed' : 'available')
    else render(d.state)
    showNote(d.state === 'gone' ? 'product_unavailable' : undefined)
  }

  // Schon im Korb? (App: `pc_cart` nur lesen, wenn es existiert; Vorschau: Speicher.)
  const cookies = ctx.mode === 'app' ? doc.cookie : ''
  const already =
    ctx.mode === 'preview'
      ? previewCart.has(id)
      : findCartCookie(cookies) !== null &&
        cartFromCookies(cookies).items.some((i) => String(i.id) === id)
  if (already && view !== 'reserved') render('in-cart')

  root.addEventListener(
    ctx.mode === 'preview' ? 'click' : 'submit',
    ctx.mode === 'preview' ? onClick : onSubmit,
  )
  if (ctx.mode === 'preview') root.addEventListener('submit', onSubmit)
  doc.addEventListener(CART_ITEM_EVENT, onItem)
  doc.addEventListener(PRODUCT_STATE_EVENT, onState)

  return () => {
    active = false
    root.removeEventListener('submit', onSubmit)
    root.removeEventListener('click', onClick)
    doc.removeEventListener(CART_ITEM_EVENT, onItem)
    doc.removeEventListener(PRODUCT_STATE_EVENT, onState)
    if (confirmTimer) clearTimeout(confirmTimer)
    confirmTimer = null
    hop?.cancel()
    hop = null
  }
}
