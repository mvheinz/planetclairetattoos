import { ENUM_LABELS } from '@/lib/enumLabels'
import type { FiberComponent, Locale, TextileFiber } from '@/lib/enums'

// Faserzusammensetzung (E-16, R-043, DATENMODELL §6.6.5). Reines Modul (auch im Browser nutzbar).

export interface FiberRow {
  component?: FiberComponent | string | null
  fiber?: TextileFiber | string | null
  percent?: number | null
}

const COMPONENT_ORDER: readonly FiberComponent[] = ['main', 'lining', 'trim', 'other']

function fiberName(fiber: string, locale: Locale): string {
  const label = ENUM_LABELS.TEXTILE_FIBERS[fiber as TextileFiber]
  if (!label) return fiber
  // Auf Englisch: amtliche deutsche Bezeichnung plus Übersetzung in Klammern (R-043).
  return locale === 'en' && label.en ? `${label.de} (${label.en})` : label.de
}

/**
 * „60 % Baumwolle, 40 % Polyester“; weitere Komponenten mit Präfix („Futter: 100 % Polyester“), je Komponente
 * absteigend nach Anteil.
 */
export function formatFibers(rows: readonly FiberRow[] | null | undefined, locale: Locale): string {
  if (!rows?.length) return ''
  const parts: string[] = []
  for (const component of COMPONENT_ORDER) {
    const list = rows
      .filter((r) => (r.component ?? 'main') === component && r.fiber && r.percent)
      .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
      .map((r) => `${r.percent} % ${fiberName(String(r.fiber), locale)}`)
    if (list.length === 0) continue
    const label = ENUM_LABELS.FIBER_COMPONENTS[component]
    const prefix = component === 'main' ? '' : `${locale === 'en' ? label.en : label.de}: `
    parts.push(prefix + list.join(', '))
  }
  return parts.join('; ')
}
