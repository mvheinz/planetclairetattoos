import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

// Unit-Tests ohne Datenbank (reine Logik). Integrationstests mit Postgres: vitest.config.mts
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      'server-only': path.resolve(import.meta.dirname, 'tests/helpers/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts', './tests/setup/settle-imports.ts'],
    include: ['tests/unit/**/*.unit.spec.{ts,tsx}'],
    // next-intl importiert `next/server` ohne Endung; inline gebündelt löst Vite das auf.
    server: { deps: { inline: ['next-intl'] } },
  },
})
