import { readFileSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

import { ENV_VARS, renderEnvProductionExample } from '../../../src/lib/env.schema'

// P10.12 – Docker-Exit-Pfad (ARCHITEKTUR §13, AK-A-13-01/-02): statische Prüfung der Dateien; den Lauf selbst belegt der
// CI-Job `docker`.

const root = path.resolve(__dirname, '../../..')
const read = (f: string) => readFileSync(path.join(root, f), 'utf8')

describe('Docker-Dateien', () => {
  const dockerfile = read('Dockerfile')

  it('AK-A-13-01 Dockerfile: Build ohne DB, Ziel migrator, Healthcheck, UID 1001, Schriften', () => {
    expect(dockerfile).toContain('ENV BUILD_WITHOUT_DB=1')
    expect(dockerfile).toContain('ENV NEXT_OUTPUT_STANDALONE=1')
    expect(dockerfile).toMatch(
      /FROM builder AS migrator[\s\S]*CMD \["pnpm", "payload", "migrate"\]/,
    )
    expect(dockerfile).toContain('HEALTHCHECK')
    expect(dockerfile).toContain('/api/health')
    expect(dockerfile).toContain('--uid 1001')
    expect(dockerfile).toContain('src/styles/fonts')
    expect(dockerfile).toContain('src/og/fonts')
    // runner ist die letzte Stufe (Standardziel)
    const stages = [...dockerfile.matchAll(/^FROM .* AS (\w+)/gm)].map((m) => m[1])
    expect(stages.at(-1)).toBe('runner')
    // Build ohne Zugangsdaten
    expect(dockerfile).not.toMatch(/ARG\s+(DATABASE_URL|STRIPE|PAYLOAD_SECRET)/)
  })

  it('AK-A-13-02 docker-compose.prod.yml: Dienste, kein Postgres-Port, Reihenfolge, Scheduler, Protokolle', () => {
    const compose = parse(read('docker-compose.prod.yml')) as {
      services: Record<string, Record<string, unknown>>
    }
    expect(Object.keys(compose.services).sort()).toEqual(
      ['app', 'caddy', 'migrate', 'postgres', 'scheduler'].sort(),
    )
    expect(compose.services.postgres!.ports).toBeUndefined()
    expect(compose.services.postgres!.image).toBe('postgres:17-alpine')
    expect(compose.services.app!.depends_on).toMatchObject({
      migrate: { condition: 'service_completed_successfully' },
    })
    expect(compose.services.migrate!.depends_on).toMatchObject({
      postgres: { condition: 'service_healthy' },
    })
    expect(JSON.stringify(compose.services.scheduler)).toContain('30 1 * * *')
    expect(JSON.stringify(compose.services.scheduler)).toContain('/api/cron/backup')
    for (const svc of Object.values(compose.services)) {
      expect(svc.logging).toMatchObject({
        driver: 'json-file',
        options: { 'max-size': '10m', 'max-file': '3' },
      })
    }
  })

  it('Caddyfile: TLS-Standard, www → Apex 308, Kompression, kein Zugriffsprotokoll', () => {
    const caddy = read('deploy/Caddyfile')
    expect(caddy).toContain('308')
    expect(caddy).toContain('encode zstd gzip')
    expect(caddy).toContain('reverse_proxy app:3000')
    expect(caddy).not.toMatch(/^\s*log\b/m)
  })

  it('.env.production.example entspricht dem generierten Stand, enthält alle Laufzeit-Variablen, keine Geheimnisse', () => {
    const file = read('.env.production.example')
    expect(file).toBe(renderEnvProductionExample())
    expect(file).toContain('APP_ENV=production')
    expect(file).toContain('NEXT_PUBLIC_ANALYTICS_ENABLED=false')
    expect(file).toContain('BACKUP_ENABLED=false')
    for (const v of ENV_VARS.filter((e) => e.secret)) {
      const line = file.split('\n').find((l) => l.startsWith(`${v.name}=`))
      if (line) expect(line.slice(v.name.length + 1), v.name).toMatch(/^$|HIER_/)
    }
    expect(file).not.toMatch(/^[A-Z_]+=.*(sk|pk)_(live|test)_/m)
  })

  it('CI: Job docker (ci-full.yml) und restore-drill.yml wie in §6.2/§6.4/§10.6', () => {
    const full = parse(read('.github/workflows/ci-full.yml')) as {
      jobs: Record<string, { steps: { run?: string }[] }>
    }
    const runs = full.jobs.docker!.steps.map((st) => st.run ?? '').join('\n')
    for (const needle of [
      'docker build',
      'up -d',
      '/api/health',
      '/de',
      'down -v',
      '524288000',
      '"1001"',
    ]) {
      expect(runs).toContain(needle)
    }
    const drillText = read('.github/workflows/restore-drill.yml')
    const drill = parse(drillText) as {
      on: {
        schedule: { cron: string }[]
        pull_request: { paths: string[] }
        workflow_dispatch: unknown
      }
      permissions: Record<string, string>
    }
    expect(drill.on.schedule[0]!.cron).toBe('0 4 1 * *')
    expect(drill.on.pull_request.paths).toEqual([
      'src/lib/backup/**',
      '.github/workflows/restore-drill.yml',
    ])
    expect(drill.on).toHaveProperty('workflow_dispatch')
    expect(drill.permissions).toEqual({ contents: 'read' })
    expect(drillText).not.toMatch(/secrets\./)
    expect(drillText).toContain('scripts/ci/restore-drill.ts')
  })
})
