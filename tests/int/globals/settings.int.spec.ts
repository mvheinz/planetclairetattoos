import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_IBAN,
  DEFAULT_PACKAGING_BY_CLASS,
  DEFAULT_SHIPPING_RATES,
  DEFAULT_TAX_MODES,
} from '@/globals/settingsDefaults'
import { getPublicSettings } from '@/lib/payload/public'

import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.25: Globals `settings` und `site-texts` (DATENMODELL §7, R-032, R-047, R-060, R-201, R-202, L-06).

let payload: Payload
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)

type Settings = Record<string, Record<string, unknown>>

/** Einstellungen auf die Standardwerte zurücksetzen (Seed-Kontext: ohne Audit/Sperren). */
async function resetSettings() {
  await payload.updateGlobal({
    slug: 'settings',
    data: {
      tax: { modes: DEFAULT_TAX_MODES },
      retention: { invoiceYears: '10' },
      shipping: {
        enabledCountries: ['DE'],
        euShippingAcknowledged: false,
        euChecklist: {
          authorisedRepresentativeNamed: false,
          ossThresholdChecked: false,
          textileLanguageChecked: false,
          ratesMaintained: false,
          legalTextsAdapted: false,
        },
        rates: DEFAULT_SHIPPING_RATES,
      },
      payment: { iban: DEFAULT_IBAN },
      business: { taxNumber: null },
      packaging: { defaultsByShippingClass: DEFAULT_PACKAGING_BY_CLASS },
    } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
}

async function update(
  data: Record<string, unknown>,
  context: Record<string, unknown> = {},
  user?: Record<string, unknown>,
) {
  return (await payload.updateGlobal({
    slug: 'settings',
    data: data as never,
    overrideAccess: true,
    context,
    ...(user ? { user: user as never } : {}),
  })) as unknown as Settings
}

/** Ablehnung mit Meldung (auch in `data.errors`), die auf `re` passt. */
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; data?: { errors?: { message: string }[] } },
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

async function audits(action: string) {
  return (
    await payload.find({
      collection: 'audit-log',
      where: {
        and: [{ action: { equals: action } }, { entityCollection: { equals: 'settings' } }],
      },
      sort: '-createdAt',
      overrideAccess: true,
    })
  ).docs
}

beforeAll(async () => {
  payload = await getTestPayload()
  await payload.delete({
    collection: 'audit-log',
    where: { entityCollection: { equals: 'settings' } },
    overrideAccess: true,
    context: { skipAudit: true },
  })
})
beforeEach(resetSettings)
afterAll(resetSettings)

describe('settings – Standardwerte und Zugriff', () => {
  it('Standardwerte laut DATENMODELL §7.1 (u. a. Beispiel-IBAN, R-047 aus, 10 Jahre)', async () => {
    const s = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
    })) as unknown as Settings
    expect(s.payment!.iban).toBe('DE36000000000000000000')
    expect(s.legal!.allowVisibleBlankBrands).toBe(false)
    expect(s.retention!.invoiceYears).toBe('10')
    expect(s.shipping!.enabledCountries).toEqual(['DE'])
    expect(s.tax!.standardRate).toBe(19)
    const reviews = (s.legal!.reviews as { type: string }[]).map((r) => r.type)
    expect(reviews).toHaveLength(6)
  })

  it('anonym nicht lesbar und nicht änderbar; site-texts öffentlich lesbar mit DE/EN-Standard', async () => {
    expect([401, 403]).toContain((await rest('GET', '/globals/settings')).status)
    expect([401, 403]).toContain(
      (await rest('POST', '/globals/settings', { shop: { isOpen: false } })).status,
    )
    const texts = await rest('GET', '/globals/site-texts?locale=en')
    expect(texts.status).toBe(200)
    const body = (await texts.json()) as { product: { addToCart: string } }
    expect(body.product.addToCart).toBe('Add to basket')
    expect([401, 403]).toContain(
      (await rest('POST', '/globals/site-texts', { footer: { tagline: 'x' } })).status,
    )
    const de = (await payload.findGlobal({ slug: 'site-texts', locale: 'de' })) as unknown as {
      emails: { inquiryResponseTime: string }
      navigation: { mainLinks: unknown[] }
    }
    expect(de.emails.inquiryResponseTime).toBe('Ich melde mich meist innerhalb einer Woche.')
    expect(de.navigation.mainLinks.length).toBeLessThanOrEqual(5)
  })

  it('getPublicSettings() enthält weder payment.iban noch business.taxNumber', async () => {
    await update({ business: { taxNumber: '12/345/67890' }, payment: { iban: DEFAULT_IBAN } })
    const pub = await getPublicSettings()
    const json = JSON.stringify(pub)
    expect(json).not.toContain('DE36')
    expect(json).not.toContain('12/345/67890')
    expect((pub.payment as Record<string, unknown>).iban).toBeUndefined()
    expect((pub.business as Record<string, unknown>).taxNumber).toBeUndefined()
    expect((pub.tax as Record<string, unknown>).currentMode).toBe('kleinunternehmer')
    expect((pub.shipping as Record<string, unknown>).enabledCountries).toEqual(['DE'])
  })
})

describe('settings – Steuermodus (R-032)', () => {
  it('R-032 tax.modes ohne Eintrag oder mit doppeltem validFrom wird abgelehnt', async () => {
    await rejects(update({ tax: { modes: [] } }), /Steuermodus|mindestens|Mindestens/i)
    await rejects(
      update({
        tax: {
          modes: [
            ...DEFAULT_TAX_MODES,
            {
              mode: 'regelbesteuert',
              validFrom: '2026-01-01T10:00:00.000Z',
              reason: 'Umsatzgrenze überschritten laut Steuerberatung',
              confirmedWithTaxAdvisor: true,
            },
          ],
        },
      }),
      /nur einmal/,
    )
  })

  it('R-032 Moduswechsel ohne Bestätigung/Begründung abgelehnt, mit Bestätigung auditiert (tax_mode_changed)', async () => {
    const entry = { mode: 'regelbesteuert', validFrom: '2099-01-01T00:00:00.000Z' }
    await rejects(
      update({
        tax: {
          modes: [...DEFAULT_TAX_MODES, { ...entry, reason: 'Wechsel zur Regelbesteuerung' }],
        },
      }),
      /Steuerberatung/,
    )
    await rejects(
      update({
        tax: { modes: [...DEFAULT_TAX_MODES, { ...entry, confirmedWithTaxAdvisor: true }] },
      }),
      /begründen/,
    )
    const before = (await audits('tax_mode_changed')).length
    const ok = await update({
      tax: {
        modes: [
          {
            ...entry,
            reason: 'Umsatzgrenze überschritten laut Steuerberatung',
            confirmedWithTaxAdvisor: true,
          },
          ...DEFAULT_TAX_MODES,
        ],
      },
    })
    // sortiert nach validFrom
    expect((ok.tax!.modes as { mode: string }[]).map((m) => m.mode)).toEqual([
      'kleinunternehmer',
      'regelbesteuert',
    ])
    const after = await audits('tax_mode_changed')
    expect(after.length).toBe(before + 1)
    expect(after[0]!.summary).toContain('regelbesteuert ab 01.01.2099')
    // Geltender Modus bleibt bis dahin Kleinunternehmer
    expect(((await getPublicSettings()).tax as { currentMode: string }).currentMode).toBe(
      'kleinunternehmer',
    )
  })

  it('R-032 bereits geltende Einträge bleiben unverändert; neuer Modus nicht rückwirkend', async () => {
    await rejects(
      update({
        tax: {
          modes: [
            {
              mode: 'regelbesteuert',
              validFrom: '2026-01-01T00:00:00.000Z',
              reason: 'Rückwirkend umstellen wäre falsch',
              confirmedWithTaxAdvisor: true,
            },
          ],
        },
      }),
      /geltende|frühestens/,
    )
  })
})

describe('settings – Zahlung, Versand, Verpackung', () => {
  it('eine IBAN mit falscher Prüfsumme wird abgelehnt; gültige wird normalisiert und maskiert auditiert', async () => {
    await rejects(update({ payment: { iban: 'DE36000000000000000001' } }), /IBAN/)
    const before = (await audits('settings_changed')).length
    const ok = await update({ payment: { iban: 'de89 3704 0044 0532 0130 00' } })
    expect(ok.payment!.iban).toBe('DE89370400440532013000')
    const after = await audits('settings_changed')
    expect(after.length).toBe(before + 1)
    const changes = after[0]!.changes as Record<string, unknown[]>
    expect(changes['payment.iban']).toEqual(['[redacted]', '[redacted]'])
    expect(JSON.stringify(after[0])).not.toContain('DE89')
  })

  it("R-060/R-202 enabledCountries ['DE','AT'] ohne euShippingAcknowledged abgelehnt, ohne DE ebenfalls", async () => {
    await rejects(update({ shipping: { enabledCountries: ['DE', 'AT'] } }), /EU-Checkliste/)
    await rejects(update({ shipping: { enabledCountries: ['AT'] } }), /Deutschland/)
    // Häkchen nur mit vollständiger Checkliste
    await rejects(update({ shipping: { euShippingAcknowledged: true } }), /Checkliste/)
    const checklist = {
      authorisedRepresentativeNamed: true,
      ossThresholdChecked: true,
      textileLanguageChecked: true,
      ratesMaintained: true,
      legalTextsAdapted: true,
    }
    // Zone EU braucht alle drei Tarife
    await rejects(
      update({
        shipping: {
          enabledCountries: ['DE', 'AT'],
          euShippingAcknowledged: true,
          euChecklist: checklist,
        },
      }),
      /Zone EU/,
    )
    const ok = await update({
      shipping: {
        enabledCountries: ['DE', 'AT'],
        euShippingAcknowledged: true,
        euChecklist: checklist,
        rates: [
          ...DEFAULT_SHIPPING_RATES,
          { zone: 'EU', shippingClass: 'brief', priceCents: 900 },
          { zone: 'EU', shippingClass: 'paket_klein', priceCents: 1500 },
          { zone: 'EU', shippingClass: 'keramik', priceCents: 2500 },
        ],
      },
    })
    expect(ok.shipping!.euShippingAcknowledgedAt).toBeTruthy()
  })

  it('R-201 packaging.defaultsByShippingClass: genau ein Eintrag je Versandklasse (ohne nur_abholung), templateKey existiert', async () => {
    const [brief, paket, keramik] = DEFAULT_PACKAGING_BY_CLASS
    await rejects(update({ packaging: { defaultsByShippingClass: [brief, paket] } }), /keramik: 0/)
    await rejects(
      update({ packaging: { defaultsByShippingClass: [brief, paket, keramik, brief] } }),
      /brief: 2/,
    )
    await rejects(
      update({
        packaging: {
          defaultsByShippingClass: [
            brief,
            paket,
            { shippingClass: 'keramik', templateKey: 'gibt-es-nicht' },
          ],
        },
      }),
      /gibt es nicht/,
    )
    await expect(
      update({
        packaging: {
          defaultsByShippingClass: [
            ...DEFAULT_PACKAGING_BY_CLASS,
            { shippingClass: 'nur_abholung', templateKey: 'brief-karton' },
          ],
        },
      }),
    ).rejects.toThrow()
  })
})

describe('settings – Aufbewahrung (L-06)', () => {
  it('retention.invoiceYears akzeptiert nur 8 oder 10; mit 8 rechnet policy.ts Beleg-PDFs mit 8 Jahren', async () => {
    await expect(update({ retention: { invoiceYears: '9' } })).rejects.toThrow()
    const before = (await audits('retention_setting_changed')).length
    await update({ retention: { invoiceYears: '8' } })
    expect((await audits('retention_setting_changed')).length).toBe(before + 1)
    const doc = (await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'invoice_pdf' } as never,
      file: { data: PDF, name: 'beleg.pdf', mimetype: 'application/pdf', size: PDF.length },
      overrideAccess: true,
      context: { now: '2027-03-15T09:00:00.000Z' },
    })) as unknown as { id: number; retainUntil: string }
    expect(doc.retainUntil).toBe('2035-12-31T23:00:00.000Z')
    await payload
      .delete({
        collection: 'private-uploads',
        id: doc.id,
        overrideAccess: true,
        context: { seed: true, skipAudit: true },
      })
      .catch(() => null)
    await payload
      .update({
        collection: 'private-uploads',
        id: doc.id,
        data: { seed: true } as never,
        overrideAccess: true,
        context: { system: true },
      })
      .catch(() => null)
    await payload
      .delete({ collection: 'private-uploads', id: doc.id, overrideAccess: true })
      .catch(() => null)
  })
})

describe('settings – AV-Verträge (R-155)', () => {
  it('eine Datei in settings.processorAgreements lässt sich nicht löschen; nur Zweck processor_agreement', async () => {
    const file = { data: PDF, name: 'avv.pdf', mimetype: 'application/pdf', size: PDF.length }
    // Verwaltung: die Auswahl der Datei wird mit den Rechten der Anmeldung geprüft
    const existing = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
    const admin = {
      ...(existing.docs[0] ??
        (await payload.create({
          collection: 'users',
          data: {
            email: 'avv@example.com',
            password: 'richtig-langes-passwort-2026',
            name: 'Jutta',
            role: 'admin',
          } as never,
          overrideAccess: true,
        }))),
      collection: 'users',
    }
    const avv = (await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'processor_agreement' } as never,
      file,
      overrideAccess: true,
    })) as unknown as { id: number }
    const other = (await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'lab_report', complianceCategory: 'keramik' } as never,
      file,
      overrideAccess: true,
    })) as unknown as { id: number }
    await expect(
      update({ processorAgreements: [{ serviceId: 'hosting', file: other.id }] }, {}, admin),
    ).rejects.toThrow()
    await rejects(
      update({ processorAgreements: [{ serviceId: 'hosting', url: 'http://example.com' }] }),
      /https/,
    )
    await update(
      {
        processorAgreements: [
          { serviceId: 'hosting', url: 'https://example.com/avv', file: avv.id },
        ],
      },
      {},
      admin,
    )
    await rejects(
      payload.delete({ collection: 'private-uploads', id: avv.id, overrideAccess: true }),
      /AV-Vertrag/,
    )
    await update({ processorAgreements: [] })
    await payload.delete({ collection: 'private-uploads', id: avv.id, overrideAccess: true })
    await payload.delete({ collection: 'private-uploads', id: other.id, overrideAccess: true })
  })
})
