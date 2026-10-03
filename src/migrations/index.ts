import * as migration_20260927_094042_p1_baseline from './20260927_094042_p1_baseline';
import * as migration_20260927_095251_p1_localization from './20260927_095251_p1_localization';
import * as migration_20260927_100056_p1_logs from './20260927_100056_p1_logs';
import * as migration_20260927_101338_p1_storage from './20260927_101338_p1_storage';
import * as migration_20260927_102652_p1_jobs from './20260927_102652_p1_jobs';
import * as migration_20260927_104753_p1_users from './20260927_104753_p1_users';
import * as migration_20260927_104805_p1_rate_limit from './20260927_104805_p1_rate_limit';
import * as migration_20260927_112218_p1_media from './20260927_112218_p1_media';
import * as migration_20260927_113844_p1_documents from './20260927_113844_p1_documents';
import * as migration_20260927_115819_p1_globals from './20260927_115819_p1_globals';
import * as migration_20260927_120755_p1_categories from './20260927_120755_p1_categories';
import * as migration_20260927_122558_p1_products from './20260927_122558_p1_products';
import * as migration_20260927_131109_p1_orders from './20260927_131109_p1_orders';
import * as migration_20260927_132358_p1_invoices from './20260927_132358_p1_invoices';
import * as migration_20260927_140139_p1_legal from './20260927_140139_p1_legal';
import * as migration_20260927_141511_p1_tattoo from './20260927_141511_p1_tattoo';
import * as migration_20260927_143154_p1_content from './20260927_143154_p1_content';
import * as migration_20260927_144252_p1_private_upload_links from './20260927_144252_p1_private_upload_links';
import * as migration_20260927_145135_p1_constraints from './20260927_145135_p1_constraints';
import * as migration_20260928_230534_p4_mock_state_guard from './20260928_230534_p4_mock_state_guard';
import * as migration_20260929_004609_p4_invoice_pdf from './20260929_004609_p4_invoice_pdf';
import * as migration_20260929_010331_p4_legal_pdf from './20260929_010331_p4_legal_pdf';
import * as migration_20260929_011628_p4_email_outbox from './20260929_011628_p4_email_outbox';
import * as migration_20260929_031002_p4_release_job from './20260929_031002_p4_release_job';
import * as migration_20260929_032338_p4_prepayment_jobs from './20260929_032338_p4_prepayment_jobs';
import * as migration_20260929_081932_p5_revenue_guard from './20260929_081932_p5_revenue_guard';
import * as migration_20260929_102355_p5_job_runs from './20260929_102355_p5_job_runs';
import * as migration_20260929_104802_p5_monthly_close_jobs from './20260929_104802_p5_monthly_close_jobs';
import * as migration_20261001_193246_p5_compliance_docs_job from './20261001_193246_p5_compliance_docs_job';
import * as migration_20261001_195941_p5_mark_delivered_job from './20261001_195941_p5_mark_delivered_job';
import * as migration_20261002_020524_p6_legal_snippets_complaints from './20261002_020524_p6_legal_snippets_complaints';
import * as migration_20261002_020601_p6_legal_snippets_complaints_constraints from './20261002_020601_p6_legal_snippets_complaints_constraints';
import * as migration_20261002_023800_p6_activate_legal_job from './20261002_023800_p6_activate_legal_job';
import * as migration_20261002_032940_p6_retention_failures from './20261002_032940_p6_retention_failures';
import * as migration_20261002_033402_p6_retention_jobs from './20261002_033402_p6_retention_jobs';
import * as migration_20261002_041023_p6_retention_jobs_part2 from './20261002_041023_p6_retention_jobs_part2';
import * as migration_20261002_043628_p6_legal_review_job from './20261002_043628_p6_legal_review_job';
import * as migration_20261002_091942_p6_withdrawal_inbox_refunds from './20261002_091942_p6_withdrawal_inbox_refunds';
import * as migration_20261002_101152_p6_withdrawal_deadlines_task from './20261002_101152_p6_withdrawal_deadlines_task';
import * as migration_20261002_122832_p6_privacy_requests_task from './20261002_122832_p6_privacy_requests_task';
import * as migration_20261002_130126_p6_invoice_reissue from './20261002_130126_p6_invoice_reissue';
import * as migration_20261002_130238_p6_invoice_reissue_constraints from './20261002_130238_p6_invoice_reissue_constraints';
import * as migration_20261002_143151_p7_revalidate_offers_task from './20261002_143151_p7_revalidate_offers_task';
import * as migration_20261003_065710_p8_media_owner_approved from './20261003_065710_p8_media_owner_approved';

export const migrations = [
  {
    up: migration_20260927_094042_p1_baseline.up,
    down: migration_20260927_094042_p1_baseline.down,
    name: '20260927_094042_p1_baseline',
  },
  {
    up: migration_20260927_095251_p1_localization.up,
    down: migration_20260927_095251_p1_localization.down,
    name: '20260927_095251_p1_localization',
  },
  {
    up: migration_20260927_100056_p1_logs.up,
    down: migration_20260927_100056_p1_logs.down,
    name: '20260927_100056_p1_logs',
  },
  {
    up: migration_20260927_101338_p1_storage.up,
    down: migration_20260927_101338_p1_storage.down,
    name: '20260927_101338_p1_storage',
  },
  {
    up: migration_20260927_102652_p1_jobs.up,
    down: migration_20260927_102652_p1_jobs.down,
    name: '20260927_102652_p1_jobs',
  },
  {
    up: migration_20260927_104753_p1_users.up,
    down: migration_20260927_104753_p1_users.down,
    name: '20260927_104753_p1_users',
  },
  {
    up: migration_20260927_104805_p1_rate_limit.up,
    down: migration_20260927_104805_p1_rate_limit.down,
    name: '20260927_104805_p1_rate_limit',
  },
  {
    up: migration_20260927_112218_p1_media.up,
    down: migration_20260927_112218_p1_media.down,
    name: '20260927_112218_p1_media',
  },
  {
    up: migration_20260927_113844_p1_documents.up,
    down: migration_20260927_113844_p1_documents.down,
    name: '20260927_113844_p1_documents',
  },
  {
    up: migration_20260927_115819_p1_globals.up,
    down: migration_20260927_115819_p1_globals.down,
    name: '20260927_115819_p1_globals',
  },
  {
    up: migration_20260927_120755_p1_categories.up,
    down: migration_20260927_120755_p1_categories.down,
    name: '20260927_120755_p1_categories',
  },
  {
    up: migration_20260927_122558_p1_products.up,
    down: migration_20260927_122558_p1_products.down,
    name: '20260927_122558_p1_products',
  },
  {
    up: migration_20260927_131109_p1_orders.up,
    down: migration_20260927_131109_p1_orders.down,
    name: '20260927_131109_p1_orders',
  },
  {
    up: migration_20260927_132358_p1_invoices.up,
    down: migration_20260927_132358_p1_invoices.down,
    name: '20260927_132358_p1_invoices',
  },
  {
    up: migration_20260927_140139_p1_legal.up,
    down: migration_20260927_140139_p1_legal.down,
    name: '20260927_140139_p1_legal',
  },
  {
    up: migration_20260927_141511_p1_tattoo.up,
    down: migration_20260927_141511_p1_tattoo.down,
    name: '20260927_141511_p1_tattoo',
  },
  {
    up: migration_20260927_143154_p1_content.up,
    down: migration_20260927_143154_p1_content.down,
    name: '20260927_143154_p1_content',
  },
  {
    up: migration_20260927_144252_p1_private_upload_links.up,
    down: migration_20260927_144252_p1_private_upload_links.down,
    name: '20260927_144252_p1_private_upload_links',
  },
  {
    up: migration_20260927_145135_p1_constraints.up,
    down: migration_20260927_145135_p1_constraints.down,
    name: '20260927_145135_p1_constraints',
  },
  {
    up: migration_20260928_230534_p4_mock_state_guard.up,
    down: migration_20260928_230534_p4_mock_state_guard.down,
    name: '20260928_230534_p4_mock_state_guard',
  },
  {
    up: migration_20260929_004609_p4_invoice_pdf.up,
    down: migration_20260929_004609_p4_invoice_pdf.down,
    name: '20260929_004609_p4_invoice_pdf',
  },
  {
    up: migration_20260929_010331_p4_legal_pdf.up,
    down: migration_20260929_010331_p4_legal_pdf.down,
    name: '20260929_010331_p4_legal_pdf',
  },
  {
    up: migration_20260929_011628_p4_email_outbox.up,
    down: migration_20260929_011628_p4_email_outbox.down,
    name: '20260929_011628_p4_email_outbox',
  },
  {
    up: migration_20260929_031002_p4_release_job.up,
    down: migration_20260929_031002_p4_release_job.down,
    name: '20260929_031002_p4_release_job',
  },
  {
    up: migration_20260929_032338_p4_prepayment_jobs.up,
    down: migration_20260929_032338_p4_prepayment_jobs.down,
    name: '20260929_032338_p4_prepayment_jobs',
  },
  {
    up: migration_20260929_081932_p5_revenue_guard.up,
    down: migration_20260929_081932_p5_revenue_guard.down,
    name: '20260929_081932_p5_revenue_guard',
  },
  {
    up: migration_20260929_102355_p5_job_runs.up,
    down: migration_20260929_102355_p5_job_runs.down,
    name: '20260929_102355_p5_job_runs',
  },
  {
    up: migration_20260929_104802_p5_monthly_close_jobs.up,
    down: migration_20260929_104802_p5_monthly_close_jobs.down,
    name: '20260929_104802_p5_monthly_close_jobs',
  },
  {
    up: migration_20261001_193246_p5_compliance_docs_job.up,
    down: migration_20261001_193246_p5_compliance_docs_job.down,
    name: '20261001_193246_p5_compliance_docs_job',
  },
  {
    up: migration_20261001_195941_p5_mark_delivered_job.up,
    down: migration_20261001_195941_p5_mark_delivered_job.down,
    name: '20261001_195941_p5_mark_delivered_job',
  },
  {
    up: migration_20261002_020524_p6_legal_snippets_complaints.up,
    down: migration_20261002_020524_p6_legal_snippets_complaints.down,
    name: '20261002_020524_p6_legal_snippets_complaints',
  },
  {
    up: migration_20261002_020601_p6_legal_snippets_complaints_constraints.up,
    down: migration_20261002_020601_p6_legal_snippets_complaints_constraints.down,
    name: '20261002_020601_p6_legal_snippets_complaints_constraints',
  },
  {
    up: migration_20261002_023800_p6_activate_legal_job.up,
    down: migration_20261002_023800_p6_activate_legal_job.down,
    name: '20261002_023800_p6_activate_legal_job',
  },
  {
    up: migration_20261002_032940_p6_retention_failures.up,
    down: migration_20261002_032940_p6_retention_failures.down,
    name: '20261002_032940_p6_retention_failures',
  },
  {
    up: migration_20261002_033402_p6_retention_jobs.up,
    down: migration_20261002_033402_p6_retention_jobs.down,
    name: '20261002_033402_p6_retention_jobs',
  },
  {
    up: migration_20261002_041023_p6_retention_jobs_part2.up,
    down: migration_20261002_041023_p6_retention_jobs_part2.down,
    name: '20261002_041023_p6_retention_jobs_part2',
  },
  {
    up: migration_20261002_043628_p6_legal_review_job.up,
    down: migration_20261002_043628_p6_legal_review_job.down,
    name: '20261002_043628_p6_legal_review_job',
  },
  {
    up: migration_20261002_091942_p6_withdrawal_inbox_refunds.up,
    down: migration_20261002_091942_p6_withdrawal_inbox_refunds.down,
    name: '20261002_091942_p6_withdrawal_inbox_refunds',
  },
  {
    up: migration_20261002_101152_p6_withdrawal_deadlines_task.up,
    down: migration_20261002_101152_p6_withdrawal_deadlines_task.down,
    name: '20261002_101152_p6_withdrawal_deadlines_task',
  },
  {
    up: migration_20261002_122832_p6_privacy_requests_task.up,
    down: migration_20261002_122832_p6_privacy_requests_task.down,
    name: '20261002_122832_p6_privacy_requests_task',
  },
  {
    up: migration_20261002_130126_p6_invoice_reissue.up,
    down: migration_20261002_130126_p6_invoice_reissue.down,
    name: '20261002_130126_p6_invoice_reissue',
  },
  {
    up: migration_20261002_130238_p6_invoice_reissue_constraints.up,
    down: migration_20261002_130238_p6_invoice_reissue_constraints.down,
    name: '20261002_130238_p6_invoice_reissue_constraints',
  },
  {
    up: migration_20261002_143151_p7_revalidate_offers_task.up,
    down: migration_20261002_143151_p7_revalidate_offers_task.down,
    name: '20261002_143151_p7_revalidate_offers_task',
  },
  {
    up: migration_20261003_065710_p8_media_owner_approved.up,
    down: migration_20261003_065710_p8_media_owner_approved.down,
    name: '20261003_065710_p8_media_owner_approved'
  },
];
