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
    name: '20260928_230534_p4_mock_state_guard'
  },
];
