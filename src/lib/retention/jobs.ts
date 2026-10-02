import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import { preservingReq } from '@/lib/payload/localReq'
import type { Order } from '@/payload-types'

import { writeDeletionLog } from './log'
import {
  eventCutoff,
  isDue,
  L_03_CHECKOUTS,
  L_04_CANCELLED_PREPAYMENT_STAGE_1,
  L_05_ORDERS_STAGE_B,
  L_05_ORDERS_STAGE_C,
  retainUntil,
  type RetentionRule,
} from './policy'
import {
  runRetentionSteps,
  type RetentionCandidate,
  type RetentionRunOptions,
  type RetentionRunResult,
  type RetentionStep,
} from './runner'

// Löschjobs Teil 1 (PLAN P6.14, LOESCHKONZEPT §2–§4, DATENMODELL §11/§12): Kassen (L-03), Minimierung der Bestellungen
// (L-04 Stufe 1, L-05 Stufen B/C), Anonymisierung der Bestellungen (L-04 Stufe 2, L-05 Stufe D, L-09), Belege (L-06,
// L-07) und Widerrufe (L-08). Fristen ausschließlich aus `policy.ts`; Datensätze mit Legal Hold fallen schon in der
// Kandidaten-Abfrage heraus. Stufe A (Telefon) hat keine Wirkung – es gibt kein Telefonfeld (DM-28).

/** Platzhalter-E-Mail anonymisierter Bestellungen (LOESCHKONZEPT §1 Nr. 2, DATENMODELL §6.8.3 Nr. 6). */
export const ANONYMIZED_EMAIL = 'anonymisiert@example.invalid'

type Row = Record<string, unknown>
const iso = (d: Date) => d.toISOString()
const asDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v)))

/** Kandidaten aus SQL (`id`, `event_at`) exakt nach der Regel filtern (Kalenderrechnung Berlin). */
function byEvent(rule: Pick<RetentionRule, 'duration' | 'start'>, rows: Row[], until: Date) {
  const out: RetentionCandidate[] = []
  for (const r of rows) {
    const at = asDate(r.event_at)
    if (isDue(rule, at, until)) out.push({ id: Number(r.id), dueAt: retainUntil(rule, at) })
  }
  return out
}
/** Kandidaten mit gespeicherter Frist (`retain_until`). */
const byRetainUntil = (rows: Row[]): RetentionCandidate[] =>
  rows.map((r) => ({ id: Number(r.id), dueAt: asDate(r.due_at) }))

// --- Speicherobjekte --------------------------------------------------------------------------------------------

/**
 * Private Datei löschen: Verweise der Bestellung/Reklamation entfernen, dann Datei + Datensatz über die Local API
 * (Payload löscht erst die Datei, dann die Zeile; scheitert die Datei, rollt die Transaktion zurück).
 */
export async function deletePrivateUpload(req: PayloadRequest, id: number): Promise<number> {
  const db = await dbFor(req)
  const exists = await db.execute(sql`SELECT id FROM private_uploads WHERE id = ${id}`)
  if (!exists.rows[0]) return 0
  await db.execute(sql`DELETE FROM orders_rels WHERE private_uploads_id = ${id}`)
  await db.execute(sql`DELETE FROM complaints_rels WHERE private_uploads_id = ${id}`)
  await preservingReq(req, () =>
    req.payload.delete({
      collection: 'private-uploads',
      id,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, skipAudit: true },
    }),
  )
  return 1
}

// --- L-03 Kassen ------------------------------------------------------------------------------------------------

const checkoutsStep: RetentionStep = {
  ruleId: L_03_CHECKOUTS.id,
  collection: 'checkouts',
  action: 'deleted',
  async candidates(db, until, limit) {
    const res = await db.execute(sql`
      SELECT id, created_at AS event_at FROM checkouts
       WHERE created_at <= ${iso(eventCutoff(L_03_CHECKOUTS, until))}::timestamptz
       ORDER BY created_at, id LIMIT ${limit}`)
    return byEvent(L_03_CHECKOUTS, res.rows, until)
  },
  async apply(req, id) {
    const db = await dbFor(req)
    // Bestellung behält ihren eigenen Snapshot (DM-05); der Danke-Link endet, der Status-Link bleibt
    await db.execute(sql`UPDATE orders SET checkout_id = NULL WHERE checkout_id = ${id}`)
    await preservingReq(req, () =>
      req.payload.delete({ collection: 'checkouts', id, overrideAccess: true, req }),
    )
  },
}

// --- Bestellungen minimieren (L-04 Stufe 1, L-05 Stufen B und C) -----------------------------------------------

const NO_HOLD = sql`privacy_legal_hold IS NOT TRUE AND privacy_anonymized_at IS NULL`

const cancelledMinimizeStep: RetentionStep = {
  ruleId: L_04_CANCELLED_PREPAYMENT_STAGE_1.id,
  collection: 'orders',
  action: 'anonymized',
  async candidates(db, until, limit) {
    const res = await db.execute(sql`
      SELECT id, timestamps_cancelled_at AS event_at FROM orders
       WHERE status = 'cancelled' AND timestamps_cancelled_at IS NOT NULL AND ${NO_HOLD}
         AND timestamps_cancelled_at <= ${iso(eventCutoff(L_04_CANCELLED_PREPAYMENT_STAGE_1, until))}::timestamptz
         AND (shipping_address_name IS NOT NULL OR shipping_address_address_line1 IS NOT NULL
              OR billing_address_name IS NOT NULL OR billing_address_address_line1 IS NOT NULL
              OR carrier_email_consent IS TRUE)
       ORDER BY timestamps_cancelled_at, id LIMIT ${limit}`)
    return byEvent(L_04_CANCELLED_PREPAYMENT_STAGE_1, res.rows, until)
  },
  async apply(req, id, now) {
    const db = await dbFor(req)
    await db.execute(sql`
      UPDATE orders SET
        shipping_address_name = NULL, shipping_address_address_line1 = NULL,
        shipping_address_address_line2 = NULL, shipping_address_postal_code = NULL, shipping_address_city = NULL,
        billing_address_name = NULL, billing_address_address_line1 = NULL, billing_address_address_line2 = NULL,
        billing_address_postal_code = NULL, billing_address_city = NULL,
        carrier_email_consent = false, updated_at = ${iso(now)}::timestamptz
       WHERE id = ${id}`)
  },
}

const tokenStep: RetentionStep = {
  ruleId: L_05_ORDERS_STAGE_B.id,
  collection: 'orders',
  action: 'anonymized',
  async candidates(db, until, limit) {
    const res = await db.execute(sql`
      SELECT id, timestamps_final_status_at AS event_at FROM orders
       WHERE timestamps_final_status_at IS NOT NULL AND ${NO_HOLD}
         AND timestamps_final_status_at <= ${iso(eventCutoff(L_05_ORDERS_STAGE_B, until))}::timestamptz
         AND (status_token_hash IS NOT NULL OR status_token_sealed IS NOT NULL)
       ORDER BY timestamps_final_status_at, id LIMIT ${limit}`)
    return byEvent(L_05_ORDERS_STAGE_B, res.rows, until)
  },
  async apply(req, id, now) {
    const db = await dbFor(req)
    // Hash und Siegel gemeinsam – der Status-Link zeigt danach „abgelaufen“ (R-067)
    await db.execute(sql`
      UPDATE orders SET status_token_hash = NULL, status_token_sealed = NULL, updated_at = ${iso(now)}::timestamptz
       WHERE id = ${id}`)
  },
}

/** Bestellung der Datei: `relatedOrder` bzw. Verweis aus `orders.packingPhotos`/`returnPhotos`. */
const UPLOAD_ORDER = sql`COALESCE(pu.related_order_id,
  (SELECT r.parent_id FROM orders_rels r WHERE r.private_uploads_id = pu.id LIMIT 1))`

/** Pack-/Rückgabefotos bleiben bei Legal Hold, offener Reklamation oder offener Anfechtung (LOESCHKONZEPT §3.1 C). */
const PHOTO_BLOCKERS = sql`o.privacy_legal_hold IS NOT TRUE
  AND o.dispute_status IS DISTINCT FROM 'open'
  AND NOT EXISTS (SELECT 1 FROM complaints c WHERE c.order_id = o.id AND c.status IN ('open', 'waiting_customer'))`

const photosStep: RetentionStep = {
  ruleId: L_05_ORDERS_STAGE_C.id,
  collection: 'private-uploads',
  action: 'deleted',
  async candidates(db, until, limit) {
    const cutoff = iso(eventCutoff(L_05_ORDERS_STAGE_C, until))
    const res = await db.execute(sql`
      SELECT pu.id, CASE WHEN pu.purpose = 'packing_photo'
                         THEN COALESCE(o.timestamps_shipped_at, o.timestamps_picked_up_at)
                         ELSE o.timestamps_return_received_at END AS event_at
        FROM private_uploads pu JOIN orders o ON o.id = ${UPLOAD_ORDER}
       WHERE pu.purpose IN ('packing_photo', 'return_photo') AND ${PHOTO_BLOCKERS}
         AND CASE WHEN pu.purpose = 'packing_photo'
                  THEN COALESCE(o.timestamps_shipped_at, o.timestamps_picked_up_at)
                  ELSE o.timestamps_return_received_at END <= ${cutoff}::timestamptz
       ORDER BY event_at, pu.id LIMIT ${limit}`)
    return byEvent(L_05_ORDERS_STAGE_C, res.rows, until)
  },
  async apply(req, id) {
    return { storageObjectsCount: await deletePrivateUpload(req, Number(id)) }
  },
}

// --- Bestellungen anonymisieren (L-04 Stufe 2, L-05 Stufe D, L-09) -----------------------------------------------

const EMPTY_ADDRESS = {
  name: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  city: null,
}

/**
 * Stufe D (LOESCHKONZEPT §3.1): Personenfelder leeren bzw. Platzhalter, Freitexte (auch im Statusverlauf) leeren,
 * DHL-Einwilligung und Status-Token entfernen; Pack- und Rückgabefotos, Reklamationen samt Fotos (L-09),
 * zugeordnete `email-log`- und `consent-log`-Einträge (L-12, L-19 a) löschen. Bleibt: Nummer, Daten, Statusverlauf
 * ohne Freitext, Positionen, Beträge, Zahlart-Typ, Belegverweise, Rechtstext- und Bausteinfassungen.
 */
export async function anonymizeOrder(
  req: PayloadRequest,
  id: number,
  now: Date,
  taskSlug: string,
): Promise<number> {
  const db = await dbFor(req)
  const order = (await preservingReq(req, () =>
    req.payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true, req }),
  )) as Order
  let files = 0
  const log = (collection: string, entityId: number, ruleId: string, count = 0) =>
    writeDeletionLog(req, {
      entityCollection: collection,
      entityId,
      ruleId,
      action: 'deleted',
      trigger: 'job',
      taskSlug,
      storageObjectsCount: count,
      executedAt: now,
    })

  // Reklamationen samt Fotos (L-09)
  const complaints = await db.execute(sql`SELECT id FROM complaints WHERE order_id = ${id}`)
  for (const c of complaints.rows) {
    const cid = Number(c.id)
    const photos = await db.execute(sql`
      SELECT private_uploads_id AS id FROM complaints_rels WHERE parent_id = ${cid} AND private_uploads_id IS NOT NULL
      UNION SELECT id FROM private_uploads WHERE related_complaint_id = ${cid}`)
    let count = 0
    for (const p of photos.rows) count += await deletePrivateUpload(req, Number(p.id))
    await preservingReq(req, () =>
      req.payload.delete({ collection: 'complaints', id: cid, overrideAccess: true, req }),
    )
    await log('complaints', cid, 'L-09', count)
    files += count
  }
  // Pack- und Rückgabefotos
  const photos = await db.execute(sql`
    SELECT private_uploads_id AS id FROM orders_rels WHERE parent_id = ${id} AND private_uploads_id IS NOT NULL
    UNION SELECT id FROM private_uploads WHERE related_order_id = ${id} AND purpose IN ('packing_photo', 'return_photo')`)
  for (const p of photos.rows) {
    const n = await deletePrivateUpload(req, Number(p.id))
    if (n) await log('private-uploads', Number(p.id), 'L-05 Stufe D', n)
    files += n
  }
  // Mail- und Einwilligungsnachweise der Bestellung (L-12, L-19 a)
  const mails = await db.execute(sql`DELETE FROM email_log WHERE order_id = ${id} RETURNING id`)
  for (const m of mails.rows) await log('email-log', Number(m.id), 'L-12')
  const consents = await db.execute(
    sql`DELETE FROM consent_log WHERE order_id = ${id} RETURNING id`,
  )
  for (const c of consents.rows) await log('consent-log', Number(c.id), 'L-19 a')

  await preservingReq(req, () =>
    req.payload.update({
      collection: 'orders',
      id,
      data: {
        customer: { name: null, email: ANONYMIZED_EMAIL },
        shippingAddress: { ...order.shippingAddress, ...EMPTY_ADDRESS },
        billingAddress: { ...order.billingAddress, ...EMPTY_ADDRESS },
        pickup: { ...(order.pickup ?? {}), messageText: null },
        notes: null,
        cancelNote: null,
        adminAttention: { ...(order.adminAttention ?? {}), note: null },
        carrierEmailConsent: false,
        statusHistory: (order.statusHistory ?? []).map((h) => ({ ...h, note: null })),
        statusTokenHash: null,
        statusTokenSealed: null,
        privacy: { ...(order.privacy ?? {}), anonymizedAt: iso(now) },
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, transition: 'anonymize', now: iso(now) },
    }),
  )
  return files
}

const ANONYMIZE_CANDIDATES = (paid: boolean) => sql`
  SELECT id, retain_until AS due_at FROM orders
   WHERE retain_until IS NOT NULL AND ${NO_HOLD}
     AND ${paid ? sql`NOT (status = 'cancelled' AND timestamps_paid_at IS NULL)` : sql`status = 'cancelled' AND timestamps_paid_at IS NULL`}`

function anonymizeStep(ruleId: string, paid: boolean): RetentionStep {
  return {
    ruleId,
    collection: 'orders',
    action: 'anonymized',
    async candidates(db, until, limit) {
      const res = await db.execute(sql`
        ${ANONYMIZE_CANDIDATES(paid)} AND retain_until <= ${iso(until)}::timestamptz
        ORDER BY retain_until, id LIMIT ${limit}`)
      return byRetainUntil(res.rows)
    },
    async apply(req, id, now) {
      return {
        storageObjectsCount: await anonymizeOrder(req, Number(id), now, 'retentionOrders'),
      }
    },
  }
}

// --- Belege (L-06, L-07) ----------------------------------------------------------------------------------------

const invoicesStep: RetentionStep = {
  ruleId: 'L-06',
  collection: 'invoices',
  action: 'anonymized',
  async candidates(db, until, limit) {
    const res = await db.execute(sql`
      SELECT i.id, i.retain_until AS due_at FROM invoices i LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.status = 'issued' AND i.anonymized_at IS NULL
         AND i.retain_until <= ${iso(until)}::timestamptz
         AND o.privacy_legal_hold IS NOT TRUE
       ORDER BY i.retain_until, i.id LIMIT ${limit}`)
    return byRetainUntil(res.rows)
  },
  async apply(req, id, now) {
    const db = await dbFor(req)
    // Der Trigger pc_guard_invoices (DATENMODELL §9.4) erlaubt das Anonymisieren nur mit `pc.now` ≥ retain_until
    await db.execute(sql`SELECT set_config('pc.now', ${iso(now)}, true)`)
    const before = await db.execute(sql`SELECT pdf_id FROM invoices WHERE id = ${id}`)
    const pdfId = before.rows[0]?.pdf_id
    await db.execute(sql`
      UPDATE invoices SET
        data = jsonb_set(data, '{buyer}', jsonb_build_object(
          'name', NULL, 'addressLine1', NULL, 'addressLine2', NULL, 'postalCode', NULL, 'city', NULL,
          'country', data->'buyer'->'country', 'email', NULL)),
        pdf_id = NULL, anonymized_at = ${iso(now)}::timestamptz, updated_at = ${iso(now)}::timestamptz
       WHERE id = ${id}`)
    const files = pdfId ? await deletePrivateUpload(req, Number(pdfId)) : 0
    return { storageObjectsCount: files }
  },
}

const monthlyExportsStep: RetentionStep = {
  ruleId: 'L-07',
  collection: 'private-uploads',
  action: 'deleted',
  async candidates(db, until, limit) {
    const res = await db.execute(sql`
      SELECT id, retain_until AS due_at FROM private_uploads
       WHERE purpose = 'monthly_export' AND retain_until <= ${iso(until)}::timestamptz
       ORDER BY retain_until, id LIMIT ${limit}`)
    return byRetainUntil(res.rows)
  },
  async apply(req, id) {
    return { storageObjectsCount: await deletePrivateUpload(req, Number(id)) }
  },
}

// --- Widerrufe (L-08) -------------------------------------------------------------------------------------------

const withdrawalsStep: RetentionStep = {
  ruleId: 'L-08',
  collection: 'withdrawals',
  action: 'deleted',
  async candidates(db, until, limit) {
    const res = await db.execute(sql`
      SELECT id, retain_until AS due_at FROM withdrawals
       WHERE retain_until <= ${iso(until)}::timestamptz AND privacy_legal_hold IS NOT TRUE
       ORDER BY retain_until, id LIMIT ${limit}`)
    return byRetainUntil(res.rows)
  },
  async apply(req, id) {
    const db = await dbFor(req)
    // Eingangsbestätigungen gehören zur Erklärung (L-08)
    await db.execute(sql`UPDATE withdrawals SET confirmation_email_id = NULL WHERE id = ${id}`)
    await db.execute(sql`DELETE FROM email_log WHERE withdrawal_id = ${id}`)
    await preservingReq(req, () =>
      req.payload.delete({ collection: 'withdrawals', id, overrideAccess: true, req }),
    )
  },
}

// --- Tasks ------------------------------------------------------------------------------------------------------

export const RETENTION_TASK_STEPS = {
  retentionAbandonedCheckouts: [checkoutsStep],
  retentionOrderMinimize: [cancelledMinimizeStep, tokenStep, photosStep],
  retentionOrders: [anonymizeStep('L-04 Stufe 2', false), anonymizeStep('L-05 Stufe D', true)],
  retentionInvoices: [invoicesStep, monthlyExportsStep],
  retentionWithdrawals: [withdrawalsStep],
} as const satisfies Record<string, readonly RetentionStep[]>

export type RetentionTaskSlug = keyof typeof RETENTION_TASK_STEPS

/** Einen Löschjob ausführen (bzw. im Trockenlauf auflisten). */
export function runRetentionTask(
  payload: Payload,
  task: RetentionTaskSlug,
  options: RetentionRunOptions,
): Promise<RetentionRunResult> {
  return runRetentionSteps(payload, task, RETENTION_TASK_STEPS[task], options)
}

export type { SqlExecutor }
