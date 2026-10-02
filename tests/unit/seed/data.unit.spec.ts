import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { SEED_KEY_REGEX } from '@/fields/seed'
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES } from '@/lib/enums'
import { lintProductText } from '@/lib/legal/forbidden'
import { cropPixels } from '@/lib/seed/example'
import { fallbackArtSvg, placeholderArtWebp } from '@/lib/seed/fallbackArt'
import { expectedCount } from '@/lib/seed/expected'
import { loadSeedData, SEED_DATA_DIR } from '@/lib/seed/loader'
import { SEED_FILE_SCHEMAS } from '@/lib/seed/schemas'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'
import { seedToken } from '@/lib/seed/tokens'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'

// P1.30: Datendateien des Mini-Beispielbestands (SEED-SPEC §2, §4, §5, §7.3, §13) – zod-Schemas, Verweise,
// Mail-Domains (AK-SEED-12), Bildquellen (AK-SEED-19), Ersatzzeichnung (§4.3) und Seed-Token (§2.5).

const now = new Date(CANONICAL_SEED_NOW)
const dir = path.join(process.cwd(), SEED_DATA_DIR)
const EXAMPLE_FILES = Object.keys(SEED_FILE_SCHEMAS).filter((f) => f !== 'base.json')

async function raw(file: string): Promise<string> {
  return readFile(path.join(dir, file), 'utf8')
}

describe('Seed-Datendateien (zod, SEED-SPEC §2.1)', () => {
  it('alle Dateien bestehen ihr zod-Schema und die dateiübergreifende Prüfung', async () => {
    const data = await loadSeedData({ dir, now, requireBase: true })
    expect(data.products.map((p) => p.key)).toEqual(
      Array.from(
        { length: expectedCount('products') },
        (_, i) => `S${String(i + 1).padStart(2, '0')}`,
      ),
    )
    expect(new Set(data.products.map((p) => p.state.status))).toEqual(new Set(PRODUCT_STATUSES))
    expect(new Set(data.products.map((p) => p.category))).toEqual(new Set(PRODUCT_CATEGORIES))
    expect(data.orders.orders).toHaveLength(expectedCount('orders'))
    expect(data.orders.checkouts.map((c) => c.key)).toEqual(['KS1', 'KS2'])
    expect(data.orders.reservations.map((r) => r.key)).toEqual(['KS1', 'KS2'])
    // §4.4: Nachweise (P1), Packfotos O12 und Skizze A2 (P8.2); Reklamationsfotos folgen mit P8.5a
    expect(data.privateUploads.map((u) => u.key)).toEqual(
      expect.arrayContaining([
        'nickel-demo',
        'glaze-demo',
        'O12:packing-1',
        'O12:packing-2',
        'A2:sketch-1',
      ]),
    )
    expect(data.pages.map((p) => p.key)).toEqual(['home', 'contact'])
    // Alle abgeleiteten seedKeys erfüllen das Format (§1.2).
    const keys = [
      ...data.media.instagram.map((m) => `media:${m.key}`),
      ...data.media.placeholders.map((m) => `media:${m.key}`),
      ...data.privateUploads.map((u) => `private-uploads:${u.key}`),
      ...data.products.map((p) => `products:${p.key}`),
      ...data.orders.checkouts.map((c) => `checkouts:${c.key}`),
      ...data.orders.orders.map((o) => `orders:${o.key}`),
      ...data.customers.map((c) => `customers:${c.key}`),
      ...data.orders.reservations.map((r) => `reservations:${r.key}`),
      ...data.pages.map((p) => `pages:${p.key}`),
    ]
    for (const k of keys) expect(k).toMatch(SEED_KEY_REGEX)
  })

  it('Schemas lehnen falsche Enum-Werte und absolute Daten ab', () => {
    const product = SEED_FILE_SCHEMAS['products.json'].safeParse([
      { key: 'S01', itemNumber: 901, category: 'vase' },
    ])
    expect(product.success).toBe(false)
    const orders = SEED_FILE_SCHEMAS['orders.json'].safeParse({
      checkouts: [],
      orders: [],
      reservations: [
        {
          key: 'KS2',
          checkout: 'checkouts:KS2',
          product: 'products:S27',
          source: 'checkout_session',
          status: 'active',
          createdAt: '2026-10-15T07:54:00Z',
          expiresAt: 'N+30min',
        },
      ],
    })
    expect(orders.success).toBe(false)
  })

  it('AK-SEED-12: alle Personen-E-Mails enden auf @example.com oder @example.org; kein Datensatz hat eine Telefonnummer', async () => {
    for (const file of EXAMPLE_FILES) {
      let text: string
      try {
        text = await raw(file)
      } catch {
        continue
      }
      for (const mail of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
        expect(mail, file).toMatch(/@example\.(com|org)$/)
      }
      expect(text, file).not.toMatch(/"(phone|telefon|tel)"\s*:/i)
      expect(text, file).not.toMatch(/\+\d{2}[\s\d/-]{6,}|\bTel\.?\s*:?\s*\d/i)
    }
  })

  it('AK-SEED-13 (Teil): keine Verbotsmuster in den Datendateien; Produkttexte ohne V-13/V-16-Treffer', async () => {
    for (const file of Object.keys(SEED_FILE_SCHEMAS)) {
      const text = await raw(file)
      for (const { id, re } of FORBIDDEN_CONTENT_PATTERNS)
        expect(re.test(text), `${file} ${id}`).toBe(false)
    }
    const data = await loadSeedData({ dir, now })
    for (const p of data.products) {
      for (const field of [p.title, p.description, p.juttaSays, p.materials]) {
        for (const text of [field?.de, field?.en]) {
          expect(lintProductText(text), `${p.key}: ${text}`).toEqual([])
        }
      }
    }
  })

  it('AK-SEED-19 (Teil): nur Beiträge aus dem Manifest; nie Highlights oder profil.jpg; DdHXUQsDjqm nur als #cap', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(process.cwd(), 'content/seed/instagram/manifest.json'), 'utf8'),
    ) as { images: { file: string; kind: string }[] }
    const posts = new Set(
      manifest.images
        .filter((i) => i.kind !== 'highlight' && i.kind !== 'profile')
        .map((i) => i.file),
    )
    const data = await loadSeedData({ dir, now })
    for (const m of data.media.instagram) {
      expect(posts.has(m.file), m.file).toBe(true)
      expect(m.file).not.toMatch(/highlight|profil/)
      if (m.file === 'post-DdHXUQsDjqm.jpg') expect(m.key).toBe('ig:DdHXUQsDjqm#cap')
      expect(m.key.slice(3).split('#')[0]).toBe(m.file.slice(5, -4))
    }
  })

  it('Ausschnitte in Prozent der tatsächlichen Quelle (§2.4, §4.1 Kontrollwerte)', async () => {
    expect(cropPixels({ x: 46, y: 21.5, w: 54, h: 38 }, 360, 640)).toEqual({
      left: 166,
      top: 138,
      width: 194,
      height: 243,
    })
    expect(cropPixels({ x: 10, y: 25, w: 80, h: 75 }, 480, 640)).toEqual({
      left: 48,
      top: 160,
      width: 384,
      height: 480,
    })
    expect(cropPixels({ x: 16, y: 0, w: 68, h: 45 }, 480, 640)).toEqual({
      left: 77,
      top: 0,
      width: 326,
      height: 288,
    })
  })
})

describe('Ersatzzeichnung (SEED-SPEC §4.3)', () => {
  it('deterministisch, 400×500, kein Text, Wash aus den Tokens; gerastert als WebP 800×1000', async () => {
    const a = fallbackArtSvg('ph:teller-01', 'clay')
    expect(fallbackArtSvg('ph:teller-01', 'clay')).toBe(a)
    expect(a).toContain('viewBox="0 0 400 500"')
    expect(a).toContain('#E3D3BA')
    expect(a).not.toMatch(/<text/)
    expect(fallbackArtSvg('ph:flash-902', null)).not.toContain('#E3D3BA')
    expect(fallbackArtSvg('ph:teller-02', 'sky')).not.toBe(fallbackArtSvg('ph:teller-01', 'sky'))
    const { data, fromFile } = await placeholderArtWebp('ph:shirt-02', 'clay')
    expect(fromFile).toBe(false)
    const meta = await sharp(data).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 800, 1000])
    expect(() => fallbackArtSvg('ph:vase-01', 'clay')).toThrow(/Unbekannter Platzhalter/)
  })
})

describe('seedToken (SEED-SPEC §2.5)', () => {
  it('43 Zeichen base64url, deterministisch aus dem seedKey, unabhängig von PAYLOAD_SECRET, nur passende Collection', () => {
    const t = seedToken('checkouts:KS2', 'checkout')
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(seedToken('checkouts:KS2', 'checkout')).toBe(t)
    const secret = process.env.PAYLOAD_SECRET
    process.env.PAYLOAD_SECRET = 'ein-ganz-anderer-geheimer-schluessel-1234567890'
    expect(seedToken('checkouts:KS2', 'checkout')).toBe(t)
    process.env.PAYLOAD_SECRET = secret
    expect(seedToken('orders:O10', 'status')).not.toBe(seedToken('orders:O11', 'status'))
    expect(() => seedToken('orders:O10', 'checkout')).toThrow()
    expect(() => seedToken('PC-2026-90010', 'status')).toThrow()
  })
})
