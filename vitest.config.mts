import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

import { intWorkerCount } from './tests/int/setup/workers'

const workers = intWorkerCount()

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
    // Standard: eine gemeinsame Test-Datenbank, Dateien nacheinander. Mit `PC_INT_WORKERS=n` laufen n Dateien parallel,
    // jeder Worker mit eigener Datenbankkopie (tests/int/setup/workers.ts).
    fileParallelism: workers > 1,
    maxWorkers: workers,
    globalSetup: ['./tests/int/setup/global.ts'],
    setupFiles: ['./tests/int/setup/env.ts', './tests/int/setup/restore.ts', './vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
