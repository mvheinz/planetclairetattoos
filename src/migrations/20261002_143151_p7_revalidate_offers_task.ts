import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'revalidateEndedOffers' BEFORE 'retentionAbandonedCheckouts';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'revalidateEndedOffers' BEFORE 'retentionAbandonedCheckouts';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'prepaymentReminders', 'cancelOverduePrepayments', 'sendEmail', 'renderInvoicePdf', 'renderLegalTextPdf', 'markDelivered', 'withdrawalDeadlines', 'revenueGuardCheck', 'monthlyClose', 'invoiceIntegrityCheck', 'complianceDocsReview', 'activateScheduledLegalTexts', 'retentionAbandonedCheckouts', 'retentionOrderMinimize', 'retentionOrders', 'retentionInvoices', 'retentionWithdrawals', 'retentionCommissionInquiries', 'retentionEmailLog', 'retentionPrivacyRequests', 'retentionConsentEvidence', 'retentionDeletionLog', 'retentionTechnical', 'legalHoldReview', 'legalReviewReminder', 'privacyRequestsDeadlineReminder');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'prepaymentReminders', 'cancelOverduePrepayments', 'sendEmail', 'renderInvoicePdf', 'renderLegalTextPdf', 'markDelivered', 'withdrawalDeadlines', 'revenueGuardCheck', 'monthlyClose', 'invoiceIntegrityCheck', 'complianceDocsReview', 'activateScheduledLegalTexts', 'retentionAbandonedCheckouts', 'retentionOrderMinimize', 'retentionOrders', 'retentionInvoices', 'retentionWithdrawals', 'retentionCommissionInquiries', 'retentionEmailLog', 'retentionPrivacyRequests', 'retentionConsentEvidence', 'retentionDeletionLog', 'retentionTechnical', 'legalHoldReview', 'legalReviewReminder', 'privacyRequestsDeadlineReminder');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";`)
}
