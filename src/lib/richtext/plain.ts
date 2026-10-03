// Klartext ↔ Lexical (SEED-SPEC §2.4, PLAN P7.9): Leerzeilen trennen Absätze, Zeilen mit `- ` werden zu Listen,
// `**…**` fett, `[Text](url)` Links; zusätzlich `## ` am Blockanfang → Überschrift H2. `toLexical` nutzt der Seed
// (`src/lib/seed/lexical.ts`) und das Speichern der Tattoo-Texte; `lexicalToPlain` ist die Umkehrung für die
// Textfelder der Verwaltung (Handy-Formular statt Rich-Text-Editor). Rein, ohne Server-Abhängigkeiten.

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

const IS_BOLD = 1

function inlineToPlain(nodes: unknown, state: { lossy: boolean }): string {
  if (!Array.isArray(nodes)) return ''
  let out = ''
  for (const raw of nodes) {
    const n = (raw ?? {}) as Node
    if (n.type === 'text') {
      const text = typeof n.text === 'string' ? n.text : ''
      const format = typeof n.format === 'number' ? n.format : 0
      if (format & ~IS_BOLD) state.lossy = true
      out += format & IS_BOLD && text.trim() ? `**${text}**` : text
    } else if (n.type === 'linebreak') {
      out += '\n'
    } else if (n.type === 'link' || n.type === 'autolink') {
      const url = String(((n.fields ?? {}) as Node).url ?? n.url ?? '')
      out += `[${inlineToPlain(n.children, state)}](${url})`
    } else {
      state.lossy = true
      out += inlineToPlain(n.children, state)
    }
  }
  return out
}

/**
 * Lexical → Klartext mit der Auszeichnung von `toLexical` (Umkehrung). `lossy = true`, wenn das Dokument mehr
 * Formatierung enthält, als der Klartext abbilden kann (z. B. kursiv, nummerierte Listen, H3) – das Formular weist
 * dann darauf hin.
 */
export function lexicalToPlain(value: unknown): { text: string; lossy: boolean } {
  const state = { lossy: false }
  const root = (value && typeof value === 'object' ? (value as { root?: Node }).root : null) ?? null
  if (!root || !Array.isArray(root.children)) return { text: '', lossy: false }
  const blocks: string[] = []
  for (const raw of root.children as Node[]) {
    const n = (raw ?? {}) as Node
    if (n.type === 'list') {
      if (n.listType !== 'bullet') state.lossy = true
      const items = (Array.isArray(n.children) ? n.children : []) as Node[]
      blocks.push(items.map((it) => `- ${inlineToPlain(it.children, state)}`).join('\n'))
    } else if (n.type === 'heading') {
      if (n.tag !== 'h2') state.lossy = true
      blocks.push(`## ${inlineToPlain(n.children, state)}`)
    } else {
      if (n.type !== 'paragraph') state.lossy = true
      blocks.push(inlineToPlain(n.children, state))
    }
  }
  return { text: blocks.filter((b) => b.trim() !== '').join('\n\n'), lossy: state.lossy }
}
