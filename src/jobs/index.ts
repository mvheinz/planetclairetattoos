import type { TaskConfig } from 'payload'

import { instrumentTask } from '@/lib/jobs/instrument'

import { activateScheduledLegalTextsTask } from './activateScheduledLegalTexts'
import { cancelOverduePrepaymentsTask } from './cancelOverduePrepayments'
import { complianceDocsReviewTask } from './complianceDocsReview'
import { invoiceIntegrityCheckTask } from './invoiceIntegrityCheck'
import {
  legalReviewReminderTask,
  LEGAL_REVIEW_TASK_BERLIN_HOUR,
  LEGAL_REVIEW_TASK_BERLIN_MINUTE,
} from './legalReviewReminder'
import { markDeliveredTask } from './markDelivered'
import { monthlyCloseTask } from './monthlyClose'
import { prepaymentRemindersTask } from './prepaymentReminders'
import { releaseExpiredReservationsTask } from './releaseExpiredReservations'
import { renderInvoicePdfTask } from './renderInvoicePdf'
import { renderLegalTextPdfTask } from './renderLegalTextPdf'
import { WITHDRAWAL_DEADLINES_BERLIN_HOUR, withdrawalDeadlinesTask } from './withdrawalDeadlines'
import {
  legalHoldReviewTask,
  LEGAL_HOLD_REVIEW_BERLIN_HOUR,
  RETENTION_SCHEDULE,
  retentionAbandonedCheckoutsTask,
  retentionCommissionInquiriesTask,
  retentionConsentEvidenceTask,
  retentionDeletionLogTask,
  retentionEmailLogTask,
  retentionInvoicesTask,
  retentionOrderMinimizeTask,
  retentionOrdersTask,
  retentionPrivacyRequestsTask,
  retentionTechnicalTask,
  retentionWithdrawalsTask,
} from './retention'
import { revenueGuardCheckTask } from './revenueGuardCheck'
import { sendEmailTask } from './sendEmail'

// Alle Task-Slugs der Jobs-Queue (ARCHITEKTUR Anhang A.3, DATENMODELL §11) mit Queue und umsetzender Phase.
// Registriert werden nur umgesetzte Tasks (JOB_TASKS), jeweils mit Lauf-Protokoll `job_runs` und A12 bei Fehlschlag
// (`instrumentTask`, P5.3). Der Unit-Test tests/unit/jobs/slugs.unit.spec.ts gleicht die
// Liste mit der Tabelle in ARCHITEKTUR Anhang A.3 ab.

export const JOB_QUEUES = ['commerce', 'email', 'documents', 'maintenance'] as const
export type JobQueue = (typeof JOB_QUEUES)[number]

type Phase = `P${number}`

export const TASK_DEFS = {
  releaseExpiredReservations: { queue: 'commerce', phase: 'P4' },
  prepaymentReminders: { queue: 'commerce', phase: 'P4' },
  cancelOverduePrepayments: { queue: 'commerce', phase: 'P4' },
  sendEmail: { queue: 'email', phase: 'P1', needsInput: true },
  renderInvoicePdf: { queue: 'documents', phase: 'P4', needsInput: true },
  renderLegalTextPdf: { queue: 'documents', phase: 'P4', needsInput: true },
  activateScheduledLegalTexts: { queue: 'maintenance', phase: 'P6' },
  revalidateEndedOffers: { queue: 'maintenance', phase: 'P7' },
  markDelivered: { queue: 'commerce', phase: 'P5' },
  withdrawalDeadlines: { queue: 'commerce', phase: 'P6' },
  legalReviewReminder: { queue: 'maintenance', phase: 'P6' },
  revenueGuardCheck: { queue: 'maintenance', phase: 'P5' },
  monthlyClose: { queue: 'documents', phase: 'P5' },
  invoiceIntegrityCheck: { queue: 'maintenance', phase: 'P5' },
  retentionAbandonedCheckouts: { queue: 'maintenance', phase: 'P6' },
  retentionOrderMinimize: { queue: 'maintenance', phase: 'P6' },
  retentionOrders: { queue: 'maintenance', phase: 'P6' },
  retentionInvoices: { queue: 'maintenance', phase: 'P6' },
  retentionWithdrawals: { queue: 'maintenance', phase: 'P6' },
  retentionCommissionInquiries: { queue: 'maintenance', phase: 'P6' },
  retentionEmailLog: { queue: 'maintenance', phase: 'P6' },
  retentionPrivacyRequests: { queue: 'maintenance', phase: 'P6' },
  retentionConsentEvidence: { queue: 'maintenance', phase: 'P6' },
  retentionDeletionLog: { queue: 'maintenance', phase: 'P6' },
  retentionTechnical: { queue: 'maintenance', phase: 'P6' },
  legalHoldReview: { queue: 'maintenance', phase: 'P6' },
  privacyRequestsDeadlineReminder: { queue: 'maintenance', phase: 'P6' },
  complianceDocsReview: { queue: 'maintenance', phase: 'P5' },
} as const satisfies Record<string, { queue: JobQueue; phase: Phase; needsInput?: boolean }>

export type TaskSlug = keyof typeof TASK_DEFS
export const TASK_SLUGS = Object.keys(TASK_DEFS) as TaskSlug[]

export const JOB_QUEUE_OF = Object.fromEntries(TASK_SLUGS.map((s) => [s, TASK_DEFS[s].queue])) as {
  [K in TaskSlug]: (typeof TASK_DEFS)[K]['queue']
}

export function isTaskSlug(value: string): value is TaskSlug {
  return Object.prototype.hasOwnProperty.call(TASK_DEFS, value)
}

/** In payload.config.ts registrierte Tasks (nur umgesetzte). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const JOB_TASKS: TaskConfig<any>[] = [
  releaseExpiredReservationsTask,
  prepaymentRemindersTask,
  cancelOverduePrepaymentsTask,
  sendEmailTask,
  renderInvoicePdfTask,
  renderLegalTextPdfTask,
  markDeliveredTask,
  withdrawalDeadlinesTask,
  revenueGuardCheckTask,
  monthlyCloseTask,
  invoiceIntegrityCheckTask,
  complianceDocsReviewTask,
  activateScheduledLegalTextsTask,
  retentionAbandonedCheckoutsTask,
  retentionOrderMinimizeTask,
  retentionOrdersTask,
  retentionInvoicesTask,
  retentionWithdrawalsTask,
  retentionCommissionInquiriesTask,
  retentionEmailLogTask,
  retentionPrivacyRequestsTask,
  retentionConsentEvidenceTask,
  retentionDeletionLogTask,
  retentionTechnicalTask,
  legalHoldReviewTask,
  legalReviewReminderTask,
].map((t) => instrumentTask(t, TASK_DEFS[t.slug as TaskSlug].queue))

export const IMPLEMENTED_TASK_SLUGS = new Set<string>(JOB_TASKS.map((t) => t.slug))

export function isImplementedTask(slug: string): boolean {
  return IMPLEMENTED_TASK_SLUGS.has(slug)
}

/**
 * Fristen-Tasks ohne Eingabe, die jeder volle Lauf des Job-Weckers einreiht (Weckzeit bzw. stündliches Netz,
 * ARCHITEKTUR §9.6 Nr. 3/5): sie entscheiden selbst nach gespeicherten Zeitpunkten, was fällig ist.
 */
export const WAKE_TASK_SLUGS: readonly TaskSlug[] = (
  [
    'releaseExpiredReservations',
    'prepaymentReminders',
    'cancelOverduePrepayments',
    'markDelivered',
    'withdrawalDeadlines',
    'revenueGuardCheck',
    'monthlyClose',
    'invoiceIntegrityCheck',
    'complianceDocsReview',
    'activateScheduledLegalTexts',
    ...(Object.keys(RETENTION_SCHEDULE) as (keyof typeof RETENTION_SCHEDULE)[]),
    'retentionTechnical',
    'legalHoldReview',
    'legalReviewReminder',
  ] as const
).filter((s) => isImplementedTask(s))

/**
 * Tägliche Wecker-Tasks: erst ab dieser Berliner Stunde einreihen (KONZEPT §8.1 Nr. 3 „ab 07:00“). Sie sind idempotent
 * und laufen danach mit jedem Lauf des Weckers (mindestens stündlich) – ohne zusätzliche Datenbank-Weckungen.
 */
export const WAKE_TASK_NOT_BEFORE_HOUR: Partial<Record<TaskSlug, number>> = {
  revenueGuardCheck: 7,
}

/**
 * Tägliche/monatliche Wecker-Tasks mit `runOncePer` (KONZEPT §8.1 Nr. 3): der Wecker reiht sie nur ein, solange ihr
 * Zeitraum erreicht und noch nicht erledigt ist (ein erfolgreicher Lauf in `job_runs`) – sonst kein Job und kein
 * Protokolleintrag je Stunde. Die Tasks prüfen dasselbe unter ihrem Lock noch einmal.
 */
export const WAKE_TASK_PERIOD: Partial<
  Record<TaskSlug, { per: 'day' | 'month'; berlinHour: number; berlinMinute?: number }>
> = {
  monthlyClose: { per: 'month', berlinHour: 4 },
  invoiceIntegrityCheck: { per: 'month', berlinHour: 4 },
  complianceDocsReview: { per: 'month', berlinHour: 8, berlinMinute: 10 },
  markDelivered: { per: 'day', berlinHour: 3 },
  withdrawalDeadlines: { per: 'day', berlinHour: WITHDRAWAL_DEADLINES_BERLIN_HOUR },
  ...(Object.fromEntries(
    Object.entries(RETENTION_SCHEDULE).map(([slug, t]) => [
      slug,
      { per: 'day', berlinHour: t.berlinHour, berlinMinute: t.berlinMinute },
    ]),
  ) as Partial<Record<TaskSlug, { per: 'day'; berlinHour: number; berlinMinute: number }>>),
  legalHoldReview: { per: 'day', berlinHour: LEGAL_HOLD_REVIEW_BERLIN_HOUR },
  legalReviewReminder: {
    per: 'day',
    berlinHour: LEGAL_REVIEW_TASK_BERLIN_HOUR,
    berlinMinute: LEGAL_REVIEW_TASK_BERLIN_MINUTE,
  },
}
