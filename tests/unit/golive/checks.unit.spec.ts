import { describe, expect, it } from 'vitest'

import {
  EXAMPLE_IBAN,
  evaluateGolive,
  looksLikePlaceholder,
  type GoliveInput,
} from '@/lib/golive/checks'

// R-210: jede Prüfung einzeln mit Fixtures grün/rot; R-155: fehlender AVV-Eintrag → rot.

function green(): GoliveInput {
  return {
    now: new Date('2026-10-20T10:00:00Z'),
    env: {
      appEnv: 'production',
      paymentsDriver: 'stripe',
      emailDriver: 'smtp',
      storageDriver: 's3',
      adminRoute: '/verwaltung-x7k2',
      seedPreviewMode: false,
      stripeWebhookSecretSet: true,
      stripeLiveKey: true,
    },
    legalTexts: Object.fromEntries(
      [
        'impressum',
        'datenschutz',
        'agb',
        'widerrufsbelehrung',
        'widerrufsformular',
        'versand-zahlung',
      ].map((t) => [t, { origin: 'lawyer', isPlaceholder: false }]),
    ),
    snippetsNotLawyer: [],
    settings: {
      business: {
        legalName: 'Jutta Dollmann',
        street: 'Beispielweg 1',
        postalCode: '10115',
        city: 'Berlin',
        email: 'hallo@planetclairetattoos.com',
        phone: '+49 30 1234567',
        taxNumber: '12/345/67890',
        lucidNumber: 'DE1234567890123',
        packagingScheme: { name: 'Duales System GmbH', contractFrom: '2026-10-01' },
      },
      tattoo: { studioDistrict: 'Neukölln' },
      pickup: { instructions: 'Nach Absprache' },
      payment: {
        prepaymentEnabled: true,
        iban: 'DE89370400440532013000',
        accountHolder: 'Jutta Dollmann',
      },
      processorAgreements: [{ serviceId: 'vercel', signedAt: '2026-10-01' }],
      analytics: { enabled: false, confirmedAt: '2026-10-01T00:00:00Z' },
      tax: { confirmedAt: '2026-10-01T00:00:00Z' },
      revenueGuard: { manualYearTotals: [{ year: 2025 }] },
      shipping: { enabledCountries: ['DE'], euShippingAcknowledged: false },
      seed: { exampleDataPresent: false },
    },
    requiredAgreements: [{ id: 'vercel', name: 'Vercel' }],
    seedCounts: {},
    ownerPhotosUnapproved: 0,
    galleryWithoutConsent: 0,
    warrantyGraphicPlaceholder: false,
    vvtExists: true,
  }
}

const ids = (i: GoliveInput) =>
  evaluateGolive(i)
    .checks.filter((c) => !c.ok)
    .map((c) => c.id)

describe('R-210 Startklar-Prüfung', () => {
  it('Platzhalter-Erkennung', () => {
    for (const v of ['[Telefon folgt]', 'Straße folgt', 'Musterstraße 1', 'a@example.com', '00000'])
      expect(looksLikePlaceholder(v), v).toBe(true)
    for (const v of ['Beispielweg 1', '10115', 'Neukölln', '', null])
      expect(looksLikePlaceholder(v)).toBe(false)
  })

  it('alles grün: 15 Punkte, bereit', () => {
    const r = evaluateGolive(green())
    expect(r.checks).toHaveLength(15)
    expect(r.openItems).toEqual([])
    expect(r.ready).toBe(true)
  })

  it('Nr. 1 Rechtstexte: fehlend, Platzhalter, draft → rot', () => {
    const a = green()
    delete a.legalTexts.agb
    expect(ids(a)).toEqual(['R210-01'])
    const b = green()
    b.legalTexts.impressum = { origin: 'placeholder', isPlaceholder: true }
    expect(ids(b)).toEqual(['R210-01'])
    const c = green()
    c.legalTexts.datenschutz = { origin: 'draft', isPlaceholder: false }
    expect(ids(c)).toEqual(['R210-01'])
  })

  it('Nr. 2 Bausteine ohne Kanzlei → rot', () => {
    const a = green()
    a.snippetsNotLawyer = ['product.used']
    const r = evaluateGolive(a)
    expect(r.checks.find((c) => c.id === 'R210-02')?.detail).toContain('product.used')
    expect(ids(a)).toEqual(['R210-02'])
  })

  it.each([
    ['legalName', ''],
    ['street', '[Straße folgt]'],
    ['postalCode', '00000'],
    ['city', 'Musterstadt'],
    ['email', 'x@example.com'],
    ['phone', '[Telefon folgt]'],
    ['taxNumber', null],
  ] as const)('Nr. 3 Stammdaten: %s = %s → rot', (field, value) => {
    const a = green()
    ;(a.settings.business as Record<string, unknown>)[field] = value
    expect(ids(a)).toEqual(['R210-03'])
  })

  it('Nr. 3 Bezirk und Abholhinweis', () => {
    const a = green()
    a.settings.tattoo = { studioDistrict: '' }
    expect(ids(a)).toEqual(['R210-03'])
    const b = green()
    b.settings.pickup = { instructions: ' ' }
    expect(ids(b)).toEqual(['R210-03'])
  })

  it('Nr. 4 IBAN: Beispiel, ungültig, leer, Kontoinhaberin; Vorkasse aus → grün', () => {
    const a = green()
    a.settings.payment!.iban = EXAMPLE_IBAN
    expect(ids(a)).toEqual(['R210-04'])
    const b = green()
    b.settings.payment!.iban = 'DE89370400440532013001'
    expect(ids(b)).toEqual(['R210-04'])
    const c = green()
    c.settings.payment!.accountHolder = ''
    expect(ids(c)).toEqual(['R210-04'])
    const d = green()
    d.settings.payment = { prepaymentEnabled: false, iban: EXAMPLE_IBAN }
    expect(ids(d)).toEqual([])
  })

  it('R-200 Nr. 5 LUCID und duales System', () => {
    for (const patch of [
      { lucidNumber: '' },
      { packagingScheme: { name: '', contractFrom: '2026-10-01' } },
      { packagingScheme: { name: 'X', contractFrom: null } },
    ]) {
      const a = green()
      Object.assign(a.settings.business!, patch)
      expect(ids(a)).toEqual(['R210-05'])
    }
  })

  it('R-155 Nr. 6: fehlender oder undatierter AVV-Eintrag → rot', () => {
    const a = green()
    a.settings.processorAgreements = []
    expect(ids(a)).toEqual(['R210-06'])
    expect(evaluateGolive(a).checks.find((c) => c.id === 'R210-06')?.detail).toContain('Vercel')
    const b = green()
    b.settings.processorAgreements = [{ serviceId: 'vercel', signedAt: null }]
    expect(ids(b)).toEqual(['R210-06'])
  })

  it('Nr. 7 Beispieldaten, Markierung, SEED_PREVIEW_MODE', () => {
    const a = green()
    a.seedCounts = { products: 3 }
    expect(ids(a)).toEqual(['R210-07'])
    const b = green()
    b.settings.seed = { exampleDataPresent: true }
    expect(ids(b)).toEqual(['R210-07'])
    const c = green()
    c.env.seedPreviewMode = true
    expect(ids(c)).toEqual(['R210-07'])
  })

  it('Nr. 8 ADMIN_ROUTE', () => {
    for (const route of ['/admin', '/werkstatt']) {
      const a = green()
      a.env.adminRoute = route
      expect(ids(a)).toEqual(['R210-08'])
    }
  })

  it('Nr. 9 Treiber, Live-Modus, Webhook-Geheimnis', () => {
    const mut: ((i: GoliveInput) => void)[] = [
      (i) => (i.env.paymentsDriver = 'mock'),
      (i) => (i.env.emailDriver = 'file'),
      (i) => (i.env.storageDriver = 'local'),
      (i) => (i.env.stripeLiveKey = false),
      (i) => (i.env.stripeWebhookSecretSet = false),
    ]
    for (const m of mut) {
      const a = green()
      m(a)
      expect(ids(a)).toEqual(['R210-09'])
    }
  })

  it('Nr. 10 Statistik-Entscheidung: bewusst an oder aus grün, ohne confirmedAt rot', () => {
    const a = green()
    a.settings.analytics = { enabled: true, confirmedAt: '2026-10-01T00:00:00Z' }
    expect(ids(a)).toEqual([])
    a.settings.analytics = { enabled: false, confirmedAt: null }
    expect(ids(a)).toEqual(['R210-10'])
  })

  it('Nr. 11 harmonisierte Mitteilung', () => {
    const a = green()
    a.warrantyGraphicPlaceholder = true
    expect(ids(a)).toEqual(['R210-11'])
  })

  it('Nr. 12 Steuer bestätigt und Vorjahresumsatz (auch 0 €)', () => {
    const a = green()
    a.settings.tax = {}
    expect(ids(a)).toEqual(['R210-12'])
    const b = green()
    b.settings.revenueGuard = { manualYearTotals: [{ year: 2024 }] }
    expect(ids(b)).toEqual(['R210-12'])
    const c = green()
    c.now = new Date('2027-01-05T10:00:00Z')
    expect(ids(c)).toEqual(['R210-12'])
  })

  it('Nr. 13 Lieferländer: nur DE oder bestätigt', () => {
    const a = green()
    a.settings.shipping = { enabledCountries: ['DE', 'AT'], euShippingAcknowledged: false }
    expect(ids(a)).toEqual(['R210-13'])
    a.settings.shipping.euShippingAcknowledged = true
    expect(ids(a)).toEqual([])
  })

  it('Nr. 14 VVT', () => {
    const a = green()
    a.vvtExists = false
    expect(ids(a)).toEqual(['R210-14'])
  })

  it('Nr. 15 R-181 Fotos von Jutta ohne Freigabe, Galerie ohne Einwilligung', () => {
    const a = green()
    a.ownerPhotosUnapproved = 2
    expect(ids(a)).toEqual(['R210-15'])
    const b = green()
    b.galleryWithoutConsent = 1
    expect(ids(b)).toEqual(['R210-15'])
  })

  it('Meldungen sind deutsch und nennen den offenen Punkt', () => {
    const a = green()
    a.vvtExists = false
    a.env.adminRoute = '/admin'
    const r = evaluateGolive(a)
    expect(r.ready).toBe(false)
    expect(r.openItems).toHaveLength(2)
  })
})
