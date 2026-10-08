import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import { DEFAULT_INSTAGRAM_HANDLE } from '@/lib/data/navigation'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicSettings } from '@/lib/payload/public'

// Öffentliche Kontaktwege (KONZEPT §3.13, R20/R26): E-Mail (`settings.business.email`, sonst `social.contactEmail`),
// Instagram-Name, Studio-Bezirk und – seit U-46 (P13.7) – die vollständige Anschrift aus den Stammdaten
// (`business.legalName`, `street`, `postalCode`, `city`) – ausschließlich aus `getPublicSettings()` (Whitelist). Solange
// die Anschrift ein Platzhalter ist („[Adresse folgt]“, PLZ 00000), fehlt sie (dann zeigt die Seite den Bezirk). Ohne
// Datenbank: keine E-Mail, Instagram-Standard; die Seiten bleiben erreichbar.

const log = createLogger()

export interface ContactAddress {
  name: string
  street: string
  postalCode: string
  city: string
}

export interface ContactInfo {
  email: string | null
  instagramHandle: string
  studioDistrict: string | null
  /** Vollständige Anschrift (U-46); `null`, solange ein Teil fehlt oder Platzhalter ist. */
  address: ContactAddress | null
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const HANDLE_RE = /^[a-z0-9._]{1,30}$/

type Obj = Record<string, unknown>
const str = (o: unknown, key: string): string | null => {
  const v = typeof o === 'object' && o !== null ? (o as Obj)[key] : undefined
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

const PLACEHOLDER_RE = /\[|\bfolgt\b|^0{5}$/i

function pickAddress(business: unknown): ContactAddress | null {
  const parts = {
    name: str(business, 'legalName'),
    street: str(business, 'street'),
    postalCode: str(business, 'postalCode'),
    city: str(business, 'city'),
  }
  const values = Object.values(parts)
  if (values.some((v) => !v || PLACEHOLDER_RE.test(v))) return null
  return parts as ContactAddress
}

/** Reine Auswahl aus den öffentlichen Einstellungen (testbar ohne Datenbank). */
export function pickContactInfo(settings: Obj): ContactInfo {
  const email = [str(settings.business, 'email'), str(settings.social, 'contactEmail')].find(
    (e): e is string => !!e && EMAIL_RE.test(e),
  )
  const handle = str(settings.social, 'instagramHandle')
  return {
    email: email ?? null,
    instagramHandle: handle && HANDLE_RE.test(handle) ? handle : DEFAULT_INSTAGRAM_HANDLE,
    studioDistrict: str(settings.tattoo, 'studioDistrict'),
    address: pickAddress(settings.business),
  }
}

export async function loadContactInfo(): Promise<ContactInfo> {
  try {
    return pickContactInfo(await getPublicSettings())
  } catch (err) {
    log.warn('contact.load_failed', { reason: (err as Error).message })
    return pickContactInfo({})
  }
}

/** Kontaktwege (gecacht, Tag `settings`). */
export const getContactInfo = (): Promise<ContactInfo> =>
  unstable_cache(loadContactInfo, ['contact-info'], { tags: [TAGS.settings], revalidate: 60 })()
