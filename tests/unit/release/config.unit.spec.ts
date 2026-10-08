import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import {
  ASSET_NAME,
  buildNotes,
  configHash,
  configProblems,
  decide,
  MARKER_PREFIX,
  openTasks,
  SIZE_NOTE,
  standLine,
} from '../../../scripts/release/lib.mjs'

// P10.21 (ARCHITEKTUR §6.6, AK-12-02, AK-A-6-01): Konfiguration `.github/vorschau-release.json`, Auslöser und Jobs von
// `release.yml`, Entscheidung des schnellen Prüfschritts (`gate`) und Release-Text. Den Lauf selbst belegen der
// PR-Probelauf und nach dem Merge `publish` und `verify-asset`.

const ROOT = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const configText = read('.github/vorschau-release.json')
const config = JSON.parse(configText) as { tag: string; title: string; notesDe: string }

type Step = { name?: string; id?: string; run?: string; uses?: string; if?: string }
type Job = {
  needs?: string
  if?: string
  permissions?: Record<string, string>
  services?: Record<string, unknown>
  steps: Step[]
  outputs?: Record<string, string>
}
const workflow = parse(read('.github/workflows/release.yml')) as {
  on: {
    push?: { branches?: string[]; paths?: string[] }
    schedule?: { cron: string }[]
    workflow_dispatch?: unknown
    pull_request?: { paths?: string[] }
  }
  concurrency: { group: string; 'cancel-in-progress': boolean }
  permissions: Record<string, string>
  jobs: Record<string, Job>
}
const runs = (job: Job) => job.steps.map((s) => s.run ?? '').join('\n')

describe('Release-Konfiguration (vorschau-release.json)', () => {
  it('AK-12-02 Schema, Tag vorschau-p12, Titel, Hinweis „nur privat“, Stand-Zeile, Asset-Name', () => {
    expect(configProblems(config)).toEqual([])
    expect(config.tag).toBe('vorschau-p12')
    expect(config.title).toBe('Planet Claire – Vorschau (Stand P12)')
    expect(config.notesDe).toContain('Nur privat ansehen, nicht weitergeben, nicht veröffentlichen')
    expect(config.notesDe).toContain(ASSET_NAME)
    expect(standLine(config.notesDe)).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
    expect(ASSET_NAME).toBe('planet-claire-vorschau.html')
  })

  it('AK-12-02 Gegenprobe: fehlender Hinweis, falscher Tag, fehlende Stand-Zeile oder fertiger Größen-Satz → rot', () => {
    const bad = (over: Record<string, string>) => configProblems({ ...config, ...over })
    expect(bad({ tag: 'vorschau-p9' })).toContain('tag muss vorschau-p12 sein')
    expect(
      bad({ notesDe: config.notesDe.replace('Nur privat ansehen', 'Gern ansehen') }),
    ).toHaveLength(1)
    expect(bad({ notesDe: config.notesDe.replace(/Stand: .*/, '') })).toHaveLength(1)
    expect(bad({ notesDe: `${config.notesDe}\n${SIZE_NOTE}` })).toHaveLength(1)
    expect(configProblems({ tag: 'x' })).not.toEqual([])
  })

  it('AK-12-02 Größen-Satz erst über 20 MB (20.000.000 Byte); Größe in MB und Konfigurations-Vermerk am Ende', () => {
    const hash = configHash(configText)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
    const small = buildNotes(config, 20_000_000, hash)
    const big = buildNotes(config, 20_000_001, hash)
    expect(small).not.toContain(SIZE_NOTE)
    expect(big).toContain(SIZE_NOTE)
    expect(small).toContain('Dateigröße: 20,0 MB.')
    expect(big.trimEnd().endsWith(`${MARKER_PREFIX}${hash} -->`)).toBe(true)
    expect(small.startsWith(config.notesDe.trim())).toBe(true)
  })

  it('AK-12-02 die HTML-Datei ist nie im Repository; dist/ steht in .gitignore', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((f) => /planet-claire-vorschau\.html$/.test(f))
    expect(tracked).toEqual([])
    expect(read('.gitignore').split('\n')).toContain('/dist')
  })
})

describe('release.yml (ARCHITEKTUR §6.6)', () => {
  it('AK-A-6-01 Auslöser: push auf main mit Pfad vorschau-release.json, schedule 0 6 * * *, workflow_dispatch', () => {
    expect(workflow.on.push?.branches).toEqual(['main'])
    expect(workflow.on.push?.paths).toContain('.github/vorschau-release.json')
    expect(workflow.on.schedule).toEqual([{ cron: '0 6 * * *' }])
    expect('workflow_dispatch' in workflow.on).toBe(true)
    // Juttas Uploads starten nichts
    expect(JSON.stringify(workflow.on.push)).not.toMatch(/instagram-export|seed\/coco/)
  })

  it('Probelauf im PR nur bei Änderung von release.yml oder vorschau-release.json, ohne Veröffentlichung und ohne contents: write', () => {
    expect(workflow.on.pull_request?.paths?.sort()).toEqual([
      '.github/vorschau-release.json',
      '.github/workflows/release.yml',
    ])
    const probe = workflow.jobs.probe!
    expect(probe.if).toBe("github.event_name == 'pull_request'")
    expect(probe.permissions).toEqual({ contents: 'read' })
    expect(runs(probe)).toContain('pnpm run preview:export')
    expect(runs(probe)).toContain('pnpm run test:preview-export')
    expect(runs(probe)).not.toMatch(/gh release (create|upload|edit)/)
    for (const name of ['gate', 'publish', 'verify-asset']) {
      const job = workflow.jobs[name]!
      const gated = job.if?.includes('pull_request') || job.needs
      expect(gated, `${name} läuft nicht im PR-Probelauf`).toBeTruthy()
    }
  })

  it('kein cancel-in-progress; Gruppe release; Standard-Rechte nur contents: read, Schreibrecht nur in publish', () => {
    expect(workflow.concurrency['cancel-in-progress']).toBe(false)
    expect(workflow.concurrency.group).toContain("'release'")
    expect(workflow.permissions).toEqual({ contents: 'read' })
    for (const [name, job] of Object.entries(workflow.jobs)) {
      expect(job.permissions?.contents, name).toBe(name === 'publish' ? 'write' : 'read')
    }
  })

  it('gate: erster, schneller Schritt ohne Postgres, ohne Install und ohne Build', () => {
    const gate = workflow.jobs.gate!
    expect(gate.services).toBeUndefined()
    const all = runs(gate)
    expect(all).toContain('scripts/cloud-setup.sh --plan-status')
    expect(all).toContain('gh release view')
    expect(all).toContain('node scripts/release/gate.mjs')
    expect(all).not.toMatch(/pnpm (install|run|exec)|next build/)
    expect(gate.outputs?.publish).toContain('steps.decide.outputs.publish')
  })

  it('publish: braucht gate, nur bei publish=true; Export, Tests inkl. Portabilität, create bzw. upload --clobber, SHA-256', () => {
    const publish = workflow.jobs.publish!
    expect(publish.needs).toBe('gate')
    expect(publish.if).toBe("needs.gate.outputs.publish == 'true'")
    expect(publish.services).toHaveProperty('postgres')
    const all = runs(publish)
    expect(all.indexOf('pnpm run preview:export')).toBeLessThan(
      all.indexOf('pnpm run test:preview-export'),
    )
    expect(all.indexOf('pnpm run test:preview-export')).toBeLessThan(
      all.indexOf('gh release create'),
    )
    expect(all).toContain('gh release create "$TAG" "$file"')
    expect(all).toContain('gh release upload "$TAG" "$file" --clobber')
    expect(all).toContain('gh release edit "$TAG"')
    expect(all).toContain('dist/planet-claire-vorschau.html')
    expect(all).not.toMatch(/zip|tar /)
    expect(publish.outputs?.sha256).toContain('steps.notes.outputs.sha256')
  })

  it('verify-asset: needs publish, frischer Checkout ohne Postgres und Build, Download, Prüfsumme, nur Portabilitätstest', () => {
    const verify = workflow.jobs['verify-asset']!
    expect(verify.needs).toBe('publish')
    expect(verify.services).toBeUndefined()
    const all = runs(verify)
    expect(all).toContain(
      'gh release download "$TAG" --pattern planet-claire-vorschau.html --dir dist',
    )
    expect(all).toContain('sha256sum dist/planet-claire-vorschau.html')
    expect(all).toContain('pnpm run test:preview-portable')
    expect(all).not.toMatch(/preview:export|next build|pnpm run build|test:preview-export/)
  })

  it('package.json: test:preview-portable führt nur die Portabilitäts-Projekte aus; Playwright-Konfiguration hat sie', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> })
      .scripts
    expect(scripts['test:preview-portable']).toContain('--project=pv-portable-*')
    const cfg = read('playwright.preview.config.ts')
    expect(cfg).toContain("name: 'pv-portable-chromium'")
    expect(cfg).toContain("name: 'pv-portable-webkit'")
  })
})

describe('Entscheidung des Prüfschritts gate (P10.21)', () => {
  const asset = [{ name: ASSET_NAME }]
  const current = {
    assets: asset,
    body: buildNotes(config, 8_000_000, configHash(configText)),
  }
  const empty = 'OFFEN_P1_P10=0\nERSTE_OFFENE_AUFGABE: –'
  const decideWith = (planStatusOutput: string, release: unknown) =>
    decide({ planStatusOutput, release: release as never, configText })

  it('Plan nicht leer → keine Veröffentlichung („Plan noch nicht leer“), egal wie das Release aussieht', () => {
    for (const release of [null, current]) {
      const r = decideWith('OFFEN_P1_P10=3\n', release)
      expect(r.publish).toBe(false)
      expect(r.reason).toBe('Plan noch nicht leer – nichts zu tun')
    }
    expect(decideWith('Fehler ohne Zeile', null).publish).toBe(false)
    expect(openTasks('OFFEN_P1_P10=unbekannt')).toBeNull()
    expect(openTasks('OFFEN_P1_P10=0\nOFFEN_P12=2\n')).toBe(2)
    expect(openTasks('OFFEN_P1_P10=0\nOFFEN_P12=0\n')).toBe(0)
    expect(openTasks('OFFEN_P1_P10=0\nOFFEN_P12=0\nOFFEN_P13=3\n')).toBe(3)
  })

  it('Plan leer und Release aktuell → „Release aktuell“, keine Veröffentlichung', () => {
    const r = decideWith(empty, current)
    expect(r).toMatchObject({ publish: false, reason: 'Release aktuell – nichts zu tun' })
  })

  it('Plan leer und Release fehlt, ohne Asset, Konfiguration oder Stand-Zeile geändert → veröffentlichen', () => {
    expect(decideWith(empty, null)).toMatchObject({ publish: true, reason: 'Release fehlt' })
    expect(decideWith(empty, { ...current, assets: [] }).publish).toBe(true)
    expect(
      decideWith(empty, { ...current, assets: [{ name: 'planet-claire-vorschau.zip' }] }).publish,
    ).toBe(true)
    expect(decideWith(empty, { ...current, body: 'alter Text' }).publish).toBe(true)
    // neue Stand-Zeile → andere Konfigurations-Prüfsumme → veraltet
    const newer = JSON.stringify({
      ...config,
      notesDe: config.notesDe.replace(/Stand: .*/, 'Stand: 01.01.2027'),
    })
    const r = decide({ planStatusOutput: empty, release: current as never, configText: newer })
    expect(r).toMatchObject({ publish: true, reason: 'Release veraltet (Konfiguration geändert)' })
  })

  it('Skript gate.mjs schreibt publish=… in GITHUB_OUTPUT (Plan nicht leer → false)', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'gate-'))
    try {
      writeFileSync(path.join(tmp, 'plan.txt'), 'OFFEN_P1_P10=2\n')
      writeFileSync(path.join(tmp, 'release.json'), 'null')
      const out = path.join(tmp, 'out.txt')
      writeFileSync(out, '')
      execFileSync('node', [path.join(ROOT, 'scripts/release/gate.mjs')], {
        cwd: ROOT,
        env: {
          ...process.env,
          PLAN_STATUS_FILE: path.join(tmp, 'plan.txt'),
          RELEASE_JSON_FILE: path.join(tmp, 'release.json'),
          GITHUB_OUTPUT: out,
          GITHUB_STEP_SUMMARY: path.join(tmp, 'summary.md'),
        },
      })
      expect(readFileSync(out, 'utf8')).toBe('publish=false\ntag=vorschau-p12\n')
      expect(readFileSync(path.join(tmp, 'summary.md'), 'utf8')).toContain('Plan noch nicht leer')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('Skript gate.mjs gegen das echte cloud-setup.sh --plan-status: Ausgabe enthält OFFEN_P1_P10', () => {
    const out = execFileSync('bash', ['scripts/cloud-setup.sh', '--plan-status'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
    })
    expect(openTasks(out)).not.toBeNull()
  })
})
