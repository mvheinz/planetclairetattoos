import { statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PRODUCT_CATEGORIES } from '../../../src/lib/enums'
import { CATEGORY_TILES, categoryTile } from '../../../src/lib/shop/categoryTiles'

describe('Kategorie-Kacheln (P12.15)', () => {
  it('jede Kategorie und „Alle“ hat ein Bild, verschiedene Kategorien verschiedene Bilder', () => {
    for (const key of [...PRODUCT_CATEGORIES, 'all']) expect(CATEGORY_TILES[key], key).toBeDefined()
    const srcs = Object.values(CATEGORY_TILES).map((t) => t.src)
    expect(new Set(srcs).size).toBe(srcs.length)
  })

  it('Dateien existieren und sind höchstens 25 KB', () => {
    for (const t of Object.values(CATEGORY_TILES)) {
      const size = statSync(path.join(process.cwd(), 'public', t.src)).size
      expect(size).toBeGreaterThan(500)
      expect(size).toBeLessThanOrEqual(25 * 1024)
    }
  })

  it('unbekannte Schlüssel fallen auf „Alle“ zurück', () => {
    expect(categoryTile('gibt-es-nicht')).toBe(CATEGORY_TILES.all)
  })
})
