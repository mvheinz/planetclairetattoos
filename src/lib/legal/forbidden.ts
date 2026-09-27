import 'server-only'

// Lint-Listen für Produkttexte (RECHT ANFORDERUNGEN §5): V-13 (unbelegte Produktaussagen, R-044, R-045) und V-16
// (fremde Figuren/Marken, E-18, R-047). Dieselbe Quelle nutzt später die Verbotsprüfung (P1.32/P6.13). Aussagen wie
// „lebensmittelecht“ oder „nickelfrei“ erscheinen nur über die Bausteine mit Nachweis, nie im Freitext.

export interface LintRule {
  id: 'V-13' | 'V-16'
  /** Anzeige in der Meldung, z. B. „spülmaschinenfest“. */
  label: string
  pattern: RegExp
}

// Wortgrenzen auch für Umlaute: kein Buchstabe direkt davor/danach.
const word = (source: string) => new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, 'iu')
// V-13: auch gebeugt („nickelfreie“); verneinte Aussagen („nicht lebensmittelecht“, „not food safe“) sind erlaubt.
const claim = (source: string) =>
  new RegExp(
    `(?<!(?:nicht|kein|keine|not|non)\\s+)(?<!\\p{L})(?:${source})(?:e[mnrs]?)?(?!\\p{L})`,
    'iu',
  )

/** V-13: unbelegte Produktaussagen (DE und EN), GINETEX-Pflegesymbole. */
export const V13_UNPROVEN_CLAIMS: readonly LintRule[] = [
  ['lebensmittelecht', 'lebensmittel(?:echt|geeignet|sicher)|food[- ]?safe'],
  ['für Speisen', 'für\\s+Speisen|for\\s+serving\\s+food'],
  ['spülmaschinenfest', 'spülmaschinen(?:fest|geeignet|sicher)|dishwasher[- ]?(?:safe|proof)'],
  ['mikrowellengeeignet', 'mikrowellen(?:geeignet|fest|sicher)|microwave[- ]?(?:safe|proof)'],
  ['geprüft', 'geprüft|getestet|(?:lab[- ])?tested|certified'],
  ['schadstofffrei', 'schadstoff(?:frei|arm)|non[- ]?toxic|toxin[- ]?free'],
  ['hypoallergen', 'hypoallergen(?:ic)?|allergiefrei'],
  ['nickelfrei', 'nickel(?:frei|[- ]?free)'],
  ['bleifrei', 'bleifrei|lead[- ]?free|cadmium(?:frei|[- ]?free)'],
  ['GINETEX-Pflegesymbole', 'GINETEX'],
].map(([label, source]) => ({ id: 'V-13' as const, label: label!, pattern: claim(source!) }))

/** V-16: fremde Figuren und Marken (Liste erweiterbar). */
export const V16_THIRD_PARTY_MARKS: readonly LintRule[] = [
  ['Godzilla', 'Godzilla'],
  ['Disney', 'Disney'],
  ['Marvel', 'Marvel'],
  ['Pokémon', 'Pok[eé]mon'],
  ['Hello Kitty', 'Hello\\s*Kitty'],
  ['Snoopy', 'Snoopy'],
  ['Micky/Mickey', 'Micky|Mickey'],
  ['Star Wars', 'Star\\s*Wars'],
  ['Harry Potter', 'Harry\\s*Potter'],
  ['Simpsons', 'Simpsons'],
  ['Barbie', 'Barbie'],
  ['Nike', 'Nike'],
  ['Adidas', 'Adidas'],
  ['Puma', 'Puma'],
  ['Carhartt', 'Carhartt'],
  ["Levi's", "Levi'?s"],
  ['Champion', 'Champion'],
  ['New Era', 'New\\s*Era'],
].map(([label, source]) => ({ id: 'V-16' as const, label: label!, pattern: word(source!) }))

export interface LintHit {
  id: LintRule['id']
  label: string
}

/** Alle Treffer in einem Text (je Regel höchstens einmal). */
export function lintText(text: string | null | undefined, rules: readonly LintRule[]): LintHit[] {
  if (!text) return []
  return rules.filter((r) => r.pattern.test(text)).map(({ id, label }) => ({ id, label }))
}

/** Produkttexte: V-13 und V-16 zusammen. */
export function lintProductText(text: string | null | undefined): LintHit[] {
  return [...lintText(text, V13_UNPROVEN_CLAIMS), ...lintText(text, V16_THIRD_PARTY_MARKS)]
}
