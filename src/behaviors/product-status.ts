import type { ProductLiveState } from '../lib/commerce/cartCookie'

import {
  PRODUCT_STATE_EVENT,
  SOLD_EVENT,
  type BehaviorContext,
  type ProductStateDetail,
  type SoldEventDetail,
  type Unmount,
} from './types'

// `data-behavior="product-status"` (ARCHITEKTUR §9.3, PLAN P3.11): Live-Zustand der Stücke. Nach dem Laden (Modul in
// `AFTER_LOAD`) fragt es einmal `GET /api/public/product-status?ids=…` für alle `[data-product-id]` in der Wurzel (und
// die Wurzel selbst) ab – höchstens 24 IDs, über den hereingereichten Aufruf `ctx.actions.productStatus`
// (`src/lib/shop/productStatusClient.ts`, ohne Cookies; das Modul selbst enthält keinen Netzcode). Weicht der Zustand
// vom Server-HTML (`data-status`) ab – oder liegt das Stück in der eigenen laufenden Kasse (`reservedByYou`, P4.7:
// „Du hast es gerade in der Kasse“ + „Zur Kasse“ im Kaufbereich) –: Karten bekommen Badge „reserviert“, Dämpfung (`data-status`) und zugänglichen
// Namen neu (Zusätze aus `data-label-reserved|sold|gone` der Wurzel); für jedes Stück geht `PRODUCT_STATE_EVENT` an den
// Kaufbereich (`add-to-cart`) und beim Wechsel auf `sold` `SOLD_EVENT` an `sold-stamp` (Knall MI-03). Danach trägt die
// Wurzel `data-status-live`. Im Modus `preview` keine Abfrage. Fehler (Netz, 429) ändern nichts.

export const STATUS_MAX_IDS = 24
const STATES: readonly string[] = ['available', 'reserved', 'sold', 'gone']

const isState = (v: unknown): v is ProductLiveState => typeof v === 'string' && STATES.includes(v)

/** Zugänglicher Name einer Karte im neuen Zustand: Zusatz des alten Zustands ab-, den neuen anhängen. */
export function relabel(
  label: string,
  from: string,
  to: string,
  suffix: (state: string) => string,
): string {
  const old = suffix(from)
  const base = old && label.endsWith(old) ? label.slice(0, -old.length) : label
  return base + suffix(to)
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const hosts = [root, ...Array.from(root.querySelectorAll('[data-product-id]'))].filter((el) =>
    el.hasAttribute('data-product-id'),
  )
  const ids = [...new Set(hosts.map((el) => el.getAttribute('data-product-id') ?? ''))]
    .filter((id) => /^\d+$/.test(id))
    .slice(0, STATUS_MAX_IDS)
  const load = ctx.actions?.productStatus
  if (ctx.mode === 'preview' || ids.length === 0 || !load) return () => {}

  let active = true
  const abort = typeof AbortController === 'function' ? new AbortController() : null
  const suffix = (state: string) => root.getAttribute(`data-label-${state}`) ?? ''

  const updateCard = (card: Element, from: string, to: ProductLiveState) => {
    const badge = card.querySelector<HTMLElement>('[data-badge="reserved"]')
    if (badge) badge.hidden = to !== 'reserved'
    if (from === 'sold' && to !== 'sold') {
      const stamp = card.querySelector<HTMLElement>('[data-sold-stamp]')
      if (stamp) stamp.hidden = true
      card.querySelector('[data-price-tag]')?.removeAttribute('data-sold')
    }
    const label = card.getAttribute('aria-label')
    if (label) card.setAttribute('aria-label', relabel(label, from, to, suffix))
  }

  const apply = (states: Record<string, unknown>) => {
    // P4.7: `reservedByYou` – Stücke in der eigenen laufenden Kasse (Server gleicht mit `pc_checkout` ab).
    const mine = (states.reservedByYou ?? {}) as Record<string, unknown>
    const changed = new Map<string, ProductStateDetail>()
    for (const host of hosts) {
      const id = host.getAttribute('data-product-id') ?? ''
      const next = states[id]
      const from = host.getAttribute('data-status') || 'available'
      if (!isState(next)) continue
      const byYou = next === 'reserved' && mine[id] === true
      if (byYou) host.setAttribute('data-reserved-by-you', '')
      else host.removeAttribute('data-reserved-by-you')
      if (next === from && !byYou) continue
      if (next !== from) {
        host.setAttribute('data-status', next)
        if (host.hasAttribute('data-product-card')) updateCard(host, from, next)
      }
      changed.set(id, byYou ? { id, state: next, reservedByYou: true } : { id, state: next })
    }
    for (const [id, detail] of changed) {
      doc.dispatchEvent(new CustomEvent<ProductStateDetail>(PRODUCT_STATE_EVENT, { detail }))
      if (detail.state === 'sold')
        doc.dispatchEvent(new CustomEvent<SoldEventDetail>(SOLD_EVENT, { detail: { id } }))
    }
  }

  load(ids, abort?.signal)
    .then((data) => {
      if (active && data && typeof data === 'object') apply(data)
    })
    .catch(() => {})
    .finally(() => {
      if (active) root.setAttribute('data-status-live', '')
    })

  return () => {
    active = false
    abort?.abort()
  }
}
