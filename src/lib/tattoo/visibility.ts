import 'server-only'

import { getEnv, seedPreviewModeActive, type Env } from '@/lib/env'

// Einwilligungsregel überall (KONZEPT §9.7, E-42, R-172, R-181; DATENMODELL §6.2, §6.16): eine einzige Stelle für
// Galerie-Abfragen, Teaser (R11, Startseite), OG-Bilder, Sitemap und die Auslieferung der Bilddatei. Die Umgebung ist
// injizierbar (Tests); ohne Angabe gilt die laufende Umgebung.
//
//   seedPreviewModeActive() = SEED_PREVIEW_MODE == 'true' AND APP_ENV != 'production'
//   isPubliclyVisible(entry) = published AND (showsCustomer == false OR consentGiven == true
//                                             OR (seed == true AND seedPreviewModeActive()))
//   isMediaPubliclyVisible(media) = NOT (showsPerson == 'jutta' AND ownerApproved != true)        (R-181, P8.20)
//                                   AND (restricted == false OR (seed == true AND seedPreviewModeActive()))
//                                   (+ Seed-Filter: Seed-Bilder nur im Vorschau-Modus)
// Fotos von Jutta brauchen ihre Freigabe auch im Vorschau-Modus.

type EnvLike = Pick<Env, 'APP_ENV' | 'SEED_PREVIEW_MODE'>

export interface GalleryVisibilityInput {
  published?: boolean | null
  showsCustomer?: boolean | null
  consentGiven?: boolean | null
  seed?: boolean | null
}

export interface MediaVisibilityInput {
  restricted?: boolean | null
  seed?: boolean | null
  showsPerson?: string | null
  ownerApproved?: boolean | null
}

/** Foto von Jutta ohne ihre Freigabe (R-181, DATENMODELL §6.2) – nie öffentlich. */
export function isUnapprovedOwnerPhoto(media: MediaVisibilityInput): boolean {
  return media.showsPerson === 'jutta' && media.ownerApproved !== true
}

const preview = (env?: EnvLike) => seedPreviewModeActive((env ?? getEnv()) as Env)

/** Ist der Galerie-Eintrag öffentlich sichtbar (KONZEPT §9.7)? */
export function isPubliclyVisible(entry: GalleryVisibilityInput, env?: EnvLike): boolean {
  if (entry.published !== true) return false
  // Seed-Einträge erscheinen öffentlich nur im Vorschau-Modus (DATENMODELL §1.4 Regel 4) – auch mit Einwilligung.
  if (entry.seed === true) return preview(env)
  return entry.showsCustomer === false || entry.consentGiven === true
}

/** Sichtbar, aber nur über die Seed-Ausnahme (Etikett „intern – Einwilligung fehlt“, R-182). */
export function isSeedConsentException(entry: GalleryVisibilityInput, env?: EnvLike): boolean {
  return (
    isPubliclyVisible(entry, env) &&
    entry.seed === true &&
    entry.showsCustomer !== false &&
    entry.consentGiven !== true
  )
}

/** Darf die Bilddatei bzw. das Bild-Dokument öffentlich ausgeliefert werden (ohne Anmeldung)? */
export function isMediaPubliclyVisible(media: MediaVisibilityInput, env?: EnvLike): boolean {
  if (isUnapprovedOwnerPhoto(media)) return false
  if (media.seed === true) return preview(env)
  return media.restricted !== true
}
