import React from 'react'

import { Glyph, type IconShapes } from './Glyph'
import { ICON_SHAPES, type IconName } from './icons.generated'

export type { IconName, IconShapes }
export { Glyph }

// Icon per Name (DESIGN §6.5) – lädt die ganze Icon-Tabelle, daher nur in Server-Komponenten. Client-Komponenten
// nutzen `Glyph` mit der Einzelkonstante (`ICON_WARN` aus `./icons.generated`).
export function Icon({
  name,
  ...rest
}: {
  name: IconName
  label?: string
  size?: number | string
  className?: string
}) {
  return <Glyph shape={ICON_SHAPES[name]} {...rest} />
}
