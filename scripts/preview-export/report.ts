// Bericht und Größenbudget der Vorschau-Datei (ARCHITEKTUR §14.8, KONZEPT §12.6): Ziel ≤ 20 MB (per Mail
// versendbar), harte Grenze 40 MB (1 MB = 1.000.000 Byte). Über dem Ziel wird automatisch neu kodiert – erst Qualität 60,
// dann zusätzlich längste Kante 1000 px – bis die Datei ≤ 20 MB ist. Bleibt sie über 20 MB, aber ≤ 40 MB: Warnung im
// Bericht (`budget.result = 'warn'`), Exit 0. Über 40 MB → Exit 1. Richtwerte je Art erzeugen nur Warnungen.
import { z } from 'zod'

import { ExportError } from './errors'
import { IMAGE_SETTING_STEPS, type ImageSettings } from './transform/images'

export const TARGET_BYTES = 20_000_000
export const LIMIT_BYTES = 40_000_000

/** Richtwerte je Art (KONZEPT §12.6); CSS und Laufzeit zusammen. */
export const KIND_BUDGETS = {
  images: 10_000_000,
  fonts: 500_000,
  cssRuntime: 1_500_000,
  templates: 6_000_000,
  adminShots: 2_000_000,
} as const

const sizeByKind = z.object({
  images: z.number().int().nonnegative(),
  fonts: z.number().int().nonnegative(),
  css: z.number().int().nonnegative(),
  runtime: z.number().int().nonnegative(),
  templates: z.number().int().nonnegative(),
  adminShots: z.number().int().nonnegative(),
})

export const PreviewReportSchema = z.object({
  version: z.literal(1),
  file: z.literal('planet-claire-vorschau.html'),
  sizeBytes: z.number().int().positive(),
  sizeByKind,
  imageSettings: z.object({
    maxEdge: z.union([z.literal(1200), z.literal(1000)]),
    quality: z.union([z.literal(70), z.literal(60)]),
  }),
  routes: z.array(
    z.object({
      route: z.string().min(1),
      lang: z.enum(['de', 'en']),
      title: z.string(),
      status: z.enum(['ok', 'not-built']),
      bytes: z.number().int().nonnegative(),
    }),
  ),
  adminViews: z.array(z.object({ key: z.string().min(1), status: z.enum(['ok', 'not-built']) })),
  warnings: z.array(z.string()),
  phase: z.string().regex(/^p(\d{1,2}|x)$/),
  gitSha: z.string().min(1),
  seedNow: z.string().min(1),
  generatedAt: z.string().min(1),
  budget: z.object({
    limitBytes: z.literal(LIMIT_BYTES),
    targetBytes: z.literal(TARGET_BYTES),
    result: z.enum(['ok', 'warn']),
  }),
})

export type PreviewReport = z.infer<typeof PreviewReportSchema>
export type SizeByKind = PreviewReport['sizeByKind']

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`

/** `ok` ≤ 20 MB, `warn` ≤ 40 MB, sonst `fail`. */
export function budgetResult(sizeBytes: number): 'ok' | 'warn' | 'fail' {
  if (sizeBytes <= TARGET_BYTES) return 'ok'
  if (sizeBytes <= LIMIT_BYTES) return 'warn'
  return 'fail'
}

/** Warnungen für überschrittene Richtwerte je Art. */
export function kindWarnings(sizes: SizeByKind): string[] {
  const out: string[] = []
  const check = (label: string, value: number, limit: number) => {
    if (value > limit)
      out.push(`Richtwert ${label} überschritten: ${mb(value)} (Richtwert ${mb(limit)}).`)
  }
  check('Bilder', sizes.images, KIND_BUDGETS.images)
  check('Schriften', sizes.fonts, KIND_BUDGETS.fonts)
  check('CSS + Laufzeit', sizes.css + sizes.runtime, KIND_BUDGETS.cssRuntime)
  check('Templates', sizes.templates, KIND_BUDGETS.templates)
  check('Verwaltungs-Fotos', sizes.adminShots, KIND_BUDGETS.adminShots)
  return out
}

export interface BudgetedBuild<T extends { sizeBytes: number }> {
  result: T
  settings: ImageSettings
  budget: 'ok' | 'warn'
  warnings: string[]
}

/**
 * Baut die Datei mit den Bild-Stufen (70/1200 → 60/1200 → 60/1000), bis sie ≤ 20 MB ist. Über 40 MB nach der letzten
 * Stufe → ExportError Exit 1.
 */
export async function buildWithinBudget<T extends { sizeBytes: number }>(
  build: (settings: ImageSettings) => Promise<T>,
  steps: readonly ImageSettings[] = IMAGE_SETTING_STEPS,
): Promise<BudgetedBuild<T>> {
  const warnings: string[] = []
  let last: { result: T; settings: ImageSettings } | null = null
  for (const settings of steps) {
    const result = await build(settings)
    last = { result, settings }
    if (result.sizeBytes <= TARGET_BYTES) break
    warnings.push(
      `Datei ${mb(result.sizeBytes)} mit Bildern ${settings.maxEdge} px/Qualität ${settings.quality} – über dem Ziel von 20 MB.`,
    )
  }
  if (!last) throw new ExportError(1, 'Keine Bild-Stufe angegeben.')
  const result = budgetResult(last.result.sizeBytes)
  if (result === 'fail') {
    throw new ExportError(
      1,
      `Vorschau-Datei ist ${mb(last.result.sizeBytes)} groß – über der harten Grenze von 40 MB.`,
    )
  }
  if (result === 'warn') {
    warnings.push(
      'Die Datei ist zu groß für eine Mail – auf einen anderen eigenen Rechner bringen (per Link oder USB-Stick).',
    )
  }
  return { result: last.result, settings: last.settings, budget: result, warnings }
}

/** Prüft den Bericht (zod) und liefert ihn formatiert (stabile Schlüsselreihenfolge des Schemas). */
export function serializeReport(report: PreviewReport): string {
  return `${JSON.stringify(PreviewReportSchema.parse(report), null, 2)}\n`
}
