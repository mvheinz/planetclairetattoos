import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Unit-Tests ohne Datenbank (reine Logik). Integrationstests mit Postgres: vitest.config.mts
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.unit.spec.ts'],
  },
})
