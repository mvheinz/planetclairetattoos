import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { renderAdminPasswordReset } from '@/lib/email/render'
import {
  ADMIN_MAILS,
  getTemplate,
  isTemplateImplemented,
  TEMPLATE_META,
  type AdminMailId,
} from '@/lib/email/registry'
import type { EmailTemplate } from '@/lib/enums'

import { MAIL_FIXTURE_DATA, MAIL_FIXTURE_SITE, renderFixture, scanMail } from '../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './templates/helpers'

// P5.2 – Verwaltungs-Mails A01–A17 (KONZEPT §6.4, AK-6-01, AK-6-03): Registry-Zuordnung laut DATENMODELL §4, Renderer mit
// Snapshot DE, Pflichtinhalte, A05 ohne Name/E-Mail/Freitext (R-160).

const ADMIN = 'https://planetclairetattoos.com/werkstatt'

const render = async (t: EmailTemplate, data: Record<string, unknown> = MAIL_FIXTURE_DATA[t]!) =>
  plain(await renderFixture(t, data, 'de'))

/** DATENMODELL §4 „Mail-Vorlagen: Schlüssel ↔ KONZEPT-ID“: A-Nummer → Schlüssel. */
function datenmodellAdminTable(): Map<string, string> {
  const doc = readFileSync(path.resolve(process.cwd(), 'docs/DATENMODELL.md'), 'utf8')
  const start = doc.indexOf('**Mail-Vorlagen: Schlüssel ↔ KONZEPT-ID**')
  expect(start).toBeGreaterThan(0)
  const out = new Map<string, string>()
  for (const line of doc.slice(start, start + 8000).split('\n')) {
    const m = /^\| `(admin_[a-z_]+)` \| ([^|]+) \|/.exec(line)
    if (!m) continue
    for (const id of m[2]!.match(/A\d{2}/g) ?? []) out.set(id, m[1]!)
  }
  return out
}

const ADMIN_IDS = Array.from({ length: 17 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`)

describe('Registry: A01–A17 ↔ Schlüssel (DATENMODELL §4)', () => {
  it('jede A-Nummer ist genau dem Schlüssel aus DATENMODELL §4 zugeordnet', () => {
    const table = datenmodellAdminTable()
    expect([...table.keys()].sort()).toEqual(ADMIN_IDS)
    expect(Object.keys(ADMIN_MAILS).sort()).toEqual(ADMIN_IDS)
    for (const id of ADMIN_IDS) {
      expect(ADMIN_MAILS[id as AdminMailId], id).toBe(table.get(id))
      const meta = TEMPLATE_META[ADMIN_MAILS[id as AdminMailId]]
      expect(meta.recipient, id).toBe('admin')
      expect(meta.konzeptId.split('/'), id).toContain(id)
    }
  })

  it('A01–A16 sind als Vorlage umgesetzt (Version aNN-vN); A17 rendert Payload über render.ts', () => {
    for (const id of ADMIN_IDS.filter((x) => x !== 'A17')) {
      const key = ADMIN_MAILS[id as AdminMailId]
      expect(isTemplateImplemented(key), id).toBe(true)
      expect(getTemplate(key).version, id).toMatch(/^a\d{2}-v\d+$/)
    }
    expect(isTemplateImplemented('admin_password_reset')).toBe(false)
  })
})

describe('Pflichtinhalte (KONZEPT §6.4)', () => {
  it('A04 Betreff mit WR- und PC-Nummer, Eingang, Frist „erstatten bis“, Link Widerrufe; nicht zugeordnet', async () => {
    const m = await render('admin_withdrawal_received')
    expect(m.subject).toBe('Widerruf eingegangen: WR-2026-00003 (PC-2026-00017)')
    expect(m.text).toContain('Eingang: 14.10.2026, 11:12 Uhr')
    expect(m.text).toContain('Erstatten bis: 28.10.2026')
    expect(m.text).toContain('Nr. 017 · Tasse „Coco schläft“')
    expect(m.html).toContain(`href="${ADMIN}/widerrufe/3"`)
    const open = await render('admin_withdrawal_received', {
      ...MAIL_FIXTURE_DATA.admin_withdrawal_received!,
      orderNumber: null,
      items: [],
    })
    expect(open.subject).toBe('Widerruf eingegangen: WR-2026-00003 (nicht zugeordnet)')
  })

  it('R-160 A05: nur Referenz, Gegenstand, Anzahl Bilder, Link – Name, E-Mail, Freitext und Bilder werden abgelehnt', async () => {
    const m = await render('admin_inquiry_received')
    expect(m.subject).toBe('Neue Anfrage AA-2026-0007 (Cap)')
    expect(m.text).toContain('Referenz: AA-2026-0007')
    expect(m.text).toContain('Bilder: 2')
    expect(m.html).toContain(`href="${ADMIN}/anfragen/7"`)
    expect(m.html).not.toMatch(/<img\b/)
    const schema = getTemplate('admin_inquiry_received').schema
    const base = MAIL_FIXTURE_DATA.admin_inquiry_received!
    for (const extra of [
      { name: 'Erika Beispiel' },
      { email: 'erika@planetclaire.local' },
      { message: 'Ich hätte gern einen Hund auf der Cap' },
      { images: ['cid:ref1'] },
    ]) {
      expect(schema.safeParse({ ...base, ...extra }).success, Object.keys(extra)[0]).toBe(false)
    }
  })

  it('A10 Texte mit Datum und Link „Texte“', async () => {
    const m = await render('admin_legal_review_due')
    expect(m.subject).toBe('Jährliche Erinnerung: Rechtstexte prüfen lassen')
    expect(m.text).toMatch(/AGB.* – zuletzt geprüft am 01\.09\.2025/)
    expect(m.html).toContain(`href="${ADMIN}/texte"`)
  })

  it('A11 Betreff „Monatsexport Oktober 2026 ist bereit“, Summen, Hinweis auf fehlende Monatssummen', async () => {
    const m = await render('admin_monthly_close')
    expect(m.subject).toBe('Monatsexport Oktober 2026 ist bereit')
    expect(m.text).toContain('Rechnungen: 12 · 648,90 €')
    expect(m.text).toContain('Gutschriften: 1 · 45,00 €')
    expect(m.text).toContain('Saldo: 603,90 €')
    expect(m.text).toContain('fehlen noch manuelle Monatssummen (Tattoo, Flohmarkt)')
    const complete = await render('admin_monthly_close', {
      ...MAIL_FIXTURE_DATA.admin_monthly_close!,
      missingManualSources: [],
    })
    expect(complete.text).not.toContain('fehlen')
  })

  it('A13 Betreff mit Resttagen, Bestellung, Frist, Link', async () => {
    const m = await render('admin_withdrawal_deadline')
    expect(m.subject).toBe('Erstattungsfrist läuft ab: WR-2026-00003 (noch 4 Tage)')
    expect(m.text).toContain('Bestellung: PC-2026-00017')
    expect(m.text).toContain('Erstatten bis: 28.10.2026')
    expect(m.html).toContain(`href="${ADMIN}/widerrufe/3"`)
  })

  it('A14 Betreff mit Fristdatum, Art der Anfrage', async () => {
    const m = await render('admin_privacy_request_due')
    expect(m.subject).toBe('Datenschutz-Anfrage DS-2026-0001: Frist endet am 21.10.2026')
    expect(m.text).toMatch(/Art der Anfrage: Auskunft/)
    expect(m.html).toContain(`href="${ADMIN}/collections/privacy-requests/1"`)
  })

  it('A15 Betreff mit Anzahl, Vorgänge mit Grund und Datum', async () => {
    const m = await render('admin_legal_hold_review')
    expect(m.subject).toBe('Aufbewahrungssperre prüfen: 1 Vorgang')
    expect(m.text).toContain('Bestellung PC-2026-00017 – seit 02.03.2026 – Grund:')
  })

  it('A16 Unterlagen mit 10-Jahres-Frist, nur Erinnerung', async () => {
    const m = await render('admin_compliance_docs_review')
    expect(m.subject).toBe('Produktsicherheits-Unterlagen prüfen')
    expect(m.text).toContain(
      'Prüfbericht: Prüfbericht Blei/Cadmium 2026 – aufbewahren bis 14.10.2036',
    )
    expect(m.text).toContain('es wird nichts gelöscht')
  })

  it('A16 (P5.13) Kategorien ohne technische Unterlagen und Unterlagen mit abgelaufener Frist („kann gelöscht werden“), Link Produktsicherheit', async () => {
    const m = await render('admin_compliance_docs_review')
    expect(m.text).toContain('Für diese Kategorien fehlen noch technische Unterlagen')
    expect(m.text).toContain('- Textil')
    expect(m.text).toContain('sie können gelöscht werden')
    expect(m.text).toContain(
      'Lieferantenerklärung: Datenblatt Glasur 2015 – Frist endete am 01.05.2025',
    )
    expect(m.html).toContain('/werkstatt/einstellungen/produktsicherheit')
  })
})

describe('AK-6-01/AK-6-03: Snapshots DE A01–A17, keine Werbung, kein OS-Link, keine externen Bilder', () => {
  const keys = [...new Set(Object.values(ADMIN_MAILS))].filter(
    (k) => k !== 'admin_password_reset',
  ) as EmailTemplate[]

  for (const t of keys) {
    it(`${t} (${TEMPLATE_META[t].konzeptId}): Snapshot, Verbote, Deutsch`, async () => {
      const m = await render(t)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      expect(`${m.html}\n${m.text}`).not.toContain('ec.europa.eu/consumers/odr')
      expect(m.html).toContain('<html lang="de">')
      expect(m.html).toMatch(new RegExp(`href="${ADMIN.replace(/[/.]/g, '\\$&')}/`))
      await expect(m.text).toMatchFileSnapshot(snapshotPath(t, 'de', 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath(t, 'de', 'html'))
    })
  }

  it('admin_password_reset (A17): Snapshot DE, nur eigener Link, keine Werbung', async () => {
    const m = renderAdminPasswordReset({ resetUrl: `${ADMIN}/reset/{token}` })
    expect(m.subject).toBe('Neues Passwort für deine Verwaltung')
    expect(scanMail(m, MAIL_FIXTURE_SITE)).toEqual([])
    await expect(m.text).toMatchFileSnapshot(snapshotPath('admin_password_reset', 'de', 'txt'))
    await expect(m.html).toMatchFileSnapshot(snapshotPath('admin_password_reset', 'de', 'html'))
  })
})
