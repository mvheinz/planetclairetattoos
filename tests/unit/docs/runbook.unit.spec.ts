import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ENV_VARS } from '../../../src/lib/env.schema'

// P10.15 – Betriebshandbuch docs/RUNBOOK.md: Variablen-Vollständigkeit, Alarme M-01…M-12, Geheimnisse §8.9,
// Pflichtüberschriften, Befehle gegen package.json/Skripte, keine Geheimniswerte (R-157 Runbook-Teil).

const root = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')
const runbook = read('docs/RUNBOOK.md')
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }

describe('RUNBOOK (P10.15)', () => {
  it('Pflichtüberschriften sind vorhanden', () => {
    for (const h of [
      '## 1. Überblick und Topologie',
      '## 2. Konfiguration',
      '## 3. Deploy, Rollback und Migrationen',
      '## 4. Geheimnisse tauschen',
      '## 5. Sicherheitsupdate',
      '## 6. Backups und Wiederherstellung',
      '## 7. Wartungsmodus',
      '## 8. Alarme M-01 bis M-12',
      '## 9. Datenpanne',
      '## 10. Kosten-Routine',
      '## 11. DNS und Start',
      '## 12. Docker-Umzug',
      '## 13. Vorfallprotokoll',
      '## 14. Betriebsprotokoll',
    ])
      expect(runbook, h).toContain(h)
  })

  it('jede Variable aus src/lib/env.ts (Registry) steht in der Konfigurationsliste', () => {
    const missing = ENV_VARS.filter((v) => !runbook.includes(`| \`${v.name}\` |`)).map((v) => v.name)
    expect(missing).toEqual([])
  })

  it('jede Alarm-ID M-01…M-12 hat eine Tabellenzeile mit Handlungsanweisung', () => {
    for (let i = 1; i <= 12; i++) {
      const id = `M-${String(i).padStart(2, '0')}`
      const row = runbook.split('\n').find((l) => l.startsWith(`| ${id} |`))
      expect(row, id).toBeTruthy()
      expect(row!.split('|').filter(Boolean).length, id).toBeGreaterThanOrEqual(3)
      expect(row!.length, id).toBeGreaterThan(80)
    }
  })

  it('jedes Geheimnis aus ARCHITEKTUR §8.9 hat ein Verfahren', () => {
    const section = runbook.slice(runbook.indexOf('## 4. Geheimnisse tauschen'), runbook.indexOf('## 5.'))
    for (const s of [
      'PAYLOAD_SECRET',
      'CRON_SECRET',
      'Neon-Passwort',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'S3_*',
      'BACKUP_S3_*',
      'SMTP_PASS',
      'DEEPL_API_KEY',
      'SENTRY_DSN',
      'age-Schlüssel',
    ])
      expect(section, s).toContain(s)
    const arch = read('docs/ARCHITEKTUR.md')
    const table = arch.slice(arch.indexOf('### 8.9 Geheimnisse'), arch.indexOf('### 8.10'))
    for (const m of table.matchAll(/^\| `?([A-Za-z_*0-9-]+)`?/gm)) {
      if (['Geheimnis', '---'].includes(m[1]!)) continue
      expect(section.includes(m[1]!) || m[1] === 'privater', m[1]).toBe(true)
    }
  })

  it('Datenpanne (R-157): 72 Stunden, Berliner Beauftragte, Online-Formular, Betroffene, Vorlagen, Kontaktliste', () => {
    const s = runbook.slice(runbook.indexOf('## 9. Datenpanne'), runbook.indexOf('## 10.'))
    for (const k of [
      '72 Stunden',
      'Berliner Beauftragte für Datenschutz und Informationsfreiheit',
      'Online-Formular',
      'Betroffenen benachrichtigen',
      'Vorlagen (Deutsch)',
      'Kontaktliste der Dienstleister',
      'Art. 33',
      'Art. 34',
      'Erkennen',
      'Bewerten',
    ])
      expect(s, k).toContain(k)
  })

  it('jeder genannte pnpm-Befehl existiert in package.json; Flags der Backup-Skripte stimmen', () => {
    const cmds = new Set([...runbook.matchAll(/`pnpm (?:exec |run )?([a-z][a-z0-9:-]*)/g)].map((m) => m[1]!))
    const builtin = new Set(['install', 'payload', 'build', 'exec', 'run', 'audit', 'test', 'dev', 'start'])
    for (const c of cmds) expect(c in pkg.scripts || builtin.has(c), c).toBe(true)
    expect(runbook).toContain('pnpm payload migrate && pnpm build')
    const restore = read('scripts/backup-restore.ts')
    for (const f of ['--input=', '--key=', '--identity=', '--target=', '--skip-migrate']) {
      expect(restore, f).toContain(f)
      expect(runbook, f).toContain(f)
    }
    expect(read('scripts/backup-run.ts')).toContain('--to=')
    expect(runbook).toContain('--to=file:<pfad>|s3')
    expect(read('scripts/retention-replay.ts')).toContain('--yes-production')
    expect(runbook).toContain('--yes-production')
    expect(read('scripts/payments-reconcile.ts')).toContain('--since=')
    expect(runbook).not.toContain('--identity <')
  })

  it('enthält keine Geheimniswerte', () => {
    for (const re of [
      /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/,
      /\bwhsec_[A-Za-z0-9]{10,}/,
      /AGE-SECRET-KEY-1[A-Z0-9]{20,}/,
      /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]+@/,
      /\bage1[a-z0-9]{50,}/,
    ])
      expect(runbook).not.toMatch(re)
  })
})
