import 'server-only'

import { galleryTeaser, type PublicFlash, type PublicGalleryEntry } from '@/lib/data/tattoo'

// Auswahl der Fotos für die Vorschaukarten (OG-Bilder) von Flash (R12) und Galerie (R15) – U-61, P14.12. Rein.

/** Flash: erstes verfügbares Motiv mit Zeichnung, sonst irgendeines mit Zeichnung (Juttas eigene Zeichnungen). */
export function pickFlashForOg(list: readonly PublicFlash[]): PublicFlash | null {
  const withImage = list.filter((f) => f.image)
  return withImage.find((f) => f.status === 'available') ?? withImage[0] ?? null
}

/**
 * Galerie: nur Fotos, die öffentlich sichtbar sind **und** nicht über die Seed-Ausnahme (R-182) – eine Vorschaukarte
 * wird weitergegeben, also nie ein Kund:innen-Foto ohne Einwilligung, auch nicht im Vorschau-Modus. Sonst `null`
 * (dann Standardbild).
 */
export function pickGalleryForOg(
  entries: readonly PublicGalleryEntry[],
): PublicGalleryEntry | null {
  return (
    galleryTeaser(
      entries.filter((e) => !e.internal),
      1,
    )[0] ?? null
  )
}
