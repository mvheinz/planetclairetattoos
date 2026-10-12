// Tattoo-Unterseiten nur mit Inhalt (V-28 a, V-11; U-93): Flash (R12) erscheint in Menü, Unter-Navigation, Übersicht,
// Preisseite und Sitemap erst mit mindestens einem veröffentlichten Motiv, die Galerie (R15) erst mit einem öffentlich
// sichtbaren Foto. Die Adressen selbst bleiben erreichbar und zeigen ihren Leerzustand (kein 404). Reine Logik ohne
// Datenbank; die Daten liefert `getTattooAvailability()` (Tags `flash`, `tattoo-gallery`).

export interface TattooAvailability {
  flash: boolean
  gallery: boolean
}

/** Alles sichtbar (z. B. für Tests und als Rückfall in reinen Darstellungen). */
export const ALL_TATTOO_PAGES: TattooAvailability = { flash: true, gallery: true }

/** Routen, die nur mit Inhalt erscheinen, und woran das hängt. */
const CONTENT_ROUTES: Readonly<Record<string, keyof TattooAvailability>> = {
  R12: 'flash',
  R15: 'gallery',
}

/** Ist die Route sichtbar? Routen ohne Inhaltsbedingung immer. */
export function tattooPageVisible(id: string, availability: TattooAvailability): boolean {
  const key = CONTENT_ROUTES[id]
  return key ? availability[key] : true
}

/**
 * Sichtbare Routen in gegebener Reihenfolge. `current` (die gerade offene Seite) bleibt immer stehen, damit die
 * Unter-Navigation auch auf einer leeren Unterseite zeigt, wo man ist.
 */
export function visibleTattooPages<T extends string>(
  ids: readonly T[],
  availability: TattooAvailability,
  current?: string,
): T[] {
  return ids.filter((id) => id === current || tattooPageVisible(id, availability))
}

/** Routen ohne Inhalt (für die Sitemap). */
export function hiddenTattooRoutes(availability: TattooAvailability): string[] {
  return Object.keys(CONTENT_ROUTES).filter((id) => !tattooPageVisible(id, availability))
}
