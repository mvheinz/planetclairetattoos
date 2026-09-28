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

/**
 * Je Modul: Markup und eine Übung, die das Verhalten auslöst (Listener, Timer, Animationen entstehen). Neue Module
 * brauchen hier einen Eintrag – der Vertragstest schlägt sonst fehl.
 */
const FIXTURES: Record<BehaviorName, { html: string; exercise: (root: Element) => void }> = {
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
