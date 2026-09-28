import type { PvData, PvGroup, PvLang, PvRoute } from './types'

// Banner der Vorschau-Datei (KONZEPT §12.5 Nr. 8, R-182): oben auf jeder Seite, im Fluss (Inhalt rückt nach unten),
// nicht schließbar. Zeile 1 „Interne Vorschau – nicht weitergeben · Beispieldaten · Rechtstexte sind Platzhalter“,
// Zeile 2 „Vorschau – hier wird nichts gekauft. Stand {Datum}, Phase {Px}.“ – Sprache wie die aktuelle Seite. Der Knopf
// „Alle Seiten“ öffnet die Liste aller Routen, gruppiert, mit „noch nicht gebaut“-Markierung; `Esc` schließt.

export const GROUP_ORDER: readonly PvGroup[] = [
  'start',
  'shop',
  'tattoo',
  'service',
  'legal',
  'admin',
]

export interface Banner {
  setLang(lang: PvLang): void
  closeList(): void
  destroy(): void
}

/** Routen einer Sprache, gruppiert in fester Reihenfolge (Routen innerhalb der Gruppe in Dateireihenfolge). */
export function groupRoutes(routes: readonly PvRoute[], lang: PvLang): [PvGroup, PvRoute[]][] {
  return GROUP_ORDER.map(
    (g) => [g, routes.filter((r) => r.group === g && r.lang === lang)] as [PvGroup, PvRoute[]],
  ).filter(([, list]) => list.length > 0)
}

export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
}

export function installBanner(doc: Document, host: HTMLElement, data: PvData): Banner {
  let lang: PvLang = 'de'
  host.replaceChildren()
  const line1 = doc.createElement('p')
  line1.className = 'pv-banner__line pv-banner__line--strong'
  const line2 = doc.createElement('p')
  line2.className = 'pv-banner__line'
  const toggle = doc.createElement('button')
  toggle.type = 'button'
  toggle.className = 'pv-banner__toggle'
  toggle.setAttribute('aria-expanded', 'false')
  toggle.setAttribute('aria-controls', 'pv-all')
  const list = doc.createElement('nav')
  list.id = 'pv-all'
  list.className = 'pv-all'
  list.hidden = true
  host.append(line1, line2, toggle, list)

  const render = () => {
    const t = data.texts[lang]
    line1.textContent = t.bannerInternal
    line2.textContent = fillTemplate(t.bannerStand, { date: data.date[lang], phase: data.phase })
    toggle.textContent = t.allPages
    list.setAttribute('aria-label', t.allPages)
    list.replaceChildren()
    for (const [group, routes] of groupRoutes(data.routes, lang)) {
      const section = doc.createElement('section')
      const h = doc.createElement('h2')
      h.className = 'pv-all__group'
      h.textContent = t.groups[group]
      const ul = doc.createElement('ul')
      for (const r of routes) {
        const li = doc.createElement('li')
        if (r.built) {
          const a = doc.createElement('a')
          a.href = `#${r.route}`
          a.textContent = r.title || r.route
          li.appendChild(a)
        } else {
          const span = doc.createElement('span')
          span.className = 'pv-all__missing'
          span.textContent = `${r.title || r.route} – ${t.notBuilt}`
          li.appendChild(span)
        }
        ul.appendChild(li)
      }
      section.append(h, ul)
      list.appendChild(section)
    }
  }

  const setOpen = (open: boolean) => {
    list.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
  }
  const onToggle = () => setOpen(list.hidden)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !list.hidden) {
      setOpen(false)
      toggle.focus()
    }
  }
  const onListClick = (e: Event) => {
    if ((e.target as Element | null)?.closest?.('a')) setOpen(false)
  }
  toggle.addEventListener('click', onToggle)
  doc.addEventListener('keydown', onKey)
  list.addEventListener('click', onListClick)
  render()

  return {
    setLang(next) {
      if (next === lang) return
      lang = next
      render()
    },
    closeList: () => setOpen(false),
    destroy() {
      toggle.removeEventListener('click', onToggle)
      doc.removeEventListener('keydown', onKey)
      list.removeEventListener('click', onListClick)
      host.replaceChildren()
    },
  }
}
