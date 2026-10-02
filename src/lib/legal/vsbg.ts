import 'server-only'

// Streitbeilegung nach § 37 VSBG (R-112, KONZEPT M13): zuständige Stelle für ungelöste Streitfälle in Textform ist die
// Universalschlichtungsstelle des Bundes. Diese Angaben stehen im Baustein `dispute.vsbg37`; fehlen Anschrift oder URL
// in einer späteren Fassung, ergänzt die Mail M13 sie aus diesen Konstanten. Nie ein Verweis auf die abgeschaltete
// EU-Streitbeilegungsplattform (V-01, seit 20.07.2025 abgeschaltet).

export const UNIVERSAL_SCHLICHTUNGSSTELLE = Object.freeze({
  name: 'Universalschlichtungsstelle des Bundes, Zentrum für Schlichtung e. V.',
  street: 'Straßburger Straße 8',
  postalCode: '77694',
  city: 'Kehl am Rhein',
  url: 'https://www.universalschlichtungsstelle.de',
})

/** Anschrift in einer Zeile. */
export const SCHLICHTUNGSSTELLE_ADDRESS = `${UNIVERSAL_SCHLICHTUNGSSTELLE.street}, ${UNIVERSAL_SCHLICHTUNGSSTELLE.postalCode} ${UNIVERSAL_SCHLICHTUNGSSTELLE.city}`

/** Nennt der Text Anschrift und Website der Schlichtungsstelle? */
export function mentionsSchlichtungsstelle(text: string): boolean {
  const t = text.replace(/\s+/g, ' ')
  return (
    t.includes(UNIVERSAL_SCHLICHTUNGSSTELLE.street) &&
    t.includes(`${UNIVERSAL_SCHLICHTUNGSSTELLE.postalCode} ${UNIVERSAL_SCHLICHTUNGSSTELLE.city}`) &&
    /universalschlichtungsstelle\.de/i.test(t)
  )
}
