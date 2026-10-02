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

const ORDER_NUMBER_RE = /^(BSP-)?PC-\d{4}-\d{5}$/

export function normalizeQuery(q: PersonQuery): {
  email: string | null
  orderNumber: string | null
  name: string | null
} {
  const email = typeof q.email === 'string' ? q.email.trim().toLowerCase() : ''
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

const ids = (rows: Record<string, unknown>[]) =>
  [...new Set(rows.map((r) => Number(r.id)))].sort((a, b) => a - b)
const arr = (list: number[]) =>
  sql.raw(list.length ? `ARRAY[${list.join(',')}]::int[]` : `ARRAY[]::int[]`)
const norm = (col: string) => sql.raw(`lower(regexp_replace(trim(${col}), '\\s+', ' ', 'g'))`)

export async function searchPerson(
  req: PayloadRequest,
  query: PersonQuery,
  options: { excludeRequestId?: number } = {},
): Promise<PersonMatches> {
  const q = normalizeQuery(query)
  const db: SqlExecutor = await dbFor(req)
  // Platzhalter ohne Treffer: ein Leerzeichen gleicht nie einem getrimmten Wert
  const e = q.email ?? ' '
  const n = q.name ?? ' '
  const o = q.orderNumber ?? ' '

  const orders = ids(
    (
      await db.execute(sql`
    SELECT id FROM orders WHERE lower(trim(customer_email)) = ${e}
      OR ${norm('customer_name')} = ${n} OR ${norm('shipping_address_name')} = ${n}
      OR ${norm('billing_address_name')} = ${n} OR order_number = ${o}`)
    ).rows,
  )
  const checkouts = ids(
    (
      await db.execute(sql`
    SELECT id FROM checkouts WHERE lower(trim(customer_email)) = ${e}
      OR ${norm('shipping_address_name')} = ${n} OR ${norm('billing_address_name')} = ${n}
      OR order_id = ANY(${arr(orders)})`)
    ).rows,
  )
  const withdrawals = ids(
    (
      await db.execute(sql`
    SELECT id FROM withdrawals WHERE lower(trim(email)) = ${e} OR ${norm('name')} = ${n}
      OR order_id = ANY(${arr(orders)})`)
    ).rows,
  )
  const inquiries = ids(
    (
      await db.execute(sql`
    SELECT id FROM inquiries WHERE lower(trim(email)) = ${e} OR ${norm('name')} = ${n}`)
    ).rows,
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
      AND (lower(trim("to")) = ${e} OR order_id = ANY(${arr(orders)})
        OR withdrawal_id = ANY(${arr(withdrawals)}) OR inquiry_id = ANY(${arr(inquiries)}))`)
    ).rows,
  )
  const consentLog = ids(
    (
      await db.execute(sql`
    SELECT id FROM consent_log WHERE lower(trim(email)) = ${e} OR order_id = ANY(${arr(orders)})
      OR checkout_id = ANY(${arr(checkouts)}) OR inquiry_id = ANY(${arr(inquiries)})`)
    ).rows,
  )
  const privacyRequests = ids(
    (
      await db.execute(sql`
    SELECT id FROM privacy_requests WHERE (lower(trim(contact_email)) = ${e}
      OR ${norm('contact_name')} = ${n}) AND id <> ${options.excludeRequestId ?? 0}`)
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
  }
}

export function countMatches(m: PersonMatches): Record<keyof PersonMatches, number> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.length])) as Record<
    keyof PersonMatches,
    number
  >
}
