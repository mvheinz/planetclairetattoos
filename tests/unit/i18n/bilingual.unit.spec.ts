import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { SiteTexts } from '@/globals/SiteTexts'
import { flattenMessages, loadMessages } from '../../../scripts/lib/static-checks/i18n-parity'

// P12.9 / U-00: Die ganze Seite ist zweisprachig – jeder Text hat eine eigenständige englische Fassung. Dieser Test
// prüft Sprachdateien, Beispielbestand und Standardtexte der Verwaltung. Ausnahmen stehen in den Allowlists unten und
// sind jeweils begründet; neue Ausnahmen brauchen einen Eintrag samt Grund.

const root = path.resolve(import.meta.dirname, '../../..')

/** Schlüssel, deren Text in beiden Sprachen von Natur aus gleich ist (Namen, Marken, Zahlungsarten, Fachwörter, Zeichen). */
const IDENTICAL_BY_NATURE = new Set([
  'common.siteName',
  'common.routes.R02',
  'common.routes.R11',
  'common.routes.R12',
  'common.routes.R17',
  'common.routes.R18',
  'header.shop',
  'header.tattoo',
  'footer.instagram',
  'footer.copyright',
  'legal.processors.colName',
  'legal.processors.thirdCountry.US',
  'errors.soldStamp',
  'home.title',
  'home.stationKicker',
  'home.tour.heading',
  'home.tour.stand',
  'previewExport.phase',
  'previewExport.groups.start',
  'previewExport.groups.shop',
  'previewExport.groups.tattoo',
  'previewExport.groups.service',
  'withdraw.nameLabel',
  'withdraw.summaryEmpty',
  'shop.badges.secondHand',
  'shop.product.fibers',
  'shop.product.detailsHeading',
  'shop.product.details.material',
  'order.method.paypal',
  'order.method.apple_pay',
  'order.method.google_pay',
  'order.bank.iban',
  'order.bank.bic',
  'order.bank.bank',
  'orderStatus.name',
  'cart.meta',
  'cart.soldStamp',
  'checkout.mock.apple_pay',
  'checkout.mock.google_pay',
  'checkout.mock.paypal',
  'email.common.method.paypal',
  'email.common.method.apple_pay',
  'email.common.method.google_pay',
  'email.common.iban',
  'email.common.bic',
  'email.common.bank',
  'email.oversoldApology.shopLabel',
  'email.orderShipped.carriers.dhl',
  'email.orderShipped.carriers.deutsche_post',
  'email.withdrawalReceipt.name',
  'email.disputeVsbg.website',
  'email.inquiryReceipt.budget',
  'email.inquiryReceipt.empty',
  'email.inquiryReceipt.objectTypes.cap',
  'email.inquiryReceipt.objectTypes.shirt',
  'privacyExport.role.none',
  'tattoo.star',
  'tattoo.overview.galleryHeading',
  'tattoo.prices.flashHeading',
  'tattoo.gallery.fresh',
  'tattoo.gallery.healed',
  'seo.og.galleryTitle',
  'tattoo.process.steps.5.title',
  'tattoo.mail.greeting',
  'commission.form.nameLabel',
  'commission.form.objectTypes.cap',
  'commission.form.objectTypes.shirt',
  'commission.form.budgetLabel',
  'about.title',
  'qa.frame',
  'qa.pose',
  'qa.size',
  'qa.favicon',
  'qa.presets',
  'qa.stationLabel',
])

/** Englische Texte, die deutsche Eigennamen (Behörde, Gesetz) enthalten dürfen. */
const GERMAN_PROPER_NOUNS = new Set(['privacyExport.complaint'])

/** Platzhalter-Wörter, die in keinem englischen Text stehen dürfen (rechtliche Platzhalter-Hinweise heißen „placeholder“ und sind erlaubt). */
const FORBIDDEN_EN = /lorem|ipsum|todo|tbd|fixme|xxx|\bTODO\b|dummy text/i

const messages = loadMessages(root)
const flatDe = flattenMessages(messages.de!) as Map<string, string>
const flatEn = flattenMessages(messages.en!) as Map<string, string>

describe('Zweisprachigkeit der Sprachdateien (P12.9, U-00)', () => {
  it('jeder deutsche Schlüssel hat einen englischen und umgekehrt', () => {
    const onlyDe = [...flatDe.keys()].filter((k) => !flatEn.has(k))
    const onlyEn = [...flatEn.keys()].filter((k) => !flatDe.has(k))
    expect({ onlyDe, onlyEn }).toEqual({ onlyDe: [], onlyEn: [] })
  })

  it('der englische Text unterscheidet sich vom deutschen (Ausnahmen: Allowlist)', () => {
    const same = [...flatDe.entries()]
      .filter(([k, v]) => flatEn.get(k) === v && !IDENTICAL_BY_NATURE.has(k))
      .map(([k]) => k)
    expect(same).toEqual([])
  })

  it('die Allowlist enthält nur Schlüssel, die es noch gibt und die wirklich gleich sind', () => {
    const stale = [...IDENTICAL_BY_NATURE].filter(
      (k) => !flatDe.has(k) || flatDe.get(k) !== flatEn.get(k),
    )
    expect(stale).toEqual([])
  })

  it('kein englischer Text ist ein Platzhalter („lorem“, TODO, …)', () => {
    const bad = [...flatEn.entries()].filter(([, v]) => FORBIDDEN_EN.test(v)).map(([k]) => k)
    expect(bad).toEqual([])
  })

  it('kein deutscher Text enthält „lorem“ oder TODO', () => {
    const bad = [...flatDe.entries()].filter(([, v]) => FORBIDDEN_EN.test(v)).map(([k]) => k)
    expect(bad).toEqual([])
  })

  it('englische Texte enthalten keine deutschen Sonderzeichen (außer Eigennamen)', () => {
    const bad = [...flatEn.entries()]
      .filter(([k, v]) => /[äöüÄÖÜß]/.test(v) && !GERMAN_PROPER_NOUNS.has(k))
      .map(([k]) => k)
    expect(bad).toEqual([])
  })

  it('Platzhalter ({name}, <link>) stimmen in beiden Sprachen überein', () => {
    // ICU-Blöcke (plural, selectordinal) dürfen je Sprache anders aufgebaut sein: zählt nur ihr Variablenname.
    const icu = /\{(\w+),\s*(?:plural|selectordinal|select),(?:[^{}]|\{[^{}]*\})*\}/g
    const plain = (text: string) =>
      new Set([...text.replace(icu, '').matchAll(/\{(\w+)\}|<\/?(\w+)>/g)].map((m) => m[1] ?? m[2]))
    const all = (text: string) =>
      new Set([...plain(text), ...[...text.matchAll(icu)].map((m) => m[1])])
    const mismatched: string[] = []
    for (const [k, de] of flatDe) {
      const en = flatEn.get(k) ?? ''
      const missingInEn = [...plain(de)].filter((t) => !all(en).has(t as string))
      const missingInDe = [...plain(en)].filter((t) => !all(de).has(t as string))
      if (missingInEn.length || missingInDe.length) mismatched.push(k)
    }
    expect(mismatched).toEqual([])
  })

  it('Alt-Texte (Schlüssel auf „Alt“ oder „.alt“) sind in beiden Sprachen gefüllt', () => {
    const altKeys = [...flatDe.keys()].filter((k) => /(^|\.)\w*alt$/i.test(k))
    expect(altKeys.length).toBeGreaterThan(5)
    for (const k of altKeys) {
      expect(flatDe.get(k)?.trim(), `de ${k}`).toBeTruthy()
      expect(flatEn.get(k)?.trim(), `en ${k}`).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Beispielbestand (content/seed/data): jedes lokalisierte Textobjekt { de, en } hat beide Sprachen.

/** Gleich bleibende Werte (Namen, Größen, Orte). */
const SEED_IDENTICAL_VALUES = new Set([
  'Caps',
  'caps',
  'Tattoo',
  'Jutta & Coco',
  'Shop',
  'Flash',
  'Fresh & healed',
  'Aftercare',
  'M',
  'L',
  'S',
  'EU 38',
  'Godzilla and the bunnies',
])
const isPlace = (v: string) => /^Berlin-[\p{L} ]+$/u.test(v)

/**
 * Absichtlich nur deutsch: die zwei Stücke, an denen die Verwaltung den Zustand „Übersetzung fehlt“ zeigt
 * (SEED-SPEC §5, `enStatus: missing`, geprüft in tests/int/seed/products.int.spec.ts). Sonst gibt es keine Ausnahme.
 */
const SEED_EN_MISSING_BY_DESIGN = new Set([
  'products.json#S25',
  'products.json#S29',
  // Bildbeschreibung der Platzhalter-Zeichnung von S25: der Test AK-SEED-06 prüft, dass S25 genau daran scheitert
  'media.json#ph:zeichnung-03',
])

interface Found {
  where: string
  owner: string
  de: string
  en: string | undefined
}

function scan(node: unknown, where: string, file: string, out: Found[], owner: string): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => scan(v, `${where}[${i}]`, file, out, owner))
    return
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if (typeof rec.de === 'string' && Object.keys(rec).every((k) => k === 'de' || k === 'en')) {
      out.push({ where: `${file}${where}`, owner, de: rec.de, en: rec.en as string | undefined })
      return
    }
    const here = typeof rec.key === 'string' ? `${file}#${rec.key}` : owner
    for (const [k, v] of Object.entries(rec)) scan(v, `${where}/${k}`, file, out, here)
  }
}

const seedDir = path.join(root, 'content/seed/data')
function seedFindings(): Found[] {
  const all: Found[] = []
  for (const file of readdirSync(seedDir).filter((f) => f.endsWith('.json'))) {
    scan(JSON.parse(readFileSync(path.join(seedDir, file), 'utf8')) as unknown, '', file, all, file)
  }
  return all
}

describe('Beispielbestand ist zweisprachig (P12.9, U-00)', () => {
  const found = seedFindings()

  it('es gibt viele lokalisierte Textstellen im Beispielbestand', () => {
    expect(found.length).toBeGreaterThan(300)
  })

  it('jede Textstelle hat DE und EN – Ausnahme nur S25/S29 mit „Übersetzung fehlt“', () => {
    const missing = found.filter((f) => !f.en?.trim() && !SEED_EN_MISSING_BY_DESIGN.has(f.owner))
    expect(missing.map((m) => m.where)).toEqual([])
    const designMissing = found.filter((f) => !f.en?.trim()).map((f) => f.owner)
    expect(new Set(designMissing)).toEqual(SEED_EN_MISSING_BY_DESIGN)
  })

  it('EN unterscheidet sich von DE (Namen, Größen und Orte ausgenommen)', () => {
    const same = found.filter(
      (f) => f.en && f.en === f.de && !SEED_IDENTICAL_VALUES.has(f.de) && !isPlace(f.de),
    )
    expect(same.map((s) => `${s.where}: ${s.de}`)).toEqual([])
  })

  it('kein englischer Seed-Text ist ein Platzhalter („lorem“, TODO, …)', () => {
    const bad = found.filter((f) => f.en && FORBIDDEN_EN.test(f.en))
    expect(bad.map((b) => b.where)).toEqual([])
  })

  it('englische Seed-Texte enthalten keine deutschen Sonderzeichen, außer in Orts- und Eigennamen', () => {
    const bad = found.filter(
      (f) =>
        f.en &&
        /[äöüÄÖÜß]/.test(f.en) &&
        !isPlace(f.en) &&
        !/^Berlin-/.test(f.en) &&
        !/Neukölln|Schöneberg/.test(f.en),
    )
    expect(bad.map((b) => `${b.where}: ${b.en}`)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Standardtexte der Verwaltung (`site-texts`): DE ≠ EN.

type AnyField = Field & { name?: string; type: string; fields?: Field[]; defaultValue?: unknown }
function leaves(fields: Field[], prefix = ''): { path: string; field: AnyField }[] {
  const out: { path: string; field: AnyField }[] = []
  for (const raw of fields) {
    const f = raw as AnyField
    const p = f.name ? (prefix ? `${prefix}.${f.name}` : f.name) : prefix
    if (f.type === 'tabs')
      for (const tab of (f as unknown as { tabs: { fields: Field[] }[] }).tabs)
        out.push(...leaves(tab.fields, prefix))
    else if (f.type === 'group') out.push(...leaves(f.fields ?? [], p))
    else out.push({ path: p, field: f })
  }
  return out
}

describe('Standardtexte der Verwaltung sind zweisprachig (P12.9)', () => {
  it('der englische Standardtext weicht vom deutschen ab (Ausnahme: „sold“)', () => {
    const texts = leaves(SiteTexts.fields).filter(
      (l) =>
        (l.field.type === 'text' || l.field.type === 'textarea') &&
        typeof l.field.defaultValue === 'function',
    )
    expect(texts.length).toBeGreaterThan(30)
    const same: string[] = []
    for (const { path: p, field } of texts) {
      const fn = field.defaultValue as (a: { locale: string }) => string
      if (fn({ locale: 'de' }) === fn({ locale: 'en' }) && p !== 'shop.soldStamp') same.push(p)
    }
    expect(same).toEqual([])
  })
})
