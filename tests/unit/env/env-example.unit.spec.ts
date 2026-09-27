import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { checkEnvExample, parseEnvTableNames } from '../../../scripts/lib/static-checks/env-example'
import { ENV_VARS, renderEnvExample } from '@/lib/env.schema'

const root = path.resolve(import.meta.dirname, '../../..')
const architektur = readFileSync(path.join(root, 'docs/ARCHITEKTUR.md'), 'utf8')

describe('AK-A-5-01 .env.example und ARCHITEKTUR §5.2', () => {
  it('AK-A-5-01 .env.example entspricht dem generierten Stand', () => {
    expect(readFileSync(path.join(root, '.env.example'), 'utf8')).toBe(renderEnvExample())
  })

  it('AK-A-5-01 jede Schema-Variable steht in §5.2', () => {
    const names = parseEnvTableNames(architektur)
    expect(ENV_VARS.filter((v) => !names.has(v.name)).map((v) => v.name)).toEqual([])
  })

  it('AK-A-5-01 Abweichung von .env.example lässt die Prüfung scheitern', () => {
    expect(checkEnvExample(renderEnvExample() + 'EXTRA=1\n', architektur).errors).toHaveLength(1)
  })

  it('AK-A-5-01 fehlende Tabellenzeile lässt die Prüfung scheitern', () => {
    const cut = architektur.replace(/^\| `CARRIER_DRIVER` \|.*$/m, '')
    expect(checkEnvExample(renderEnvExample(), cut).errors.join()).toContain('CARRIER_DRIVER')
  })

  it('Geheimnisse sind in .env.example leer (außer den P0-Platzhaltern)', () => {
    const allowed = new Set(['PAYLOAD_SECRET', 'CRON_SECRET', 'DATABASE_URL'])
    expect(ENV_VARS.filter((v) => v.secret && v.example !== '' && !allowed.has(v.name))).toEqual([])
  })

  it('P0-Werte bleiben: ADMIN_ROUTE=/werkstatt, CRON_SECRET-Platzhalter', () => {
    const text = renderEnvExample()
    expect(text).toMatch(/^ADMIN_ROUTE=\/werkstatt$/m)
    expect(text).toMatch(/^CRON_SECRET=.{32,}$/m)
  })
})
