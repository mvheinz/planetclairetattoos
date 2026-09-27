import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      'server-only': path.resolve(import.meta.dirname, 'tests/helpers/server-only-stub.ts'),
    },
  },
  test: {
    // Integrationstests laufen gegen Payload + Postgres im Node-Prozess (ARCHITEKTUR §7.1).
    environment: 'node',
    // Eine gemeinsame Test-Datenbank: Dateien nacheinander ausführen.
    fileParallelism: false,
    globalSetup: ['./tests/int/setup/global.ts'],
    setupFiles: ['./tests/int/setup/env.ts', './vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
