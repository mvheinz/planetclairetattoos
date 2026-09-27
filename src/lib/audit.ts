import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { ActorType, AuditAction } from '@/lib/enums'
import { getAppContext } from '@/lib/payload/context'
import { auditRetentionRule, retainUntil } from '@/lib/retention/policy'
import { redact, redactText } from '@/lib/security/redact'

// Audit-Protokoll (DATENMODELL §6.21): einziger Schreibweg in `audit-log`. Personenbezogene Werte werden maskiert
// (Schlüssel wie email/name/address/phone/iban und Freitext, der wie E-Mail, IBAN, Telefon oder Token aussieht).

export interface AuditEntry {
  action: AuditAction
  entityCollection: string
  entityId: number | string
  /** Deutscher Satz ≤ 300 Zeichen, z. B. „Nr. 017: Preis 45,00 € → 49,00 €“. */
  summary: string
  /** `{ feld: [alt, neu] }` */
  changes?: Record<string, readonly [unknown, unknown]>
  /** Übergangs-ID eines Statusautomaten (z. B. `P3`, `W2`); abgelegt als `changes.$transition`. */
  transition?: string
  actorType?: ActorType
  seed?: boolean
  seedKey?: string
}

export const AUDIT_SUMMARY_MAX = 300

/** Maskiert personenbezogene Werte in `changes` (auch verschachtelt). */
export function maskChanges(changes: AuditEntry['changes']): Record<string, unknown> | undefined {
  if (!changes) return undefined
  return redact(changes) as Record<string, unknown>
}

export function maskSummary(summary: string): string {
  const s = redactText(summary)
  return s.length > AUDIT_SUMMARY_MAX ? `${s.slice(0, AUDIT_SUMMARY_MAX - 1)}…` : s
}

function actorOf(req: PayloadRequest, entry: AuditEntry): ActorType {
  if (entry.actorType) return entry.actorType
  if (req.user?.collection === 'users') return 'admin'
  if (getAppContext(req).seed) return 'seed'
  return 'system'
}

/**
 * Schreibt einen Audit-Eintrag in derselben Transaktion wie `req`. Bei `context.skipAudit` (Seed-Import,
 * Log-Collections selbst) wird nichts geschrieben.
 */
export async function writeAudit(req: PayloadRequest, entry: AuditEntry) {
  if (getAppContext(req).skipAudit) return null
  const actorType = actorOf(req, entry)
  const changes = maskChanges(entry.changes)
  const data = {
    action: entry.action,
    actorType,
    actorUser:
      actorType === 'admin' && req.user?.collection === 'users' ? Number(req.user.id) : undefined,
    entityCollection: entry.entityCollection,
    entityId: String(entry.entityId),
    summary: maskSummary(entry.summary),
    changes: entry.transition ? { ...changes, $transition: entry.transition } : changes,
    seed: entry.seed ?? false,
    seedKey: entry.seedKey,
    // L-13 h (der Hook der Collection rechnet denselben Wert nach)
    retainUntil: retainUntil(auditRetentionRule(entry.action), new Date()).toISOString(),
  }
  // Payload überschreibt req.context mit dem übergebenen Kontext – danach wiederherstellen.
  const previous = req.context
  try {
    return await req.payload.create({
      collection: 'audit-log',
      data,
      req,
      overrideAccess: true,
      context: { skipAudit: true },
    })
  } finally {
    req.context = previous
  }
}

/** Aktionen, die einen Statuswechsel dokumentieren (KONZEPT §5 Nr. 2). */
export const STATUS_ACTIONS: Readonly<Record<string, readonly AuditAction[]>> = {
  products: ['product_status_changed'],
  withdrawals: ['withdrawal_status_changed'],
  inquiries: ['inquiry_status_changed'],
}

export interface StatusHistoryEntry {
  at: string
  action: AuditAction
  actorType: ActorType
  from: string | null
  to: string | null
  transition: string | null
  summary: string
}

/**
 * Statusverlauf für Stücke, Widerrufe und Anfragen aus dem `audit-log` (DM-21). Bestellungen haben zusätzlich
 * `orders.statusHistory` (P1.20).
 */
export async function getStatusHistory(
  collection: string,
  id: number | string,
  opts: { req?: PayloadRequest; payload?: Payload } = {},
): Promise<StatusHistoryEntry[]> {
  const payload =
    opts.payload ??
    opts.req?.payload ??
    (await (
      await import('payload')
    ).getPayload({ config: (await import('@payload-config')).default }))
  const actions = STATUS_ACTIONS[collection] ?? []
  if (actions.length === 0) return []
  const res = await payload.find({
    collection: 'audit-log',
    where: {
      and: [
        { entityCollection: { equals: collection } },
        { entityId: { equals: String(id) } },
        { action: { in: [...actions] } },
      ],
    },
    sort: 'createdAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req: opts.req,
  })
  return res.docs.map((doc) => {
    const changes = (doc.changes ?? {}) as Record<string, unknown>
    const status = Array.isArray(changes.status) ? (changes.status as unknown[]) : []
    return {
      at: doc.createdAt,
      action: doc.action,
      actorType: doc.actorType,
      from: (status[0] as string | undefined) ?? null,
      to: (status[1] as string | undefined) ?? null,
      transition: typeof changes.$transition === 'string' ? changes.$transition : null,
      summary: doc.summary,
    }
  })
}
