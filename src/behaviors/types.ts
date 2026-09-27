// Verhaltensmodule (KONZEPT §12.9, ARCHITEKTUR §14.6, DESIGN §9.12): framework-frei, angebunden über
// `data-behavior="<name>"` am serverseitig gerenderten HTML. `mount` bindet ein Element und gibt `unmount` zurück, das
// alle eigenen Listener, Observer, Timer und Animationen wieder entfernt (AK-DS-18).

export type BehaviorMode = 'app' | 'preview'

export interface BehaviorContext {
  /** `preview`: Vorschau-Datei – kein Netz, kein Cookie, kein Web-Storage. */
  mode: BehaviorMode
}

export type Unmount = () => void

export type Mount = (root: Element, ctx?: BehaviorContext) => Unmount

export interface BehaviorModule {
  mount: Mount
}
