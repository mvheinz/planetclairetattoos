import { describe, expect, it } from 'vitest'

import { ExportError } from '../../../scripts/preview-export/errors'
import {
  LIMIT_BYTES,
  PreviewReportSchema,
  TARGET_BYTES,
  budgetResult,
  buildWithinBudget,
  kindWarnings,
  serializeReport,
  type PreviewReport,
} from '../../../scripts/preview-export/report'
import type { ImageSettings } from '../../../scripts/preview-export/transform/images'

const report = (patch: Partial<PreviewReport> = {}): PreviewReport => ({
  version: 1,
  file: 'planet-claire-vorschau.html',
  sizeBytes: 880_000,
  sizeByKind: {
    images: 6000,
    fonts: 131_000,
    css: 35_000,
    runtime: 50_000,
    templates: 530_000,
    adminShots: 115_000,
  },
  imageSettings: { maxEdge: 1200, quality: 70 },
  routes: [{ route: '/de', lang: 'de', title: 'Planet Claire', status: 'ok', bytes: 20_000 }],
  adminViews: [{ key: 'login', status: 'ok' }],
  warnings: [],
  phase: 'p2',
  gitSha: 'abc1234',
  seedNow: '2026-09-28T12:00:00+02:00',
  generatedAt: '2026-09-28T05:00:00.000Z',
  budget: { limitBytes: LIMIT_BYTES, targetBytes: TARGET_BYTES, result: 'ok' },
  ...patch,
})

describe('Vorschau-Export: Bericht (ARCHITEKTUR §14.8)', () => {
  it('PreviewReport ist mit zod geprüft', () => {
    expect(() => serializeReport(report())).not.toThrow()
    expect(PreviewReportSchema.safeParse(report({ phase: 'P2' })).success).toBe(false)
    expect(
      PreviewReportSchema.safeParse({
        ...report(),
        budget: { ...report().budget, limitBytes: 50_000_000 },
      }).success,
    ).toBe(false)
    expect(
      PreviewReportSchema.safeParse(
        report({ imageSettings: { maxEdge: 800, quality: 70 } as never }),
      ).success,
    ).toBe(false)
  })

  it('Grenzen: Ziel 20 MB, hart 40 MB (1 MB = 1.000.000 Byte)', () => {
    expect(budgetResult(20_000_000)).toBe('ok')
    expect(budgetResult(20_000_001)).toBe('warn')
    expect(budgetResult(40_000_000)).toBe('warn')
    expect(budgetResult(40_000_001)).toBe('fail')
  })

  it('Richtwerte je Art erzeugen nur Warnungen', () => {
    expect(kindWarnings(report().sizeByKind)).toEqual([])
    const w = kindWarnings({
      images: 11_000_000,
      fonts: 600_000,
      css: 1_000_000,
      runtime: 600_000,
      templates: 1,
      adminShots: 3_000_000,
    })
    expect(w).toHaveLength(4)
    expect(w[0]).toContain('Bilder')
  })
})

describe('Vorschau-Export: Größenbudget mit Stufung (KONZEPT §12.6)', () => {
  const run = (sizes: number[]) => {
    const seen: ImageSettings[] = []
    const build = async (s: ImageSettings) => {
      seen.push(s)
      return { sizeBytes: sizes[seen.length - 1]! }
    }
    return { seen, promise: buildWithinBudget(build) }
  }

  it('≤ 20 MB → keine Stufung, ok', async () => {
    const { seen, promise } = run([5_000_000])
    const res = await promise
    expect(res.budget).toBe('ok')
    expect(seen).toEqual([{ maxEdge: 1200, quality: 70 }])
  })

  it('über 20 MB → erst Qualität 60, dann 1000 px; stoppt, sobald ≤ 20 MB', async () => {
    const { seen, promise } = run([25_000_000, 19_000_000])
    const res = await promise
    expect(seen).toEqual([
      { maxEdge: 1200, quality: 70 },
      { maxEdge: 1200, quality: 60 },
    ])
    expect(res.settings).toEqual({ maxEdge: 1200, quality: 60 })
    expect(res.budget).toBe('ok')
  })

  it('bleibt über 20 MB, aber ≤ 40 MB → Warnung im Bericht mit Hinweis für die Mail, Exit 0', async () => {
    const { seen, promise } = run([30_000_000, 28_000_000, 25_000_000])
    const res = await promise
    expect(seen.at(-1)).toEqual({ maxEdge: 1000, quality: 60 })
    expect(res.budget).toBe('warn')
    expect(res.warnings.join('\n')).toContain('zu groß für eine Mail')
  })

  it('über 40 MB nach allen Stufen → Exit 1', async () => {
    const { promise } = run([50_000_000, 45_000_000, 41_000_000])
    const err = await promise.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ExportError)
    expect((err as ExportError).exitCode).toBe(1)
  })
})
