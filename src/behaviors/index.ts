import type { BehaviorContext, BehaviorModule, Unmount } from './types'

// Register der Verhaltensmodule (DESIGN §9.12, ARCHITEKTUR §9.5/§15.1): Name = `data-behavior` = Dateiname
// (kebab-case). Die App lädt Module per `import()` nur, wenn die Seite sie braucht (`BehaviorHost`); die
// Vorschau-Laufzeit importiert sie statisch. Framework-frei (AK-A-2-03).

export const BEHAVIOR_LOADERS = {
  'add-to-cart': () => import('./add-to-cart'),
  'copy-button': () => import('./copy-button'),
  'fitness-coco': () => import('./fitness-coco'),
  'buy-bar': () => import('./buy-bar'),
  'cart-count': () => import('./cart-count'),
  gallery: () => import('./gallery'),
  lightbox: () => import('./lightbox'),
  lost: () => import('./lost'),
  menu: () => import('./menu'),
  'motion-toggle': () => import('./motion-toggle'),
  'price-tag-swing': () => import('./price-tag-swing'),
  'product-status': () => import('./product-status'),
  'reservation-countdown': () => import('./reservation-countdown'),
  'sold-stamp': () => import('./sold-stamp'),
  'thanks-moment': () => import('./thanks-moment'),
  'thanks-poll': () => import('./thanks-poll'),
} satisfies Record<string, () => Promise<BehaviorModule>>

export type BehaviorName = keyof typeof BEHAVIOR_LOADERS
export type BehaviorLoader = (name: BehaviorName) => Promise<BehaviorModule>

export const BEHAVIOR_NAMES = Object.keys(BEHAVIOR_LOADERS) as BehaviorName[]

export const isBehaviorName = (name: string): name is BehaviorName =>
  Object.prototype.hasOwnProperty.call(BEHAVIOR_LOADERS, name)

const defaultLoader: BehaviorLoader = (name) => BEHAVIOR_LOADERS[name]()

/**
 * Alle Module laden im Modus `app` erst nach dem `load`-Ereignis. Die Seite funktioniert bis dahin ohne sie: Produktseite
 * (Galerie per Scrollen, Foto-Link auf die Datei, Kauf-Leiste verborgen, „In den Korb“ als normales Formular, Zustand
 * aus dem Server-HTML), Stück-Listen (Schild und Stempel statisch, P4.25), Seitenrahmen (Menü-Knopf als Link auf die
 * Fußnavigation, Korbzahl aus dem Server-HTML bzw. erst nach der ersten Korb-Aktion, Animationen-Schalter ohne Wirkung).
 * So zählen ihre Chunks nie zum Erstlade-JS (Budget ARCHITEKTUR §7.7): Vorher hing es von der Reihenfolge von Hydrierung
 * und `load` ab, ob Menü, Korbzahl und Animationen-Schalter (zusammen ≈ 4 KB gz) mitgezählt wurden – Messwerte
 * schwankten je Seite um diesen Betrag (R10/R26 150–155 KB). `product-status` fragt ohnehin erst „nach dem Laden“ (§9.3).
 */
export const AFTER_LOAD: ReadonlySet<BehaviorName> = new Set<BehaviorName>(BEHAVIOR_NAMES)

export interface MountedBehaviors {
  /** Erfüllt, sobald alle beim Aufruf gefundenen Elemente gebunden sind. */
  ready: Promise<void>
  /** Löst alle Bindungen (auch noch ladende: sie werden gar nicht erst gebunden). */
  unmount: Unmount
}

/**
 * Bindet alle `[data-behavior]` unterhalb von `scope` (Kopf, Inhalt und Fuß). Ein Attribut darf mehrere Namen
 * (durch Leerzeichen getrennt) tragen; unbekannte Namen werden übersprungen.
 */
export function mountBehaviors(
  scope: ParentNode,
  ctx: BehaviorContext = { mode: 'app' },
  load: BehaviorLoader = defaultLoader,
): MountedBehaviors {
  const unmounts: Unmount[] = []
  let active = true
  const jobs: Promise<void>[] = []
  const doc = scope instanceof Document ? scope : ((scope as Node).ownerDocument ?? document)
  const win = doc.defaultView
  let stopWaiting = () => {}
  const waiting = ctx.mode === 'app' && !!win && doc.readyState !== 'complete'
  const loaded =
    waiting && win
      ? new Promise<void>((resolve) => {
          const onLoad = () => resolve()
          win.addEventListener('load', onLoad, { once: true })
          stopWaiting = () => {
            win.removeEventListener('load', onLoad)
            resolve()
          }
        })
      : Promise.resolve()
  for (const el of Array.from(scope.querySelectorAll('[data-behavior]'))) {
    for (const name of (el.getAttribute('data-behavior') ?? '').split(/\s+/).filter(Boolean)) {
      if (!isBehaviorName(name)) continue
      const bind = () =>
        load(name).then((mod) => {
          if (active && el.isConnected) unmounts.push(mod.mount(el, ctx))
        })
      jobs.push(
        waiting && AFTER_LOAD.has(name) ? loaded.then(() => (active ? bind() : undefined)) : bind(),
      )
    }
  }
  return {
    ready: Promise.all(jobs).then(() => undefined),
    unmount: () => {
      active = false
      stopWaiting()
      for (const u of unmounts.splice(0).reverse()) u()
    },
  }
}
