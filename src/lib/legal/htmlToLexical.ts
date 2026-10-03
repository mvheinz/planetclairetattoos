import 'server-only'

import { legalPlainTextToHtml, sanitizeLegalHtml } from './sanitize'

// Eingefügte Rechtstexte (PLAN P6.4, KONZEPT §7.13, KANZLEI-BRIEFING §1.2) → Lexical-Inhalt des Felds
// `legal-texts.content`. Eingabe ist ein HTML-Fragment oder reiner Text; beides läuft zuerst durch `sanitizeLegalHtml`
// (Allowlist, Überschriften ab `h2`). Der Editor der Rechtstexte kennt Absätze, Überschriften h2–h4, Listen, fett und
// Links – Tabellen werden zu Absätzen (eine Zeile je Tabellenzeile, Zellen mit „ · “ getrennt; Kopfzellen fett),
// kursiv bleibt als Format erhalten. Platzhalter wie `{{withdrawalUrl}}` bleiben unverändert Text bzw. Link-Ziel.

export type LegalInputFormat = 'html' | 'text'

type LNode = Record<string, unknown>

interface El {
  tag: string
  attrs: Record<string, string>
  children: Node[]
}
type Node = El | string

const VOID = new Set(['br'])
const BLOCK = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'table'])
const base = { direction: 'ltr', format: '', indent: 0, version: 1 } as const

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of raw.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g))
    out[m[1]!.toLowerCase()] = decode(m[2]!)
  return out
}

/** Baum aus bereinigtem HTML (wohlgeformt dank `sanitize-html`). */
function parse(html: string): El {
  const root: El = { tag: 'root', attrs: {}, children: [] }
  const stack: El[] = [root]
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g
  for (const m of html.matchAll(re)) {
    const top = stack.at(-1)!
    if (m[3] !== undefined) {
      top.children.push(decode(m[3]))
      continue
    }
    const tag = m[1]!.toLowerCase()
    if (m[0].startsWith('</')) {
      const idx = stack.map((e) => e.tag).lastIndexOf(tag)
      if (idx > 0) stack.length = idx
      continue
    }
    const el: El = { tag, attrs: parseAttrs(m[2] ?? ''), children: [] }
    top.children.push(el)
    if (!VOID.has(tag) && !m[0].endsWith('/>')) stack.push(el)
  }
  return root
}

function textNode(text: string, format: number): LNode {
  return { type: 'text', text, detail: 0, format, mode: 'normal', style: '', version: 1 }
}

/** Inline-Inhalt → Lexical-Knoten (fett = 1, kursiv = 2). */
function inline(nodes: readonly Node[], format = 0): LNode[] {
  const out: LNode[] = []
  for (const n of nodes) {
    if (typeof n === 'string') {
      const text = n.replace(/\s+/g, ' ')
      if (text) out.push(textNode(text, format))
      continue
    }
    if (n.tag === 'br') out.push({ type: 'linebreak', version: 1 })
    else if (n.tag === 'strong' || n.tag === 'th') out.push(...inline(n.children, format | 1))
    else if (n.tag === 'em') out.push(...inline(n.children, format | 2))
    else if (n.tag === 'a') {
      const children = inline(n.children, format)
      if (!children.length) continue
      out.push({
        type: 'link',
        ...base,
        fields: { linkType: 'custom', newTab: false, url: n.attrs.href ?? '' },
        children,
      })
    } else out.push(...inline(n.children, format))
  }
  return out
}

/** Leerraum am Anfang und Ende eines Blocks entfernen, leere Textknoten verwerfen. */
function trimInline(nodes: LNode[]): LNode[] {
  const list = [...nodes]
  const edge = (i: number, start: boolean) => {
    const n = list[i]
    if (n?.type !== 'text') return
    const t = start ? String(n.text).trimStart() : String(n.text).trimEnd()
    if (t) list[i] = { ...n, text: t }
    else list.splice(i, 1)
  }
  edge(0, true)
  edge(list.length - 1, false)
  return list
}

function paragraph(children: LNode[]): LNode | null {
  const c = trimInline(children)
  return c.length ? { type: 'paragraph', ...base, textFormat: 0, children: c } : null
}

function list(el: El): LNode {
  const tag = el.tag === 'ol' ? 'ol' : 'ul'
  const items: LNode[] = []
  for (const child of el.children) {
    if (typeof child === 'string' || child.tag !== 'li') continue
    const nested = child.children.filter(
      (c): c is El => typeof c !== 'string' && (c.tag === 'ul' || c.tag === 'ol'),
    )
    const own = trimInline(
      inline(child.children.filter((c) => typeof c === 'string' || !nested.includes(c as El))),
    )
    items.push({ type: 'listitem', ...base, value: items.length + 1, children: own })
    for (const sub of nested) {
      items.push({
        type: 'listitem',
        ...base,
        value: items.length + 1,
        children: [list(sub)],
      })
    }
  }
  return {
    type: 'list',
    ...base,
    listType: tag === 'ol' ? 'number' : 'bullet',
    start: 1,
    tag,
    children: items,
  }
}

function tableRows(el: El): LNode[] {
  const rows: El[] = []
  const walk = (e: El) => {
    for (const c of e.children) {
      if (typeof c === 'string') continue
      if (c.tag === 'tr') rows.push(c)
      else walk(c)
    }
  }
  walk(el)
  const out: LNode[] = []
  for (const row of rows) {
    const cells = row.children.filter((c): c is El => typeof c !== 'string')
    const children: LNode[] = []
    cells.forEach((cell, i) => {
      if (i > 0) children.push(textNode(' · ', 0))
      children.push(...trimInline(inline([cell])))
    })
    const p = paragraph(children)
    if (p) out.push(p)
  }
  return out
}

function blocks(nodes: readonly Node[]): LNode[] {
  const out: LNode[] = []
  let pending: Node[] = []
  const flush = () => {
    const p = paragraph(inline(pending))
    if (p) out.push(p)
    pending = []
  }
  for (const n of nodes) {
    if (typeof n === 'string' || !BLOCK.has(n.tag)) {
      if (typeof n !== 'string' && n.tag === 'li') {
        flush()
        out.push(list({ tag: 'ul', attrs: {}, children: [n] }))
        continue
      }
      pending.push(n)
      continue
    }
    flush()
    if (n.tag === 'p') {
      const p = paragraph(inline(n.children))
      if (p) out.push(p)
    } else if (n.tag === 'ul' || n.tag === 'ol') out.push(list(n))
    else if (n.tag === 'table') out.push(...tableRows(n))
    else {
      const c = trimInline(inline(n.children))
      if (c.length) out.push({ type: 'heading', ...base, tag: n.tag, children: c })
    }
  }
  flush()
  return out
}

export interface LegalLexical {
  root: LNode & { children: LNode[] }
}

/** Bereinigtes HTML-Fragment → Lexical. */
export function legalHtmlToLexical(html: string): LegalLexical {
  const children = blocks(parse(sanitizeLegalHtml(html)).children)
  return { root: { type: 'root', ...base, children } }
}

/** Eingabe (HTML oder Text) → Lexical; `null`, wenn nach der Bereinigung nichts übrig bleibt. */
export function legalInputToLexical(input: string, format: LegalInputFormat): LegalLexical | null {
  const html = format === 'text' ? legalPlainTextToHtml(input) : input
  const doc = legalHtmlToLexical(html)
  return doc.root.children.length ? doc : null
}
