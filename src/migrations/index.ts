import * as migration_20260927_094042_p1_baseline from './20260927_094042_p1_baseline';
import * as migration_20260927_095251_p1_localization from './20260927_095251_p1_localization';

export const migrations = [
  {
    up: migration_20260927_094042_p1_baseline.up,
    down: migration_20260927_094042_p1_baseline.down,
    name: '20260927_094042_p1_baseline',
  },
  {
    up: migration_20260927_095251_p1_localization.up,
    down: migration_20260927_095251_p1_localization.down,
    name: '20260927_095251_p1_localization'
  },
];
