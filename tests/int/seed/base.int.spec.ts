import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { DEFAULT_IBAN } from '@/globals/settingsDefaults'
import { LEGAL_TEXT_TYPES, PRODUCT_CATEGORIES } from '@/lib/enums'
import { getActiveLegalText } from '@/lib/legal/getActive'
import {
  activeReturnCostsNote,
  buildLegalTokenValues,
  renderLegalContent,
  type LexicalContent,
} from '@/lib/legal/render'
import { loadSeedData } from '@/lib/seed/loader'
import { runSeed } from '@/lib/seed/run'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'
import { fixedClock } from '@/lib/time'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'
import { getTestPayload } from '../helpers/payload'

// P1.29: Grund-Seed `pnpm seed:base` (SEED-SPEC §3, DATENMODELL §13.1): create-if-missing, `seed = false`.

let payload: Payload
const now = new Date(CANONICAL_SEED_NOW)
const clock = fixedClock('2026-10-15T08:00:30Z')
const ADMIN = { email: 'admin@example.com', password: 'grund-seed-passwort-2026' }

async function seedBase() {
  const data = await loadSeedData({ now, requireBase: true })
  return runSeed(payload, { command: 'base', data, now, clock, appEnv: 'test', admin: ADMIN })
}

type Settings = Record<string, Record<string, unknown>>

async function snapshot() {
  const count = async (collection: 'categories' | 'legal-texts' | 'users') =>
    (await payload.count({ collection, overrideAccess: true })).totalDocs
  const settings = { ...(await payload.findGlobal({ slug: 'settings', overrideAccess: true })) }
  const siteTexts = { ...(await payload.findGlobal({ slug: 'site-texts', overrideAccess: true })) }
  for (const g of [settings, siteTexts] as Record<string, unknown>[]) {
    delete g.updatedAt
    delete g.createdAt
  }
  return {
    categories: await count('categories'),
    legalTexts: await count('legal-texts'),
    users: await count('users'),
    settings: JSON.stringify(settings),
    siteTexts: JSON.stringify(siteTexts),
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  // Ausgangslage wie nach `db:reset --test`: vorhandene Grund-Daten entfernen, dann einmal seeden.
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await seedBase()
})

describe('Grund-Seed (DM-P1-04, AK-SEED-02)', () => {
  it('AK-SEED-02: 6 Kategorien, 6 aktive Platzhalter-Fassungen (origin = placeholder), genau ein Admin – alles seed = false', async () => {
    const cats = await payload.find({
      collection: 'categories',
      sort: 'sortOrder',
      locale: 'en',
      overrideAccess: true,
      limit: 0,
    })
    expect(cats.docs.map((c) => c.key)).toEqual([...PRODUCT_CATEGORIES])
    expect(cats.docs.find((c) => c.key === 'schmuck')?.slug).toBe('jewellery')
    expect(cats.docs.find((c) => c.key === 'sonstiges')?.showInNavigation).toBe(false)
    for (const c of cats.docs) expect(c.intro?.length).toBeGreaterThan(20)
    expect(cats.docs.every((c) => c.coverImage === null || c.coverImage === undefined)).toBe(true)

    const texts = await payload.find({
      collection: 'legal-texts',
      where: { status: { equals: 'active' } },
      overrideAccess: true,
      limit: 0,
    })
    expect(texts.docs.map((t) => t.type).sort()).toEqual([...LEGAL_TEXT_TYPES].sort())
    for (const t of texts.docs) {
      expect(t.origin).toBe('placeholder')
      expect(t.isPlaceholder).toBe(true)
      expect(t.source).toBe('manual')
      expect(t.seed).toBe(false)
      expect(t.version).toBe(1)
      expect(new Date(t.validFrom).toISOString()).toBe('2025-12-31T23:00:00.000Z')
    }
    const users = await payload.find({ collection: 'users', overrideAccess: true })
    expect(users.totalDocs).toBe(1)
    expect(users.docs[0]?.email).toBe(ADMIN.email)
  })

  it('AK-SEED-02: settings-Standardwerte (Versand nur DE, Beispiel-IBAN, Aufbewahrung 10, keine sichtbaren Marken, Verpackung)', async () => {
    const s = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
      locale: 'en',
    })) as unknown as Settings
    expect(s.shipping!.enabledCountries).toEqual(['DE'])
    expect(
      (s.shipping!.rates as { zone: string; shippingClass: string; priceCents: number }[]).map(
        (r) => `${r.zone}:${r.shippingClass}:${r.priceCents}`,
      ),
    ).toEqual(['DE:brief:450', 'DE:paket_klein:650', 'DE:keramik:890'])
    expect(s.payment!.iban).toBe(DEFAULT_IBAN)
    expect(s.retention!.invoiceYears).toBe('10')
    expect(s.legal!.allowVisibleBlankBrands).toBe(false)
    expect(s.tattoo!.minPriceCents).toBe(8000)
    expect(s.tattoo!.priceNote).toMatch(/^All prices are final prices/)
    expect(
      (s.packaging!.defaultsByShippingClass as { templateKey: string }[]).map((d) => d.templateKey),
    ).toEqual(['brief-karton', 'tasche-papier', 'keramik-doppelkarton'])
    expect((s as unknown as { safetyTemplates: { text: string }[] }).safetyTemplates).toHaveLength(
      6,
    )
    expect(
      (
        s as unknown as { safetyTemplates: { category: string; text: string }[] }
      ).safetyTemplates.find((t) => t.category === 'keramik')?.text,
    ).toMatch(/^Handmade/)
    const st = (await payload.findGlobal({
      slug: 'site-texts',
      locale: 'en',
      fallbackLocale: false,
      overrideAccess: true,
    })) as unknown as { navigation: { mainLinks: { label: string }[] } }
    expect(st.navigation.mainLinks.map((l) => l.label)).toContain('About')
  })

  it('DM-P1-04/AK-SEED-04 (Teil): ein zweiter seed:base-Lauf erzeugt keine Duplikate und überschreibt keinen Wert', async () => {
    // Juttas Werte: IBAN, Kategorie-Text und Seitentext ändern, dann erneut seeden.
    await payload.updateGlobal({
      slug: 'settings',
      data: {
        payment: { iban: 'DE89370400440532013000', accountHolder: 'Jutta Beispiel' },
      } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
    const keramik = (
      await payload.find({
        collection: 'categories',
        where: { key: { equals: 'keramik' } },
        overrideAccess: true,
      })
    ).docs[0]!
    await payload.update({
      collection: 'categories',
      id: keramik.id,
      data: { intro: 'Mein eigener Text über Keramik.' },
      locale: 'de',
      overrideAccess: true,
    })
    const before = await snapshot()
    const { report } = await seedBase()
    expect(await snapshot()).toEqual(before)
    expect(report.get('categories', 'created')).toBe(0)
    expect(report.get('legal-texts', 'created')).toBe(0)
    expect(report.get('users', 'created')).toBe(0)
    const s = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
    })) as unknown as Settings
    expect(s.payment!.iban).toBe('DE89370400440532013000')
  })

  it('AK-SEED-02: getActiveLegalText("agb", jetzt) liefert v1; jede Platzhalter-Fassung rendert ohne Token-Fehler (R-002, R-012)', async () => {
    const agb = await getActiveLegalText('agb', new Date(), { payload })
    expect(agb?.version).toBe(1)
    expect(agb?.isPlaceholder).toBe(true)
    const settings = await payload.findGlobal({
      slug: 'settings',
      locale: 'de',
      overrideAccess: true,
    })
    // P12.11: ausformulierte Fassungen in DE und EN (U-00), Tokens aus den Einstellungen der jeweiligen Sprache
    for (const locale of ['de', 'en'] as const) {
      const settingsInLocale = await payload.findGlobal({
        slug: 'settings',
        locale,
        overrideAccess: true,
      })
      const values = buildLegalTokenValues({
        settings: settingsInLocale as never,
        siteUrl: 'https://planetclairetattoos.com',
        locale,
        returnCostsNote: activeReturnCostsNote(locale),
      })
      for (const type of LEGAL_TEXT_TYPES) {
        // ohne Rückfall auf Deutsch: die englische Fassung muss wirklich vorhanden sein (U-00, R-015)
        const text = await getActiveLegalText(type, new Date(), {
          payload,
          locale,
          fallbackLocale: false,
        })
        expect(text, `${type} ${locale}`).not.toBeNull()
        const rendered = renderLegalContent(text!.content as unknown as LexicalContent, values)
        expect(rendered.plainText.length, `${type} ${locale}`).toBeGreaterThan(400)
        expect(rendered.plainText).not.toContain('Text folgt von der Kanzlei.')
        expect(rendered.plainText).not.toMatch(/PLATZHALTER/)
        expect(rendered.plainText).not.toMatch(/\{\{|\}\}/)
      }
    }
  })
})

describe('Grund-Seed: Rechtstexte nachrüsten (P12.11)', () => {
  it('R-002 R-013 ältere Platzhalter-Gliederung (v1, alter Quellenvermerk) → ausformulierte v2 DE+EN, v1 abgelöst, zweiter Lauf ändert nichts', async () => {
    const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } })
      .drizzle
    await db.execute(
      sql`UPDATE legal_texts SET source_note = 'Platzhalter aus dem Grund-Seed' WHERE type = 'impressum'`,
    )
    const { report } = await seedBase()
    expect(report.get('legal-texts', 'updated')).toBe(1)
    expect(report.get('legal-texts', 'created')).toBe(0)
    const docs = await payload.find({
      collection: 'legal-texts',
      where: { type: { equals: 'impressum' } },
      sort: 'version',
      locale: 'all',
      overrideAccess: true,
      pagination: false,
    })
    expect(docs.docs.map((d) => [d.version, d.status])).toEqual([
      [1, 'superseded'],
      [2, 'active'],
    ])
    const v2 = docs.docs[1]!
    expect(v2.origin).toBe('placeholder')
    expect(v2.isPlaceholder).toBe(true)
    expect(JSON.stringify(v2.content)).toContain('Anbieterin')
    expect(JSON.stringify(v2.content)).toContain('Provider')
    expect(v2.pdfDe).toBeTruthy()
    const again = await seedBase()
    expect(again.report.get('legal-texts', 'updated')).toBe(0)
    expect(again.report.get('legal-texts', 'created')).toBe(0)
  })
})

describe('Verbotsmuster über content/seed/** (AK-SEED-13, Teil)', () => {
  it('AK-SEED-13: keine Treffer der Verbotsmuster (RECHT §5) in den Seed-Dateien', async () => {
    const root = path.join(process.cwd(), 'content', 'seed')
    const files: string[] = []
    const walk = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) await walk(p)
        else if (/\.(json|md)$/.test(entry.name)) files.push(p)
      }
    }
    await walk(root)
    expect(files.some((f) => f.endsWith('base.json'))).toBe(true)
    const hits: string[] = []
    for (const file of files) {
      const text = await readFile(file, 'utf8')
      for (const { id, re } of FORBIDDEN_CONTENT_PATTERNS) {
        const m = re.exec(text)
        if (m) hits.push(`${path.relative(root, file)}: ${id} „${m[0]}“`)
      }
    }
    expect(hits).toEqual([])
  })
})
