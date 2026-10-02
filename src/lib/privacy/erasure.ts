import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import type { PrivacyArea } from '@/lib/email/templates/privacy'
import { preservingReq } from '@/lib/payload/localReq'
import {
  anonymizeOrder,
  deleteInquiryRecord,
  deletePrivateUpload,
  deleteWithdrawalRecord,
} from '@/lib/retention/jobs'
import { writeDeletionLog } from '@/lib/retention/log'
import {
  L_03_CHECKOUTS,
  L_05_ORDERS_STAGE_D,
  L_08_WITHDRAWALS,
  retainUntil,
} from '@/lib/retention/policy'
import type { Order, PrivacyRequest, Withdrawal } from '@/payload-types'

import { PrivacyActionError } from './errors'
import { loadPrivacyRequest } from './requests'
import { searchPerson, type PersonQuery } from './search'

// Löschen/Einschränken je Person (PLAN P6.18, KONZEPT §7.15, LOESCHKONZEPT §5.6/§5.7, R-151): Plan je Datensatz mit
// Regel aus dem LOESCHKONZEPT und erlaubten Aktionen –
// - „sofort löschen“: was keiner Aufbewahrungspflicht (mehr) unterliegt; Bestellungen nach Fristende werden wie in
//   Stufe D anonymisiert (Personenfelder, Fotos, Reklamationen, Mail- und Einwilligungsnachweise), Kassen, Anfragen samt
//   Bildern, Widerrufe nach Fristende, Mail- und Einwilligungsnachweise ohne Bezug werden gelöscht;
// - „einschränken bis {Datum}“ (`privacy.processingRestricted = true`): aufbewahrungspflichtige Bestellungen und
//   Widerrufe; nicht nötige Angaben sofort entfernen (Notizen, Packfotos); die Outbox unterdrückt danach Mails zur
//   Bestellung (`suppressed`);
// - „behalten“ (Art. 17 Abs. 3 lit. e): Aufbewahrungssperre `privacy.legalHold` mit Pflicht-Begründung.
// Belege bleiben unverändert (GoBD, L-06). Jede Lösch-/Einschränkungsaktion → `deletion-log` (`trigger =
// privacy_request`, `ruleId = DSGVO`, `privacyRequestRef`); „behalten“ protokolliert der Audit (`legal_hold_changed`).
// Antwort M15 an die gespeicherte Adresse mit „gelöscht“ / „eingeschränkt bis“ / „aufbewahrt bis“ je Bereich.

export type ErasureAction = 'delete' | 'restrict' | 'keep' | 'none'

export interface ErasurePlanRow {
  area: PrivacyArea
  collection: string
  id: number
  /** Anzeige in der Verwaltung (Nummer/Referenz, nie in Protokollen). */
  label: string
  ruleId: string
  /** Ende der Aufbewahrung (ISO) bzw. `null`. */
  until: string | null
  actions: ErasureAction[]
  suggested: ErasureAction
  /** Hinweis (deutsch) zur Regel. */
  note: string
}

const iso = (d: Date | string | null | undefined) =>
  d ? (d instanceof Date ? d : new Date(d)).toISOString() : null
const due = (until: string | null | undefined, now: Date) =>
  !!until && new Date(until).getTime() <= now.getTime()

/** Plan je Datensatz der Person (ohne Änderungen). */
export async function buildErasurePlan(
  req: PayloadRequest,
  request: PrivacyRequest,
  query: PersonQuery,
  now: Date,
): Promise<ErasurePlanRow[]> {
  const m = await searchPerson(req, query, { excludeRequestId: request.id })
  const db = await dbFor(req)
  const rows: ErasurePlanRow[] = []
  const list = async <T>(collection: string, ids: number[]) =>
    ids.length === 0
      ? []
      : ((
          await preservingReq(req, () =>
            req.payload.find({
              collection: collection as 'orders',
              where: { id: { in: ids } },
              sort: 'id',
              depth: 0,
              pagination: false,
              overrideAccess: true,
              req,
            }),
          )
        ).docs as unknown as T[])

  for (const o of await list<Order>('orders', m.orders)) {
    const until = iso(o.retainUntil) ?? iso(retainUntil(L_05_ORDERS_STAGE_D, now))
    const base = { area: 'orders' as const, collection: 'orders', id: o.id, label: o.orderNumber }
    if (o.privacy?.anonymizedAt) {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until: null,
        actions: ['none'],
        suggested: 'none',
        note: 'bereits anonymisiert',
      })
    } else if (o.privacy?.legalHold) {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until,
        actions: ['keep', 'restrict'],
        suggested: 'keep',
        note: `gesperrt: ${o.privacy.legalHoldReason ?? ''}`.trim(),
      })
    } else if (due(o.retainUntil, now)) {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until: null,
        actions: ['delete', 'keep'],
        suggested: 'delete',
        note: 'Aufbewahrungsfrist abgelaufen – Personendaten werden entfernt, Beleg bleibt',
      })
    } else {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until,
        actions: ['restrict', 'keep'],
        suggested: o.privacy?.processingRestricted ? 'none' : 'restrict',
        note: o.privacy?.processingRestricted
          ? 'bereits eingeschränkt'
          : 'Aufbewahrungspflicht (Handels- und Steuerrecht) – einschränken',
      })
    }
  }
  for (const c of (
    await db.execute(
      sql`SELECT id, created_at FROM checkouts WHERE id = ANY(${sql.raw(arr(m.checkouts))})`,
    )
  ).rows) {
    rows.push({
      area: 'checkouts',
      collection: 'checkouts',
      id: Number(c.id),
      label: `Kasse ${c.id}`,
      ruleId: L_03_CHECKOUTS.id,
      until: iso(retainUntil(L_03_CHECKOUTS, new Date(String(c.created_at)))),
      actions: ['delete'],
      suggested: 'delete',
      note: 'keine Aufbewahrungspflicht',
    })
  }
  for (const i of (
    await db.execute(
      sql`SELECT id, number, retain_until FROM invoices WHERE id = ANY(${sql.raw(arr(m.invoices))}) ORDER BY id`,
    )
  ).rows) {
    rows.push({
      area: 'invoices',
      collection: 'invoices',
      id: Number(i.id),
      label: String(i.number),
      ruleId: 'L-06',
      until: iso(i.retain_until as string),
      actions: ['none'],
      suggested: 'none',
      note: 'Beleg bleibt unverändert bis Fristende (GoBD)',
    })
  }
  for (const w of await list<Withdrawal>('withdrawals', m.withdrawals)) {
    const base = {
      area: 'withdrawals' as const,
      collection: 'withdrawals',
      id: w.id,
      label: w.reference,
    }
    const until = iso(w.retainUntil) ?? iso(retainUntil(L_08_WITHDRAWALS, new Date(w.receivedAt)))
    if (w.privacy?.legalHold) {
      rows.push({
        ...base,
        ruleId: L_08_WITHDRAWALS.id,
        until,
        actions: ['keep', 'restrict'],
        suggested: 'keep',
        note: 'gesperrt',
      })
    } else if (due(until, now)) {
      rows.push({
        ...base,
        ruleId: L_08_WITHDRAWALS.id,
        until: null,
        actions: ['delete', 'keep'],
        suggested: 'delete',
        note: 'Aufbewahrungsfrist abgelaufen',
      })
    } else {
      rows.push({
        ...base,
        ruleId: L_08_WITHDRAWALS.id,
        until,
        actions: ['restrict', 'keep'],
        suggested: w.privacy?.processingRestricted ? 'none' : 'restrict',
        note: 'Aufbewahrungspflicht (Nachweis des Widerrufs) – einschränken',
      })
    }
  }
  for (const q of (
    await db.execute(
      sql`SELECT id, reference, privacy_legal_hold FROM inquiries WHERE id = ANY(${sql.raw(arr(m.inquiries))}) ORDER BY id`,
    )
  ).rows) {
    const held = q.privacy_legal_hold === true
    rows.push({
      area: 'inquiries',
      collection: 'inquiries',
      id: Number(q.id),
      label: String(q.reference),
      ruleId: 'L-10',
      until: null,
      actions: ['delete', 'keep'],
      suggested: held ? 'keep' : 'delete',
      note: held ? 'gesperrt' : 'keine Aufbewahrungspflicht – samt Bildern löschen',
    })
  }
  for (const c of (
    await db.execute(
      sql`SELECT id, order_id FROM complaints WHERE id = ANY(${sql.raw(arr(m.complaints))}) ORDER BY id`,
    )
  ).rows) {
    rows.push({
      area: 'complaints',
      collection: 'complaints',
      id: Number(c.id),
      label: `Reklamation ${c.id}`,
      ruleId: 'L-09',
      until: null,
      actions: ['none'],
      suggested: 'none',
      note: 'folgt der Bestellung',
    })
  }
  for (const e of (
    await db.execute(
      sql`SELECT id, template, order_id, withdrawal_id, inquiry_id FROM email_log WHERE id = ANY(${sql.raw(arr(m.emailLog))}) ORDER BY id`,
    )
  ).rows) {
    const follows = e.order_id ?? e.withdrawal_id ?? e.inquiry_id
    rows.push({
      area: 'emailLog',
      collection: 'email-log',
      id: Number(e.id),
      label: String(e.template),
      ruleId: 'L-12',
      until: null,
      actions: follows ? ['none'] : ['delete'],
      suggested: follows ? 'none' : 'delete',
      note: follows ? 'folgt dem Vorgang' : 'Versandnachweis ohne Bezug',
    })
  }
  for (const c of (
    await db.execute(
      sql`SELECT id, purpose, order_id, inquiry_id FROM consent_log WHERE id = ANY(${sql.raw(arr(m.consentLog))}) ORDER BY id`,
    )
  ).rows) {
    const follows = c.order_id ?? c.inquiry_id
    rows.push({
      area: 'consentLog',
      collection: 'consent-log',
      id: Number(c.id),
      label: String(c.purpose),
      ruleId: 'L-19 a',
      until: null,
      actions: follows ? ['none'] : ['delete'],
      suggested: follows ? 'none' : 'delete',
      note: follows ? 'folgt dem Vorgang' : 'Nachweis ohne Bestellung',
    })
  }
  for (const id of m.privacyRequests) {
    rows.push({
      area: 'privacyRequests',
      collection: 'privacy-requests',
      id,
      label: `Anfrage ${id}`,
      ruleId: 'L-17',
      until: null,
      actions: ['none'],
      suggested: 'none',
      note: 'Dokumentation der Anfrage (3 Jahre)',
    })
  }
  return rows
}

const arr = (ids: number[]) => (ids.length ? `ARRAY[${ids.join(',')}]::int[]` : 'ARRAY[]::int[]')

export interface ErasureDecision {
  collection: string
  id: number
  action: ErasureAction
  /** Pflicht bei `keep` (10–300 Zeichen). */
  reason?: string | null
}

export interface ErasureOutcome {
  collection: string
  id: number
  area: PrivacyArea
  action: ErasureAction
  until: string | null
}

export interface ErasureResult {
  request: PrivacyRequest
  outcomes: ErasureOutcome[]
  jobId: number | string | null
}

function parseDecisions(raw: unknown): ErasureDecision[] {
  if (!Array.isArray(raw))
    throw new PrivacyActionError(400, 'Bitte je Datensatz eine Aktion wählen.')
  return raw.map((d) => {
    const o = (d ?? {}) as Record<string, unknown>
    const action = o.action
    if (action !== 'delete' && action !== 'restrict' && action !== 'keep' && action !== 'none') {
      throw new PrivacyActionError(400, 'Unbekannte Aktion.')
    }
    return {
      collection: String(o.collection ?? ''),
      id: Number(o.id),
      action,
      reason: typeof o.reason === 'string' ? o.reason.trim() : null,
    }
  })
}

/** Plan anwenden, protokollieren und (auf Wunsch) M15 verschicken. */
export async function applyErasure(
  req: PayloadRequest,
  id: number,
  body: { decisions: unknown; query?: PersonQuery; notify?: boolean },
  now: Date,
): Promise<ErasureResult> {
  const request = await loadPrivacyRequest(req, id)
  if (request.status === 'answered' || request.status === 'rejected') {
    throw new PrivacyActionError(409, 'Die Anfrage ist abgeschlossen.')
  }
  if (request.identityVerified !== true) {
    throw new PrivacyActionError(409, 'Bitte zuerst die Identität prüfen.')
  }
  const query: PersonQuery =
    body.query && (body.query.email || body.query.orderNumber || body.query.name)
      ? body.query
      : { email: request.contactEmail }
  const plan = await buildErasurePlan(req, request, query, now)
  const decisions = parseDecisions(body.decisions)
  const ref = request.reference
  const db = await dbFor(req)
  const outcomes: ErasureOutcome[] = []
  const log = (
    collection: string,
    entityId: number,
    action: 'deleted' | 'anonymized' | 'restricted' | 'files_deleted',
    count = 0,
  ) =>
    writeDeletionLog(req, {
      entityCollection: collection,
      entityId,
      ruleId: 'DSGVO',
      action,
      trigger: 'privacy_request',
      privacyRequestRef: ref,
      storageObjectsCount: count,
      executedAt: now,
    })

  for (const row of plan) {
    const d = decisions.find((x) => x.collection === row.collection && x.id === row.id)
    const action: ErasureAction = d?.action ?? (row.actions.length === 1 ? row.actions[0]! : 'none')
    if (action !== 'none' && !row.actions.includes(action)) {
      throw new PrivacyActionError(400, `„${row.label}“: Aktion nicht erlaubt.`)
    }
    if (action === 'keep') {
      const reason = d?.reason ?? ''
      if (reason.length < 10 || reason.length > 300) {
        throw new PrivacyActionError(
          400,
          `„${row.label}“: Bitte begründen, warum die Daten bleiben (10–300 Zeichen).`,
        )
      }
    }
    if (action === 'none') {
      if (row.area === 'invoices' || row.area === 'orders' || row.area === 'withdrawals') {
        outcomes.push({
          collection: row.collection,
          id: row.id,
          area: row.area,
          action,
          until: row.until,
        })
      }
      continue
    }
    const ctx = { ...req.context, system: true, now: now.toISOString() }
    if (row.collection === 'orders') {
      if (action === 'delete') {
        const files = await anonymizeOrder(req, row.id, now, 'privacyRequest', ref)
        await log('orders', row.id, 'anonymized', files)
      } else if (action === 'restrict') {
        await restrictOrder(req, row.id, ref, now)
      } else {
        await setLegalHold(req, 'orders', row.id, d!.reason!, ctx)
      }
    } else if (row.collection === 'withdrawals') {
      if (action === 'delete') {
        await deleteWithdrawalRecord(req, row.id)
        await log('withdrawals', row.id, 'deleted')
      } else if (action === 'restrict') {
        await updatePrivacy(req, 'withdrawals', row.id, { processingRestricted: true }, ctx, {
          adminNotes: null,
        })
        await log('withdrawals', row.id, 'restricted')
      } else {
        await setLegalHold(req, 'withdrawals', row.id, d!.reason!, ctx)
      }
    } else if (row.collection === 'inquiries') {
      if (action === 'delete') {
        const files = await deleteInquiryRecord(req, row.id)
        await log('inquiries', row.id, 'deleted', files)
      } else {
        await setLegalHold(req, 'inquiries', row.id, d!.reason!, ctx)
      }
    } else if (row.collection === 'checkouts') {
      await db.execute(sql`UPDATE orders SET checkout_id = NULL WHERE checkout_id = ${row.id}`)
      const consents = await db.execute(
        sql`DELETE FROM consent_log WHERE checkout_id = ${row.id} AND order_id IS NULL RETURNING id`,
      )
      for (const c of consents.rows) await log('consent-log', Number(c.id), 'deleted')
      await db.execute(sql`UPDATE consent_log SET checkout_id = NULL WHERE checkout_id = ${row.id}`)
      await preservingReq(req, () =>
        req.payload.delete({ collection: 'checkouts', id: row.id, overrideAccess: true, req }),
      )
      await log('checkouts', row.id, 'deleted')
    } else if (row.collection === 'email-log') {
      const res = await db.execute(sql`DELETE FROM email_log WHERE id = ${row.id} RETURNING id`)
      if (res.rows[0]) await log('email-log', row.id, 'deleted')
    } else if (row.collection === 'consent-log') {
      const res = await db.execute(sql`DELETE FROM consent_log WHERE id = ${row.id} RETURNING id`)
      if (res.rows[0]) await log('consent-log', row.id, 'deleted')
    } else {
      continue
    }
    outcomes.push({
      collection: row.collection,
      id: row.id,
      area: row.area,
      action,
      until: action === 'delete' ? null : row.until,
    })
  }

  let jobId: number | string | null = null
  if (body.notify !== false && outcomes.length > 0) {
    const { enqueueEmail } = await import('@/lib/email/outbox')
    const res = await enqueueEmail(req, {
      template: 'privacy_erasure_response',
      to: request.contactEmail,
      locale: request.locale,
      data: {
        privacyRequestId: request.id,
        reference: request.reference,
        name: request.contactName ?? null,
        areas: summarizeOutcomes(outcomes),
      },
      idempotencyKey: `privacy_erasure_response:${request.id}`,
    })
    jobId = res.jobId
  }
  const updated = request.answeredAt
    ? request
    : ((await preservingReq(req, () =>
        req.payload.update({
          collection: 'privacy-requests',
          id: request.id,
          data: { answeredAt: now.toISOString() } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, now: now.toISOString() },
        }),
      )) as PrivacyRequest)
  return { request: updated, outcomes, jobId }
}

/** M15-Zusammenfassung je Bereich: eingeschränkt/aufbewahrt (spätestes Datum) vor gelöscht; Belege „unverändert“. */
export function summarizeOutcomes(outcomes: readonly ErasureOutcome[]) {
  const byArea = new Map<PrivacyArea, ErasureOutcome[]>()
  for (const o of outcomes) byArea.set(o.area, [...(byArea.get(o.area) ?? []), o])
  const latest = (list: ErasureOutcome[]) =>
    list
      .map((o) => o.until)
      .filter((u): u is string => !!u)
      .sort()
      .at(-1) ?? null
  const out: {
    area: PrivacyArea
    outcome: 'deleted' | 'restricted' | 'kept' | 'unchanged'
    until?: string | null
  }[] = []
  for (const [area, list] of byArea) {
    if (area === 'invoices') {
      out.push({ area, outcome: 'unchanged', until: latest(list) })
      continue
    }
    const kept = list.filter((o) => o.action === 'keep')
    const restricted = list.filter((o) => o.action === 'restrict' || o.action === 'none')
    if (kept.length > 0) out.push({ area, outcome: 'kept', until: latest(kept) })
    if (restricted.length > 0) out.push({ area, outcome: 'restricted', until: latest(restricted) })
    if (list.some((o) => o.action === 'delete')) out.push({ area, outcome: 'deleted' })
  }
  return out
}

/** Datenschutz-Gruppe ändern, übrige Angaben der Gruppe bleiben erhalten. */
async function updatePrivacy(
  req: PayloadRequest,
  collection: 'orders' | 'withdrawals' | 'inquiries',
  id: number,
  patch: Record<string, unknown>,
  context: PayloadRequest['context'],
  extra: Record<string, unknown> = {},
) {
  const doc = (await preservingReq(req, () =>
    req.payload.findByID({ collection, id, depth: 0, overrideAccess: true, req }),
  )) as { privacy?: Record<string, unknown> | null }
  await preservingReq(req, () =>
    req.payload.update({
      collection,
      id,
      data: { ...extra, privacy: { ...(doc.privacy ?? {}), ...patch } } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context,
    }),
  )
}

async function setLegalHold(
  req: PayloadRequest,
  collection: 'orders' | 'withdrawals' | 'inquiries',
  id: number,
  reason: string,
  context: PayloadRequest['context'],
) {
  await updatePrivacy(req, collection, id, { legalHold: true, legalHoldReason: reason }, context)
}

/**
 * Bestellung einschränken (Art. 18, LOESCHKONZEPT §5.7): `processingRestricted`, Notizen leeren, Packfotos sofort
 * löschen; Mails zur Bestellung unterdrückt danach die Outbox.
 */
export async function restrictOrder(
  req: PayloadRequest,
  id: number,
  privacyRequestRef: string,
  now: Date,
): Promise<void> {
  const db = await dbFor(req)
  const order = (await preservingReq(req, () =>
    req.payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true, req }),
  )) as Order
  const photos = await db.execute(sql`
    SELECT pu.id FROM private_uploads pu
     WHERE pu.purpose = 'packing_photo' AND (pu.related_order_id = ${id}
        OR pu.id IN (SELECT private_uploads_id FROM orders_rels WHERE parent_id = ${id} AND path = 'packingPhotos'))`)
  for (const p of photos.rows) {
    const n = await deletePrivateUpload(req, Number(p.id))
    if (n) {
      await writeDeletionLog(req, {
        entityCollection: 'private-uploads',
        entityId: Number(p.id),
        ruleId: 'DSGVO',
        action: 'files_deleted',
        trigger: 'privacy_request',
        privacyRequestRef,
        storageObjectsCount: n,
        executedAt: now,
      })
    }
  }
  // Empfänger informieren (Art. 19, LOESCHKONZEPT §5.6 Nr. 4): DHL-Einwilligung widerrufen, falls erteilt
  if (order.carrierEmailConsent === true && !order.carrierEmailConsentRevokedAt) {
    const { withdrawCarrierConsent } = await import('@/lib/commerce/carrierConsent')
    await withdrawCarrierConsent(req, order, now)
  }
  const fresh = (await preservingReq(req, () =>
    req.payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true, req }),
  )) as Order
  await preservingReq(req, () =>
    req.payload.update({
      collection: 'orders',
      id,
      data: {
        privacy: { ...(fresh.privacy ?? {}), processingRestricted: true },
        notes: null,
        adminAttention: { ...(fresh.adminAttention ?? {}), note: null },
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, now: now.toISOString() },
    }),
  )
  await writeDeletionLog(req, {
    entityCollection: 'orders',
    entityId: id,
    ruleId: 'DSGVO',
    action: 'restricted',
    trigger: 'privacy_request',
    privacyRequestRef,
    storageObjectsCount: 0,
    executedAt: now,
  })
}
