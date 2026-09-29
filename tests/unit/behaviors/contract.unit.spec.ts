// @vitest-environment jsdom
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BEHAVIOR_LOADERS, BEHAVIOR_NAMES, mountBehaviors, type BehaviorName } from '@/behaviors'
import type { BehaviorContext, BehaviorModule } from '@/behaviors/types'

import { installTracker, type Tracker } from './harness'

// P2.6 Verhaltensmodule (KONZEPT §12.9, ARCHITEKTUR §14.6, DESIGN §9.12): Vertrag für jedes registrierte Modul.

const BEHAVIOR_DIR = path.resolve('src/behaviors')
const FRAMEWORK_FREE_DIRS = ['src/behaviors', 'src/leash', 'src/preview-runtime']
const INFRA_FILES = new Set(['index.ts', 'types.ts'])

const GALLERY_HTML =
  '<section data-behavior="gallery lightbox"><ul data-gallery-track tabindex="0">' +
  '<li data-gallery-slide="0"><a href="/a.webp" data-zoom-src="/a.webp" data-zoom-w="640"><img alt="A"></a></li>' +
  '<li data-gallery-slide="1"><a href="/b.webp" data-zoom-src="/b.webp"><img alt="B"></a></li></ul>' +
  '<button type="button" data-gallery-prev hidden>‹</button><button type="button" data-gallery-next hidden>›</button>' +
  '<span data-gallery-dot="0"></span><span data-gallery-dot="1"></span><span data-gallery-counter>1 / 2</span>' +
  '<ul data-gallery-thumbs hidden><li><button type="button" data-gallery-thumb="0">1</button></li>' +
  '<li><button type="button" data-gallery-thumb="1">2</button></li></ul>' +
  '<dialog data-lightbox><div data-lightbox-stage></div>' +
  '<p data-lightbox-counter></p><button type="button" data-lightbox-close>Schließen</button></dialog></section>'

/**
 * Je Modul: Markup und eine Übung, die das Verhalten auslöst (Listener, Timer, Animationen entstehen). Neue Module
 * brauchen hier einen Eintrag – der Vertragstest schlägt sonst fehl.
 */
const FIXTURES: Record<BehaviorName, { html: string; exercise: (root: Element) => void }> = {
  gallery: {
    html: GALLERY_HTML,
    exercise: (root) => {
      root.querySelector<HTMLElement>('[data-gallery-next]')!.click()
      root.querySelector<HTMLElement>('[data-gallery-thumb="0"]')!.click()
      const track = root.querySelector('[data-gallery-track]')!
      track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      track.dispatchEvent(new Event('scroll'))
    },
  },
  lightbox: {
    html: GALLERY_HTML,
    exercise: (root) => {
      root.querySelector<HTMLElement>('a[data-zoom-src]')!.click()
      const dialog = root.querySelector('[data-lightbox]')!
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      vi.runOnlyPendingTimers()
    },
  },
  'buy-bar': {
    html:
      '<span id="add-to-cart"><button type="button">In den Korb</button></span>' +
      '<div data-behavior="buy-bar" data-buy-bar hidden><button type="button">In den Korb</button></div>',
    exercise: () => {},
  },
  'add-to-cart': {
    html:
      '<div data-buy-area data-buy-state="available"><p id="in-cart" data-in-cart hidden>Liegt schon in deinem Korb ' +
      '<a href="/de/warenkorb">Zum Korb</a></p><form data-behavior="add-to-cart" data-product-id="17" ' +
      'data-text-add="In den Korb" data-text-reserved="Gerade reserviert"><input type="hidden" name="productId" ' +
      'value="17"><input type="hidden" name="itemNumber" value="17"><input type="hidden" name="locale" value="de">' +
      '<button type="submit"><span>In den Korb</span></button></form><div data-buy-notes aria-live="polite">' +
      '<p data-buy-confirm hidden>Liegt im Korb</p><p data-buy-note="cart_full" hidden>voll</p></div>' +
      '<div data-sold-view hidden><p data-sold-text>Schon verkauft</p></div></div>' +
      '<div class="coco" data-leash-coco><div class="coco__hop"></div></div>',
    exercise: (root) => {
      // App ohne hereingereichte Action fiele auf das normale Absenden zurück (in jsdom nicht umgesetzt).
      ;(root as HTMLFormElement).submit = () => {}
      root.querySelector<HTMLElement>('button')!.click()
      document.dispatchEvent(
        new CustomEvent('pc:product-state', { detail: { id: '17', state: 'reserved' } }),
      )
      document.dispatchEvent(
        new CustomEvent('pc:cart-item', { detail: { id: '17', view: 'in-cart', added: true } }),
      )
    },
  },
  'product-status': {
    html:
      '<ul data-behavior="product-status" data-label-reserved=", gerade reserviert" data-label-sold=", verkauft" ' +
      'data-label-gone=", nicht mehr da"><li><a href="/de/shop/017-vase" data-product-card data-product-id="17" ' +
      'data-status="available" aria-label="Vase, 45 €"><span data-badge="reserved" hidden>reserviert</span></a></li></ul>',
    exercise: () => {},
  },
  'cart-count': {
    html: '<a href="/de/korb" data-behavior="cart-count">Korb <span data-cart-count hidden></span></a>',
    exercise: () => {
      document.dispatchEvent(new CustomEvent('pc:cart-change', { detail: { count: 2 } }))
    },
  },
  'motion-toggle': {
    html:
      '<button type="button" data-behavior="motion-toggle" data-label-on="an" data-label-off="aus" ' +
      'data-label-off-system="aus (Systemeinstellung)" aria-pressed="true" hidden>Animationen: ' +
      '<span data-motion-state>an</span></button>',
    exercise: (root) => {
      ;(root as HTMLElement).click()
      ;(root as HTMLElement).click()
      document.documentElement.removeAttribute('data-motion')
      // jsdom verschickt nach `localStorage.setItem` ein `storage`-Ereignis per Timer (nicht vom Modul).
      vi.runOnlyPendingTimers()
    },
  },
  lost: {
    // Linie schon gezeichnet → Schwingen und Weglaufen starten beim Binden (MI-11).
    html:
      '<div data-leash-layer data-leash-drawn></div>' +
      '<div data-behavior="lost"><span data-leash-anchor="start"></span>' +
      '<svg data-lost-end></svg><div class="coco" data-lost-coco data-boil="off"></div></div>',
    exercise: () => {
      document.documentElement.setAttribute('data-motion', 'reduced')
      document.documentElement.removeAttribute('data-motion')
    },
  },
  'price-tag-swing': {
    html:
      '<ul data-behavior="price-tag-swing"><li><a href="/de/shop/017-vase" data-product-card>' +
      '<span data-price-tag="hanging"><span data-price-tag-swing data-angle="4">45 €</span></span></a></li></ul>',
    exercise: (root) => {
      const card = root.querySelector('[data-product-card]')!
      card.dispatchEvent(new Event('focusin', { bubbles: true }))
      card.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    },
  },
  'sold-stamp': {
    html:
      '<ul data-behavior="sold-stamp"><li><a href="/de/shop/017-vase" data-product-card data-product-id="17">' +
      '<span data-price-tag="hanging"><span data-price-tag-swing data-angle="4">45 €' +
      '<span data-sold-stamp data-angle="-13" aria-hidden="true" hidden>sold</span></span></span></a></li></ul>',
    exercise: () => {
      document.dispatchEvent(new CustomEvent('pc:product-sold', { detail: { id: 17 } }))
      vi.advanceTimersByTime(0)
    },
  },
  'copy-button': {
    html:
      '<p><span id="st" role="status"></span><button type="button" data-behavior="copy-button" ' +
      'data-copy="DE36000000000000000000" data-copied-text="Kopiert" data-copy-failed-text="Ging nicht" ' +
      'data-copy-status-id="st" hidden>IBAN kopieren</button></p>',
    exercise: (root) => {
      ;(root as HTMLElement).click()
    },
  },
  'thanks-poll': {
    html:
      '<div data-behavior="thanks-poll" data-state="waiting" ' +
      'data-state-url="/api/checkout/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/state">' +
      '<p data-thanks-long hidden>Das dauert länger als sonst.</p></div>',
    exercise: () => {
      vi.advanceTimersByTime(4000)
    },
  },
  'thanks-moment': {
    html:
      '<div data-behavior="thanks-moment"><div class="coco" data-thanks-coco data-pose="sitzen" data-boil="off">' +
      '<div class="coco__hop"><svg><use class="f f-a" href="/art/coco.svg#coco-sitzen-a"></use></svg></div></div>' +
      '<ul data-behavior="sold-stamp"><li data-product-id="17"><span data-price-tag="mini">' +
      '<span data-price-tag-swing data-angle="4">45 €<span data-sold-stamp data-angle="-13" hidden>sold</span>' +
      '</span></span></li></ul></div>',
    exercise: () => {
      vi.advanceTimersByTime(1500)
      document.documentElement.setAttribute('data-motion', 'reduced')
      document.documentElement.removeAttribute('data-motion')
    },
  },
  menu: {
    html:
      '<a href="#fussnavigation" data-menu-trigger aria-controls="menu" aria-expanded="false">Menü</a>' +
      '<dialog id="menu" data-behavior="menu"><button type="button" data-menu-close-button>Schließen</button>' +
      '<ul><li data-menu-item><a href="/de">Start</a></li><li data-menu-item><a href="/de/shop">Shop</a></li></ul>' +
      '<div data-coco-slot aria-hidden="true"></div></dialog>',
    exercise: () => {
      document.querySelector<HTMLElement>('[data-menu-trigger]')!.click()
      document
        .querySelector('#menu')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      document
        .querySelector('#menu')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      // jsdom legt bei `focus()` einen eigenen Timer an (nicht vom Modul); das Menü selbst nutzt keine Timer.
      vi.runOnlyPendingTimers()
    },
  },
}

function behaviorFiles(): string[] {
  return readdirSync(BEHAVIOR_DIR).filter((f) => /\.ts$/.test(f) && !INFRA_FILES.has(f))
}

function listSources(dir: string): string[] {
  const abs = path.resolve(dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs).flatMap((name) => {
    const p = path.join(abs, name)
    if (statSync(p).isDirectory()) return listSources(path.join(dir, name))
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path.join(dir, name)] : []
  })
}

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g
const FORBIDDEN = /^(react|react-dom|next|payload)(\/|$)|^@payloadcms\//

function resolveLocal(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.resolve('src', spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

/** Alle Importe einer Datei samt aller lokal (relativ oder `@/`) erreichbaren Dateien. */
function transitiveImports(entry: string): { file: string; spec: string }[] {
  const seen = new Set<string>()
  const found: { file: string; spec: string }[] = []
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = (m[1] ?? m[2] ?? m[3])!
      found.push({ file: path.relative(process.cwd(), file), spec })
      const local = resolveLocal(file, spec)
      if (local) visit(local)
    }
  }
  visit(path.resolve(entry))
  return found
}

let tracker: Tracker
beforeEach(() => {
  vi.useFakeTimers()
  tracker = installTracker()
  document.body.innerHTML = ''
})
afterEach(() => {
  tracker.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function load(name: BehaviorName): Promise<BehaviorModule> {
  return (await BEHAVIOR_LOADERS[name]()) as BehaviorModule
}

function fixture(name: BehaviorName): Element {
  const host = document.createElement('div')
  host.innerHTML = FIXTURES[name].html
  document.body.append(host)
  const root = host.querySelector(`[data-behavior~="${name}"]`)
  if (!root) throw new Error(`Fixture ${name} ohne data-behavior`)
  return root
}

describe('AK-A-15-02 Register und Dateien', () => {
  it('AK-A-15-02 jede Datei unter src/behaviors/ ist registriert (Dateiname = data-behavior, kebab-case)', () => {
    const files = behaviorFiles().map((f) => f.replace(/\.ts$/, ''))
    expect(files.sort()).toEqual([...BEHAVIOR_NAMES].sort())
    for (const name of files) expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(Object.keys(FIXTURES).sort()).toEqual([...BEHAVIOR_NAMES].sort())
  })

  it.each(BEHAVIOR_NAMES)('AK-A-15-02 %s exportiert mount mit Rückgabe unmount', async (name) => {
    const mod = await load(name)
    expect(typeof mod.mount).toBe('function')
    const unmount = mod.mount(fixture(name), { mode: 'app' })
    expect(typeof unmount).toBe('function')
    unmount()
  })
})

describe('AK-A-2-03 framework-frei', () => {
  it('AK-A-2-03 src/behaviors, src/leash und src/preview-runtime importieren (auch transitiv) weder react, next noch payload', () => {
    const offenders: string[] = []
    for (const dir of FRAMEWORK_FREE_DIRS) {
      for (const file of listSources(dir)) {
        for (const { file: at, spec } of transitiveImports(file)) {
          if (FORBIDDEN.test(spec)) offenders.push(`${file} → ${at}: ${spec}`)
        }
      }
    }
    expect(offenders).toEqual([])
    expect(listSources('src/behaviors').length).toBeGreaterThan(2)
  })

  it('Gegenprobe: der Import-Scanner erkennt verbotene Importe', () => {
    const src = `import React from 'react'\nimport { x } from "next/navigation"\nconst m = import('payload')\nimport '@payloadcms/ui'`
    const specs = [...src.matchAll(IMPORT_RE)].map((m) => (m[1] ?? m[2] ?? m[3])!)
    expect(specs.filter((s) => FORBIDDEN.test(s))).toEqual([
      'react',
      'next/navigation',
      'payload',
      '@payloadcms/ui',
    ])
  })
})

describe('AK-DS-18 mount/unmount räumt vollständig auf', () => {
  it.each(BEHAVIOR_NAMES)(
    'AK-DS-18 %s: nach unmount keine Listener, Observer, Timer, Animationen',
    async (name) => {
      const mod = await load(name)
      for (const mode of ['app', 'preview'] as const) {
        const root = fixture(name)
        const unmount = mod.mount(root, { mode })
        FIXTURES[name].exercise(root)
        unmount()
        expect(tracker.openListeners(), `${mode}: Listener`).toEqual([])
        expect(tracker.openObservers(), `${mode}: Observer`).toEqual([])
        expect(vi.getTimerCount(), `${mode}: Timer`).toBe(0)
        expect(document.getAnimations(), `${mode}: Animationen`).toEqual([])
        document.body.innerHTML = ''
      }
    },
  )

  it.each(BEHAVIOR_NAMES)('AK-DS-18 %s: zweites mount auf neuem DOM funktioniert', async (name) => {
    const mod = await load(name)
    const first = fixture(name)
    mod.mount(first, { mode: 'app' })()
    document.body.innerHTML = ''
    const second = fixture(name)
    const unmount = mod.mount(second, { mode: 'app' })
    expect(() => FIXTURES[name].exercise(second)).not.toThrow()
    unmount()
    expect(tracker.openListeners()).toEqual([])
  })

  it.each(BEHAVIOR_NAMES)(
    'AK-DS-18 %s: im Modus preview kein fetch/XHR, kein Cookie, kein Web-Storage',
    async (name) => {
      const mod = await load(name)
      const root = fixture(name)
      const unmount = mod.mount(root, { mode: 'preview' })
      FIXTURES[name].exercise(root)
      await vi.runAllTimersAsync()
      unmount()
      expect(tracker.sensitive).toEqual([])
    },
  )

  it('Gegenprobe: der Tracker bemerkt vergessene Listener, Timer und verbotene Zugriffe', () => {
    const leaky: BehaviorModule = {
      mount: (root) => {
        root.addEventListener('click', () => {})
        setTimeout(() => {}, 1000)
        root.animate([{ opacity: 0 }], 100)
        void document.cookie
        return () => {}
      },
    }
    const root = fixture('cart-count')
    leaky.mount(root, { mode: 'preview' } satisfies BehaviorContext)()
    expect(tracker.openListeners()).toEqual(['<a>:click'])
    expect(vi.getTimerCount()).toBe(1)
    expect(document.getAnimations()).toHaveLength(1)
    expect(tracker.sensitive).toEqual(['document.cookie (lesen)'])
    vi.clearAllTimers()
  })
})

describe('mountBehaviors (BehaviorHost, Vorschau-Router)', () => {
  it('bindet alle [data-behavior] in Kopf, Inhalt und Fuß, überspringt Unbekanntes und löst alles wieder', async () => {
    document.body.innerHTML =
      '<header><a data-behavior="cart-count"><span data-cart-count hidden></span></a></header>' +
      '<main><p data-behavior="gibt-es-nicht">x</p></main>' +
      '<footer><a data-behavior="cart-count"><span data-cart-count hidden></span></a></footer>'
    const mounted = mountBehaviors(document, { mode: 'preview' })
    await mounted.ready
    expect(tracker.openListeners()).toEqual(['document:pc:cart-change', 'document:pc:cart-change'])
    mounted.unmount()
    expect(tracker.openListeners()).toEqual([])
  })

  it('lädt nur benötigte Module und bindet nach frühem unmount nichts mehr', async () => {
    document.body.innerHTML = '<a data-behavior="cart-count"></a>'
    const loader = vi.fn(
      async (name: BehaviorName) => (await BEHAVIOR_LOADERS[name]()) as BehaviorModule,
    )
    const mounted = mountBehaviors(document, { mode: 'preview' }, loader)
    mounted.unmount()
    await mounted.ready
    expect(loader).toHaveBeenCalledWith('cart-count')
    expect(tracker.openListeners()).toEqual([])

    document.body.innerHTML = '<p>ohne Verhalten</p>'
    loader.mockClear()
    await mountBehaviors(document, { mode: 'app' }, loader).ready
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('AFTER_LOAD: Produktseiten-Module erst nach dem load-Ereignis (Erstlade-Budget)', () => {
  it('Modus app bei laufendem Laden: gallery wartet auf load, cart-count nicht; unmount vorher bindet nichts', async () => {
    document.body.innerHTML =
      '<a data-behavior="cart-count"></a><section data-behavior="gallery"></section>'
    const state = vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive')
    const loader = vi.fn(
      async (name: BehaviorName) => (await BEHAVIOR_LOADERS[name]()) as BehaviorModule,
    )
    const mounted = mountBehaviors(document, { mode: 'app' }, loader)
    await Promise.resolve()
    expect(loader.mock.calls.map((c) => c[0])).toEqual(['cart-count'])
    window.dispatchEvent(new Event('load'))
    await mounted.ready
    expect(loader.mock.calls.map((c) => c[0])).toEqual(['cart-count', 'gallery'])
    mounted.unmount()

    loader.mockClear()
    const early = mountBehaviors(document, { mode: 'app' }, loader)
    early.unmount()
    await early.ready
    expect(loader.mock.calls.map((c) => c[0])).toEqual(['cart-count'])
    expect(tracker.openListeners()).toEqual([])
    state.mockRestore()
  })

  it('Modus preview: sofort', async () => {
    document.body.innerHTML = '<section data-behavior="gallery"></section>'
    const state = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const loader = vi.fn(
      async (name: BehaviorName) => (await BEHAVIOR_LOADERS[name]()) as BehaviorModule,
    )
    await mountBehaviors(document, { mode: 'preview' }, loader).ready
    expect(loader).toHaveBeenCalledWith('gallery')
    state.mockRestore()
  })
})
