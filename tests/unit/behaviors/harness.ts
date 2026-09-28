import { vi } from 'vitest'

// Prüfgerüst für Verhaltensmodule unter jsdom (AK-DS-18): protokolliert Listener, Observer, Timer, Animationen sowie
// Zugriffe auf Netz, Cookies und Web-Storage.

export interface Tracker {
  /** Noch angemeldete Listener (Ziel + Typ). */
  openListeners(): string[]
  /** Noch verbundene Observer. */
  openObservers(): string[]
  /** Laufende (nicht abgebrochene/beendete) Animationen. */
  runningAnimations(): number
  /** Protokoll verbotener Zugriffe (fetch, XHR, document.cookie, localStorage, sessionStorage). */
  sensitive: string[]
  restore(): void
}

type Listener = { target: EventTarget; type: string; fn: unknown; capture: boolean }

function describeTarget(t: EventTarget): string {
  if (t === window) return 'window'
  if (t === document) return 'document'
  if (t instanceof Element) return `<${t.tagName.toLowerCase()}>`
  return t.constructor?.name ?? 'EventTarget'
}

const captureOf = (o?: boolean | AddEventListenerOptions) =>
  typeof o === 'boolean' ? o : !!o?.capture

export function installTracker(): Tracker {
  const listeners: Listener[] = []
  const proto = EventTarget.prototype
  const origAdd = proto.addEventListener
  const origRemove = proto.removeEventListener
  proto.addEventListener = function (type, fn, opts) {
    listeners.push({ target: this, type, fn, capture: captureOf(opts) })
    return origAdd.call(this, type, fn, opts)
  }
  proto.removeEventListener = function (type, fn, opts) {
    const i = listeners.findIndex(
      (l) => l.target === this && l.type === type && l.fn === fn && l.capture === captureOf(opts),
    )
    if (i >= 0) listeners.splice(i, 1)
    return origRemove.call(this, type, fn, opts)
  }

  // Observer: jede Instanz zählt als offen, bis `disconnect()` gerufen wird.
  const observers = new Set<{ name: string }>()
  const observerNames = ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'] as const
  const originals: Record<string, unknown> = {}
  for (const name of observerNames) {
    const g = globalThis as unknown as Record<string, unknown>
    originals[name] = g[name]
    const Base = (g[name] ??
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
      }) as new (...args: unknown[]) => { disconnect(): void; observe(...a: unknown[]): void }
    g[name] = class extends Base {
      private readonly handle = { name }
      override observe(...a: unknown[]) {
        observers.add(this.handle)
        return super.observe(...a)
      }
      override disconnect() {
        observers.delete(this.handle)
        return super.disconnect()
      }
    }
  }

  // Web Animations: jsdom hat keine – einfache Nachbildung mit `document.getAnimations()`.
  const animations = new Set<{ cancel(): void }>()
  const origAnimate = Element.prototype.animate
  const origGetAnimations = (document as Document & { getAnimations?: unknown }).getAnimations
  Element.prototype.animate = function () {
    const anim = {
      onfinish: null as null | (() => void),
      cancel() {
        animations.delete(anim)
      },
      finish() {
        animations.delete(anim)
        anim.onfinish?.()
      },
    }
    animations.add(anim)
    return anim as unknown as Animation
  }
  ;(document as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [...animations]

  // Verbotene Zugriffe im Modus preview.
  const sensitive: string[] = []
  const fetchSpy = vi.fn(() => {
    sensitive.push('fetch')
    return Promise.reject(new Error('kein Netz'))
  })
  vi.stubGlobal('fetch', fetchSpy)
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function () {
    sensitive.push('XMLHttpRequest')
  } as typeof origOpen
  const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      sensitive.push('document.cookie (lesen)')
      return cookieDesc.get!.call(document)
    },
    set(v: string) {
      sensitive.push('document.cookie (schreiben)')
      cookieDesc.set!.call(document, v)
    },
  })
  const storageDescs: Record<string, PropertyDescriptor | undefined> = {}
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    storageDescs[name] = Object.getOwnPropertyDescriptor(window, name)
    const real = window[name]
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        sensitive.push(name)
        return real
      },
    })
  }

  return {
    openListeners: () => listeners.map((l) => `${describeTarget(l.target)}:${l.type}`),
    openObservers: () => [...observers].map((o) => o.name),
    runningAnimations: () => animations.size,
    sensitive,
    restore() {
      proto.addEventListener = origAdd
      proto.removeEventListener = origRemove
      for (const name of observerNames)
        (globalThis as unknown as Record<string, unknown>)[name] = originals[name]
      Element.prototype.animate = origAnimate
      ;(document as unknown as { getAnimations: unknown }).getAnimations = origGetAnimations
      vi.unstubAllGlobals()
      XMLHttpRequest.prototype.open = origOpen
      delete (document as unknown as { cookie?: string }).cookie
      for (const name of ['localStorage', 'sessionStorage'] as const) {
        const d = storageDescs[name]
        if (d) Object.defineProperty(window, name, d)
        else delete (window as unknown as Record<string, unknown>)[name]
      }
    },
  }
}
