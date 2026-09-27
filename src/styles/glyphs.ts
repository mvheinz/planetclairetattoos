// Glyphen-Pflichtliste und Abdeckung der Mansalva-Datei (DESIGN §4.1, §4.4; AK-DS-05). Reines Modul, auch im
// Browser nutzbar. Die Abdeckung erzeugt `pnpm fonts:copy` aus der eingecheckten Schriftdatei.
import { MANSALVA_COVERAGE } from './mansalvaCoverage.generated'

/** Zeichen, die Mansalva für Überschriften und Preise haben muss (DESIGN §4.1). */
export const MANSALVA_REQUIRED_GLYPHS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789äöüÄÖÜß€„“‚‘–·,.:!?&'()/%"

/** Hat die Mansalva-Datei eine Glyphe für diesen Code Point? */
export function mansalvaHasGlyph(codePoint: number): boolean {
  let lo = 0
  let hi = MANSALVA_COVERAGE.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [a, b] = MANSALVA_COVERAGE[mid]!
    if (codePoint < a) hi = mid - 1
    else if (codePoint > b) lo = mid + 1
    else return true
  }
  return false
}

export interface GlyphRun {
  text: string
  /** `true`: Zeichen fehlen in Mansalva und werden in Bricolage 600 gesetzt. */
  fallback: boolean
}

/** Teilt einen Text in Läufe mit und ohne Mansalva-Glyphen (Zeichen = Code Point). */
export function splitGlyphRuns(text: string): GlyphRun[] {
  const runs: GlyphRun[] = []
  for (const char of text) {
    const fallback = !mansalvaHasGlyph(char.codePointAt(0)!)
    const last = runs.at(-1)
    if (last && last.fallback === fallback) last.text += char
    else runs.push({ text: char, fallback })
  }
  return runs
}
