import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import styles from './RichTextContent.module.css'

// Lexical-Rich-Text als Server-HTML (Rechtstexte R21–R25, Textblöcke aus `pages`). Die Seite trägt genau eine `h1`
// (R-010): Überschriften der Ebene 1 im Inhalt werden zu `h2`. Reines HTML ohne Skript und ohne Animation.
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  heading: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const tag = node.tag === 'h1' ? 'h2' : node.tag
    return React.createElement(tag, null, children)
  },
})

export function RichTextContent({ data, className }: { data: unknown; className?: string }) {
  if (!data || typeof data !== 'object' || !('root' in data)) return null
  return (
    <RichText
      data={data as SerializedEditorState}
      converters={converters}
      className={className ? `${styles.prose} ${className}` : styles.prose}
    />
  )
}
