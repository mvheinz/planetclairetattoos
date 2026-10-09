import { readFileSync } from 'node:fs'
import path from 'node:path'

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setRequestLocale = vi.fn()
vi.mock('next-intl/server', () => ({ setRequestLocale: (l: string) => setRequestLocale(l) }))

import { listVariantPage } from '@/components/listVariantPage'

// P14.13 (U-62): Die fünf statischen Listen-Varianten (R02, R03, R05, R12, R15) nutzen eine gemeinsame Hülle. Geprüft:
// Reihenfolge Sprache → Varianten-Parser → `setRequestLocale` → Inhalt, Metadaten mit den Roh-Parametern,
// `generateStaticParams` mit der aufgelösten Sprache – und dass jede Seite ihre Segment-Optionen als Literale behält.

const ROOT = path.resolve(__dirname, '../../..')
const PAGES = [
  'src/app/(frontend)/[locale]/shop/variant/[variant]/page.tsx',
  'src/app/(frontend)/[locale]/shop/category/[slug]/variant/[variant]/page.tsx',
  'src/app/(frontend)/[locale]/archive/variant/[variant]/page.tsx',
  'src/app/(frontend)/[locale]/tattoo/flash/variant/[variant]/page.tsx',
  'src/app/(frontend)/[locale]/tattoo/gallery/variant/[variant]/page.tsx',
]

describe('listVariantPage (P14.13)', () => {
  const calls: string[] = []
  const spec = {
    locale: vi.fn((raw: string) => {
      calls.push(`locale:${raw}`)
      return (raw === 'en' ? 'en' : 'de') as 'de' | 'en'
    }),
    list: vi.fn((variant: string) => {
      calls.push(`list:${variant}`)
      return variant === 'available-1' ? { available: true as const } : {}
    }),
    staticParams: vi.fn(async (locale: 'de' | 'en') => [{ variant: `available-1-${locale}` }]),
    metadata: vi.fn(async (p: { locale: string; variant: string }) => ({
      title: `${p.locale}/${p.variant}`,
    })),
    render: vi.fn((locale: string, list: object) => {
      calls.push('render')
      return <p data-locale={locale}>{JSON.stringify(list)}</p>
    }),
  }
  const page = listVariantPage(spec)

  beforeEach(() => {
    calls.length = 0
    setRequestLocale.mockReset()
    setRequestLocale.mockImplementation(() => calls.push('setRequestLocale'))
  })

  it('Seite: Sprache, Parser, setRequestLocale, dann Inhalt mit Sprache, Liste und Roh-Parametern', async () => {
    const el = await page.Page({
      params: Promise.resolve({ locale: 'en', variant: 'available-1' }),
    })
    expect(calls).toEqual(['locale:en', 'list:available-1', 'setRequestLocale', 'render'])
    expect(setRequestLocale).toHaveBeenCalledWith('en')
    expect(spec.render).toHaveBeenLastCalledWith(
      'en',
      { available: true },
      { locale: 'en', variant: 'available-1' },
    )
    expect((el.props as { 'data-locale'?: string })['data-locale']).toBe('en')
  })

  it('generateStaticParams bekommt die aufgelöste Sprache, generateMetadata die Roh-Parameter', async () => {
    expect(await page.generateStaticParams({ params: { locale: 'de' } })).toEqual([
      { variant: 'available-1-de' },
    ])
    expect(
      await page.generateMetadata({ params: Promise.resolve({ locale: 'xx', variant: 'page-2' }) }),
    ).toEqual({ title: 'xx/page-2' })
  })

  it('alle fünf Varianten-Seiten nutzen die Hülle und behalten revalidate/dynamicParams als Literale', () => {
    for (const rel of PAGES) {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      expect(src, rel).toContain("from '@/components/listVariantPage'")
      expect(src, rel).toMatch(/^export const revalidate = 3600$/m)
      expect(src, rel).toMatch(/^export const dynamicParams = true$/m)
      expect(src, rel).toMatch(/^export const generateStaticParams = page\.generateStaticParams$/m)
      expect(src, rel).toMatch(/^export const generateMetadata = page\.generateMetadata$/m)
      expect(src, rel).toMatch(/^export default page\.Page$/m)
    }
  })
})
