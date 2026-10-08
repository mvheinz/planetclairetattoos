import { BEHAVIOR_NAMES, mountBehaviors, type BehaviorLoader } from '../behaviors'
import * as addToCart from '../behaviors/add-to-cart'
import * as buyBar from '../behaviors/buy-bar'
import * as cartCount from '../behaviors/cart-count'
import * as copyButton from '../behaviors/copy-button'
import * as gallery from '../behaviors/gallery'
import * as lightbox from '../behaviors/lightbox'
import * as lost from '../behaviors/lost'
import * as menu from '../behaviors/menu'
import * as motionToggle from '../behaviors/motion-toggle'
import * as priceTagSwing from '../behaviors/price-tag-swing'
import * as productStatus from '../behaviors/product-status'
import * as reservationCountdown from '../behaviors/reservation-countdown'
import * as soldStamp from '../behaviors/sold-stamp'
import * as thanksMoment from '../behaviors/thanks-moment'
import * as thanksPoll from '../behaviors/thanks-poll'
import type { BehaviorModule } from '../behaviors/types'

import { createAssetStore } from './assets'
import { installBanner } from './banner'
import { installCartDemo } from './cartDemo'
import { installDialogs } from './dialogs'
import { mountPageLeash } from './leash'
import { createRouter } from './router'
import type { PvData } from './types'

// Start der Vorschau-Laufzeit (ARCHITEKTUR §14.6): liest `#pv-data` und `#pv-assets`, baut Banner, Dialog und
// Korb-Demo, startet den Hash-Router. Verhaltensmodule sind statisch gebündelt (keine dynamischen Importe in einer
// Einzeldatei) und laufen im Modus `preview`: kein Netz, kein Cookie, kein Web-Storage.

/** Statisches Register – muss alle Namen aus `src/behaviors/index.ts` enthalten (Unit-Test). */
export const STATIC_BEHAVIORS: Record<(typeof BEHAVIOR_NAMES)[number], BehaviorModule> = {
  'add-to-cart': addToCart,
  'buy-bar': buyBar,
  'cart-count': cartCount,
  'copy-button': copyButton,
  gallery,
  lightbox,
  lost,
  menu,
  'motion-toggle': motionToggle,
  'price-tag-swing': priceTagSwing,
  'product-status': productStatus,
  'reservation-countdown': reservationCountdown,
  'sold-stamp': soldStamp,
  'thanks-moment': thanksMoment,
  'thanks-poll': thanksPoll,
}

const staticLoader: BehaviorLoader = (name) => Promise.resolve(STATIC_BEHAVIORS[name])

function readJson<T>(doc: Document, id: string, fallback: T): T {
  try {
    return JSON.parse(doc.getElementById(id)?.textContent ?? '') as T
  } catch {
    return fallback
  }
}

export function start(doc: Document = document): void {
  const data = readJson<PvData | null>(doc, 'pv-data', null)
  const root = doc.getElementById('pv-root')
  const bannerHost = doc.getElementById('pv-banner')
  if (!data || !root || !bannerHost) return
  const win = doc.defaultView!
  win.__PV_ROUTES = data.routes
  const assets = createAssetStore(readJson<Record<string, string>>(doc, 'pv-assets', {}))
  const banner = installBanner(doc, bannerHost, data)
  const dialog = installDialogs(doc)
  const cart = installCartDemo(doc)

  const router = createRouter({
    doc,
    root,
    onLang: (lang) => {
      banner.setLang(lang)
      const t = data.texts[lang]
      dialog.setTexts({ title: t.dialogTitle, close: t.dialogClose })
      cart.setText(t.cartDemo)
    },
    onMount: (pageRoot, info) => {
      assets.resolve(pageRoot)
      banner.closeList()
      const behaviors = mountBehaviors(pageRoot, { mode: 'preview' }, staticLoader)
      let stopLeash: (() => void) | null = null
      let cancelled = false
      // Linie nach dem Layout messen (Schriften geladen, ein Frame später).
      const fontsReady = doc.fonts?.ready ?? Promise.resolve()
      void fontsReady.then(() =>
        win.requestAnimationFrame(() => {
          if (!cancelled) stopLeash = mountPageLeash(pageRoot, info.leashKey)
        }),
      )
      return () => {
        cancelled = true
        stopLeash?.()
        behaviors.unmount()
      }
    },
  })
  router.start()
}

if (typeof document !== 'undefined' && document.getElementById('pv-root')) {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => start(), { once: true })
  else start()
}
