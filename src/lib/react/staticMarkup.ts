import 'server-only'

import React, { type ReactElement, type ReactNode } from 'react'

// Statisches HTML aus React-Elementen per `react-dom/server` `renderToStaticMarkup` – für Mails (P4.13) und für
// Server-Markup, das React im Browser nicht hydrieren soll (`StaticHtml`: weniger hydrierte Elemente = kürzerer
// Hydrations-Task, Lighthouse-TBT P7). Im Server-Components-Graph von Next ist `react-dom/server` gesperrt; deshalb
// wird es zur Laufzeit direkt von Node geladen (am Bundler vorbei). Gerendert werden nur reine Funktionen ohne Hooks.

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

/** HTML ohne Hydrations-Marker; nur für hook-freie, synchrone Bäume (Mails). */
export async function renderStaticMarkup(element: ReactElement): Promise<string> {
  const render = await loadRenderer()
  return render(element)
}

const CLIENT_REFERENCE = Symbol.for('react.client.reference')

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function'

/**
 * Löst einen Server-Komponenten-Baum vollständig auf (auch `async`-Komponenten), sodass nur noch HTML-Elemente und
 * Fragmente übrig bleiben. Client-Komponenten und Sonderformen (memo, forwardRef, Suspense, Kontext) brechen ab: Sie
 * bräuchten React im Browser und gehören nicht in statisches HTML.
 */
export async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return node
  if (Array.isArray(node)) return Promise.all(node.map(resolveServerTree))
  if (isThenable(node)) return resolveServerTree((await node) as ReactNode)
  if (!React.isValidElement(node)) {
    throw new Error('resolveServerTree: nicht unterstützter Knoten (nur Elemente, Text, Listen)')
  }
  const { type, key } = node
  const props = node.props as Record<string, unknown> & { children?: ReactNode }
  if ((type as { $$typeof?: symbol } | null)?.$$typeof === CLIENT_REFERENCE) {
    throw new Error('resolveServerTree: Client-Komponente in statischem HTML')
  }
  if (typeof type === 'function') {
    return resolveServerTree(
      await (type as (p: Record<string, unknown>) => ReactNode | Promise<ReactNode>)(props),
    )
  }
  if (typeof type !== 'string' && type !== React.Fragment) {
    throw new Error('resolveServerTree: nicht unterstützter Elementtyp')
  }
  if (props.dangerouslySetInnerHTML !== undefined) return node
  return React.createElement(type, { ...props, key }, await resolveServerTree(props.children))
}

/**
 * Statisches HTML für `StaticHtml`. React setzt in statischem Markup vor jedes nicht-faule Bild ein
 * `<link rel="preload">` an Ort und Stelle; das gäbe Vorlade-Hinweise mitten im `<body>` (und änderte Abrufreihenfolge
 * und LCP). Deshalb sind dort nur Bilder mit `loading="lazy"` oder `fetchPriority="low"` erlaubt.
 */
export async function renderResolvedToHtml(tree: ReactNode): Promise<string> {
  const html = await renderStaticMarkup(React.createElement(React.Fragment, null, tree))
  if (html.includes('<link rel="preload"')) {
    throw new Error(
      'StaticHtml: Bild ohne loading="lazy"/fetchPriority="low" – React würde es im <body> vorladen',
    )
  }
  return html
}
