import 'server-only'

// `toLexical(text)` (SEED-SPEC §2.4): Klartext der Datendateien → Lexical-Inhalt. Leerzeilen trennen Absätze, Zeilen
// mit `- ` werden zu Listen, `**…**` fett, `[Text](url)` Links; zusätzlich `## ` am Blockanfang → Überschrift H2
// (Gliederung der Rechtstext-Platzhalter, §3.4).

type Node = Record<string, unknown>

const base = { direction: 'ltr', format: '', indent: 0, version: 1 } as const

function textNode(text: string, bold = false): Node {
  return {
    type: 'text',
    text,
    detail: 0,
    format: bold ? 1 : 0,
    mode: 'normal',
    style: '',
    version: 1,
  }
}

/** Inline-Auszeichnung: `**fett**` und `[Text](Adresse)`. */
export function inlineNodes(line: string): Node[] {
  const out: Node[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push(textNode(line.slice(last, m.index)))
    if (m[1] !== undefined) out.push(textNode(m[1], true))
    else {
      out.push({
        type: 'link',
        ...base,
        fields: { linkType: 'custom', newTab: false, url: m[3] },
        children: [textNode(m[2]!)],
      })
    }
    last = m.index + m[0].length
  }
  if (last < line.length) out.push(textNode(line.slice(last)))
  return out
}

export function toLexical(text: string): { root: Node } {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  const children: Node[] = blocks.map((block) => {
    const lines = block.split('\n')
    if (lines.every((l) => l.startsWith('- '))) {
      return {
        type: 'list',
        ...base,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        children: lines.map((l, i) => ({
          type: 'listitem',
          ...base,
          value: i + 1,
          children: inlineNodes(l.slice(2)),
        })),
      }
    }
    if (lines.length === 1 && block.startsWith('## ')) {
      return { type: 'heading', ...base, tag: 'h2', children: inlineNodes(block.slice(3)) }
    }
    const inline: Node[] = []
    lines.forEach((l, i) => {
      if (i > 0) inline.push({ type: 'linebreak', version: 1 })
      inline.push(...inlineNodes(l))
    })
    return { type: 'paragraph', ...base, textFormat: 0, children: inline }
  })
  return { root: { type: 'root', ...base, children } }
}
