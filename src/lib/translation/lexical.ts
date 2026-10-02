import 'server-only'

// Rich Text (Lexical) übersetzen (ARCHITEKTUR §3.6): Textknoten einsammeln, gebündelt übersetzen und in dieselbe
// Struktur zurückschreiben – ohne HTML-Umweg. Absätze, Listen, Überschriften, Links und Formatierung (fett, kursiv)
// bleiben unverändert, nur `text` der Knoten vom Typ `text` wird ersetzt. Leer- und Randzeichen bleiben stehen, damit
// „Hallo **Welt**“ nicht zu „HelloWorld“ zusammenwächst.

type Node = Record<string, unknown>

export interface LexicalState {
  root: Node
}

export function isLexicalState(value: unknown): value is LexicalState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { root?: unknown }).root === 'object' &&
    (value as { root: unknown }).root !== null
  )
}

function walk(node: Node, visit: (text: Node) => void): void {
  if (node.type === 'text' && typeof node.text === 'string') visit(node)
  const children = node.children
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object') walk(child as Node, visit)
    }
  }
}

const EDGES = /^(\s*)([\s\S]*?)(\s*)$/

function split(text: string): { lead: string; core: string; tail: string } {
  const m = EDGES.exec(text)!
  return { lead: m[1] ?? '', core: m[2] ?? '', tail: m[3] ?? '' }
}

/** Übersetzbare Texte in Dokumentreihenfolge (ohne Knoten, die nur aus Leerzeichen bestehen; Ränder abgeschnitten). */
export function collectLexicalTexts(state: LexicalState): string[] {
  const texts: string[] = []
  walk(state.root, (n) => {
    const { core } = split(n.text as string)
    if (core) texts.push(core)
  })
  return texts
}

/** Neue Struktur mit den übersetzten Texten (Reihenfolge wie `collectLexicalTexts`); das Original bleibt unverändert. */
export function applyLexicalTexts(state: LexicalState, texts: readonly string[]): LexicalState {
  const copy = structuredClone(state)
  let i = 0
  walk(copy.root, (n) => {
    const { lead, core, tail } = split(n.text as string)
    if (!core) return
    if (i >= texts.length) throw new Error('Zu wenige Übersetzungen für den Rich Text.')
    n.text = `${lead}${texts[i++]}${tail}`
  })
  if (i !== texts.length) throw new Error('Zu viele Übersetzungen für den Rich Text.')
  return copy
}

/** Hat der Rich Text sichtbaren Text? */
export function lexicalHasText(value: unknown): boolean {
  return isLexicalState(value) && collectLexicalTexts(value).length > 0
}
