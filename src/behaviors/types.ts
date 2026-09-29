import type { AddToCartResponse, ProductLiveState } from '../lib/commerce/cartCookie'

// Verhaltensmodule (KONZEPT §12.9, ARCHITEKTUR §14.6, DESIGN §9.12): framework-frei, angebunden über
// `data-behavior="<name>"` am serverseitig gerenderten HTML. `mount` bindet ein Element und gibt `unmount` zurück, das
// alle eigenen Listener, Observer, Timer und Animationen wieder entfernt (AK-DS-18).

export type BehaviorMode = 'app' | 'preview'

/**
 * Server-Aufrufe, die Module nutzen dürfen (nur Modus `app`; die App reicht sie über `BehaviorHost` herein, damit die
 * Module selbst weder React/Next importieren noch Netzcode enthalten). In der Vorschau fehlen sie.
 */
export interface BehaviorActions {
  /** „In den Korb“ (PLAN P3.11); `FormData` mit `productId`, `itemNumber`, `locale`, `via=script`. */
  addToCart?: (formData: FormData) => Promise<AddToCartResponse>
  /** Live-Zustand je ID (`GET /api/public/product-status`); `null` bei Fehlern (z. B. 429). */
  productStatus?: (
    ids: readonly string[],
    signal?: AbortSignal,
  ) => Promise<Record<string, unknown> | null>
}

export interface BehaviorContext {
  /** `preview`: Vorschau-Datei – kein Netz, kein Cookie, kein Web-Storage. */
  mode: BehaviorMode
  actions?: BehaviorActions
}

export type Unmount = () => void

export type Mount = (root: Element, ctx?: BehaviorContext) => Unmount

export interface BehaviorModule {
  mount: Mount
}

// --- Ereignisse zwischen Modulen (am `document`) -----------------------------------------------------------------

/** Korb geändert (MI-07): Vorschau mit `detail.count` (nur im Speicher), App liest `pc_cart` neu. */
export const CART_CHANGE_EVENT = 'pc:cart-change'
export interface CartChangeDetail {
  count?: number
}

/** Stück live auf `sold` gewechselt → Stempel-Knall (MI-03, Modul `sold-stamp`). */
export const SOLD_EVENT = 'pc:product-sold'
export interface SoldEventDetail {
  id: number | string
}

/** Neuer Live-Zustand eines Stücks (Modul `product-status`) → Kaufbereich (`add-to-cart`). */
export const PRODUCT_STATE_EVENT = 'pc:product-state'
export interface ProductStateDetail {
  id: string
  state: ProductLiveState
  /** Das Stück liegt in der eigenen laufenden Kasse (`reservedByYou`, P4.7). */
  reservedByYou?: true
}
