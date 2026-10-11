// Platzhalter in Texten der Seite (U-87): `{name}`, `{count, plural, one {…} other {…}}` und `<link>…</link>` müssen
// beim Korrigieren erhalten bleiben – sonst fehlen auf der Seite Namen, Zahlen oder Links. Geprüft wird gegen den
// bisherigen Text: dieselben Platzhalter, dieselben Mehrzahl-Fälle, dieselben Markierungen, Klammern vollständig.

export interface Signature {
  args: string[]
  /** Fälle in Mehrzahl/Auswahl, z. B. `count:one,other`. */
  cases: string[]
  tags: string[]
}

/** Klammern prüfen und Platzhalter, Fälle und Markierungen sammeln. `null` = Klammern kaputt. */
export function signatureOf(text: string): Signature | null {
  const args = new Set<string>()
  const cases = new Set<string>()
  const tags = new Set<string>()
  // ICU: '' ist ein Apostroph, '{…}' wäre Literaltext – kommt hier nicht vor; Apostrophe gelten als Text.
  let depth = 0
  const stack: { arg: string | null; afterKeyword: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '{') {
      const rest = text.slice(i + 1)
      const m =
        /^\s*([A-Za-z_][\w]*)\s*(?:,\s*(plural|selectordinal|select|number|date|time)\s*(,)?)?/.exec(
          rest,
        )
      const top = stack.at(-1)
      if (top && top.afterKeyword) {
        // Fall-Inhalt `one {…}` – kein Argument
        stack.push({ arg: null, afterKeyword: false })
      } else if (m) {
        args.add(m[1]!)
        stack.push({ arg: m[2] && m[3] ? m[1]! : null, afterKeyword: !!(m[2] && m[3]) })
        if (m[2] && m[3]) {
          // Fälle bis zur schließenden Klammer dieses Arguments einsammeln
          let j = i + 1 + m[0].length
          let d = 0
          let buf = ''
          for (; j < text.length; j++) {
            const c = text[j]!
            if (c === '{') {
              if (d === 0) {
                const key = buf.trim().split(/\s+/).at(-1)
                if (key) cases.add(`${m[1]}:${key}`)
                buf = ''
              }
              d++
            } else if (c === '}') {
              if (d === 0) break
              d--
            } else if (d === 0) buf += c
          }
        }
      } else {
        return null
      }
      depth++
    } else if (ch === '}') {
      if (depth === 0) return null
      depth--
      stack.pop()
    } else if (ch === '<') {
      const t = /^<\/?([A-Za-z][\w-]*)>/.exec(text.slice(i))
      if (t) tags.add(t[0].startsWith('</') ? `/${t[1]}` : t[1]!)
    }
    i++
  }
  if (depth !== 0) return null
  return { args: [...args].sort(), cases: [...cases].sort(), tags: [...tags].sort() }
}

/** Fehlermeldung für Jutta oder `null`, wenn `value` dieselben Platzhalter wie `original` hat. */
export function checkPlaceholders(original: string, value: string): string | null {
  const a = signatureOf(original)
  const b = signatureOf(value)
  if (!b) return 'geschweifte Klammern { } passen nicht zusammen'
  if (!a) return null // Original selbst ohne gültige Platzhalter: nichts zu vergleichen
  const missing = a.args.filter((x) => !b.args.includes(x))
  const extra = b.args.filter((x) => !a.args.includes(x))
  if (missing.length)
    return `Platzhalter ${missing.map((x) => `{${x}}`).join(', ')} fehlt – bitte unverändert lassen`
  if (extra.length) return `unbekannter Platzhalter ${extra.map((x) => `{${x}}`).join(', ')}`
  if (a.cases.join() !== b.cases.join())
    return 'die Mehrzahl-Fälle (one/other …) bitte unverändert lassen'
  if (a.tags.join() !== b.tags.join())
    return `Markierungen ${
      a.tags
        .filter((t) => !t.startsWith('/'))
        .map((t) => `<${t}>…</${t}>`)
        .join(', ') || '(keine)'
    } bitte unverändert lassen`
  return null
}
