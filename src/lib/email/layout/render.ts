import 'server-only'

import type { ReactElement } from 'react'

// HTML der Mails: React-Komponenten, gerendert mit `react-dom/server` `renderToStaticMarkup` (keine eigene
// Mail-Bibliothek, P4.13). Mails entstehen in Jobs, die im Server-Components-Graph von Next liegen (über
// `payload.config.ts`); dort ist `react-dom/server` gesperrt. Deshalb wird es zur Laufzeit direkt von Node geladen
// (am Bundler vorbei). Die Mail-Komponenten sind reine Funktionen ohne Hooks.

type RenderToStaticMarkup = (element: ReactElement) => string

let renderer: Promise<RenderToStaticMarkup> | undefined

function loadRenderer(): Promise<RenderToStaticMarkup> {
  const specifier = ['react-dom', 'server'].join('/')
  renderer ??= (
    import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ specifier
    ) as Promise<{
      renderToStaticMarkup?: RenderToStaticMarkup
      default?: { renderToStaticMarkup: RenderToStaticMarkup }
    }>
  ).then((m) => (m.renderToStaticMarkup ?? m.default!.renderToStaticMarkup) as RenderToStaticMarkup)
  renderer.catch(() => (renderer = undefined))
  return renderer
}

export async function renderMailHtml(element: ReactElement): Promise<string> {
  const render = await loadRenderer()
  return `<!DOCTYPE html>${render(element)}`
}
