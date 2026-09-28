// Zeilenumbruch der OG-Titel (P3.14, DESIGN §12.6: Titel höchstens 3 Zeilen). Reines Modul: `measure` misst die Breite
// eines Texts in px (in den Bildern über die Laufweiten der TTF-Datei, im Test beliebig). Umbruch an Leerzeichen; zu
// lange Wörter werden hart getrennt. Passt der Titel nicht in `maxLines`, endet die letzte Zeile – an einer Wortgrenze,
// wenn möglich – mit „…“.

export interface WrapOptions {
  maxWidth: number
  maxLines: number
  measure: (text: string) => number
}

const ELLIPSIS = '…'

/** Längster Anfang von `word`, der in `maxWidth` passt (mindestens ein Zeichen). */
function fittingPrefix(word: string, maxWidth: number, measure: (t: string) => number): string {
  const chars = [...word]
  let n = chars.length
  while (n > 1 && measure(chars.slice(0, n).join('')) > maxWidth) n--
  return chars.slice(0, n).join('')
}

/** Kürzt `text` so, dass `text + „…“` in `maxWidth` passt – bevorzugt an einer Wortgrenze. */
export function ellipsize(text: string, maxWidth: number, measure: (t: string) => number): string {
  let t = text.trimEnd()
  if (measure(`${t}${ELLIPSIS}`) <= maxWidth)
    return `${t.replace(/[\s.,;:!?–-]+$/u, '')}${ELLIPSIS}`
  while (t.length > 0 && measure(`${t}${ELLIPSIS}`) > maxWidth) {
    const space = t.lastIndexOf(' ')
    t =
      space > 0 && measure(`${t.slice(0, space)}${ELLIPSIS}`) <= maxWidth
        ? t.slice(0, space)
        : [...t].slice(0, -1).join('')
    t = t.trimEnd()
  }
  return `${t.replace(/[\s.,;:!?–-]+$/u, '')}${ELLIPSIS}`
}

/** Bricht `text` in höchstens `maxLines` Zeilen um; jede Zeile passt in `maxWidth`. */
export function wrapLines(text: string, { maxWidth, maxLines, measure }: WrapOptions): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
    while (measure(current) > maxWidth && [...current].length > 1) {
      const head = fittingPrefix(current, maxWidth, measure)
      lines.push(head)
      current = current.slice(head.length)
    }
  }
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, maxWidth, measure)
  return kept
}
