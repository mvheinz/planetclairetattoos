import type { PvLang, PvRoute } from './types'

// Hash-Router der Vorschau-Datei (KONZEPT §12.5 Nr. 6, ARCHITEKTUR §14.6): leerer Hash → `#/de`; Suche nach
// `template[data-route]` inkl. Query, unbekannt → `/<sprache>/__404`. Beim Wechsel: Aufräumen der alten Seite
// (`unmount()` aller Verhaltensmodule, `destroy()` der Tuschelinie), Template in `#pv-root` klonen, `document.title`,
// `lang` und `<body>`-Attribute setzen, nach oben bzw. zum Anker scrollen, Fokus auf die H1 (`tabindex="-1"`), dann
// `mount()`/`mountLeash()` über `onMount`. Zurück/Vor des Browsers funktioniert (Ereignis `hashchange`).

export const DEFAULT_ROUTE = '/de'
export const notFoundRoute = (lang: PvLang) => `/${lang}/__404`

/** `#/de/tattoo/flash#f-012` → `{ route: '/de/tattoo/flash', anchor: 'f-012' }`; leer → Startseite. */
export function parseHash(hash: string): { route: string; anchor: string } {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith('/')) return { route: DEFAULT_ROUTE, anchor: raw ? safeDecode(raw) : '' }
  const i = raw.indexOf('#')
  const route = i >= 0 ? raw.slice(0, i) : raw
  const anchor = i >= 0 ? safeDecode(raw.slice(i + 1)) : ''
  return { route: route.length > 1 ? route.replace(/\/+$/, '') : route, anchor }
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

/** Sprache aus dem Routenpfad (`/en/…` → `en`); ohne Präfix (Zusatzseiten) → `null`. */
export function routeLang(route: string): PvLang | null {
  const seg = route.split(/[/?]/)[1]
  return seg === 'de' || seg === 'en' ? seg : null
}

export interface TemplateLike {
  route: string
  lang: string
}

/**
 * Wählt das Template: gleiche Route; bei mehreren (Zusatzseiten in DE und EN) das der aktuellen Sprache.
 * Unbekannt → 404 der Sprache (aus der Route bzw. der aktuellen Sprache). `null` nur, wenn es auch keine 404 gibt.
 */
export function selectTemplate<T extends TemplateLike>(
  templates: readonly T[],
  route: string,
  currentLang: PvLang,
): { template: T; lang: PvLang; found: boolean } | null {
  const candidates = templates.filter((t) => t.route === route)
  const pick =
    candidates.find((t) => t.lang === currentLang) ??
    candidates.find((t) => t.lang === (routeLang(route) ?? currentLang)) ??
    candidates[0]
  if (pick) {
    const lang = pick.lang === 'de' || pick.lang === 'en' ? pick.lang : currentLang
    return { template: pick, lang, found: true }
  }
  const lang = routeLang(route) ?? currentLang
  const nf = templates.find((t) => t.route === notFoundRoute(lang))
  return nf ? { template: nf, lang, found: false } : null
}

/** Routen-Liste für `window.__PV_ROUTES` (nur gebaute plus nicht gebaute Registry-Routen, wie in `#pv-data`). */
export function builtRoutes(routes: readonly PvRoute[]): PvRoute[] {
  return routes.filter((r) => r.built)
}

export interface RouterOptions {
  doc: Document
  root: HTMLElement
  /** Nach dem Einhängen der Seite; gibt die Aufräumfunktion zurück. */
  onMount: (
    root: HTMLElement,
    info: { route: string; lang: PvLang; leashKey: string },
  ) => () => void
  onLang?: (lang: PvLang) => void
}

export interface Router {
  readonly route: string
  readonly lang: PvLang
  start(): void
  destroy(): void
}

interface TemplateRef extends TemplateLike {
  el: HTMLTemplateElement
}

export function createRouter(options: RouterOptions): Router {
  const { doc, root } = options
  const win = doc.defaultView!
  const templates: TemplateRef[] = Array.from(
    doc.querySelectorAll<HTMLTemplateElement>('template[data-route]'),
  ).map((el) => ({
    el,
    route: el.getAttribute('data-route') ?? '',
    lang: el.getAttribute('data-lang') ?? 'de',
  }))
  let current = ''
  let lang: PvLang = 'de'
  let cleanup: (() => void) | null = null
  let appliedBodyAttrs: string[] = []
  let first = true

  const scrollToAnchor = (anchor: string) => {
    const target = anchor ? doc.getElementById(anchor) : null
    if (target) target.scrollIntoView()
    else win.scrollTo(0, 0)
  }

  const render = () => {
    const { route, anchor } = parseHash(win.location.hash)
    if (win.location.hash === '' || win.location.hash === '#') {
      win.history.replaceState(null, '', `#${DEFAULT_ROUTE}`)
    }
    if (route === current && !first) {
      scrollToAnchor(anchor)
      return
    }
    const picked = selectTemplate(templates, route, lang)
    if (!picked) return
    cleanup?.()
    cleanup = null
    const tpl = picked.template.el
    lang = picked.lang
    current = route
    root.replaceChildren(tpl.content.cloneNode(true))
    // `<body>`-Attribute der Seite (z. B. `data-preset`, `data-route`) – die der alten Seite zuerst entfernen.
    for (const name of appliedBodyAttrs) doc.body.removeAttribute(name)
    appliedBodyAttrs = []
    try {
      const attrs = JSON.parse(tpl.getAttribute('data-body') ?? '{}') as Record<string, string>
      for (const [k, v] of Object.entries(attrs)) {
        doc.body.setAttribute(k, v)
        appliedBodyAttrs.push(k)
      }
    } catch {
      // ungültige Attribute ignorieren
    }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-pv-lang]')))
      el.hidden = el.getAttribute('data-pv-lang') !== lang
    doc.title = tpl.getAttribute('data-title') ?? ''
    doc.documentElement.lang = lang
    options.onLang?.(lang)
    scrollToAnchor(anchor)
    if (!first) {
      const h1 = root.querySelector<HTMLElement>('h1')
      if (h1) {
        h1.setAttribute('tabindex', '-1')
        h1.focus({ preventScroll: !!anchor })
      }
    }
    first = false
    cleanup = options.onMount(root, {
      route,
      lang,
      leashKey: tpl.getAttribute('data-leash-key') ?? 'R28',
    })
  }

  const onHash = () => render()

  return {
    get route() {
      return current
    },
    get lang() {
      return lang
    },
    start() {
      win.addEventListener('hashchange', onHash)
      render()
    },
    destroy() {
      win.removeEventListener('hashchange', onHash)
      cleanup?.()
      cleanup = null
    },
  }
}
