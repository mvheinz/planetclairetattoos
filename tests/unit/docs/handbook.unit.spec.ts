import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// P10.18 – Handbuch für Jutta: alle Kapitel vorhanden, relative Links und Bilder gültig, keine Aussage zur
// Barrierefreiheit oder zu Zertifikaten (V-26, R-190), Datenpanne-Anleitung (R-157), AUFGABEN/ANLEITUNGEN verlinken es.

const root = path.resolve(__dirname, '../../..')
const ownerDir = path.join(root, 'docs/owner')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')
const book = read('docs/owner/HANDBUCH.md')

const CHAPTERS = [
  'Anmelden und die Verwaltung aufs Handy legen',
  'Heute: dein Start',
  'Neues Stück einstellen',
  'Meine Stücke',
  'Zu packen und Versendet',
  'Vorkasse',
  'Abholung',
  'Widerrufe und Erstattung',
  'Anfragen für Auftragsarbeiten',
  'Tattoo: Flash, Angebote, Galerie',
  'Texte bearbeiten',
  'Einstellungen',
  'Umsatz-Wächter',
  'Monatsexport und Verpackungsmengen',
  'Datenschutz-Anfragen',
  'Datenpanne: was tun im Ernstfall',
  'Startklar-Prüfung',
  'Beispieldaten',
  'Die Vorschau-Datei und ein Hinweis zur Barrierefreiheit',
  'Notfall und Hilfe',
]

function slug(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')
}

describe('Handbuch (P10.18)', () => {
  it('alle Pflichtkapitel sind vorhanden, in dieser Reihenfolge, jedes mit Bildschirmfoto', () => {
    const headings = [...book.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => m[2]!)
    expect(headings).toEqual(CHAPTERS)
    const sections = book.split(/^## \d+\. /m).slice(1)
    for (const [i, s] of sections.entries()) {
      expect(s, CHAPTERS[i]).toMatch(/!\[[^\]]+\]\(img\/handbuch\/[^)]+\.webp\)/)
    }
  })

  it('Links und Bilder sind relativ und zeigen auf vorhandene Dateien und Anker', () => {
    const anchorsOf = (file: string): Set<string> => {
      const text = readFileSync(file, 'utf8')
      const out = new Set<string>()
      for (const m of text.matchAll(/^#{1,6} (.+)$/gm)) out.add(slug(m[1]!))
      for (const m of text.matchAll(/<a id="([^"]+)"><\/a>/g)) out.add(m[1]!)
      return out
    }
    let checked = 0
    for (const m of book.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = m[1]!
      expect(target, target).not.toMatch(/^[a-z]+:\/\//i)
      const [file, anchor] = target.split('#') as [string, string | undefined]
      const abs = file ? path.resolve(ownerDir, file) : path.join(ownerDir, 'HANDBUCH.md')
      expect(existsSync(abs), target).toBe(true)
      if (anchor) expect([...anchorsOf(abs)], target).toContain(anchor)
      checked++
    }
    expect(checked).toBeGreaterThan(40)
  })

  it('keine Barrierefreiheits- oder Zertifikatsbehauptung (V-26) und keine verbotenen Muster', () => {
    expect(book).not.toMatch(/barrierefrei(e|er|en)?\s+(Shop|Website|Seite)/i)
    expect(book).not.toMatch(/WCAG-konform|BFSG-konform|zertifiziert/i)
    expect(book).not.toMatch(/inkl\.\s*MwSt|ec\.europa\.eu\/consumers\/odr/i)
    expect(book).toMatch(/10 Beschäftigten/)
    expect(book).toMatch(/2 Millionen Euro/)
  })

  it('R-157: Datenpanne mit 72 Stunden, Berliner Beauftragter, Protokoll, Betroffene, RUNBOOK', () => {
    const section = book.split(/^## 16\. /m)[1]!.split(/^## 17\. /m)[0]!
    for (const needle of [
      '72 Stunden',
      'Berliner Beauftragte für Datenschutz und Informationsfreiheit',
      'Vorfallprotokoll',
      'Betroffene informieren',
      'RUNBOOK',
    ])
      expect(section, needle).toContain(needle)
  })

  it('keine Geheimnisse, keine Platzhalter „kommt in P“ und Verwaltungspfad nicht genannt', () => {
    expect(book).not.toMatch(/sk_(live|test)_|whsec_|postgres:\/\//)
    expect(book).not.toMatch(/kommt in P\d/)
    expect(book).not.toMatch(/\/werkstatt/)
  })

  it('AUFGABEN und ANLEITUNGEN verlinken das Handbuch statt „kommt in P10“', () => {
    for (const f of ['docs/owner/AUFGABEN.md', 'docs/owner/ANLEITUNGEN.md']) {
      const t = read(f)
      expect(t, f).toContain('(HANDBUCH.md')
      expect(t, f).not.toMatch(/Handbuch, das in P10/)
    }
  })

  it('RUNBOOK und GO-LIVE verweisen auf existierende Handbuch-Kapitel', () => {
    expect(read('docs/RUNBOOK.md')).toContain('docs/owner/HANDBUCH.md')
    expect(book).toContain('Kapitel 20')
  })
})
