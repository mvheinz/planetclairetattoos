import { defineConfig } from 'vitest/config'

import { intWorkerCount } from './tests/int/setup/workers'

// Abdeckung (ARCHITEKTUR §7.8, PLAN P4.25 / P10.1): Unit- und Integrationstests in einem Lauf (v8, zusammengeführt).
// Aufruf über `pnpm test:coverage` (setzt die Test-DB vorher zurück wie `test:int`). Schwellen je Bereich (§7.8, seit
// P10.1 alle Gates): `src/lib/{commerce,payments,security,legal}/**` ≥ 90 % Zeilen / ≥ 85 % Zweige, `src/lib/**`
// gesamt ≥ 70 % Zeilen.
export default defineConfig({
  test: {
    projects: [
      { extends: './vitest.unit.config.mts', test: { name: 'unit' } },
      // Instrumentierung (v8) verlangsamt die Seed-Läufe – großzügigere Zeitgrenzen als `vitest.config.mts`.
      {
        extends: './vitest.config.mts',
        test: { name: 'int', testTimeout: 120_000, hookTimeout: 180_000 },
      },
    ],
    // Wie `vitest.config.mts`: nacheinander, mit `PC_INT_WORKERS=n` parallel mit je eigener Datenbank.
    fileParallelism: intWorkerCount() > 1,
    maxWorkers: intWorkerCount(),
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['src/lib/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'json', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        'src/lib/commerce/**': { lines: 90, branches: 85 },
        'src/lib/payments/**': { lines: 90, branches: 85 },
        'src/lib/security/**': { lines: 90, branches: 85 },
        'src/lib/legal/**': { lines: 90, branches: 85 },
        'src/lib/**': { lines: 70 },
      },
    },
  },
})
