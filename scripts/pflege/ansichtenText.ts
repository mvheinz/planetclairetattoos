// Texte für den Katalog (U-88, PLAN P18.3): Preis, Eckdaten und gekürzte Beschreibung je Stück. Reine Funktionen.
import { ENUM_LABELS } from '../../src/lib/enumLabels'
import { PRODUCT_CATEGORIES, TEXTILE_CONDITIONS } from '../../src/lib/enums'
import { formatMoney } from '../../src/lib/money'
import type { BestandProduct } from '../../src/lib/bestand/schema'

export const CATEGORY_LABEL_DE: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c, ENUM_LABELS.PRODUCT_CATEGORIES[c].de]),
)
const CONDITION_DE: Record<string, string> = Object.fromEntries(
  TEXTILE_CONDITIONS.map((c) => [c, ENUM_LABELS.TEXTILE_CONDITIONS[c].de]),
)

const cm = (n: number) => String(n).replace('.', ',')

/** „B 7 × H 9 × T 2 cm“, „Ø 12 cm“ – leer, wenn keine Maße. */
export function dimensionsText(d: BestandProduct['dimensions']): string {
  const parts = [
    d.widthCm !== undefined ? `B ${cm(d.widthCm)}` : '',
    d.heightCm !== undefined ? `H ${cm(d.heightCm)}` : '',
    d.depthCm !== undefined ? `T ${cm(d.depthCm)}` : '',
  ].filter(Boolean)
  const dia = d.diameterCm !== undefined ? `Ø ${cm(d.diameterCm)} cm` : ''
  return [parts.length ? `${parts.join(' × ')} cm` : '', dia].filter(Boolean).join(', ')
}

/** Text auf höchstens `max` Zeichen kürzen, möglichst am Satzende. */
export function shorten(text: string, max = 170): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))} …`
}

export function catalogFacts(p: BestandProduct): {
  price: string
  facts: string[]
  description: string
} {
  const textile = p.category === 'textil' || p.category === 'cap'
  return {
    price: formatMoney(p.priceCents, 'de'),
    facts: [
      dimensionsText(p.dimensions),
      textile && p.sizeLabel ? `Größe ${p.sizeLabel.de}` : '',
      p.materials.de,
      textile && p.condition
        ? `${p.isSecondHand ? 'Second Hand, ' : ''}Zustand ${CONDITION_DE[p.condition] ?? p.condition}`
        : '',
    ].filter(Boolean),
    description: shorten(p.description.de),
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Inline: **fett**, `Code` (als hervorgehobener Text). */
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

/**
 * Kleine Markdown-Umwandlung für die iPad-Anleitung (`docs/owner/IPAD.md` → PDF): Überschriften, nummerierte und
 * einfache Listen (mit eingerückter Fortsetzung), Tabellen, Hinweise (`>`), Absätze. Mehr braucht die Anleitung nicht.
 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  const para: string[] = []
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para.length = 0
  }
  while (i < lines.length) {
    const line = lines[i]!
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      flush()
      out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`)
      i++
      continue
    }
    if (/^\|/.test(line)) {
      flush()
      const rows: string[][] = []
      while (i < lines.length && /^\|/.test(lines[i]!)) {
        const cells = lines[i]!.split('|')
          .slice(1, -1)
          .map((c) => c.trim())
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      out.push(
        `<table><thead><tr>${(head ?? []).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      )
      continue
    }
    const list = /^(\d+\.|-)\s+(.*)$/.exec(line)
    if (list) {
      flush()
      const ordered = list[1] !== '-'
      const items: string[] = []
      while (i < lines.length) {
        const m = /^(\d+\.|-)\s+(.*)$/.exec(lines[i]!)
        if (m && (m[1] !== '-') === ordered) {
          items.push(m[2]!)
          i++
        } else if (/^\s{2,}\S/.test(lines[i]!) && items.length) {
          items[items.length - 1] += ` ${lines[i]!.trim()}`
          i++
        } else break
      }
      const tag = ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`)
      continue
    }
    if (/^>\s?/.test(line)) {
      flush()
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i]!))
        quote.push(lines[i++]!.replace(/^>\s?/, ''))
      out.push(`<aside>${inline(quote.join(' '))}</aside>`)
      continue
    }
    if (!line.trim()) flush()
    else para.push(line.trim())
    i++
  }
  flush()
  return out.join('\n')
}
