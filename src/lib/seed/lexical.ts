import 'server-only'

import { toLexical } from '@/lib/richtext/plain'
import { formatBerlin } from '@/lib/time'

import { resolveSeedDate } from './time'

// `toLexical(text)` (SEED-SPEC §2.4): Klartext der Datendateien → Lexical-Inhalt. Die Umsetzung liegt im reinen
// Modul `src/lib/richtext/plain.ts` (auch für die Tattoo-Texte der Verwaltung, P7.9).
// Text-Token `{{date:<expr>}}` (§2.4): Datum der Feldsprache, DE `dd.MM.yyyy`, EN `d MMM yyyy` (Europe/Berlin).

export { inlineNodes, toLexical } from '@/lib/richtext/plain'

const DATE_TOKEN = /\{\{date:([^}]+)\}\}/g
const DATE_PATTERN = { de: 'dd.MM.yyyy', en: 'd MMM yyyy' } as const

/** Ersetzt alle `{{date:<expr>}}` relativ zu `now`; ein ungültiger Ausdruck wirft (`SeedTimeError`). */
export function withDateTokens(text: string, locale: 'de' | 'en', now: Date): string {
  return text.replace(DATE_TOKEN, (_raw, expr: string) =>
    formatBerlin(resolveSeedDate(expr.trim(), now), DATE_PATTERN[locale], locale),
  )
}

/** Alle Ausdrücke der Datums-Token in `text` (für die Prüfung beim Laden). */
export function dateTokenExprs(text: string): string[] {
  return [...text.matchAll(DATE_TOKEN)].map((m) => m[1]!.trim())
}

/** Klartext mit Datums-Token → Lexical. */
export function seedRichText(text: string, locale: 'de' | 'en', now: Date) {
  return toLexical(withDateTokens(text, locale, now))
}
