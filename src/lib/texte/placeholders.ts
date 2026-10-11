import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'

// Platzhalter in festen Texten der Seite (U-87): `{name}`, `{count, plural, one {…} other {…}}` und `<link>…</link>`
// müssen beim Korrigieren erhalten bleiben – sonst fehlen auf der Seite Namen, Zahlen oder Links, oder der Text bricht.
// Geprüft wird mit demselben ICU-Parser, den die Seite nutzt (next-intl → intl-messageformat): Der neue Text muss sich
// lesen lassen und dieselben Platzhalter (mit Art), Mehrzahl-/Auswahl-Fälle und Markierungen haben wie der bisherige.

export interface Signature {
  /** `name:art`, z. B. `time:argument`, `count:plural`. */
  args: string[]
  /** Fälle in Mehrzahl/Auswahl, z. B. `count:one`. */
  cases: string[]
  /** Markierungen mit Tiefe, z. B. `link@0`. */
  tags: string[]
}

const KIND: Partial<Record<TYPE, string>> = {
  [TYPE.argument]: 'argument',
  [TYPE.number]: 'number',
  [TYPE.date]: 'date',
  [TYPE.time]: 'time',
  [TYPE.select]: 'select',
  [TYPE.plural]: 'plural',
}

function walk(elements: readonly MessageFormatElement[], sig: Signature, depth: number): void {
  for (const el of elements) {
    const kind = KIND[el.type]
    if (kind && 'value' in el) sig.args.push(`${el.value}:${kind}`)
    if ((el.type === TYPE.select || el.type === TYPE.plural) && 'options' in el) {
      for (const [key, option] of Object.entries(el.options)) {
        sig.cases.push(`${el.value}:${key}`)
        walk(option.value, sig, depth)
      }
    }
    if (el.type === TYPE.tag) {
      sig.tags.push(`${el.value}@${depth}`)
      walk(el.children, sig, depth + 1)
    }
  }
}

/** Platzhalter, Fälle und Markierungen eines Textes; `null`, wenn der Text kein gültiger ICU-Text ist. */
export function signatureOf(text: string): Signature | null {
  let ast: MessageFormatElement[]
  try {
    ast = parse(text, { requiresOtherClause: true })
  } catch {
    return null
  }
  const sig: Signature = { args: [], cases: [], tags: [] }
  walk(ast, sig, 0)
  return {
    args: [...new Set(sig.args)].sort(),
    cases: [...new Set(sig.cases)].sort(),
    tags: sig.tags.sort(),
  }
}

const name = (arg: string) => arg.slice(0, arg.lastIndexOf(':'))

/** Fehlermeldung für Jutta oder `null`, wenn `value` dieselben Platzhalter wie `original` hat. */
export function checkPlaceholders(original: string, value: string): string | null {
  const a = signatureOf(original)
  if (!a) return null // bisheriger Text selbst kein ICU-Text: nichts zu vergleichen
  const b = signatureOf(value)
  if (!b)
    return 'geschweifte Klammern { } oder Markierungen < > sind nicht vollständig – bitte wie vorher schreiben'
  const missing = a.args.filter((x) => !b.args.some((y) => name(y) === name(x)))
  const extra = b.args.filter((y) => !a.args.some((x) => name(x) === name(y)))
  if (missing.length)
    return `Platzhalter ${missing.map((x) => `{${name(x)}}`).join(', ')} fehlt – bitte unverändert lassen`
  if (extra.length) return `unbekannter Platzhalter ${extra.map((x) => `{${name(x)}}`).join(', ')}`
  if (a.args.join() !== b.args.join()) return 'die Platzhalter bitte genau so lassen, wie sie waren'
  if (a.cases.join() !== b.cases.join())
    return 'die Mehrzahl-Fälle (one/other …) bitte unverändert lassen'
  if (a.tags.join() !== b.tags.join()) {
    const tags = [...new Set(a.tags.map((t) => t.slice(0, t.indexOf('@'))))]
    return `Markierungen ${tags.map((t) => `<${t}>…</${t}>`).join(', ') || '(keine)'} bitte unverändert lassen`
  }
  return null
}
