import * as migration_20260927_094042_p1_baseline from './20260927_094042_p1_baseline';
import * as migration_20260927_095251_p1_localization from './20260927_095251_p1_localization';
import * as migration_20260927_100056_p1_logs from './20260927_100056_p1_logs';
import * as migration_20260927_101338_p1_storage from './20260927_101338_p1_storage';
import * as migration_20260927_102652_p1_jobs from './20260927_102652_p1_jobs';

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
    name: '20260927_102652_p1_jobs'
  },
];
