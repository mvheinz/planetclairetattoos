import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import styles from './RichTextContent.module.css'

// Lexical-Rich-Text als Server-HTML (Rechtstexte R21–R25, Textblöcke aus `pages`). Die Seite trägt genau eine `h1`
// (R-010): Überschriften der Ebene 1 im Inhalt werden zu `h2`. Reines HTML ohne Skript und ohne Animation. Optional
// vergibt `headingId` Anker-IDs (Datenschutzerklärung, KANZLEI-BRIEFING §11.10).

type HeadingId = (text: string, tag: string) => string | undefined

const textOf = (node: unknown): string => {
  const n = node as { text?: unknown; children?: unknown[] }
  if (typeof n.text === 'string') return n.text
  return Array.isArray(n.children) ? n.children.map(textOf).join('') : ''
}

const makeConverters =
  (headingId?: HeadingId): JSXConvertersFunction =>
  ({ defaultConverters }) => ({
    ...defaultConverters,
    // Externe Links (http/https) immer mit `rel="noopener noreferrer"` (R-139), auch aus dem CMS (z. B. Safer-Tattoo-Link
    // auf R17); interne Links wie gehabt.
    link: (args) => {
      const fields = (args.node as { fields?: { url?: string; newTab?: boolean; linkType?: string } })
        .fields
      const url = fields?.linkType === 'internal' ? undefined : fields?.url
      if (!url || !/^https?:\/\//i.test(url)) {
        const fallback = defaultConverters.link
        return typeof fallback === 'function' ? fallback(args) : null
      }
      return (
        <a
          href={url}
          rel="noopener noreferrer"
          {...(fields?.newTab ? { target: '_blank' } : {})}
        >
          {args.nodesToJSX({ nodes: args.node.children })}
        </a>
      )
    },
    heading: ({ node, nodesToJSX }) => {
      const children = nodesToJSX({ nodes: node.children })
      const tag = node.tag === 'h1' ? 'h2' : node.tag
      const id = headingId?.(textOf(node), tag)
      return React.createElement(tag, id ? { id } : null, children)
    },
  })

const defaultConverters = makeConverters()

export function RichTextContent({
  data,
  className,
  headingId,
}: {
  data: unknown
  className?: string
  headingId?: HeadingId
}) {
  if (!data || typeof data !== 'object' || !('root' in data)) return null
  return (
    <RichText
      data={data as SerializedEditorState}
      converters={headingId ? makeConverters(headingId) : defaultConverters}
      className={className ? `${styles.prose} ${className}` : styles.prose}
    />
  )
}
