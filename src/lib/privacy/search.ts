import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { dbFor, type SqlExecutor } from '@/lib/db/tx'

import { PrivacyActionError } from './errors'

// Personensuche für Auskunft und Löschung (PLAN P6.17, KONZEPT §7.15, LOESCHKONZEPT §5.4, R-150): nach E-Mail
// (normalisiert: getrimmt, ohne Groß-/Kleinschreibung), Bestellnummer oder Name (getrimmt, Leerraum zusammengefasst,
// ohne Groß-/Kleinschreibung) über Bestellungen (Kund:in, Liefer- und Rechnungsname), Kassen, Belege, Widerrufe,
// Auftragsanfragen, Reklamationen, Mail-Protokoll (nur Mails an die Person, keine Verwaltungs-Mails), Einwilligungs-
// Protokoll, frühere Datenschutz-Anfragen und die zugehörigen privaten Dateien (Bilder, Beleg-PDFs). Verknüpfte
// Datensätze (z. B. Belege, Reklamationen einer gefundenen Bestellung) zählen mit.
//
// Daten Dritter (LOESCHKONZEPT §5.2/§5.4 Nr. 2): Ein Datensatz mit eigener gespeicherter E-Mail-Adresse (Bestellung,
// Kasse, Widerruf, Anfrage, frühere Datenschutz-Anfrage), der nur über Name oder Bestellnummer gefunden wurde und eine
// andere Adresse trägt als die gesuchte bzw. die der Anfrage (`ownEmails`), ist nur ein „möglicher Treffer“ – etwa
// eine Namensvetterin oder ein Geschenk, das an die Person ging. Er zählt samt allem, was daran hängt (Belege,
// Reklamationen, Mail- und Einwilligungsnachweise, Dateien), erst mit, wenn Jutta ihn ausdrücklich bestätigt
// (`confirmed`). Kassen und Widerrufe einer bestätigten bzw. eigenen Bestellung gehören zur Bestellung.

export interface PersonQuery {
  email?: string | null
  orderNumber?: string | null
  name?: string | null
}

export interface PersonMatches {
  orders: number[]
  checkouts: number[]
  invoices: number[]
  withdrawals: number[]
  inquiries: number[]
  complaints: number[]
  emailLog: number[]
  consentLog: number[]
  privacyRequests: number[]
  /** Private Dateien (Anfrage-Bilder, Pack-/Rückgabe-/Reklamationsfotos, Beleg-PDFs) – ohne frühere Exporte. */
  files: number[]
}

export const MATCH_COLLECTIONS = {
  orders: 'orders',
  checkouts: 'checkouts',
  invoices: 'invoices',
  withdrawals: 'withdrawals',
  inquiries: 'inquiries',
  complaints: 'complaints',
  emailLog: 'email-log',
  consentLog: 'consent-log',
  privacyRequests: 'privacy-requests',
  files: 'private-uploads',
} as const satisfies Record<keyof PersonMatches, string>

/** Bereiche mit eigener gespeicherter E-Mail-Adresse – nur hier gibt es „mögliche Treffer“. */
export const CANDIDATE_AREAS = [
  'orders',
  'checkouts',
  'withdrawals',
  'inquiries',
  'privacyRequests',
] as const
export type CandidateArea = (typeof CANDIDATE_AREAS)[number]

/** Möglicher Treffer: nur über Name/Bestellnummer gefunden, andere gespeicherte E-Mail-Adresse. */
export interface PersonCandidate {
  area: CandidateArea
  id: number
  /** Nummer/Referenz zur Anzeige in der Verwaltung (nie in Protokollen). */
  label: string
  /** Gespeicherte E-Mail-Adresse des Datensatzes (normalisiert) bzw. `null`. */
  email: string | null
  /** Von Jutta bestätigt → zählt in `matches` mit. */
  confirmed: boolean
}

/** Ausdrücklich bestätigte mögliche Treffer je Bereich. */
export type ConfirmedMatches = Partial<Record<CandidateArea, readonly number[]>>

export interface PersonSearch {
  /** Daten der Person: eigene Adresse, bestätigte mögliche Treffer und alles, was daran hängt. */
  matches: PersonMatches
  /** Alle möglichen Treffer (bestätigte mit `confirmed: true`); unbestätigte fehlen in `matches`. */
  candidates: PersonCandidate[]
}

export interface PersonSearchOptions {
  excludeRequestId?: number
  /** Adressen der Person zusätzlich zur gesuchten E-Mail (die gespeicherte Adresse der Anfrage). */
  ownEmails?: readonly (string | null | undefined)[]
  confirmed?: ConfirmedMatches
}

const ORDER_NUMBER_RE = /^(BSP-)?PC-\d{4}-\d{5}$/

const normEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')

export function normalizeQuery(q: PersonQuery): {
  email: string | null
  orderNumber: string | null
  name: string | null
} {
  const email = normEmail(q.email)
  const orderNumber = typeof q.orderNumber === 'string' ? q.orderNumber.trim().toUpperCase() : ''
  const name = typeof q.name === 'string' ? q.name.trim().replace(/\s+/g, ' ').toLowerCase() : ''
  if (orderNumber && !ORDER_NUMBER_RE.test(orderNumber)) {
    throw new PrivacyActionError(400, 'Bestellnummer im Format PC-JJJJ-NNNNN.')
  }
  if (name && name.length < 3) throw new PrivacyActionError(400, 'Bitte den vollen Namen angeben.')
  if (!email && !orderNumber && !name) {
    throw new PrivacyActionError(400, 'Bitte E-Mail, Bestellnummer oder Name angeben.')
  }
  return { email: email || null, orderNumber: orderNumber || null, name: name || null }
}

/** `confirmed` aus dem Request-Body: Liste `{ area, id }` (fehlend = nichts bestätigt). */
export function parseConfirmed(raw: unknown): ConfirmedMatches {
  if (raw === undefined || raw === null) return {}
  if (!Array.isArray(raw)) throw new PrivacyActionError(400, 'Ungültige Bestätigung.')
  const out: Partial<Record<CandidateArea, number[]>> = {}
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>
    const area = o.area as CandidateArea
    const id = Number(o.id)
    if (!(CANDIDATE_AREAS as readonly string[]).includes(String(area))) {
      throw new PrivacyActionError(400, 'Ungültige Bestätigung.')
    }
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new PrivacyActionError(400, 'Ungültige Bestätigung.')
    }
    out[area] = [...(out[area] ?? []), id]
  }
  return out
}

const ids = (rows: Record<string, unknown>[]) =>
  [...new Set(rows.map((r) => Number(r.id)))].sort((a, b) => a - b)
const sortIds = (list: Iterable<number>) => [...new Set(list)].sort((a, b) => a - b)
const arr = (list: number[]) =>
  sql.raw(list.length ? `ARRAY[${list.join(',')}]::int[]` : `ARRAY[]::int[]`)
const norm = (col: string) => sql.raw(`lower(regexp_replace(trim(${col}), '\\s+', ' ', 'g'))`)
const mail = (col: string) => sql.raw(`lower(trim(${col}))`)

export async function searchPerson(
  req: PayloadRequest,
  query: PersonQuery,
  options: PersonSearchOptions = {},
): Promise<PersonSearch> {
  const q = normalizeQuery(query)
  const db: SqlExecutor = await dbFor(req)
  // Platzhalter ohne Treffer: ein Leerzeichen gleicht nie einem getrimmten Wert
  const e = q.email ?? ' '
  const n = q.name ?? ' '
  const o = q.orderNumber ?? ' '
  const own = new Set([q.email, ...(options.ownEmails ?? []).map(normEmail)].filter((x) => !!x))
  const candidates: PersonCandidate[] = []

  /**
   * Eigene Datensätze behalten; fremde (andere Adresse, keine eigene/bestätigte Bestellung) nur nach Bestätigung.
   * Hängt ein fremder Datensatz an einer Bestellung, die selbst ein möglicher Treffer ist, folgt er ihr (keine
   * eigene Zeile in der Liste).
   */
  const classify = (
    area: CandidateArea,
    rows: Record<string, unknown>[],
    label: (r: Record<string, unknown>) => string,
    orders?: { kept: ReadonlySet<number>; candidates: ReadonlySet<number> },
  ): number[] => {
    const keep: number[] = []
    const confirmed = new Set(options.confirmed?.[area] ?? [])
    for (const r of rows) {
      const id = Number(r.id)
      const email = typeof r.email === 'string' && r.email !== '' ? r.email : null
      const orderId = r.order_id === null || r.order_id === undefined ? null : Number(r.order_id)
      if ((email && own.has(email)) || (orderId !== null && orders?.kept.has(orderId))) {
        keep.push(id)
        continue
      }
      if (orderId !== null && orders?.candidates.has(orderId)) continue
      const ok = confirmed.has(id)
      if (ok) keep.push(id)
      candidates.push({ area, id, label: label(r), email, confirmed: ok })
    }
    return sortIds(keep)
  }

  const orderRows = (
    await db.execute(sql`
    SELECT id, ${mail('customer_email')} AS email, order_number FROM orders
     WHERE ${mail('customer_email')} = ${e}
      OR ${norm('customer_name')} = ${n} OR ${norm('shipping_address_name')} = ${n}
      OR ${norm('billing_address_name')} = ${n} OR order_number = ${o}
     ORDER BY id`)
  ).rows
  const orders = classify('orders', orderRows, (r) => String(r.order_number))
  const orderScope = {
    kept: new Set(orders),
    candidates: new Set(
      candidates.filter((c) => c.area === 'orders' && !c.confirmed).map((c) => c.id),
    ),
  }
  const checkouts = classify(
    'checkouts',
    (
      await db.execute(sql`
    SELECT id, ${mail('customer_email')} AS email, order_id FROM checkouts
     WHERE ${mail('customer_email')} = ${e}
      OR ${norm('shipping_address_name')} = ${n} OR ${norm('billing_address_name')} = ${n}
      OR order_id = ANY(${arr(orders)})
     ORDER BY id`)
    ).rows,
    (r) => `#${r.id}`,
    orderScope,
  )
  const withdrawals = classify(
    'withdrawals',
    (
      await db.execute(sql`
    SELECT id, ${mail('email')} AS email, reference, order_id FROM withdrawals
     WHERE ${mail('email')} = ${e} OR ${norm('name')} = ${n} OR order_id = ANY(${arr(orders)})
     ORDER BY id`)
    ).rows,
    (r) => String(r.reference),
    orderScope,
  )
  const inquiries = classify(
    'inquiries',
    (
      await db.execute(sql`
    SELECT id, ${mail('email')} AS email, reference FROM inquiries
     WHERE ${mail('email')} = ${e} OR ${norm('name')} = ${n}
     ORDER BY id`)
    ).rows,
    (r) => String(r.reference),
  )
  const privacyRequests = classify(
    'privacyRequests',
    (
      await db.execute(sql`
    SELECT id, ${mail('contact_email')} AS email, reference FROM privacy_requests
     WHERE (${mail('contact_email')} = ${e} OR ${norm('contact_name')} = ${n})
       AND id <> ${options.excludeRequestId ?? 0}
     ORDER BY id`)
    ).rows,
    (r) => String(r.reference),
  )
  const invoices = ids(
    (await db.execute(sql`SELECT id FROM invoices WHERE order_id = ANY(${arr(orders)})`)).rows,
  )
  const complaints = ids(
    (await db.execute(sql`SELECT id FROM complaints WHERE order_id = ANY(${arr(orders)})`)).rows,
  )
  const emailLog = ids(
    (
      await db.execute(sql`
    SELECT id FROM email_log WHERE template::text NOT LIKE 'admin\\_%'
      AND (${mail('"to"')} = ${e} OR order_id = ANY(${arr(orders)})
        OR withdrawal_id = ANY(${arr(withdrawals)}) OR inquiry_id = ANY(${arr(inquiries)}))`)
    ).rows,
  )
  const consentLog = ids(
    (
      await db.execute(sql`
    SELECT id FROM consent_log WHERE ${mail('email')} = ${e} OR order_id = ANY(${arr(orders)})
      OR checkout_id = ANY(${arr(checkouts)}) OR inquiry_id = ANY(${arr(inquiries)})`)
    ).rows,
  )
  const files = ids(
    (
      await db.execute(sql`
    SELECT pu.id FROM private_uploads pu
     WHERE pu.purpose <> 'data_export' AND (
        pu.related_order_id = ANY(${arr(orders)}) OR pu.related_complaint_id = ANY(${arr(complaints)})
        OR pu.related_inquiry_id = ANY(${arr(inquiries)}) OR pu.related_invoice_id = ANY(${arr(invoices)})
        OR pu.id IN (SELECT private_uploads_id FROM orders_rels WHERE parent_id = ANY(${arr(orders)}))
        OR pu.id IN (SELECT private_uploads_id FROM complaints_rels WHERE parent_id = ANY(${arr(complaints)}))
        OR pu.id IN (SELECT private_uploads_id FROM inquiries_rels WHERE parent_id = ANY(${arr(inquiries)}))
        OR pu.id IN (SELECT pdf_id FROM invoices WHERE id = ANY(${arr(invoices)})))`)
    ).rows,
  )
  return {
    matches: {
      orders,
      checkouts,
      invoices,
      withdrawals,
      inquiries,
      complaints,
      emailLog,
      consentLog,
      privacyRequests,
      files,
    },
    candidates,
  }
}

export function countMatches(m: PersonMatches): Record<keyof PersonMatches, number> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.length])) as Record<
    keyof PersonMatches,
    number
  >
}
