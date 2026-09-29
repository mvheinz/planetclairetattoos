import type { TaskConfig } from 'payload'

import { renderInvoicePdfTask } from './renderInvoicePdf'
import { sendEmailTask } from './sendEmail'

// Alle Task-Slugs der Jobs-Queue (ARCHITEKTUR Anhang A.3, DATENMODELL §11) mit Queue und umsetzender Phase.
// Registriert werden nur umgesetzte Tasks (JOB_TASKS). Der Unit-Test tests/unit/jobs/slugs.unit.spec.ts gleicht die
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
export const JOB_TASKS: TaskConfig<any>[] = [sendEmailTask, renderInvoicePdfTask]

export const IMPLEMENTED_TASK_SLUGS = new Set<string>(JOB_TASKS.map((t) => t.slug))

export function isImplementedTask(slug: string): boolean {
  return IMPLEMENTED_TASK_SLUGS.has(slug)
}
