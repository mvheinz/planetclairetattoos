import type { BehaviorContext, Unmount } from './types'

// `data-behavior="language-targets"` (U-47, P13.8) auf Seiten mit sprachabhängigem Slug (Kategorie R03, Stück R04):
// Die Sprachlinks – „DE | EN“ in der Kopfleiste und der Umschalter im Fuß – kennen dort ohne Daten nur die Startseite
// der anderen Sprache. Das Modul übernimmt das Ziel aus den hreflang-Alternativen im `<head>` (Seiten-Metadaten). Nur in
// der App: Die Vorschau-Datei hat eigene Links. Kein Netz, kein Speicher, keine Listener.

/** Setzt das Ziel der Sprachlinks aus `<link rel="alternate" hreflang>`; gibt die Zahl der Änderungen zurück. */
export function syncLanguageTargets(doc: Document): number {
  let changed = 0
  for (const link of Array.from(
    doc.querySelectorAll<HTMLAnchorElement>(
      '[data-header-language][hreflang], [data-language-switcher] a[hreflang]',
    ),
  )) {
    const alt = doc.head?.querySelector<HTMLLinkElement>(
      `link[rel="alternate"][hreflang="${link.getAttribute('hreflang')}"]`,
    )
    if (!alt?.href) continue
    const url = new URL(alt.href, doc.baseURI)
    const href = `${url.pathname}${url.search}`
    if (link.getAttribute('href') !== href) {
      link.setAttribute('href', href)
      changed++
    }
  }
  return changed
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  if (ctx.mode === 'app') syncLanguageTargets(root.ownerDocument)
  return () => {}
}
