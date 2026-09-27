import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AUDIT_ACTIONS, DELETION_ACTIONS } from '@/lib/enums'
import {
  auditRetentionRule,
  invoiceRetainUntil,
  L_05_ORDERS_STAGE_D,
  L_10_INQUIRIES,
  L_13H_AUDIT_LOG_OTHER,
  L_13H_AUDIT_LOG_RECORDS,
  L_18_DELETION_LOG,
  privateUploadRetention,
  RETENTION_RULES,
  retainUntil,
  RULES_WITHOUT_OWN_DEADLINE,
  type RetentionDuration,
  type RetentionRule,
} from '@/lib/retention/policy'

// Die Fristen werden gegen die Tabelle in docs/recht/LOESCHKONZEPT.md geprüft (§2 und §3.1).
const doc = readFileSync(
  path.resolve(import.meta.dirname, '../../../docs/recht/LOESCHKONZEPT.md'),
  'utf8',
)
const clean = (s: string) => s.replace(/\*\*/g, '').trim()

function tableRows(section: string): string[][] {
  return section
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('|---'))
    .map((l) => l.split(' | ').map((c) => clean(c.replace(/^\| ?| ?\|$/g, ''))))
}
const sec = (from: string, to: string) => doc.slice(doc.indexOf(from), doc.indexOf(to))

// §2: | ID | Kategorie | Zweck | Rechtsgrundlage | Frist | Fristbeginn | Danach | Job |
const main = new Map(
  tableRows(sec('## 2. Aufbewahrungs', '## 3. Details'))
    .filter((r) => /^L-\d{2}$/.test(r[0]!))
    .map((r) => [r[0]!, { frist: r[4]!, beginn: r[5]! }]),
)
// §3.1: | Stufe | Wann | Aktion |
const sec3_1 = clean(sec('### 3.1 Bestellungen', '### 3.2'))
const stages = new Map(
  tableRows(sec3_1)
    .filter((r) => /^[A-D]$/.test(r[0]!))
    .map((r) => [r[0]!, r[1]!]),
)

/** Teilstück einer Zelle ab „x)“ bzw. „Stufe n:“ bis zum nächsten Teil. */
function part(cell: string, marker: RegExp): string {
  const m = marker.exec(cell)
  if (!m) return ''
  const rest = cell.slice(m.index + m[0].length)
  const next = /(?:^|[\s;])(?:[a-h]\)|Stufe \d:)/.exec(rest)
  return next ? rest.slice(0, next.index) : rest
}

function docText(r: RetentionRule): { text: string; beginn: string } {
  const m = /^(L-\d{2})(?: ([a-h]))?(?: Stufe ([A-D12]))?$/.exec(r.id)!
  const [, lid, letter, stage] = m
  if (lid === 'L-05' && stage) return { text: stages.get(stage)!, beginn: stages.get(stage)! }
  // L-05 ohne Stufe: Rückfall „shippedAt + 30 Tage“ aus dem Text von §3.1
  if (lid === 'L-05') return { text: sec3_1, beginn: sec3_1 }
  const row = main.get(lid!)!
  // „wie L-05“ (L-09): Endstufe D der Bestellung
  if (row.frist === 'wie L-05') return docText({ ...r, id: 'L-05 Stufe D' })
  if (letter) {
    const re = new RegExp(`(?:^|[\\s;])${letter}\\) `)
    return { text: part(row.frist, re), beginn: part(row.beginn, re) || row.beginn }
  }
  if (stage) return { text: part(row.frist, new RegExp(`Stufe ${stage}: `)), beginn: row.beginn }
  return { text: row.frist, beginn: row.beginn }
}

function fmt(d: RetentionDuration): string {
  if (d.years) return `${d.years} Jahre`
  if (d.months) return `${d.months} Monate`
  if (d.days) return `${d.days} Tage`
  return `${d.hours} h`
}

describe('Löschfristen (LOESCHKONZEPT §2, src/lib/retention/policy.ts)', () => {
  it('die Tabelle wurde geparst (L-01 … L-25)', () => {
    expect(main.size).toBe(25)
    expect(stages.size).toBe(4)
  })

  it('jede L-ID hat eine Regel im Code oder ist bewusst ohne eigene Frist', () => {
    const covered = new Set(RETENTION_RULES.map((r) => r.id.slice(0, 4)))
    const missing = [...main.keys()].filter(
      (id) => !covered.has(id) && !(id in RULES_WITHOUT_OWN_DEADLINE),
    )
    expect(missing).toEqual([])
  })

  for (const r of RETENTION_RULES) {
    it(`${r.id} (${r.from}): ${fmt(r.duration)}${r.start === 'endOfYear' ? ' ab Jahresende' : ''} wie im LOESCHKONZEPT`, () => {
      const { text, beginn } = docText(r)
      expect(text, `Frist-Text für ${r.id}`).toContain(fmt(r.duration))
      if (r.start === 'endOfYear') expect(`${text} ${beginn}`).toMatch(/Ende des/)
    })
  }

  it('L-06 Rechnungen: Standard 10 Jahre, umstellbar auf 8 (settings.retention.invoiceYears)', () => {
    expect(main.get('L-06')!.frist).toMatch(/Standard 10 Jahre.*8/)
    // Beispiel LOESCHKONZEPT §1 Nr. 3: Rechnung vom 15.03.2027, 10 Jahre → löschbar ab 01.01.2038 (Berlin)
    expect(invoiceRetainUntil(new Date('2027-03-15T09:00:00Z'), 10).toISOString()).toBe(
      '2037-12-31T23:00:00.000Z',
    )
    expect(invoiceRetainUntil(new Date('2027-03-15T09:00:00Z'), 8).toISOString()).toBe(
      '2035-12-31T23:00:00.000Z',
    )
    // Silvester 23:30 Berlin zählt noch zum alten Jahr
    expect(invoiceRetainUntil(new Date('2027-12-31T22:30:00Z'), 10).toISOString()).toBe(
      '2037-12-31T23:00:00.000Z',
    )
  })

  it('L-10: 15.10. + 6 Monate = 15.04. (kalendergenau, Berliner Uhrzeit bleibt über die Zeitumstellung)', () => {
    // 15.10.2026 12:00 MESZ → 15.04.2027 12:00 MESZ
    expect(retainUntil(L_10_INQUIRIES, new Date('2026-10-15T10:00:00Z')).toISOString()).toBe(
      '2027-04-15T10:00:00.000Z',
    )
    // 15.11.2026 12:00 MEZ → 15.05.2027 12:00 MESZ
    expect(retainUntil(L_10_INQUIRIES, new Date('2026-11-15T11:00:00Z')).toISOString()).toBe(
      '2027-05-15T10:00:00.000Z',
    )
  })

  it('L-05 Stufe D: 6 Jahre ab Ende des Kalenderjahres von finalStatusAt', () => {
    expect(retainUntil(L_05_ORDERS_STAGE_D, new Date('2026-05-02T12:00:00Z')).toISOString()).toBe(
      '2032-12-31T23:00:00.000Z',
    )
  })

  it('L-18: deletion-log executedAt + 3 Jahre', () => {
    expect(retainUntil(L_18_DELETION_LOG, new Date('2026-09-27T08:00:00Z')).toISOString()).toBe(
      '2029-09-27T08:00:00.000Z',
    )
  })

  it('L-13 h: audit-log 10 Jahre (Jahresende) bei Beleg-/Bestell-/Widerrufs-/Rechtstext-Aktionen, sonst 3 Jahre', () => {
    expect(auditRetentionRule('invoice_issued')).toBe(L_13H_AUDIT_LOG_RECORDS)
    expect(auditRetentionRule('order_status_changed')).toBe(L_13H_AUDIT_LOG_RECORDS)
    expect(auditRetentionRule('withdrawal_received')).toBe(L_13H_AUDIT_LOG_RECORDS)
    expect(auditRetentionRule('legal_text_activated')).toBe(L_13H_AUDIT_LOG_RECORDS)
    expect(auditRetentionRule('product_price_changed')).toBe(L_13H_AUDIT_LOG_OTHER)
    expect(auditRetentionRule('login_succeeded')).toBe(L_13H_AUDIT_LOG_OTHER)
    for (const a of AUDIT_ACTIONS) expect(auditRetentionRule(a).id).toBe('L-13 h')
  })

  it('Regel-IDs passen zum deletion-log-Muster (DATENMODELL §6.27)', () => {
    for (const r of RETENTION_RULES) expect(r.id).toMatch(/^L-\d{2}( [a-h])?( Stufe [A-D12])?$/)
    expect(DELETION_ACTIONS).toEqual(['deleted', 'anonymized', 'restricted', 'files_deleted'])
  })
})

describe('Aufbewahrung je Zweck (DATENMODELL §6.4, privateUploadRetention)', () => {
  const createdAt = new Date('2026-10-15T10:00:00Z')
  const base = { createdAt, status: 'attached' as const }

  it('Referenzbild: pending 24 h (L-13 f), zugeordnet Anfrage + 6 Monate (L-10)', () => {
    const pending = privateUploadRetention({
      ...base,
      purpose: 'commission_reference',
      status: 'pending',
    })
    expect(pending.deleteAfter?.toISOString()).toBe('2026-10-16T10:00:00.000Z')
    expect(pending.ruleId).toBe('L-13 f')
    const attached = privateUploadRetention({ ...base, purpose: 'commission_reference' })
    expect(attached.deleteAfter?.toISOString()).toBe('2027-04-15T10:00:00.000Z')
    expect(attached.retainUntil).toBeNull()
  })

  it('Beleg-PDFs: retainUntil = Ende des Belegjahres + invoiceYears (Standard 10, sonst 8), keine Auto-Löschung', () => {
    const recordDate = new Date('2027-03-15T09:00:00Z')
    const ten = privateUploadRetention({ ...base, purpose: 'invoice_pdf', recordDate })
    expect(ten.retainUntil?.toISOString()).toBe('2037-12-31T23:00:00.000Z')
    expect(ten.deleteAfter).toBeNull()
    const eight = privateUploadRetention({
      ...base,
      purpose: 'credit_note_pdf',
      recordDate,
      invoiceYears: 8,
    })
    expect(eight.retainUntil?.toISOString()).toBe('2035-12-31T23:00:00.000Z')
    const exp = privateUploadRetention({ ...base, purpose: 'monthly_export', invoiceYears: 8 })
    expect(exp.retainUntil?.toISOString()).toBe('2036-12-31T23:00:00.000Z') // L-07 immer 10 Jahre
  })

  it('Fotos und Exporte folgen dem Bezugsereignis; ohne Ereignis keine Frist', () => {
    expect(privateUploadRetention({ ...base, purpose: 'packing_photo' }).deleteAfter).toBeNull()
    expect(
      privateUploadRetention({
        ...base,
        purpose: 'packing_photo',
        orderShippedAt: new Date('2026-11-02T12:00:00Z'),
      }).deleteAfter?.toISOString(),
    ).toBe('2027-11-02T12:00:00.000Z')
    expect(
      privateUploadRetention({
        ...base,
        purpose: 'return_photo',
        orderReturnReceivedAt: new Date('2026-12-01T12:00:00Z'),
      }).deleteAfter?.toISOString(),
    ).toBe('2027-12-01T12:00:00.000Z')
    expect(
      privateUploadRetention({
        ...base,
        purpose: 'data_export',
        privacyAnsweredAt: new Date('2026-11-01T12:00:00Z'),
      }).deleteAfter?.toISOString(),
    ).toBe('2026-12-01T12:00:00.000Z')
    const until = new Date('2033-12-31T23:00:00Z')
    expect(
      privateUploadRetention({ ...base, purpose: 'complaint_photo', orderRetainUntil: until })
        .deleteAfter,
    ).toEqual(until)
  })

  it('Nachweise, Unterlagen und AV-Verträge ohne automatische Löschung (L-24, L-25)', () => {
    for (const purpose of [
      'nickel_evidence',
      'lab_report',
      'supplier_document',
      'technical_file',
      'processor_agreement',
      'consent_evidence',
    ] as const) {
      const r = privateUploadRetention({ ...base, purpose })
      expect(r.deleteAfter, purpose).toBeNull()
      expect(r.retainUntil, purpose).toBeNull()
    }
  })
})
