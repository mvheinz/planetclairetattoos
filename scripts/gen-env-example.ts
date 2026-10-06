// Erzeugt .env.example aus src/lib/env.schema.ts (ARCHITEKTUR §5.1, C-14 Nr. 2). Aufruf: pnpm env:example
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderEnvExample, renderEnvProductionExample } from '../src/lib/env.schema'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
writeFileSync(path.join(root, '.env.example'), renderEnvExample())
writeFileSync(path.join(root, '.env.production.example'), renderEnvProductionExample())
console.log('.env.example und .env.production.example erzeugt')
