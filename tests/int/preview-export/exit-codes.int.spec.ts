import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// AK-A-14-03 (ARCHITEKTUR §14.1/§14.2): Fehlt eine Voraussetzung, endet `pnpm preview:export` mit Exit 2 und einer
// deutschen Anleitung – bevor irgendetwas gebaut oder geschrieben wird.

function runExport(env: Record<string, string>) {
  return spawnSync('pnpm', ['-s', 'preview:export', '--skip-build'], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 60_000,
  })
}

describe('pnpm preview:export – Voraussetzungen (AK-A-14-03)', () => {
  it('AK-A-14-03 Postgres nicht erreichbar (Port 1) → Exit 2 mit deutscher Anleitung', () => {
    const res = runExport({
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:1/planetclaire',
      DATABASE_URL_UNPOOLED: '',
    })
    const out = res.stdout + res.stderr
    expect(res.status).toBe(2)
    expect(out).toContain('Postgres ist nicht erreichbar')
    expect(out).toContain('docker compose up -d')
    expect(out).toContain('pnpm preview:export')
  })

  it('AK-A-14-03 Chromium fehlt → Exit 2 mit Installationsbefehl', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'pv-no-browsers-'))
    try {
      const res = runExport({
        DATABASE_URL: process.env.DATABASE_URL_TEST!,
        DATABASE_URL_UNPOOLED: '',
        PLAYWRIGHT_BROWSERS_PATH: empty,
      })
      const out = res.stdout + res.stderr
      expect(res.status).toBe(2)
      expect(out).toContain('Chromium für Playwright fehlt')
      expect(out).toContain('pnpm exec playwright install chromium')
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('unbekannte Option → Exit 1', () => {
    const res = spawnSync('pnpm', ['-s', 'preview:export', '--gibtsnicht'], {
      env: { ...process.env, DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:1/x' },
      encoding: 'utf8',
      timeout: 60_000,
    })
    expect(res.status).toBe(1)
    expect(res.stdout + res.stderr).toContain('Unbekannte Option')
  })
})
