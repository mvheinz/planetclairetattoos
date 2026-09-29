import { defineConfig } from 'vitest/config'

// Abdeckung (ARCHITEKTUR §7.8, PLAN P4.25 / P10.1): Unit- und Integrationstests in einem Lauf (v8, zusammengeführt).
// Aufruf über `pnpm test:coverage` (setzt die Test-DB vorher zurück wie `test:int`). Schwellen je Bereich: ab P4
// `src/lib/commerce/**` und `src/lib/payments/**` ≥ 90 % Zeilen / ≥ 85 % Zweige; die übrigen Bereiche aus §7.8
// (`security`, `legal`, `src/lib/**` gesamt) kommen mit P10.1 als Gate dazu und stehen bis dahin nur im Bericht.
export default defineConfig({
  test: {
    projects: ['./vitest.unit.config.mts', './vitest.config.mts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['src/lib/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        'src/lib/commerce/**': { lines: 90, branches: 85 },
        'src/lib/payments/**': { lines: 90, branches: 85 },
      },
    },
  },
})
