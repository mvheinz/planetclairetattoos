import type { PayloadRequest, Where } from 'payload'

import { preservingReq } from '@/lib/payload/localReq'

// Galerie Fresh & Healed (DATENMODELL §6.16, E-42): Fotos mit Kund:innen nur mit dokumentierter Einwilligung.

export interface GalleryConsentState {
  published?: boolean | null
  showsCustomer?: boolean | null
  consentGiven?: boolean | null
  consentDate?: string | Date | null
  consentNote?: string | null
}

/** Veröffentlichungsregel: `!showsCustomer || (consentGiven && consentDate && consentNote)`. */
export function galleryConsentComplete(doc: GalleryConsentState): boolean {
  if (doc.showsCustomer === false) return true
  const note = typeof doc.consentNote === 'string' ? doc.consentNote.trim() : ''
  return doc.consentGiven === true && !!doc.consentDate && note.length > 0
}

/** Öffentlich sichtbar (ohne Vorschau-Ausnahme): veröffentlicht und (keine Kund:in oder Einwilligung). */
export function galleryPubliclyVisible(doc: GalleryConsentState): boolean {
  return doc.published === true && (doc.showsCustomer === false || doc.consentGiven === true)
}

/** Where-Bedingung der öffentlich sichtbaren Einträge (entspricht `galleryPubliclyVisible`). */
export const GALLERY_PUBLIC_WHERE: Where = {
  and: [
    { published: { equals: true } },
    { or: [{ showsCustomer: { equals: false } }, { consentGiven: { equals: true } }] },
  ],
}

/** `true`, wenn ein öffentlich sichtbarer Galerie-Eintrag das Bild zeigt (Haupt- oder Zusatzbild). */
export async function mediaVisibleInGallery(
  req: PayloadRequest,
  mediaId: number | string,
): Promise<boolean> {
  if (!req.payload.collections['tattoo-gallery']) return false
  const res = await preservingReq(req, () =>
    req.payload.count({
      collection: 'tattoo-gallery',
      where: {
        and: [
          GALLERY_PUBLIC_WHERE,
          { or: [{ image: { equals: mediaId } }, { extraImages: { in: [mediaId] } }] },
        ],
      },
      overrideAccess: true,
      req,
    }),
  )
  return res.totalDocs > 0
}
