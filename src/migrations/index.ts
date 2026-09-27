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
    name: '20260927_132358_p1_invoices'
  },
];
