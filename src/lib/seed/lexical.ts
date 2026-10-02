import 'server-only'

// `toLexical(text)` (SEED-SPEC §2.4): Klartext der Datendateien → Lexical-Inhalt. Die Umsetzung liegt im reinen
// Modul `src/lib/richtext/plain.ts` (auch für die Tattoo-Texte der Verwaltung, P7.9).

export { inlineNodes, toLexical } from '@/lib/richtext/plain'
