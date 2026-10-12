import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { ORDER_FINAL_STATUSES } from '@/lib/commerce/orderTransitions'
import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import type { PrivacyArea, PrivacyErasureOutcome } from '@/lib/email/templates/privacy'
import type { OrderStatus, WithdrawalStatus } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import {
  anonymizeOrder,
  deleteInquiryRecord,
  deletePrivateUpload,
  deleteSpentMailJobs,
  deleteWithdrawalRecord,
  mailJobsFor,
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
// - „behalten“ (Art. 17 Abs. 3 lit. e): Aufbewahrungssperre `privacy.legalHold` mit Pflicht-Begründung;
// - „keine Aktion“: Vorschlag für Bestellungen, deren Vertrag noch läuft (`orderStillRunning`: kein bzw. künftiger
//   `timestamps.finalStatusAt`, Status ohne Abschluss wie Widerruf eingegangen/Ware zurück/angefochten, ausstehende
//   Erstattung, offener Widerruf), und ihre Widerrufe – Versand, Zahlung und Erstattung brauchen die Daten und die Mails
//   (Art. 17 Abs. 1 lit. a greift nicht). Solche Zeilen merkt sich die Anfrage (`remindersSent.erasureFollowUp`); der
//   tägliche Nachlauf (`runErasureFollowUps`) schränkt sie nach Abschluss automatisch ein.
// Alle Entscheidungen werden geprüft, bevor etwas geändert wird (gelöschte Dateien lassen sich nicht zurückrollen).
// Die Löschanfrage widerruft immer eine aktive DHL-Einwilligung der Bestellungen der Person (Art. 17 Abs. 1 lit. b,
// Art. 19), auch ohne Einschränkung. Belege bleiben unverändert (GoBD, L-06). Jede Lösch-/Einschränkungsaktion →
// `deletion-log` (`trigger = privacy_request`, `ruleId = DSGVO`, `privacyRequestRef`); „behalten“ protokolliert der
// Audit (`legal_hold_changed`). Antwort M15 an die gespeicherte Adresse mit dem tatsächlichen Zustand je Bereich:
// „gelöscht“ / „eingeschränkt bis“ (nur wenn wirklich eingeschränkt) / „aufbewahrt bis“ (Sperre) / `inUse` (keine
// Aktion, nicht eingeschränkt: „aufbewahrt bis {Datum} wegen gesetzlicher Aufbewahrungspflichten“ bzw. bei laufendem
// Vertrag „brauche ich noch“); den Satz zum DHL-Widerruf nur, wenn in diesem Lauf eine DHL-Einwilligung widerrufen
// wurde.

export type ErasureAction = 'delete' | 'restrict' | 'keep' | 'none'

/**
 * Zustand eines Datensatzes vor der Aktion (Bestellungen, Widerrufe) – daraus meldet M15 bei „keine Aktion“, was
 * wirklich gilt: anonymisiert, gesperrt (Art. 17 Abs. 3 lit. e), eingeschränkt, Vertrag läuft noch, aufbewahrt
 * (Frist läuft) bzw. Frist abgelaufen.
 */
export type ErasureRowState = 'anonymized' | 'held' | 'restricted' | 'running' | 'retained' | 'due'

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
  /** Nur Bestellungen und Widerrufe. */
  state?: ErasureRowState
}

const iso = (d: Date | string | null | undefined) =>
  d ? (d instanceof Date ? d : new Date(d)).toISOString() : null
const due = (until: string | null | undefined, now: Date) =>
  !!until && new Date(until).getTime() <= now.getTime()

/**
 * Bestellstatus, in denen der Vertrag abgewickelt ist, sobald `timestamps.finalStatusAt` erreicht ist: die Endstatus
 * (L-05), „versendet“ nach dem vorläufigen Endstatus (30 Tage) und „teilweise erstattet“ ohne offenen Vorgang.
 */
const SETTLED_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  ...ORDER_FINAL_STATUSES,
  'shipped',
  'partially_refunded',
])

/** Widerrufe, deren Rücksendung bzw. Erstattung noch aussteht (KONZEPT §5.4, vor W4/W5/W7). */
export const OPEN_WITHDRAWAL_STATUSES = [
  'received',
  'goods_returned',
  'partially_refunded',
] as const satisfies readonly WithdrawalStatus[]

/**
 * Läuft der Vertrag noch (Prüfung P18.5)? Ja bei fehlendem bzw. künftigem `finalStatusAt`, bei einem Status ohne
 * Abschluss (bezahlt, gepackt, abholbereit, Widerruf eingegangen, Ware zurück, angefochten – `finalStatusAt` bleibt
 * z. B. nach „zugestellt“ stehen, wenn danach ein Widerruf kommt), bei ausstehender Erstattung, offener Anfechtung oder
 * offenem Widerruf zur Bestellung.
 */
export function orderStillRunning(
  order: Pick<Order, 'status' | 'timestamps' | 'refunds' | 'dispute'>,
  now: Date,
  openWithdrawal = false,
): boolean {
  const finalAt = order.timestamps?.finalStatusAt
  if (!finalAt || new Date(finalAt).getTime() > now.getTime()) return true
  if (!SETTLED_ORDER_STATUSES.has(order.status)) return true
  if ((order.refunds ?? []).some((r) => r.status === 'pending')) return true
  if (order.dispute?.status === 'open') return true
  return openWithdrawal
}

/** IDs der Bestellungen, deren Vertrag noch läuft (Plan und Nachlauf; offene Widerrufe ohne Spam-Markierung). */
export async function runningOrderIds(
  db: SqlExecutor,
  orders: readonly Order[],
  now: Date,
): Promise<Set<number>> {
  if (orders.length === 0) return new Set()
  const open = await db.execute(sql`
    SELECT DISTINCT order_id FROM withdrawals
     WHERE order_id = ANY(${sql.raw(arr(orders.map((o) => o.id)))}) AND spam_marked_at IS NULL
       AND status IN (${sql.raw(OPEN_WITHDRAWAL_STATUSES.map((s) => `'${s}'`).join(', '))})`)
  const withOpen = new Set(open.rows.map((r) => Number(r.order_id)))
  return new Set(
    orders.filter((o) => orderStillRunning(o, now, withOpen.has(o.id))).map((o) => o.id),
  )
}

const orderIdOf = (v: Withdrawal['order']): number | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? v.id : v

/** Plan je Datensatz der Person (ohne Änderungen). */
export async function buildErasurePlan(
  req: PayloadRequest,
  request: PrivacyRequest,
  query: PersonQuery,
  now: Date,
): Promise<ErasurePlanRow[]> {
  // Nur Datensätze der Person (gespeicherte Adresse der Anfrage); mögliche Treffer mit anderer Adresse nie im Plan.
  const { matches: m } = await searchPerson(req, query, {
    excludeRequestId: request.id,
    ownEmails: [request.contactEmail],
  })
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

  const orders = await list<Order>('orders', m.orders)
  const withdrawals = await list<Withdrawal>('withdrawals', m.withdrawals)
  // Laufende Verträge – auch die Bestellungen der Widerrufe, die nicht selbst im Plan stehen
  const otherOrderIds = [
    ...new Set(
      withdrawals
        .map((w) => orderIdOf(w.order))
        .filter((id): id is number => id !== null && !m.orders.includes(id)),
    ),
  ]
  const running = await runningOrderIds(
    db,
    [...orders, ...(await list<Order>('orders', otherOrderIds))],
    now,
  )

  for (const o of orders) {
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
        state: 'anonymized',
      })
    } else if (o.privacy?.legalHold) {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until,
        actions: ['keep', 'restrict'],
        suggested: 'keep',
        note: `gesperrt: ${o.privacy.legalHoldReason ?? ''}`.trim(),
        state: 'held',
      })
    } else if (due(o.retainUntil, now)) {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until: null,
        actions: ['delete', 'keep'],
        suggested: 'delete',
        note: 'Aufbewahrungsfrist abgelaufen – Personendaten werden entfernt, Beleg bleibt',
        state: 'due',
      })
    } else if (o.privacy?.processingRestricted) {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until,
        actions: ['restrict', 'keep'],
        suggested: 'none',
        note: 'bereits eingeschränkt',
        state: 'restricted',
      })
    } else if (running.has(o.id)) {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until,
        actions: ['none', 'restrict', 'keep'],
        suggested: 'none',
        note: 'Vertrag läuft noch – Daten werden für Versand, Zahlung, Widerruf und Erstattung gebraucht; nach Abschluss schränkt der tägliche Nachlauf sie automatisch ein. „Einschränken“ jetzt stoppt auch Versand- und Erstattungsmails.',
        state: 'running',
      })
    } else {
      rows.push({
        ...base,
        ruleId: 'L-05 Stufe D',
        until,
        actions: ['restrict', 'keep'],
        suggested: 'restrict',
        note: 'Aufbewahrungspflicht (Handels- und Steuerrecht) – einschränken',
        state: 'retained',
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
  for (const w of withdrawals) {
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
        state: 'held',
      })
    } else if (due(until, now)) {
      rows.push({
        ...base,
        ruleId: L_08_WITHDRAWALS.id,
        until: null,
        actions: ['delete', 'keep'],
        suggested: 'delete',
        note: 'Aufbewahrungsfrist abgelaufen',
        state: 'due',
      })
    } else if (w.privacy?.processingRestricted === true) {
      rows.push({
        ...base,
        ruleId: L_08_WITHDRAWALS.id,
        until,
        actions: ['restrict', 'keep'],
        suggested: 'none',
        note: 'bereits eingeschränkt',
        state: 'restricted',
      })
    } else if (running.has(orderIdOf(w.order) ?? -1)) {
      // Rücksendung/Erstattung laufen noch: Mails dazu (z. B. M09) hängen an der Bestellung und gehen weiter
      rows.push({
        ...base,
        ruleId: L_08_WITHDRAWALS.id,
        until,
        actions: ['none', 'restrict', 'keep'],
        suggested: 'none',
        note: 'Widerruf wird noch abgewickelt (Rücksendung, Erstattung) – nach Abschluss schränkt der tägliche Nachlauf ihn automatisch ein.',
        state: 'running',
      })
    } else {
      rows.push({
        ...base,
        ruleId: L_08_WITHDRAWALS.id,
        until,
        actions: ['restrict', 'keep'],
        suggested: 'restrict',
        note: 'Aufbewahrungspflicht (Nachweis des Widerrufs) – einschränken',
        state: 'retained',
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
  /** Was danach tatsächlich gilt (für M15). */
  state: PrivacyErasureOutcome
  /** Aufbewahrung bis (ISO); `null` bei „gelöscht“ und bei laufendem Vertrag (Ende noch offen). */
  until: string | null
}

/** Vorgang, der beim Ausführen noch lief und nach Abschluss eingeschränkt wird (Nachlauf, LOESCHKONZEPT §5.6 Nr. 3). */
export interface ErasureFollowUp {
  collection: 'orders' | 'withdrawals'
  id: number
  /** Gemerkt am (ISO). */
  since: string
}

/** Schlüssel des Nachlaufs in `privacy-requests.remindersSent` (System-Feld, nicht in der Auskunft). */
export const ERASURE_FOLLOW_UP_KEY = 'erasureFollowUp'

/** Gemerkte Nachläufe einer Anfrage (unbekannte Einträge fallen heraus). */
export function followUpsOf(remindersSent: unknown): ErasureFollowUp[] {
  const raw = (remindersSent as Record<string, unknown> | null | undefined)?.[ERASURE_FOLLOW_UP_KEY]
  if (!Array.isArray(raw)) return []
  return raw.flatMap((e) => {
    const o = (e ?? {}) as Record<string, unknown>
    const id = Number(o.id)
    return (o.collection === 'orders' || o.collection === 'withdrawals') && Number.isSafeInteger(id)
      ? [{ collection: o.collection, id, since: String(o.since ?? '') }]
      : []
  })
}

export interface ErasureResult {
  request: PrivacyRequest
  outcomes: ErasureOutcome[]
  jobId: number | string | null
  /** In diesem Lauf wurde eine DHL-Einwilligung widerrufen (Art. 19, LOESCHKONZEPT §5.6 Nr. 4). */
  carrierConsentWithdrawn: boolean
  /** Vorgänge, die nach Abschluss automatisch eingeschränkt werden (Nachlauf). */
  followUps: ErasureFollowUp[]
}

/**
 * Zustand nach „keine Aktion“ (nichts geändert): Bestellungen/Widerrufe melden, was wirklich gilt – „eingeschränkt“ nur,
 * wenn schon eingeschränkt; sonst „aufbewahrt“ bzw. (laufender Vertrag) „brauche ich noch“. Belege „unverändert“.
 * Frist abgelaufen ohne Aktion ist kein gültiger Zustand (der Plan schlägt Löschen vor; „behalten“ braucht einen Grund).
 * Andere Bereiche folgen ihrem Vorgang und erscheinen ohne Aktion nicht in M15.
 */
export function stateWithoutAction(row: ErasurePlanRow): PrivacyErasureOutcome | null {
  if (row.area === 'invoices') return 'unchanged'
  if (row.area !== 'orders' && row.area !== 'withdrawals') return null
  switch (row.state) {
    case 'anonymized':
      return 'deleted'
    case 'held':
      return 'kept'
    case 'restricted':
      return 'restricted'
    case 'due':
      throw new PrivacyActionError(
        400,
        `„${row.label}“: Aufbewahrungsfrist abgelaufen – bitte „sofort löschen“ oder „behalten“ wählen.`,
      )
    default:
      return 'inUse'
  }
}

/** Wählbare Aktionen einer Zeile (Verwaltung und Prüfung): „keine Aktion“ überall außer bei abgelaufener Frist. */
export function erasureChoices(row: Pick<ErasurePlanRow, 'actions' | 'state'>): ErasureAction[] {
  return row.state === 'due' ? [...row.actions] : [...new Set([...row.actions, 'none' as const])]
}

const STATE_OF_ACTION = {
  delete: 'deleted',
  restrict: 'restricted',
  keep: 'kept',
} as const satisfies Record<Exclude<ErasureAction, 'none'>, PrivacyErasureOutcome>

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
  // 1. Alle Entscheidungen prüfen, bevor etwas geändert wird: gelöschte Dateien (Packfotos, Bilder) kommen beim
  //    Zurückrollen der Transaktion nicht zurück (Prüfung P18.5)
  const steps = plan.map((row) => {
    const d = decisions.find((x) => x.collection === row.collection && x.id === row.id)
    const action: ErasureAction = d?.action ?? 'none'
    // „keine Aktion“ bei abgelaufener Frist wirft (bitte löschen oder begründet behalten)
    const noneState = action === 'none' ? stateWithoutAction(row) : null
    if (action !== 'none' && !row.actions.includes(action)) {
      throw new PrivacyActionError(400, `„${row.label}“: Aktion nicht erlaubt.`)
    }
    const reason = d?.reason ?? ''
    if (action === 'keep' && (reason.length < 10 || reason.length > 300)) {
      throw new PrivacyActionError(
        400,
        `„${row.label}“: Bitte begründen, warum die Daten bleiben (10–300 Zeichen).`,
      )
    }
    return { row, action, reason, noneState }
  })
  const ref = request.reference
  const db = await dbFor(req)
  const outcomes: ErasureOutcome[] = []
  let carrierConsentWithdrawn = false
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
  // Mail-Jobs zu den Protokoll-Einträgen der Person (Kopie der Mail-Daten in der Warteschlange, L-13 i) – vor der
  // Löschung ermitteln, weil der Verweis danach ins Leere zeigt
  const mailJobs = await mailJobsFor(
    db,
    plan.filter((r) => r.collection === 'email-log').map((r) => r.id),
  )

  // 2. Anwenden
  for (const { row, action, reason, noneState } of steps) {
    if (action === 'none') {
      if (noneState) {
        outcomes.push({
          collection: row.collection,
          id: row.id,
          area: row.area,
          action,
          state: noneState,
          until: noneState === 'deleted' || row.state === 'running' ? null : row.until,
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
        const restricted = await restrictOrder(req, row.id, ref, now)
        if (restricted.carrierConsentWithdrawn) carrierConsentWithdrawn = true
      } else {
        await setLegalHold(req, 'orders', row.id, reason, ctx)
      }
    } else if (row.collection === 'withdrawals') {
      if (action === 'delete') {
        await deleteWithdrawalRecord(req, row.id)
        await log('withdrawals', row.id, 'deleted')
      } else if (action === 'restrict') {
        await restrictWithdrawal(req, row.id, ref, now)
      } else {
        await setLegalHold(req, 'withdrawals', row.id, reason, ctx)
      }
    } else if (row.collection === 'inquiries') {
      if (action === 'delete') {
        const files = await deleteInquiryRecord(req, row.id)
        await log('inquiries', row.id, 'deleted', files)
      } else {
        await setLegalHold(req, 'inquiries', row.id, reason, ctx)
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
      state: STATE_OF_ACTION[action],
      until: action === 'delete' ? null : row.until,
    })
  }

  // Die Löschanfrage widerruft eine aktive DHL-Einwilligung auch dort, wo die Bestellung (noch) nicht eingeschränkt wird
  // – laufende Verträge, „behalten“, „keine Aktion“ (Art. 17 Abs. 1 lit. b, Art. 19; LOESCHKONZEPT §5.6 Nr. 4)
  const otherOrders = steps
    .filter(
      (s) => s.row.collection === 'orders' && s.action !== 'delete' && s.action !== 'restrict',
    )
    .map((s) => s.row.id)
  if (otherOrders.length > 0) {
    const active = await db.execute(sql`
      SELECT id FROM orders WHERE id = ANY(${sql.raw(arr(otherOrders))})
         AND carrier_email_consent IS TRUE AND carrier_email_consent_revoked_at IS NULL
         AND privacy_anonymized_at IS NULL ORDER BY id`)
    if (active.rows.length > 0) {
      const { withdrawCarrierConsent } = await import('@/lib/commerce/carrierConsent')
      for (const r of active.rows) {
        const order = (await preservingReq(req, () =>
          req.payload.findByID({
            collection: 'orders',
            id: Number(r.id),
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )) as Order
        if (!(await withdrawCarrierConsent(req, order, now)).unchanged) {
          carrierConsentWithdrawn = true
        }
      }
    }
  }

  // Nicht mehr versendbare Mail-Jobs der Person (gescheitert, hängend oder ohne Protokoll-Eintrag) sofort löschen;
  // wartende Mails zu aufbewahrten Vorgängen bleiben (Prüfung P18.5)
  for (const jobId of await deleteSpentMailJobs(db, mailJobs, now)) {
    await log('payload-jobs', jobId, 'deleted')
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
        carrierConsentWithdrawn,
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
  // Nachlauf merken (nach dem Speichern von `answeredAt`, das die Zeile sonst mit dem alten Stand überschreibt):
  // laufende Vorgänge mit „keine Aktion“ – frühere Einträge zu Zeilen dieses Plans ersetzt die neue Entscheidung
  const remindersSent = await saveFollowUps(
    db,
    request.id,
    plan,
    steps
      .filter((s) => s.action === 'none' && s.row.state === 'running')
      .map((s) => ({
        collection: s.row.collection as ErasureFollowUp['collection'],
        id: s.row.id,
        since: now.toISOString(),
      })),
  )
  return {
    request: { ...updated, remindersSent },
    outcomes,
    jobId,
    carrierConsentWithdrawn,
    followUps: followUpsOf(remindersSent),
  }
}

async function saveFollowUps(
  db: SqlExecutor,
  requestId: number,
  plan: readonly ErasurePlanRow[],
  added: readonly ErasureFollowUp[],
): Promise<Record<string, unknown>> {
  const res = await db.execute(
    sql`SELECT reminders_sent FROM privacy_requests WHERE id = ${requestId} FOR UPDATE`,
  )
  const sent = (res.rows[0]?.reminders_sent ?? {}) as Record<string, unknown>
  const before = followUpsOf(sent)
  const inPlan = (f: ErasureFollowUp) =>
    plan.some((r) => r.collection === f.collection && r.id === f.id)
  const next = [...before.filter((f) => !inPlan(f)), ...added]
  if (next.length === 0 && before.length === 0) return sent
  const merged = { ...sent, [ERASURE_FOLLOW_UP_KEY]: next }
  await db.execute(
    sql`UPDATE privacy_requests SET reminders_sent = ${JSON.stringify(merged)}::jsonb WHERE id = ${requestId}`,
  )
  return merged
}

/**
 * M15-Zusammenfassung je Bereich nach dem tatsächlichen Zustand: aufbewahrt (Sperre), eingeschränkt, „brauche ich noch“
 * (je mit spätestem Datum; laufende Verträge ohne Datum als eigene Zeile) vor gelöscht; Belege „unverändert“.
 */
export function summarizeOutcomes(outcomes: readonly ErasureOutcome[]) {
  const byArea = new Map<PrivacyArea, ErasureOutcome[]>()
  for (const o of outcomes) byArea.set(o.area, [...(byArea.get(o.area) ?? []), o])
  const latest = (list: ErasureOutcome[]) =>
    list
      .map((o) => o.until)
      .filter((u): u is string => !!u)
      .sort()
      .at(-1) ?? null
  const out: { area: PrivacyArea; outcome: PrivacyErasureOutcome; until?: string | null }[] = []
  for (const [area, list] of byArea) {
    if (area === 'invoices') {
      out.push({ area, outcome: 'unchanged', until: latest(list) })
      continue
    }
    for (const outcome of ['kept', 'restricted'] as const) {
      const of = list.filter((o) => o.state === outcome)
      if (of.length > 0) out.push({ area, outcome, until: latest(of) })
    }
    const inUse = list.filter((o) => o.state === 'inUse')
    if (inUse.some((o) => !o.until)) out.push({ area, outcome: 'inUse', until: null })
    if (inUse.some((o) => !!o.until)) out.push({ area, outcome: 'inUse', until: latest(inUse) })
    if (list.some((o) => o.state === 'deleted')) out.push({ area, outcome: 'deleted' })
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

/** Widerruf einschränken (Art. 18): `processingRestricted`, Notizen leeren, `deletion-log`. */
export async function restrictWithdrawal(
  req: PayloadRequest,
  id: number,
  privacyRequestRef: string,
  now: Date,
): Promise<void> {
  await updatePrivacy(
    req,
    'withdrawals',
    id,
    { processingRestricted: true },
    { ...req.context, system: true, now: now.toISOString() },
    { adminNotes: null },
  )
  await writeDeletionLog(req, {
    entityCollection: 'withdrawals',
    entityId: id,
    ruleId: 'DSGVO',
    action: 'restricted',
    trigger: 'privacy_request',
    privacyRequestRef,
    storageObjectsCount: 0,
    executedAt: now,
  })
}

/**
 * Bestellung einschränken (Art. 18, LOESCHKONZEPT §5.7): `processingRestricted`, Notizen und Gruß der Geschenkkarte
 * leeren, Packfotos sofort löschen; Mails zur Bestellung unterdrückt danach die Outbox. Meldet, ob dabei eine DHL-Einwilligung widerrufen wurde.
 */
export async function restrictOrder(
  req: PayloadRequest,
  id: number,
  privacyRequestRef: string,
  now: Date,
): Promise<{ carrierConsentWithdrawn: boolean }> {
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
  let carrierConsentWithdrawn = false
  if (order.carrierEmailConsent === true && !order.carrierEmailConsentRevokedAt) {
    const { withdrawCarrierConsent } = await import('@/lib/commerce/carrierConsent')
    const res = await withdrawCarrierConsent(req, order, now)
    carrierConsentWithdrawn = !res.unchanged
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
        // Gruß für die Geschenkkarte (V-18 b) ist für keine Aufbewahrungspflicht nötig – mit der Einschränkung weg
        gift: { ...(fresh.gift ?? {}), message: null },
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
  return { carrierConsentWithdrawn }
}
