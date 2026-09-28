import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { Locale } from '@/lib/enums'
import { systemClock, type Clock } from '@/lib/time'

// Frontend-Lesezugriffe (DATENMODELL §1.4 Regel 3): immer `overrideAccess: false`, ohne `user` und ohne `req`,
// damit Where-Queries (inkl. Seed-Filter) und Feldzugriff greifen.

const PUBLIC = { overrideAccess: false, showHiddenFields: false, user: undefined, req: undefined }

export interface PublicPayload {
  find: Payload['find']
  findByID: Payload['findByID']
  count: Payload['count']
}

export function toPublicPayload(payload: Payload): PublicPayload {
  return {
    find: ((args: Parameters<Payload['find']>[0]) =>
      payload.find({ ...args, ...PUBLIC })) as Payload['find'],
    findByID: ((args: Parameters<Payload['findByID']>[0]) =>
      payload.findByID({ ...args, ...PUBLIC })) as Payload['findByID'],
    count: ((args: Parameters<Payload['count']>[0]) =>
      payload.count({ ...args, ...PUBLIC })) as Payload['count'],
  }
}

export async function getPublicPayload(): Promise<PublicPayload> {
  return toPublicPayload(await getPayload({ config }))
}

/**
 * Whitelist der öffentlichen Einstellungen (Spalte „Öff.“ in DATENMODELL §7.1). `tax.modes` ist nur als aktueller
 * Modus öffentlich (`tax.currentMode`). Nie öffentlich: u. a. `business.taxNumber`, `payment.iban`.
 */
export const PUBLIC_SETTINGS_PATHS = [
  'shop.isOpen',
  'shop.closedMessage',
  'business.legalName',
  'business.tradeName',
  'business.street',
  'business.postalCode',
  'business.city',
  'business.country',
  'business.email',
  'business.phone',
  'business.vatId',
  'business.economicId',
  'shipping.enabledCountries',
  'shipping.pickupEnabled',
  'shipping.pickupCity',
  'shipping.rates',
  'shipping.deliveryTimeText',
  'payment.prepaymentEnabled',
  'payment.reservationMinutes',
  'payment.prepaymentDays',
  'tattoo.studioDistrict',
  'tattoo.minPriceCents',
  'tattoo.customPriceFromCents',
  'tattoo.customPriceToCents',
  'tattoo.priceNote',
  'social.instagramHandle',
  'social.contactEmail',
] as const

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Reine Projektion der Einstellungen auf die Whitelist (testbar ohne Datenbank). */
export function pickPublicSettings(raw: unknown, now: Date): Obj {
  const out: Obj = {}
  if (!isObj(raw)) return out
  for (const path of PUBLIC_SETTINGS_PATHS) {
    const [group, field] = path.split('.') as [string, string]
    const src = raw[group]
    if (!isObj(src) || !(field in src)) continue
    const target = (out[group] ??= {}) as Obj
    target[field] = src[field]
  }
  const tax = raw.tax
  if (isObj(tax) && Array.isArray(tax.modes)) {
    const current = (tax.modes as Obj[])
      .filter((m) => typeof m.validFrom === 'string' && new Date(m.validFrom) <= now)
      .sort((a, b) => String(a.validFrom).localeCompare(String(b.validFrom)))
      .at(-1)
    if (current) out.tax = { currentMode: current.mode }
  }
  return out
}

/**
 * Öffentliche Einstellungen (Global `settings`) – nur die Whitelist. `locale` wählt die Sprache lokalisierter Felder
 * (z. B. `shipping.deliveryTimeText`); ohne Angabe Deutsch.
 */
export async function getPublicSettings(
  clock: Clock = systemClock,
  options: { locale?: Locale } = {},
): Promise<Obj> {
  const payload = await getPayload({ config })
  // Das Global ist nur für Admins lesbar; die Whitelist ersetzt hier den Feldzugriff (§7.1).
  const raw = await payload.findGlobal({
    slug: 'settings',
    overrideAccess: true,
    depth: 0,
    ...(options.locale ? { locale: options.locale } : {}),
  })
  return pickPublicSettings(raw, clock.now())
}
