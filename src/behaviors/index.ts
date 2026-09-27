import type { BehaviorContext, BehaviorModule, Unmount } from './types'

// Register der Verhaltensmodule (DESIGN §9.12, ARCHITEKTUR §9.5/§15.1): Name = `data-behavior` = Dateiname
// (kebab-case). Die App lädt Module per `import()` nur, wenn die Seite sie braucht (`BehaviorHost`); die
// Vorschau-Laufzeit importiert sie statisch. Framework-frei (AK-A-2-03).

export const BEHAVIOR_LOADERS = {
  'cart-count': () => import('./cart-count'),
  menu: () => import('./menu'),
} satisfies Record<string, () => Promise<BehaviorModule>>

export type BehaviorName = keyof typeof BEHAVIOR_LOADERS
export type BehaviorLoader = (name: BehaviorName) => Promise<BehaviorModule>

export const BEHAVIOR_NAMES = Object.keys(BEHAVIOR_LOADERS) as BehaviorName[]

export const isBehaviorName = (name: string): name is BehaviorName =>
  Object.prototype.hasOwnProperty.call(BEHAVIOR_LOADERS, name)

const defaultLoader: BehaviorLoader = (name) => BEHAVIOR_LOADERS[name]()

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
  for (const el of Array.from(scope.querySelectorAll('[data-behavior]'))) {
    for (const name of (el.getAttribute('data-behavior') ?? '').split(/\s+/).filter(Boolean)) {
      if (!isBehaviorName(name)) continue
      jobs.push(
        load(name).then((mod) => {
          if (active && el.isConnected) unmounts.push(mod.mount(el, ctx))
        }),
      )
    }
  }
  return {
    ready: Promise.all(jobs).then(() => undefined),
    unmount: () => {
      active = false
      for (const u of unmounts.splice(0).reverse()) u()
    },
  }
}
