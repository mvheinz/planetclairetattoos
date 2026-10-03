import 'server-only'

import React from 'react'

import { renderResolvedToHtml, resolveServerTree } from '@/lib/react/staticMarkup'

// Server-Markup, das React im Browser nicht hydriert (P7, Lighthouse-TBT): Ein Element trägt seinen Inhalt als fertiges
// HTML (`dangerouslySetInnerHTML`, erzeugt mit `react-dom/server`), React legt dafür beim Hydrieren keine Fasern an.
// Das HTML ist dasselbe wie bei normalem Rendern (ohne Kommentar-Trenner zwischen Textknoten) – Optik,
// Barrierefreiheit und Verhalten ohne JavaScript bleiben gleich. Interaktion nur über Verhaltensmodule
// (`data-behavior`, DOM statt React). Inhalt: nur Server-Komponenten – keine Client-Komponenten, keine Formulare mit
// Server-Aktion, Bilder nur `loading="lazy"`/`fetchPriority="low"` (sonst Fehler beim Rendern).
//
// Mit `as` (und weiteren Props) ist das äußere Element vorgegeben; ohne `as` muss `children` zu genau einem
// HTML-Element auflösen (z. B. `<ProductDetails …/>` → `<section>`), das dann selbst das äußere Element wird.
type StaticHtmlProps = {
  as?: keyof React.JSX.IntrinsicElements
  children: React.ReactNode
} & Record<string, unknown>

export async function StaticHtml({ as, children, ...props }: StaticHtmlProps) {
  const tree = await resolveServerTree(children)
  if (as) {
    const html = await renderResolvedToHtml(tree)
    return React.createElement(as, { ...props, dangerouslySetInnerHTML: { __html: html } })
  }
  if (tree === null) return null
  if (!React.isValidElement(tree) || typeof tree.type !== 'string') {
    throw new Error('StaticHtml ohne `as`: Inhalt muss genau ein HTML-Element sein')
  }
  const { children: inner, ...rootProps } = tree.props as Record<string, unknown> & {
    children?: React.ReactNode
  }
  if (rootProps.dangerouslySetInnerHTML !== undefined) return tree
  const html = await renderResolvedToHtml(inner)
  return React.createElement(tree.type, {
    ...rootProps,
    ...props,
    dangerouslySetInnerHTML: { __html: html },
  })
}
