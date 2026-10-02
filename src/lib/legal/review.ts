import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { LEGAL_TEXT_TYPES, type LegalTextOrigin, type LegalTextType } from '@/lib/enums'
import { poolDb } from '@/lib/jobs/runLog'
import { berlinDateKey } from '@/lib/time'

// Jährliche Prüf-Erinnerung der Rechtstexte (R-014, PLAN P6.20, DATENMODELL §7.1 `legal.reviews`, §11): je Typ zählt das
// jüngere Datum aus `activatedAt` der aktiven Fassung und `settings.legal.reviews[type].reviewedAt`. Ab
// `reviewIntervalDays` (Standard 365) Berliner Kalendertagen ist der Typ fällig; der Task `legalReviewReminder` schickt
// A10 einmal mit allen fälligen Typen und danach alle 30 Tage erneut (`lastReminderSentAt`), bis eine neue Fassung aktiv
// oder der Typ als „geprüft“ markiert ist. Dieselbe Rechnung speist die „Heute“-Kachel „Rechtstexte“.

/** Standard-Intervall der Prüfung (R-014). */
export const DEFAULT_LEGAL_REVIEW_INTERVAL_DAYS = 365
/** Wiederholung der Erinnerung, solange ein Typ fällig bleibt. */
export const LEGAL_REVIEW_REPEAT_DAYS = 30

export interface ActiveLegalTextRow {
  type: LegalTextType
  version?: number | null
  validFrom: string
  activatedAt?: string | null
  origin?: LegalTextOrigin | null
}

export interface LegalReviewRow {
  type: LegalTextType
  reviewedAt?: string | null
  lastReminderSentAt?: string | null
}

export type LegalReviewWarning = 'missing' | 'not_lawyer' | 'overdue'

export interface LegalReviewState {
  type: LegalTextType
  /** Aktive Fassung vorhanden. */
  present: boolean
  version: number | null
  validFrom: string | null
  origin: LegalTextOrigin | null
  /** Jüngeres Datum aus Aktivierung und Prüfung (ISO); `null` ohne aktive Fassung. */
  lastReviewedAt: string | null
  /** Alter in Berliner Kalendertagen seit `lastReviewedAt`. */
  ageDays: number | null
  /** Prüfung fällig (Alter ≥ Intervall). */
  due: boolean
  /** Erinnerung jetzt zu senden (fällig und letzte Erinnerung leer oder ≥ 30 Tage her). */
  remind: boolean
  lastReminderSentAt: string | null
  warnings: LegalReviewWarning[]
}

const dayNumber = (d: Date): number => {
  const [y, m, day] = berlinDateKey(d).split('-').map(Number)
  return Date.UTC(y!, m! - 1, day!) / 86_400_000
}

/** Differenz in Berliner Kalendertagen (`to − from`). */
export function berlinDaysBetween(from: Date, to: Date): number {
  return dayNumber(to) - dayNumber(from)
}

const parse = (v: string | null | undefined): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Rein: Prüfstand je Rechtstext-Typ (Reihenfolge `LEGAL_TEXT_TYPES`). */
export function legalReviewStates(
  active: readonly ActiveLegalTextRow[],
  reviews: readonly LegalReviewRow[],
  now: Date,
  intervalDays: number = DEFAULT_LEGAL_REVIEW_INTERVAL_DAYS,
): LegalReviewState[] {
  return LEGAL_TEXT_TYPES.map((type) => {
    const text = active.find((t) => t.type === type) ?? null
    const review = reviews.find((r) => r.type === type) ?? null
    const lastReminder = parse(review?.lastReminderSentAt)
    if (!text) {
      return {
        type,
        present: false,
        version: null,
        validFrom: null,
        origin: null,
        lastReviewedAt: null,
        ageDays: null,
        due: false,
        remind: false,
        lastReminderSentAt: lastReminder?.toISOString() ?? null,
        warnings: ['missing'],
      }
    }
    const candidates = [parse(text.activatedAt) ?? parse(text.validFrom), parse(review?.reviewedAt)]
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime())
    const last = candidates.length > 0 ? new Date(Math.max(...candidates)) : null
    const ageDays = last ? berlinDaysBetween(last, now) : null
    const due = ageDays !== null && ageDays >= intervalDays
    const remind =
      due &&
      (lastReminder === null || berlinDaysBetween(lastReminder, now) >= LEGAL_REVIEW_REPEAT_DAYS)
    const warnings: LegalReviewWarning[] = []
    if (text.origin !== 'lawyer') warnings.push('not_lawyer')
    if (due) warnings.push('overdue')
    return {
      type,
      present: true,
      version: text.version ?? null,
      validFrom: text.validFrom,
      origin: text.origin ?? null,
      lastReviewedAt: last?.toISOString() ?? null,
      ageDays,
      due,
      remind,
      lastReminderSentAt: lastReminder?.toISOString() ?? null,
      warnings,
    }
  })
}

type SettingsLegal = {
  legal?: { reviewIntervalDays?: number | null; reviews?: LegalReviewRow[] | null } | null
}

/** Lädt aktive Fassungen und `settings.legal` und berechnet den Prüfstand. */
export async function loadLegalReviewStates(
  payload: Payload,
  now: Date,
  req?: PayloadRequest,
): Promise<LegalReviewState[]> {
  const [texts, settings] = await Promise.all([
    payload.find({
      collection: 'legal-texts',
      where: { status: { equals: 'active' } },
      select: { type: true, version: true, validFrom: true, activatedAt: true, origin: true },
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  ])
  const legal = (settings as unknown as SettingsLegal).legal
  return legalReviewStates(
    texts.docs as unknown as ActiveLegalTextRow[],
    legal?.reviews ?? [],
    now,
    legal?.reviewIntervalDays ?? DEFAULT_LEGAL_REVIEW_INTERVAL_DAYS,
  )
}

export interface LegalReviewRunResult {
  sent: boolean
  due: LegalTextType[]
  reminded: LegalTextType[]
}

/**
 * Task-Arbeit (R-014): A10 mit allen fälligen Typen, sobald mindestens einer eine Erinnerung braucht; danach
 * `lastReminderSentAt` für die fälligen Typen. Idempotent je Berliner Tag (Schlüssel `admin_legal_review_due:<Tag>`).
 */
export async function runLegalReviewReminder(
  req: PayloadRequest,
  now: Date,
): Promise<LegalReviewRunResult> {
  const states = await loadLegalReviewStates(req.payload, now, req)
  const due = states.filter((s) => s.due)
  if (!due.some((s) => s.remind)) {
    return { sent: false, due: due.map((s) => s.type), reminded: [] }
  }
  const { notifyAdmin } = await import('@/lib/email/notifyAdmin')
  const res = await notifyAdmin(
    req,
    'admin_legal_review_due',
    { texts: due.map((s) => ({ type: s.type, lastReviewedAt: s.lastReviewedAt! })) },
    { now, idempotencyKey: `admin_legal_review_due:${berlinDateKey(now)}:annual` },
  )
  const types = due.map((s) => s.type)
  // Direkt in den Zeilen: ein Speichern über die Global-API würde alle Einstellungen erneut prüfen und auditieren.
  const db = poolDb(req.payload)
  const updated = await db.execute(sql`
    UPDATE settings_legal_reviews SET last_reminder_sent_at = ${now.toISOString()}::timestamptz
     WHERE type::text IN (${sql.join(
       types.map((t) => sql`${t}`),
       sql`, `,
     )})
  `)
  const rowCount = (updated as unknown as { rowCount?: number }).rowCount ?? 0
  if (rowCount < types.length) {
    // Fehlende Zeilen (sollte es laut Standardwert nicht geben): über die Global-API ergänzen.
    const settings = (await req.payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as SettingsLegal
    const rows = [...(settings.legal?.reviews ?? [])]
    for (const type of types) {
      const row = rows.find((r) => r.type === type)
      if (row) row.lastReminderSentAt = now.toISOString()
      else rows.push({ type, lastReminderSentAt: now.toISOString() })
    }
    await req.payload.updateGlobal({
      slug: 'settings',
      data: { legal: { ...(settings.legal ?? {}), reviews: rows } } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, skipAudit: true },
    })
  }
  return {
    sent: 'status' in res && res.status === 'queued',
    due: types,
    reminded: types,
  }
}
