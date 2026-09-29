import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { matchSegments } from '@/lib/routes/paths'
import {
  canonicalListUrl,
  decideListVariant,
  isInternalVariantPath,
  listSearch,
  parseListParams,
  parseVariantKey,
  variantKey,
} from '@/lib/shop/listParams'

// P3.2 Spike B-05: Listen-Parameter → statische Varianten (ARCHITEKTUR §9.1, KONZEPT §2.3, AK-A-9-03).

const ROOT = path.resolve(import.meta.dirname, '../../..')

describe('parseListParams (KONZEPT §2.3)', () => {
  it('bekannte Parameter je Liste; unbekannte entfallen', () => {
    expect(parseListParams('R02', '?available=1&page=2&foo=bar')).toEqual({
      available: true,
      page: 2,
    })
    expect(parseListParams('R03', 'page=3')).toEqual({ page: 3 })
    // `category` nur im Archiv, `available` nicht im Archiv.
    expect(parseListParams('R02', 'category=keramik')).toEqual({})
    expect(parseListParams('R05', 'category=keramik&available=1&page=2')).toEqual({
      category: 'keramik',
      page: 2,
    })
    expect(parseListParams('R02', { available: ['1', '0'], page: undefined })).toEqual({
      available: true,
    })
  })

  it('ungültige Werte wie fehlend: page=0, page=abc, page=1, page=1000, available=2, fremder Slug', () => {
    for (const q of [
      'page=0',
      'page=abc',
      'page=1',
      'page=02',
      'page=1000',
      'page=2.5',
      'page=-2',
      'available=2',
      'available=true',
      'available=',
    ]) {
      expect(parseListParams('R02', q), q).toEqual({})
    }
    for (const c of ['Keramik', '../x', 'a b', 'kera_mik', '-x', 'x-', 'a.b', 'x'.repeat(61)]) {
      expect(parseListParams('R05', { category: c }), c).toEqual({})
    }
    expect(parseListParams('R02', 'page=999')).toEqual({ page: 999 })
  })
})

describe('variantKey / parseVariantKey', () => {
  it('Schlüssel alphabetisch sortiert, Grundform leer', () => {
    expect(variantKey({ page: 2, available: true })).toBe('available-1.page-2')
    expect(variantKey({ page: 4, category: 'caps' })).toBe('category-caps.page-4')
    expect(variantKey({ category: 'zeichnungen' })).toBe('category-zeichnungen')
    expect(variantKey({})).toBe('')
    expect(variantKey({ page: 1 })).toBe('')
    // Reihenfolge der Query egal → gleicher Schlüssel.
    expect(variantKey(parseListParams('R02', 'page=2&available=1'))).toBe('available-1.page-2')
    expect(variantKey(parseListParams('R02', 'available=1&page=2'))).toBe('available-1.page-2')
  })

  it('nur kanonische Schlüssel sind gültig (sonst 404)', () => {
    expect(parseVariantKey('R02', 'available-1.page-2')).toEqual({ available: true, page: 2 })
    expect(parseVariantKey('R05', 'category-caps.page-3')).toEqual({ category: 'caps', page: 3 })
    for (const bad of [
      '',
      'page-2.available-1',
      'page-1',
      'page-0',
      'available-2',
      'category-caps',
      'foo-bar',
      'available-1.foo-bar',
      'available-1.available-1',
      'page-2.',
    ]) {
      expect(parseVariantKey('R02', bad), bad).toBeNull()
    }
    expect(parseVariantKey('R05', 'available-1')).toBeNull()
  })
})

describe('canonicalListUrl (KONZEPT §2.3)', () => {
  it('ohne available/category, page erst ab Seite 2', () => {
    expect(canonicalListUrl('/de/shop', { available: true, page: 2 })).toBe('/de/shop?page=2')
    expect(canonicalListUrl('/de/shop', { available: true })).toBe('/de/shop')
    expect(canonicalListUrl('/en/archive', { category: 'caps' })).toBe('/en/archive')
    expect(canonicalListUrl('/de/archiv', { category: 'caps', page: 3 })).toBe('/de/archiv?page=3')
    expect(canonicalListUrl('/de/shop', {})).toBe('/de/shop')
  })

  it('sichtbare Query-Form in fester Reihenfolge', () => {
    expect(listSearch({ page: 2, available: true })).toBe('?available=1&page=2')
    expect(listSearch({})).toBe('')
  })
})

describe('decideListVariant (Proxy, ARCHITEKTUR §9.1)', () => {
  it('R02/R03/R05 mit Parametern → interner Pfad (Ordner = EN-Pfade)', () => {
    expect(decideListVariant('/de/shop', '?available=1&page=2')).toEqual({
      kind: 'rewrite',
      pathname: '/de/shop/variant/available-1.page-2',
      routeId: 'R02',
      key: 'available-1.page-2',
    })
    expect(decideListVariant('/en/shop/category/ceramics', '?page=2')).toMatchObject({
      kind: 'rewrite',
      pathname: '/en/shop/category/ceramics/variant/page-2',
      routeId: 'R03',
    })
    expect(decideListVariant('/de/shop/kategorie/keramik', '?available=1')).toMatchObject({
      pathname: '/de/shop/category/keramik/variant/available-1',
    })
    expect(decideListVariant('/de/archiv', '?page=2&category=caps')).toMatchObject({
      pathname: '/de/archive/variant/category-caps.page-2',
      routeId: 'R05',
    })
  })

  it('?foo=bar, ungültige Werte und andere Seiten → keine Umschreibung (wie ohne Parameter)', () => {
    expect(decideListVariant('/de/shop', '?foo=bar')).toEqual({ kind: 'none' })
    expect(decideListVariant('/de/shop', '?page=0&available=2')).toEqual({ kind: 'none' })
    expect(decideListVariant('/de/shop', '')).toEqual({ kind: 'none' })
    expect(decideListVariant('/de/impressum', '?page=2')).toEqual({ kind: 'none' })
    expect(decideListVariant('/de/shop/017-schale', '?page=2')).toEqual({ kind: 'none' })
    expect(decideListVariant('/shop', '?page=2')).toEqual({ kind: 'none' })
  })

  it('interne Varianten-Pfade sind direkt nicht erreichbar (404)', () => {
    for (const p of [
      '/de/shop/variant/available-1.page-2',
      '/en/shop/variant/page-2',
      '/de/shop/variant',
      '/de/shop/category/keramik/variant/page-2',
      '/de/archive/variant/page-2',
      '/de/archiv/variant/page-2',
    ]) {
      expect(isInternalVariantPath(p), p).toBe(true)
      expect(decideListVariant(p, '')).toEqual({ kind: 'not-found' })
    }
    for (const p of ['/de/shop', '/de/variant', '/de/shop/kategorie/variant', '/de/impressum']) {
      expect(isInternalVariantPath(p), p).toBe(false)
    }
  })

  it('Layout-Segmente der Variante gehören zur Liste (Preset, Navigation)', () => {
    expect(matchSegments(['shop', 'variant', 'available-1.page-2'])?.route.id).toBe('R02')
    expect(matchSegments(['archive', 'variant', 'page-2'])?.route.id).toBe('R05')
    expect(matchSegments(['shop', 'category', 'keramik', 'variant', 'page-2'])?.route.id).toBe(
      'R03',
    )
    expect(matchSegments(['legal-notice', 'variant', 'page-2'])).toBeNull()
  })
})

describe('Proxy ohne Datenbank (ARCHITEKTUR §9.5)', () => {
  /** Alle von `src/proxy.ts` aus erreichbaren Quelldateien (relative und `@/`-Importe). */
  function importGraph(entry: string): { files: Set<string>; packages: Set<string> } {
    const files = new Set<string>()
    const packages = new Set<string>()
    const resolve = (from: string, spec: string): string | null => {
      const base = spec.startsWith('@/')
        ? path.join(ROOT, 'src', spec.slice(2))
        : spec.startsWith('.')
          ? path.resolve(path.dirname(from), spec)
          : null
      if (!base) return null
      for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        if (existsSync(cand) && statSync(cand).isFile()) return cand
      }
      return null
    }
    const visit = (file: string) => {
      if (files.has(file)) return
      files.add(file)
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
        const spec = m[1]!
        const target = resolve(file, spec)
        if (target) visit(target)
        else if (!spec.startsWith('.') && !spec.startsWith('@/')) packages.add(spec)
      }
    }
    visit(path.join(ROOT, entry))
    return { files, packages }
  }

  it('AK-A-9-03 der Proxy importiert weder Payload noch Datenbanktreiber oder Datenschicht', () => {
    const { files, packages } = importGraph('src/proxy.ts')
    const rel = [...files].map((f) => path.relative(ROOT, f))
    expect(rel).toContain('src/lib/shop/listParams.ts')
    for (const pkg of packages) {
      expect(pkg, pkg).not.toMatch(/^(payload|@payloadcms|@payload-config|pg|drizzle-orm|postgres)/)
    }
    for (const f of rel) {
      expect(f, f).not.toMatch(/^src\/(lib\/data|lib\/payload|collections|payload\.config)/)
    }
  })
})
