import 'server-only'

import type { CSSProperties } from 'react'

import { S } from './styles'

// Eingebettetes Bild per CID (KONZEPT §6.1). Als fertiges HTML eingesetzt: React 19 würde für ein `<img>` sonst ein
// `<link rel="preload">` erzeugen – in Mails unnötig und für Prüfungen auf externe Ressourcen irreführend.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const css = (style: CSSProperties) =>
  Object.entries(style)
    .map(
      ([k, v]) =>
        `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${typeof v === 'number' && v !== 0 ? `${v}px` : v}`,
    )
    .join(';')

export function CidImage(props: {
  cid: string
  alt: string
  width: number
  height: number
  style?: CSSProperties
}) {
  const style = css({ ...S.vignette, width: props.width, height: props.height, ...props.style })
  const html = `<img src="cid:${esc(props.cid)}" alt="${esc(props.alt)}" width="${props.width}" height="${props.height}" style="${esc(style)}"/>`
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
