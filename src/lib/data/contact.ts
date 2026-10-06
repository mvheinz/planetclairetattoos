import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import { DEFAULT_INSTAGRAM_HANDLE } from '@/lib/data/navigation'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicSettings } from '@/lib/payload/public'

// Öffentliche Kontaktwege (KONZEPT §3.13, R20/R26): E-Mail (`settings.business.email`, sonst `social.contactEmail`),
// Instagram-Name und Studio-Bezirk – ausschließlich aus `getPublicSettings()` (Whitelist). Ohne Datenbank: keine
// E-Mail, Instagram-Standard; die Seiten bleiben erreichbar.

const log = createLogger()

export interface ContactInfo {
  email: string | null
  instagramHandle: string
  studioDistrict: string | null
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const HANDLE_RE = /^[a-z0-9._]{1,30}$/

type Obj = Record<string, unknown>
const str = (o: unknown, key: string): string | null => {
  const v = typeof o === 'object' && o !== null ? (o as Obj)[key] : undefined
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
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

