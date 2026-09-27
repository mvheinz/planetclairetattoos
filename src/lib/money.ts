// Geld immer als Integer-Cent (CLAUDE.md §6). formatMoney ist die einzige Formatierfunktion für Beträge
// (DESIGN §4.4, ARCHITEKTUR §15.4). Reines Hilfsmodul, auch im Browser nutzbar.

export type MoneyLocale = 'de' | 'en'
export interface FormatMoneyOptions {
  /** `full` (Standard): zwei Nachkommastellen; `tag`: ganze Euro fürs Preisschild. */
  style?: 'full' | 'tag'
}

const INTL_LOCALE: Record<MoneyLocale, string> = { de: 'de-DE', en: 'en-IE' }

/** Wirft, wenn der Wert kein Integer-Cent-Betrag ≥ 0 ist. */
export function assertCents(value: unknown, label = 'Betrag'): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${label} muss ein ganzzahliger Cent-Betrag ≥ 0 sein (erhalten: ${String(value)})`,
    )
  }
}

export function formatMoney(
  cents: number,
  locale: MoneyLocale,
  options: FormatMoneyOptions = {},
): string {
  assertCents(cents)
  const style = options.style ?? 'full'
  const euros = Math.trunc(cents / 100)
  const rest = cents % 100
  if (style === 'tag' && rest === 0) {
    return new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(euros)
  }
  // Ganzzahlig zusammensetzen: Intl bekommt Euro und Cent getrennt, keine Fließkomma-Rechnung mit Beträgen.
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const parts = nf.formatToParts(euros)
  const cent = String(rest).padStart(2, '0')
  return parts.map((p) => (p.type === 'fraction' ? cent : p.value)).join('')
}

/** Parst Eingaben wie „38,50“, „38.50“, „38“ oder „1.234,50“ zu Cent; `null` bei ungültiger Eingabe. */
export function parseEuroInput(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '')
  if (s === '') return null
  // Deutsche Schreibweise mit Tausenderpunkten und Komma
  let m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(s)
  let intPart: string | undefined
  let frac: string | undefined
  if (m) {
    intPart = m[1]!.replace(/\./g, '')
    frac = m[2]
  } else {
    m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s)
    if (!m) return null
    intPart = m[1]
    frac = m[2]
  }
  const cents = Number(intPart) * 100 + Number((frac ?? '').padEnd(2, '0') || '0')
  return Number.isSafeInteger(cents) ? cents : null
}

/** Cent → Eingabetext im Admin („3850“ → „38,50“), ohne Tausenderpunkte; `''` für leer. */
export function formatEuroInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isSafeInteger(cents) || cents < 0) return ''
  return `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}
